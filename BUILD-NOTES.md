# QR Production Prompter — Paketleme ve Kurulum Notları

## Mevcut Durum
Web tabanlı uygulama. Herhangi bir modern tarayıcıda (Chrome/Edge önerilir) çalışır.
`index.html` dosyasını tarayıcıda açarak kullanılır.

## Tarayıcı Gereksinimleri
- Google Chrome 100+ veya Microsoft Edge 100+ (ÖNERİLEN)
- BroadcastChannel API desteği (tüm modern tarayıcılar)
- Window Management API desteği (Chrome 100+, ikinci ekran otomatik algılama için)
- Fullscreen API desteği

## Dosya Yapısı
```
EBD/
├── index.html              # Kontrol Paneli (1. ekran - operatör)
├── prompter.html           # Prompter Ekranı (2. ekran - sanatçı)
├── css/
│   ├── control.css         # Kontrol paneli stilleri
│   └── prompter.css        # Prompter ekranı stilleri
├── js/
│   ├── app.js              # Kontrol paneli mantığı
│   └── prompter.js         # Ayrı prompter JS (yedek)
├── data/
│   └── songs-raw.json      # Şarkı sözleri veritabanı (PDF'lerden çıkarılmış)
├── EBD Setlist/            # Orijinal setlist dosyaları
│   ├── Antalya Setlist.txt
│   └── Çapa pera Setlist.txt
├── Şarkılar ve sözler/     # Orijinal şarkı PDF'leri (46 şarkı)
└── BUILD-NOTES.md          # Bu dosya
```

## Electron ile Masaüstü Uygulaması Paketleme

### Gerekli Yazılımlar
1. **Node.js** v18+ — https://nodejs.org
2. **npm** (Node.js ile birlikte gelir)

### Kurulum Adımları

```bash
# 1. Proje dizinine git
cd C:\Users\QR\Desktop\EBD

# 2. Node.js projesi oluştur
npm init -y

# 3. Electron kur
npm install electron --save-dev

# 4. Electron Builder kur (paketleme için)
npm install electron-builder --save-dev
```

### Electron Ana Dosyası (main.js)

```javascript
const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

let controlWindow;
let prompterWindow;

function createControlWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    
    controlWindow = new BrowserWindow({
        width: primaryDisplay.workAreaSize.width,
        height: primaryDisplay.workAreaSize.height,
        x: primaryDisplay.bounds.x,
        y: primaryDisplay.bounds.y,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: 'QR Production Prompter',
        icon: path.join(__dirname, 'icon.png'),
    });

    controlWindow.loadFile('index.html');
    controlWindow.setMenu(null);
}

function createPrompterWindow() {
    const displays = screen.getAllDisplays();
    const secondDisplay = displays.find(d => d.id !== screen.getPrimaryDisplay().id);
    
    const targetDisplay = secondDisplay || screen.getPrimaryDisplay();
    
    prompterWindow = new BrowserWindow({
        width: targetDisplay.workAreaSize.width,
        height: targetDisplay.workAreaSize.height,
        x: targetDisplay.bounds.x,
        y: targetDisplay.bounds.y,
        fullscreen: true,
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: 'QR Production Prompter - Display',
    });

    prompterWindow.loadFile('prompter.html');
    prompterWindow.setMenu(null);
}

app.whenReady().then(createControlWindow);

app.on('window-all-closed', () => {
    app.quit();
});

// IPC ile kontrol panelinden prompter açma komutu geldiğinde
// electron düzeyinde ikinci pencere açılacak
```

### package.json Ayarları

```json
{
    "name": "qr-production-prompter",
    "version": "1.0.0",
    "description": "QR Production AI Prompter - Profesyonel Sahne Prompter Sistemi",
    "main": "main.js",
    "scripts": {
        "start": "electron .",
        "build-win": "electron-builder --win",
        "build-mac": "electron-builder --mac"
    },
    "build": {
        "appId": "com.qrproduction.prompter",
        "productName": "QR Production Prompter",
        "win": {
            "target": "nsis",
            "icon": "icon.ico"
        },
        "mac": {
            "target": "dmg",
            "icon": "icon.icns"
        },
        "files": [
            "main.js",
            "index.html",
            "prompter.html",
            "css/**",
            "js/**",
            "data/**"
        ]
    }
}
```

### Paketleme Komutları

```bash
# Windows .exe oluştur
npm run build-win

# macOS .dmg oluştur (sadece Mac'te)
npm run build-mac
```

## Electron Avantajları
- Gerçek çift ekran algılama (`screen.getAllDisplays()`)
- Otomatik tam ekran ikinci monitörde
- Masaüstü uygulaması olarak çalışır
- Popup engelleyici sorunu olmaz
- Dosya sistemi erişimi (otomatik yedekleme)
- Otomatik güncelleme desteği eklenebilir

## Gelecek Geliştirmeler (Yol Haritası)
1. Electron paketleme ile masaüstü uygulaması
2. QR Production AI asistanı (setlist önerisi, ton kontrolü)
3. MIDI entegrasyonu (sahne ışık kontrolü ile senkronizasyon)
4. Uzaktan kontrol (tablet/telefon ile)
5. Çoklu sanatçı profili desteği
6. Bulut yedekleme
7. PDF otomatik import (şarkı sözü çıkarma)
8. Setlist paylaşımı (ekip içi)
