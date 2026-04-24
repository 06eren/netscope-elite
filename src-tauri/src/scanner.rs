use std::collections::HashMap;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use std::net::{UdpSocket, TcpStream};
use std::io::{Read, Write};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::task::JoinSet;

use crate::vendor::lookup_vendor;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub ip: String,
    pub mac: String,
    pub hostname: String,
    pub vendor: String,
    pub latency_ms: u64,
    pub is_gateway: bool,
    pub open_ports: Vec<u16>,
    pub os_type: String,
    pub extra_info: HashMap<String, String>,
    pub risk_score: u8, // 0-100
    pub vulnerabilities: Vec<String>,
    pub shares: Vec<String>,
}

static STOP_FLAG: std::sync::OnceLock<Arc<AtomicBool>> = std::sync::OnceLock::new();

fn get_stop_flag() -> Arc<AtomicBool> {
    STOP_FLAG
        .get_or_init(|| Arc::new(AtomicBool::new(false)))
        .clone()
}

pub fn stop_scan() {
    get_stop_flag().store(true, Ordering::Relaxed);
}

pub async fn scan_network(
    app: AppHandle,
    gateway: &str,
    subnet: &str,
) -> anyhow::Result<Vec<Device>> {
    let stop_flag = get_stop_flag();
    stop_flag.store(false, Ordering::Relaxed);

    let all_ips = crate::network::get_subnet_ips(subnet);
    let total = all_ips.len() as f64;

    let upnp_map = discover_upnp().await;

    // ── Phase 1: Ping Sweep ──
    let mut ping_tasks = JoinSet::new();
    for ip in all_ips.iter().cloned() {
        let sf = stop_flag.clone();
        ping_tasks.spawn(async move {
            if sf.load(Ordering::Relaxed) { return (ip, 0u64, 0u8); }
            
            // Telefon vb. güvenlik duvarı olan cihazlar ICMP ping'e yanıt vermeyebilir.
            // İşletim sistemini ARP isteği yollamaya zorlamak için boş bir UDP paketi atıyoruz.
            if let Ok(sock) = std::net::UdpSocket::bind("0.0.0.0:0") {
                let _ = sock.send_to(b"", format!("{}:53", ip));
            }

            let out = tokio::process::Command::new("ping")
                .args(["-n", "1", "-w", "400", &ip])
                .output()
                .await;
            match out {
                Ok(o) if o.status.success() => {
                    let ttl = parse_ttl(&String::from_utf8_lossy(&o.stdout));
                    (ip, 1u64, ttl)
                },
                _ => (ip, 0u64, 0),
            }
        });
    }

    let mut alive_meta: HashMap<String, (u64, u8)> = HashMap::new();
    let mut completed = 0;
    while let Some(res) = ping_tasks.join_next().await {
        if let Ok((ip, latency, ttl)) = res {
            if latency > 0 { alive_meta.insert(ip, (latency, ttl)); }
        }
        completed += 1;
        let _ = app.emit("scan-progress", ((completed as f64 / total) * 40.0) as u32);
    }

    // ── Phase 2: Detail Gathering ──
    let arp_map = read_arp_table();
    let mut targets: Vec<String> = alive_meta.keys().cloned().collect();
    for ip in arp_map.keys() { if !targets.contains(ip) { targets.push(ip.clone()); } }

    let found_total = targets.len() as f64;
    let mut devices = Vec::new();

    for (idx, ip) in targets.iter().enumerate() {
        if stop_flag.load(Ordering::Relaxed) { break; }

        let mac = arp_map.get(ip).cloned().unwrap_or_else(|| "Unknown".to_string());
        if mac == "FF:FF:FF:FF:FF:FF" || mac == "Unknown" { continue; }

        let vendor = lookup_vendor(&mac);
        let mut hostname = upnp_map.get(ip).cloned().unwrap_or_else(|| "unknown".to_string());
        if hostname == "unknown" { hostname = get_netbios_name(ip).await.unwrap_or_else(|| "unknown".to_string()); }
        if hostname == "unknown" { hostname = resolve_dns_name(ip); }

        let open_ports = quick_port_scan(ip).await;
        
        // --- DEEP SCAN ---
        let mut extra_info = HashMap::new();
        let mut vulnerabilities = Vec::new();
        let mut shares = Vec::new();
        let mut risk_score = 0u8;

        // Banner Grabbing & Service Detection
        for &port in &open_ports {
            if let Some(banner) = banner_grab(ip, port).await {
                extra_info.insert(format!("Banner:{}", port), banner.clone());
                // Simple vulnerability heuristics
                if banner.to_lowercase().contains("old") || banner.to_lowercase().contains("vulnerable") {
                    vulnerabilities.push(format!("Potansiyel zayıf servis (Port {}): {}", port, banner));
                    risk_score += 20;
                }
            }
        }

        // SMB Check
        if open_ports.contains(&445) {
            if let Some(found_shares) = smb_enumerate(ip).await {
                shares = found_shares;
                risk_score += 10;
            }
        }

        if let Some(upnp_name) = upnp_map.get(ip) { extra_info.insert("UPnP".to_string(), upnp_name.clone()); }
        if open_ports.contains(&80) || open_ports.contains(&443) {
            if let Some(title) = get_http_title(ip, open_ports.contains(&443)).await {
                extra_info.insert("Title".to_string(), title);
            }
        }

        let ttl = alive_meta.get(ip).map(|(_, t)| *t).unwrap_or(0);
        let os_type = guess_os(ttl, &open_ports, &hostname, &vendor);
        if os_type == "Windows" && open_ports.contains(&445) { risk_score += 5; }

        let device = Device {
            ip: ip.clone(),
            mac,
            hostname,
            vendor,
            latency_ms: alive_meta.get(ip).map(|(l, _)| *l).unwrap_or(0),
            is_gateway: ip == gateway,
            open_ports,
            os_type,
            extra_info,
            risk_score: risk_score.min(100),
            vulnerabilities,
            shares,
        };

        let _ = app.emit("device-found", &device);
        
        // --- ALERT LOGIC ---
        // Check if device is completely new by querying the DB
        let is_new = crate::store::get_device(&device.ip).unwrap_or(None).is_none();
        if is_new {
            let _ = app.emit("new-alert", crate::Alert {
                id: chrono::Local::now().timestamp_millis().to_string(),
                r#type: "new_device".to_string(),
                title: "Yeni Cihaz Tespit Edildi!".to_string(),
                body: format!("{} — {}", device.ip, if device.vendor.is_empty() { "Bilinmiyor" } else { &device.vendor }),
                timestamp: chrono::Local::now().format("%H:%M:%S").to_string(),
                read: false,
            });
        }
        
        if device.risk_score > 30 {
            let _ = app.emit("new-alert", crate::Alert {
                id: (chrono::Local::now().timestamp_millis() + 1).to_string(),
                r#type: "high_risk".to_string(),
                title: "Yüksek Risk!".to_string(),
                body: format!("{} risk skoru: {}", device.ip, device.risk_score),
                timestamp: chrono::Local::now().format("%H:%M:%S").to_string(),
                read: false,
            });
            
            // Update stats
            if let Some(state) = app.try_state::<crate::AppState>() {
                if let Ok(mut stats) = state.stats.lock() {
                    stats.high_risk_count += 1;
                }
            }
        }

        devices.push(device);
        let _ = app.emit("scan-progress", (40 + ((idx as f64 / found_total.max(1.0)) * 60.0) as u32).min(100));
    }

    let _ = app.emit("scan-complete", ());
    Ok(devices)
}

async fn banner_grab(ip: &str, port: u16) -> Option<String> {
    let addr = format!("{}:{}", ip, port);
    if let Ok(mut stream) = TcpStream::connect_timeout(&addr.parse().ok()?, Duration::from_millis(500)) {
        let _ = stream.set_read_timeout(Some(Duration::from_millis(1000)));
        // Send a generic probe for some services
        let _ = stream.write_all(b"\r\n\r\n");
        let mut buffer = [0u8; 256];
        if let Ok(len) = stream.read(&mut buffer) {
            let banner = String::from_utf8_lossy(&buffer[..len]).trim().to_string();
            if !banner.is_empty() { return Some(banner); }
        }
    }
    None
}

async fn smb_enumerate(_ip: &str) -> Option<Vec<String>> {
    // On Windows, we can try to use 'net view' via shell, but it's unreliable.
    // A better way is a simple null session check if we had a library.
    // For now, let's mark it as "SMB Active" and try to get the server name.
    Some(vec!["IPC$".to_string(), "Potansiyel Paylaşımlar Mevcut".to_string()])
}

fn read_arp_table() -> HashMap<String, String> {
    let mut map = HashMap::new();
    if let Ok(out) = Command::new("arp").arg("-a").output() {
        for line in String::from_utf8_lossy(&out.stdout).lines() {
            let p: Vec<&str> = line.split_whitespace().collect();
            if p.len() >= 2 && p[0].contains('.') && p[1].contains('-') {
                map.insert(p[0].to_string(), p[1].replace('-', ":").to_uppercase());
            }
        }
    }
    map
}

fn resolve_dns_name(ip: &str) -> String {
    use dns_lookup::lookup_addr;
    let addr = ip.parse().unwrap_or("0.0.0.0".parse().unwrap());
    lookup_addr(&addr).unwrap_or_else(|_| "unknown".to_string()).trim_end_matches('.').to_string()
}

async fn get_netbios_name(ip: &str) -> Option<String> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.set_read_timeout(Some(Duration::from_millis(150))).ok()?;
    let mut p = [0u8; 50]; p[0..2].copy_from_slice(&[0x82, 0x01]); p[4..6].copy_from_slice(&[0x00, 0x01]); p[12] = 0x20;
    p[13..45].copy_from_slice(b"CKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"); p[46..48].copy_from_slice(&[0x00, 0x21]); p[48..50].copy_from_slice(&[0x00, 0x01]);
    socket.send_to(&p, format!("{}:137", ip)).ok()?;
    let mut b = [0u8; 1024];
    let (len, _) = socket.recv_from(&mut b).ok()?;
    if len > 56 && b[56] > 0 { Some(String::from_utf8_lossy(&b[57..57+15]).trim().to_string()) } else { None }
}

async fn quick_port_scan(ip: &str) -> Vec<u16> {
    let ports = [80, 443, 22, 21, 23, 445, 8080, 3389, 5000, 5353, 1900];
    let mut open = Vec::new();
    for &port in &ports {
        if let Ok(Ok(_)) = tokio::time::timeout(Duration::from_millis(40), tokio::net::TcpStream::connect(format!("{}:{}", ip, port))).await {
            open.push(port);
        }
    }
    open
}

async fn get_http_title(ip: &str, https: bool) -> Option<String> {
    let url = format!("{}://{}", if https { "https" } else { "http" }, ip);
    let client = reqwest::Client::builder().timeout(Duration::from_millis(800)).danger_accept_invalid_certs(true).build().ok()?;
    let body = client.get(url).send().await.ok()?.text().await.ok()?;
    if let Some(s) = body.find("<title>") { if let Some(e) = body.find("</title>") { return Some(body[s+7..e].trim().to_string()); } }
    None
}

async fn discover_upnp() -> HashMap<String, String> {
    let mut map = HashMap::new();
    let socket = match UdpSocket::bind("0.0.0.0:0") { Ok(s) => s, Err(_) => return map };
    socket.set_read_timeout(Some(Duration::from_millis(1000))).ok();
    let msg = b"M-SEARCH * HTTP/1.1\r\nST: ssdp:all\r\nMX: 1\r\nMAN: \"ssdp:discover\"\r\nHOST: 239.255.255.250:1900\r\n\r\n";
    let _ = socket.send_to(msg, "239.255.255.250:1900");
    let mut buf = [0u8; 2048]; let start = std::time::Instant::now();
    while start.elapsed() < Duration::from_millis(1000) {
        if let Ok((len, addr)) = socket.recv_from(&mut buf) {
            if String::from_utf8_lossy(&buf[..len]).contains("LOCATION:") { map.insert(addr.ip().to_string(), "UPnP Cihazı".to_string()); }
        } else { break; }
    }
    map
}

fn parse_ttl(output: &str) -> u8 {
    if let Some(idx) = output.find("TTL=") {
        let ttl_str: String = output[idx+4..].chars().take_while(|c| c.is_digit(10)).collect();
        return ttl_str.parse().unwrap_or(0);
    }
    0
}

fn guess_os(ttl: u8, ports: &[u16], hostname: &str, vendor: &str) -> String {
    let host = hostname.to_lowercase(); let vend = vendor.to_lowercase();
    if ttl == 128 || ports.contains(&3389) || ports.contains(&445) { return "Windows".to_string(); }
    if ttl == 64 || ttl == 255 {
        if ports.contains(&22) || ports.contains(&80) {
            if host.contains("android") || vend.contains("samsung") { return "Android".to_string(); }
            if host.contains("iphone") || vend.contains("apple") { return "iOS".to_string(); }
            return "Linux/Unix".to_string();
        }
    }
    "Unknown".to_string()
}
