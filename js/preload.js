// ============================================================
//  QR Production Prompter — Electron Preload
//  it.18: storage.js'in Electron adapter'ı için bridge
// ============================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    fs: {
        list:   ()             => ipcRenderer.invoke('backup:list'),
        save:   (name, json)   => ipcRenderer.invoke('backup:save', name, json),
        load:   (name)         => ipcRenderer.invoke('backup:load', name),
        remove: (name)         => ipcRenderer.invoke('backup:remove', name),
        path:   ()             => ipcRenderer.invoke('backup:path'),
    },
});

contextBridge.exposeInMainWorld('IS_ELECTRON', true);
