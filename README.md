# POE Filter Audio Manager

| [中文](#中文) | [English](#english) |
| --- | --- |

## 中文

本地用的 Path of Exile 過濾器音效管理器。它會管理你指定資料夾裡的音效檔，支援試聽、套用過濾器音效命名規則、手動改名、規則管理，以及在目標檔名已存在時交換名字或把舊檔加後綴。

### 使用方式

1. 在這個資料夾執行：

   ```powershell
   npm start
   ```

2. 開發時可以用瀏覽器進入：

   ```text
   http://localhost:5173
   ```

   或建立輕量桌面版：

   ```powershell
   npm run build:win
   ```

   Windows 桌面版由 Pake/Tauri 包裝，不再使用 Electron。打包產物會放在 `release\`。

3. 貼上 POE 過濾器音效所在資料夾，例如：

   ```text
   C:\Users\你的名字\Documents\My Games\Path of Exile
   ```

   Pake 桌面版可以按路徑欄旁邊的 `...` 選擇資料夾，也可以使用下方預設資料夾按鈕或手動貼上路徑。桌面版透過 Tauri 原生命令讀寫音效檔，不會跳出 Chromium 檔案權限提示。

4. 檔案列表每個檔名右邊都有播放按鈕，可以直接試聽。
5. 選擇音效後，可從右側下拉選單選目標規則並套用改名。
6. 目前音效旁邊的編輯按鈕可以手動輸入檔名；副檔名會保留原本格式。
7. 標題旁邊的 `ZH` / `EN` 可以切換中文或英文介面。
8. 左側規則清單底部的 `+` 可以新增規則；每條規則旁邊可以編輯或刪除。

### 重名處理

- `先停下來`：若目標檔名已存在，停止操作並提示。
- `交換名字`：若目標檔名已存在，將兩個音效檔名互換。
- `舊檔加後綴`：若目標檔名已存在，當前選中的音效會取得目標檔名，原本佔用目標檔名的舊音效會改成 `目標_2.mp3`、`目標_3.mp3` 這類新名字。

### 支援音效格式

`mp3`、`wav`、`ogg`、`flac`、`m4a`、`aac`

### 打包 Windows 桌面版

1. 安裝依賴：

   ```powershell
   npm.cmd install --cache .\.npm-cache
   ```

2. 建立 Windows 安裝版與可攜版：

   ```powershell
   npm run build:win
   ```

   Pake 首次打包需要 Rust 1.85+ 工具鏈；如果本機沒有 Rust，Pake 會提示安裝或需要你先安裝 Rust。

3. 主要產物會在 `release\`。腳本會使用：

   ```text
   public\index.html
   assets\app-icon.ico
   ```

   桌面版使用 `assets\app-icon.ico` 作為 Windows icon，並在視窗縮小時自動等比縮放介面，避免出現外層頁面捲軸。

### 前端結構

- `public/app.js`：入口、事件綁定、初始化。
- `public/js/i18n.js`：中英文文字。
- `public/js/context.js`：共用狀態與 DOM 節點。
- `public/js/files.js`：音效列表、逐列播放、選取音效。
- `public/js/rules.js`：規則新增、編輯、刪除與目標規則選單。
- `public/js/inspector.js`：右側操作區、規則改名、手動改名。
- `public/js/actions.js`：載入資料夾與預設資料夾。
- `public/js/native.js`：Pake/Tauri 桌面版原生檔案命令橋接。
- `public/js/local-files.js`：非 Tauri 瀏覽器 fallback 的本地資料夾授權、掃描、播放與改名。
- `public/js/log.js`、`public/js/api.js`、`public/js/storage.js`、`public/js/utils.js`、`public/js/volume.js`：共用輔助模組。

## English

A local Path of Exile filter audio manager. It manages audio files in a selected folder, supports quick preview, filter-rule renaming, manual renaming, rule management, and duplicate handling by swapping names or moving the old file to a suffixed name.

### Usage

1. Run this command in the project folder:

   ```powershell
   npm start
   ```

2. During development, open the app in your browser:

   ```text
   http://localhost:5173
   ```

   Or build the lightweight desktop app:

   ```powershell
   npm run build:win
   ```

   The Windows desktop app is packaged by Pake/Tauri and no longer uses Electron. Build outputs are written to `release\`.

3. Paste the folder path that contains your POE filter audio files, for example:

   ```text
   C:\Users\YourName\Documents\My Games\Path of Exile
   ```

   In the Pake desktop app, press `...` beside the path field, use the default folder buttons below it, or paste a path manually. The desktop app reads and writes audio files through native Tauri commands, so Chromium file permission prompts are not shown.

4. Use the play button beside each file name to preview audio directly.
5. Select an audio file, choose a target rule from the right-side dropdown, then apply the rename.
6. Use the edit button beside the current audio name to manually rename the file; the original extension is preserved.
7. Use the `ZH` / `EN` button beside the title to switch between Chinese and English UI.
8. Use the `+` button under the rules list to add rules; each rule can also be edited or deleted.

### Duplicate Handling

- `Stop first`: stop and show a warning if the target file name already exists.
- `Swap names`: swap the selected audio file name with the existing target file name.
- `Suffix old file`: the selected audio file takes the target file name, and the old file that occupied that name is renamed to `target_2.mp3`, `target_3.mp3`, etc.

### Supported Audio Formats

`mp3`, `wav`, `ogg`, `flac`, `m4a`, `aac`

### Build The Windows Desktop App

1. Install dependencies:

   ```powershell
   npm.cmd install --cache .\.npm-cache
   ```

2. Build the Windows installer and portable exe:

   ```powershell
   npm run build:win
   ```

   The first Pake build requires the Rust 1.85+ toolchain. If Rust is missing, Pake will prompt for installation or you can install Rust first.

3. The main outputs are created under `release\`. The script packages:

   ```text
   public\index.html
   assets\app-icon.ico
   ```

   The desktop app uses `assets\app-icon.ico` as its Windows icon and automatically scales the interface down when the window is smaller, avoiding an outer page scrollbar.

### Frontend Structure

- `public/app.js`: entry point, event binding, initialization.
- `public/js/i18n.js`: Chinese and English UI text.
- `public/js/context.js`: shared state and DOM references.
- `public/js/files.js`: audio list, row-level playback, audio selection.
- `public/js/rules.js`: add, edit, delete rules and target-rule options.
- `public/js/inspector.js`: right-side action panel, rule rename, manual rename.
- `public/js/actions.js`: folder loading and default folders.
- `public/js/native.js`: native file-command bridge for the Pake/Tauri desktop app.
- `public/js/local-files.js`: non-Tauri browser fallback for folder permission, scanning, playback, and rename operations.
- `public/js/log.js`, `public/js/api.js`, `public/js/storage.js`, `public/js/utils.js`, `public/js/volume.js`: shared helper modules.
