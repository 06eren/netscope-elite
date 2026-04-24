// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod network;
mod scanner;
mod sniffer;
mod vendor;
mod mitm;
mod store;

use tauri::{AppHandle, Manager};
use tauri::{State, Emitter};
use std::sync::Mutex;


#[derive(Debug, Clone, serde::Serialize)]
pub struct Alert {
    pub id: String,
    pub r#type: String, // "new_device" | "credential" | "high_risk" | "arp_change" | "info"
    pub title: String,
    pub body: String,
    pub timestamp: String,
    pub read: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TracerouteHop {
    pub hop: u8,
    pub ip: String,
    pub time: String,
}

#[derive(Default, Debug, Clone, serde::Serialize)]
pub struct AppStats {
    pub dns_count: u64,
    pub data_count: u64,
    pub high_risk_count: usize,
    pub total_traffic_bytes: u64,
}

#[derive(Default)]
pub struct AppState {
    pub network_info: Mutex<Option<network::NetworkInfo>>,
    pub scanned_devices: Mutex<Vec<scanner::Device>>,
    pub known_ips: Mutex<std::collections::HashSet<String>>,
    pub stats: Mutex<AppStats>,
}

// ──────────── NETWORK INFO ────────────
#[tauri::command]
async fn get_network_info(state: State<'_, AppState>) -> Result<network::NetworkInfo, String> {
    match network::get_network_info() {
        Ok(info) => {
            if let Ok(mut lock) = state.network_info.lock() { *lock = Some(info.clone()); }
            Ok(info)
        }
        Err(e) => Err(format!("Ağ bilgisi alınamadı: {}", e)),
    }
}

// ──────────── ADMIN CHECK ────────────
#[tauri::command]
fn check_admin() -> bool {
    store::is_admin()
}

// ──────────── STATS ────────────
#[tauri::command]
fn get_app_stats(state: State<'_, AppState>) -> Result<AppStats, String> {
    let lock = state.stats.lock().map_err(|e| e.to_string())?;
    Ok(lock.clone())
}

// ──────────── SCAN ────────────
#[tauri::command]
async fn scan_network(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let (gateway, subnet) = {
        let lock = state.network_info.lock().map_err(|e| e.to_string())?;
        if let Some(info) = &*lock {
            (info.gateway.clone(), info.subnet.clone())
        } else {
            drop(lock);
            match network::get_network_info() {
                Ok(info) => (info.gateway.clone(), info.subnet.clone()),
                Err(e) => return Err(format!("Ağ bilgisi alınamadı: {}", e)),
            }
        }
    };

    // Clear known IPs for new scan (to detect new devices)
    if let Ok(mut known) = state.known_ips.lock() {
        known.clear();
    }
    // Clear cached devices
    if let Ok(mut devs) = state.scanned_devices.lock() {
        devs.clear();
    }


    let app_clone = app.clone();
    tokio::spawn(async move {
        if let Ok(devices) = scanner::scan_network(app_clone.clone(), &gateway, &subnet).await {
            // Store all devices in DB
            for d in &devices {
                store::upsert_device(&d.ip, &d.mac, &d.hostname, &d.vendor, &d.os_type, d.risk_score).ok();
            }
            store::log_scan(devices.len(), &gateway).ok();

            // Update cache
            if let Ok(state) = app_clone.try_state::<AppState>().ok_or("no state").map(|s| s) {
                if let Ok(mut devs) = state.scanned_devices.lock() {
                    *devs = devices;
                }
            }
        }
    });
    Ok(())
}

#[tauri::command]
async fn stop_scan() -> Result<(), String> {
    scanner::stop_scan();
    Ok(())
}

// ──────────── SNIFFING ────────────
#[tauri::command]
async fn start_sniffing(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let iface_name = {
        let lock = state.network_info.lock().map_err(|e| e.to_string())?;
        if let Some(info) = &*lock {
            info.interface_name.clone()
        } else {
            drop(lock);
            match network::get_network_info() {
                Ok(info) => info.interface_name,
                Err(e) => return Err(format!("Arayüz bilgisi bulunamadı: {}", e)),
            }
        }
    };
    sniffer::start_sniffing(app, iface_name).await;
    Ok(())
}

#[tauri::command]
async fn stop_sniffing() -> Result<(), String> {
    sniffer::stop_sniffing();
    Ok(())
}

#[tauri::command]
async fn start_pcap_export(path: String) -> Result<(), String> {
    sniffer::start_pcap_capture(&path)
}

#[tauri::command]
async fn stop_pcap_export() -> Result<(), String> {
    sniffer::stop_pcap_capture();
    Ok(())
}

// ──────────── WAKE ON LAN ────────────
#[tauri::command]
async fn wake_on_lan(mac: String) -> Result<(), String> {
    let mut magic_packet = vec![0xFF; 6];
    let mac_bytes: Vec<u8> = mac.split(':').map(|s| u8::from_str_radix(s, 16).unwrap_or(0)).collect();
    if mac_bytes.len() != 6 { return Err("Geçersiz MAC adresi".to_string()); }
    for _ in 0..16 { magic_packet.extend_from_slice(&mac_bytes); }
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket.set_broadcast(true).map_err(|e| e.to_string())?;
    socket.send_to(&magic_packet, std::net::SocketAddrV4::new(std::net::Ipv4Addr::new(255, 255, 255, 255), 9)).map_err(|e| e.to_string())?;
    Ok(())
}

// ──────────── TRACEROUTE ────────────
#[tauri::command]
async fn traceroute(app: tauri::AppHandle, target: String) -> Result<(), String> {
    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, BufReader};

    tokio::spawn(async move {
        // Windows traceroute without DNS resolution (-d)
        let mut child = tokio::process::Command::new("tracert")
            .arg("-d")
            .arg("-w")
            .arg("1000")
            .arg(&target)
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();

        let stdout = child.stdout.take().unwrap();
        let mut reader = BufReader::new(stdout).lines();

        while let Ok(Some(line)) = reader.next_line().await {
            let line = line.trim();
            if line.is_empty() || line.starts_with("Tracing") || line.starts_with("Over") {
                continue;
            }
            
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() > 0 {
                if let Ok(hop) = parts[0].parse::<u8>() {
                    let mut ip = "*".to_string();
                    let mut time = "*".to_string();

                    if let Some(last_str) = parts.last() {
                        if last_str.parse::<std::net::IpAddr>().is_ok() {
                            ip = last_str.to_string();
                            if parts.len() >= 3 {
                                time = format!("{} {}", parts[1], parts[2]); 
                            }
                        }
                    }
                    
                    let _ = app.emit("traceroute-hop", TracerouteHop { hop, ip, time });
                }
            }
            if line.contains("Trace complete.") || line.contains("İzleme tamamlandı") { break; }
        }
        let _ = app.emit("traceroute-complete", ());
    });

    Ok(())
}

// ──────────── MITM / ISOLATE ────────────
#[tauri::command]
async fn start_mitm(app: AppHandle, state: State<'_, AppState>, target_ip: String) -> Result<(), String> {
    let (gateway, iface_name) = get_gateway_and_iface(&state)?;
    let our_mac = mitm::get_our_mac(&iface_name);
    tokio::spawn(async move { mitm::start_mitm(app, target_ip, gateway, our_mac, iface_name).await; });
    Ok(())
}

#[tauri::command]
async fn stop_mitm() -> Result<(), String> {
    mitm::stop_mitm();
    Ok(())
}

#[tauri::command]
async fn isolate_device(app: AppHandle, state: State<'_, AppState>, target_ip: String) -> Result<(), String> {
    let (gateway, iface_name) = get_gateway_and_iface(&state)?;
    let our_mac = mitm::get_our_mac(&iface_name);
    tokio::spawn(async move { mitm::isolate_device(app, target_ip, gateway, our_mac, iface_name).await; });
    Ok(())
}

#[tauri::command]
async fn stop_isolate() -> Result<(), String> {
    mitm::stop_isolate();
    Ok(())
}

// ──────────── DEVICE PERSISTENCE ────────────
#[tauri::command]
fn set_device_label(ip: String, label: String) -> Result<(), String> {
    store::set_device_label(&ip, &label).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_device_note(ip: String, note: String) -> Result<(), String> {
    store::set_device_note(&ip, &note).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_device_history() -> Result<Vec<store::DeviceRecord>, String> {
    store::get_all_devices().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_device_record(ip: String) -> Result<Option<store::DeviceRecord>, String> {
    store::get_device(&ip).map_err(|e| e.to_string())
}

// ──────────── EXPORT ────────────
#[tauri::command]
async fn export_devices_json(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let devices = state.scanned_devices.lock().map_err(|e| e.to_string())?.clone();
    let json = store::export_json(&devices);
    store::write_file(&path, &json).map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_devices_csv(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let devices = state.scanned_devices.lock().map_err(|e| e.to_string())?.clone();
    let csv = store::export_csv(&devices);
    store::write_file(&path, &csv).map_err(|e| e.to_string())
}

// ──────────── HELPERS ────────────
fn get_gateway_and_iface(state: &State<AppState>) -> Result<(String, String), String> {
    let lock = state.network_info.lock().map_err(|e| e.to_string())?;
    if let Some(info) = &*lock {
        return Ok((info.gateway.clone(), info.interface_name.clone()));
    }
    drop(lock);
    match network::get_network_info() {
        Ok(info) => Ok((info.gateway.clone(), info.interface_name.clone())),
        Err(e) => Err(format!("Ağ bilgisi alınamadı: {}", e)),
    }
}

// ──────────── APP ENTRY POINT ────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_network_info,
            check_admin,
            get_app_stats,
            scan_network,
            stop_scan,
            start_sniffing,
            stop_sniffing,
            start_pcap_export,
            stop_pcap_export,
            wake_on_lan,
            traceroute,
            start_mitm,
            stop_mitm,
            isolate_device,
            stop_isolate,
            set_device_label,
            set_device_note,
            get_device_history,
            get_device_record,
            export_devices_json,
            export_devices_csv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
