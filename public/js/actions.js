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
import { hasNativeDesktop, nativeChooseFolder, nativeDefaultFolders, nativeListAudioFiles } from "./native.js";
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
  } catch (error) {
    const message = hasLocalFolderAccess() && !state.dirHandle
      ? t("chooseFolderFirst")
      : translateServerError(error.message, state.lang) || t("actionFailed");
    pushLogText(message);
  } finally {
    els.loadButton.disabled = false;
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
