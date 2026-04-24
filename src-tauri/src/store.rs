use rusqlite::{Connection, Result as SqlResult, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use chrono::Local;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceRecord {
    pub ip: String,
    pub mac: String,
    pub hostname: String,
    pub vendor: String,
    pub os_type: String,
    pub label: String,      // "trusted" | "suspicious" | "unknown" | ""
    pub note: String,
    pub first_seen: String,
    pub last_seen: String,
    pub risk_score: u8,
}

fn db_path() -> PathBuf {
    let mut path = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    path.push("netscope");
    std::fs::create_dir_all(&path).ok();
    path.push("netscope.db");
    path
}

fn open_db() -> SqlResult<Connection> {
    let conn = Connection::open(db_path())?;
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS devices (
            ip TEXT PRIMARY KEY,
            mac TEXT,
            hostname TEXT,
            vendor TEXT,
            os_type TEXT,
            label TEXT DEFAULT '',
            note TEXT DEFAULT '',
            first_seen TEXT,
            last_seen TEXT,
            risk_score INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS scan_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            device_count INTEGER,
            gateway TEXT
        );
    ")?;
    Ok(conn)
}

/// Save or update device in persistent DB
pub fn upsert_device(ip: &str, mac: &str, hostname: &str, vendor: &str, os_type: &str, risk_score: u8) -> SqlResult<()> {
    let conn = open_db()?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO devices (ip, mac, hostname, vendor, os_type, risk_score, first_seen, last_seen)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
         ON CONFLICT(ip) DO UPDATE SET
           mac=?2, hostname=?3, vendor=?4, os_type=?5, risk_score=?6, last_seen=?7",
        params![ip, mac, hostname, vendor, os_type, risk_score, now],
    )?;
    Ok(())
}

/// Set label for a device
pub fn set_device_label(ip: &str, label: &str) -> SqlResult<()> {
    let conn = open_db()?;
    conn.execute("UPDATE devices SET label=?1 WHERE ip=?2", params![label, ip])?;
    Ok(())
}

/// Set note for a device
pub fn set_device_note(ip: &str, note: &str) -> SqlResult<()> {
    let conn = open_db()?;
    conn.execute("UPDATE devices SET note=?1 WHERE ip=?2", params![note, ip])?;
    Ok(())
}

/// Get all device records from DB
pub fn get_all_devices() -> SqlResult<Vec<DeviceRecord>> {
    let conn = open_db()?;
    let mut stmt = conn.prepare(
        "SELECT ip, mac, hostname, vendor, os_type, label, note, first_seen, last_seen, risk_score FROM devices ORDER BY last_seen DESC"
    )?;
    let records = stmt.query_map([], |row| {
        Ok(DeviceRecord {
            ip: row.get(0)?, mac: row.get(1)?, hostname: row.get(2)?,
            vendor: row.get(3)?, os_type: row.get(4)?, label: row.get(5)?,
            note: row.get(6)?, first_seen: row.get(7)?, last_seen: row.get(8)?,
            risk_score: row.get::<_, i64>(9)? as u8,
        })
    })?.filter_map(|r| r.ok()).collect();
    Ok(records)
}

/// Get a single device record
pub fn get_device(ip: &str) -> SqlResult<Option<DeviceRecord>> {
    let conn = open_db()?;
    let mut stmt = conn.prepare(
        "SELECT ip, mac, hostname, vendor, os_type, label, note, first_seen, last_seen, risk_score FROM devices WHERE ip=?1"
    )?;
    let mut records = stmt.query_map(params![ip], |row| {
        Ok(DeviceRecord {
            ip: row.get(0)?, mac: row.get(1)?, hostname: row.get(2)?,
            vendor: row.get(3)?, os_type: row.get(4)?, label: row.get(5)?,
            note: row.get(6)?, first_seen: row.get(7)?, last_seen: row.get(8)?,
            risk_score: row.get::<_, i64>(9)? as u8,
        })
    })?;
    Ok(records.next().and_then(|r| r.ok()))
}

/// Log a scan event
pub fn log_scan(device_count: usize, gateway: &str) -> SqlResult<()> {
    let conn = open_db()?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO scan_log (timestamp, device_count, gateway) VALUES (?1, ?2, ?3)",
        params![now, device_count as i64, gateway],
    )?;
    Ok(())
}

/// Export all devices as JSON string
pub fn export_json(devices: &[crate::scanner::Device]) -> String {
    serde_json::to_string_pretty(devices).unwrap_or_default()
}

/// Export all devices as CSV string
pub fn export_csv(devices: &[crate::scanner::Device]) -> String {
    let mut out = String::from("IP,MAC,Hostname,Vendor,OS,Risk Score,Open Ports,Shares\n");
    for d in devices {
        out.push_str(&format!(
            "{},{},{},{},{},{},\"{}\",\"{}\"\n",
            d.ip, d.mac, d.hostname, d.vendor, d.os_type, d.risk_score,
            d.open_ports.iter().map(|p| p.to_string()).collect::<Vec<_>>().join(";"),
            d.shares.join(";"),
        ));
    }
    out
}

/// Write string content to a file path
pub fn write_file(path: &str, content: &str) -> anyhow::Result<()> {
    std::fs::write(path, content)?;
    Ok(())
}

/// Check if running as Administrator on Windows
#[cfg(target_os = "windows")]
pub fn is_admin() -> bool {
    use windows::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
    use windows::Win32::Foundation::HANDLE;
    unsafe {
        let mut token = HANDLE::default();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
            return false;
        }
        let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
        let mut size = std::mem::size_of::<TOKEN_ELEVATION>() as u32;
        GetTokenInformation(token, TokenElevation, Some(&mut elevation as *mut _ as *mut _), size, &mut size).is_ok()
            && elevation.TokenIsElevated != 0
    }
}

#[cfg(not(target_os = "windows"))]
pub fn is_admin() -> bool {
    // On Linux/Mac, check if UID is 0
    unsafe { libc::getuid() == 0 }
}
