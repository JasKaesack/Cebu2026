# Cebu × Bohol 2026 — 3D 小島版

把這個資料夾裡的**全部檔案與資料夾**（index.html、sw.js、manifest.webmanifest、三個 png、js/、vendor/）
原樣放到網站根目錄即可（GitHub Pages：在 repo 頁面用 Add file → Upload files，把整個資料夾拖進去）。

- `index.html`：頁面本體，原有 16 個區塊的文字、圖片、地圖連結、勾選清單都在裡面。
- `js/`：3D 小島程式（island.js 主程式、props.js 地景、life.js 海洋生物與人物、field.js 地形、kit.js 模型、geo-data.js 地理資料）。
- `vendor/`：three.js 0.169.0（MIT 授權，授權檔在 vendor/THREE-LICENSE.txt）。
- 網址參數 `?q=low|mid|high` 可強制指定畫質（預設自動判斷）。
- 必須用 http(s) 開啟；直接雙擊 index.html（file://）時瀏覽器會擋 3D 模組，頁面會自動改用平面示意圖，內容照常可讀。
