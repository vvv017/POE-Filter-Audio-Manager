import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 5173);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac"]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac"
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": MIME_TYPES[".json"] });
  res.end(JSON.stringify(payload));
}

function normalizeDir(input) {
  if (!input || typeof input !== "string") {
    throw createHttpError(400, "請輸入資料夾路徑。");
  }
  return path.resolve(input.trim());
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertAudioFileName(fileName) {
  if (!fileName || typeof fileName !== "string") {
    throw createHttpError(400, "缺少音效檔名。");
  }
  if (fileName !== path.basename(fileName) || fileName.includes("/") || fileName.includes("\\")) {
    throw createHttpError(400, "音效檔名不能包含路徑。");
  }
  const ext = path.extname(fileName).toLowerCase();
  if (!AUDIO_EXTENSIONS.has(ext)) {
    throw createHttpError(400, "只支援 mp3、wav、ogg、flac、m4a、aac。");
  }
}

function cleanTargetBase(input) {
  if (!input || typeof input !== "string") {
    throw createHttpError(400, "請輸入目標名字。");
  }

  const parsed = path.parse(input.trim());
  let base = parsed.ext && AUDIO_EXTENSIONS.has(parsed.ext.toLowerCase()) ? parsed.name : input.trim();
  base = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/[. ]+$/g, "").trim();

  if (!base) {
    throw createHttpError(400, "目標名字無效。");
  }
  return base;
}

function safePath(dir, fileName) {
  const resolved = path.resolve(dir, fileName);
  const relative = path.relative(dir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw createHttpError(400, "檔案必須在指定資料夾內。");
  }
  return resolved;
}

function parseRuleName(fileName) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  if (/_\d+$/.test(base)) {
    return { isRule: false, slot: "", key: "", base };
  }
  const match = base.match(/^(\d+)([a-z0-9][a-z0-9_-]*)$/i);
  if (!match) {
    return { isRule: false, slot: "", key: "", base };
  }
  return { isRule: true, slot: match[1], key: match[2], base };
}

async function listAudioFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(ext)) continue;

    const fullPath = safePath(dir, entry.name);
    const stat = await fs.stat(fullPath);
    files.push({
      name: entry.name,
      ext,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      rule: parseRuleName(entry.name)
    });
  }

  return files.sort(compareAudioFiles);
}

function compareAudioFiles(a, b) {
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

async function ensureDirectory(dir) {
  const stat = await fs.stat(dir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw createHttpError(404, "找不到這個資料夾。");
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function uniqueName(dir, base, ext) {
  let index = 2;
  let candidate = `${base}${ext}`;
  while (await exists(safePath(dir, candidate))) {
    candidate = `${base}_${index}${ext}`;
    index += 1;
  }
  return candidate;
}

async function tempName(dir, ext) {
  for (let i = 0; i < 20; i += 1) {
    const candidate = `.poe-audio-manager-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    const fullPath = safePath(dir, candidate);
    if (!(await exists(fullPath))) return { candidate, fullPath };
  }
  throw createHttpError(500, "無法建立暫存檔名。");
}

async function renameAudio({ dir, source, targetBase, strategy }) {
  await ensureDirectory(dir);
  assertAudioFileName(source);

  const sourcePath = safePath(dir, source);
  const sourceStat = await fs.stat(sourcePath).catch(() => null);
  if (!sourceStat || !sourceStat.isFile()) {
    throw createHttpError(404, "來源音效不存在。");
  }

  const sourceExt = path.extname(source);
  const cleanBase = cleanTargetBase(targetBase);
  const requestedTarget = `${cleanBase}${sourceExt}`;
  assertAudioFileName(requestedTarget);

  if (source === requestedTarget) {
    return { action: "unchanged", source, target: requestedTarget, message: "檔名已經符合目標。" };
  }

  const sourceLower = source.toLowerCase();
  const targetLower = requestedTarget.toLowerCase();
  const targetExists = await exists(safePath(dir, requestedTarget));

  if (sourceLower === targetLower && source !== requestedTarget) {
    const temp = await tempName(dir, sourceExt);
    await fs.rename(sourcePath, temp.fullPath);
    await fs.rename(temp.fullPath, safePath(dir, requestedTarget));
    return { action: "renamed", source, target: requestedTarget, message: "已更新檔名字母大小寫。" };
  }

  if (!targetExists) {
    await fs.rename(sourcePath, safePath(dir, requestedTarget));
    return { action: "renamed", source, target: requestedTarget, message: "已套用目標檔名。" };
  }

  if (strategy === "auto") {
    const temp = await tempName(dir, sourceExt);
    const targetPath = safePath(dir, requestedTarget);
    await fs.rename(sourcePath, temp.fullPath);

    const displacedName = await uniqueName(dir, cleanBase, sourceExt);
    const displacedPath = safePath(dir, displacedName);
    let targetMoved = false;

    try {
      await fs.rename(targetPath, displacedPath);
      targetMoved = true;
      await fs.rename(temp.fullPath, targetPath);
    } catch (error) {
      if (targetMoved && (await exists(displacedPath)) && !(await exists(targetPath))) {
        await fs.rename(displacedPath, targetPath).catch(() => {});
      }
      if (await exists(temp.fullPath)) {
        await fs.rename(temp.fullPath, sourcePath).catch(() => {});
      }
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

  if (strategy === "swap") {
    const temp = await tempName(dir, sourceExt);
    const targetPath = safePath(dir, requestedTarget);
    await fs.rename(sourcePath, temp.fullPath);
    try {
      await fs.rename(targetPath, sourcePath);
      await fs.rename(temp.fullPath, targetPath);
    } catch (error) {
      if (await exists(temp.fullPath)) {
        await fs.rename(temp.fullPath, sourcePath).catch(() => {});
      }
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

  throw createHttpError(409, "目標檔名已存在。請選擇交換名字或舊檔加後綴。");
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(createHttpError(413, "請求內容太大。"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(createHttpError(400, "JSON 格式錯誤。"));
      }
    });
    req.on("error", reject);
  });
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.resolve(PUBLIC_DIR, requested);
  const relative = path.relative(PUBLIC_DIR, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    sendJson(res, 403, { error: "禁止存取。" });
    return;
  }

  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    sendJson(res, 404, { error: "找不到頁面。" });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "content-type": MIME_TYPES[ext] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

function defaultFolders() {
  const home = os.homedir();
  const candidates = [
    path.join(home, "Documents", "My Games", "Path of Exile"),
    path.join(home, "Documents", "My Games", "Path of Exile 2"),
    path.join(home, "OneDrive", "Documents", "My Games", "Path of Exile"),
    path.join(home, "OneDrive", "Documents", "My Games", "Path of Exile 2")
  ];
  return candidates;
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/default-folders") {
    const folders = [];
    for (const folder of defaultFolders()) {
      const stat = await fs.stat(folder).catch(() => null);
      if (stat?.isDirectory()) folders.push(folder);
    }
    sendJson(res, 200, { folders });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/files") {
    const dir = normalizeDir(url.searchParams.get("dir"));
    await ensureDirectory(dir);
    sendJson(res, 200, { dir, files: await listAudioFiles(dir) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/audio") {
    const dir = normalizeDir(url.searchParams.get("dir"));
    const file = url.searchParams.get("file");
    await ensureDirectory(dir);
    assertAudioFileName(file);
    const audioPath = safePath(dir, file);
    const stat = await fs.stat(audioPath).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw createHttpError(404, "找不到音效。");
    }

    const ext = path.extname(file).toLowerCase();
    const range = req.headers.range;
    const headers = {
      "content-type": MIME_TYPES[ext] || "application/octet-stream",
      "accept-ranges": "bytes",
      "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "pragma": "no-cache",
      "expires": "0"
    };

    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      const start = match ? Number(match[1]) : 0;
      const end = match?.[2] ? Number(match[2]) : stat.size - 1;
      res.writeHead(206, {
        ...headers,
        "content-range": `bytes ${start}-${end}/${stat.size}`,
        "content-length": end - start + 1
      });
      createReadStream(audioPath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, { ...headers, "content-length": stat.size });
    createReadStream(audioPath).pipe(res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/rename") {
    const body = await readBody(req);
    const result = await renameAudio({
      dir: normalizeDir(body.dir),
      source: body.source,
      targetBase: body.targetBase,
      strategy: body.strategy || "fail"
    });
    const files = await listAudioFiles(normalizeDir(body.dir));
    sendJson(res, 200, { result, files });
    return;
  }

  sendJson(res, 404, { error: "找不到 API。" });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    const status = error.status || 500;
    sendJson(res, status, { error: error.message || "發生未知錯誤。" });
  }
});

server.listen(PORT, () => {
  console.log(`POE Filter Audio Manager running at http://localhost:${PORT}`);
});
