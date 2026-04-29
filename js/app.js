/* ============================================
   QR Production Prompter — Control Panel
   ============================================
   Workspace-based setlist management system.
   Communicates with prompter via BroadcastChannel.
   ============================================ */
(function () {
    'use strict';

    // ============================================================
    //  STATE
    // ============================================================
    const S = {
        workspaces: {},      // { id: { name, artist, items[] } }
        activeWS: null,      // current workspace id
        idx: -1,             // selected setlist item index
        page: 1,             // current page (from prompter)
        total: 0,            // total pages (from prompter)
        autoOn: false,
        autoIv: null,
        autoSec: 10,
        fontMin: 32,
        fontMax: 72,
        mirror: false,
        sectionClr: true,
        theme: 'dark',
        guide: true,
        guidePos: 38,
        guideW: 2,
        guideColor: 'rgba(99,102,241,0.5)',
        // new persisted settings
        chronoSize: 26,      // footer chrono font-size (px)
        ibSize: 18,          // prompter info bar font-size (px)
        ibOpacity: 90,       // prompter info bar opacity (%)
        ibShowChrono: true,
        msgSize: 1,          // it.17: prompter mesaj boyut çarpanı (1.0–3.0)
        pWin: null,
        connected: false,
        selectedIds: new Set(),  // bulk-selected item IDs
        setlistQ: '',            // setlist search query (canon-ed)
    };

    const ch = new BroadcastChannel('qr-prompter');
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

    // ---- DOM refs ----
    const D = {
        wsSelect: $('#workspaceSelect'), btnNewWS: $('#btnNewWS'), btnDelWS: $('#btnDelWS'),
        liveDot: $('#liveDot'), liveLabel: $('#liveLabel'), liveDetail: $('#liveDetail'),
        btnLaunch: $('#btnLaunch'), launchText: $('#launchText'),
        btnImport: $('#btnImport'), btnExport: $('#btnExport'), fileIn: $('#fileIn'),
        setlistWrap: $('#setlistWrap'),
        setlistSearch: $('#setlistSearch'), setlistSearchClear: $('#setlistSearchClear'),
        btnAddTalk: $('#btnAddTalk'), btnAddBreak: $('#btnAddBreak'),
        bulkBar: $('#bulkBar'), bulkCount: $('#bulkCount'),
        bulkAll: $('#bulkAll'), bulkUp: $('#bulkUp'), bulkDown: $('#bulkDown'),
        bulkDel: $('#bulkDel'), bulkClear: $('#bulkClear'),
        songTitle: $('#songTitle'), songKey: $('#songKey'), sectionType: $('#sectionType'),
        editor: $('#editor'), btnClear: $('#btnClear'), btnSave: $('#btnSave'),
        previewInner: $('#previewInner'), pvInfo: $('#pvInfo'), navCounter: $('#navCounter'),
        navFirst: $('#navFirst'), navPrev: $('#navPrev'), navNext: $('#navNext'), navLast: $('#navLast'),
        trFirst: $('#trFirst'), trPrev: $('#trPrev'), trPlay: $('#trPlay'), trNext: $('#trNext'), trLast: $('#trLast'),
        sliderInterval: $('#sliderInterval'), valInterval: $('#valInterval'),
        sliderFontMin: $('#sliderFontMin'), valFontMin: $('#valFontMin'),
        sliderFontMax: $('#sliderFontMax'), valFontMax: $('#valFontMax'),
        chkGuide: $('#chkGuide'),
        sliderGuidePos: $('#sliderGuidePos'), valGuidePos: $('#valGuidePos'),
        sliderGuideW: $('#sliderGuideW'), valGuideW: $('#valGuideW'),
        guideColors: $('#guideColors'),
        chkMirror: $('#chkMirror'), chkSectionClr: $('#chkSectionClr'),
        cdSec: $('#cdSec'), btnCD: $('#btnCD'),
        msgInput: $('#msgInput'), msgStatus: $('#msgStatus'), btnSendMsg: $('#btnSendMsg'), btnClearMsg: $('#btnClearMsg'),
        btnFlashMsg: $('#btnFlashMsg'), msgSize: $('#msgSize'), msgSizeVal: $('#msgSizeVal'),
        // it.17.6 Backup
        btnBackupSave: $('#btnBackupSave'), btnBackupList: $('#btnBackupList'), backupStatus: $('#backupStatus'),
        backupModal: $('#backupModal'), btnBackupClose: $('#btnBackupClose'),
        btnBackupConnect: $('#btnBackupConnect'), btnBackupSaveNow: $('#btnBackupSaveNow'),
        btnBackupRefresh: $('#btnBackupRefresh'), backupInfo: $('#backupInfo'), backupList: $('#backupList'),
        chronoTime: $('#chronoTime'), chStart: $('#chStart'), chStop: $('#chStop'), chReset: $('#chReset'), chLap: $('#chLap'), laps: $('#laps'),
        btnLibrary: $('#btnLibrary'), libOverlay: $('#libOverlay'), libClose: $('#libClose'),
        libSearch: $('#libSearch'), libList: $('#libList'), libCount: $('#libCount'), libAddAll: $('#libAddAll'),
        libSaveDisk: $('#libSaveDisk'), libPendingBadge: $('#libPendingBadge'),
        btnPageBreak: $('#btnPageBreak'),
        sliderChronoSize: $('#sliderChronoSize'), valChronoSize: $('#valChronoSize'),
        sliderIbSize: $('#sliderIbSize'), valIbSize: $('#valIbSize'),
        sliderIbOpacity: $('#sliderIbOpacity'), valIbOpacity: $('#valIbOpacity'),
        chkIbChrono: $('#chkIbChrono'),
        chrono: document.querySelector('.chrono'),
        nextInfo: $('#nextInfo'), nextTitle: $('#nextTitle'), nextKey: $('#nextKey'),
    };

    // ---- Utils ----
    function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }
    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function cntLines(t) { return t ? t.split('\n').filter(l => l.trim()).length : 0; }

    // ============================================================
    //  CHRONOMETER
    // ============================================================
    const CR = { on: false, t0: 0, el: 0, raf: null, laps: [] };

    function crRender() {
        const ms = CR.el;
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        const ml = ms % 1000;
        D.chronoTime.innerHTML =
            `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}<span class="chrono-ms">.${String(ml).padStart(3,'0')}</span>`;
        // Sync to prompter
        if (S.connected) send('chronoSync', { elapsed: CR.el, running: CR.on });
    }

    function crTick() {
        if (!CR.on) return;
        CR.el = Date.now() - CR.t0;
        crRender();
        CR.raf = requestAnimationFrame(crTick);
    }

    D.chStart.onclick = () => {
        if (CR.on) return;
        CR.on = true; CR.t0 = Date.now() - CR.el; crTick();
        D.chStart.disabled = true; D.chStart.classList.add('on');
        D.chStop.disabled = false; D.chLap.disabled = false;
    };
    D.chStop.onclick = () => {
        CR.on = false; cancelAnimationFrame(CR.raf);
        D.chStart.disabled = false; D.chStart.classList.remove('on');
        D.chStop.disabled = true; D.chLap.disabled = true;
        crRender();
    };
    D.chReset.onclick = () => {
        CR.on = false; cancelAnimationFrame(CR.raf);
        CR.el = 0; CR.laps = [];
        crRender(); D.laps.innerHTML = '';
        D.chStart.disabled = false; D.chStart.classList.remove('on');
        D.chStop.disabled = true; D.chLap.disabled = true;
    };
    D.chLap.onclick = () => {
        if (!CR.on) return;
        CR.laps.push(CR.el);
        const m = Math.floor((CR.el % 3600000) / 60000);
        const s = Math.floor((CR.el % 60000) / 1000);
        const ml = Math.floor((CR.el % 1000) / 10);
        const tag = document.createElement('span');
        tag.className = 'lap-tag';
        tag.textContent = `L${CR.laps.length} ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ml).padStart(2,'0')}`;
        D.laps.appendChild(tag);
        D.laps.scrollLeft = D.laps.scrollWidth;
    };
    crRender();

    // ============================================================
    //  WORKSPACE SYSTEM
    // ============================================================
    const STORAGE_KEY = 'qrp-workspaces';
    const ACTIVE_KEY = 'qrp-active-ws';
    const SETTINGS_KEY = 'qrp-settings';
    const APP_VERSION_KEY = 'qrp-app-version';
    const BUNDLE_TIME_KEY = 'qrp-bundle-build-time';
    const SESSION_KEY = 'qrp-session';
    const APP_VERSION = 'v14';

    const SETTING_FIELDS = [
        'autoSec', 'fontMin', 'fontMax', 'mirror', 'sectionClr', 'theme',
        'guide', 'guidePos', 'guideW', 'guideColor',
        'chronoSize', 'ibSize', 'ibOpacity', 'ibShowChrono',
        'msgSize',
    ];

    function saveSettings() {
        const obj = {};
        for (const k of SETTING_FIELDS) obj[k] = S[k];
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj));
    }

    function loadSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (!raw) return;
            const obj = JSON.parse(raw);
            for (const k of SETTING_FIELDS) {
                if (obj[k] !== undefined) S[k] = obj[k];
            }
        } catch (_) { /* ignore */ }
    }

    function saveAll() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(S.workspaces));
        localStorage.setItem(ACTIVE_KEY, S.activeWS);
        // it.17.6: debounced disk yedeği
        if (typeof scheduleBackup === 'function') scheduleBackup('autoSave', 5000);
    }

    function loadAll() {
        // Version check: if app version changed, wipe workspace/library caches so
        // new bundle-driven defaults take effect.
        const storedVersion = localStorage.getItem(APP_VERSION_KEY);
        if (storedVersion !== APP_VERSION) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(ACTIVE_KEY);
            localStorage.removeItem('qrp-lib-ws-created');
            localStorage.removeItem('qrp-lib-overrides');
            localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
            console.log('[QR Prompter] App upgraded to', APP_VERSION, '— defaults reset');
        }

        try { S.workspaces = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { S.workspaces = {}; }
        S.activeWS = localStorage.getItem(ACTIVE_KEY);

        if (Object.keys(S.workspaces).length === 0) {
            createDefaultWorkspaces();
        } else {
            syncNewSetlistsFromBundle();
        }

        if (!S.activeWS || !S.workspaces[S.activeWS]) {
            S.activeWS = Object.keys(S.workspaces)[0];
        }

        // Store bundle buildTime so future upgrades can detect
        const bt = (window.SONGS_BUNDLE && window.SONGS_BUNDLE.buildTime) || '';
        if (bt) {
            localStorage.setItem(BUNDLE_TIME_KEY, bt);
            console.log('[QR Prompter] Bundle buildTime:', bt);
        }
    }

    // Restore session (selected item, current page, chrono state)
    function loadSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return;
            const obj = JSON.parse(raw);
            if (typeof obj.idx === 'number') S.idx = obj.idx;
            if (typeof obj.page === 'number') S.page = obj.page;
            if (obj.chrono) {
                CR.el = obj.chrono.elapsed || 0;
                // Do NOT auto-resume running chrono on reload — start in paused state
            }
            if (obj.selectedScreen) S.selectedScreen = obj.selectedScreen;
        } catch (_) { /* ignore */ }
    }

    function saveSession() {
        const obj = {
            idx: S.idx,
            page: S.page,
            chrono: { elapsed: CR.el, running: false },
            selectedScreen: S.selectedScreen || null,
        };
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(obj)); } catch (_) {}
    }

    let _sessionTimer = null;
    function scheduleSessionSave() {
        clearTimeout(_sessionTimer);
        _sessionTimer = setTimeout(saveSession, 800);
    }

    // Bundle-driven default workspaces — reads from window.SONGS_BUNDLE.setlists
    // Each setlist TXT in "EBD Setlist/" becomes a workspace.
    function createDefaultWorkspaces() {
        const bundle = window.SONGS_BUNDLE;
        const setlists = (bundle && Array.isArray(bundle.setlists)) ? bundle.setlists : [];

        if (setlists.length === 0) {
            // Fallback: empty workspace so user has something to edit
            const wsId = uid();
            S.workspaces[wsId] = { name: 'Yeni Setlist', artist: 'Elif Buse Doğan', items: [] };
            S.activeWS = wsId;
            saveAll();
            return;
        }

        let firstWsId = null;
        for (const sl of setlists) {
            const wsId = uid();
            const items = (sl.items || []).map(it => ({
                id: uid(),
                type: it.type || 'song',
                title: it.title || '',
                key: it.key || '',
                text: it.note ? `[NOTE]\n${it.note}\n` : '',
                note: it.note || '',
                _setlistFile: sl.filename,
            }));
            S.workspaces[wsId] = {
                name: sl.name || sl.filename || 'Setlist',
                artist: sl.artist || '',
                items,
                _setlistFile: sl.filename,
            };
            if (!firstWsId) firstWsId = wsId;
        }
        S.activeWS = firstWsId;
        saveAll();
    }

    // Non-destructive: add bundle setlists that don't yet have a workspace (matched by _setlistFile).
    // Existing workspaces and their edits are never touched.
    function syncNewSetlistsFromBundle() {
        const bundle = window.SONGS_BUNDLE;
        const setlists = (bundle && Array.isArray(bundle.setlists)) ? bundle.setlists : [];
        if (setlists.length === 0) return;
        const existingFiles = new Set(
            Object.values(S.workspaces).map(ws => ws && ws._setlistFile).filter(Boolean)
        );
        let added = 0;
        for (const sl of setlists) {
            if (!sl.filename || existingFiles.has(sl.filename)) continue;
            const wsId = uid();
            const items = (sl.items || []).map(it => ({
                id: uid(),
                type: it.type || 'song',
                title: it.title || '',
                key: it.key || '',
                text: it.note ? `[NOTE]\n${it.note}\n` : '',
                note: it.note || '',
                _setlistFile: sl.filename,
            }));
            S.workspaces[wsId] = {
                name: sl.name || sl.filename || 'Setlist',
                artist: sl.artist || '',
                items,
                _setlistFile: sl.filename,
            };
            added++;
        }
        if (added > 0) {
            saveAll();
            console.log(`[QR Prompter] ${added} new setlist(s) synced from bundle`);
        }
    }

    // Song lyrics & tones databases (filled from bundle/manifest)
    const LYRICS_DB = {};
    const TONES_DB = {};

    // Load lyrics + tones databases
    function loadLyricsDB() {
        // Prefer inline bundle (works on file://). Fall back to fetch.
        const bundle = window.SONGS_BUNDLE || null;
        const manifestFromBundle = bundle ? { count: bundle.count, songs: bundle.songs } : null;
        if (bundle && bundle.texts) {
            for (const [fn, txt] of Object.entries(bundle.texts)) LIB.texts[fn] = txt;
        }

        const safeFetch = url => {
            try { return fetch(url).then(r => r.ok ? r.json() : null).catch(() => null); }
            catch (_) { return Promise.resolve(null); }
        };

        const songsDBFromBundle = bundle && bundle.songsDB && Object.keys(bundle.songsDB).length ? bundle.songsDB : null;
        const tonesFromBundle = bundle && bundle.tones && Object.keys(bundle.tones).length ? bundle.tones : null;

        Promise.all([
            manifestFromBundle ? Promise.resolve(manifestFromBundle) : safeFetch('data/songs-manifest.json'),
            songsDBFromBundle ? Promise.resolve(songsDBFromBundle) : safeFetch('data/songs-db.json'),
            safeFetch('data/songs-raw.json'),
            tonesFromBundle ? Promise.resolve(tonesFromBundle) : safeFetch('data/tones-db.json'),
        ]).then(([manifest, songsDB, songsRaw, tonesDB]) => {
            if (songsDB) {
                for (const [key, val] of Object.entries(songsDB)) {
                    LYRICS_DB[key.toUpperCase().trim()] = typeof val === 'object' ? val.lyrics : val;
                }
            }
            if (songsRaw) {
                for (const [key, val] of Object.entries(songsRaw)) {
                    const k = key.toUpperCase().trim();
                    if (!LYRICS_DB[k]) LYRICS_DB[k] = val;
                }
            }
            if (tonesDB) {
                for (const [key, val] of Object.entries(tonesDB)) {
                    TONES_DB[key.toUpperCase().trim()] = val;
                }
            }
            // Library from manifest (txt files)
            if (manifest && Array.isArray(manifest.songs)) {
                LIB.songs = manifest.songs.slice();
                loadUserLibSongs();
                renderLibrary();
                preloadLibraryTexts();
                // Tag existing workspace items with library filenames so edits persist
                migrateItemsToLibFiles();
                // One-time: create a "Tüm Şarkılar" workspace auto-filled from manifest
                ensureLibraryWorkspace();
            }
            populateLyrics();
        });
    }

    const LIB_WS_MARKER = 'lib_auto_v1';

    function ensureLibraryWorkspace() {
        // Only create once — marker in localStorage
        if (localStorage.getItem('qrp-lib-ws-created') === LIB_WS_MARKER) return;
        if (!LIB.songs.length) return;

        const wsId = uid();
        const items = LIB.songs.map(s => ({
            id: uid(),
            type: 'song',
            title: s.title.toUpperCase(),
            key: findTone(s.title) || '',
            text: getLibText(s.filename),  // prefers override, falls back to bundle text
            _libFile: s.filename,
        }));

        S.workspaces[wsId] = {
            name: '📚 Tüm Şarkılar (Kütüphane)',
            artist: 'Elif Buse Doğan',
            items,
        };
        localStorage.setItem('qrp-lib-ws-created', LIB_WS_MARKER);
        saveAll();
        renderWSSelect();

        // Fill in lyrics asynchronously as TXT files load (fetch path — not needed with bundle)
        const ws = S.workspaces[wsId];
        Promise.all(LIB.songs.map(s =>
            fetchLibText(s.filename).then(txt => ({ filename: s.filename, txt }))
        )).then(results => {
            const byFile = {};
            results.forEach(r => byFile[r.filename] = r.txt);
            ws.items.forEach(it => {
                if (it._libFile && byFile[it._libFile] && !it.text) {
                    it.text = byFile[it._libFile];
                }
            });
            saveAll();
            if (S.activeWS === wsId) renderSL();
        });
    }

    // Migrate existing workspaces: match items to library filenames so edits sync to override.
    // Runs once per session — safe to call multiple times (idempotent).
    function migrateItemsToLibFiles() {
        if (!LIB.songs.length) return;
        const byCanon = {};
        LIB.songs.forEach(s => { byCanon[canon(s.title)] = s.filename; });
        let changed = false;
        for (const ws of Object.values(S.workspaces)) {
            for (const it of ws.items) {
                if (it.type !== 'song' || it._libFile) continue;
                const fn = byCanon[canon(it.title)];
                if (fn) { it._libFile = fn; changed = true; }
            }
        }
        if (changed) saveAll();
    }

    // ============================================================
    //  SONG LIBRARY (PDF-extracted TXT files)
    // ============================================================
    const LIB = { songs: [], texts: {}, loaded: new Set(), overrides: {} };
    const LIB_OVERRIDES_KEY = 'qrp-lib-overrides';

    function loadLibOverrides() {
        try {
            LIB.overrides = JSON.parse(localStorage.getItem(LIB_OVERRIDES_KEY) || '{}') || {};
        } catch (_) { LIB.overrides = {}; }
    }

    function saveLibOverrides() {
        localStorage.setItem(LIB_OVERRIDES_KEY, JSON.stringify(LIB.overrides));
        // Keep the library modal's pending-badge in sync if open
        if (typeof updatePendingBadge === 'function') updatePendingBadge();
    }

    // Return the effective text for a library file (override > bundle/fetched)
    function getLibText(filename) {
        if (!filename) return '';
        if (LIB.overrides[filename] !== undefined) return LIB.overrides[filename];
        return LIB.texts[filename] || '';
    }

    // Record a user-edited version of a library song (e.g. with --- page breaks)
    function setLibOverride(filename, text) {
        if (!filename) return;
        const src = LIB.texts[filename] || '';
        // If text equals source, clear override (cleanup)
        if (text === src) {
            if (filename in LIB.overrides) {
                delete LIB.overrides[filename];
                saveLibOverrides();
            }
            return;
        }
        if (LIB.overrides[filename] !== text) {
            LIB.overrides[filename] = text;
            saveLibOverrides();
        }
    }

    // Canonicalize a title for matching (upper, strip punctuation/spaces)
    function canon(s) {
        return (s || '').toUpperCase()
            .replace(/['’""`\-\.\,\+]/g, ' ')
            .replace(/\s+/g, ' ').trim();
    }

    // Returns override-first effective text. Used when adding songs to setlists.
    function fetchLibText(filename) {
        // Prefer user's override if present
        if (LIB.overrides[filename] !== undefined) return Promise.resolve(LIB.overrides[filename]);
        if (LIB.texts[filename]) return Promise.resolve(LIB.texts[filename]);
        if (window.SONGS_BUNDLE) return Promise.resolve(LIB.texts[filename] || '');
        const url = encodeURIComponent('Şarkılar TXT') + '/' + encodeURIComponent(filename);
        return fetch(url)
            .then(r => r.ok ? r.text() : '')
            .then(txt => { LIB.texts[filename] = txt; return txt; })
            .catch(() => '');
    }

    function preloadLibraryTexts() {
        // Preload each TXT, index into LYRICS_DB so empty items auto-fill.
        // After all resolve, re-run populateLyrics to backfill pre-existing workspaces.
        const ps = LIB.songs.map(s =>
            fetchLibText(s.filename).then(txt => {
                if (!txt) return;
                const key = canon(s.title);
                if (!LYRICS_DB[key]) LYRICS_DB[key] = txt;
                const first = (txt.split('\n')[0] || '').trim();
                if (first) {
                    const k2 = canon(first);
                    if (!LYRICS_DB[k2]) LYRICS_DB[k2] = txt;
                }
            })
        );
        Promise.all(ps).then(() => populateLyrics());
    }

    // ============================================================
    //  LIBRARY — TABLE + EDITOR
    // ============================================================
    const LIB_USER_SONGS_KEY = 'qrp-lib-user-songs';
    let libMode = 'table';        // 'table' | 'edit'
    let libEditingFile = null;    // filename being edited, null = new song

    function loadUserLibSongs() {
        try {
            const raw = localStorage.getItem(LIB_USER_SONGS_KEY);
            if (!raw) return;
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return;
            arr.forEach(s => {
                if (s && s.filename && !LIB.songs.some(x => x.filename === s.filename)) {
                    LIB.songs.push(Object.assign({ _user: true }, s));
                }
            });
            LIB.songs.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'tr'));
        } catch (_) {}
    }

    function saveUserLibSongs() {
        const userSongs = LIB.songs.filter(s => s._user).map(s => ({
            title: s.title, filename: s.filename, key: s.key || '',
            lines: s.lines || 0, chars: s.chars || 0, pageCount: s.pageCount || 1,
            _user: true,
        }));
        localStorage.setItem(LIB_USER_SONGS_KEY, JSON.stringify(userSongs));
    }

    const TR_SLUG_MAP = {
        'Ç':'c','Ğ':'g','İ':'i','I':'i','Ö':'o','Ş':'s','Ü':'u',
        'ç':'c','ğ':'g','ı':'i','i':'i','ö':'o','ş':'s','ü':'u',
        'Â':'a','Î':'i','Û':'u','â':'a','î':'i','û':'u',
    };
    function libSlugify(s) {
        let out = '';
        for (const ch of (s || '').trim()) {
            out += (TR_SLUG_MAP[ch] !== undefined) ? TR_SLUG_MAP[ch] : ch;
        }
        out = out.toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_\-]/g, '')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
        return out || 'untitled';
    }

    function trUpper(s) { return (s || '').toLocaleUpperCase('tr-TR'); }

    function renderLibrary() {
        if (!D.libList) return;
        renderLibTable();
        renderLibEditor();
    }

    function renderLibTable() {
        const hint = document.getElementById('libHint');
        if (hint) hint.textContent = 'Satıra tıkla → setliste ekle · ✏ düzenle · 🗑 kullanıcı şarkısı sil';

        const q = canon(D.libSearch.value || '');
        const filtered = q ? LIB.songs.filter(s => canon(s.title).includes(q)) : LIB.songs;

        const userCount = LIB.songs.filter(s => s._user).length;
        D.libCount.textContent = `${LIB.songs.length} şarkı${userCount ? ' · ' + userCount + ' özel' : ''}`;

        if (!LIB.songs.length) {
            D.libList.innerHTML = `<div class="lib-empty">
                Kütüphane yüklenemedi.<br><br>
                Sayfayı <code>http://</code> üzerinden aç (BAŞLAT.bat).<br>
                Veya <button class="btn btn-sm btn-accent" id="libNewFirstSong">➕ Yeni Şarkı</button> ile başla.
            </div>`;
            const b = document.getElementById('libNewFirstSong');
            if (b) b.onclick = () => newSongEditor();
            return;
        }

        if (!filtered.length) {
            D.libList.innerHTML = '<div class="lib-empty">Arama sonucu bulunamadı.</div>';
            return;
        }

        const ws = getWS();
        const inSet = new Set(ws ? ws.items.map(it => canon(it.title)) : []);

        const rows = filtered.map(s => {
            const added = inSet.has(canon(s.title)) ? 'added' : '';
            const edited = (s.filename in LIB.overrides) ? 'edited' : '';
            const user = s._user ? 'user-added' : '';
            const selected = (libEditingFile === s.filename) ? 'selected' : '';
            const addedMark = added ? '<span class="lib-row-added" title="Setlistte">✓</span>' : '';
            return `<div class="lib-row ${added} ${edited} ${user} ${selected}" data-file="${esc(s.filename)}" data-title="${esc(s.title)}">
                ${addedMark}<span class="lib-row-title">${esc(s.title)}</span>
                <span class="lib-row-key">${esc(s.key || '—')}</span>
                <span class="lib-row-acts">
                    <button class="lib-act lib-act-edit" data-act="edit" title="Düzenle">✏</button>
                    ${s._user ? '<button class="lib-act lib-act-del" data-act="del" title="Sil">🗑</button>' : ''}
                </span>
            </div>`;
        }).join('');

        D.libList.innerHTML = `<div class="lib-vlist">${rows}</div>`;

        D.libList.querySelectorAll('.lib-row').forEach(row => {
            row.onclick = (e) => {
                const act = e.target.closest('[data-act]');
                if (act) {
                    e.stopPropagation();
                    const which = act.dataset.act;
                    if (which === 'edit') openSongEditor(row.dataset.file);
                    else if (which === 'del') {
                        if (confirm('Bu özel şarkı silinsin mi?')) {
                            deleteSongFromLib(row.dataset.file);
                            renderLibrary();
                        }
                    }
                    return;
                }
                // Default row click: add to setlist
                addLibSong(row.dataset.file, row.dataset.title);
            };
        });
    }

    function renderLibEditor() {
        const libEditor = document.getElementById('libEditor');
        if (!libEditor) return;

        const filename = libEditingFile;
        const isNew = (libMode === 'edit' && !filename);

        // Empty state: hiçbir şarkı seçili değil ve yeni ekleme modu da değil
        if (!filename && !isNew) {
            libEditor.innerHTML = `
                <div class="le-empty">
                    <div class="le-empty-ico">🎵</div>
                    <div>Düzenlemek için soldan bir şarkı seçin</div>
                    <div class="le-empty-hint">
                        Satır tıklaması → setliste ekler. <br>
                        <code>✏</code> simgesine tıkla → burada sağda düzenle. <br>
                        Yeni şarkı için üstteki <code>➕ Yeni Şarkı</code>.
                    </div>
                </div>
            `;
            return;
        }

        let song = null;
        let bodyText = '';
        if (filename) {
            song = LIB.songs.find(s => s.filename === filename);
            const full = getLibText(filename) || '';
            bodyText = stripHeaderFromTxt(full);
        }
        const title = song ? song.title : '';
        const key = song ? (song.key || '') : '';
        const isUser = song && song._user;
        const badge = filename
            ? (isUser ? '<span class="le-hdr-badge">Özel</span>' : '<span class="le-hdr-badge">Kütüphane</span>')
            : '<span class="le-hdr-badge">Yeni</span>';

        libEditor.innerHTML = `
            <div class="le-form-wrap">
                <div class="le-hdr">
                    <h4>${filename ? '✏ ' + esc(title) : '➕ Yeni Şarkı Ekle'}</h4>
                    ${badge}
                </div>
                <div class="le-form">
                    <label>Şarkı Adı
                        <input type="text" id="leTitle" value="${esc(title)}" placeholder="ÖRNEK ŞARKI ADI" />
                    </label>
                    <label>Ton
                        <input type="text" id="leKey" value="${esc(key)}" placeholder="AM-Mİ" />
                    </label>
                </div>
            </div>
            <div class="le-toolbar">
                <span class="le-tools-label">Ekle:</span>
                <button class="le-tool" data-insert="---">─── Sayfa Sonu</button>
                <button class="le-tool" data-insert="[VERSE]">[KITA]</button>
                <button class="le-tool" data-insert="[CHORUS]">[NAKARAT]</button>
                <button class="le-tool" data-insert="[BRIDGE]">[KÖPRÜ]</button>
                <button class="le-tool" data-insert="[NOTE]">[NOT]</button>
            </div>
            <div class="le-text-wrap">
                <textarea id="leText" class="le-text" spellcheck="false" placeholder="Şarkı sözlerini buraya yazın..."></textarea>
                <div class="le-hint">💡 Her dize bir satır · Kıtalar arasında boş satır · <code>---</code> sayfa sonu ekler</div>
            </div>
            <div class="le-foot">
                ${filename && isUser ? '<button class="btn btn-sm btn-danger-outline" id="leDel">🗑 Sil</button>' : '<span></span>'}
                <div class="le-foot-right">
                    <button class="btn btn-sm btn-ghost" id="leCancel">İptal</button>
                    <button class="btn btn-sm btn-accent" id="leSave">💾 Kaydet</button>
                </div>
            </div>
        `;

        const leText = document.getElementById('leText');
        leText.value = bodyText;

        document.getElementById('leCancel').onclick = () => {
            libMode = 'table';
            libEditingFile = null;
            renderLibrary();
        };
        document.getElementById('leSave').onclick = saveSongFromEditor;
        const leDel = document.getElementById('leDel');
        if (leDel) leDel.onclick = () => {
            if (!confirm('Bu özel şarkı kütüphaneden silinsin mi?')) return;
            deleteSongFromLib(libEditingFile);
            libMode = 'table';
            libEditingFile = null;
            renderLibrary();
        };

        libEditor.querySelectorAll('.le-tool').forEach(btn => {
            btn.onclick = () => insertAtCursor(leText, '\n' + btn.dataset.insert + '\n');
        });

        if (!filename) setTimeout(() => { const el = document.getElementById('leTitle'); if (el) el.focus(); }, 60);
        else setTimeout(() => leText.focus(), 60);
    }

    // Body text (without header) - title + blank + KEY: line + blank are stripped
    function stripHeaderFromTxt(full) {
        const lines = (full || '').split('\n');
        let i = 0;
        // skip title + blank
        if (i < lines.length && lines[i].trim()) i++; // title
        while (i < lines.length && !lines[i].trim()) i++; // blanks
        // skip optional KEY: line + blank
        if (i < lines.length && /^key\s*:/i.test(lines[i].trim())) {
            i++;
            while (i < lines.length && !lines[i].trim()) i++;
        }
        return lines.slice(i).join('\n').trim();
    }

    function insertAtCursor(ta, text) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const before = ta.value.substring(0, start);
        const after = ta.value.substring(end);
        ta.value = before + text + after;
        ta.selectionStart = ta.selectionEnd = start + text.length;
        ta.focus();
    }

    function saveSongFromEditor() {
        const title = trUpper(document.getElementById('leTitle').value.trim());
        const key = trUpper(document.getElementById('leKey').value.trim());
        const body = document.getElementById('leText').value.replace(/\r\n/g, '\n').trim();
        if (!title) { alert('Şarkı adı boş olamaz.'); return; }

        let filename = libEditingFile;
        let isNew = false;
        if (!filename) {
            isNew = true;
            let base = libSlugify(title);
            filename = base + '.txt';
            let i = 2;
            while (LIB.songs.some(s => s.filename === filename)) {
                filename = base + '_' + i + '.txt';
                i++;
            }
        }

        // Build full TXT with canonical format
        const bodyUpper = trUpper(body);
        let fullText = title + '\n\n';
        if (key) fullText += 'KEY: ' + key + '\n\n';
        fullText += bodyUpper + '\n';

        const lineCount = fullText.split('\n').filter(l => l.trim()).length;
        const pageCount = (bodyUpper.split(/^\s*(?:-{3,}|={3,}|\[PAGE\])\s*$/m).filter(p => p.trim()).length) || 1;

        if (isNew) {
            LIB.songs.push({
                title, filename, key,
                lines: lineCount, chars: fullText.length, pageCount,
                _user: true,
            });
            LIB.songs.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'tr'));
            saveUserLibSongs();
        } else {
            const song = LIB.songs.find(s => s.filename === filename);
            if (song) {
                song.title = title; song.key = key;
                song.lines = lineCount; song.chars = fullText.length; song.pageCount = pageCount;
                if (song._user) saveUserLibSongs();
            }
        }

        setLibOverride(filename, fullText);
        LYRICS_DB[canon(title)] = fullText;
        if (key) TONES_DB[canon(title)] = key;

        // Sync to any workspace items referencing this file
        for (const ws of Object.values(S.workspaces)) {
            for (const it of ws.items) {
                if (it._libFile === filename) {
                    it.text = fullText;
                    it.title = title;
                    if (!it.key && key) it.key = key;
                }
            }
        }
        saveAll();
        renderSL();
        if (S.idx >= 0) {
            const cur = getWS() && getWS().items[S.idx];
            if (cur && cur._libFile === filename) {
                D.songTitle.value = title;
                D.songKey.value = key;
                D.editor.value = fullText;
                updatePreview();
                renderPageOverview();
                sendCurrentToPrompter();
            }
        }

        libMode = 'table';
        libEditingFile = null;
        renderLibrary();
    }

    function deleteSongFromLib(filename) {
        const song = LIB.songs.find(s => s.filename === filename);
        if (!song || !song._user) {
            alert('Bundle\'dan gelen şarkılar silinemez. Yalnızca "★" işaretli özel şarkılar silinebilir.');
            return;
        }
        LIB.songs = LIB.songs.filter(s => s.filename !== filename);
        if (LIB.overrides[filename] !== undefined) delete LIB.overrides[filename];
        if (LIB.texts[filename] !== undefined) delete LIB.texts[filename];
        saveLibOverrides();
        saveUserLibSongs();
    }

    function openSongEditor(filename) {
        libMode = 'edit';
        libEditingFile = filename;
        renderLibrary();
    }
    function newSongEditor() {
        libMode = 'edit';
        libEditingFile = null;
        renderLibrary();
    }

    function addLibSong(filename, title) {
        const ws = getWS();
        if (!ws) { alert('Önce bir çalışma alanı seçin.'); return; }
        fetchLibText(filename).then(text => {
            const tone = findTone(title) || '';
            const newItem = {
                id: uid(), type: 'song',
                title: title.toUpperCase(),
                key: tone,
                text: text || '',
                _libFile: filename,  // track source for override sync
            };
            // Insert after selected item (or append)
            const insertAt = (S.idx >= 0 && S.idx < ws.items.length) ? S.idx + 1 : ws.items.length;
            ws.items.splice(insertAt, 0, newItem);
            saveAll();
            renderSL();
            renderLibrary();
        });
    }

    function loadManifestAndRender() {
        D.libList.innerHTML = '<div class="lib-empty">Yükleniyor...</div>';
        fetch('data/songs-manifest.json', { cache: 'no-store' })
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(manifest => {
                if (manifest && Array.isArray(manifest.songs)) {
                    LIB.songs = manifest.songs.slice();
                loadUserLibSongs();
                    renderLibrary();
                    preloadLibraryTexts();
                } else {
                    D.libList.innerHTML = '<div class="lib-empty">Manifest boş veya bozuk.</div>';
                }
            })
            .catch(err => {
                D.libList.innerHTML = `<div class="lib-empty">
                    Yüklenemedi: <code>${String(err.message || err)}</code><br><br>
                    URL'nin <code>http://</code> ile başladığından emin ol.
                </div>`;
            });
    }

    function openLibrary() {
        D.libOverlay.hidden = false;
        libMode = 'table';
        libEditingFile = null;
        if (!LIB.songs.length) {
            loadManifestAndRender();
        } else {
            renderLibrary();
        }
        updatePendingBadge();
        setTimeout(() => D.libSearch.focus(), 50);
    }
    function closeLibrary() {
        D.libOverlay.hidden = true;
        libMode = 'table';
        libEditingFile = null;
    }

    function updatePendingBadge() {
        if (!D.libPendingBadge) return;
        const n = Object.keys(LIB.overrides).length;
        D.libPendingBadge.textContent = n;
        D.libPendingBadge.style.display = n > 0 ? 'inline-block' : 'none';
        if (D.libSaveDisk) D.libSaveDisk.disabled = n === 0;
    }

    // ---- Write library overrides back to real TXT files on disk ----
    async function saveOverridesToDisk() {
        const keys = Object.keys(LIB.overrides);
        if (!keys.length) { alert('Kaydedilecek değişiklik yok.'); return; }

        // Preferred path: File System Access API (Chrome/Edge on https, some on file://)
        if (window.showDirectoryPicker) {
            try {
                const dirHandle = await window.showDirectoryPicker({
                    id: 'qrp-songs-txt',
                    mode: 'readwrite',
                });
                // Verify permission
                const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
                if (perm !== 'granted') {
                    const req = await dirHandle.requestPermission({ mode: 'readwrite' });
                    if (req !== 'granted') throw new Error('Yetki reddedildi');
                }

                let saved = 0; const failed = [];
                for (const fn of keys) {
                    try {
                        const fh = await dirHandle.getFileHandle(fn, { create: true });
                        const w = await fh.createWritable();
                        await w.write(LIB.overrides[fn]);
                        await w.close();
                        LIB.texts[fn] = LIB.overrides[fn];
                        delete LIB.overrides[fn];
                        saved++;
                    } catch (e) {
                        console.warn('Yazılamadı:', fn, e);
                        failed.push(fn);
                    }
                }
                saveLibOverrides();
                updatePendingBadge();
                renderLibrary();
                alert(
                    `${saved}/${keys.length} dosya yazıldı.` +
                    (failed.length ? '\nHata: ' + failed.join(', ') : '') +
                    '\n\nNot: Bir sonraki açılışta değişiklikler hazır gelsin diye ' +
                    'Python betiğini (extract_pdfs.py) yeniden çalıştırarak bundle\'ı güncelle.'
                );
                return;
            } catch (e) {
                if (e.name === 'AbortError') return;  // user cancelled
                console.warn('FSA hatası:', e);
                // Fall through to download fallback
            }
        }

        // Fallback: download each edited TXT — user manually copies to folder
        if (!confirm(
            `Tarayıcın dosya sistemine doğrudan yazamıyor.\n\n` +
            `${keys.length} düzenlenmiş dosya INDIRILECEK.\n` +
            `Bu dosyaları "Şarkılar TXT" klasörüne atarak üzerine yaz.\n\n` +
            `Devam edilsin mi?`
        )) return;

        for (const fn of keys) {
            const blob = new Blob([LIB.overrides[fn]], { type: 'text/plain; charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fn;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            await new Promise(r => setTimeout(r, 250));
        }
        alert(`${keys.length} dosya indirildi.\n"Şarkılar TXT" klasörüne kopyalayıp üzerine yaz.`);
    }

    // Find lyrics for a song title
    function findLyrics(title) {
        const t = title.toUpperCase().trim();
        const c = canon(title);
        if (LYRICS_DB[t]) return LYRICS_DB[t];
        if (LYRICS_DB[c]) return LYRICS_DB[c];
        for (const [key, lyrics] of Object.entries(LYRICS_DB)) {
            if (t.includes(key) || key.includes(t)) return lyrics;
            if (c && (c.includes(key) || key.includes(c))) return lyrics;
        }
        return null;
    }

    // Find tone for a song title
    function findTone(title) {
        const t = title.toUpperCase().trim();
        if (TONES_DB[t]) return TONES_DB[t];
        for (const [key, tone] of Object.entries(TONES_DB)) {
            if (t.includes(key) || key.includes(t)) return tone;
        }
        return null;
    }

    function populateLyrics() {
        let changed = false;
        for (const wsId of Object.keys(S.workspaces)) {
            const ws = S.workspaces[wsId];
            for (const it of ws.items) {
                if (it.type !== 'song') continue;
                // Auto-fill lyrics if empty
                if (!it.text || it.text.trim() === '' || /^\[NOTE\]\n.*\n\n?$/.test(it.text.trim())) {
                    const note = it.text || '';
                    const lyrics = findLyrics(it.title);
                    if (lyrics) { it.text = note + lyrics; changed = true; }
                }
                // Auto-fill tone if empty
                if (!it.key) {
                    const tone = findTone(it.title);
                    if (tone) { it.key = tone; changed = true; }
                }
            }
        }
        if (changed) {
            saveAll();
            renderSL();
            if (S.idx >= 0) pickItem(S.idx);
        }
    }

    // ============================================================
    //  WORKSPACE UI
    // ============================================================
    function renderWSSelect() {
        D.wsSelect.innerHTML = '';
        for (const [id, ws] of Object.entries(S.workspaces)) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = ws.name + (ws.artist ? ` — ${ws.artist}` : '');
            if (id === S.activeWS) opt.selected = true;
            D.wsSelect.appendChild(opt);
        }
    }

    D.wsSelect.onchange = () => {
        S.activeWS = D.wsSelect.value;
        S.idx = -1;
        saveAll();
        renderSL();
        clearEd();
    };

    D.btnNewWS.onclick = () => {
        const name = prompt('Yeni çalışma alanı adı:', 'Yeni Konser');
        if (!name) return;
        const artist = prompt('Sanatçı adı:', 'Elif Buse Doğan');
        const id = uid();
        S.workspaces[id] = { name, artist: artist || '', items: [] };
        S.activeWS = id;
        saveAll();
        renderWSSelect();
        renderSL();
        clearEd();
        // it.17.6: yeni konser günü = anında yedek (debounce yok)
        if (typeof scheduleBackup === 'function') scheduleBackup('newWorkspace', 0);
    };

    D.btnDelWS.onclick = () => {
        if (Object.keys(S.workspaces).length <= 1) {
            alert('Son çalışma alanı silinemez.');
            return;
        }
        const ws = S.workspaces[S.activeWS];
        if (!confirm(`"${ws.name}" silinsin mi?`)) return;
        delete S.workspaces[S.activeWS];
        S.activeWS = Object.keys(S.workspaces)[0];
        saveAll();
        renderWSSelect();
        renderSL();
        clearEd();
    };

    // ============================================================
    //  SCREEN DETECTION & PROMPTER LAUNCH
    // ============================================================
    async function launchPrompter() {
        // Toggle close if open
        if (S.pWin && !S.pWin.closed) {
            S.pWin.close(); S.pWin = null;
            setLive(false);
            D.launchText.textContent = 'Prompter Aç';
            D.btnLaunch.classList.remove('close-mode');
            return;
        }

        let feat = '';
        let screenInfo = 'Ana ekran';

        // Method 1: Window Management API (Chrome 100+)
        if ('getScreenDetails' in window) {
            try {
                const details = await window.getScreenDetails();
                const screens = details.screens;
                if (screens.length >= 2) {
                    const primary = details.currentScreen;
                    const secondary = screens.find(s => s !== primary);
                    if (secondary) {
                        feat = `left=${secondary.availLeft},top=${secondary.availTop},width=${secondary.availWidth},height=${secondary.availHeight}`;
                        screenInfo = `2. Ekran: ${secondary.label || secondary.width + 'x' + secondary.height}`;
                        S.pWin = window.open('prompter.html?v=' + Date.now(), 'QRP', feat);
                        setTimeout(() => send('autoFullscreen', {}), 1500);
                    }
                }
            } catch (e) {
                // Permission denied or not available, fall through
            }
        }

        // Method 2: Screen position heuristic
        if (!S.pWin) {
            const mainW = window.screen.width;
            const mainH = window.screen.height;
            const mainLeft = window.screenLeft || window.screenX || 0;

            // Try to detect if there's a screen to the right
            const testLeft = mainLeft + mainW;
            feat = `left=${testLeft},top=0,width=${mainW},height=${mainH}`;
            S.pWin = window.open('prompter.html?v=' + Date.now(), 'QRP', feat);

            // Check if it actually opened on a second screen
            if (S.pWin) {
                setTimeout(() => {
                    try {
                        const pLeft = S.pWin.screenLeft || S.pWin.screenX || 0;
                        if (pLeft >= mainW) {
                            screenInfo = `2. Ekran (${mainW}px sağında)`;
                            send('autoFullscreen', {});
                        } else {
                            screenInfo = 'Ana ekran (tek monitör)';
                        }
                        D.liveDetail.textContent = screenInfo;
                    } catch (e) {
                        screenInfo = 'Ekran algılanamadı';
                        D.liveDetail.textContent = screenInfo;
                    }
                }, 1000);
            }
        }

        if (!S.pWin) {
            // Method 3: Simple large popup
            feat = `left=0,top=0,width=${screen.availWidth},height=${screen.availHeight}`;
            S.pWin = window.open('prompter.html?v=' + Date.now(), 'QRP', feat);
            screenInfo = 'Ana ekran (popup engeli olabilir)';
        }

        if (!S.pWin) {
            alert('Prompter penceresi açılamadı.\nTarayıcınızın popup engelleyicisini kontrol edin.');
            return;
        }

        D.launchText.textContent = 'Prompter Kapat';
        D.btnLaunch.classList.add('close-mode');
        D.liveDetail.textContent = screenInfo;

        setTimeout(() => {
            sendFullInit();
            setLive(true);
        }, 1300);
    }

    function send(type, data) { ch.postMessage({ type, data }); }

    function sendFullInit() {
        send('init', {
            fontMin: S.fontMin, fontMax: S.fontMax,
            mirrorMode: S.mirror, sectionColors: S.sectionClr, theme: S.theme,
            guideVisible: S.guide, guidePos: S.guidePos, guideWidth: S.guideW, guideColor: S.guideColor,
            ibSize: S.ibSize, ibOpacity: S.ibOpacity,
            ibShowChrono: S.ibShowChrono,
            msgSize: S.msgSize,
        });
        sendCurrentToPrompter();
        // İlk mesaj boyutunu prompter'a uygula (it.17)
        send('setMessageSize', { scale: S.msgSize });
    }

    function sendCurrentToPrompter() {
        const ws = getWS();
        if (!ws || S.idx < 0 || S.idx >= ws.items.length) { updateNextInfo(null); return; }

        const item = ws.items[S.idx];
        const next = S.idx + 1 < ws.items.length ? ws.items[S.idx + 1] : null;

        updateNextInfo(next);

        if (!S.connected) return;
        send('loadText', {
            text: item.text || '',
            songTitle: item.title,
            songKey: item.key || '',
            nextSong: next ? next.title : '',
            nextKey: next ? (next.key || '') : '',
        });
    }

    function updateNextInfo(next) {
        if (!D.nextInfo) return;
        if (!next) {
            D.nextTitle.textContent = '—';
            D.nextKey.textContent = '';
            D.nextInfo.classList.remove('has');
            return;
        }
        D.nextTitle.textContent = next.title || 'İsimsiz';
        D.nextKey.textContent = next.key || '';
        D.nextInfo.classList.add('has');
    }

    function getWS() { return S.workspaces[S.activeWS]; }

    function setLive(on) {
        S.connected = on;
        D.liveDot.className = 'live-dot' + (on ? ' on' : '');
        D.liveLabel.textContent = on ? 'Prompter Aktif' : 'Prompter Kapalı';
        if (!on) D.liveDetail.textContent = '—';
    }

    // Poll prompter window
    setInterval(() => {
        const open = S.pWin && !S.pWin.closed;
        if (!open && S.connected) {
            setLive(false);
            D.launchText.textContent = 'Prompter Aç';
            D.btnLaunch.classList.remove('close-mode');
            stopAuto();
        }
    }, 1500);

    // "← basıp önceki parçaya geçince son sayfaya atla" için bir bayrak
    let _pendingLastPage = false;

    // Receive from prompter
    ch.onmessage = evt => {
        const { type, data } = evt.data;
        switch (type) {
            case 'ready':
                sendFullInit(); setLive(true);
                break;
            case 'closed':
                setLive(false);
                D.launchText.textContent = 'Prompter Aç';
                D.btnLaunch.classList.remove('close-mode');
                break;
            case 'pagesReady':
                S.total = data.total; S.page = data.current;
                updatePageUI();
                updatePreview();
                renderPageOverview();
                scheduleSessionSave();
                if (_pendingLastPage && S.total > 0) {
                    _pendingLastPage = false;
                    pgCmd('lastPage');
                }
                break;
            case 'pageChanged':
                S.page = data.page; S.total = data.total;
                updatePageUI();
                updatePreview();
                renderPageOverview();
                scheduleSessionSave();
                break;
        }
    };

    D.btnLaunch.onclick = () => {
        // Close if open
        if (S.pWin && !S.pWin.closed) {
            S.pWin.close(); S.pWin = null;
            setLive(false);
            D.launchText.textContent = 'Prompter Aç';
            D.btnLaunch.classList.remove('close-mode');
            return;
        }
        // Quick-launch with last selection
        if (S.selectedScreen && MONITORS[S.selectedScreen.idx]) {
            openPrompterOnScreen(S.selectedScreen.idx, S.selectedScreen.mode || 'fullscreen');
        } else {
            toggleLaunchMenu();
        }
    };
    const _btnLM = document.getElementById('btnLaunchMenu');
    if (_btnLM) _btnLM.onclick = (e) => { e.stopPropagation(); toggleLaunchMenu(); };

    // ============================================================
    //  SETLIST RENDERING
    // ============================================================
    function renderSL() {
        const ws = getWS();
        // Selections only valid for current workspace items; drop stale ids
        if (ws) {
            const validIds = new Set(ws.items.map(it => it.id));
            for (const id of Array.from(S.selectedIds)) {
                if (!validIds.has(id)) S.selectedIds.delete(id);
            }
        } else {
            S.selectedIds.clear();
        }

        if (!ws || !ws.items.length) {
            D.setlistWrap.innerHTML = '<div class="sl-empty">Setlist boş<br>📚 🎤 ⏸ ile parça ekleyin</div>';
            updateBulkBar();
            return;
        }

        const q = S.setlistQ;
        let visibleCount = 0;
        let songNum = 0; // it.17: sadece şarkıları say

        D.setlistWrap.innerHTML = ws.items.map((it, i) => {
            const icon = it.type === 'song' ? '🎵' : it.type === 'talk' ? '🎤' : '⏸';
            const active = i === S.idx ? 'act' : '';
            const selected = S.selectedIds.has(it.id) ? 'sel' : '';
            const keyStr = it.key ? `<span class="sl-key">${esc(it.key)}</span>` : '';
            const num = (it.type === 'song') ? (++songNum) : '';
            const hay = canon((it.title || '') + ' ' + (it.key || ''));
            const match = !q || hay.includes(q);
            if (match) visibleCount++;
            const hidden = match ? '' : 'sl-hidden';
            return `
            <div class="sl-item ${active} ${selected} ${hidden}" data-i="${i}" data-id="${esc(it.id)}">
                <label class="sl-check" title="Çoklu seçim"><input type="checkbox" data-id="${esc(it.id)}" ${selected ? 'checked' : ''} /></label>
                <span class="sl-num" title="Şarkı sırası">${num}</span>
                <span class="sl-icon">${icon}</span>
                <div class="sl-info">
                    <div class="sl-title">${esc(it.title || 'İsimsiz')}</div>
                    <div class="sl-meta">${keyStr} ${cntLines(it.text)} satır</div>
                </div>
                <div class="sl-actions">
                    <button class="sl-btn" data-a="up" data-i="${i}" title="Yukarı">↑</button>
                    <button class="sl-btn" data-a="dn" data-i="${i}" title="Aşağı">↓</button>
                    <button class="sl-btn del" data-a="rm" data-i="${i}" title="Sil">✕</button>
                </div>
            </div>`;
        }).join('');

        // Row click → pick (but not when clicking checkbox/action buttons)
        D.setlistWrap.querySelectorAll('.sl-item').forEach(el => {
            el.addEventListener('click', e => {
                if (e.target.closest('.sl-btn')) return;
                if (e.target.closest('.sl-check')) return;
                pickItem(+el.dataset.i);
            });
        });

        // Checkbox toggle
        D.setlistWrap.querySelectorAll('.sl-check input').forEach(cb => {
            cb.addEventListener('click', e => {
                e.stopPropagation();
                const id = cb.dataset.id;
                if (cb.checked) S.selectedIds.add(id);
                else S.selectedIds.delete(id);
                cb.closest('.sl-item').classList.toggle('sel', cb.checked);
                updateBulkBar();
            });
        });

        D.setlistWrap.querySelectorAll('.sl-btn').forEach(b => {
            b.addEventListener('click', e => {
                e.stopPropagation();
                slAction(b.dataset.a, +b.dataset.i);
            });
        });

        // Show "no match" hint when search filters out everything
        if (q && visibleCount === 0) {
            const hint = document.createElement('div');
            hint.className = 'sl-empty sl-search-empty';
            hint.innerHTML = `"${esc(D.setlistSearch ? D.setlistSearch.value : '')}" için sonuç yok`;
            D.setlistWrap.appendChild(hint);
        }

        updateBulkBar();
    }

    function updateBulkBar() {
        if (!D.bulkBar) return;
        const n = S.selectedIds.size;
        if (n === 0) {
            D.bulkBar.hidden = true;
            return;
        }
        D.bulkBar.hidden = false;
        D.bulkCount.textContent = n + ' seçili';
    }

    // Return selected item indices, sorted ascending
    function getSelectedIndices() {
        const ws = getWS();
        if (!ws) return [];
        const out = [];
        for (let i = 0; i < ws.items.length; i++) {
            if (S.selectedIds.has(ws.items[i].id)) out.push(i);
        }
        return out;
    }

    // Bulk move: shift every selected item by one position.
    // dir: -1 = up, +1 = down. No confirmation.
    function bulkMove(dir) {
        const ws = getWS();
        if (!ws) return;
        const indices = getSelectedIndices();
        if (!indices.length) return;

        const activeId = (S.idx >= 0 && S.idx < ws.items.length) ? ws.items[S.idx].id : null;
        // Re-render scroll'u sıfırlar; eski konumu koru (it.17 fix)
        const savedScroll = D.setlistWrap ? D.setlistWrap.scrollTop : 0;

        if (dir === -1) {
            // Iterate top-to-bottom; skip if blocked
            for (const i of indices) {
                if (i === 0) continue;
                if (S.selectedIds.has(ws.items[i - 1].id)) continue;
                [ws.items[i], ws.items[i - 1]] = [ws.items[i - 1], ws.items[i]];
            }
        } else {
            // Iterate bottom-to-top
            for (let k = indices.length - 1; k >= 0; k--) {
                const i = indices[k];
                if (i >= ws.items.length - 1) continue;
                if (S.selectedIds.has(ws.items[i + 1].id)) continue;
                [ws.items[i], ws.items[i + 1]] = [ws.items[i + 1], ws.items[i]];
            }
        }

        // Restore S.idx by active item ID
        if (activeId) {
            const newIdx = ws.items.findIndex(it => it.id === activeId);
            if (newIdx !== -1) S.idx = newIdx;
        }

        saveAll();
        renderSL();
        if (D.setlistWrap) D.setlistWrap.scrollTop = savedScroll;
    }

    // Bulk delete: asks for confirmation once
    function bulkDelete() {
        const ws = getWS();
        if (!ws) return;
        const n = S.selectedIds.size;
        if (!n) return;
        if (!confirm(n + ' parça silinsin mi?')) return;

        const activeId = (S.idx >= 0 && S.idx < ws.items.length) ? ws.items[S.idx].id : null;
        ws.items = ws.items.filter(it => !S.selectedIds.has(it.id));
        S.selectedIds.clear();

        // Re-map S.idx
        if (activeId) {
            const idx = ws.items.findIndex(it => it.id === activeId);
            if (idx !== -1) S.idx = idx;
            else S.idx = Math.min(S.idx, ws.items.length - 1);
        }
        if (S.idx >= ws.items.length) S.idx = ws.items.length - 1;

        saveAll();
        renderSL();
        if (S.idx >= 0) pickItem(S.idx); else clearEd();
    }

    function toggleSelectAll() {
        const ws = getWS();
        if (!ws) return;
        const allSelected = ws.items.length > 0 && S.selectedIds.size === ws.items.length;
        if (allSelected) S.selectedIds.clear();
        else ws.items.forEach(it => S.selectedIds.add(it.id));
        renderSL();
    }

    function slAction(a, i) {
        const ws = getWS();
        if (!ws) return;
        const items = ws.items;

        // Re-render scroll'u sıfırlar; up/dn için eski konumu koru (it.17 fix)
        const isMove = (a === 'up' || a === 'dn');
        const savedScroll = (isMove && D.setlistWrap) ? D.setlistWrap.scrollTop : 0;

        if (a === 'up' && i > 0) {
            [items[i], items[i-1]] = [items[i-1], items[i]];
            if (S.idx === i) S.idx--; else if (S.idx === i-1) S.idx++;
        } else if (a === 'dn' && i < items.length - 1) {
            [items[i], items[i+1]] = [items[i+1], items[i]];
            if (S.idx === i) S.idx++; else if (S.idx === i+1) S.idx--;
        } else if (a === 'rm') {
            if (!confirm(`"${items[i].title}" silinsin mi?`)) return;
            items.splice(i, 1);
            if (S.idx >= items.length) S.idx = items.length - 1;
            if (S.idx >= 0) pickItem(S.idx); else clearEd();
        }
        saveAll(); renderSL();

        if (isMove && D.setlistWrap) D.setlistWrap.scrollTop = savedScroll;
    }

    // Insert a new item after the currently selected one (or at end)
    function insertItem(item) {
        const ws = getWS();
        if (!ws) { alert('Önce bir çalışma alanı seçin.'); return; }
        const at = (S.idx >= 0 && S.idx < ws.items.length) ? S.idx + 1 : ws.items.length;
        ws.items.splice(at, 0, item);
        saveAll();
        renderSL();
        pickItem(at);
    }

    D.btnAddTalk.onclick = () => {
        insertItem({ id: uid(), type: 'talk', title: 'KONUŞMA', key: '', text: 'Konuşma' });
    };

    D.btnAddBreak.onclick = () => {
        insertItem({ id: uid(), type: 'break', title: 'ARA', key: '', text: 'Ara' });
    };

    // Bulk-action bar wiring
    D.bulkAll.onclick   = toggleSelectAll;
    D.bulkUp.onclick    = () => bulkMove(-1);
    D.bulkDown.onclick  = () => bulkMove(+1);
    D.bulkDel.onclick   = bulkDelete;
    D.bulkClear.onclick = () => { S.selectedIds.clear(); renderSL(); };

    // Setlist search wiring
    if (D.setlistSearch) {
        D.setlistSearch.addEventListener('input', () => {
            S.setlistQ = canon(D.setlistSearch.value || '');
            if (D.setlistSearchClear) D.setlistSearchClear.hidden = !D.setlistSearch.value;
            renderSL();
        });
        D.setlistSearch.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                D.setlistSearch.value = '';
                S.setlistQ = '';
                if (D.setlistSearchClear) D.setlistSearchClear.hidden = true;
                renderSL();
                D.setlistSearch.blur();
            }
        });
    }
    if (D.setlistSearchClear) {
        D.setlistSearchClear.addEventListener('click', () => {
            D.setlistSearch.value = '';
            S.setlistQ = '';
            D.setlistSearchClear.hidden = true;
            renderSL();
            D.setlistSearch.focus();
        });
    }

    // ============================================================
    //  EDITOR
    // ============================================================
    function pickItem(i) {
        const ws = getWS();
        if (!ws || i < 0 || i >= ws.items.length) return;
        S.idx = i;
        scheduleSessionSave();
        const it = ws.items[i];

        // Auto-fill lyrics from DB if empty
        if (it.type === 'song' && (!it.text || it.text.trim() === '')) {
            const lyrics = findLyrics(it.title);
            if (lyrics) { it.text = lyrics; saveAll(); }
        }
        // Auto-fill tone from DB if empty
        if (it.type === 'song' && !it.key) {
            const tone = findTone(it.title);
            if (tone) { it.key = tone; saveAll(); }
        }

        D.songTitle.value = it.title;
        D.songKey.value = it.key || '';
        D.editor.value = it.text || '';
        renderSL();
        updatePreview();
        renderPageOverview();
        sendCurrentToPrompter();

        // Scroll to item in setlist
        const el = D.setlistWrap.querySelector(`[data-i="${i}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function clearEd() {
        S.idx = -1;
        D.songTitle.value = '';
        D.songKey.value = '';
        D.editor.value = '';
        S.page = 0; S.total = 0;
        updatePageUI();
        updatePreview();
        renderSL();
    }

    function saveItem() {
        const ws = getWS();
        if (!ws) return;

        const title = D.songTitle.value.trim() || 'İsimsiz';
        const key = D.songKey.value.trim();
        const text = D.editor.value;

        if (S.idx >= 0 && S.idx < ws.items.length) {
            ws.items[S.idx].title = title;
            ws.items[S.idx].key = key;
            ws.items[S.idx].text = text;
            // Sync to library override if this item came from library
            if (ws.items[S.idx]._libFile) setLibOverride(ws.items[S.idx]._libFile, text);
        } else {
            ws.items.push({ id: uid(), type: 'song', title, key, text });
            S.idx = ws.items.length - 1;
        }

        saveAll(); renderSL(); updatePreview();
        sendCurrentToPrompter();
        D.btnSave.textContent = '✓ Kaydedildi';
        setTimeout(() => D.btnSave.textContent = 'Kaydet', 1000);
    }

    D.sectionType.onchange = () => {
        const v = D.sectionType.value; if (!v) return;
        const ta = D.editor, s = ta.selectionStart;
        const pre = ta.value.substring(0, s);
        const post = ta.value.substring(ta.selectionEnd);
        const ins = (pre.endsWith('\n') || pre === '' ? '' : '\n') + v + '\n';
        ta.value = pre + ins + post;
        ta.selectionStart = ta.selectionEnd = s + ins.length;
        ta.focus();
        D.sectionType.value = '';
    };

    D.btnSave.onclick = saveItem;
    D.btnClear.onclick = () => {
        if (D.editor.value && !confirm('Temizlensin mi?')) return;
        clearEd();
    };

    // Auto-save
    let svTimer = null;
    function autoSave() {
        clearTimeout(svTimer);
        svTimer = setTimeout(() => {
            const ws = getWS();
            if (!ws || S.idx < 0) return;
            const it = ws.items[S.idx];
            it.text = D.editor.value;
            it.title = D.songTitle.value.trim() || 'İsimsiz';
            it.key = D.songKey.value.trim();
            if (it._libFile) setLibOverride(it._libFile, it.text);
            saveAll(); renderSL();
        }, 1500);
    }

    D.editor.oninput = () => { autoSave(); updatePreview(); renderPageOverview(); };
    D.songTitle.oninput = autoSave;
    D.songKey.oninput = autoSave;

    // ============================================================
    //  PAGE UI & PREVIEW
    // ============================================================
    function updatePageUI() {
        const label = S.total > 0 ? `${S.page} / ${S.total}` : '— / —';
        D.navCounter.textContent = label;
        D.pvInfo.textContent = label;
    }

    function updatePreview() {
        const text = D.editor.value;
        if (!text.trim()) {
            D.previewInner.innerHTML = '<p class="pv-empty">Sayfa önizlemesi</p>';
            return;
        }

        const SECTION_RE = /^\[(VERSE|CHORUS|BRIDGE|INTRO|OUTRO|SOLO|BREAK|NOTE)\]$/i;
        const PAGEBREAK_RE = /^(?:-{3,}|={3,}|\[PAGE\])$/i;
        const sColors = { verse:'#6366f1', chorus:'#f59e0b', bridge:'#06b6d4', intro:'#22c55e', outro:'#ef4444', solo:'#ec4899', break:'#8b5cf6', note:'#64748b' };
        const lines = text.split('\n');

        // Split into pages: only on explicit --- / === / [PAGE] markers (no implicit page breaks)
        const pages = [];
        let page = [];
        for (const line of lines) {
            const t = line.trim();
            if (PAGEBREAK_RE.test(t)) {
                if (page.some(l => l.trim())) { pages.push(page); page = []; }
                continue;
            }
            page.push(line);
        }
        if (page.some(l => l.trim())) pages.push(page);
        if (pages.length === 0) pages.push(lines);

        // Show current page based on S.page (from prompter)
        const pIdx = Math.max(0, Math.min((S.page || 1) - 1, pages.length - 1));
        const currentLines = pages[pIdx] || pages[0];

        // Song meta
        const ws = getWS();
        const it = ws && S.idx >= 0 ? ws.items[S.idx] : null;
        const songLabel = it ? esc(it.title) + (it.key ? ' — ' + esc(it.key) : '') : '';

        // Autofit font: scale to container height so it looks like the actual prompter screen
        const frame = document.getElementById('previewFrame');
        const frameH = frame ? frame.clientHeight : 180;
        const frameW = frame ? frame.clientWidth  : 400;

        // Info bar takes ~8% of height, min 14px
        const infoH = Math.max(14, Math.round(frameH * 0.08));
        const pad   = Math.max(6, Math.round(frameH * 0.04));
        const availH = frameH - infoH - pad * 2;

        // Count effective lines (section markers render smaller; blanks are 0.4x)
        let effectiveLines = 0;
        for (const l of currentLines) {
            const t = l.trim();
            if (!t) effectiveLines += 0.4;
            else if (SECTION_RE.test(t)) effectiveLines += 0.7;
            else effectiveLines += 1;
        }
        effectiveLines = Math.max(1, effectiveLines);

        // Line-height 1.5 → per-line height = fontSize * 1.5
        const LH = 1.5;
        let fontSize = Math.floor(availH / (effectiveLines * LH));
        // Also constrain by width: avg chars per line vs container width
        const avgChars = Math.max(10, Math.round(currentLines.reduce((a, l) => a + l.trim().length, 0) / Math.max(1, currentLines.filter(l => l.trim()).length)));
        const widthCap = Math.floor(frameW / (avgChars * 0.55));
        fontSize = Math.min(fontSize, widthCap);
        fontSize = Math.max(10, Math.min(fontSize, 72));

        const sectionSize = Math.max(8, Math.round(fontSize * 0.6));
        const infoSize = Math.max(9, Math.round(infoH * 0.55));

        // Render
        let html = `<div style="background:#000;height:100%;display:flex;flex-direction:column;overflow:hidden">`;
        // Content area — centered vertically + horizontally
        html += `<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:${pad}px ${pad*1.5}px;overflow:hidden">`;
        html += `<div style="text-align:center;width:100%;line-height:${LH};text-transform:uppercase">`;
        for (const line of currentLines) {
            const t = line.trim();
            const m = t.match(SECTION_RE);
            if (m) {
                const c = sColors[m[1].toLowerCase()] || '#888';
                html += `<div style="font-size:${sectionSize}px;font-weight:700;color:${c};padding:2px 0;letter-spacing:2px;opacity:0.8">${esc(t)}</div>`;
            } else if (t === '') {
                html += `<div style="height:${Math.max(4, fontSize*0.4)}px"></div>`;
            } else {
                html += `<div style="font-size:${fontSize}px;font-weight:500;color:#f5f5f5">${esc(t)}</div>`;
            }
        }
        html += '</div></div>';

        // Info bar (mimics prompter info bar)
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:0 ${pad}px;height:${infoH}px;border-top:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.02);flex-shrink:0;font-size:${infoSize}px">`;
        html += `<span style="color:rgba(255,255,255,0.35);font-weight:700;letter-spacing:1px">QR</span>`;
        html += `<span style="color:rgba(255,255,255,0.75);font-weight:600;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%">${songLabel}</span>`;
        html += `<span style="color:rgba(255,255,255,0.45);font-variant-numeric:tabular-nums">${pIdx + 1}/${pages.length}</span>`;
        html += '</div>';
        html += '</div>';

        D.previewInner.innerHTML = html;
        D.pvInfo.textContent = `${pIdx + 1} / ${pages.length}`;
    }

    // Page navigation
    function pgCmd(cmd) { send(cmd, {}); }
    D.navFirst.onclick = D.trFirst.onclick = () => pgCmd('firstPage');
    D.navPrev.onclick  = D.trPrev.onclick  = () => navFlow(-1);
    D.navNext.onclick  = D.trNext.onclick  = () => navFlow(+1);
    D.navLast.onclick  = D.trLast.onclick  = () => pgCmd('lastPage');

    // ============================================================
    //  AUTO PLAY
    // ============================================================
    function startAuto() {
        if (S.total < 2) return;
        S.autoOn = true;
        D.trPlay.textContent = '⏸'; D.trPlay.classList.add('run');
        S.autoIv = setInterval(() => {
            if (S.page < S.total) pgCmd('nextPage');
            else {
                // Auto advance to next song
                const ws = getWS();
                if (ws && S.idx < ws.items.length - 1) {
                    pickItem(S.idx + 1);
                } else {
                    stopAuto();
                }
            }
        }, S.autoSec * 1000);
    }

    function stopAuto() {
        S.autoOn = false; clearInterval(S.autoIv); S.autoIv = null;
        D.trPlay.textContent = '▶'; D.trPlay.classList.remove('run');
    }

    D.trPlay.onclick = () => { if (S.autoOn) stopAuto(); else startAuto(); };

    D.sliderInterval.oninput = () => {
        S.autoSec = +D.sliderInterval.value; D.valInterval.textContent = S.autoSec;
        saveSettings();
        if (S.autoOn) {
            clearInterval(S.autoIv);
            S.autoIv = setInterval(() => {
                if (S.page < S.total) pgCmd('nextPage');
                else stopAuto();
            }, S.autoSec * 1000);
        }
    };

    // ============================================================
    //  CONTROLS → PROMPTER
    // ============================================================
    function sendSettings(partial) { send('updateSettings', partial); }

    D.sliderFontMin.oninput = () => { S.fontMin = +D.sliderFontMin.value; D.valFontMin.textContent = S.fontMin; sendSettings({ fontMin: S.fontMin }); saveSettings(); };
    D.sliderFontMax.oninput = () => { S.fontMax = +D.sliderFontMax.value; D.valFontMax.textContent = S.fontMax; sendSettings({ fontMax: S.fontMax }); saveSettings(); };

    D.chkGuide.onchange = () => { S.guide = D.chkGuide.checked; sendSettings({ guideVisible: S.guide }); saveSettings(); };
    D.sliderGuidePos.oninput = () => { S.guidePos = +D.sliderGuidePos.value; D.valGuidePos.textContent = S.guidePos; sendSettings({ guidePos: S.guidePos }); saveSettings(); };
    D.sliderGuideW.oninput = () => { S.guideW = +D.sliderGuideW.value; D.valGuideW.textContent = S.guideW; sendSettings({ guideWidth: S.guideW }); saveSettings(); };

    D.guideColors.querySelectorAll('.color-dot').forEach(dot => {
        dot.onclick = () => {
            D.guideColors.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            S.guideColor = dot.dataset.c;
            sendSettings({ guideColor: S.guideColor });
            saveSettings();
        };
    });

    D.chkMirror.onchange = () => { S.mirror = D.chkMirror.checked; sendSettings({ mirrorMode: S.mirror }); saveSettings(); };
    D.chkSectionClr.onchange = () => { S.sectionClr = D.chkSectionClr.checked; sendSettings({ sectionColors: S.sectionClr }); saveSettings(); };

    // Chrono size (footer display) — local only
    function applyChronoSize() {
        if (D.chrono) D.chrono.style.setProperty('--chrono-size', S.chronoSize + 'px');
    }
    D.sliderChronoSize.oninput = () => {
        S.chronoSize = +D.sliderChronoSize.value;
        D.valChronoSize.textContent = S.chronoSize;
        applyChronoSize();
        saveSettings();
    };

    // Info bar (prompter) controls
    D.sliderIbSize.oninput = () => {
        S.ibSize = +D.sliderIbSize.value;
        D.valIbSize.textContent = S.ibSize;
        sendSettings({ ibSize: S.ibSize });
        saveSettings();
    };
    D.sliderIbOpacity.oninput = () => {
        S.ibOpacity = +D.sliderIbOpacity.value;
        D.valIbOpacity.textContent = S.ibOpacity;
        sendSettings({ ibOpacity: S.ibOpacity });
        saveSettings();
    };
    D.chkIbChrono.onchange = () => {
        S.ibShowChrono = D.chkIbChrono.checked;
        sendSettings({ ibShowChrono: S.ibShowChrono });
        saveSettings();
    };

    // Page break button: insert "---" on its own line at cursor
    D.btnPageBreak.onclick = () => {
        const ta = D.editor;
        const s = ta.selectionStart;
        const pre = ta.value.substring(0, s);
        const post = ta.value.substring(ta.selectionEnd);
        const needPreNL = pre.length > 0 && !pre.endsWith('\n');
        const needPostNL = post.length > 0 && !post.startsWith('\n');
        const ins = (needPreNL ? '\n' : '') + '---\n' + (needPostNL ? '' : '');
        ta.value = pre + ins + post;
        ta.selectionStart = ta.selectionEnd = s + ins.length;
        ta.focus();
        // trigger save + preview
        ta.dispatchEvent(new Event('input'));
    };

    // it.17.5: Hızlı sembol butonları (Dans, Melodi, Ritim, Davul, ...)
    $$('.symbol-btn').forEach(btn => {
        btn.onclick = () => {
            const sym = btn.dataset.sym;
            if (!sym) return;
            const ta = D.editor;
            const s = ta.selectionStart;
            const pre = ta.value.substring(0, s);
            const post = ta.value.substring(ta.selectionEnd);
            const needPreNL = pre.length > 0 && !pre.endsWith('\n');
            const needPostNL = post.length > 0 && !post.startsWith('\n');
            const ins = (needPreNL ? '\n' : '') + sym + (needPostNL ? '\n' : '');
            ta.value = pre + ins + post;
            ta.selectionStart = ta.selectionEnd = s + ins.length;
            ta.focus();
            ta.dispatchEvent(new Event('input'));
        };
    });

    // Theme
    $$('.th-btn').forEach(btn => {
        btn.onclick = () => {
            $$('.th-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            S.theme = btn.dataset.theme;
            sendSettings({ theme: S.theme });
            saveSettings();
        };
    });

    // Countdown — bittikten sonra:
    //   1) seçili parçanın ilk sayfasına geç
    //   2) KRONOMETREYİ otomatik başlat (sayfa geçişi İÇİN değil, sahne süresi için)
    // Otomatik sayfa geçişi BAŞLATILMAZ — kullanıcı ▶ butonu ile kendisi başlatır.
    D.btnCD.onclick = () => {
        const sec = +D.cdSec.value;
        if (sec > 0) send('countdown', { seconds: sec });
        setTimeout(() => {
            pgCmd('firstPage');
            // Kronometre henüz çalışmıyorsa otomatik başlat
            if (!CR.on) D.chStart.click();
        }, (sec > 0 ? sec * 1000 + 500 : 200));
    };

    // Message to artist — kaldırana kadar kalır (duration=0)
    function setMsgStatus(on, text) {
        if (!D.msgStatus) return;
        if (on) {
            D.msgStatus.textContent = '● Açık';
            D.msgStatus.className = 'msg-status on';
            D.msgStatus.title = text || '';
        } else {
            D.msgStatus.textContent = '';
            D.msgStatus.className = 'msg-status';
            D.msgStatus.title = '';
        }
    }

    D.btnSendMsg.onclick = () => {
        const text = D.msgInput.value.trim();
        if (!text) return;
        send('showMessage', { text, duration: 0 });  // 0 = kaldırana kadar
        setMsgStatus(true, text);
        D.btnSendMsg.textContent = '✓ Gösteriliyor';
        setTimeout(() => D.btnSendMsg.textContent = '📢 Göster', 1200);
    };

    D.btnClearMsg.onclick = () => {
        send('clearMessage', {});
        setMsgStatus(false);
        D.btnClearMsg.textContent = '✓ Gizlendi';
        setTimeout(() => D.btnClearMsg.textContent = '🚫 Gizle', 1200);
    };

    D.msgInput.addEventListener('keydown', e => {
        // Enter → gönder · Shift+Enter → yeni satır (textarea varsayılanı)
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); D.btnSendMsg.click(); }
    });

    // ---- it.17: Flash (basılı tut) + boyut slider ----
    if (D.btnFlashMsg) {
        const flashStart = (e) => {
            e.preventDefault();
            D.btnFlashMsg.classList.add('flashing');
            send('flashMessage', { on: true });
        };
        const flashStop = (e) => {
            if (e) e.preventDefault();
            D.btnFlashMsg.classList.remove('flashing');
            send('flashMessage', { on: false });
        };
        D.btnFlashMsg.addEventListener('mousedown', flashStart);
        D.btnFlashMsg.addEventListener('touchstart', flashStart, { passive: false });
        D.btnFlashMsg.addEventListener('mouseup', flashStop);
        D.btnFlashMsg.addEventListener('mouseleave', flashStop);
        D.btnFlashMsg.addEventListener('touchend', flashStop);
        D.btnFlashMsg.addEventListener('touchcancel', flashStop);
        // Pencere odağı kaybolsa da flash kalmasın
        window.addEventListener('blur', flashStop);
    }

    if (D.msgSize) {
        D.msgSize.addEventListener('input', () => {
            const scale = +D.msgSize.value;
            S.msgSize = scale;
            if (D.msgSizeVal) D.msgSizeVal.textContent = scale.toFixed(1) + '×';
            send('setMessageSize', { scale });
            saveSettings();
        });
    }

    // ============================================================
    //  IMPORT / EXPORT
    // ============================================================
    D.btnExport.onclick = () => {
        const data = {
            version: 3,
            exportDate: new Date().toISOString(),
            workspaces: S.workspaces,
            activeWS: S.activeWS,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const ws = getWS();
        const name = ws ? ws.name.replace(/\s+/g, '-') : 'export';
        a.download = `qr-prompter-${name}-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    D.btnImport.onclick = () => D.fileIn.click();

    D.fileIn.onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                if (f.name.endsWith('.json')) {
                    const d = JSON.parse(ev.target.result);
                    if (d.workspaces) {
                        Object.assign(S.workspaces, d.workspaces);
                        if (d.activeWS) S.activeWS = d.activeWS;
                    } else if (d.setlist) {
                        // Legacy format
                        const id = uid();
                        S.workspaces[id] = { name: 'İçe Aktarılan', artist: '', items: d.setlist };
                        S.activeWS = id;
                    }
                } else {
                    // Text file - add as single song
                    const ws = getWS();
                    if (ws) {
                        ws.items.push({
                            id: uid(), type: 'song',
                            title: f.name.replace(/\.[^/.]+$/, ''),
                            key: '', text: ev.target.result
                        });
                    }
                }
                saveAll(); renderWSSelect(); renderSL();
                if (getWS() && getWS().items.length) pickItem(0);
            } catch (err) { alert('Dosya okunamadı: ' + err.message); }
        };
        reader.readAsText(f);
        e.target.value = '';
    };

    // ============================================================
    //  NAVIGATION — sayfa + setlist arası akış
    // ============================================================
    // dir: +1 = ileri, -1 = geri
    // Son sayfadaysa → sıradaki item'a geçer (ilk sayfasıyla)
    // İlk sayfadaysa ← → önceki item'a geçer (son sayfasıyla)
    function navFlow(dir) {
        // Prompter açık ve içerik varsa önce sayfa geçişi dene
        if (S.connected && S.total > 0) {
            if (dir === +1 && S.page < S.total) { pgCmd('nextPage'); return; }
            if (dir === -1 && S.page > 1)        { pgCmd('prevPage'); return; }
        }
        // Sınırdayız → setlist'te kaydır
        const ws = getWS();
        if (!ws || !ws.items.length) return;
        if (dir === +1) {
            if (S.idx < ws.items.length - 1) pickItem(S.idx + 1);
        } else {
            if (S.idx > 0) {
                _pendingLastPage = true;  // yeni item paginate olunca son sayfaya atla
                pickItem(S.idx - 1);
            }
        }
    }

    // ============================================================
    //  KEYBOARD SHORTCUTS — yalnızca ok tuşları (← geri, → ileri)
    // ============================================================
    document.addEventListener('keydown', e => {
        if (e.target === D.editor || e.target === D.songTitle || e.target === D.songKey || e.target === D.msgInput) {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveItem(); }
            return;
        }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); navFlow(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); navFlow(+1); }
    });

    // ============================================================
    //  AUTO-BACKUP (every 30 seconds)
    // ============================================================
    setInterval(() => {
        saveAll();
        // Also backup to a timestamped key every 5 minutes
        const now = Date.now();
        const lastBackup = parseInt(localStorage.getItem('qrp-last-backup') || '0');
        if (now - lastBackup > 300000) {
            const key = 'qrp-backup-' + new Date().toISOString().slice(0, 16);
            localStorage.setItem(key, JSON.stringify(S.workspaces));
            localStorage.setItem('qrp-last-backup', String(now));
            // Clean old backups (keep last 5)
            const backupKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k.startsWith('qrp-backup-')) backupKeys.push(k);
            }
            backupKeys.sort();
            while (backupKeys.length > 5) {
                localStorage.removeItem(backupKeys.shift());
            }
        }
    }, 30000);

    // ============================================================
    //  LIBRARY EVENT WIRING
    // ============================================================
    D.btnLibrary.onclick = openLibrary;
    D.libClose.onclick = closeLibrary;
    D.libOverlay.addEventListener('click', e => {
        if (e.target === D.libOverlay) closeLibrary();
    });
    D.libSearch.addEventListener('input', () => {
        // Sadece listeyi güncelle — editörü re-render etme (kullanıcı yazıyor olabilir)
        renderLibTable();
    });
    D.libSearch.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            e.preventDefault();
            if (libMode === 'edit') { libMode = 'table'; libEditingFile = null; renderLibrary(); }
            else closeLibrary();
        }
    });
    D.libSaveDisk.onclick = () => { saveOverridesToDisk(); };

    const _btnLibNew = document.getElementById('libNewSong');
    if (_btnLibNew) _btnLibNew.onclick = () => newSongEditor();

    D.libAddAll.onclick = () => {
        const ws = getWS();
        if (!ws) return;
        const q = canon(D.libSearch.value || '');
        const candidates = q ? LIB.songs.filter(s => canon(s.title).includes(q)) : LIB.songs;
        const existing = new Set(ws.items.map(it => canon(it.title)));
        const toAdd = candidates.filter(s => !existing.has(canon(s.title)));
        if (!toAdd.length) { alert('Eklenecek yeni şarkı yok.'); return; }
        if (!confirm(`${toAdd.length} şarkı setlist'e eklensin mi?`)) return;
        Promise.all(toAdd.map(s =>
            fetchLibText(s.filename).then(text => ({ s, text }))
        )).then(results => {
            results.forEach(({ s, text }) => {
                const tone = findTone(s.title) || '';
                ws.items.push({
                    id: uid(), type: 'song',
                    title: s.title.toUpperCase(),
                    key: tone,
                    text: text || '',
                    _libFile: s.filename,
                });
            });
            saveAll();
            renderSL();
            renderLibrary();
        });
    };

    // ============================================================
    //  MONITOR DETECTION & LAUNCH PICKER
    // ============================================================
    let MONITORS = [];
    let _screenDetails = null;

    async function initMonitors() {
        MONITORS = [];
        if ('getScreenDetails' in window) {
            try {
                _screenDetails = await window.getScreenDetails();
                MONITORS = _screenDetails.screens.map((s, i) => ({
                    idx: i,
                    label: s.label || (s.isPrimary ? 'Ana Ekran' : 'Ekran ' + (i + 1)),
                    width: s.width, height: s.height,
                    availLeft: s.availLeft, availTop: s.availTop,
                    availWidth: s.availWidth, availHeight: s.availHeight,
                    isPrimary: s.isPrimary,
                }));
                // React to plug/unplug
                _screenDetails.addEventListener('screenschange', () => { initMonitors(); });
            } catch (e) {
                console.warn('[QR Prompter] Window Management API denied or unavailable:', e.message);
            }
        }
        if (MONITORS.length === 0) {
            // Fallback: single "current screen" entry
            MONITORS = [{
                idx: 0,
                label: 'Ana Ekran',
                width: window.screen.width,
                height: window.screen.height,
                availLeft: 0, availTop: 0,
                availWidth: window.screen.availWidth,
                availHeight: window.screen.availHeight,
                isPrimary: true,
            }];
        }
        renderMonitorList();
    }

    function renderMonitorList() {
        const el = document.getElementById('monitorList');
        if (!el) return;
        if (!MONITORS.length) {
            el.innerHTML = '<div class="mon-empty">Ekran algılanamadı</div>';
            return;
        }
        el.innerHTML = MONITORS.map(m =>
            `<div class="mon-item" data-idx="${m.idx}">
                <span class="mon-ico">${m.isPrimary ? '🖥️' : '📺'}</span>
                <div class="mon-info">
                    <div class="mon-label">${esc(m.label)}</div>
                    <div class="mon-size">${m.width}×${m.height}${m.isPrimary ? ' · Ana' : ''}</div>
                </div>
                <div class="mon-actions">
                    <button class="mon-btn" data-mode="window" title="Pencere modu">◱ Pencere</button>
                    <button class="mon-btn mon-fs" data-mode="fullscreen" title="Tam ekran">⛶ Tam Ekran</button>
                </div>
            </div>`
        ).join('') + `<div class="mon-foot">
            <button class="btn btn-sm btn-outline" id="monRefresh">🔁 Ekranları Yenile</button>
        </div>`;

        el.querySelectorAll('.mon-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const item = btn.closest('.mon-item');
                const idx = parseInt(item.dataset.idx, 10);
                const mode = btn.dataset.mode;
                openPrompterOnScreen(idx, mode);
            };
        });
        const refresh = document.getElementById('monRefresh');
        if (refresh) refresh.onclick = (e) => { e.stopPropagation(); initMonitors(); };
    }

    function openPrompterOnScreen(idx, mode) {
        const m = MONITORS[idx] || MONITORS[0];
        if (!m) return;
        S.selectedScreen = { idx, mode };
        scheduleSessionSave();

        // Close existing prompter first
        if (S.pWin && !S.pWin.closed) {
            try { S.pWin.close(); } catch (_) {}
            S.pWin = null;
        }

        // Compute window geometry per mode
        let w, h, left, top;
        if (mode === 'window') {
            // Pencere modu: ortalanmış, makul boyutta pencere (tek ekranda kontrol paneliyle yan yana dursun)
            w = Math.min(1280, Math.max(640, Math.round(m.availWidth * 0.7)));
            h = Math.min(800,  Math.max(480, Math.round(m.availHeight * 0.75)));
            left = m.availLeft + Math.round((m.availWidth - w) / 2);
            top  = m.availTop  + Math.round((m.availHeight - h) / 2);
        } else {
            // Tam ekran: hedef ekranın tüm alanı
            w = m.availWidth; h = m.availHeight;
            left = m.availLeft; top = m.availTop;
        }

        // popup=yes → Chrome'u yeni pencere (tab değil) açmaya zorla
        const feat = `popup=yes,resizable=yes,scrollbars=yes,left=${left},top=${top},width=${w},height=${h}`;
        // Benzersiz window ismi → çift tıklamada eski pencereyle çakışma olmasın
        const winName = 'QRP_' + Date.now();
        S.pWin = window.open('prompter.html?v=' + Date.now(), winName, feat);

        if (!S.pWin) {
            alert('Prompter penceresi açılamadı.\n\n'
                + 'Olası sebepler:\n'
                + '• Tarayıcının popup engelleyicisi — URL çubuğunun sağında engellenmiş popup ikonuna bas ve "her zaman izin ver" seç.\n'
                + '• Tarayıcı "yeni pencere" yerine "yeni tab" moduna ayarlı olabilir.');
            return;
        }
        D.launchText.textContent = 'Prompter Kapat';
        D.btnLaunch.classList.add('close-mode');
        D.liveDetail.textContent = m.label + (mode === 'fullscreen' ? ' · Tam Ekran' : ' · Pencere');
        closeLaunchMenu();
        setTimeout(() => {
            sendFullInit();
            setLive(true);
            if (mode === 'fullscreen') send('autoFullscreen', {});
        }, 1300);
    }

    function toggleLaunchMenu() {
        const menu = document.getElementById('launchMenu');
        if (!menu) return;
        if (menu.classList.contains('open')) { closeLaunchMenu(); return; }
        renderMonitorList();
        menu.classList.add('open');
    }

    function closeLaunchMenu() {
        const menu = document.getElementById('launchMenu');
        if (menu) menu.classList.remove('open');
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#launchMenu') && !e.target.closest('#btnLaunchMenu')) {
            closeLaunchMenu();
        }
    });

    // ============================================================
    //  PAGE OVERVIEW STRIP
    // ============================================================
    function splitIntoPages(text) {
        const lines = (text || '').split('\n');
        const pageRe = /^(?:-{3,}|={3,}|\[PAGE\])$/i;
        const pages = [[]];
        for (const ln of lines) {
            if (pageRe.test(ln.trim())) {
                pages.push([]);
            } else {
                pages[pages.length - 1].push(ln);
            }
        }
        // Strip leading/trailing blanks per page
        const out = [];
        for (const p of pages) {
            while (p.length && !p[0].trim()) p.shift();
            while (p.length && !p[p.length - 1].trim()) p.pop();
            if (p.length) out.push(p);
        }
        return out;
    }

    function renderPageOverview() {
        const strip = document.getElementById('pageOverview');
        if (!strip) return;
        const ws = getWS();
        if (!ws || S.idx < 0 || S.idx >= ws.items.length) {
            strip.innerHTML = '<div class="po-empty">Şarkı seçin</div>';
            return;
        }
        const it = ws.items[S.idx];
        const pages = splitIntoPages(it.text || '');
        if (!pages.length) {
            strip.innerHTML = '<div class="po-empty">Bu parça henüz boş</div>';
            return;
        }
        const current = S.page || 1;
        strip.innerHTML = pages.map((pg, i) => {
            const pageNum = i + 1;
            const state = pageNum === current ? 'active' : (pageNum < current ? 'past' : 'future');
            const preview = pg.slice(0, 4).map(l => esc(l)).join('<br>');
            return `<div class="po-card ${state}" data-page="${pageNum}">
                <div class="po-num">${pageNum}/${pages.length}</div>
                <div class="po-preview">${preview || '<i>boş</i>'}</div>
            </div>`;
        }).join('');
        strip.querySelectorAll('.po-card').forEach(card => {
            card.onclick = () => {
                const p = parseInt(card.dataset.page, 10);
                if (S.connected) send('goPage', { page: p });
                S.page = p;
                updatePageUI();
                updatePreview();
                renderPageOverview();
            };
        });
    }

    // ============================================================
    //  CONTROL PANEL REORDER
    // ============================================================
    const CTRL_ORDER_KEY = 'qrp-ctrl-order';
    // IDs assigned to ctrl-boxes in original DOM order
    const CTRL_BOX_IDS = [
        'transport', 'autoInt', 'fontMin', 'fontMax', 'guide',
        'display', 'infoBar', 'chronoSize', 'theme', 'countdown',
        'message', 'shortcuts',
    ];
    // User's preferred default order: countdown, message, font settings, rest
    const CTRL_DEFAULT_ORDER = [
        'countdown', 'message', 'fontMin', 'fontMax',
        'transport', 'autoInt', 'guide', 'display',
        'infoBar', 'chronoSize', 'theme', 'shortcuts',
    ];

    function initCtrlReorder() {
        const container = document.querySelector('.controls');
        if (!container) return;
        const boxes = Array.from(container.querySelectorAll('.ctrl-box'));

        // Assign data-id by original DOM order
        boxes.forEach((b, i) => {
            if (CTRL_BOX_IDS[i]) b.dataset.id = CTRL_BOX_IDS[i];
        });

        // Inject reorder buttons (once)
        boxes.forEach(b => {
            if (b.querySelector('.box-reorder')) return;
            const reo = document.createElement('div');
            reo.className = 'box-reorder';
            reo.innerHTML = '<button class="ro-up" title="Yukarı taşı" aria-label="Yukarı">▲</button>'
                          + '<button class="ro-down" title="Aşağı taşı" aria-label="Aşağı">▼</button>';
            b.appendChild(reo);
        });

        // Apply stored or default order
        let order = CTRL_DEFAULT_ORDER;
        try {
            const raw = localStorage.getItem(CTRL_ORDER_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length) order = parsed;
            }
        } catch (_) {}
        applyCtrlOrder(container, order);

        // Event delegation for up/down
        container.addEventListener('click', (e) => {
            const up = e.target.closest('.ro-up');
            const dn = e.target.closest('.ro-down');
            if (!up && !dn) return;
            e.stopPropagation();
            const box = (up || dn).closest('.ctrl-box');
            if (!box) return;
            if (up) {
                let prev = box.previousElementSibling;
                while (prev && !prev.classList.contains('ctrl-box')) prev = prev.previousElementSibling;
                if (prev) container.insertBefore(box, prev);
            } else {
                let next = box.nextElementSibling;
                while (next && !next.classList.contains('ctrl-box')) next = next.nextElementSibling;
                if (next) container.insertBefore(next, box);
            }
            saveCtrlOrder(container);
            updateReorderDisabled(container);
            // Smooth scroll to keep the moved box in view
            box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
    }

    function applyCtrlOrder(container, order) {
        const boxes = Array.from(container.querySelectorAll('.ctrl-box'));
        const byId = {};
        boxes.forEach(b => { if (b.dataset.id) byId[b.dataset.id] = b; });
        order.forEach(id => { if (byId[id]) container.appendChild(byId[id]); });
        // Any box with unknown/new id stays after ordered ones
        boxes.forEach(b => {
            if (b.dataset.id && !order.includes(b.dataset.id)) container.appendChild(b);
        });
        updateReorderDisabled(container);
    }

    function saveCtrlOrder(container) {
        const order = Array.from(container.querySelectorAll('.ctrl-box'))
            .map(b => b.dataset.id).filter(Boolean);
        localStorage.setItem(CTRL_ORDER_KEY, JSON.stringify(order));
    }

    function updateReorderDisabled(container) {
        const boxes = container.querySelectorAll('.ctrl-box');
        boxes.forEach((b, i) => {
            const up = b.querySelector('.ro-up');
            const dn = b.querySelector('.ro-down');
            if (up) up.disabled = (i === 0);
            if (dn) dn.disabled = (i === boxes.length - 1);
        });
    }

    // ============================================================
    //  PREVIEW RESIZE (drag top bar)
    // ============================================================
    const PREVIEW_H_KEY = 'qrp-preview-h';
    const PREVIEW_H_MIN = 80;
    const PREVIEW_H_MAX = 600;

    function applyPreviewHeight(px) {
        const v = Math.max(PREVIEW_H_MIN, Math.min(PREVIEW_H_MAX, px));
        document.documentElement.style.setProperty('--preview-h', v + 'px');
        return v;
    }

    function loadPreviewHeight() {
        const saved = parseInt(localStorage.getItem(PREVIEW_H_KEY), 10);
        if (saved && !isNaN(saved)) applyPreviewHeight(saved);
        else applyPreviewHeight(180);  // varsayılan biraz büyük
    }

    function initPreviewResize() {
        const bar = document.querySelector('.preview-bar');
        const frame = document.getElementById('previewFrame');
        if (!bar || !frame) return;

        let dragging = false;
        let startY = 0;
        let startH = 0;

        bar.addEventListener('pointerdown', (e) => {
            dragging = true;
            startY = e.clientY;
            startH = frame.getBoundingClientRect().height;
            bar.classList.add('resizing');
            bar.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        bar.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            // Bar'ı yukarı sürüklemek preview'ı BÜYÜTSÜN: delta negatif olunca height artar.
            const dy = e.clientY - startY;
            const newH = applyPreviewHeight(startH - dy);
            // Live info: info bar'da anlık boyut göster
            const pvInfo = document.getElementById('pvInfo');
            if (pvInfo) pvInfo.textContent = newH + 'px';
        });

        const endDrag = (e) => {
            if (!dragging) return;
            dragging = false;
            bar.classList.remove('resizing');
            try { bar.releasePointerCapture(e.pointerId); } catch (_) {}
            // Final height → localStorage
            const h = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--preview-h'), 10);
            if (h) localStorage.setItem(PREVIEW_H_KEY, String(h));
            // pvInfo güncellemesi updatePreview çağrısı ile sayfa sayısına geri dönsün
            updatePreview();
        };
        bar.addEventListener('pointerup', endDrag);
        bar.addEventListener('pointercancel', endDrag);

        // Çift tık → varsayılan boyuta sıfırla (180px)
        bar.addEventListener('dblclick', () => {
            const h = applyPreviewHeight(180);
            localStorage.setItem(PREVIEW_H_KEY, String(h));
            updatePreview();
        });
    }

    // ============================================================
    //  INIT
    // ============================================================
    function applySettingsToUI() {
        // Sliders
        if (D.sliderFontMin) { D.sliderFontMin.value = S.fontMin; D.valFontMin.textContent = S.fontMin; }
        if (D.sliderFontMax) { D.sliderFontMax.value = S.fontMax; D.valFontMax.textContent = S.fontMax; }
        if (D.sliderGuidePos) { D.sliderGuidePos.value = S.guidePos; D.valGuidePos.textContent = S.guidePos; }
        if (D.sliderGuideW) { D.sliderGuideW.value = S.guideW; D.valGuideW.textContent = S.guideW; }
        if (D.sliderInterval) { D.sliderInterval.value = S.autoSec; D.valInterval.textContent = S.autoSec; }
        if (D.sliderChronoSize) { D.sliderChronoSize.value = S.chronoSize; D.valChronoSize.textContent = S.chronoSize; }
        if (D.sliderIbSize) { D.sliderIbSize.value = S.ibSize; D.valIbSize.textContent = S.ibSize; }
        if (D.sliderIbOpacity) { D.sliderIbOpacity.value = S.ibOpacity; D.valIbOpacity.textContent = S.ibOpacity; }
        if (D.msgSize) { D.msgSize.value = S.msgSize; if (D.msgSizeVal) D.msgSizeVal.textContent = (+S.msgSize).toFixed(1) + '×'; }
        // Checkboxes
        if (D.chkGuide) D.chkGuide.checked = S.guide;
        if (D.chkMirror) D.chkMirror.checked = S.mirror;
        if (D.chkSectionClr) D.chkSectionClr.checked = S.sectionClr;
        if (D.chkIbChrono) D.chkIbChrono.checked = S.ibShowChrono;
        // Theme buttons
        $$('.th-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === S.theme));
        // Guide color dots
        if (D.guideColors) D.guideColors.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('active', d.dataset.c === S.guideColor));
        // Apply chrono size locally
        applyChronoSize();
    }

    // ============================================================
    //  it.17.6 — BACKUP entegrasyonu
    // ============================================================
    let backupTimer = null;
    let lastBackupAt = null;

    function captureCurrentState() {
        let workspaces = {};
        let settings = {};
        let libOverrides = {};
        let session = null;
        try { workspaces = JSON.parse(localStorage.getItem('qrp-workspaces') || '{}'); } catch (_) {}
        try { settings = JSON.parse(localStorage.getItem('qrp-settings') || '{}'); } catch (_) {}
        try { libOverrides = JSON.parse(localStorage.getItem('qrp-lib-overrides') || '{}'); } catch (_) {}
        try { session = JSON.parse(localStorage.getItem('qrp-session') || 'null'); } catch (_) {}
        return {
            workspaces,
            activeWS: localStorage.getItem('qrp-active-ws') || null,
            settings,
            libOverrides,
            session,
            libWsCreated: localStorage.getItem('qrp-lib-ws-created') || null,
        };
    }

    function applySnapshotToLocalStorage(snap) {
        if (!snap) return;
        if (snap.workspaces !== undefined) localStorage.setItem('qrp-workspaces', JSON.stringify(snap.workspaces));
        if (snap.activeWS) localStorage.setItem('qrp-active-ws', snap.activeWS);
        if (snap.settings !== undefined) localStorage.setItem('qrp-settings', JSON.stringify(snap.settings));
        if (snap.libOverrides !== undefined) localStorage.setItem('qrp-lib-overrides', JSON.stringify(snap.libOverrides));
        if (snap.session) localStorage.setItem('qrp-session', JSON.stringify(snap.session));
        if (snap.libWsCreated) localStorage.setItem('qrp-lib-ws-created', snap.libWsCreated);
    }

    function updateBackupUI() {
        if (!D.backupStatus) return;
        if (window.QRBackup && window.QRBackup.isConnected()) {
            D.backupStatus.classList.remove('saving', 'err', 'warn');
            D.backupStatus.classList.add('on');
            D.backupStatus.title = lastBackupAt
                ? ('Bağlı · son yedek: ' + window.QRBackup.formatDateForUI(lastBackupAt))
                : 'Bağlı · henüz yedek yok';
        } else {
            D.backupStatus.classList.remove('on', 'saving', 'err');
            D.backupStatus.title = 'Bağlı değil — Yedekle butonuna basıp klasör seç';
        }
    }

    async function runBackup(trigger) {
        if (!window.QRBackup || !window.QRBackup.isConnected()) return false;
        try {
            if (D.backupStatus) D.backupStatus.classList.add('saving');
            const snap = captureCurrentState();
            const name = await window.QRBackup.saveSnapshot(snap, trigger);
            // autoSave snapshotları için 30 dosya rotation
            await window.QRBackup.pruneOld(30);
            lastBackupAt = new Date();
            console.log('[Backup] saved:', name, 'trigger:', trigger);
            if (D.backupStatus) {
                D.backupStatus.classList.remove('saving', 'err');
                D.backupStatus.classList.add('on');
            }
            updateBackupUI();
            return true;
        } catch (e) {
            console.warn('[Backup] save failed:', e);
            if (D.backupStatus) {
                D.backupStatus.classList.remove('saving', 'on');
                D.backupStatus.classList.add('err');
            }
            return false;
        }
    }

    function scheduleBackup(trigger, delayMs) {
        if (!window.QRBackup || !window.QRBackup.isConnected()) return;
        if (delayMs == null) delayMs = 5000;
        if (delayMs <= 0) { runBackup(trigger); return; }
        clearTimeout(backupTimer);
        backupTimer = setTimeout(() => runBackup(trigger), delayMs);
    }

    async function ensureBackupConnected() {
        if (!window.QRBackup) return false;
        if (window.QRBackup.isConnected()) return true;
        // Önce mevcut handle'ın permission'ı geri verilebilir mi
        if (await window.QRBackup.resumePermission()) {
            updateBackupUI();
            return true;
        }
        // Yoksa kullanıcıdan klasör seçimi iste
        try {
            await window.QRBackup.connect();
            updateBackupUI();
            return true;
        } catch (e) {
            console.warn('[Backup] connect failed:', e);
            alert('Backup klasörü bağlanamadı:\n' + (e && e.message ? e.message : 'Bilinmeyen hata'));
            return false;
        }
    }

    async function backupSaveNow() {
        if (!await ensureBackupConnected()) return;
        const ok = await runBackup('manual');
        if (ok && D.btnBackupSave) {
            const old = D.btnBackupSave.textContent;
            D.btnBackupSave.textContent = '✓ Yedeklendi';
            setTimeout(() => D.btnBackupSave.textContent = old, 1200);
        }
    }

    async function refreshBackupList() {
        if (!D.backupList) return;
        if (!window.QRBackup.isConnected()) {
            D.backupList.innerHTML = '<div class="backup-empty">Klasör bağlı değil. Üstten <b>📂 Klasör Seç</b>.</div>';
            if (D.backupInfo) D.backupInfo.textContent = '—';
            return;
        }
        try {
            const list = await window.QRBackup.listSnapshots();
            if (!list.length) {
                D.backupList.innerHTML = '<div class="backup-empty">Henüz yedek yok. <b>💾 Şimdi Yedekle</b> ile ilk yedeği oluştur.</div>';
                if (D.backupInfo) D.backupInfo.textContent = '0 yedek';
                return;
            }
            // Yeni → eski sıralama
            const reversed = list.slice().reverse();
            D.backupList.innerHTML = reversed.map(s => {
                const dStr = window.QRBackup.formatDateForUI(s.date);
                const sizeKB = (s.size / 1024).toFixed(1);
                return `
                <div class="backup-row" data-name="${s.name}">
                    <div class="backup-row-info">
                        <div class="backup-row-date">${dStr}</div>
                        <div class="backup-row-meta">
                            <span class="backup-row-name">${s.name}</span>
                            <span>${sizeKB} KB</span>
                        </div>
                    </div>
                    <div class="backup-row-actions">
                        <button class="btn btn-sm btn-outline" data-act="load" title="Bu yedekten geri yükle">↺ Yükle</button>
                        <button class="btn btn-sm btn-danger-outline" data-act="del" title="Yedeği sil">✕</button>
                    </div>
                </div>`;
            }).join('');
            if (D.backupInfo) D.backupInfo.textContent = list.length + ' yedek';

            // Wire row actions
            D.backupList.querySelectorAll('.backup-row').forEach(row => {
                const name = row.dataset.name;
                row.querySelectorAll('button[data-act]').forEach(btn => {
                    btn.onclick = async () => {
                        const act = btn.dataset.act;
                        if (act === 'load') {
                            if (!confirm('Bu yedekten yüklensin mi? Mevcut çalışma alanı yedek içeriğiyle değiştirilecek ve sayfa yenilenecek.')) return;
                            try {
                                const snap = await window.QRBackup.loadSnapshot(name);
                                applySnapshotToLocalStorage(snap);
                                location.reload();
                            } catch (e) {
                                alert('Yükleme başarısız:\n' + (e && e.message ? e.message : 'Bilinmeyen hata'));
                            }
                        } else if (act === 'del') {
                            if (!confirm(name + ' silinsin mi?')) return;
                            try {
                                await window.QRBackup.deleteSnapshot(name);
                                refreshBackupList();
                            } catch (e) {
                                alert('Silme başarısız.');
                            }
                        }
                    };
                });
            });
        } catch (e) {
            D.backupList.innerHTML = '<div class="backup-empty">Liste alınamadı: ' + (e && e.message ? e.message : 'hata') + '</div>';
        }
    }

    function openBackupModal() {
        if (!D.backupModal) return;
        D.backupModal.hidden = false;
        refreshBackupList();
    }
    function closeBackupModal() {
        if (D.backupModal) D.backupModal.hidden = true;
    }

    // Buton bağlamaları
    if (D.btnBackupSave) D.btnBackupSave.onclick = backupSaveNow;
    if (D.btnBackupList) D.btnBackupList.onclick = openBackupModal;
    if (D.btnBackupClose) D.btnBackupClose.onclick = closeBackupModal;
    if (D.btnBackupSaveNow) D.btnBackupSaveNow.onclick = backupSaveNow;
    if (D.btnBackupRefresh) D.btnBackupRefresh.onclick = refreshBackupList;
    if (D.btnBackupConnect) D.btnBackupConnect.onclick = async () => {
        try {
            await window.QRBackup.connect();
            updateBackupUI();
            refreshBackupList();
        } catch (e) {
            alert('Klasör bağlanamadı:\n' + (e && e.message ? e.message : ''));
        }
    };
    if (D.backupModal) D.backupModal.addEventListener('click', e => {
        if (e.target === D.backupModal) closeBackupModal();
    });

    // Açılışta sessiz init (yetki düştüyse user gesture'a bekler)
    if (window.QRBackup) {
        window.QRBackup.init().then(connected => {
            updateBackupUI();
            if (connected) {
                // Açılış snapshot'ı (sessiz, debounced 2sn — diğer init işleri otursun)
                setTimeout(() => runBackup('startup'), 2000);
            }
        }).catch(() => updateBackupUI());
    }

    loadSettings();
    loadLibOverrides();
    loadAll();
    loadSession();
    applySettingsToUI();
    renderWSSelect();
    renderSL();
    // Restore selected item if session had one, else pick first
    const _ws0 = getWS();
    if (_ws0 && _ws0.items.length) {
        const idx = (S.idx >= 0 && S.idx < _ws0.items.length) ? S.idx : 0;
        pickItem(idx);
    }
    loadLyricsDB();
    initMonitors();
    loadPreviewHeight();
    initPreviewResize();
    initCtrlReorder();


    // Warn before closing
    window.addEventListener('beforeunload', e => {
        saveAll();
        saveSession();
        if (S.connected) { e.preventDefault(); e.returnValue = ''; }
    });
    // Autosave on tab hide
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') { saveAll(); saveSession(); }
    });

})();
