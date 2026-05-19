const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('newSheetDesktop', {
  platform: process.platform,
});
