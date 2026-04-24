use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub local_ip: String,
    pub gateway: String,
    pub subnet: String,
    pub interface_name: String,
}

/// Get default network interface info from Windows `ipconfig /all`
pub fn get_network_info() -> anyhow::Result<NetworkInfo> {
    // Try to get local IP using a UDP connect trick (doesn't actually send data)
    let local_ip = get_local_ip();

    // Derive subnet and gateway
    let (gateway, subnet, iface_name) = get_gateway_and_subnet(&local_ip);

    Ok(NetworkInfo {
        local_ip,
        gateway,
        subnet,
        interface_name: iface_name,
    })
}

fn get_local_ip() -> String {
    use std::net::UdpSocket;
    let socket = UdpSocket::bind("0.0.0.0:0").ok();
    if let Some(s) = socket {
        if s.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = s.local_addr() {
                return addr.ip().to_string();
            }
        }
    }
    "127.0.0.1".to_string()
}

fn get_gateway_and_subnet(local_ip: &str) -> (String, String, String) {
    // Parse ipconfig output for gateway
    let output = Command::new("ipconfig")
        .arg("/all")
        .output();

    let mut gateway = String::from("192.168.1.1");
    let mut iface_name = String::from("Ethernet");

    if let Ok(out) = output {
        let text = String::from_utf8_lossy(&out.stdout).to_string();
        let lines: Vec<&str> = text.lines().collect();

        for (i, line) in lines.iter().enumerate() {
            if line.contains("Default Gateway") || line.contains("Varsayılan Ağ Geçidi") {
                if let Some(gw_line) = lines.get(i) {
                    let parts: Vec<&str> = gw_line.splitn(2, ':').collect();
                    if let Some(gw) = parts.get(1) {
                        let cleaned = gw.trim().replace("(Preferred)", "").trim().to_string();
                        if !cleaned.is_empty() && cleaned.contains('.') {
                            gateway = cleaned;
                        }
                    }
                }
            }
        }

        // Try to find adapter name near local_ip
        for (i, line) in lines.iter().enumerate() {
            if line.contains(local_ip) {
                // Look backwards for adapter name
                for j in (0..i).rev() {
                    let l = lines[j].trim();
                    if l.ends_with(':') && !l.starts_with(' ') {
                        iface_name = l.trim_end_matches(':').to_string();
                        break;
                    }
                }
                break;
            }
        }
    }

    // Derive subnet from local IP (assume /24)
    let parts: Vec<&str> = local_ip.split('.').collect();
    let subnet = if parts.len() >= 3 {
        format!("{}.{}.{}.0/24", parts[0], parts[1], parts[2])
    } else {
        "192.168.1.0/24".to_string()
    };

    (gateway, subnet, iface_name)
}

/// Build list of all IPs in the subnet to scan
pub fn get_subnet_ips(subnet: &str) -> Vec<String> {
    use ipnet::IpNet;
    let net: IpNet = match subnet.parse() {
        Ok(n) => n,
        Err(_) => return vec![],
    };

    net.hosts()
        .map(|ip| ip.to_string())
        .collect()
}
