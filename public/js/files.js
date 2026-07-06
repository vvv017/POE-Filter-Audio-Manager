import { apiUrl } from "./api.js";
import { els, refs, state } from "./context.js";
import { t } from "./i18n.js";
import { createLocalAudioUrl } from "./local-files.js";
import { pushLog } from "./log.js";
import { hasNativeDesktop, nativeAudioUrl } from "./native.js";
import { ruleIdForBase } from "./rules.js";
import { escapeHtml, formatBytes, formatDate, nameWithoutExtension } from "./utils.js";

export function renderDefaultFolders(folders) {
  els.defaultFolders.innerHTML = "";
  if (!folders.length) return;

  folders.forEach(folder => {
    const label = typeof folder === "string" ? folder : folder.name;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = label;
    button.addEventListener("click", async () => {
      if (folder.pick) {
        els.folderInput.value = label;
        await refs.chooseFolder?.(folder.pickerId);
        return;
      }

      state.dirHandle = folder.handle || null;
      els.folderInput.value = label;
      await refs.loadFolder?.();
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
    row.addEventListener("click", () => {
      void selectFile(file.name);
    });
    row.querySelector(".row-play-button").addEventListener("click", event => {
      event.stopPropagation();
      void playFile(file.name);
    });
    els.fileTable.append(row);
  });
}

export function ruleMarkup(file) {
  if (!file.rule.isRule) return `<span class="rule-pill">${escapeHtml(t("freeRule"))}</span>`;
  return `<span class="rule-pill active">${escapeHtml(file.rule.slot)} · ${escapeHtml(file.rule.key)}</span>`;
}

export async function selectFile(name) {
  const file = state.files.find(item => item.name === name);
  if (!file) return;

  state.selected = file;
  els.selectedName.textContent = file.name;
  els.editNameButton.disabled = false;
  els.manualExtension.textContent = file.ext;
  els.audioPlayer.pause();
  clearAudioSource();
  els.audioPlayer.load();
  const src = await audioUrl(file);
  if (state.selected?.name !== name) {
    if (String(src).startsWith("blob:")) URL.revokeObjectURL(src);
    return;
  }
  els.audioPlayer.src = src;
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

async function playFile(name) {
  await selectFile(name);
  els.audioPlayer.volume = state.volume;
  els.audioPlayer.currentTime = 0;
  const playPromise = els.audioPlayer.play();
  if (playPromise) {
    playPromise.catch(() => {
      pushLog("browserCannotPlay");
    });
  }
}

async function audioUrl(file) {
  if (hasNativeDesktop()) {
    return nativeAudioUrl(state.dir, file.name);
  }

  if (file.handle) {
    state.audioObjectUrl = await createLocalAudioUrl(file);
    return state.audioObjectUrl;
  }

  return apiUrl("/api/audio", {
    dir: state.dir,
    file: file.name,
    v: `${state.audioRevision}-${file.modifiedAt}-${file.size}`
  });
}

function clearAudioSource() {
  if (state.audioObjectUrl) {
    URL.revokeObjectURL(state.audioObjectUrl);
    state.audioObjectUrl = "";
  }
  els.audioPlayer.removeAttribute("src");
}
