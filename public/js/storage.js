import { defaultRules, STORAGE_KEYS } from "./constants.js";
import { compareRules } from "./utils.js";

export function loadLanguage() {
  const saved = localStorage.getItem(STORAGE_KEYS.language);
  return saved === "en" || saved === "zh" ? saved : "zh";
}

export function loadRules() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.rules);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved)) return defaultRules.map(rule => ({ ...rule }));
      return saved.map(normalizeRule).filter(Boolean).sort(compareRules);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEYS.rules);
  }
  return defaultRules.map(rule => ({ ...rule }));
}

export function loadVolume() {
  const raw = localStorage.getItem(STORAGE_KEYS.volume);
  if (raw === null) return 0.8;
  const saved = Number(raw);
  if (!Number.isFinite(saved)) return 0.8;
  return Math.min(1, Math.max(0, saved));
}

export function normalizeRule(rule, index) {
  if (!rule) return null;
  const slot = String(rule.slot || "").trim();
  const key = String(rule.key || "").trim().toLowerCase();
  if (!/^\d+$/.test(slot) || !/^[a-z0-9][a-z0-9_-]*$/i.test(key)) return null;
  const label = String(rule.label || key).trim() || key;
  return {
    id: String(rule.id || `rule-${slot}-${key}-${index}`),
    slot,
    key,
    label
  };
}

export function saveLanguage(lang) {
  localStorage.setItem(STORAGE_KEYS.language, lang);
}

export function saveRules(rules) {
  rules.sort(compareRules);
  localStorage.setItem(STORAGE_KEYS.rules, JSON.stringify(rules));
}

export function saveVolume(volume) {
  localStorage.setItem(STORAGE_KEYS.volume, String(volume));
}
