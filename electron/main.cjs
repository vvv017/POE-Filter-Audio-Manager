const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, dialog, ipcMain } = require("electron");

let serverInstance = null;
let mainWindow = null;
const designSize = { width: 1280, height: 820 };

function loadingPageUrl() {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>POE Filter Audio Manager</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        width: 100vw;
        height: 100vh;
        display: grid;
        place-items: center;
        background: #11110f;
        color: #f0eee7;
        font-family: "Segoe UI", Arial, sans-serif;
      }
      .startup {
        display: grid;
        gap: 10px;
        justify-items: center;
      }
      .mark {
        width: 44px;
        height: 44px;
        border: 3px solid rgba(224, 195, 101, 0.28);
        border-top-color: #e0c365;
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
      }
      .title {
        font-size: 17px;
        font-weight: 700;
      }
      .status {
        color: #a9a493;
        font-size: 13px;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <main class="startup" aria-live="polite">
      <div class="mark" aria-hidden="true"></div>
      <div class="title">POE Filter Audio Manager</div>
      <div class="status">Starting...</div>
    </main>
  </body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

async function startLocalServer() {
  const serverModulePath = pathToFileURL(path.join(app.getAppPath(), "server.js")).href;
  const { startServer } = await import(serverModulePath);
  const started = await startServer({ port: 0, host: "127.0.0.1" });
  serverInstance = started.server;
  return started.url;
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 820,
    minWidth: 820,
    minHeight: 520,
    backgroundColor: "#0f1110",
    icon: path.join(app.getAppPath(), "assets", "app-icon.png"),
    title: "POE Filter Audio Manager",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    updateWindowScale();
    if (mainWindow) mainWindow.show();
  });

  mainWindow.on("resize", updateWindowScale);
  mainWindow.webContents.on("did-finish-load", updateWindowScale);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(loadingPageUrl());
  const url = await startLocalServer();
  if (!mainWindow) return;
  await mainWindow.loadURL(url);
}

function updateWindowScale() {
  if (!mainWindow) return;
  const bounds = mainWindow.getContentBounds();
  const scale = Math.max(0.68, Math.min(1, bounds.width / designSize.width, bounds.height / designSize.height));
  mainWindow.webContents.setZoomFactor(scale);
}

function stopLocalServer() {
  if (!serverInstance) return;
  serverInstance.close();
  serverInstance = null;
}

ipcMain.handle("choose-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select audio folder",
    properties: ["openDirectory"]
  });

  return result.canceled ? "" : result.filePaths[0] || "";
});

app.whenReady().then(createMainWindow).catch(error => {
  dialog.showErrorBox("POE Filter Audio Manager", error?.message || String(error));
  app.exit(1);
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  stopLocalServer();
});
