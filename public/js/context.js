import { STORAGE_KEYS } from "./constants.js";
import { loadLanguage, loadRules, loadVolume } from "./storage.js";

export const state = {
  audioRevision: Date.now(),
  dir: localStorage.getItem(STORAGE_KEYS.dir) || "",
  editingRuleId: null,
  files: [],
  lang: loadLanguage(),
  log: [],
  rules: loadRules(),
  selected: null,
  volume: loadVolume()
};

export const els = {
  activityLog: document.querySelector("#activityLog"),
  addRuleButton: document.querySelector("#addRuleButton"),
  applyButton: document.querySelector("#applyButton"),
  audioPlayer: document.querySelector("#audioPlayer"),
  browseFolderButton: document.querySelector("#browseFolderButton"),
  cancelManualRenameButton: document.querySelector("#cancelManualRenameButton"),
  cancelRuleButton: document.querySelector("#cancelRuleButton"),
  clearLogButton: document.querySelector("#clearLogButton"),
  conflictStatus: document.querySelector("#conflictStatus"),
  defaultFolders: document.querySelector("#defaultFolders"),
  editNameButton: document.querySelector("#editNameButton"),
  fileTable: document.querySelector("#fileTable"),
  folderInput: document.querySelector("#folderInput"),
  folderSummary: document.querySelector("#folderSummary"),
  languageToggle: document.querySelector("#languageToggle"),
  loadButton: document.querySelector("#loadButton"),
  manualExtension: document.querySelector("#manualExtension"),
  manualNameInput: document.querySelector("#manualNameInput"),
  manualNameStatus: document.querySelector("#manualNameStatus"),
  manualRenameButton: document.querySelector("#manualRenameButton"),
  manualRenameForm: document.querySelector("#manualRenameForm"),
  presetGrid: document.querySelector("#presetGrid"),
  reloadButton: document.querySelector("#reloadButton"),
  ruleCount: document.querySelector("#ruleCount"),
  ruleEditor: document.querySelector("#ruleEditor"),
  ruleEditorStatus: document.querySelector("#ruleEditorStatus"),
  ruleEditorTitle: document.querySelector("#ruleEditorTitle"),
  ruleFilter: document.querySelector("#ruleFilter"),
  ruleKey: document.querySelector("#ruleKey"),
  ruleLabel: document.querySelector("#ruleLabel"),
  ruleSlot: document.querySelector("#ruleSlot"),
  saveRuleButton: document.querySelector("#saveRuleButton"),
  searchInput: document.querySelector("#searchInput"),
  selectedName: document.querySelector("#selectedName"),
  selectionBadge: document.querySelector("#selectionBadge"),
  strategySelect: document.querySelector("#strategySelect"),
  targetRule: document.querySelector("#targetRule"),
  volumeSlider: document.querySelector("#volumeSlider"),
  volumeValue: document.querySelector("#volumeValue")
};

export const refs = {};
