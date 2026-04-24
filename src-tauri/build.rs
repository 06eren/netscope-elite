use std::env;
use std::path::PathBuf;

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let lib_path = PathBuf::from(manifest_dir);

    // Force link the directory where we just saw Packet.lib
    println!("cargo:rustc-link-search=native={}", lib_path.display());
    
    // Also add the standard Npcap paths just in case
    println!("cargo:rustc-link-search=native=C:\\Program Files\\Npcap\\sdk\\Lib\\x64");
    
    // Specifically tell the linker to look for Packet.lib
    println!("cargo:rustc-link-lib=static=Packet");

    tauri_build::build()
}
