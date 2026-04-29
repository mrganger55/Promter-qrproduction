# ✨ ÖZELLİKLER

> Üst seviye için → [SISTEM.md](../SISTEM.md)

**Son güncellenme:** 2026-04-29 — İterasyon 17

---

## ✅ Mevcut özellikler

### Workspace / Setlist
- Birden fazla konser setlist'i (workspace) yan yana tutulur
- Otomatik "📚 Tüm Şarkılar (Kütüphane)" workspace
- Item tipleri: `song`, `talk` (KONUŞMA), `break` (ARA)
- Checkbox ile çoklu seçim + bulk ↑↓🗑
- Hızlı ekleme: 🎤 Konuşma, ⏸ Ara butonları (seçili item'dan sonra insert)

### Şarkı kütüphanesi
- 45 PDF → 45 TXT (PyPDF2 + akıllı satır kırma + U+2028 normalize)
- Library modal **master-detail** (sol liste + sağ editör)
- Düzenlenen şarkı `qrp-lib-overrides` localStorage anahtarına kaydolur
- Override edilmiş şarkıda ✏ rozet + sarı kenarlık
- 💾 TXT'e Kaydet (File System Access API ile diske yaz)

### Prompter (sanatçı ekranı)
- Auto-fit pagination (binary search font boyutu)
- Üst bar: QR brand + şarkı + ton + sayfa
- Alt bar: "Sıradaki" + kronometre
- Sanatçı mesajı (alt bantta slide-up)
- Section marker'lar (renkli başlık): VERSE, CHORUS, BRIDGE, INTRO, OUTRO, SOLO, BREAK, NOTE
- Sayfa kırma: `---` / `===` / `[PAGE]`

### Kontrol paneli
- Editör: ↵ Sayfa Böl, kıta/nakarat/köprü/not butonları
- Önizleme (mini prompter)
- Ayarlar: font, kılavuz, tema, kronometre boyutu, info bar boyutu/opaklık
- Auto-save (1.5 sn debounce) + 5 dakikada bir snapshot

### Klavye
- ← → sayfa navigasyon (sınırda setlist'e atlar)
- Ctrl+S editörde kaydet
- Diğer kısayollar kapalı (sahne-güvenlik)

### Auto-play (sahne-güvenli)
- Sadece ▶ butonuna basınca başlar
- Countdown sonrası başlamaz, kullanıcı tetikler

### Paketleme (it.16)
- Electron 32 + electron-builder 25
- Win NSIS + Mac DMG hedefli
- `dist-app/win-unpacked/` (266 MB) çalışır vaziyette
- Portable ZIP: 107.9 MB

---

## 🚧 İterasyon 17 — Devam eden iş

| # | Özellik | Durum |
|---|---|---|
| 17.1 | MD zinciri + memory altyapısı | ✅ Tamamlandı |
| 17.2 | Setlist ↑ scroll bug'ı | ✅ Tamamlandı |
| 17.3 | Şarkı sıra numaraları (sol kontrol paneli) | ✅ Tamamlandı |
| 17.4 | Mesaj barı: Flash butonu (basılı tut) + boyut slider (real-time) | ✅ Tamamlandı |
| 17.5 | Mesaj barı genişletme (fixed overlay, 1×–6×) + 8 hızlı sembol butonu | ✅ Tamamlandı |
| 17.6 | Backup sistemi (Backup/ klasörü, JSON snapshot, FSA + IndexedDB) | ✅ Tamamlandı |

---

## 📅 Sonraki iterasyonlar (planlanan)

- **İt.18 — Electron storage IPC**: `main.js` preload + `fs` ile Backup yazımı (web tarafı dokunulmaz)
- **İt.19 — Mac DMG build**: macOS test + DMG üretimi
- **İt.20 — İkon dosyaları**: `build/icon.{ico,icns,png}`
- Setlist sürükle-bırak sıralama
- PDF sürükle-bırak import
- localStorage boyut izleme

---

## 🚫 Bilinçli kapatılan istekler

- Otomatik mesaj kaybolma (saniye bazlı) → kaldırıldı, sahnede risk
- Auto-play countdown sonrası → kaldırıldı, kullanıcı tetikler
- Klavye Space/M/F/Esc/↑↓ kısayolları → kaldırıldı, yanlış basış riski
- Saat göstergesi (sistem saati) → kaldırıldı, kronometre yeterli
