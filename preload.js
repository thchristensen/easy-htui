const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
    quitApp:          () => ipcRenderer.invoke('quit-app'),
    setHotkey:        (accelerator) => ipcRenderer.invoke('set-hotkey', accelerator),
});
