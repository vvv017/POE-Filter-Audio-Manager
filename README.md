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

2. 打開瀏覽器進入：

   ```text
   http://localhost:5173
   ```

3. 貼上 POE 過濾器音效所在資料夾，例如：

   ```text
   C:\Users\你的名字\Documents\My Games\Path of Exile
   ```

4. 檔案列表每個檔名右邊都有播放按鈕，可以直接試聽。
5. 選擇音效後，可從右側下拉選單選目標規則並套用改名。
6. 目前音效旁邊的編輯按鈕可以手動輸入檔名；副檔名會保留原本格式。
7. 標題旁邊的 `ZH` / `EN` 可以切換中文或英文介面。
8. 左側規則清單底部的 `+` 可以新增規則；每條規則旁邊可以編輯或刪除。規則會存在瀏覽器本地。

### 重名處理

- `先停下來`：若目標檔名已存在，停止操作並提示。
- `交換名字`：若目標檔名已存在，將兩個音效檔名互換。
- `舊檔加後綴`：若目標檔名已存在，當前選中的音效會取得目標檔名，原本佔用目標檔名的舊音效會改成 `目標_2.mp3`、`目標_3.mp3` 這類新名字。

### 支援音效格式

`mp3`、`wav`、`ogg`、`flac`、`m4a`、`aac`

### 前端結構

- `public/app.js`：入口、事件綁定、初始化。
- `public/js/i18n.js`：中英文文字。
- `public/js/context.js`：共用狀態與 DOM 節點。
- `public/js/files.js`：音效列表、逐列播放、選取音效。
- `public/js/rules.js`：規則新增、編輯、刪除與目標規則選單。
- `public/js/inspector.js`：右側操作區、規則改名、手動改名。
- `public/js/actions.js`：載入資料夾與預設資料夾。
- `public/js/log.js`、`public/js/api.js`、`public/js/storage.js`、`public/js/utils.js`、`public/js/volume.js`：共用輔助模組。

## English

A local Path of Exile filter audio manager. It manages audio files in a selected folder, supports quick preview, filter-rule renaming, manual renaming, rule management, and duplicate handling by swapping names or moving the old file to a suffixed name.

### Usage

1. Run this command in the project folder:

   ```powershell
   npm start
   ```

2. Open the app in your browser:

   ```text
   http://localhost:5173
   ```

3. Paste the folder path that contains your POE filter audio files, for example:

   ```text
   C:\Users\YourName\Documents\My Games\Path of Exile
   ```

4. Use the play button beside each file name to preview audio directly.
5. Select an audio file, choose a target rule from the right-side dropdown, then apply the rename.
6. Use the edit button beside the current audio name to manually rename the file; the original extension is preserved.
7. Use the `ZH` / `EN` button beside the title to switch between Chinese and English UI.
8. Use the `+` button under the rules list to add rules; each rule can also be edited or deleted. Rules are saved in browser local storage.

### Duplicate Handling

- `Stop first`: stop and show a warning if the target file name already exists.
- `Swap names`: swap the selected audio file name with the existing target file name.
- `Suffix old file`: the selected audio file takes the target file name, and the old file that occupied that name is renamed to `target_2.mp3`, `target_3.mp3`, etc.

### Supported Audio Formats

`mp3`, `wav`, `ogg`, `flac`, `m4a`, `aac`

### Frontend Structure

- `public/app.js`: entry point, event binding, initialization.
- `public/js/i18n.js`: Chinese and English UI text.
- `public/js/context.js`: shared state and DOM references.
- `public/js/files.js`: audio list, row-level playback, audio selection.
- `public/js/rules.js`: add, edit, delete rules and target-rule options.
- `public/js/inspector.js`: right-side action panel, rule rename, manual rename.
- `public/js/actions.js`: folder loading and default folders.
- `public/js/log.js`, `public/js/api.js`, `public/js/storage.js`, `public/js/utils.js`, `public/js/volume.js`: shared helper modules.
