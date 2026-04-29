# 📦 PAKETLEME (Electron)

> Üst seviye için → [SISTEM.md](../SISTEM.md) · Eski notlar → [BUILD-NOTES.md](../BUILD-NOTES.md)

**Son güncellenme:** 2026-04-29 — İterasyon 18: Electron IPC eklendi, Windows build çalıştırıldı (sonuç build raporunda)

---

## Mevcut durum (İterasyon 16)

- ✅ `package.json` → electron 32, electron-builder 25
- ✅ `main.js` → 2.ekran fullscreen handler, popup'lar yakalanıyor
- ✅ `dist-app/win-unpacked/` (266 MB, çalışan exe)
- ✅ `dist-app/QR-Prompter-1.0.0-win-portable.zip` (107.9 MB)
- ⚠️ NSIS Setup.exe → **üretilemedi** (Windows Developer Mode kapalı, sembolik bağ hatası)
- ❌ Mac DMG → henüz denenmedi

---

## Build komutları

```bash
npm install                # 404 paket, ~55 sn
npm run start              # Electron'u dev modda aç
npm run dist:win           # Win NSIS .exe (Developer Mode lazım)
npm run dist:mac           # Mac DMG
npm run dist:all           # Hem Win hem Mac
```

`asarUnpack`: `data/`, `Şarkılar TXT/`, `EBD Setlist/` (file:// erişimi için).

---

## Kullanıcının yapacağı (Win Setup için)

1. `Settings → Privacy & security → For developers → Developer Mode ON`
2. `npm run dist:win` → `dist-app/QR-Prompter-Setup-1.x.x.exe` üretilir
3. Test → kuruluyu açıp prompter 2.ekrana çıkıyor mu kontrol

---

## Mac DMG için (it.19 hazırlığı)

**electron-builder 25.x cross-build desteklemiyor** — Mac'te çalıştırılmalı.

Yazılımsal hazırlık tamamlandı (package.json + main.js + KURULUM-MAC.md). Mac'te:
```bash
cd ~/Desktop/EBD
npm install
npm run dist:mac
```

Üretilenler (tümü `dist-app/` içinde):
- `QR-Prompter-1.2.0-arm64.dmg` (~250 MB) — M1/M2/M3/M4 MacBook
- `QR-Prompter-1.2.0-x64.dmg` (~250 MB) — Intel MacBook
- `QR-Prompter-1.2.0-arm64-mac.zip` — Apple Silicon portable
- `QR-Prompter-1.2.0-x64-mac.zip` — Intel portable

**Kod imzasız** — kullanıcı ilk açılışta `sağ tık → Aç → Aç` (bir kerelik), sonra normal. Detaylar: [`KURULUM-MAC.md`](../KURULUM-MAC.md).

---

## İterasyon 18 — Storage Electron IPC ✅

**`js/preload.js`:**
```js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    fs: {
        list:   ()           => ipcRenderer.invoke('backup:list'),
        save:   (name, json) => ipcRenderer.invoke('backup:save', name, json),
        load:   (name)       => ipcRenderer.invoke('backup:load', name),
        remove: (name)       => ipcRenderer.invoke('backup:remove', name),
        path:   ()           => ipcRenderer.invoke('backup:path'),
    },
});
```

**`main.js`:** `ipcMain.handle('backup:list/save/load/remove/path')` + `getBackupDir()` helper. App paketli ise `path.dirname(app.getPath('exe'))/Backup`, değilse `app.getAppPath()/Backup`. Klasör yoksa otomatik oluşturulur.

**`storage.js` otomatik geçiş:** `window.electronAPI` varsa `Electron` adapter, yoksa `Browser` adapter. UI dokunulmadı.

**Sonuç:** Electron'da klasör seçim diyalogu yok; app açılır açılmaz Backup hazır.

---

## İkon dosyaları (eksik, kullanıcı eylemi)

`build/` klasörüne eklenmeli:

| Dosya | Format | Boyut |
|---|---|---|
| `icon.ico` | Windows | 256×256 |
| `icon.icns` | Mac | 1024×1024 |
| `icon.png` | Linux fallback | 512×512 |

Yoksa Electron default icon kullanılır.

---

## Bilinen sorunlar

- ✗ NSIS sembolik bağ — Developer Mode aç (kalıcı çözüm)
- ✗ İkon yok — kullanıcı eylem
- ✗ Code signing yok — Mac'te "tanınmayan geliştirici"
- ✗ Auto-update yok — manuel yenileme

---

> **Şu an:** Electron tarafına dokunmuyoruz. Web düzenlemeleri (it.17) bitince it.18'de Electron'a paketleyeceğiz.
