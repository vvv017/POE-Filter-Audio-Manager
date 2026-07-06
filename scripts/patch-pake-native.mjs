import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const tauriDir = path.join(root, "node_modules", "pake-cli", "src-tauri");
const srcDir = path.join(tauriDir, "src");
const libPath = path.join(srcDir, "lib.rs");
const cargoPath = path.join(tauriDir, "Cargo.toml");

if (!fs.existsSync(libPath) || !fs.existsSync(cargoPath)) {
  throw new Error("pake-cli src-tauri files were not found. Run npm install first.");
}

fs.copyFileSync(path.join(root, "native", "poe.rs"), path.join(srcDir, "poe.rs"));
patchFile(libPath, [
  ["mod app;\nmod util;", "mod app;\nmod util;\nmod poe;"],
  [
    "use util::get_pake_config;",
    `use util::get_pake_config;\nuse poe::{\n    poe_choose_folder, poe_default_folders, poe_list_files, poe_read_audio,\n    poe_rename_audio,\n};`
  ],
  [
    "set_zoom,\n        ])",
    `set_zoom,\n            poe_default_folders,\n            poe_choose_folder,\n            poe_list_files,\n            poe_read_audio,\n            poe_rename_audio,\n        ])`
  ]
]);

patchFile(cargoPath, [
  ["serde = { version = \"1.0.228\", features = [\"derive\"] }", "serde = { version = \"1.0.228\", features = [\"derive\"] }\nbase64 = \"0.22.1\"\nrfd = \"0.15.4\""]
]);

function patchFile(file, replacements) {
  let text = fs.readFileSync(file, "utf8");
  for (const [needle, replacement] of replacements) {
    if (text.includes(replacement)) continue;
    if (!text.includes(needle)) {
      throw new Error(`Could not patch ${file}; missing anchor: ${needle}`);
    }
    text = text.replace(needle, replacement);
  }
  fs.writeFileSync(file, text);
}
