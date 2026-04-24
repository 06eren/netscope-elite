use std::collections::HashMap;

/// Look up vendor/manufacturer name from a MAC address string
/// MAC format: "aa:bb:cc:dd:ee:ff" or "AA-BB-CC-DD-EE-FF"
pub fn lookup_vendor(mac: &str) -> String {
    // Normalize MAC: take first 6 hex chars (OUI portion)
    let normalized = mac
        .replace('-', ":")
        .replace('.', ":")
        .to_uppercase();
    
    let parts: Vec<&str> = normalized.split(':').collect();
    if parts.len() < 3 {
        return "Unknown".to_string();
    }

    let oui = format!("{}{}{}", parts[0], parts[1], parts[2]);

    // Simple manual lookup for common vendors (Experimental/Internal)
    // In a production app, we would load a full manuf file.
    let mut vendors = HashMap::new();
    
    // Apple
    vendors.insert("000393", "Apple");
    vendors.insert("000502", "Apple");
    vendors.insert("000A27", "Apple");
    vendors.insert("0017F2", "Apple");
    vendors.insert("001C4F", "Apple");
    vendors.insert("0021E9", "Apple");
    vendors.insert("002436", "Apple");
    vendors.insert("002608", "Apple");
    vendors.insert("28CFE9", "Apple");
    vendors.insert("34159E", "Apple");
    vendors.insert("3C0754", "Apple");
    vendors.insert("403004", "Apple");
    vendors.insert("44D884", "Apple");
    vendors.insert("4860BC", "Apple");
    vendors.insert("581FAA", "Apple");
    vendors.insert("5C97F3", "Apple");
    vendors.insert("600308", "Apple");
    vendors.insert("6476BA", "Apple");
    vendors.insert("68A86D", "Apple");
    vendors.insert("701124", "Apple");
    vendors.insert("7831C1", "Apple");
    vendors.insert("804971", "Apple");
    vendors.insert("843835", "Apple");
    vendors.insert("8863DF", "Apple");
    vendors.insert("8C2937", "Apple");
    vendors.insert("9027E4", "Apple");
    vendors.insert("949426", "Apple");
    vendors.insert("9801A7", "Apple");
    vendors.insert("A01828", "Apple");
    vendors.insert("A43135", "Apple");
    vendors.insert("AC3C0B", "Apple");
    vendors.insert("B03495", "Apple");
    vendors.insert("B418D1", "Apple");
    vendors.insert("B817C2", "Apple");
    vendors.insert("C01ADA", "Apple");
    vendors.insert("C42C03", "Apple");
    vendors.insert("C81EE7", "Apple");
    vendors.insert("D0034B", "Apple");
    vendors.insert("D4619D", "Apple");
    vendors.insert("D8004D", "Apple");
    vendors.insert("DC2B61", "Apple");
    vendors.insert("E02CB2", "Apple");
    vendors.insert("E425E7", "Apple");
    vendors.insert("E8040B", "Apple");
    vendors.insert("F01898", "Apple");
    vendors.insert("F409D8", "Apple");
    vendors.insert("F80377", "Apple");
    vendors.insert("FC183C", "Apple");

    // Samsung
    vendors.insert("0000F0", "Samsung");
    vendors.insert("0007AB", "Samsung");
    vendors.insert("001247", "Samsung");
    vendors.insert("001D28", "Samsung");
    vendors.insert("007686", "Samsung");
    vendors.insert("1C5A3E", "Samsung");
    vendors.insert("38AA3C", "Samsung");
    vendors.insert("4844F7", "Samsung");
    vendors.insert("508569", "Samsung");
    vendors.insert("606BBD", "Samsung");
    vendors.insert("84253F", "Samsung");
    vendors.insert("A0B4A5", "Samsung");
    vendors.insert("C4576E", "Samsung");
    vendors.insert("E4B2FB", "Samsung");

    // Intel
    vendors.insert("000347", "Intel");
    vendors.insert("0008CA", "Intel");
    vendors.insert("001302", "Intel");
    vendors.insert("0013E8", "Intel");
    vendors.insert("001500", "Intel");
    vendors.insert("0016EA", "Intel");
    vendors.insert("001B21", "Intel");
    vendors.insert("001C42", "Intel");
    vendors.insert("00215A", "Intel");
    vendors.insert("244BFE", "Intel");
    vendors.insert("484520", "Intel");
    vendors.insert("605718", "Intel");
    vendors.insert("A0A4C5", "Intel");
    vendors.insert("C858C0", "Intel");
    vendors.insert("E4A471", "Intel");

    // Cisco
    vendors.insert("00000C", "Cisco");
    vendors.insert("000142", "Cisco");
    vendors.insert("0002B9", "Cisco");
    vendors.insert("00044D", "Cisco");
    vendors.insert("000628", "Cisco");
    vendors.insert("000750", "Cisco");
    vendors.insert("000A41", "Cisco");
    vendors.insert("000C30", "Cisco");
    vendors.insert("001120", "Cisco");
    vendors.insert("0012D9", "Cisco");
    vendors.insert("001759", "Cisco");
    vendors.insert("001B0C", "Cisco");
    vendors.insert("001D70", "Cisco");

    // TP-Link
    vendors.insert("000A40", "TP-Link");
    vendors.insert("0019E0", "TP-Link");
    vendors.insert("002127", "TP-Link");
    vendors.insert("0023CD", "TP-Link");
    vendors.insert("002586", "TP-Link");
    vendors.insert("14CC20", "TP-Link");
    vendors.insert("30B5C2", "TP-Link");
    vendors.insert("50C7BF", "TP-Link");
    vendors.insert("60E327", "TP-Link");
    vendors.insert("8416F9", "TP-Link");
    vendors.insert("98DED0", "TP-Link");
    vendors.insert("A4EEB1", "TP-Link");
    vendors.insert("B0487A", "TP-Link");
    vendors.insert("C04A00", "TP-Link");
    vendors.insert("EC172F", "TP-Link");

    // Huawei
    vendors.insert("000B09", "Huawei");
    vendors.insert("001882", "Huawei");
    vendors.insert("001E10", "Huawei");
    vendors.insert("00259E", "Huawei");
    vendors.insert("00464B", "Huawei");
    vendors.insert("0819A6", "Huawei");
    vendors.insert("1411D0", "Huawei");
    vendors.insert("20F3A3", "Huawei");
    vendors.insert("283152", "Huawei");
    vendors.insert("302219", "Huawei");
    vendors.insert("38AD43", "Huawei");
    vendors.insert("404D8E", "Huawei");
    vendors.insert("48AD08", "Huawei");
    vendors.insert("509F27", "Huawei");
    vendors.insert("548998", "Huawei");
    vendors.insert("600810", "Huawei");
    vendors.insert("6416F0", "Huawei");
    vendors.insert("7072CF", "Huawei");
    vendors.insert("781DBA", "Huawei");
    vendors.insert("8014A8", "Huawei");
    vendors.insert("844B50", "Huawei");
    vendors.insert("88E3AB", "Huawei");
    vendors.insert("94049C", "Huawei");
    vendors.insert("A053EE", "Huawei");
    vendors.insert("A4933F", "Huawei");
    vendors.insert("AC853D", "Huawei");
    vendors.insert("B05B67", "Huawei");
    vendors.insert("B41513", "Huawei");
    vendors.insert("C0BAE6", "Huawei");
    vendors.insert("C40528", "Huawei");
    vendors.insert("D02D1D", "Huawei");
    vendors.insert("D440F0", "Huawei");
    vendors.insert("DC9914", "Huawei");
    vendors.insert("E0247F", "Huawei");
    vendors.insert("E41269", "Huawei");
    vendors.insert("F063F9", "Huawei");
    vendors.insert("F49466", "Huawei");
    vendors.insert("F8E811", "Huawei");
    vendors.insert("FC1124", "Huawei");

    // Xiaomi
    vendors.insert("009E1E", "Xiaomi");
    vendors.insert("14F65A", "Xiaomi");
    vendors.insert("185936", "Xiaomi");
    vendors.insert("286C07", "Xiaomi");
    vendors.insert("3480B3", "Xiaomi");
    vendors.insert("50EC50", "Xiaomi");
    vendors.insert("64CC2E", "Xiaomi");
    vendors.insert("8CBEBE", "Xiaomi");
    vendors.insert("983B16", "Xiaomi");
    vendors.insert("A4E112", "Xiaomi");
    vendors.insert("ACF7F3", "Xiaomi");
    vendors.insert("B0F1EC", "Xiaomi");
    vendors.insert("C40683", "Xiaomi");
    vendors.insert("D85DE2", "Xiaomi");
    vendors.insert("F0B429", "Xiaomi");
    vendors.insert("FC643A", "Xiaomi");

    // Microsoft
    vendors.insert("0003FF", "Microsoft");
    vendors.insert("00125A", "Microsoft");
    vendors.insert("00155D", "Microsoft");
    vendors.insert("0017FA", "Microsoft");
    vendors.insert("001DD8", "Microsoft");
    vendors.insert("0050F2", "Microsoft");
    vendors.insert("281878", "Microsoft");
    vendors.insert("3059B7", "Microsoft");
    vendors.insert("48D6D5", "Microsoft");
    vendors.insert("501AC5", "Microsoft");
    vendors.insert("6045BD", "Microsoft");
    vendors.insert("7C1E52", "Microsoft");
    vendors.insert("94F665", "Microsoft");
    vendors.insert("B4AE2B", "Microsoft");
    vendors.insert("C03F0E", "Microsoft");
    vendors.insert("E4E111", "Microsoft");

    // Dell
    vendors.insert("00065B", "Dell");
    vendors.insert("000874", "Dell");
    vendors.insert("000AF7", "Dell");
    vendors.insert("000BDB", "Dell");
    vendors.insert("000D56", "Dell");
    vendors.insert("000F1F", "Dell");
    vendors.insert("001143", "Dell");
    vendors.insert("00123F", "Dell");
    vendors.insert("001372", "Dell");
    vendors.insert("001422", "Dell");
    vendors.insert("0015C5", "Dell");

    // HP
    vendors.insert("0001E6", "HP");
    vendors.insert("0003E9", "HP");
    vendors.insert("000802", "HP");
    vendors.insert("000BCD", "HP");
    vendors.insert("000D9D", "HP");
    vendors.insert("000E7F", "HP");
    vendors.insert("001083", "HP");
    vendors.insert("00110A", "HP");
    vendors.insert("001185", "HP");

    // Sony
    vendors.insert("00014A", "Sony");
    vendors.insert("00041F", "Sony");
    vendors.insert("000A23", "Sony");
    vendors.insert("000D44", "Sony");
    vendors.insert("001315", "Sony");
    vendors.insert("0013CF", "Sony");

    // Google
    vendors.insert("001A11", "Google");
    vendors.insert("3C5AB4", "Google");
    vendors.insert("F88FCA", "Google");
    vendors.insert("F4F5E8", "Google");
    vendors.insert("94EB2D", "Google");

    // LG
    vendors.insert("0000C0", "LG");
    vendors.insert("0005C9", "LG");
    vendors.insert("00122A", "LG");
    vendors.insert("001C62", "LG");
    vendors.insert("001E75", "LG");

    // Asus
    vendors.insert("000C6E", "Asus");
    vendors.insert("000E08", "Asus");
    vendors.insert("0015F2", "Asus");
    vendors.insert("001BFC", "Asus");
    vendors.insert("001E8C", "Asus");
    vendors.insert("00248C", "Asus");
    vendors.insert("08606E", "Asus");
    vendors.insert("107B44", "Asus");
    vendors.insert("14D64D", "Asus");
    vendors.insert("1C872C", "Asus");
    vendors.insert("240A64", "Asus");
    vendors.insert("305A3A", "Asus");
    vendors.insert("40167E", "Asus");
    vendors.insert("50465D", "Asus");
    vendors.insert("60A44C", "Asus");
    vendors.insert("74D02B", "Asus");
    vendors.insert("88D7F6", "Asus");
    vendors.insert("90E6BA", "Asus");
    vendors.insert("AC220B", "Asus");
    vendors.insert("B06EBF", "Asus");
    vendors.insert("BCEE7B", "Asus");
    vendors.insert("C86000", "Asus");
    vendors.insert("D850E6", "Asus");
    vendors.insert("E03F49", "Asus");
    vendors.insert("F02F74", "Asus");
    vendors.insert("F832E4", "Asus");

    match vendors.get(oui.as_str()) {
        Some(name) => name.to_string(),
        None => "Unknown".to_string(),
    }
}
