import { els, refs, state } from "./context.js";
import { t } from "./i18n.js";
import { pushLog } from "./log.js";
import { saveRules } from "./storage.js";
import { escapeHtml, newRuleId, ruleBase } from "./utils.js";

export function selectedRule() {
  return state.rules.find(rule => rule.id === els.targetRule.value) || null;
}

export function selectedRuleBase() {
  const rule = selectedRule();
  return rule ? ruleBase(rule) : "";
}

export function ruleIdForBase(base) {
  const normalized = String(base || "").toLowerCase();
  return state.rules.find(rule => ruleBase(rule).toLowerCase() === normalized)?.id || "";
}

export function renderRules() {
  els.ruleCount.textContent = String(state.rules.length);
  els.presetGrid.innerHTML = "";

  state.rules.forEach(rule => {
    const card = document.createElement("div");
    card.className = "rule-card";

    const chooseButton = document.createElement("button");
    chooseButton.className = "preset-button";
    chooseButton.type = "button";
    if (els.targetRule.value === rule.id) chooseButton.classList.add("active-rule");
    chooseButton.innerHTML = `<strong>${escapeHtml(rule.slot)}</strong><span>${escapeHtml(ruleBase(rule))}<br>${escapeHtml(rule.label)}</span>`;
    chooseButton.addEventListener("click", () => {
      els.targetRule.value = rule.id;
      renderRules();
      refs.updateConflictStatus?.();
    });

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const editButton = document.createElement("button");
    editButton.className = "rule-action-button";
    editButton.type = "button";
    editButton.textContent = "✎";
    editButton.title = t("editRule");
    editButton.setAttribute("aria-label", t("editRuleNamed", { name: ruleBase(rule) }));
    editButton.addEventListener("click", () => openRuleEditor(rule));

    const deleteButton = document.createElement("button");
    deleteButton.className = "rule-action-button danger";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.title = t("deleteRule");
    deleteButton.setAttribute("aria-label", t("deleteRuleNamed", { name: ruleBase(rule) }));
    deleteButton.addEventListener("click", () => deleteRule(rule));

    actions.append(editButton, deleteButton);
    card.append(chooseButton, actions);
    els.presetGrid.append(card);
  });
}

export function renderTargetOptions(preferredId = els.targetRule.value) {
  els.targetRule.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.rules.length ? t("chooseRule") : t("addRuleFirst");
  els.targetRule.append(placeholder);

  state.rules.forEach(rule => {
    const option = document.createElement("option");
    option.value = rule.id;
    option.textContent = `${ruleBase(rule)} - ${rule.label}`;
    els.targetRule.append(option);
  });

  els.targetRule.value = state.rules.some(rule => rule.id === preferredId) ? preferredId : "";
}

export function openRuleEditor(rule = null) {
  state.editingRuleId = rule?.id || null;
  els.ruleEditor.hidden = false;
  els.ruleEditorTitle.textContent = rule ? t("editRule") : t("addRule");
  els.ruleSlot.value = rule?.slot || "";
  els.ruleKey.value = rule?.key || "";
  els.ruleLabel.value = rule?.label || "";
  setRuleEditorStatus("");
  els.ruleSlot.focus();
}

export function closeRuleEditor() {
  state.editingRuleId = null;
  els.ruleEditor.hidden = true;
  els.ruleSlot.value = "";
  els.ruleKey.value = "";
  els.ruleLabel.value = "";
  setRuleEditorStatus("");
  els.ruleEditorTitle.textContent = t("addRule");
}

export function saveRuleFromForm(event) {
  event.preventDefault();

  const slot = els.ruleSlot.value.trim();
  const key = els.ruleKey.value.trim().toLowerCase();
  const label = els.ruleLabel.value.trim() || key;

  if (!/^\d+$/.test(slot)) {
    setRuleEditorStatus(t("slotDigitsOnly"), "error");
    return;
  }

  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(key)) {
    setRuleEditorStatus(t("keyFormat"), "error");
    return;
  }

  const base = `${slot}${key}`.toLowerCase();
  const duplicate = state.rules.find(rule => rule.id !== state.editingRuleId && ruleBase(rule).toLowerCase() === base);
  if (duplicate) {
    setRuleEditorStatus(t("duplicateRule"), "error");
    return;
  }

  if (state.editingRuleId) {
    const existing = state.rules.find(rule => rule.id === state.editingRuleId);
    if (existing) {
      existing.slot = slot;
      existing.key = key;
      existing.label = label;
    }
  } else {
    state.rules.push({ id: newRuleId(), slot, key, label });
  }

  saveRules(state.rules);
  const savedId = state.editingRuleId || state.rules.find(rule => ruleBase(rule).toLowerCase() === base)?.id || "";
  renderTargetOptions(savedId);
  renderRules();
  closeRuleEditor();
  refs.updateConflictStatus?.();
  pushLog("savedRuleLog", { name: `${slot}${key}` });
}

function deleteRule(rule) {
  const confirmed = window.confirm(t("confirmDeleteRule", { name: ruleBase(rule) }));
  if (!confirmed) return;

  state.rules = state.rules.filter(item => item.id !== rule.id);
  if (els.targetRule.value === rule.id) {
    els.targetRule.value = "";
  }

  saveRules(state.rules);
  renderTargetOptions(els.targetRule.value);
  renderRules();
  refs.updateConflictStatus?.();
  pushLog("deletedRuleLog", { name: ruleBase(rule) });
}

function setRuleEditorStatus(message, type = "") {
  els.ruleEditorStatus.textContent = message;
  els.ruleEditorStatus.className = `rule-editor-status ${type}`.trim();
}
