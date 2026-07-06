export function hasNativeDesktop() {
  return typeof globalThis.__TAURI__?.core?.invoke === "function";
}

export function nativeDefaultFolders() {
  return invoke("poe_default_folders");
}

export function nativeChooseFolder() {
  return invoke("poe_choose_folder");
}

export function nativeListAudioFiles(dir) {
  return invoke("poe_list_files", { dir });
}

export function nativeAudioUrl(dir, file) {
  return invoke("poe_read_audio", { dir, file });
}

export function nativeRenameAudio({ dir, source, targetBase, strategy }) {
  return invoke("poe_rename_audio", {
    dir,
    source,
    targetBase,
    strategy
  });
}

async function invoke(command, args) {
  try {
    return await globalThis.__TAURI__.core.invoke(command, args);
  } catch (error) {
    throw new Error(String(error));
  }
}
