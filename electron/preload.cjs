const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("poeDesktop", {
  chooseFolder: () => ipcRenderer.invoke("choose-folder")
});

window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("desktop-app");
});
