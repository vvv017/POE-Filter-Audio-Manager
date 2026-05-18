import { chooseFolder, loadDefaults, loadFolder } from "./js/actions.js";
import { els, refs, state } from "./js/context.js";
import { renderDefaultFolders, renderFiles, selectFile, updateSelectedLabels } from "./js/files.js";
import { applyLanguage, setLanguage } from "./js/language.js";
import { renderLog } from "./js/log.js";
import {
  applyManualRename,
  applyRename,
  closeManualRename,
  openManualRename,
  updateConflictStatus,
  updateManualRenameStatus
} from "./js/inspector.js";
import {
  closeRuleEditor,
  openRuleEditor,
  renderRules,
  renderTargetOptions,
  saveRuleFromForm
} from "./js/rules.js";
import { setPreviewVolume } from "./js/volume.js";

Object.assign(refs, {
  closeManualRename,
  loadFolder,
  renderDefaultFolders,
  renderFiles,
  renderLog,
  renderRules,
  renderTargetOptions,
  selectFile,
  updateConflictStatus,
  updateManualRenameStatus,
  updateSelectedLabels
});

els.folderInput.value = state.dir;
els.languageToggle.addEventListener("click", () => setLanguage(state.lang === "zh" ? "en" : "zh"));
els.browseFolderButton.addEventListener("click", chooseFolder);
els.loadButton.addEventListener("click", loadFolder);
els.reloadButton.addEventListener("click", () => {
  if (state.dir) loadFolder();
});
els.volumeSlider.addEventListener("input", event => setPreviewVolume(event.target.value));
els.folderInput.addEventListener("keydown", event => {
  if (event.key === "Enter") loadFolder();
});
els.searchInput.addEventListener("input", renderFiles);
els.ruleFilter.addEventListener("change", renderFiles);
els.targetRule.addEventListener("change", () => {
  renderRules();
  updateConflictStatus();
});
els.strategySelect.addEventListener("change", updateConflictStatus);
els.strategySelect.addEventListener("change", updateManualRenameStatus);
els.applyButton.addEventListener("click", applyRename);
els.editNameButton.addEventListener("click", openManualRename);
els.manualRenameForm.addEventListener("submit", applyManualRename);
els.manualNameInput.addEventListener("input", updateManualRenameStatus);
els.cancelManualRenameButton.addEventListener("click", closeManualRename);
els.addRuleButton.addEventListener("click", () => openRuleEditor());
els.ruleEditor.addEventListener("submit", saveRuleFromForm);
els.cancelRuleButton.addEventListener("click", closeRuleEditor);
els.clearLogButton.addEventListener("click", () => {
  state.log = [];
  renderLog();
});

renderTargetOptions();
renderRules();
renderFiles();
setPreviewVolume(state.volume);
applyLanguage();
if (!window.poeDesktop?.chooseFolder) {
  els.browseFolderButton.hidden = true;
  document.querySelector(".folder-strip")?.classList.add("no-folder-picker");
}
loadDefaults();

if (state.dir) {
  loadFolder();
}
