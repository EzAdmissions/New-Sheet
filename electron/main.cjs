const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

const isDev = process.argv.includes('--dev');
const iconPath = path.join(__dirname, '..', 'build', 'icon.png');

// Single-instance lock — required for Windows OAuth callback via second-instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Register breakflow:// as the default protocol client.
// Must include the script path when running unpackaged (process.defaultApp = true),
// otherwise Windows can't reconstruct the correct launch command.
if (process.defaultApp) {
  app.setAsDefaultProtocolClient('breakflow', process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient('breakflow');
}

// Holds a breakflow:// URL that arrived before the renderer was ready
let pendingAuthUrl = null;

function extractBreakflowUrl(args) {
  return args.find(arg => arg.startsWith('breakflow://'));
}

function sendAuthCallback(url) {
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) {
    wins[0].webContents.send('auth-callback', url);
    if (wins[0].isMinimized()) wins[0].restore();
    wins[0].focus();
  } else {
    // Window not open yet — store for renderer to pick up after mount
    pendingAuthUrl = url;
  }
}

// Windows: the OAuth redirect opens a second instance with the URL in args
app.on('second-instance', (_event, commandLine) => {
  const url = extractBreakflowUrl(commandLine);
  if (url) sendAuthCallback(url);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: 'New Sheet',
    icon: iconPath,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL('http://127.0.0.1:5174/?v=latest');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank') return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  ipcMain.handle('open-external', (_event, url) => {
    shell.openExternal(url);
  });

  // Renderer calls this on mount to claim any auth URL that arrived before React loaded
  ipcMain.handle('get-pending-auth-url', () => {
    const url = pendingAuthUrl;
    pendingAuthUrl = null;
    return url ?? null;
  });

  // If this instance was launched directly by the breakflow:// redirect (app wasn't open),
  // the URL is in process.argv — store it for the renderer to pick up
  const startUrl = extractBreakflowUrl(process.argv);
  if (startUrl) pendingAuthUrl = startUrl;

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// macOS: breakflow:// URLs arrive via open-url, not command line
app.on('open-url', (event, url) => {
  event.preventDefault();
  sendAuthCallback(url);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
