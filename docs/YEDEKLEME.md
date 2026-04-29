# 💾 YEDEKLEME (BACKUP)

> Üst seviye için → [SISTEM.md](../SISTEM.md) · Mimari için → [MIMARI.md](MIMARI.md)

**Son güncellenme:** 2026-04-29 — İterasyon 17.6 ✅ Web modu uygulandı; Electron IPC tarafı it.18'de

---

## Amaç

`localStorage` corrupt olur, tarayıcı verileri silinir veya farklı makineye taşınılırsa **veri kaybı yaşanmasın**. Disk üzerinde JSON snapshot'lar otomatik tutulur.

---

## Klasör yolu

| Mod | Yol |
|---|---|
| Web (`file://`) | `<proje>/Backup/` (kullanıcı bir kez seçer, sonra otomatik) |
| Electron Win | `<app-folder>/Backup/` (kurulu klasörün yanında) |
| Electron Mac | `<App.app>/../Backup/` veya `~/Library/Application Support/QR Prompter/Backup/` |

---

## Snapshot formatı

Dosya adı: `2026-04-29_14-32-07.json` (yıl-ay-gün_saat-dakika-saniye)

İçerik:

```json
{
  "version": "v17.x",
  "savedAt": "2026-04-29T14:32:07+03:00",
  "trigger": "manual" | "newWorkspace" | "autoSave" | "startup",
  "workspaces": { /* qrp-workspaces içeriği */ },
  "activeWs": "ws_abc",
  "settings": { /* qrp-settings içeriği */ },
  "libOverrides": { /* qrp-lib-overrides içeriği */ }
}
```

---

## Tetikleyiciler

| Olay | Tetik |
|---|---|
| Uygulama açılışı | Eğer localStorage boş + Backup mevcutsa → en son snapshot yüklenir |
| **Yeni workspace eklendi** | Hemen snapshot (yeni konser günü = yeni yedek) |
| Setlist düzenlendi | **Debounced 5 sn** sonra snapshot (sürekli yazma engeli) |
| Manuel **💾 Şimdi Yedekle** butonu | Hemen snapshot |
| Settings değişti | Debounced 10 sn snapshot |

---

## Geri yükleme

1. Açılışta `loadLatestSnapshot()` çağrılır
2. localStorage boş ise → snapshot içeriği localStorage'a yazılır → uygulama başlar
3. localStorage dolu + snapshot daha yeni ise → kullanıcıya sor: "Daha yeni yedek var, yükleyeyim mi?"
4. Manuel geri yükleme: kontrol panelinden snapshot listesi → seç → yükle

---

## Eski snapshot temizliği

`pruneOldSnapshots(keep=30)` — son 30 dosya tutulur, gerisi silinir.

Yeni workspace açıldığında 30 limiti **tetiklemeye** dahil değildir (yani konser yedekleri korunur). Sadece `autoSave` snapshot'ları rotation'a girer.

---

## UI noktaları

| Yer | Eleman |
|---|---|
| Sağ üst (kontrol paneli) | 💾 **Şimdi Yedekle** butonu + en son yedek tarihi |
| Sağ üst | 📁 **Yedekleri Aç** modalı (liste, geri yükle, sil) |
| İlk açılış (web) | "📁 Backup klasörünü bağla" diyalog (sadece BrowserStorage modu) |

Electron modunda klasör seçim diyalogu **görünmez** (window.IS_ELECTRON = true).

---

## Implementation Sırası

1. Storage adapter interface + BrowserStorage implementation (it.17)
2. UI: 💾 buton + ilk açılış diyalog (it.17)
3. Tetikleyici hook'ları autoSave + workspace ekle (it.17)
4. Geri yükleme akışı + manuel modal (it.17)
5. ElectronStorage + main.js IPC (**it.18**)

---

## Felaket senaryosu testi

- localStorage manuel sil → açılışta Backup'tan yüklenmeli
- Backup klasörünü taşı → açılışta klasör soracak (web) / otomatik bulamazsa fallback (Electron)
- Çok eski snapshot yükle → version migration mantığı (gelecekte)
