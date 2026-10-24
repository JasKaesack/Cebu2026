# Cebu × Bohol 2026 — 3D 小島版

把這個資料夾裡的**全部檔案與資料夾**原樣放到網站根目錄（GitHub Pages：repo 頁面 → Add file → Upload files，整批拖進去）。

- `index.html`：頁面本體（原有 16 個區塊的文字、圖片、地圖連結、勾選清單都在裡面）。
- 圖示：`icon-192.png`、`icon-512.png`、`icon-maskable-512.png`（Android 圓形遮罩用）、`apple-touch-icon.png`（iPhone 主畫面）。
- `manifest.webmanifest`、`sw.js`：加到主畫面與離線瀏覽用。
- `js/`：3D 小島（island.js、props.js、life.js、field.js、kit.js、geo-data.js）與背景音樂（music.js）。
- `vendor/`：three.js 0.169.0（MIT 授權，授權檔在 vendor/THREE-LICENSE.txt）。
- 網址參數 `?q=low|mid|high` 可強制指定畫質（預設自動判斷）。
- 必須用 http(s) 開啟；直接雙擊 index.html 時瀏覽器會擋 3D 模組，頁面會自動改用平面示意圖。
