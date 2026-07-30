import { apiUrl, requestJson } from "./api.js";
import { els, refs, state } from "./context.js";
import { t } from "./i18n.js";
import { pushLog, pushLogText } from "./log.js";
import { STORAGE_KEYS } from "./constants.js";
import {
  hasLocalFolderAccess,
  listLocalAudioFiles,
  localDefaultFolders,
  loadFolderHistory,
  pickLocalFolder,
  saveFolderHistory
} from "./local-files.js";
import {
  hasNativeDesktop,
  nativeChooseFolder,
  nativeDefaultFolders,
  nativeListAudioFiles,
  nativeOpenFolder,
  nativePackageZip
} from "./native.js";
import { translateServerError } from "./utils.js";

export async function loadDefaults() {
  if (hasNativeDesktop()) {
    refs.renderDefaultFolders?.(await nativeDefaultFolders().catch(() => []));
    return;
  }

  if (hasLocalFolderAccess()) {
    const history = await loadFolderHistory().catch(() => []);
    const names = new Set(history.map(folder => folder.name.toLowerCase()));
    const defaults = localDefaultFolders().filter(folder => !names.has(folder.name.toLowerCase()));
    refs.renderDefaultFolders?.([...history, ...defaults]);
    return;
  }

  const payload = await requestJson("/api/default-folders").catch(() => ({ folders: [] }));
  refs.renderDefaultFolders?.(payload.folders || []);
}

export async function loadFolder() {
  const dir = els.folderInput.value.trim();
  if (!dir && !state.dirHandle) {
    pushLog("folderRequired");
    return;
  }

  try {
    els.loadButton.disabled = true;
    const payload = hasNativeDesktop()
      ? await nativeListAudioFiles(dir)
      : state.dirHandle
      ? { dir: state.dirHandle.name, files: await listLocalAudioFiles(state.dirHandle) }
      : await requestJson(apiUrl("/api/files", { dir }));
    state.dir = payload.dir;
    state.files = payload.files;
    state.selected = null;
    state.packageResult = null;
    state.packageSelection.clear();
    state.audioRevision = Date.now();
    localStorage.setItem(STORAGE_KEYS.dir, state.dir);
    els.folderInput.value = state.dir;
    els.folderSummary.textContent = t("loadedSummary", { count: state.files.length, dir: state.dir });
    els.selectedName.textContent = t("chooseAudio");
    els.selectionBadge.textContent = t("notSelected");
    els.editNameButton.disabled = true;
    refs.closeManualRename?.();
    els.audioPlayer.removeAttribute("src");
    pushLog("loadedLog", { count: state.files.length });
    refs.renderFiles?.();
    refs.updateConflictStatus?.();
    closePackageStatus();
    updatePackageControls();
  } catch (error) {
    const message = hasLocalFolderAccess() && !state.dirHandle
      ? t("chooseFolderFirst")
      : translateServerError(error.message, state.lang) || t("actionFailed");
    pushLogText(message);
  } finally {
    els.loadButton.disabled = false;
  }
}

export async function packageSelectedFiles() {
  const files = [...state.packageSelection];
  if (!files.length) {
    pushLog("packageNoFiles");
    return;
  }

  try {
    state.packaging = true;
    state.packageResult = null;
    setPackageStatus("busy", t("packageWorking", { count: files.length }));
    updatePackageControls();
    const result = hasNativeDesktop()
      ? await nativePackageZip({ dir: state.dir, files, packageBase: els.packageNameInput.value })
      : state.dirHandle
      ? null
      : (await requestJson("/api/package-zip", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dir: state.dir, files, packageBase: els.packageNameInput.value })
        })).result;

    if (!result) {
      setPackageStatus("error", t("packageUnsupported"));
      pushLog("packageUnsupported");
      return;
    }

    state.packageResult = { dir: state.dir, target: result.target };
    setPackageStatus("done", t("packageDone", { target: result.target }));
    pushLog("packageCreated", { count: result.count, target: result.target });
  } catch (error) {
    const message = translateServerError(error.message, state.lang) || t("actionFailed");
    setPackageStatus("error", message);
    pushLogText(message);
  } finally {
    state.packaging = false;
    updatePackageControls();
  }
}

export async function openPackageFolder() {
  if (!state.packageResult) return;

  try {
    els.openPackageFolderButton.disabled = true;
    if (hasNativeDesktop()) {
      await nativeOpenFolder({ dir: state.packageResult.dir, file: state.packageResult.target });
    } else if (state.dirHandle) {
      pushLog("packageOpenUnsupported");
      return;
    } else {
      await requestJson("/api/open-folder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dir: state.packageResult.dir, file: state.packageResult.target })
      });
    }
    pushLog("packageFolderOpened", { target: state.packageResult.target });
  } catch (error) {
    pushLogText(translateServerError(error.message, state.lang) || t("actionFailed"));
  } finally {
    els.openPackageFolderButton.disabled = false;
  }
}

export function closePackageStatus() {
  els.packageStatus.hidden = true;
  els.packageStatus.className = "package-status";
}

export function updatePackageControls() {
  const count = state.packageSelection.size;
  els.packageSelectionCount.textContent = t("packageSelectionCount", { count });
  els.packageButton.textContent = state.packaging ? t("packaging") : t("packageZip");
  els.packageButton.disabled = state.packaging || count === 0 || !els.packageNameInput.value.trim();
}

function setPackageStatus(type, message) {
  els.packageStatus.hidden = false;
  els.packageStatus.className = `package-status ${type}`;
  els.packageStatusText.textContent = message;
  els.openPackageFolderButton.hidden = type !== "done";
  els.closePackageStatusButton.hidden = type === "busy";
  if (type === "busy") {
    els.packageProgress.removeAttribute("value");
  } else {
    els.packageProgress.max = 1;
    els.packageProgress.value = type === "done" ? 1 : 0;
  }
}

export async function chooseFolder(pickerId) {
  if (hasNativeDesktop()) {
    try {
      els.browseFolderButton.disabled = true;
      const dir = await nativeChooseFolder();
      if (!dir) return;
      state.dirHandle = null;
      els.folderInput.value = dir;
      await loadFolder();
      await loadDefaults();
    } catch (error) {
      pushLogText(translateServerError(error.message, state.lang) || t("actionFailed"));
    } finally {
      els.browseFolderButton.disabled = false;
    }
    return;
  }

  if (!hasLocalFolderAccess()) {
    pushLog("folderPickerUnavailable");
    return;
  }

  try {
    els.browseFolderButton.disabled = true;
    state.dirHandle = await pickLocalFolder(pickerId);
    els.folderInput.value = state.dirHandle.name;
    refs.renderDefaultFolders?.(await saveFolderHistory(state.dirHandle).catch(() => []));
    await loadFolder();
  } catch (error) {
    if (error.name === "AbortError") return;
    pushLogText(translateServerError(error.message, state.lang) || t("actionFailed"));
  } finally {
    els.browseFolderButton.disabled = false;
  }
}
