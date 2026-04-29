const { app, BrowserWindow, screen, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');

let controlWindow = null;
let prompterWindow = null;

// it.19: Backup klasörü — platform-spesifik
//   - Mac:  ~/Documents/QR Prompter Backup/   (Finder'dan görünür, code-sign sonrası yazılabilir)
//   - Win:  <exe yanı>\Backup\                  (taşınabilir kalsın)
//   - Geliştirme (her ikisi): <proje>/Backup/
function getBackupDir() {
    let dir;
    if (process.platform === 'darwin') {
        // macOS: kullanıcının Documents klasörü içinde
        dir = path.join(app.getPath('documents'), 'QR Prompter Backup');
    } else if (app.isPackaged) {
        // Windows packaged: exe yanı (taşınabilir)
        dir = path.join(path.dirname(app.getPath('exe')), 'Backup');
    } else {
        // Geliştirme (her platform): proje kökü
        dir = path.join(app.getAppPath(), 'Backup');
    }
    try {
        if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
    } catch (e) {
        console.warn('[Backup] mkdir failed:', e);
    }
    return dir;
}

// IPC: Backup
ipcMain.handle('backup:path', async () => getBackupDir());

ipcMain.handle('backup:list', async () => {
    const dir = getBackupDir();
    try {
        const names = await fs.readdir(dir);
        const out = [];
        for (const name of names) {
            if (!/\.json$/i.test(name)) continue;
            const m = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.json$/i.exec(name);
            const date = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
            let size = 0;
            try { size = (await fs.stat(path.join(dir, name))).size; } catch (_) {}
            out.push({ name, date, size });
        }
        out.sort((a, b) => a.name.localeCompare(b.name));
        return out;
    } catch (e) {
        console.warn('[Backup] list failed:', e);
        return [];
    }
});

ipcMain.handle('backup:save', async (_e, name, jsonStr) => {
    const dir = getBackupDir();
    if (!/^[\w\-.]+\.json$/i.test(name)) throw new Error('Invalid backup file name');
    await fs.writeFile(path.join(dir, name), jsonStr, 'utf8');
    return name;
});

ipcMain.handle('backup:load', async (_e, name) => {
    const dir = getBackupDir();
    if (!/^[\w\-.]+\.json$/i.test(name)) throw new Error('Invalid backup file name');
    return await fs.readFile(path.join(dir, name), 'utf8');
});

ipcMain.handle('backup:remove', async (_e, name) => {
    const dir = getBackupDir();
    if (!/^[\w\-.]+\.json$/i.test(name)) throw new Error('Invalid backup file name');
    try { await fs.unlink(path.join(dir, name)); } catch (_) {}
    return true;
});

function getSecondDisplay() {
    const displays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    return displays.find(d => d.id !== primary.id) || null;
}

function createControlWindow() {
    const primary = screen.getPrimaryDisplay();
    const { width, height } = primary.workAreaSize;

    controlWindow = new BrowserWindow({
        width: Math.min(width, 1600),
        height: Math.min(height, 1000),
        x: primary.bounds.x + 40,
        y: primary.bounds.y + 40,
        backgroundColor: '#0f0f16',
        title: 'QR Production Prompter',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            spellcheck: false,
            preload: path.join(__dirname, 'js', 'preload.js'),
        },
    });

    controlWindow.loadFile('index.html');
    controlWindow.setMenu(null);

    // window.open('prompter.html...') → Electron new BrowserWindow
    controlWindow.webContents.setWindowOpenHandler(({ url, features }) => {
        if (!/prompter\.html/i.test(url)) {
            return { action: 'deny' };
        }

        const second = getSecondDisplay();
        const target = second || screen.getPrimaryDisplay();
        const b = target.bounds;

        return {
            action: 'allow',
            overrideBrowserWindowOptions: {
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height,
                fullscreen: !!second,
                frame: !second,
                backgroundColor: '#000000',
                title: 'QR Prompter — Sanatçı Ekranı',
                autoHideMenuBar: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    spellcheck: false,
                },
            },
        };
    });

    // Harici http(s) linkleri varsayılan tarayıcıda aç
    controlWindow.webContents.on('will-navigate', (e, url) => {
        if (!url.startsWith('file://')) {
            e.preventDefault();
            shell.openExternal(url);
        }
    });

    controlWindow.on('closed', () => {
        controlWindow = null;
    });
}

// Minimal menü — sadece temel kısayollar
function buildMenu() {
    const isMac = process.platform === 'darwin';
    const template = [
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
            ],
        }] : []),
        {
            label: 'Düzenle',
            submenu: [
                { role: 'undo', label: 'Geri Al' },
                { role: 'redo', label: 'İleri Al' },
                { type: 'separator' },
                { role: 'cut', label: 'Kes' },
                { role: 'copy', label: 'Kopyala' },
                { role: 'paste', label: 'Yapıştır' },
                { role: 'selectAll', label: 'Tümünü Seç' },
            ],
        },
        {
            label: 'Görünüm',
            submenu: [
                { role: 'reload', label: 'Yenile' },
                { role: 'forceReload', label: 'Sert Yenile' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Tam Ekran' },
                { role: 'toggleDevTools', label: 'Geliştirici Araçları' },
            ],
        },
    ];
    return Menu.buildFromTemplate(template);
}

app.whenReady().then(() => {
    if (process.platform === 'darwin') {
        Menu.setApplicationMenu(buildMenu());
    } else {
        Menu.setApplicationMenu(null);
    }
    createControlWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
