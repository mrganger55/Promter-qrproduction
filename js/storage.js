// ============================================================
//  QR Production Prompter — Storage Adapter (Backup)
//  it.17.6
//  Web modu: FileSystemDirectoryHandle + IndexedDB persist
//  Electron modu: window.electronAPI.fs.* (gelecek; şu an stub)
// ============================================================
(function (window) {
    'use strict';

    const DB_NAME = 'qrp-backup';
    const DB_VERSION = 1;
    const STORE_NAME = 'handles';
    const HANDLE_KEY = 'backup-dir';
    const KEEP_SNAPSHOTS = 30;
    const SNAPSHOT_VERSION = 'v17.6';

    let dirHandle = null;

    // window.electronAPI eklendiğinde otomatik geçiş yapılır
    function isElectron() {
        return !!(window.electronAPI && window.electronAPI.fs);
    }

    // ---------- IndexedDB helpers ----------
    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    function idbGet(key) {
        return openDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }));
    }
    function idbSet(key, value) {
        return openDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        }));
    }
    function idbDel(key) {
        return openDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        }));
    }

    // ---------- Helpers ----------
    function pad(n) { return String(n).padStart(2, '0'); }
    function formatStamp(d) {
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
            + '_' + pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds());
    }
    function parseStamp(name) {
        // "2026-04-29_14-32-07.json" → Date
        const m = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.json$/i.exec(name);
        if (!m) return null;
        return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    }
    function formatDateForUI(d) {
        if (!d) return '—';
        return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear()
            + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    async function verifyPermission(handle, mode) {
        const opts = { mode: mode || 'readwrite' };
        try {
            if ((await handle.queryPermission(opts)) === 'granted') return true;
            if ((await handle.requestPermission(opts)) === 'granted') return true;
        } catch (_) {}
        return false;
    }

    // ---------- Browser implementation (FSA) ----------
    const Browser = {
        async init() {
            // Açılışta otomatik bağlanma — kayıtlı handle varsa permission'ı doğrula.
            // İlk gesture'a kadar requestPermission çağrılmamalı; sadece queryPermission.
            try {
                const stored = await idbGet(HANDLE_KEY);
                if (!stored) return false;
                const opts = { mode: 'readwrite' };
                const status = await stored.queryPermission(opts);
                if (status === 'granted') {
                    dirHandle = stored;
                    return true;
                }
                // 'prompt' veya 'denied' — kullanıcı eyleminde tekrar dene
                return false;
            } catch (e) {
                console.warn('[Backup] init failed:', e);
                return false;
            }
        },

        // Kayıtlı handle var ama permission düştü → user gesture içinde tekrar iste
        async resumePermission() {
            try {
                const stored = await idbGet(HANDLE_KEY);
                if (!stored) return false;
                if (await verifyPermission(stored, 'readwrite')) {
                    dirHandle = stored;
                    return true;
                }
                return false;
            } catch (e) { return false; }
        },

        async connect() {
            if (!window.showDirectoryPicker) {
                throw new Error('Bu tarayıcı klasör seçmeyi (FSA) desteklemiyor. Chrome veya Edge kullan.');
            }
            const picked = await window.showDirectoryPicker({
                id: 'qrp-backup-dir',
                mode: 'readwrite',
                startIn: 'documents'
            });
            // Kullanıcı proje klasörünü seçtiyse içinde "Backup" alt klasörü oluşturalım/kullanalım
            // "Backup" klasörünü doğrudan seçtiyse onu kullan
            let target;
            if (picked.name === 'Backup') {
                target = picked;
            } else {
                try {
                    target = await picked.getDirectoryHandle('Backup', { create: true });
                } catch (e) {
                    target = picked; // create yapılamadıysa olduğu klasörü kullan
                }
            }
            await idbSet(HANDLE_KEY, target);
            dirHandle = target;
            return true;
        },

        async disconnect() {
            await idbDel(HANDLE_KEY);
            dirHandle = null;
        },

        isConnected() { return !!dirHandle; },

        getHandle() { return dirHandle; },

        async saveSnapshot(payload, trigger) {
            if (!dirHandle) throw new Error('Backup klasörü bağlı değil.');
            const now = new Date();
            const name = formatStamp(now) + '.json';
            const body = {
                version: SNAPSHOT_VERSION,
                savedAt: now.toISOString(),
                trigger: trigger || 'manual',
                ...payload,
            };
            const fileHandle = await dirHandle.getFileHandle(name, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(body, null, 2));
            await writable.close();
            return name;
        },

        async listSnapshots() {
            if (!dirHandle) return [];
            const list = [];
            for await (const [name, h] of dirHandle.entries()) {
                if (h.kind !== 'file') continue;
                if (!/\.json$/i.test(name)) continue;
                const d = parseStamp(name);
                let size = 0;
                try { const f = await h.getFile(); size = f.size; } catch (_) {}
                list.push({ name, date: d, size });
            }
            // Eski → yeni sıralama (lex sort, ISO-like timestamp)
            list.sort((a, b) => a.name.localeCompare(b.name));
            return list;
        },

        async loadSnapshot(name) {
            if (!dirHandle) throw new Error('Backup klasörü bağlı değil.');
            const fileHandle = await dirHandle.getFileHandle(name, { create: false });
            const file = await fileHandle.getFile();
            const text = await file.text();
            return JSON.parse(text);
        },

        async loadLatestSnapshot() {
            const list = await this.listSnapshots();
            if (!list.length) return null;
            return await this.loadSnapshot(list[list.length - 1].name);
        },

        async deleteSnapshot(name) {
            if (!dirHandle) return;
            await dirHandle.removeEntry(name);
        },

        // autoSave snapshot'ları için 30 limit; manuel/newWorkspace dışında kalanları sil
        async pruneOld(keep) {
            keep = keep || KEEP_SNAPSHOTS;
            const list = await this.listSnapshots();
            if (list.length <= keep) return 0;
            const toDel = list.slice(0, list.length - keep).map(s => s.name);
            let n = 0;
            for (const name of toDel) {
                try { await dirHandle.removeEntry(name); n++; } catch (_) {}
            }
            return n;
        }
    };

    // ---------- Electron stub (it.18'de doldurulacak) ----------
    // window.electronAPI.fs şu sözleşmeyi sağlamalı:
    //   list() → Promise<{name,date,size}[]>
    //   save(name, json) → Promise<void>
    //   load(name) → Promise<json>
    //   remove(name) → Promise<void>
    const Electron = {
        async init() { return isElectron(); },
        async resumePermission() { return isElectron(); },
        async connect() { /* otomatik */ return isElectron(); },
        async disconnect() { /* no-op */ },
        isConnected() { return isElectron(); },
        getHandle() { return null; },
        async saveSnapshot(payload, trigger) {
            const now = new Date();
            const name = formatStamp(now) + '.json';
            const body = { version: SNAPSHOT_VERSION, savedAt: now.toISOString(), trigger: trigger || 'manual', ...payload };
            await window.electronAPI.fs.save(name, JSON.stringify(body, null, 2));
            return name;
        },
        async listSnapshots() { return await window.electronAPI.fs.list(); },
        async loadSnapshot(name) { return JSON.parse(await window.electronAPI.fs.load(name)); },
        async loadLatestSnapshot() {
            const list = await this.listSnapshots();
            if (!list.length) return null;
            return await this.loadSnapshot(list[list.length - 1].name);
        },
        async deleteSnapshot(name) { return await window.electronAPI.fs.remove(name); },
        async pruneOld(keep) {
            keep = keep || KEEP_SNAPSHOTS;
            const list = await this.listSnapshots();
            if (list.length <= keep) return 0;
            const toDel = list.slice(0, list.length - keep);
            for (const s of toDel) await window.electronAPI.fs.remove(s.name);
            return toDel.length;
        }
    };

    // ---------- Public API ----------
    window.QRBackup = {
        get adapter() { return isElectron() ? Electron : Browser; },
        isElectron,
        formatStamp,
        formatDateForUI,
        parseStamp,
        SNAPSHOT_VERSION,
        // Facade — adapter çağrılarını proxy'ler
        init()                  { return this.adapter.init(); },
        resumePermission()      { return this.adapter.resumePermission(); },
        connect()               { return this.adapter.connect(); },
        disconnect()            { return this.adapter.disconnect(); },
        isConnected()           { return this.adapter.isConnected(); },
        saveSnapshot(p, t)      { return this.adapter.saveSnapshot(p, t); },
        listSnapshots()         { return this.adapter.listSnapshots(); },
        loadSnapshot(n)         { return this.adapter.loadSnapshot(n); },
        loadLatestSnapshot()    { return this.adapter.loadLatestSnapshot(); },
        deleteSnapshot(n)       { return this.adapter.deleteSnapshot(n); },
        pruneOld(k)             { return this.adapter.pruneOld(k); },
    };

})(window);
