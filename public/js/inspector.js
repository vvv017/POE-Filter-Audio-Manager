import { requestJson } from "./api.js";
import { els, refs, state } from "./context.js";
import { t } from "./i18n.js";
import { listLocalAudioFiles, renameLocalAudio } from "./local-files.js";
import { pushLogText, pushRenameLog } from "./log.js";
import { hasNativeDesktop, nativeRenameAudio } from "./native.js";
import { selectedRuleBase } from "./rules.js";
import { nameWithoutExtension, translateServerError } from "./utils.js";

export function updateConflictStatus() {
  const target = targetFileName();
  els.conflictStatus.className = "status-line";
  refs.renderRules?.();

  if (!state.selected) {
    els.conflictStatus.textContent = t("noAudioSelected");
    els.applyButton.disabled = true;
    return;
  }

  if (!state.rules.length) {
    els.conflictStatus.textContent = t("noRules");
    els.applyButton.disabled = true;
    return;
  }

  if (!selectedRuleBase()) {
    els.conflictStatus.textContent = t("selectTargetFileName");
    els.applyButton.disabled = true;
    return;
  }

  const existing = matchingTarget();
  els.applyButton.disabled = false;

  if (!existing) {
    els.conflictStatus.textContent = t("willRenameTo", { target });
    els.conflictStatus.classList.add("ok");
    return;
  }

  if (existing.name === state.selected.name) {
    els.conflictStatus.textContent = t("alreadyTargetName");
    els.conflictStatus.classList.add("ok");
    return;
  }

  showConflictMessage(els.conflictStatus, target);
}

export function openManualRename() {
  if (!state.selected) return;
  els.manualRenameForm.hidden = false;
  els.manualNameInput.value = nameWithoutExtension(state.selected.name);
  els.manualExtension.textContent = state.selected.ext;
  updateManualRenameStatus();
  els.manualNameInput.focus();
  els.manualNameInput.select();
}

export function closeManualRename() {
  els.manualRenameForm.hidden = true;
  els.manualNameInput.value = "";
  updateManualRenameStatus();
}

export function updateManualRenameStatus() {
  els.manualNameStatus.className = "status-line compact";

  if (!state.selected) {
    els.manualNameStatus.textContent = t("noAudioSelected");
    els.manualRenameButton.disabled = true;
    els.editNameButton.disabled = true;
    return;
  }

  els.editNameButton.disabled = false;

  if (els.manualRenameForm.hidden) {
    els.manualRenameButton.disabled = true;
    return;
  }

  const target = manualTargetFileName();
  if (!target) {
    els.manualNameStatus.textContent = t("inputFileName");
    els.manualRenameButton.disabled = true;
    return;
  }

  const existing = matchingManualTarget();
  els.manualRenameButton.disabled = false;

  if (!existing) {
    els.manualNameStatus.textContent = t("willRenameTo", { target });
    els.manualNameStatus.classList.add("ok");
    return;
  }

  if (existing.name === state.selected.name) {
    els.manualNameStatus.textContent = t("alreadyThisName");
    els.manualNameStatus.classList.add("ok");
    return;
  }

  showConflictMessage(els.manualNameStatus, target);
}

export async function applyRename() {
  if (!state.selected) return;

  try {
    els.applyButton.disabled = true;
    const payload = await renameAudio(selectedRuleBase());

    state.files = payload.files;
    state.audioRevision = Date.now();
    const nextName = payload.result.target || state.selected.name;
    state.selected = state.files.find(file => file.name === nextName) || null;
    pushRenameLog(payload.result);

    if (state.selected) {
      await refs.selectFile?.(state.selected.name);
    } else {
      refs.renderFiles?.();
      updateConflictStatus();
    }
  } catch (error) {
    pushLogText(translateServerError(error.message, state.lang) || t("actionFailed"));
    updateConflictStatus();
  }
}

export async function applyManualRename(event) {
  event.preventDefault();
  if (!state.selected) return;

  try {
    els.manualRenameButton.disabled = true;
    const payload = await renameAudio(els.manualNameInput.value.trim());

    state.files = payload.files;
    state.audioRevision = Date.now();
    const nextName = payload.result.target || state.selected.name;
    state.selected = state.files.find(file => file.name === nextName) || null;
    pushRenameLog(payload.result);

    if (state.selected) {
      closeManualRename();
      await refs.selectFile?.(state.selected.name);
    } else {
      refs.renderFiles?.();
      updateConflictStatus();
      updateManualRenameStatus();
    }
  } catch (error) {
    pushLogText(translateServerError(error.message, state.lang) || t("actionFailed"));
    updateManualRenameStatus();
  }
}

function matchingManualTarget() {
  const target = manualTargetFileName();
  if (!target) return null;
  return state.files.find(file => file.name.toLowerCase() === target.toLowerCase()) || null;
}

async function renameAudio(targetBase) {
  if (hasNativeDesktop()) {
    return nativeRenameAudio({
      dir: state.dir,
      source: state.selected.name,
      strategy: els.strategySelect.value,
      targetBase
    });
  }

  if (state.dirHandle) {
    const result = await renameLocalAudio({
      dirHandle: state.dirHandle,
      source: state.selected.name,
      strategy: els.strategySelect.value,
      targetBase
    });
    return {
      result,
      files: await listLocalAudioFiles(state.dirHandle)
    };
  }

  return requestJson("/api/rename", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      dir: state.dir,
      source: state.selected.name,
      strategy: els.strategySelect.value,
      targetBase
    })
  });
}

function matchingTarget() {
  const target = targetFileName();
  if (!target) return null;
  return state.files.find(file => file.name.toLowerCase() === target.toLowerCase()) || null;
}

function manualTargetFileName() {
  const base = els.manualNameInput.value.trim();
  if (!base || !state.selected) return "";
  const cleanBase = base.toLowerCase().endsWith(state.selected.ext.toLowerCase())
    ? base.slice(0, -state.selected.ext.length)
    : base;
  return `${cleanBase}${state.selected.ext}`;
}

function showConflictMessage(element, target) {
  if (els.strategySelect.value === "swap") {
    element.textContent = t("targetExistsSwap", { target });
    element.classList.add("warn");
    return;
  }

  if (els.strategySelect.value === "auto") {
    element.textContent = t("targetExistsAuto", { target });
    element.classList.add("warn");
    return;
  }

  element.textContent = t("targetExistsChoose", { target });
  element.classList.add("error");
}

function targetFileName() {
  const base = selectedRuleBase();
  if (!base || !state.selected) return "";
  return `${base}${state.selected.ext}`;
}
