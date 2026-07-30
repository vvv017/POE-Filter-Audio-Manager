import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { startServer } from "../server.js";

const dir = await fs.mkdtemp(path.join(os.tmpdir(), "poe-audio-zip-"));
const started = await startServer({ port: 0, host: "127.0.0.1" });

try {
  await fs.writeFile(path.join(dir, "1a.mp3"), "a");
  await fs.writeFile(path.join(dir, "2b.mp3"), "b");

  const response = await fetch(`${started.url}api/package-zip`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      dir,
      files: ["1a.mp3", "2b.mp3"],
      packageBase: "bundle.zip"
    })
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.result.target, "bundle.zip");
  assert.equal(payload.result.count, 2);
  assert.ok((await fs.stat(path.join(dir, "bundle.zip"))).size > 0);

  await fs.writeFile(path.join(dir, "88b1.mp3"), "source");
  await fs.writeFile(path.join(dir, "explosion.mp3"), "target");
  const renameResponse = await fetch(`${started.url}api/rename`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      dir,
      source: "88b1.mp3",
      targetBase: "explosion",
      strategy: "swap-rename",
      swapRenameBase: "xx"
    })
  });
  const renamePayload = await renameResponse.json();

  assert.equal(renameResponse.status, 200);
  assert.equal(renamePayload.result.action, "swapped-renamed");
  assert.equal(renamePayload.result.target, "explosion.mp3");
  assert.equal(renamePayload.result.displacedTarget, "xx.mp3");
  assert.equal(await fs.readFile(path.join(dir, "explosion.mp3"), "utf8"), "source");
  assert.equal(await fs.readFile(path.join(dir, "xx.mp3"), "utf8"), "target");
} finally {
  started.server.close();
  await fs.rm(dir, { recursive: true, force: true });
}
