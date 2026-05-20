// Run with: npx electron scripts/generate-banner.cjs
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const WIDTH = 1456;
  const HEIGHT = 816;

  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    overflow: hidden;
    background: #f8fafc;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Arial, Helvetica, sans-serif;
  }
  .logo-wrap {
    display: flex;
    align-items: center;
    gap: 36px;
  }
  .ns-logo {
    width: 128px;
    height: 128px;
    border-radius: 30px;
    background: #1f2933;
    color: #f8fafc;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    font-weight: 900;
    letter-spacing: 0;
    box-shadow: 0 6px 24px rgba(0,0,0,0.22);
    flex-shrink: 0;
  }
  .name {
    font-size: 82px;
    font-weight: 800;
    color: #111111;
    letter-spacing: -2px;
  }
</style>
</head>
<body>
<div class="logo-wrap">
  <div class="ns-logo">NS</div>
  <span class="name">New Sheet</span>
</div>
</body>
</html>`;

  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  await win.loadURL(dataUrl);

  await new Promise(resolve => setTimeout(resolve, 1000));

  const image = await win.webContents.capturePage({ x: 0, y: 0, width: WIDTH, height: HEIGHT });
  const pngBuffer = image.toPNG();

  const outputPath = path.resolve(__dirname, '..', 'new-sheet-banner.png');
  fs.writeFileSync(outputPath, pngBuffer);
  console.log('Banner saved to:', outputPath);

  app.quit();
});
