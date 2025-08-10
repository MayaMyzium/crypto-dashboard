這是一個簡易的加密市場儀表板與分析網站，包含以下檔案：

- index.html － 首頁：顯示恐懼與貪婪指數、指定比特幣地址餘額與折線圖，以及多幣種即時價格、RSI 與簡易買賣區。
- app.js － 首頁邏輯腳本。
- analysis.html － 進一步分析頁：可輸入 Cloudflare Worker URL，抓取 Binance/OKX 永續合約資料，並綜合 RSI、短線動能與合約指標推算偏多/偏空與進場/停損/停利點位。
- analysis.js － 分析頁邏輯腳本。
- worker.js － Cloudflare Worker 範本：允許特定 Binance/OKX 端點，處理 CORS 並快取 30 秒。

使用說明：
1. 將上述 HTML/JS 檔案放到 GitHub Pages 或其他靜態網站即可運行。
2. 在 Cloudflare 建立一個新的 Worker，將 worker.js 內容貼入並部署，取得例如 `https://xxx.workers.dev` 的 URL。
3. 開啟 analysis.html，於頁面最上方輸入框貼入你的 Worker URL，按「儲存」。之後頁面會每分鐘自動更新分析結果。
4. 所有數據與指標僅供學習參考，不構成投資建議。