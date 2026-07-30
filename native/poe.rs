use base64::prelude::*;
use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;

const AUDIO_EXTENSIONS: [&str; 6] = [".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleInfo {
    is_rule: bool,
    slot: String,
    key: String,
    base: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioFile {
    name: String,
    ext: String,
    size: u64,
    modified_at: u64,
    rule: RuleInfo,
}

#[derive(Serialize)]
pub struct FilesPayload {
    dir: String,
    files: Vec<AudioFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameResult {
    action: String,
    source: String,
    target: String,
    displaced_target: Option<String>,
    swapped_with: Option<String>,
    message: String,
}

#[derive(Serialize)]
pub struct RenamePayload {
    result: RenameResult,
    files: Vec<AudioFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageZipResult {
    target: String,
    count: usize,
    message: String,
}

#[tauri::command]
pub fn poe_default_folders() -> Vec<String> {
    default_folders()
        .into_iter()
        .filter(|folder| folder.is_dir())
        .map(|folder| folder.to_string_lossy().to_string())
        .collect()
}

#[tauri::command]
pub fn poe_choose_folder() -> Option<String> {
    rfd::FileDialog::new()
        .set_directory(documents_dir().unwrap_or_else(home_dir))
        .pick_folder()
        .map(|folder| folder.to_string_lossy().to_string())
}

#[tauri::command]
pub fn poe_list_files(dir: String) -> Result<FilesPayload, String> {
    let dir = normalize_dir(&dir)?;
    ensure_directory(&dir)?;
    Ok(FilesPayload {
        dir: dir.to_string_lossy().to_string(),
        files: list_audio_files(&dir)?,
    })
}

#[tauri::command]
pub fn poe_read_audio(dir: String, file: String) -> Result<String, String> {
    let dir = normalize_dir(&dir)?;
    ensure_directory(&dir)?;
    assert_audio_file_name(&file)?;
    let audio_path = safe_path(&dir, &file)?;
    let bytes = fs::read(&audio_path).map_err(|_| "找不到音效。".to_string())?;
    Ok(format!(
        "data:{};base64,{}",
        mime_type(extension(&file)),
        BASE64_STANDARD.encode(bytes)
    ))
}

#[tauri::command]
pub fn poe_rename_audio(
    dir: String,
    source: String,
    target_base: String,
    strategy: Option<String>,
    swap_rename_base: Option<String>,
) -> Result<RenamePayload, String> {
    let dir = normalize_dir(&dir)?;
    let result = rename_audio(
        &dir,
        &source,
        &target_base,
        strategy.as_deref().unwrap_or("fail"),
        swap_rename_base.as_deref(),
    )?;
    Ok(RenamePayload {
        result,
        files: list_audio_files(&dir)?,
    })
}

#[tauri::command]
pub fn poe_package_zip(
    dir: String,
    files: Vec<String>,
    package_base: String,
) -> Result<PackageZipResult, String> {
    let dir = normalize_dir(&dir)?;
    package_zip(&dir, files, &package_base)
}

#[tauri::command]
pub fn poe_open_folder(dir: String, file: String) -> Result<(), String> {
    let dir = normalize_dir(&dir)?;
    ensure_directory(&dir)?;
    if file.trim().is_empty() {
        return open_folder(&dir, None);
    }

    let target_path = safe_zip_path(&dir, file.trim())?;
    if !target_path.is_file() {
        return Err("找不到 ZIP。".to_string());
    }
    open_folder(&dir, Some(&target_path))
}

fn default_folders() -> Vec<PathBuf> {
    let home = home_dir();
    vec![
        home.join("Documents").join("My Games").join("Path of Exile"),
        home.join("Documents").join("My Games").join("Path of Exile 2"),
        home.join("OneDrive").join("Documents").join("My Games").join("Path of Exile"),
        home.join("OneDrive").join("Documents").join("My Games").join("Path of Exile 2"),
    ]
}

fn home_dir() -> PathBuf {
    std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("."))
}

fn documents_dir() -> Option<PathBuf> {
    let documents = home_dir().join("Documents");
    documents.is_dir().then_some(documents)
}

fn normalize_dir(input: &str) -> Result<PathBuf, String> {
    if input.trim().is_empty() {
        return Err("請輸入資料夾路徑。".to_string());
    }
    Ok(PathBuf::from(input.trim()))
}

fn ensure_directory(dir: &Path) -> Result<(), String> {
    if dir.is_dir() {
        Ok(())
    } else {
        Err("找不到這個資料夾。".to_string())
    }
}

fn list_audio_files(dir: &Path) -> Result<Vec<AudioFile>, String> {
    let mut files = Vec::new();

    for entry in fs::read_dir(dir).map_err(|_| "找不到這個資料夾。".to_string())? {
        let entry = entry.map_err(|_| "無法讀取資料夾。".to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        let ext = extension(&name);
        if !AUDIO_EXTENSIONS.contains(&ext.as_str()) {
            continue;
        }

        let metadata = fs::metadata(&path).map_err(|_| "無法讀取音效檔。".to_string())?;
        files.push(AudioFile {
            name: name.clone(),
            ext,
            size: metadata.len(),
            modified_at: modified_at(&metadata),
            rule: parse_rule_name(&name),
        });
    }

    files.sort_by(compare_audio_files);
    Ok(files)
}

fn modified_at(metadata: &fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn parse_rule_name(file_name: &str) -> RuleInfo {
    let ext = extension(file_name);
    let base = if ext.is_empty() {
        file_name.to_string()
    } else {
        file_name[..file_name.len() - ext.len()].to_string()
    };

    if has_numeric_suffix(&base) {
        return free_rule(base);
    }

    let digit_count = base.chars().take_while(|ch| ch.is_ascii_digit()).count();
    if digit_count == 0 || digit_count == base.len() {
        return free_rule(base);
    }

    let key = &base[digit_count..];
    if !is_rule_key(key) {
        return free_rule(base);
    }

    RuleInfo {
        is_rule: true,
        slot: base[..digit_count].to_string(),
        key: key.to_string(),
        base,
    }
}

fn free_rule(base: String) -> RuleInfo {
    RuleInfo {
        is_rule: false,
        slot: String::new(),
        key: String::new(),
        base,
    }
}

fn has_numeric_suffix(base: &str) -> bool {
    let Some((_, suffix)) = base.rsplit_once('_') else {
        return false;
    };
    !suffix.is_empty() && suffix.chars().all(|ch| ch.is_ascii_digit())
}

fn is_rule_key(key: &str) -> bool {
    let mut chars = key.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    first.is_ascii_alphanumeric()
        && chars.all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
}

fn compare_audio_files(a: &AudioFile, b: &AudioFile) -> std::cmp::Ordering {
    match (a.rule.is_rule, b.rule.is_rule) {
        (true, false) => return std::cmp::Ordering::Less,
        (false, true) => return std::cmp::Ordering::Greater,
        _ => {}
    }

    if a.rule.is_rule && b.rule.is_rule {
        let slot_a = a.rule.slot.parse::<u64>().unwrap_or(0);
        let slot_b = b.rule.slot.parse::<u64>().unwrap_or(0);
        return slot_a
            .cmp(&slot_b)
            .then_with(|| naturalish_cmp(&a.rule.key, &b.rule.key));
    }

    naturalish_cmp(&a.name, &b.name)
}

fn naturalish_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    a.to_ascii_lowercase().cmp(&b.to_ascii_lowercase())
}

fn rename_audio(
    dir: &Path,
    source: &str,
    target_base: &str,
    strategy: &str,
    swap_rename_base: Option<&str>,
) -> Result<RenameResult, String> {
    ensure_directory(dir)?;
    assert_audio_file_name(source)?;

    let source_path = safe_path(dir, source)?;
    if !source_path.is_file() {
        return Err("來源音效不存在。".to_string());
    }

    let source_ext = extension(source);
    let clean_base = clean_target_base(target_base)?;
    let requested_target = format!("{clean_base}{source_ext}");
    assert_audio_file_name(&requested_target)?;

    if source == requested_target {
        return Ok(rename_result("unchanged", source, &requested_target, None, None, "檔名已經符合目標。"));
    }

    if source.eq_ignore_ascii_case(&requested_target) {
        let temp = temp_name(dir, &source_ext)?;
        fs::rename(&source_path, safe_path(dir, &temp)?).map_err(|err| err.to_string())?;
        fs::rename(safe_path(dir, &temp)?, safe_path(dir, &requested_target)?)
            .map_err(|err| err.to_string())?;
        return Ok(rename_result("renamed", source, &requested_target, None, None, "已更新檔名字母大小寫。"));
    }

    let target_exists = safe_path(dir, &requested_target)?.exists();
    if !target_exists {
        fs::rename(&source_path, safe_path(dir, &requested_target)?).map_err(|err| err.to_string())?;
        return Ok(rename_result("renamed", source, &requested_target, None, None, "已套用目標檔名。"));
    }

    match strategy {
        "auto" => rename_with_suffix(dir, source, &requested_target, &clean_base, &source_ext),
        "swap" => swap_names(dir, source, &requested_target, &source_ext),
        "swap-rename" => swap_and_rename(dir, source, &requested_target, &source_ext, swap_rename_base),
        _ => Err("目標檔名已存在。請選擇交換名字、交換並改名或舊檔加後綴。".to_string()),
    }
}

fn rename_with_suffix(
    dir: &Path,
    source: &str,
    requested_target: &str,
    clean_base: &str,
    ext: &str,
) -> Result<RenameResult, String> {
    let temp = temp_name(dir, ext)?;
    let source_path = safe_path(dir, source)?;
    let temp_path = safe_path(dir, &temp)?;
    fs::rename(&source_path, &temp_path).map_err(|err| err.to_string())?;

    let displaced_name = unique_name(dir, clean_base, ext)?;
    let target_path = safe_path(dir, requested_target)?;
    let displaced_path = safe_path(dir, &displaced_name)?;

    if let Err(error) = fs::rename(&target_path, &displaced_path)
        .and_then(|_| fs::rename(&temp_path, &target_path))
    {
        let _ = fs::rename(&temp_path, &source_path);
        let _ = fs::rename(&displaced_path, &target_path);
        return Err(error.to_string());
    }

    Ok(rename_result(
        "renamed-auto",
        source,
        requested_target,
        Some(displaced_name.clone()),
        None,
        &format!("{source} 已改成 {requested_target}，原本的 {requested_target} 已改成 {displaced_name}。"),
    ))
}

fn swap_names(dir: &Path, source: &str, requested_target: &str, ext: &str) -> Result<RenameResult, String> {
    let temp = temp_name(dir, ext)?;
    let source_path = safe_path(dir, source)?;
    let target_path = safe_path(dir, requested_target)?;
    let temp_path = safe_path(dir, &temp)?;

    fs::rename(&source_path, &temp_path).map_err(|err| err.to_string())?;
    if let Err(error) = fs::rename(&target_path, &source_path)
        .and_then(|_| fs::rename(&temp_path, &target_path))
    {
        let _ = fs::rename(&temp_path, &source_path);
        return Err(error.to_string());
    }

    Ok(rename_result(
        "swapped",
        source,
        requested_target,
        None,
        Some(source.to_string()),
        &format!("{source} 和 {requested_target} 已交換名字。"),
    ))
}

fn swap_and_rename(
    dir: &Path,
    source: &str,
    requested_target: &str,
    ext: &str,
    swap_rename_base: Option<&str>,
) -> Result<RenameResult, String> {
    let clean_swap_base = clean_target_base(swap_rename_base.unwrap_or(""))?;
    let displaced_target = format!("{clean_swap_base}{ext}");
    assert_audio_file_name(&displaced_target)?;
    if displaced_target.eq_ignore_ascii_case(requested_target) {
        return Err("被交換檔名不能等於目標檔名。".to_string());
    }
    if !displaced_target.eq_ignore_ascii_case(source) && safe_path(dir, &displaced_target)?.exists() {
        return Err("被交換檔名已存在。".to_string());
    }

    let temp = temp_name(dir, ext)?;
    let source_path = safe_path(dir, source)?;
    let target_path = safe_path(dir, requested_target)?;
    let displaced_path = safe_path(dir, &displaced_target)?;
    let temp_path = safe_path(dir, &temp)?;

    fs::rename(&source_path, &temp_path).map_err(|err| err.to_string())?;
    let mut target_moved = false;
    if let Err(error) = fs::rename(&target_path, &displaced_path).and_then(|_| {
        target_moved = true;
        fs::rename(&temp_path, &target_path)
    }) {
        if target_moved && displaced_path.exists() && !target_path.exists() {
            let _ = fs::rename(&displaced_path, &target_path);
        }
        let _ = fs::rename(&temp_path, &source_path);
        return Err(error.to_string());
    }

    Ok(rename_result(
        "swapped-renamed",
        source,
        requested_target,
        Some(displaced_target.clone()),
        None,
        &format!("{source} 已改成 {requested_target}，原本的 {requested_target} 已改成 {displaced_target}。"),
    ))
}

fn rename_result(
    action: &str,
    source: &str,
    target: &str,
    displaced_target: Option<String>,
    swapped_with: Option<String>,
    message: &str,
) -> RenameResult {
    RenameResult {
        action: action.to_string(),
        source: source.to_string(),
        target: target.to_string(),
        displaced_target,
        swapped_with,
        message: message.to_string(),
    }
}

fn package_zip(dir: &Path, files: Vec<String>, package_base: &str) -> Result<PackageZipResult, String> {
    ensure_directory(dir)?;
    if files.is_empty() {
        return Err("請先選擇要打包的音效。".to_string());
    }

    let clean_base = clean_package_base(package_base)?;
    let target = unique_zip_name(dir, &clean_base)?;
    let target_path = safe_zip_path(dir, &target)?;
    let stage = dir.join(format!(".poe-audio-package-{}-{}", std::process::id(), modified_stamp()));
    fs::create_dir(&stage).map_err(|err| err.to_string())?;

    let result = (|| {
        for file in &files {
            let source = safe_path(dir, file)?;
            if !source.is_file() {
                return Err(format!("{file} 不存在。"));
            }
            fs::copy(source, stage.join(file)).map_err(|err| err.to_string())?;
        }

        compress_directory(&stage, &target_path)?;
        Ok(PackageZipResult {
            target: target.clone(),
            count: files.len(),
            message: format!("已建立 {target}，包含 {} 個音效。", files.len()),
        })
    })();

    let _ = fs::remove_dir_all(stage);
    if result.is_err() {
        let _ = fs::remove_file(target_path);
    }
    result
}

fn clean_package_base(input: &str) -> Result<String, String> {
    let raw = input.trim();
    if raw.is_empty() {
        return Err("請輸入 ZIP 名稱。".to_string());
    }

    let mut base = if extension(raw) == ".zip" {
        raw[..raw.len() - 4].to_string()
    } else {
        raw.to_string()
    };
    base.retain(|ch| !matches!(ch, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') && !ch.is_control());
    let base = base.trim_end_matches(['.', ' ']).trim().to_string();
    if base.is_empty() {
        Err("ZIP 名稱無效。".to_string())
    } else {
        Ok(base)
    }
}

fn safe_zip_path(dir: &Path, file_name: &str) -> Result<PathBuf, String> {
    let path = Path::new(file_name);
    if path.components().count() != 1
        || path.components().any(|component| !matches!(component, Component::Normal(_)))
        || extension(file_name) != ".zip"
    {
        return Err("ZIP 檔名無效。".to_string());
    }
    Ok(dir.join(file_name))
}

fn unique_zip_name(dir: &Path, base: &str) -> Result<String, String> {
    let mut index = 2;
    let mut candidate = format!("{base}.zip");
    while safe_zip_path(dir, &candidate)?.exists() {
        candidate = format!("{base}_{index}.zip");
        index += 1;
    }
    Ok(candidate)
}

fn compress_directory(stage: &Path, target_path: &Path) -> Result<(), String> {
    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Compress-Archive -Path $env:POE_ZIP_SOURCE -DestinationPath $env:POE_ZIP_TARGET -Force",
        ])
        .env("POE_ZIP_SOURCE", stage.join("*"))
        .env("POE_ZIP_TARGET", target_path)
        .output()
        .map_err(|err| err.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if message.is_empty() { "建立 ZIP 失敗。".to_string() } else { message })
    }
}

fn open_folder(dir: &Path, target: Option<&Path>) -> Result<(), String> {
    let mut command = Command::new("explorer.exe");
    if let Some(target) = target {
        command.arg(format!("/select,{}", target.to_string_lossy()));
    } else {
        command.arg(dir);
    }
    command.spawn().map_err(|err| err.to_string())?;
    Ok(())
}

fn modified_stamp() -> u128 {
    std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn assert_audio_file_name(file_name: &str) -> Result<(), String> {
    if file_name.trim().is_empty() {
        return Err("缺少音效檔名。".to_string());
    }
    let path = Path::new(file_name);
    if path.components().count() != 1 || path.components().any(|component| !matches!(component, Component::Normal(_))) {
        return Err("音效檔名不能包含路徑。".to_string());
    }
    if !AUDIO_EXTENSIONS.contains(&extension(file_name).as_str()) {
        return Err("只支援 mp3、wav、ogg、flac、m4a、aac。".to_string());
    }
    Ok(())
}

fn clean_target_base(input: &str) -> Result<String, String> {
    let raw = input.trim();
    if raw.is_empty() {
        return Err("請輸入目標名字。".to_string());
    }

    let ext = extension(raw);
    let mut base = if AUDIO_EXTENSIONS.contains(&ext.as_str()) {
        raw[..raw.len() - ext.len()].to_string()
    } else {
        raw.to_string()
    };
    base.retain(|ch| !matches!(ch, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') && !ch.is_control());
    let base = base.trim_end_matches(['.', ' ']).trim().to_string();

    if base.is_empty() {
        Err("目標名字無效。".to_string())
    } else {
        Ok(base)
    }
}

fn safe_path(dir: &Path, file_name: &str) -> Result<PathBuf, String> {
    assert_audio_file_name(file_name)?;
    Ok(dir.join(file_name))
}

fn unique_name(dir: &Path, base: &str, ext: &str) -> Result<String, String> {
    let mut index = 2;
    let mut candidate = format!("{base}{ext}");
    while safe_path(dir, &candidate)?.exists() {
        candidate = format!("{base}_{index}{ext}");
        index += 1;
    }
    Ok(candidate)
}

fn temp_name(dir: &Path, ext: &str) -> Result<String, String> {
    for i in 0..20 {
        let candidate = format!(".poe-audio-manager-{}-{i}{ext}", std::process::id());
        if !safe_path(dir, &candidate)?.exists() {
            return Ok(candidate);
        }
    }
    Err("無法建立暫存檔名。".to_string())
}

fn extension(file_name: &str) -> String {
    Path::new(file_name)
        .extension()
        .map(|ext| format!(".{}", ext.to_string_lossy()).to_ascii_lowercase())
        .unwrap_or_default()
}

fn mime_type(ext: String) -> &'static str {
    match ext.as_str() {
        ".mp3" => "audio/mpeg",
        ".wav" => "audio/wav",
        ".ogg" => "audio/ogg",
        ".flac" => "audio/flac",
        ".m4a" => "audio/mp4",
        ".aac" => "audio/aac",
        _ => "application/octet-stream",
    }
}
