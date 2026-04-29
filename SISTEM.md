# 📖 SİSTEM — QR Production Prompter

> **Bu dosya ana indekstir.** Detaylar `docs/` altında. Her güncellemede ilgili alt-dosya + bu indeks + `data/GELISIM-NOTLARI.md` birlikte güncellenir.

**Son güncellenme:** 2026-04-29 — İt.19: macOS build hazırlığı tamamlandı (package.json mac target detaylı, main.js Backup Mac yolu, KURULUM-MAC.md adım adım, EBD-mac-source.zip transferli). Mac'te tek komutla `npm run dist:mac` → 4 DMG/ZIP üretilir.

---

## 🎯 Proje Özeti

Elif Buse Doğan canlı konser **iki ekranlı prompter** sistemi.

- **Operatör:** `index.html` (kontrol paneli)
- **Sanatçı:** `prompter.html` (ikinci ekran)
- **İletişim:** `BroadcastChannel('qr-prompter')`
- **Veri:** `localStorage` (anlık) + `Backup/` klasörü (kalıcı)
- **Dağıtım:** Web (`file://`) → Electron app (Win + Mac)

---

## 📚 Doküman Zinciri

| Dosya | İçerik |
|---|---|
| [docs/MIMARI.md](docs/MIMARI.md) | Storage adapter, BroadcastChannel mesajları, localStorage anahtarları |
| [docs/OZELLIKLER.md](docs/OZELLIKLER.md) | Tüm özellik listesi (mevcut + planlanan + kapatılmış) |
| [docs/YEDEKLEME.md](docs/YEDEKLEME.md) | Backup sistemi: format, tetikleyiciler, geri yükleme |
| [docs/KISAYOLLAR.md](docs/KISAYOLLAR.md) | Klavye, butonlar, sahne-güvenli kurallar |
| [docs/PAKETLEME.md](docs/PAKETLEME.md) | Electron Win + Mac build durumu, bilinen sorunlar |
| [data/GELISIM-NOTLARI.md](data/GELISIM-NOTLARI.md) | İterasyon log (en yeni en üstte) |
| [BUILD-NOTES.md](BUILD-NOTES.md) | Eski Electron paketleme notları (legacy) |

---

## 🗂️ Önemli Yollar

```
EBD/
├── index.html, prompter.html      # Ana ekranlar
├── main.js, package.json          # Electron (it.16'da kuruldu)
├── js/                            # app.js, prompter.js, songs-bundle.js
├── css/                           # control.css, prompter.css
├── data/                          # *.json + GELISIM-NOTLARI.md
├── Backup/                        # ← YENİ (it.17): otomatik JSON snapshot'lar
├── docs/                          # ← YENİ (it.17): bu sistem dokümanları
├── Şarkılar TXT/                  # 45 TXT (auto-generated)
├── Şarkılar ve sözler/            # 47 PDF (kaynak)
├── EBD Setlist/                   # Orijinal setlist txt'leri
├── extract_pdfs.py                # PDF → TXT + bundle üreteci
├── BAŞLAT.bat                     # HTTP launcher (alternatif)
├── dist-app/                      # Electron build çıktısı
└── node_modules/                  # Electron bağımlılıkları
```

---

## ⚙️ Çalışma Modları

| Mod | Backup yetkisi | Nasıl açılır |
|---|---|---|
| **Web (`file://`)** — geliştirme | İlk açılışta tek tıklama (klasör seç) → IndexedDB persist | `index.html` çift tıkla |
| **Electron app** — final | Otomatik (sıfır kullanıcı eylemi) | `QR Production Prompter.exe` |

İkisinde de **aynı UI kodu**. Aralarında `window.IS_ELECTRON` flag'i farkı vardır.

---

## 🔄 Güncelleme Akışı (her iterasyonda izle)

1. Kod değişikliği → ilgili `js/` veya `css/` dosyası
2. `index.html`'deki `?v=N` cache version'ını bump et (sadece dokunulan dosya için)
3. `docs/` altındaki ilgili MD'yi güncelle
4. `data/GELISIM-NOTLARI.md`'nin **başına** yeni iterasyon ekle
5. Bu `SISTEM.md`'deki "Son güncellenme" tarihini güncelle
6. (Backup aktifse) snapshot otomatik yazılır
