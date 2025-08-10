# 部署指引：使用 GitHub Pages 與 Namecheap 自訂域名

本資料夾包含一個簡單的靜態網頁，利用免費的 API 顯示虛擬貨幣相關資訊並進行多空比分析。您可以將整個資料夾上傳至 GitHub 倉庫並透過 GitHub Pages 免費部署，然後使用 Namecheap 的自訂網域指向該站點。

## 目錄結構

- `index.html`：首頁，顯示恐懼貪婪指數、比特幣地址每日餘額折線圖，以及幣價/RSI 表格。
- `analysis.html`：深入分析頁面，顯示 Binance 和 OKX 的永續合約多空比及改良的分析公式。
- `script.js`：首頁的 JavaScript，包含抓取 Blockchain.com、CoinGecko API 的程式碼並繪製圖表。
- `analysis.js`：分析頁面使用的 JavaScript，用於取得多空比資料並呈現演算法示例。
- `style.css`：共同樣式表。
- `README.md`：使用說明與部署指引（本檔）。

## 在本機測試

您可以在本機打開 `index.html` 和 `analysis.html` 來查看效果。然而，由於瀏覽器對混合內容的限制，部分 API 可能只能在 HTTPS 環境下順利運作，建議使用本地開發伺服器或直接部署至 GitHub Pages 測試。

## 部署到 GitHub Pages

1. 建立一個新的 GitHub 倉庫，命名任意，例如 `crypto-dashboard`。
2. 將本資料夾中的檔案全部推送到倉庫的 `main` 分支。根目錄必須包含 `index.html`。
3. 在 GitHub 中開啟倉庫的 **Settings → Pages**，選擇 **Source** 為 `Deploy from a branch`，分支選擇 `main`，資料夾選擇 `/ (root)`，然後按下 **Save**。完成後 GitHub 會提供一個以 `https://<username>.github.io/<repo>/` 開頭的網址。
4. （可選）如果您使用的是使用者或組織主頁倉庫（名稱為 `<username>.github.io`），則直接將檔案推送到主頁倉庫即可，不必選擇子路徑。

## 連接 Namecheap 自訂域名

若您想使用在 Namecheap 購買的網域指向 GitHub Pages，請按照以下步驟操作：

1. 按照 Namecheap 教學登入帳戶，進入 **Domain List** 頁面，點選欲配置的網域右側的 **Manage** 按鈕。接著進入 **Advanced DNS** 分頁，新增下列記錄（若已有相同主機記錄，請先刪除）：

   - 為 `@` 主機（頂層網域）建立四條 **A** 記錄，指向 GitHub 的四個 IP：
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - 為 `www` 主機建立一條 **CNAME** 記錄，目標值填寫您的 GitHub Pages 使用者網址，例如 `username.github.io`【598729087720923†L226-L255】。
   - 儲存後等待 DNS 生效，一般需要 30 分鐘左右。

2. 回到 GitHub 倉庫的 **Settings → Pages**，在 **Custom domain** 欄位填入您的完整網域（例如 `www.yourdomain.com`），然後點擊 **Save**。GitHub 會自動嘗試驗證並為您的網站配置 HTTPS。

3. 在您的倉庫根目錄新增一個名為 `CNAME` 的檔案（不含副檔名），內容僅輸入您的網域名稱，例如：

   ```
   www.yourdomain.com
   ```

   提交後即可告知 GitHub 使用此自訂域名。

更多關於使用自訂域名的建議，可參考 Namecheap 文件【598729087720923†L226-L255】與 GitHub Docs 的相關章節。

## API 注意事項

- **恐懼貪婪指數**：使用 Alternative.me 官方提供的圖片嵌入即可【773319243745337†L149-L160】。
- **比特幣地址資料**：透過 `https://blockchain.info/rawaddr/<address>?cors=true` 取得交易，`&cors=true` 允許跨域使用【993493370501237†L20-L21】。
- **幣價與 RSI**：使用 CoinGecko 的 `market_chart` API【352504453237112†L40-L82】。如果需要更長期或更頻繁的更新，可調整 `days` 參數或改用 WebSocket。
- **多空比資料**：Binance 開放的 Top Trader 長短比 API【750987118967491†L86-L111】可直接使用。OKX 的資料則透過第三方 Amberdata API 取得【786883057243163†L441-L500】；您需要在
  <https://amberdata.io> 註冊免費金鑰，然後在 `analysis.js` 中填入 `YOUR_AMBERDATA_API_KEY`。

## 進階：自製指標與策略

`analysis.html` 中的演算法區塊展示了一個綜合經濟學與量化交易的範例公式，用來從多空比資料推導做多與做空點位。若您熟悉程式語言，可根據該模型將其移植為 JavaScript 或 Python，並結合實際的長短比和行情數據進行回測與自動化交易。該公式使用 winsorize、滾動 Z 分數、成交量權重及趨勢過濾，並採用歷史分位數作為進出場門檻。

祝您部署成功並從中學習更多關於網站開發與數據分析的知識！