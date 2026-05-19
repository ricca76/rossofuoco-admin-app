const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kds', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
});
