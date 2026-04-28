const {
    app, BrowserWindow, ipcMain, shell,
    Tray, Menu, globalShortcut, nativeImage, screen, dialog,
} = require('electron');
const path = require('path');
const net  = require('net');
const fs   = require('fs');

const DEFAULT_HOTKEY = 'Alt+`';

let mainWindow;
let tray;

// ── Port utilities ────────────────────────────────────────────────────────────

function findFreePort(preferred = 3000) {
    return new Promise((resolve) => {
        const s = net.createServer();
        s.listen(preferred, () => { s.close(() => resolve(preferred)); });
        s.on('error', () => {
            const s2 = net.createServer();
            s2.listen(0, () => { const p = s2.address().port; s2.close(() => resolve(p)); });
        });
    });
}

function waitForPort(port, retries = 30) {
    return new Promise((resolve, reject) => {
        const attempt = () => {
            const s = net.createConnection(port, '127.0.0.1');
            s.on('connect', () => { s.destroy(); resolve(); });
            s.on('error', () => {
                if (--retries <= 0) return reject(new Error('Express server did not start in time'));
                setTimeout(attempt, 200);
            });
        };
        attempt();
    });
}

// ── Window toggle ─────────────────────────────────────────────────────────────

function toggleWindow() {
    if (!mainWindow) return;
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
        const currentUrl = mainWindow.webContents.getURL();
        const port = process.env.PORT;
        
        // If we are currently in an app (not on the dashboard), go to dashboard instead of hiding
        if (port && !currentUrl.startsWith(`http://localhost:${port}`)) {
            mainWindow.loadURL(`http://localhost:${port}`);
        } else {
            // We are on the dashboard, so hide the app
            mainWindow.hide();
        }
    } else {
        mainWindow.show();
        mainWindow.focus();
        if (!mainWindow.isMaximized()) mainWindow.maximize();
        mainWindow.setFullScreen(true);
    }
}

// ── Single instance lock ──────────────────────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    // ── App ready ─────────────────────────────────────────────────────────────

    app.whenReady().then(async () => {
        try {
            // userData = %APPDATA%\Easy HTUI\ — always writable, works in packaged + portable
            const userData = app.getPath('userData');
            const configPath = path.join(userData, 'config', 'config.json');

            // Bootstrap on first run: create dirs and copy default config
            if (!fs.existsSync(configPath)) {
                fs.mkdirSync(path.join(userData, 'config', 'backups'), { recursive: true });
                fs.mkdirSync(path.join(userData, 'logs'),              { recursive: true });
                fs.mkdirSync(path.join(userData, 'launchers'),         { recursive: true });
                // default_config.json lives in asarUnpack — Electron resolves the real path
                const defaultCfg = path.join(__dirname, 'default_config.json');
                fs.copyFileSync(defaultCfg, configPath);
            }

            // Tell server.js where to write its data
            process.env.APP_DATA_DIR = userData;

            // Start Express server
            const port = await findFreePort(3000);
            process.env.PORT = port;
            require('./server.js');
            await waitForPort(port);

            // Create window
            const { width, height } = screen.getPrimaryDisplay().workAreaSize;
            mainWindow = new BrowserWindow({
                width,
                height,
                fullscreen: false,          // change to true (or kiosk: true) for dedicated TV use
                backgroundColor: '#0d0d0d', // prevents white flash before page loads
                autoHideMenuBar: true,
                title: 'Easy HTUI',
                webPreferences: {
                    preload: path.join(__dirname, 'preload.js'),
                    contextIsolation: true,
                    nodeIntegration: false,
                },
            });

            mainWindow.loadURL(`http://localhost:${port}`);
            mainWindow.maximize();

            // Route steam/epic URLs to the system, but allow web apps to load in the launcher
            mainWindow.webContents.on('will-navigate', (event, url) => {
                if (!url.startsWith(`http://localhost:${port}`)) {
                    if (url.startsWith('http://') || url.startsWith('https://')) {
                        // Allow web navigation to happen within the Electron app
                        return;
                    }
                    event.preventDefault();
                    shell.openExternal(url);
                }
            });
            mainWindow.webContents.setWindowOpenHandler(({ url }) => {
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    // If a link tries to open in a new window (target="_blank"), 
                    // force it to open in the current window instead.
                    mainWindow.loadURL(url);
                    return { action: 'deny' };
                }
                shell.openExternal(url);
                return { action: 'deny' };
            });

            // Input interception (F12 for DevTools, Escape/Back to return to dashboard)
            mainWindow.webContents.on('before-input-event', (event, input) => {
                if (input.key === 'F12') {
                    mainWindow.webContents.openDevTools();
                }
                
                if (input.type === 'keyDown' && (input.key === 'Escape' || input.key === 'BrowserBack' || input.key === 'BrowserHome')) {
                    const currentUrl = mainWindow.webContents.getURL();
                    if (!currentUrl.startsWith(`http://localhost:${port}`) || input.key === 'BrowserHome') {
                        event.preventDefault();
                        mainWindow.loadURL(`http://localhost:${port}`);
                    }
                }
            });

            // Closing the window hides to tray instead of quitting
            mainWindow.on('close', (e) => {
                if (!app.isQuitting) {
                    e.preventDefault();
                    mainWindow.hide();
                }
            });

            // ── System tray ───────────────────────────────────────────────────

            const iconDir = __dirname.includes('app.asar') ? __dirname.replace('app.asar', 'app.asar.unpacked') : __dirname;
            const iconPath = path.join(iconDir, 'assets', 'icons', 'icon.ico');
            const trayIcon = fs.existsSync(iconPath)
                ? nativeImage.createFromPath(iconPath)
                : nativeImage.createEmpty();

            tray = new Tray(trayIcon);
            tray.setToolTip('Easy HTUI');
            tray.on('click', toggleWindow);
            tray.setContextMenu(Menu.buildFromTemplate([
                { label: 'Show / Hide',        click: toggleWindow },
                {
                    label: 'Start with Windows',
                    type: 'checkbox',
                    checked: app.getLoginItemSettings().openAtLogin,
                    click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
                },
                { type: 'separator' },
                { label: 'Quit Easy HTUI', click: () => { app.isQuitting = true; app.quit(); } },
            ]));

            // ── Global hotkey ─────────────────────────────────────────────────

            // Read hotkey from config
            let userHotkey = DEFAULT_HOTKEY;
            try {
                const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (configData.hotkey) {
                    userHotkey = configData.hotkey;
                }
            } catch (e) {
                // ignore
            }

            const success = globalShortcut.register(userHotkey, toggleWindow);
            if (!success) {
                console.log('Failed to register hotkey', userHotkey, ', falling back to default');
                globalShortcut.register(DEFAULT_HOTKEY, toggleWindow);
            }

        } catch (err) {
            // Show a visible error dialog instead of crashing silently
            dialog.showErrorBox('Easy HTUI — startup error', err.stack || err.message);
            app.quit();
        }
    });

    app.on('window-all-closed', () => {
        // Do not quit — the tray keeps the app alive
    });

    app.on('will-quit', () => {
        globalShortcut.unregisterAll();
    });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('toggle-fullscreen', () => {
    if (!mainWindow) return false;
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    return mainWindow.isFullScreen();
});

ipcMain.handle('quit-app', () => {
    app.isQuitting = true;
    app.quit();
});

ipcMain.handle('set-hotkey', (_e, accelerator) => {
    globalShortcut.unregisterAll();
    if (!accelerator) {
        globalShortcut.register(DEFAULT_HOTKEY, toggleWindow);
        return { ok: false };
    }
    const success = globalShortcut.register(accelerator, toggleWindow);
    if (!success) {
        globalShortcut.register(DEFAULT_HOTKEY, toggleWindow);
        return { ok: false };
    }
    return { ok: true };
});
