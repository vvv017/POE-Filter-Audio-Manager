const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, dialog, ipcMain } = require("electron");

let serverInstance = null;
let mainWindow = null;
const designSize = { width: 1280, height: 820 };

async function startLocalServer() {
  const serverModulePath = pathToFileURL(path.join(app.getAppPath(), "server.js")).href;
  const { startServer } = await import(serverModulePath);
  const started = await startServer({ port: 0, host: "127.0.0.1" });
  serverInstance = started.server;
  return started.url;
}

async function createMainWindow() {
  const url = await startLocalServer();

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
