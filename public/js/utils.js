export function compareRules(a, b) {
  const slotA = Number(a.slot);
  const slotB = Number(b.slot);
  if (slotA !== slotB) return slotA - slotB;
  return a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: "base" });
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

export function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

export function formatDate(value, lang) {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "zh-Hant", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatTime(value, lang) {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "zh-Hant", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

export function nameWithoutExtension(fileName) {
  const index = fileName.lastIndexOf(".");
  return index > 0 ? fileName.slice(0, index) : fileName;
}

export function newRuleId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ruleBase(rule) {
  return `${rule.slot}${rule.key}`;
}

export function translateServerError(message, lang) {
  const map = {
    "請輸入資料夾路徑。": { zh: "請輸入資料夾路徑。", en: "Enter a folder path." },
    "找不到這個資料夾。": { zh: "找不到這個資料夾。", en: "This folder was not found." },
    "來源音效不存在。": { zh: "來源音效不存在。", en: "The source audio file does not exist." },
    "資料夾權限未允許。": { zh: "資料夾權限未允許。", en: "Folder permission was not granted." },
    "資料夾寫入權限未允許。": {
      zh: "資料夾寫入權限未允許。",
      en: "Folder write permission was not granted."
    },
    "請輸入目標名字。": { zh: "請輸入目標名字。", en: "Enter a target name." },
    "目標名字無效。": { zh: "目標名字無效。", en: "The target name is invalid." },
    "缺少音效檔名。": { zh: "缺少音效檔名。", en: "Missing audio file name." },
    "音效檔名不能包含路徑。": { zh: "音效檔名不能包含路徑。", en: "Audio file names cannot include paths." },
    "只支援 mp3、wav、ogg、flac、m4a、aac。": {
      zh: "只支援 mp3、wav、ogg、flac、m4a、aac。",
      en: "Only mp3, wav, ogg, flac, m4a, and aac are supported."
    },
    "無法建立暫存檔名。": { zh: "無法建立暫存檔名。", en: "Could not create a temporary file name." },
    "目標檔名已存在。請選擇交換名字或舊檔加後綴。": {
      zh: "目標檔名已存在。請選擇交換名字或舊檔加後綴。",
      en: "The target file name already exists. Choose swap names or suffix old file."
    }
  };
  return map[message]?.[lang] || message;
}
