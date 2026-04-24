use pnet::datalink::{self, Channel::Ethernet};
use pnet::packet::ethernet::{EtherTypes, EthernetPacket};
use pnet::packet::ipv4::Ipv4Packet;
use pnet::packet::tcp::TcpPacket;
use pnet::packet::udp::UdpPacket;
use pnet::packet::Packet;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapturedPacket {
    pub source: String,
    pub destination: String,
    pub protocol: String,
    pub length: usize,
    pub info: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub source_ip: String,
    pub dest_ip: String,
    pub protocol: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub raw: String,
}

static SNIFF_STOP_FLAG: std::sync::OnceLock<Arc<AtomicBool>> = std::sync::OnceLock::new();
static PACKET_BUFFER: std::sync::OnceLock<Arc<Mutex<Vec<CapturedPacket>>>> = std::sync::OnceLock::new();
static PCAP_WRITER: std::sync::OnceLock<Arc<Mutex<Option<pcap_file::pcap::PcapWriter<std::fs::File>>>>> = std::sync::OnceLock::new();

pub fn start_pcap_capture(path: &str) -> Result<(), String> {
    let file = std::fs::File::create(path).map_err(|e| e.to_string())?;
    let writer = pcap_file::pcap::PcapWriter::new(file).map_err(|e| e.to_string())?;
    let writer_lock = PCAP_WRITER.get_or_init(|| Arc::new(Mutex::new(None)));
    *writer_lock.lock().unwrap() = Some(writer);
    Ok(())
}

pub fn stop_pcap_capture() {
    if let Some(writer_lock) = PCAP_WRITER.get() {
        *writer_lock.lock().unwrap() = None;
    }
}

pub fn stop_sniffing() {
    if let Some(flag) = SNIFF_STOP_FLAG.get() {
        flag.store(true, Ordering::Relaxed);
    }
}

pub async fn start_sniffing(app: AppHandle, interface_name: String) {
    let stop_flag = SNIFF_STOP_FLAG.get_or_init(|| Arc::new(AtomicBool::new(false)));
    let buffer = PACKET_BUFFER.get_or_init(|| Arc::new(Mutex::new(Vec::new())));
    stop_flag.store(false, Ordering::Relaxed);

    let interfaces = datalink::interfaces();
    let interface = interfaces.into_iter()
        .find(|iface| iface.name == interface_name || iface.description == interface_name)
        .unwrap_or_else(|| datalink::interfaces().remove(0));

    let (_, mut rx) = match datalink::channel(&interface, Default::default()) {
        Ok(Ethernet(_, rx)) => ((), rx),
        _ => return,
    };

    let stop_flag_clone = stop_flag.clone();
    let buffer_clone = buffer.clone();
    let app_cred = app.clone();

    // Sniffer Thread
    std::thread::spawn(move || {
        while !stop_flag_clone.load(Ordering::Relaxed) {
            match rx.next() {
                Ok(packet) => {
                    // PCAP Write
                    if let Some(writer_lock) = PCAP_WRITER.get() {
                        if let Ok(mut lock) = writer_lock.lock() {
                            if let Some(writer) = lock.as_mut() {
                                let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap();
                                let pcap_packet = pcap_file::pcap::PcapPacket::new(
                                    ts,
                                    packet.len() as u32,
                                    packet
                                );
                                let _ = writer.write_packet(&pcap_packet);
                            }
                        }
                    }

                    if let Some(eth) = EthernetPacket::new(packet) {
                        let payload = eth.payload().to_vec();
                        if let Some(captured) = process_ethernet(&eth) {
                            // Check for credentials
                            if let Some(cred) = extract_credential(&captured, &payload) {
                                let _ = app_cred.emit("credential-found", cred.clone());
                                let _ = app_cred.emit("new-alert", crate::Alert {
                                    id: chrono::Local::now().timestamp_millis().to_string(),
                                    r#type: "credential".to_string(),
                                    title: "🔑 Kimlik Bilgisi Yakalandı!".to_string(),
                                    body: format!("{} — {} → Kullanıcı: {}", cred.protocol, cred.source_ip, cred.username.as_deref().unwrap_or("?")),
                                    timestamp: chrono::Local::now().format("%H:%M:%S").to_string(),
                                    read: false,
                                });
                            }

                            // Update stats
                            if let Some(state) = app_cred.try_state::<crate::AppState>() {
                                if let Ok(mut stats) = state.stats.lock() {
                                    if captured.protocol == "DNS" {
                                        stats.dns_count += 1;
                                    } else {
                                        stats.data_count += 1;
                                    }
                                    stats.total_traffic_bytes += payload.len() as u64;
                                }
                            }

                            if let Ok(mut b) = buffer_clone.lock() {
                                b.push(captured);
                                if b.len() > 1000 { b.remove(0); }
                            }
                        }
                    }
                }
                _ => break,
            }
        }
    });

    // Emitter Thread (300ms throttle)
    let app_clone = app.clone();
    let stop_flag_emitter = stop_flag.clone();
    let buffer_emitter = buffer.clone();

    std::thread::spawn(move || {
        while !stop_flag_emitter.load(Ordering::Relaxed) {
            std::thread::sleep(Duration::from_millis(300));
            let to_send = {
                let mut b = buffer_emitter.lock().unwrap();
                if b.is_empty() { continue; }
                let data = b.clone();
                b.clear();
                data
            };
            let _ = app_clone.emit("packets-captured-batch", to_send);
        }
    });
}

fn extract_credential(pkt: &CapturedPacket, raw_payload: &[u8]) -> Option<Credential> {
    let payload_str = String::from_utf8_lossy(raw_payload).to_string();

    // HTTP Basic Auth / Form data
    if pkt.protocol == "TCP" {
        let lower = payload_str.to_lowercase();

        // HTTP Basic Auth (Authorization: Basic base64)
        if lower.contains("authorization: basic ") {
            if let Some(start) = lower.find("authorization: basic ") {
                let base64_part: String = payload_str[start + 21..].chars().take_while(|c| *c != '\r' && *c != '\n').collect();
                if let Ok(decoded) = base64::decode(&base64_part.trim()) {
                    let decoded_str = String::from_utf8_lossy(&decoded).to_string();
                    if let Some(colon) = decoded_str.find(':') {
                        return Some(Credential {
                            source_ip: pkt.source.clone(),
                            dest_ip: pkt.destination.clone(),
                            protocol: "HTTP Basic Auth".to_string(),
                            username: Some(decoded_str[..colon].to_string()),
                            password: Some(decoded_str[colon+1..].to_string()),
                            raw: format!("Basic {}", base64_part),
                        });
                    }
                }
            }
        }

        // HTTP Form POST with username/password
        if lower.contains("password=") || lower.contains("passwd=") || lower.contains("pwd=") {
            let raw_excerpt: String = payload_str.chars().take(500).collect();
            return Some(Credential {
                source_ip: pkt.source.clone(),
                dest_ip: pkt.destination.clone(),
                protocol: "HTTP Form POST".to_string(),
                username: extract_form_field(&lower, &["username=", "user=", "login=", "email="]),
                password: extract_form_field(&lower, &["password=", "passwd=", "pwd=", "pass="]),
                raw: raw_excerpt,
            });
        }

        // FTP credentials
        if lower.starts_with("user ") || lower.starts_with("pass ") {
            let parts: Vec<&str> = payload_str.trim().splitn(2, ' ').collect();
            if parts.len() == 2 {
                let is_pass = lower.starts_with("pass ");
                return Some(Credential {
                    source_ip: pkt.source.clone(),
                    dest_ip: pkt.destination.clone(),
                    protocol: "FTP".to_string(),
                    username: if !is_pass { Some(parts[1].trim().to_string()) } else { None },
                    password: if is_pass { Some(parts[1].trim().to_string()) } else { None },
                    raw: payload_str.chars().take(200).collect(),
                });
            }
        }
    }
    None
}

fn extract_form_field(body: &str, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(start) = body.find(key) {
            let value_start = start + key.len();
            let value: String = body[value_start..].chars().take_while(|c| *c != '&' && *c != '\r' && *c != '\n' && *c != ' ').collect();
            if !value.is_empty() { return Some(value); }
        }
    }
    None
}

fn process_ethernet(ethernet: &EthernetPacket) -> Option<CapturedPacket> {
    if ethernet.get_ethertype() != EtherTypes::Ipv4 { return None; }
    let ipv4 = Ipv4Packet::new(ethernet.payload())?;
    let source = ipv4.get_source().to_string();
    let destination = ipv4.get_destination().to_string();
    let mut protocol;
    let mut info;

    match ipv4.get_next_level_protocol() {
        pnet::packet::ip::IpNextHeaderProtocols::Tcp => {
            let tcp = TcpPacket::new(ipv4.payload())?;
            if tcp.payload().is_empty() && tcp.get_flags() == 16 { return None; }
            protocol = "TCP".to_string();
            info = format!("Port:{} → Port:{}", tcp.get_source(), tcp.get_destination());
            if tcp.get_destination() == 80 || tcp.get_source() == 80 {
                // Sniff HTTP info from payload
                let pay = String::from_utf8_lossy(tcp.payload());
                if let Some(host_line) = pay.lines().find(|l| l.to_lowercase().starts_with("host:")) {
                    info = format!("HTTP → {}", host_line.trim());
                } else {
                    info = format!("HTTP {}", info);
                }
            }
            if tcp.get_destination() == 443 || tcp.get_source() == 443 { info = format!("HTTPS {}", info); }
            if tcp.get_destination() == 21 || tcp.get_source() == 21 { 
                info = format!("FTP: {}", String::from_utf8_lossy(tcp.payload()).chars().take(60).collect::<String>());
                protocol = "FTP".to_string();
            }
        }
        pnet::packet::ip::IpNextHeaderProtocols::Udp => {
            let udp = UdpPacket::new(ipv4.payload())?;
            protocol = "UDP".to_string();
            info = format!("Port:{} → Port:{}", udp.get_source(), udp.get_destination());
            if udp.get_destination() == 53 || udp.get_source() == 53 {
                protocol = "DNS".to_string();
                info = parse_dns_simple(udp.payload()).unwrap_or_else(|| "DNS Query".to_string());
            }
        }
        pnet::packet::ip::IpNextHeaderProtocols::Icmp => {
            protocol = "ICMP".to_string();
            info = "Ping/ICMP".to_string();
        }
        _ => return None,
    }

    Some(CapturedPacket { source, destination, protocol, length: ipv4.packet().len(), info })
}

fn parse_dns_simple(payload: &[u8]) -> Option<String> {
    if payload.len() < 13 { return None; }
    let mut pos = 12;
    let mut name = String::new();
    while pos < payload.len() {
        let len = payload[pos] as usize;
        if len == 0 { break; }
        pos += 1;
        if pos + len > payload.len() { break; }
        if !name.is_empty() { name.push('.'); }
        name.push_str(&String::from_utf8_lossy(&payload[pos..pos+len]));
        pos += len;
    }
    if name.is_empty() { None } else { Some(format!("? {}", name)) }
}

// Simple base64 decode helper
mod base64 {
    pub fn decode(input: &str) -> Result<Vec<u8>, ()> {
        let input = input.trim();
        let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut result = Vec::new();
        let mut buffer = 0u32;
        let mut bits_remaining = 0u32;
        for &c in input.as_bytes() {
            if c == b'=' { break; }
            let val = alphabet.iter().position(|&x| x == c).ok_or(())? as u32;
            buffer = (buffer << 6) | val;
            bits_remaining += 6;
            if bits_remaining >= 8 {
                bits_remaining -= 8;
                result.push((buffer >> bits_remaining) as u8);
                buffer &= (1 << bits_remaining) - 1;
            }
        }
        Ok(result)
    }
}
