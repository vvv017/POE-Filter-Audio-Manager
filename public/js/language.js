import { els, refs, state } from "./context.js";
import { t } from "./i18n.js";
import { saveLanguage } from "./storage.js";

export function setLanguage(lang) {
  state.lang = lang === "en" ? "en" : "zh";
  saveLanguage(state.lang);
  applyLanguage();
}

export function applyLanguage() {
  document.documentElement.lang = t("languageCode");
  els.languageToggle.textContent = t("switchLabel");
  els.languageToggle.title = t("switchLanguage");
  els.languageToggle.setAttribute("aria-label", t("switchLanguage"));

  els.folderSummary.textContent = state.dir ? t("loadedSummary", { count: state.files.length, dir: state.dir }) : t("noFolder");
  setLabelFor("folderInput", t("audioFolder"));
  setLabelFor("volumeSlider", t("volume"));
  setLabelFor("ruleSlot", t("slot"));
  setLabelFor("ruleKey", t("key"));
  setLabelFor("ruleLabel", t("displayName"));
  setLabelFor("manualNameInput", t("manualFileName"));
  setLabelFor("targetRule", t("targetFileName"));
  setLabelFor("strategySelect", t("conflictStrategy"));

  document.querySelector(".volume-control")?.setAttribute("aria-label", t("previewVolume"));
  document.querySelector(".folder-strip")?.setAttribute("aria-label", t("folderSettings"));
  els.folderInput.placeholder = t("folderPlaceholder");
  els.browseFolderButton.title = t("browseFolder");
  els.browseFolderButton.setAttribute("aria-label", t("browseFolder"));
  els.loadButton.textContent = t("load");
  els.reloadButton.title = t("refresh");
  els.reloadButton.setAttribute("aria-label", t("refresh"));
  document.querySelector(".rule-panel .panel-title span:first-child").textContent = t("rules");
  els.addRuleButton.title = t("addRule");
  els.addRuleButton.setAttribute("aria-label", t("addRule"));
  els.ruleEditorTitle.textContent = state.editingRuleId ? t("editRule") : t("addRule");
  els.ruleSlot.placeholder = t("slotPlaceholder");
  els.ruleKey.placeholder = t("keyPlaceholder");
  els.ruleLabel.placeholder = t("displayNamePlaceholder");
  els.saveRuleButton.textContent = t("save");
  els.cancelRuleButton.textContent = t("cancel");
  els.searchInput.placeholder = t("searchPlaceholder");
  els.ruleFilter.setAttribute("aria-label", t("ruleFilter"));
  setOptionText(els.ruleFilter, "all", t("allAudio"));
  setOptionText(els.ruleFilter, "rule", t("matchedRule"));
  setOptionText(els.ruleFilter, "free", t("freeRule"));
  setTableHeader(0, t("fileName"));
  setTableHeader(1, t("rule"));
  setTableHeader(2, t("size"));
  setTableHeader(3, t("modifiedAt"));
  document.querySelector(".inspector .panel-title span:first-child").textContent = t("actions");
  document.querySelector(".field-label").textContent = t("currentAudio");
  els.editNameButton.title = t("manualEditName");
  els.editNameButton.setAttribute("aria-label", t("manualEditName"));
  els.manualNameInput.placeholder = t("manualNamePlaceholder");
  els.manualRenameButton.textContent = t("manualRename");
  els.cancelManualRenameButton.textContent = t("cancel");
  setOptionText(els.strategySelect, "fail", t("strategyFail"));
  setOptionText(els.strategySelect, "swap", t("strategySwap"));
  setOptionText(els.strategySelect, "auto", t("strategyAuto"));
  els.applyButton.textContent = t("applyRename");
  document.querySelector(".activity .panel-title span:first-child").textContent = t("activity");
  els.clearLogButton.textContent = t("clear");

  if (!state.selected) {
    els.selectedName.textContent = t("chooseAudio");
    els.selectionBadge.textContent = t("notSelected");
  } else {
    refs.updateSelectedLabels?.();
  }

  refs.renderTargetOptions?.();
  refs.renderRules?.();
  refs.renderFiles?.();
  refs.updateConflictStatus?.();
  refs.updateManualRenameStatus?.();
  refs.renderLog?.();
}

function setLabelFor(id, text) {
  const label = document.querySelector(`label[for="${id}"]`);
  if (label) label.textContent = text;
}

function setOptionText(select, value, text) {
  const option = Array.from(select.options).find(item => item.value === value);
  if (option) option.textContent = text;
}

function setTableHeader(index, text) {
  const header = document.querySelectorAll("th")[index];
  if (header) header.textContent = text;
}
