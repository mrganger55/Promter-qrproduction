# QR Production Prompter — Gelişim Notları

## İterasyon 19 (29 Nisan 2026) — macOS build hazırlığı
### Kararlar (yazılımsal)
- **Cross-build kapalı:** electron-builder 25.x Windows'tan macOS DMG üretmiyor (`Build for macOS is supported only on macOS`). Build Mac'te yapılacak.
- **Mimari hedefi:** Hem `x64` hem `arm64` ayrı (ikisi de DMG + ZIP). Universal binary değil — ayrı dosyalar daha küçük (250 MB / her biri vs ~500 MB universal).
- **Min macOS:** 11.0 (Big Sur, 2020) — Electron 32 alt sınırı, tüm güncel MacBook'lar uyumlu.
- **Code signing yok:** Apple Developer hesabı yok; `identity: null` + `hardenedRuntime: false` + `gatekeeperAssess: false`. Kullanıcı ilk açılışta sağ tık → Aç (bir kerelik).
- **Backup yolu (Mac):** `~/Documents/QR Prompter Backup/` — `userData` yerine kullanıcının görebileceği yer (Finder'dan erişim).

### Yapılan
- [x] **`package.json` mac target genişletildi:**
  - `target: dmg + zip` × `arch: x64 + arm64` → 4 dosya çıktı
  - `darkModeSupport: true`, `minimumSystemVersion: "11.0"`
  - `hardenedRuntime: false`, `gatekeeperAssess: false`, `identity: null`
  - `extendInfo`: `NSHighResolutionCapable: true` (Retina), `NSRequiresAquaSystemAppearance: false` (dark mode), `CFBundleDisplayName: "QR Prompter"`
  - `dmg.window` 540×380 + ikon ve `/Applications` link içeren standart drag-to-install layout
- [x] **`main.js` `getBackupDir()` platform-aware:**
  - `darwin`: `app.getPath('documents') + '/QR Prompter Backup'`
  - Win packaged: `path.dirname(app.getPath('exe')) + '/Backup'` (taşınabilir, mevcut)
  - Geliştirme: `app.getAppPath() + '/Backup'`
- [x] **`KURULUM-MAC.md`** — kullanıcı için adım adım rehber (Node kurulumu → npm install → npm run dist:mac → DMG kullanım + sorun giderme)
- [x] **`EBD-mac-source.zip`** — Windows masaüstüne hazırlandı (node_modules, dist-app, .claude hariç) → AirDrop/USB ile Mac'e
- [x] Kullanıcı dağıtımı için "hangi DMG?" rehberi: 🍎 → "Bu Mac Hakkında" — Apple Silicon → arm64, Intel → x64

### Mac'te çalıştırılacak (kullanıcı eylemi)
```bash
cd ~/Desktop/EBD
npm install        # ~2 dk
npm run dist:mac   # ~5 dk
# → dist-app/ içinde 4 dosya
```

### Neden
Kullanıcı "Macbook serisinin tamamında çalışsın, en doğru paketlemeyi yap" dedi. Cross-build mümkün değil; bu yüzden tüm yazılımsal kararlar Windows tarafında alınıp Mac'e tek komutla paketlenecek şekilde optimize edildi. Code signing/notarization Apple Developer hesabı gerektirdiği için ileri tarihe bırakıldı; "tanınmayan geliştirici" uyarısı tek tıklamayla geçilebiliyor.

---

## İterasyon 18 (29 Nisan 2026) — Electron IPC + Windows paketleme
### Yapılan
- [x] **Yeni dosya:** `js/preload.js` — `contextBridge.exposeInMainWorld('electronAPI', {fs:{list,save,load,remove,path}})` + `IS_ELECTRON: true` flag
- [x] **`main.js` güncellendi:**
  - `ipcMain.handle('backup:list')` — Backup klasöründeki .json dosyalarını oku, `{name,date,size}` listesi döndür
  - `ipcMain.handle('backup:save', name, json)` — diske yaz (regex ile dosya adı doğrulaması)
  - `ipcMain.handle('backup:load', name)` — JSON metni döndür
  - `ipcMain.handle('backup:remove', name)` — dosya sil
  - `ipcMain.handle('backup:path')` — Backup yolunu döndür
  - `getBackupDir()` — `app.isPackaged` ise `path.dirname(app.getPath('exe'))/Backup`, değilse `app.getAppPath()/Backup`; klasör yoksa otomatik oluşturur
  - Control window webPreferences'a `preload: js/preload.js` eklendi (contextIsolation:true zaten vardı)
- [x] **`storage.js` otomatik geçiş:** `window.electronAPI` mevcutsa `Electron` adapter, değilse `Browser` adapter — UI tarafı dokunulmadı
- [x] **Sıfır kullanıcı eylemi (Electron):** App açılır açılmaz Backup/ klasörü oluşur, klasör seçim diyalogu YOK, açılışta startup snapshot otomatik yazılır
- [x] `package.json` version: 1.1.0 → 1.2.0
- [x] **Windows build:** `npm run dist:win` çalıştırıldı (NSIS Setup.exe + win-unpacked)

### Backup yolu (kullanıcı için)
Paketli app çalışırken: `<kurulum klasörü>\Backup\` (taşınabilir kalsın diye userData yerine app klasörü)

### Neden
İt.17.6'da web Backup tamamlandı; kullanıcı klasör seçim diyalogundan rahatsız oldu. Electron'a paketleyince `fs` modülü ile sıfır eylem otomatikleşir. Storage adapter pattern bunun için kurulmuştu — UI/Backup mantığı tek satır değişmeden Electron'a geçti.

---

## İterasyon 17 (29 Nisan 2026)

### 17.1 — Altyapı ✅
- [x] MD zinciri: `SISTEM.md` (kök) + `docs/` (MIMARI, OZELLIKLER, YEDEKLEME, KISAYOLLAR, PAKETLEME)
- [x] Auto-memory: `feedback_md_iletisim.md` + `project_yeni_ozellikler.md`
- [x] Karar: Electron beklemede, web önce, sonra paket (→ it.18)

### 17.2 — Setlist scroll bug fix ✅
- [x] `slAction` (`up`/`dn`): re-render öncesi `scrollTop` kaydediliyor, sonrasında geri yükleniyor
- [x] `bulkMove`: aynı save/restore çoklu seçim taşımalarda da uygulandı
- [x] `rm` aksiyonu için scroll'a dokunulmuyor (mevcut `pickItem` davranışı korundu)
- **Etki:** Pencere büyükken bir parçayı ↑ ile yukarı taşırken sayfa artık kaymıyor

### 17.3 — Şarkı sıra numaraları ✅
- [x] `renderSL` içinde `songNum` sayacı; sadece `type === 'song'` için artar
- [x] HTML: checkbox'tan sonra `<span class="sl-num">N</span>`, talk/break için boş kalır (hizalama korunur)
- [x] CSS: `.sl-num` → 11px, accent renk, `tabular-nums`, `min-width:20px`
- [x] Sanatçı ekranı (prompter) etkilenmedi — sadece operatör görür
- [x] Numaralar setlist'in **gerçek sırasına** göre (arama filtrelese bile sayım korunur)

### 17.4 — Flash butonu + mesaj boyut çubuğu ✅
- [x] **Flash:** `index.html` Gizle'nin sağına `⚡ Flash` butonu; `mousedown/touchstart` → `flashMessage:{on:true}`, `mouseup/leave/touchend/blur` → `{on:false}`
- [x] **Boyut çubuğu:** Altına `<input type="range">` 1.0×–3.0× (step 0.1); real-time `setMessageSize:{scale}` broadcast + `qrp-settings`'e persist
- [x] Prompter: `case 'flashMessage'` → `.msg-bar.flashing` toggle (CSS keyframe yanıp söner); `case 'setMessageSize'` → `--msg-size` CSS variable
- [x] Prompter `.msg-text` ve `.msg-icon` font-size'ı `calc(22px * var(--msg-size, 1))` ile çarpana bağlı
- [x] Prompter `case 'init'` da `msgSize` uygular (yeni pencere açılışında doğru boyutla başlar)
- [x] Cache bump: `control.css?v=17.4`, `app.js?v=17.4`, `prompter.css?v=17.4`, prompter inline JS PROMPTER_VERSION → v17.2

### 17.5 — Mesaj barı genişletme + hızlı sembol butonları ✅
- [x] **Mesaj barı `position: fixed`** — alt akıştan ayrıldı, sözlerin üzerine biner; `.page-area` kıpırdamaz
- [x] Arka plan opaklaştırıldı (`rgba(15,17,30,0.94)` + 20px blur) — sözler arkada okunmaz
- [x] Slider range 1×–3× → **1×–6×**
- [x] `.msg-bar.on` ve `.msg-viewport` → `max-height: min(95vh, calc(15vh + var(--msg-size,1) * 15vh))` — slider sağa gittikçe HEM yazı HEM bar yüksekliği büyür (1× → 30vh, 6× → 95vh clamp)
- [x] `border-top` 1px → 2px (görünür ayrım)
- [x] **Editör altına `.symbol-bar`** — 8 hızlı sembol butonu: 💃 Dans, 🎶 Melodi, 🥁 Ritim, 🪘 Davul, 🎤 Anons, 🎸 Gitar, 🎹 Piyano, ✋ Dur
- [x] Tıklayınca cursor konumuna `\nSEMBOL\n` insert; otomatik newline normalize; `input` eventi dispatch (auto-save + preview tetiklenir)
- [x] Cache bump: `control.css?v=17.5`, `app.js?v=17.5`, `prompter.css?v=17.5`, prompter inline JS `PROMPTER_VERSION` → v17.5
### Neden
Kullanıcı 17.4 testinde "mesaj çok az büyüyor, sözlerin üzerine gelmeli, bazen ekran küçük; ayrıca kolay sembol ekleme alanı (Dans, Melodi, Ritim, Davul) lazım" dedi.

### 17.6 — Backup sistemi ✅
- [x] **Yeni dosya:** `js/storage.js` — `window.QRBackup` facade + `Browser` adapter (FSA + IndexedDB persist) + `Electron` stub (gelecek)
- [x] IndexedDB: `qrp-backup` DB, `handles` store, `backup-dir` key — `FileSystemDirectoryHandle` persist edilir, kullanıcı tek seferde klasör seçer
- [x] Klasör seçim mantığı: kullanıcı proje kökünü seçerse otomatik `Backup/` alt klasörü oluşturur; doğrudan `Backup` klasörü seçilirse direkt kullanılır
- [x] Snapshot formatı: `yyyy-MM-dd_HH-mm-ss.json` — `{version, savedAt, trigger, workspaces, activeWS, settings, libOverrides, session, libWsCreated}`
- [x] Tetikleyiciler: `startup` (açılışta sessiz), `manual` (💾 Yedekle), `newWorkspace` (anında), `autoSave` (debounced 5sn — `saveAll` hook)
- [x] Rotation: 30 snapshot tutulur, gerisi otomatik silinir (`pruneOld`)
- [x] **UI — Topbar:** `💾 Yedekle` butonu + `📁 Yedekler` butonu + yeşil/gri/kırmızı durum noktası (saving = pulse animation)
- [x] **UI — Modal:** liste (yeni → eski), her satırda tarih + dosya adı + boyut + trigger rozeti + `↺ Yükle` / `✕ Sil` butonları; üstte `📂 Klasör Seç` / `💾 Şimdi Yedekle` / `🔄 Yenile`
- [x] Geri yükleme: snapshot localStorage'a yazılır + `location.reload()` (kullanıcı confirm sonrası)
- [x] `applySnapshotToLocalStorage` + `captureCurrentState` helper'ları — tüm `qrp-*` anahtarlarını kapsar
- [x] Permission yönetimi: açılışta `queryPermission` (gesture'sız), düştüyse user gesture içinde `requestPermission` (`resumePermission`)
- [x] Cache bump: `control.css?v=17.6`, `app.js?v=17.6`, yeni `storage.js?v=17.6`

### Kullanıcı eylemi (ilk seferde)
1. **💾 Yedekle** butonuna bas
2. Tarayıcı klasör seçim diyalogu çıkar → `EBD/` veya `EBD/Backup/` seç → İzin Ver
3. Yetki tarayıcıda kalıcı (IndexedDB), sonraki açılışlar sessiz

### Neden
Kullanıcı "Backup dosyası otomatik sistem çalışma dosyasında açılmalıdır, bu app olacak" dedi. Storage adapter pattern ile web (FSA) + Electron (IPC) tek interface üzerinden çalışır; UI değişmez. Geliştirme aşamasında web'de tek seferlik klasör onayı; app paketlendiğinde sıfır kullanıcı eylemi (it.18'de IPC eklenince).


- [ ] Storage adapter pattern (`BrowserStorage` + Electron stub)
- [ ] `Backup/` klasörüne JSON snapshot
- [ ] Tetikleyiciler: açılış restore, yeni workspace, debounced save, manuel buton
- [ ] Eski 30 snapshot rotation
- [ ] UI: 💾 Şimdi Yedekle + 📁 Yedekleri Aç modalı

### Neden
Kullanıcı tek mesajda 5 farklı iyileştirme istedi (Backup, scroll bug, numara, Flash, slider). Sırasıyla kolaydan zora yapılıyor; her adım MD'ye + memory'e yansıtılıyor. Backup'a geçmeden önce kullanıcıdan onay alınacak (klasör seçim etkileşimi gerekiyor).

---

## İterasyon 16 (22 Nisan 2026, 12:00)
### Yapılan
- [x] **Electron masaüstü paketlemesine geçiş** (Windows + Mac hedeflenmiş)
- [x] `package.json` — electron v32, electron-builder v25; build config: appId `com.qrproduction.prompter`, win=nsis x64, mac=dmg x64+arm64, Türkçe installer UI, asarUnpack ile `data/` ve `Şarkılar TXT/` dışarıda.
- [x] `main.js` — ana süreç:
  - Kontrol penceresi (BrowserWindow, primary display)
  - `setWindowOpenHandler` ile `prompter.html` popup'ları yakalanıyor → ikinci ekran algılanırsa fullscreen+frameless, yoksa primary'de pencere olarak açılıyor. Mevcut `window.open('prompter.html?v=...')` kodu değişmeden çalışıyor.
  - Mac için native menu, Windows için menu gizli.
  - Harici linkler varsayılan tarayıcıda açılıyor.
- [x] `.gitignore` (node_modules, dist-app)
- [x] `npm install` — 404 paket, 55 sn.
- [x] **Windows build denendi** (`npx electron-builder --win`):
  - `dist-app/win-unpacked/` (266 MB, çalışan bundle, `QR Production Prompter.exe` hazır).
  - **NSIS installer (`Setup.exe`) ÜRETİLEMEDİ** — winCodeSign cache extraction sırasında `libcrypto.dylib`/`libssl.dylib` sembolik bağları oluşturulamadı (Windows Developer Mode kapalı, `SeCreateSymbolicLinkPrivilege` yok). electron-builder retry 3 kez denedi, vazgeçti (exit status 2).
  - Hızlı çözüm: `dist-app/QR-Prompter-1.0.0-win-portable.zip` (107.9 MB) — PowerShell `Compress-Archive` ile `win-unpacked` klasörünün sıkıştırılmış hali. Portable app olarak dağıtılabilir; extract → `.exe` çalıştır.
- [x] **Mac DMG** aynı symlink problemi nedeniyle denenmedi. Developer Mode açılınca `npm run dist:all` ile hem NSIS hem DMG üretilebilir.
### Çözülmesi gereken / Kullanıcı eylemi
- [ ] Windows Developer Mode aç (`Settings → Privacy & security → For developers → Developer Mode ON`, admin gerektirmez). Sonra `npm run dist:all` ile gerçek installer'lar üretilir.
- [ ] İkon dosyaları eklenmeli: `build/icon.ico` (Windows), `build/icon.icns` (Mac), `build/icon.png` (Linux fallback). Yoksa electron default icon kullanılır.
### Neden
Kullanıcı web tabanlı prompter'ın masaüstü Setup/App haline gelmesini, Windows + Mac destekli ve otomatize edilmiş paketleme istedi. Electron altyapısı kuruldu; Windows standalone bundle ve portable ZIP hazır. Installer üretimi için bir defalık sistem ayarı (Developer Mode) gerekiyor.

## İterasyon 15 (22 Nisan 2026, 11:45)
### Yapılan
- [x] **Library modal master-detail yapısına geçti** — `.lib-workspace` grid wrapper eklendi (`index.html`, `control.css`): sol 300 px dikey liste + sağ 1fr geniş editör. `libMode` toggle davranışı kaldırıldı; iki panel hep görünür.
- [x] **Liste tablo → dikey compact satır** (`renderLibTable` + `.lib-row` CSS): her satırda başlık + ton + hover aksiyonları (✏/🗑). Seçili şarkı `.selected` class'ı ile sol accent bar + highlight alıyor.
- [x] **Editör boş state** (`.le-empty`): şarkı seçili değilken sağda "🎵 Düzenlemek için soldan bir şarkı seçin" karşılama mesajı.
- [x] **Editör dolu state yeniden tasarlandı**: üstte başlık + rozet (Özel/Kütüphane/Yeni) + form (şarkı adı + ton), ortada yatay toolbar (sayfa sonu + kıta/nakarat/köprü/not), altta `flex:1` söz alanı (font 14 px, line-height 1.7), alt bantta küçük ipucu + kaydet/iptal/sil butonları. Odaklanınca textarea'da accent glow.
- [x] **Arama davranışı düzeltildi**: arama input'u yazılırken artık sadece `renderLibTable()` çağırılıyor; editörde açık form silinmiyor.
- [x] **ESC davranışı**: editörde açıkken ESC → editörü kapat (modal açık kalır); boş state'te ESC → modal kapat.
- [x] **Cache versiyonu bumplandı:** `14.9 → 15.0` (`index.html`)
### Neden
Kullanıcı önceki iterasyonun hâlâ "alt alta" göründüğünü bildirdi (cache hatası + yapının hâlâ dikey akışta kalması). Master-detail layout ile ayarlar/editör tam yandan "geniş çalışma ekranı" gibi açılıyor; liste sürekli solda kalıyor, tıklanan şarkı highlight oluyor.

## İterasyon 14 (22 Nisan 2026, 11:00)
### Yapılan
- [x] **Library modal büyütüldü** (`css/control.css` `.lib-panel`): `880×760` → `1200×1040`, max yerine sabit `height` — ayar ekranı daha geniş
- [x] **Şarkı editör layout'u 2 sütuna döndü** (`js/app.js` `renderLibEditor`, `css/control.css` `.lib-editor` grid): sol = başlık/ton + söz alanı (`flex:1`, tüm dikey alanı otomatik doldurur); sağ = Ekle araçları (dikey panel) + Örnek kutusu. Alt/üst bantlar tam genişlik.
- [x] **Söz alanı cetveli (`le-resize-handle`) kaldırıldı** — artık `flex:1` otomatik büyütme sağlıyor, manuel sürgüye gerek yok. `wireLeResize`, `applyLeTextHeight`, `loadLeTextHeight` fonksiyonları + `LE_TEXT_H_*` sabitleri temizlendi. `qrp-le-text-h` localStorage anahtarı orphan kaldı (zararsız).
- [x] **Cache versiyonu bumplandı:** `index.html` → `control.css?v=14.9`, `app.js?v=14.9`
### Neden
Kullanıcı, library modal'ın şarkı editöründeki söz alanını cetvelle yeterince büyütemediğini ve ayar ekranının küçük kaldığını bildirdi. İki sütunlu düzende söz alanı kaldı kadar alanı otomatik doldurduğu için cetvel gereksizleşti.


### Yapılan
- Temel sistem kuruldu: index.html, prompter.html, CSS, JS
- Sayfa sayfa gösterim sistemi (auto-fit)
- Kronometre (kontrol + prompter)
- Okuma rehber çizgisi

## İterasyon 2 (22 Nisan 2026, 02:00)  
### Yapılan
- Workspace sistemi eklendi (şehir/mekan bazlı setlistler)
- 46 şarkı PDF'inden sözler çıkarıldı → songs-db.json
- 57 ton bilgisi setlist dosyalarından parse edildi → tones-db.json
- Sanatçıya mesaj gönderme + kaldırma sistemi
- Antalya + Çapa Pera setlistleri hazır yüklendi
- Sonraki şarkı bilgisi prompter'da görünüyor

## İterasyon 3 (22 Nisan 2026, 03:00)
### Yapılan
- Türkçe karakter sorunları düzeltildi (ş, ı, ö, ü, ğ, ç)
- songs-db.json + tones-db.json entegre edildi
- Şarkı tıklayınca otomatik söz doldurma (findLyrics + findTone)
- Mesaj "Gönder" + "Kaldır" butonları
- clearMessage komutu prompter'a eklendi
- Bozuk unicode karakterler (U+FFFD) düzeltildi

## İterasyon 13 (22 Nisan 2026, 10:00)
### Yapılan
- [x] Setlist item'larına sol tarafta **checkbox sütunu** — çoklu seçim için
- [x] Seçim yapıldığında üstte **bulk-action bar** görünür (sarı accent): `X seçili · ☑ Tümü · ↑ · ↓ · 🗑 · ✕`
- [x] `bulkMove(dir)` — seçilileri toplu olarak yukarı/aşağı kaydır (onay yok)
- [x] `bulkDelete()` — seçilileri sil, **tek onay** (X parça silinsin mi?)
- [x] `toggleSelectAll()` — tümünü seç / hepsini temizle
- [x] S.idx korunur (item ID bazlı takip); bulk işlem sonrası seçili parça hâlâ seçili kalır
- [x] Stale ID temizleme: workspace değişince eski seçimler otomatik drop edilir
- [x] Script version v13'e bumplandı

## İterasyon 12 (22 Nisan 2026, 09:30)
### Yapılan
- [x] **Cache-bust:** `window.open('prompter.html?v=' + Date.now())` — her açılışta prompter taze yüklenir (önceki düzeltmeler stale cache yüzünden gözükmüyordu)
- [x] `index.html`'deki `<script src="js/app.js?v=12">` version query eklendi — kontrol paneli de hard-refresh ile taze JS yükleyecek
- [x] Konsol'da `[QR Prompter] v12` etiketi görünür (prompter açıldığında) — yeni kodun yüklendiğini doğrulamak için
- [x] Countdown sonrası davranış: `firstPage` + kronometre **otomatik başlat** (CR.on değilse chStart.click()). Otomatik sayfa geçişi yok.

## İterasyon 11 (22 Nisan 2026, 09:00)
### Yapılan
- [x] Sanatçı Mesaj: saniye dropdown'ı kaldırıldı, mesaj **duration=0** ile gönderiliyor → manuel 🚫 Gizle basılana kadar kalıyor
- [x] "Gönder" → **📢 Göster** / "Kaldır" → **🚫 Gizle** (daha net)
- [x] Başlık yanında yeşil "● Açık" durum rozeti (nabız animasyonu) — mesaj aktif mi anlık görünür
- [x] Geri sayım sonrasındaki otomatik sayfa geçişi (startAuto) kaldırıldı — artık sadece seçili parçanın ilk sayfasına atlıyor
- [x] Otomatik geçiş tamamen manuel: kullanıcı ▶ butonu ile istediğinde başlatır (risk azaltıldı)

## İterasyon 10 (22 Nisan 2026, 08:30)
### Yapılan
- [x] `navFlow(dir)` eklendi: sayfa geçişi + setlist akışı tek fonksiyonda
- [x] Son sayfada → basınca otomatik **sıradaki setlist item'ına** geçer (ilk sayfasıyla)
- [x] İlk sayfada ← basınca otomatik **önceki setlist item'ına** geçer ve **son sayfasına** atlar (`_pendingLastPage` flag + `pagesReady` handler)
- [x] ◀ ▶ butonları da artık aynı akışı kullanıyor (sadece klavye değil, mouse de setlist geçişi yapar)
- [x] Prompter kapalı veya içerik boşsa doğrudan setlist kaydırır

## İterasyon 9 (22 Nisan 2026, 08:00)
### Yapılan
- [x] 🎤 Konuşma butonu: gövde metni otomatik "Konuşma" ile doluyor (başlık "KONUŞMA")
- [x] ⏸ Ara butonu: gövde metni otomatik "Ara" ile doluyor (başlık "ARA")
- [x] Library modal'a **💾 TXT'e Kaydet** butonu + bekleyen değişiklik sayısı rozeti
- [x] `showDirectoryPicker` (File System Access API) ile bir kerelik klasör yetkisi alıp override'ları gerçek TXT dosyalarına yazabiliyor
- [x] Desteklemeyen tarayıcı için fallback: her override'lı TXT indirilecek şekilde sequential download
- [x] Başarılı disk yazımdan sonra override'lar temizleniyor (artık disk kaynak oluyor)

## İterasyon 8 (22 Nisan 2026, 07:30)
### Yapılan
- [x] Kütüphane override sistemi: Bir kütüphane şarkısı editörde düzenlendiğinde (örn. `---` sayfa kırıcı) değişiklik `qrp-lib-overrides` localStorage anahtarına filename→text olarak kaydedilir. Tekrar library'den eklendiğinde override version gelir.
- [x] Mevcut workspace item'ları otomatik `_libFile` ile eşleştiriliyor (canonical-title matching) — eski setlist'ler de override sistemine bağlanıyor
- [x] Library modal: düzenlenmiş şarkılar `✏` rozeti + sarı kenarlıkla işaretleniyor
- [x] Sidebar header'dan dropdown `+` menüsü kaldırıldı, yerine doğrudan butonlar: **🎤 Konuşma**, **⏸ Ara**
- [x] Hızlı ekleme butonları seçili item'ın hemen sonrasına insert eder (boşsa sona ekler)
- [x] `addLibSong` de artık seçili item'dan sonra insert ediyor

## İterasyon 7 (22 Nisan 2026, 07:00)
### Yapılan
- [x] Klavye kısayolları sadeleştirildi: yalnız ← → sayfa geçişi (+ editörde Ctrl+S kaydet). Space/Home/End/M/F/Esc/↑↓ kaldırıldı.
- [x] Prompter'a **üst bar** eklendi: QR brand + mevcut şarkı + ton + sayfa (büyük/belirgin)
- [x] Prompter **alt bar** yeniden tasarlandı: tam ortada **Sıradaki: &lt;title&gt; — &lt;ton&gt;**, sağda kronometre
- [x] Prompter'daki saat tamamen kaldırıldı (saatler tüm sistemden silindi, sadece kronometre kaldı)
- [x] Kontrol paneli footer'ı 3 sütun: sol (kronometre+butonlar), orta (Sıradaki parça+ton göstergesi), sağ (turlar)

## İterasyon 6 (22 Nisan 2026, 06:30)
### Yapılan
- [x] Üstteki sistem saati (topbar clock) kaldırıldı — iki zaman göstergesi karmaşasını giderdi
- [x] Sayfa kırma mantığı: `---` / `===` / `[PAGE]` satırları zorunlu sayfa sonu; auto-fit devrede kalıyor
- [x] Editor bar'a **↵ Sayfa Böl** butonu (imleç konumuna `---` ekler)
- [x] Prompter **Alt Bilgi Barı** dinamik CSS değişkenleriyle (`--ib-size`, `--ib-opacity`) güncellenebilir
- [x] Kontrol paneline yeni kutular: **Alt Bilgi Barı** (boyut + belirginlik + saat/kronometre göster/gizle), **Kronometre Boyutu**
- [x] `qrp-settings` localStorage anahtarı: tüm ayarlar (font, kılavuz, tema, kronometre, info bar) persist
- [x] `sendFullInit` yeni ayarları prompter'a da iletiyor
- [x] Preview'da `---` sayfa kırıcısı tanınıyor

## İterasyon 5 (22 Nisan 2026, 05:30)
### Yapılan
- [x] `extract_pdfs.py` — 45 şarkı PDF'si TXT'ye dönüştürüldü (`Şarkılar TXT/*.txt`)
- [x] PDF-kaynaklı tek-satır sorunu çözüldü: U+2028 (Line Separator) → \n normalize + akıllı satır kırma fallback
- [x] `data/songs-manifest.json` — tüm TXT dosyalarının indexi (title, filename, lines, chars)
- [x] Sidebar'a 📚 Şarkı Kütüphanesi butonu + modal eklendi (arama, tek tıkla ekleme, tümünü ekleme)
- [x] İlk açılışta otomatik "📚 Tüm Şarkılar (Kütüphane)" workspace oluşturuluyor — tüm 45 şarkı setlist'e otomatik yükleniyor
- [x] `findLyrics()` canon (punctuation-strip) matching ile güçlendirildi
- [x] Library TXT'leri LYRICS_DB'ye indexleniyor — diğer workspace'lerde de auto-fill çalışıyor
- [x] "boaz setlist / yedek" gibi setlist PDF'leri kütüphaneden otomatik filtrelendi

## İterasyon 4 (22 Nisan 2026, 03:30)
### Yapılan
- [x] Tek satırlık 14 şarkı sözü akıllı satır kırılması ile düzeltildi (CEHENNEMİN DİBİ, DEĞER Mİ HİÇ, KANDIRDIM, NAMUS, NE KAVGAM BİTTİ, SENİ İSTİYORUM, SENİ YAZDIM, SULTAN SÜLEYMAN, VUR GİTSİN BENİ, YANMIŞIM BEN, YÜZSÜZ YÜREK, ARA BENİ LÜTFEN, KAÇ KADEH, YAPARIM BİLİRSİN)
- [x] Preview gerçek sayfa görünümüne çevrildi (mini prompter simülasyonu — siyah arka plan, bölüm renkleri, info bar, şarkı adı + ton)
- [x] Prompter'da mesaj sistemi overlay'den alt bar'a taşındı (dikkat dağıtmadan görünür)
- [x] Mesaj barı: 💬 ikon + büyük yazı + slide-up animasyonu
- [x] clearMessage komutu mesaj barını temizliyor
- [x] Preview frame büyütüldü ve box-shadow eklendi

## Bilinen Sorunlar / Yapılacaklar
- [ ] 2. ekran algılama tarayıcıda sınırlı — Electron ile tam çözülecek
- [ ] Setlist sürükle-bırak ile sıralama
- [ ] PDF sürükle-bırak import
- [ ] Kontrol panelinden ton hızlı değiştirme (setlist üzerinden)
- [ ] Prompter'da sayfa geçiş animasyonu daha yumuşak olabilir
- [ ] localStorage veri boyutu takibi (büyük setlistlerde limit)

## Veritabanı Durumu
- Şarkılar TXT/: 45 tekil TXT (PyPDF2 + akıllı satır kırma)
- data/songs-manifest.json: 45 şarkının indexi (auto-yükleme için)
- songs-db.json: 45 şarkı, yapılandırılmış (title, lyrics, lineCount) — legacy
- tones-db.json: 57 ton bilgisi (ŞARKI ADI → Ton)
- songs-raw.json: Ham PDF çıktıları (yedek)
- Antalya setlist: 95+ parça (şarkılar + konuşmalar + türküler + oyun havaları)
- Çapa Pera setlist: 60+ parça

## Teknik Notlar
- BroadcastChannel: 'qr-prompter' — kontrol paneli ↔ prompter iletişimi
- Auto-fit: Binary search ile ekran boyutuna göre sayfa + font hesaplama
- Auto-save: Her 1.5 saniyede localStorage'a, her 5 dakikada zaman damgalı yedek
- Lyrics matching: findLyrics() — exact + partial title matching
- Tone matching: findTone() — exact + partial title matching
