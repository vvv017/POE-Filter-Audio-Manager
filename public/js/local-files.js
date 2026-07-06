export const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac"]);
const HISTORY_DB = "poe-filter-audio-manager";
const HISTORY_STORE = "folder-history";
const HISTORY_LIMIT = 5;

export function hasLocalFolderAccess() {
  return typeof globalThis.showDirectoryPicker === "function";
}

export function localDefaultFolders() {
  return [
    { name: "Path of Exile", pick: true, pickerId: "poe1" },
    { name: "Path of Exile 2", pick: true, pickerId: "poe2" }
  ];
}

export async function pickLocalFolder(pickerId = "poeaudio") {
  const handle = await globalThis.showDirectoryPicker({
    id: pickerId,
    mode: "read",
    startIn: "documents"
  });
  await ensurePermission(handle, "read");
  return handle;
}

export async function loadFolderHistory() {
  if (!globalThis.indexedDB) return [];
  const db = await openHistoryDb();
  const entries = await storeRequest(db, "readonly", store => store.getAll());
  return entries
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(entry => ({ name: entry.name, handle: entry.handle }));
}

export async function saveFolderHistory(handle) {
  if (!globalThis.indexedDB) return [];
  const db = await openHistoryDb();
  await storeRequest(db, "readwrite", store => store.put({
    handle,
    name: handle.name,
    updatedAt: Date.now()
  }, handle.name));

  const entries = await storeRequest(db, "readonly", store => store.getAll());
  const stale = entries
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(HISTORY_LIMIT);

  for (const entry of stale) {
    await storeRequest(db, "readwrite", store => store.delete(entry.name));
  }

  return loadFolderHistory();
}

export async function listLocalAudioFiles(dirHandle) {
  await ensurePermission(dirHandle, "read");
  const files = [];

  for await (const entry of dirHandle.values()) {
    if (entry.kind !== "file") continue;
    const ext = fileExtension(entry.name);
    if (!AUDIO_EXTENSIONS.has(ext)) continue;

    const file = await entry.getFile();
    files.push({
      name: entry.name,
      ext,
      size: file.size,
      modifiedAt: new Date(file.lastModified).toISOString(),
      rule: parseRuleName(entry.name),
      handle: entry
    });
  }

  return files.sort(compareAudioFiles);
}

export async function createLocalAudioUrl(file) {
  const blob = await file.handle.getFile();
  return URL.createObjectURL(blob);
}

export async function renameLocalAudio({ dirHandle, source, targetBase, strategy }) {
  await ensurePermission(dirHandle, "readwrite");
  assertAudioFileName(source);

  if (!(await hasFile(dirHandle, source))) {
    throw new Error("來源音效不存在。");
  }

  const sourceExt = fileExtension(source);
  const cleanBase = cleanTargetBase(targetBase);
  const requestedTarget = `${cleanBase}${sourceExt}`;
  assertAudioFileName(requestedTarget);

  if (source === requestedTarget) {
    return { action: "unchanged", source, target: requestedTarget, message: "檔名已經符合目標。" };
  }

  if (source.toLowerCase() === requestedTarget.toLowerCase()) {
    const temp = await tempName(dirHandle, sourceExt);
    try {
      await moveFile(dirHandle, source, temp);
      await moveFile(dirHandle, temp, requestedTarget);
    } catch (error) {
      await restoreFile(dirHandle, temp, source);
      throw error;
    }
    return { action: "renamed", source, target: requestedTarget, message: "已更新檔名字母大小寫。" };
  }

  const targetExists = await hasFile(dirHandle, requestedTarget);
  if (!targetExists) {
    await moveFile(dirHandle, source, requestedTarget);
    return { action: "renamed", source, target: requestedTarget, message: "已套用目標檔名。" };
  }

  if (strategy === "auto") {
    return renameWithSuffix(dirHandle, source, requestedTarget, cleanBase, sourceExt);
  }

  if (strategy === "swap") {
    return swapNames(dirHandle, source, requestedTarget, sourceExt);
  }

  throw new Error("目標檔名已存在。請選擇交換名字或舊檔加後綴。");
}

export function cleanTargetBase(input) {
  if (!input || typeof input !== "string") {
    throw new Error("請輸入目標名字。");
  }

  const raw = input.trim();
  const ext = fileExtension(raw);
  let base = AUDIO_EXTENSIONS.has(ext) ? raw.slice(0, -ext.length) : raw;
  base = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/[. ]+$/g, "").trim();

  if (!base) {
    throw new Error("目標名字無效。");
  }
  return base;
}

export function parseRuleName(fileName) {
  const ext = fileExtension(fileName);
  const base = ext ? fileName.slice(0, -ext.length) : fileName;
  if (/_\d+$/.test(base)) {
    return { isRule: false, slot: "", key: "", base };
  }
  const match = base.match(/^(\d+)([a-z0-9][a-z0-9_-]*)$/i);
  if (!match) {
    return { isRule: false, slot: "", key: "", base };
  }
  return { isRule: true, slot: match[1], key: match[2], base };
}

export function compareAudioFiles(a, b) {
  if (a.rule.isRule !== b.rule.isRule) {
    return a.rule.isRule ? -1 : 1;
  }

  if (a.rule.isRule && b.rule.isRule) {
    const slotA = Number(a.rule.slot);
    const slotB = Number(b.rule.slot);
    if (slotA !== slotB) return slotA - slotB;
    return a.rule.key.localeCompare(b.rule.key, undefined, { numeric: true, sensitivity: "base" });
  }

  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

export function fileExtension(fileName) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

async function ensurePermission(handle, mode) {
  if (!handle?.queryPermission || !handle?.requestPermission) return;
  const options = { mode };
  if ((await handle.queryPermission(options)) === "granted") return;
  if ((await handle.requestPermission(options)) === "granted") return;
  throw new Error(mode === "readwrite" ? "資料夾寫入權限未允許。" : "資料夾權限未允許。");
}

function openHistoryDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HISTORY_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(HISTORY_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeRequest(db, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HISTORY_STORE, mode);
    const request = operation(transaction.objectStore(HISTORY_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function assertAudioFileName(fileName) {
  if (!fileName || typeof fileName !== "string") {
    throw new Error("缺少音效檔名。");
  }
  if (/[\\/]/.test(fileName)) {
    throw new Error("音效檔名不能包含路徑。");
  }
  if (!AUDIO_EXTENSIONS.has(fileExtension(fileName))) {
    throw new Error("只支援 mp3、wav、ogg、flac、m4a、aac。");
  }
}

async function renameWithSuffix(dirHandle, source, requestedTarget, cleanBase, sourceExt) {
  const temp = await tempName(dirHandle, sourceExt);
  let displacedName = "";

  try {
    await moveFile(dirHandle, source, temp);
    displacedName = await uniqueName(dirHandle, cleanBase, sourceExt);
    await moveFile(dirHandle, requestedTarget, displacedName);
    await moveFile(dirHandle, temp, requestedTarget);
  } catch (error) {
    await restoreFile(dirHandle, temp, source);
    await restoreFile(dirHandle, displacedName, requestedTarget);
    throw error;
  }

  return {
    action: "renamed-auto",
    source,
    target: requestedTarget,
    displacedTarget: displacedName,
    message: `${source} 已改成 ${requestedTarget}，原本的 ${requestedTarget} 已改成 ${displacedName}。`
  };
}

async function swapNames(dirHandle, source, requestedTarget, sourceExt) {
  const temp = await tempName(dirHandle, sourceExt);

  try {
    await moveFile(dirHandle, source, temp);
    await moveFile(dirHandle, requestedTarget, source);
    await moveFile(dirHandle, temp, requestedTarget);
  } catch (error) {
    await restoreFile(dirHandle, source, requestedTarget);
    await restoreFile(dirHandle, temp, source);
    throw error;
  }

  return {
    action: "swapped",
    source,
    target: requestedTarget,
    swappedWith: source,
    message: `${source} 和 ${requestedTarget} 已交換名字。`
  };
}

async function uniqueName(dirHandle, base, ext) {
  let index = 2;
  let candidate = `${base}${ext}`;
  while (await hasFile(dirHandle, candidate)) {
    candidate = `${base}_${index}${ext}`;
    index += 1;
  }
  return candidate;
}

async function tempName(dirHandle, ext) {
  for (let i = 0; i < 20; i += 1) {
    const candidate = `.poe-audio-manager-${Date.now()}-${randomHex()}${ext}`;
    if (!(await hasFile(dirHandle, candidate))) return candidate;
  }
  throw new Error("無法建立暫存檔名。");
}

function randomHex() {
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(4);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2, 10);
}

async function hasFile(dirHandle, name) {
  try {
    await dirHandle.getFileHandle(name);
    return true;
  } catch (error) {
    if (error.name === "NotFoundError") return false;
    throw error;
  }
}

async function moveFile(dirHandle, source, target) {
  // ponytail: File System Access has no rename; copy/delete is enough for small audio files.
  await copyFile(dirHandle, source, target);
  await dirHandle.removeEntry(source);
}

async function copyFile(dirHandle, source, target) {
  const sourceHandle = await dirHandle.getFileHandle(source);
  const targetHandle = await dirHandle.getFileHandle(target, { create: true });
  const writable = await targetHandle.createWritable();
  try {
    await writable.write(await sourceHandle.getFile());
  } finally {
    await writable.close();
  }
}

async function restoreFile(dirHandle, source, target) {
  if (!source || !(await hasFile(dirHandle, source)) || (await hasFile(dirHandle, target))) return;
  await moveFile(dirHandle, source, target).catch(() => {});
}
