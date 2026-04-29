# 🍎 QR Prompter — macOS Build Talimatı

> **Hedef:** MacBook Air/Pro serisinin tamamı (Intel + Apple Silicon).
> Bu talimat Mac'te **bir kez** uygulanır; sonra istediğin kadar build alabilirsin.

---

## 0) Önkoşul

- macOS **11.0 (Big Sur)** veya üstü — 2020 sonrası tüm MacBook'lar uyumlu.
- 5 GB boş disk (build cache + DMG çıktıları)
- İnternet (ilk seferde Electron indirilir, ~120 MB)

---

## 1) Node.js kurulumu (5 dakika, bir kez)

1. https://nodejs.org adresine git
2. Sol taraftaki büyük yeşil **LTS** butonuna tıkla → indir
3. İndirilen `.pkg` dosyasını çift tıkla → İleri → İleri → Kur
4. Terminal aç (Spotlight: ⌘+Space → "Terminal")
5. Kontrol:
   ```bash
   node --version    # v20.x veya v22.x görmeli
   npm --version
   ```

---

## 2) Projeyi Mac'e aktar

**A — ZIP ile (en pratik):**
- Windows tarafında: `EBD-mac-source.zip` masaüstüne hazırlandı
- ZIP'i Mac'e gönder (AirDrop / iCloud / USB / e-posta)
- Mac'te masaüstüne çıkar → klasör adı `EBD/`

**B — Git ile:**
```bash
git clone <repo-url> EBD
```

⚠️ **`node_modules/` ve `dist-app/` klasörlerini Windows'tan KOPYALAMA** — Mac'te yeniden kurulacaklar (native modüller platform-spesifik).

---

## 3) Build komutları (Mac terminalinde)

```bash
cd ~/Desktop/EBD          # veya nereye çıkardıysan
npm install               # ~2 dakika, bağımlılıkları indirir
npm run dist:mac          # ~5 dakika, DMG + ZIP üretir
```

Build sırasında ekranda akan log normaldir. **"Skip code signing"** veya **"Default Electron icon"** uyarıları **sorun değil** — bilinçli.

---

## 4) Çıktılar

`dist-app/` klasörü içinde:

| Dosya | Kim için |
|---|---|
| `QR-Prompter-1.2.0-arm64.dmg` | **M1/M2/M3/M4 MacBook** (2020 sonu sonrası) |
| `QR-Prompter-1.2.0-x64.dmg` | **Intel MacBook** (2020 öncesi) |
| `QR-Prompter-1.2.0-arm64-mac.zip` | Apple Silicon portable |
| `QR-Prompter-1.2.0-x64-mac.zip` | Intel portable |
| `mac/` ve `mac-arm64/` | Çalışan .app bundle'ları (DMG'nin içindeki) |

> 💡 **Apple Silicon mu Intel mi?** Mac'te → menü çubuğu sol üst → 🍎 → "Bu Mac Hakkında" → satır:
> - "Apple M1/M2/M3/M4..." → **arm64** kullan
> - "Intel Core i5/i7/i9..." → **x64** kullan

---

## 5) Kurulum (kullanıcı için)

1. DMG dosyasına çift tıkla → küçük bir pencere açılır
2. **QR Prompter** ikonunu **Applications** klasörüne sürükle
3. DMG penceresini kapat, "Çıkar" (Eject)
4. Applications klasöründen ilk açılış için:
   - **Sağ tık** (veya Ctrl+tık) → **Aç** → uyarı çıkar → **Aç**
   - Bu **bir kerelik**. Sonraki açılışlarda direkt çift tıkla yeter.

> ⚠️ macOS Sequoia (15.x) ek bir adım isteyebilir:
> Sistem Ayarları → Privacy & Security → Aşağıda "QR Prompter is blocked..." → **Open Anyway** butonu

---

## 6) Backup klasörü

Mac'te uygulama çalıştığında otomatik olarak şu klasör oluşur:

```
~/Documents/QR Prompter Backup/
```

Finder'dan rahatça görüp yedek dosyalarına ulaşabilirsin (her snapshot tarih damgalı `.json`).

---

## 7) Sorun giderme

| Hata | Çözüm |
|---|---|
| `command not found: npm` | Node.js kurulumu tamamlanmamış; terminali kapat-aç |
| `npm install` çok yavaş | Türkiye'den daha hızlı: `npm config set registry https://registry.npmjs.org/` |
| `gyp` hatası | Xcode Command Line Tools eksik: `xcode-select --install` |
| DMG'de "tanınmayan geliştirici" | Sağ tık → Aç → Aç (bir kerelik) — kod imzasız olduğundan |
| App açılmıyor, çakılıyor | Terminal'den çalıştır: `/Applications/QR\ Production\ Prompter.app/Contents/MacOS/QR\ Production\ Prompter` — log gör |

---

## 8) Sonraki sürümler

Kaynak kodda değişiklik olunca:

```bash
cd ~/Desktop/EBD
git pull        # veya yeni ZIP'i çıkar
npm run dist:mac
```

`npm install` tekrar gerek yok (paketler sabit). Sadece `dist:mac`.

---

## 9) Code signing & notarize (ileride)

Şu an kod **imzasız** dağıtılıyor — kullanıcı sağ tık → Aç ile geçer. Profesyonel dağıtım için:

1. Apple Developer Program (99 USD/yıl)
2. `package.json` `mac.identity` → developer ID
3. `package.json` `mac.hardenedRuntime: true` + entitlements
4. `notarize` plugin ile App Store dışı notarize

Bu adım zorunlu değil; sadece "İnternetten indirdim, hiç uyarı görmek istemiyorum" senaryosu içindir.
