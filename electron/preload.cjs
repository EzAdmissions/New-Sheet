const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('breakFlowDesktop', {
  platform: process.platform,

  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Called on mount — returns any breakflow:// URL that arrived before React loaded
  getPendingAuthUrl: () => ipcRenderer.invoke('get-pending-auth-url'),

  // Called for live second-instance OAuth callbacks (app was already open)
  onAuthCallback: (cb) => {
    const listener = (_event, url) => cb(url);
    ipcRenderer.on('auth-callback', listener);
    return () => ipcRenderer.removeListener('auth-callback', listener);
  },

});
