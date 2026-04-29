# 🏛️ MİMARİ

> Üst seviye için → [SISTEM.md](../SISTEM.md)

**Son güncellenme:** 2026-04-29 — İterasyon 17

---

## Pencere mimarisi

```
┌──────────────────────────┐         ┌──────────────────────────┐
│   index.html             │         │   prompter.html          │
│   (operatör — js/app.js) │ ◀──────▶│   (sanatçı — js/prompter)│
│                          │ Channel │                          │
└──────────────────────────┘         └──────────────────────────┘
        │                                       │
        ▼                                       ▼
   localStorage                           localStorage (read-only sync)
        │
        ▼
   Backup/  (JSON snapshots)
```

**`BroadcastChannel('qr-prompter')`** — iki pencere arası tek kanal.

---

## Storage Adapter Pattern (it.17 yenilik)

Tek interface, iki implementation:

```js
// js/app.js içinde tanımlı
const storage = {
  saveSnapshot(data),         // → Backup/2026-04-29_14-32.json
  listSnapshots(),            // → ["2026-04-29_14-32", ...]
  loadLatestSnapshot(),       // → JSON nesnesi veya null
  loadSnapshot(name),         // → JSON nesnesi
  pruneOldSnapshots(keep=30)  // eski dosyaları sil
}
```

| Implementation | Mod | Ne kullanır |
|---|---|---|
| `BrowserStorage` | Web (`file://`) | `FileSystemDirectoryHandle` + `IndexedDB` (handle persist) |
| `ElectronStorage` | Electron app | `window.electronAPI.fs.*` (preload IPC) |

Seçim: `window.IS_ELECTRON` true ise ElectronStorage, değilse BrowserStorage.

**Not:** Electron tarafı (preload + main.js IPC) henüz yazılmadı. İterasyon 18'de eklenecek; o zamana kadar `BrowserStorage` her iki modda da çalışır (Electron'da da File System Access API var).

---

## localStorage Anahtarları

| Anahtar | İçerik |
|---|---|
| `qrp-workspaces` | Tüm setlist'ler (workspace map) |
| `qrp-active-ws` | Aktif workspace ID |
| `qrp-settings` | Font, kılavuz, tema, kronometre, info bar, **mesaj boyutu (it.17)** |
| `qrp-lib-overrides` | Kütüphane şarkı düzenlemeleri (filename → text) |
| `qrp-lib-ws-created` | "📚 Tüm Şarkılar" otomatik oluşturma marker'ı |
| `qrp-backup-<timestamp>` | Eski 5-dakikalık snapshot (legacy, Backup/ ile değişecek) |
| `qrp-backup-handle-asked` | İlk açılışta klasör seçim dialogu gösterildi mi (it.17) |

---

## BroadcastChannel Mesajları

Kontrol paneli → Prompter:

| `cmd` | Payload | Etki |
|---|---|---|
| `init` | `{ items, idx, page, settings }` | İlk açılışta tüm state |
| `pickItem` | `{ idx }` | Şarkıya geç |
| `nextPage`/`prevPage`/`firstPage`/`lastPage` | — | Sayfa navigasyonu |
| `showMessage` | `{ text, duration }` | Sanatçıya mesaj |
| `clearMessage` | — | Mesajı kaldır |
| **`flashMessage`** (it.17) | `{ on: bool }` | Flash başlat/durdur |
| **`setMessageSize`** (it.17) | `{ scale: 1.0–3.0 }` | Mesaj font boyutu |
| `applySettings` | `{ font, theme, ib*, ... }` | Ayarlar |

Prompter → Kontrol paneli:

| `cmd` | Payload |
|---|---|
| `pagesReady` | `{ total }` — pagination hazır |
| `pageChanged` | `{ current, total }` — sayfa değişti |

---

## Sayfa kırma (prompter)

- Marker: `---`, `===`, `[PAGE]` (tek başına satırda)
- Auto-fit: binary search ile font boyutu seçilir
- Section marker: `[VERSE] [CHORUS] [BRIDGE]` vb. — sayfa kırmaz, renkli başlık
