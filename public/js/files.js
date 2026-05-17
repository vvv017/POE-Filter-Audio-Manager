import { apiUrl } from "./api.js";
import { els, refs, state } from "./context.js";
import { t } from "./i18n.js";
import { pushLog } from "./log.js";
import { ruleIdForBase } from "./rules.js";
import { escapeHtml, formatBytes, formatDate, nameWithoutExtension } from "./utils.js";

export function renderDefaultFolders(folders) {
  els.defaultFolders.innerHTML = "";
  if (!folders.length) return;

  folders.forEach(folder => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = folder;
    button.title = folder;
    button.addEventListener("click", () => {
      els.folderInput.value = folder;
      refs.loadFolder?.();
    });
    els.defaultFolders.append(button);
  });
}

export function renderFiles() {
  const search = els.searchInput.value.trim().toLowerCase();
  const filter = els.ruleFilter.value;
  const files = state.files.filter(file => {
    const matchesSearch = !search || file.name.toLowerCase().includes(search);
    const matchesFilter =
      filter === "all" ||
      (filter === "rule" && file.rule.isRule) ||
      (filter === "free" && !file.rule.isRule);
    return matchesSearch && matchesFilter;
  });

  els.fileTable.innerHTML = "";
  if (!files.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4" class="empty-state">${escapeHtml(t("emptyFiles"))}</td>`;
    els.fileTable.append(row);
    return;
  }

  files.forEach(file => {
    const row = document.createElement("tr");
    if (state.selected?.name === file.name) row.classList.add("selected");
    row.innerHTML = `
      <td>
        <div class="file-cell">
          <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
          <button class="row-play-button" type="button" title="${escapeHtml(t("play"))}" aria-label="${escapeHtml(t("playNamed", { name: file.name }))}">▶</button>
        </div>
      </td>
      <td>${ruleMarkup(file)}</td>
      <td>${formatBytes(file.size)}</td>
      <td>${formatDate(file.modifiedAt, state.lang)}</td>
    `;
    row.addEventListener("click", () => selectFile(file.name));
    row.querySelector(".row-play-button").addEventListener("click", event => {
      event.stopPropagation();
      playFile(file.name);
    });
    els.fileTable.append(row);
  });
}

export function ruleMarkup(file) {
  if (!file.rule.isRule) return `<span class="rule-pill">${escapeHtml(t("freeRule"))}</span>`;
  return `<span class="rule-pill active">${escapeHtml(file.rule.slot)} · ${escapeHtml(file.rule.key)}</span>`;
}

export function selectFile(name) {
  const file = state.files.find(item => item.name === name);
  if (!file) return;

  state.selected = file;
  els.selectedName.textContent = file.name;
  els.editNameButton.disabled = false;
  els.manualExtension.textContent = file.ext;
  els.audioPlayer.pause();
  els.audioPlayer.removeAttribute("src");
  els.audioPlayer.load();
  els.audioPlayer.src = audioUrl(file);
  els.applyButton.disabled = false;
  updateSelectedLabels();

  if (file.rule.isRule) {
    const knownRuleId = ruleIdForBase(file.rule.base);
    if (knownRuleId) els.targetRule.value = knownRuleId;
  }

  refs.renderRules?.();
  renderFiles();
  if (!els.manualRenameForm.hidden) {
    els.manualNameInput.value = nameWithoutExtension(file.name);
  }
  refs.updateConflictStatus?.();
  refs.updateManualRenameStatus?.();
}

export function updateSelectedLabels() {
  if (!state.selected) {
    els.selectionBadge.textContent = t("notSelected");
    els.selectedName.textContent = t("chooseAudio");
    return;
  }
  els.selectionBadge.textContent = state.selected.rule.isRule ? `${state.selected.rule.slot}${state.selected.rule.key}` : t("customAudio");
}

function playFile(name) {
  selectFile(name);
  els.audioPlayer.volume = state.volume;
  els.audioPlayer.currentTime = 0;
  const playPromise = els.audioPlayer.play();
  if (playPromise) {
    playPromise.catch(() => {
      pushLog("browserCannotPlay");
    });
  }
}

function audioUrl(file) {
  return apiUrl("/api/audio", {
    dir: state.dir,
    file: file.name,
    v: `${state.audioRevision}-${file.modifiedAt}-${file.size}`
  });
}
