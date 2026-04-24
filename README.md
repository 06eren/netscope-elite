# NetScope Elite 🛡️

NetScope Elite, modern ağları taramak, analiz etmek ve yönetmek için tasarlanmış profesyonel bir ağ güvenlik ve istihbarat platformudur. Şık, karanlık ve modern arayüzü ile ağınızdaki tüm cihazları anında tespit eder ve gelişmiş kontrol yetenekleri sunar.

## ✨ Öne Çıkan Özellikler

- 🚀 **Yüksek Performanslı Tarama:** Ağdaki tüm cihazları (telefonlar, tabletler, bilgisayarlar ve IoT cihazları) saniyeler içinde tespit eder.
- 📱 **Mobil Cihaz Keşfi:** Gizli veya uyku modundaki mobil cihazları özel uyandırma teknikleriyle bulur.
- 🔍 **Akıllı Cihaz Tanıma:** Cihazların markasını, modelini ve üzerindeki servisleri otomatik olarak analiz eder.
- ⚡ **Ofansif Kontroller:**
  - **Ağdan At:** Yetkisiz veya istenmeyen cihazların ağ bağlantısını tek tıkla kesin.
  - **Trafik İzleme:** Ağdaki veri akışını gerçek zamanlı olarak takip edin.
  - **Cihaz Uyandırma (WoL):** Uykudaki bilgisayarları uzaktan çalıştırın.
- 🗺️ **Yol İzleme (Traceroute):** Verilerinizin hangi sunucular üzerinden geçtiğini görselleştirin.
- 📊 **Veri İhracatı:** Tarama sonuçlarını JSON formatında dışa aktarın veya trafik verilerini Wireshark (.pcap) formatında kaydedin.

## 🛠️ Kurulum ve Çalıştırma

### Gereksinimler
- [Node.js](https://nodejs.org/) (Frontend ve paket yönetimi için)
- [Rust](https://rust-lang.org/) (Yüksek performanslı backend motoru için)
- [Npcap](https://nmap.org/npcap/) (Ağ trafiğini yakalamak için - Windows kullanıcıları için gereklidir)

### Başlatma
1. Proje klasörüne gidin.
2. Gerekli paketleri yükleyin:
   ```bash
   npm install
   ```
3. Uygulamayı geliştirici modunda başlatın:
   ```bash
   npm run tauri dev
   ```

## ⚖️ Lisans

Bu proje **MIT Lisansı** altında korunmaktadır.

---
**Geliştiren:** [Eren Arif Kargalıoğlu](https://github.com/06eren)
