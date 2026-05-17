import { apiUrl, requestJson } from "./api.js";
import { els, refs, state } from "./context.js";
import { t } from "./i18n.js";
import { pushLog, pushLogText } from "./log.js";
import { STORAGE_KEYS } from "./constants.js";
import { translateServerError } from "./utils.js";

export async function loadDefaults() {
  const payload = await requestJson("/api/default-folders").catch(() => ({ folders: [] }));
  refs.renderDefaultFolders?.(payload.folders || []);
}

export async function loadFolder() {
  const dir = els.folderInput.value.trim();
  if (!dir) {
    pushLog("folderRequired");
    return;
  }

  try {
    els.loadButton.disabled = true;
    const payload = await requestJson(apiUrl("/api/files", { dir }));
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
    pushLogText(translateServerError(error.message, state.lang) || t("actionFailed"));
  } finally {
    els.loadButton.disabled = false;
  }
}
