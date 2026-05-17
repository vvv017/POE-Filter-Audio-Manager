import { els, state } from "./context.js";
import { t } from "./i18n.js";
import { formatTime } from "./utils.js";

export function pushLog(key, values = {}) {
  state.log.unshift({
    key,
    time: new Date().toISOString(),
    values
  });
  state.log = state.log.slice(0, 30);
  renderLog();
}

export function pushLogText(message) {
  state.log.unshift({
    text: message,
    time: new Date().toISOString()
  });
  state.log = state.log.slice(0, 30);
  renderLog();
}

export function pushRenameLog(result) {
  if (!result) return;
  if (result.action === "unchanged") {
    pushLog("renameUnchanged");
    return;
  }
  if (result.action === "swapped") {
    pushLog("renameSwapped", { source: result.source, target: result.target });
    return;
  }
  if (result.action === "renamed-auto" && result.displacedTarget) {
    pushLog("renameAuto", {
      displacedTarget: result.displacedTarget,
      source: result.source,
      target: result.target
    });
    return;
  }
  if (result.target) {
    pushLog("renameChanged", { target: result.target });
    return;
  }
  pushLogText(result.message || t("actionFailed"));
}

export function renderLog() {
  els.activityLog.innerHTML = "";
  state.log.forEach(entry => {
    const li = document.createElement("li");
    const text = entry.key ? t(entry.key, entry.values) : entry.text;
    li.textContent = `${formatTime(entry.time, state.lang)} · ${text}`;
    els.activityLog.append(li);
  });
}
