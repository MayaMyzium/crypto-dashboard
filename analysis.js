// 永續合約多空分析腳本
document.addEventListener('DOMContentLoaded', () => {
  const coins = [
    { symbol: 'BTCUSDT', ccy: 'BTC', name: '比特幣' },
    { symbol: 'ETHUSDT', ccy: 'ETH', name: '以太幣' },
    { symbol: 'XRPUSDT', ccy: 'XRP', name: 'XRP' },
    { symbol: 'DOGEUSDT', ccy: 'DOGE', name: '狗狗幣' },
    { symbol: 'ADAUSDT', ccy: 'ADA', name: 'ADA' },
    // 新增 Solana
    { symbol: 'SOLUSDT', ccy: 'SOL', name: '索拉納' }
  ];
  const container = document.getElementById('analysis-container');
  coins.forEach((coin) => {
    // 建立表格區塊
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '2rem';
    const title = document.createElement('h3');
    title.textContent = `${coin.name} (${coin.symbol}/${coin.ccy})`;
    wrapper.appendChild(title);
    const table = document.createElement('table');
    table.className = 'analysis-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th>時間</th><th>Binance 比率</th><th>Binance 變化</th><th>OKX 比率</th><th>OKX 變化</th><th>Binance 資金費率</th><th>OKX 資金費率</th><th>情緒分數</th><th>分析</th></tr>`;
    const tbody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);
    // 取得資料並填入表格
    updateAnalysis(coin, tbody).catch((err) => {
      console.error('分析資料取得失敗', coin, err);
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 9;
      td.textContent = '無法取得資料';
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
  });
  // 取得表格資料後，繪製最近一週的情緒分數折線圖
  updateSentimentChart().catch((err) => {
    console.error('情緒分數折線圖資料取得失敗', err);
  });
});

async function updateAnalysis(coin, tbody) {
  // 同時取得幣安與 OKX 多空比率和資金費率
  const [binanceRatios, okxRatios, binanceFR, okxFR] = await Promise.all([
    fetchBinanceRatio(coin.symbol),
    fetchOKXRatio(coin.ccy),
    fetchBinanceFundingRate(coin.symbol),
    fetchOKXFundingRate(`${coin.ccy}-USDT-SWAP`)
  ]);
  // 只取最近三筆資料
  const binance = binanceRatios.slice(-3);
  const okx = okxRatios;
  // 對 OKX 資料以時間為鍵建立 map
  const okxMap = {};
  okx.forEach((d) => {
    okxMap[d.time] = d;
  });
  for (let idx = 0; idx < binance.length; idx++) {
    const i = idx;
    const row = document.createElement('tr');
    const time = binance[i].time;
    const bRatio = binance[i].ratio;
    const bPrev = i > 0 ? binance[i - 1].ratio : bRatio;
    const bDiff = bRatio - bPrev;
    const okData = okxMap[time];
    const oRatio = okData ? okData.ratio : null;
    const oPrev = okData && okxMap[binance[i - 1]?.time] ? okxMap[binance[i - 1].time].ratio : oRatio;
    const oDiff = oRatio != null && oPrev != null ? oRatio - oPrev : null;
    // 計算情緒分數：使用您的自訂公式
    // SS = w1 * tanh(LSR - 1) + w2 * tanh(ΔLSR) + w3 * tanh(FR * k)
    const w1 = 0.4;
    const w2 = 0.3;
    const w3 = 0.3;
    const k = 10000;
    const lsrTerm = Math.tanh(bRatio - 1);
    const deltaTerm = Math.tanh(bDiff);
    // 使用兩個平台平均資金費率作為 FR
    const avgFR = (binanceFR + okxFR) / 2;
    const frTerm = Math.tanh(avgFR * k);
    const sentimentScore = w1 * lsrTerm + w2 * deltaTerm + w3 * frTerm;
    // 分析：根據比率判斷
    let analysis = '';
    if (bRatio > 1 && (oRatio == null || oRatio > 1)) analysis = '市場偏多';
    else if (bRatio < 1 && (oRatio != null && oRatio < 1)) analysis = '市場偏空';
    else analysis = '中性';
    // 時間
    const tdTime = document.createElement('td');
    tdTime.textContent = time;
    row.appendChild(tdTime);
    // Binance 比率
    const tdBRatio = document.createElement('td');
    tdBRatio.textContent = bRatio.toFixed(3);
    row.appendChild(tdBRatio);
    // Binance 變化
    const tdBDiff = document.createElement('td');
    tdBDiff.textContent = i === 0 ? '-' : bDiff.toFixed(3);
    row.appendChild(tdBDiff);
    // OKX 比率
    const tdORatio = document.createElement('td');
    tdORatio.textContent = oRatio != null ? oRatio.toFixed(3) : 'N/A';
    row.appendChild(tdORatio);
    // OKX 變化
    const tdODiff = document.createElement('td');
    tdODiff.textContent = oDiff != null && i > 0 ? oDiff.toFixed(3) : (i === 0 ? '-' : 'N/A');
    row.appendChild(tdODiff);
    // Binance 資金費率
    const tdBFR = document.createElement('td');
    tdBFR.textContent = binanceFR !== null ? binanceFR.toFixed(6) : 'N/A';
    row.appendChild(tdBFR);
    // OKX 資金費率
    const tdOFR = document.createElement('td');
    tdOFR.textContent = okxFR !== null ? okxFR.toFixed(6) : 'N/A';
    row.appendChild(tdOFR);
    // 情緒分數
    const tdSS = document.createElement('td');
    tdSS.textContent = sentimentScore.toFixed(3);
    row.appendChild(tdSS);
    // 分析
    const tdAnalysis = document.createElement('td');
    tdAnalysis.textContent = analysis;
    row.appendChild(tdAnalysis);
    tbody.appendChild(row);
  }
}

/**
 * 從幣安取得過去一週（168 個小時）每小時的多空帳戶比率
 * 使用 period=1h，limit=168 取得資料【923837169191340†L93-L146】
 * 返回的資料倒序排列，因此使用 reverse() 轉為時間遞增。
 *
 * @param {string} symbol 幣安合約代碼，例如 BTCUSDT
 * @returns {Promise<Array<{time: string, ratio: number}>>} 時間與比率
 */
async function fetchBinanceRatioWeekly(symbol) {
  try {
    const url = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=168`;
    const res = await fetch(url);
    const data = await res.json();
    return (data || []).map((d) => ({
      // 使用當地時間字串（MM/dd HH:mm）便於標籤顯示
      time: new Date(parseInt(d.timestamp)).toLocaleString('zh-TW', {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      ratio: parseFloat(d.longShortRatio)
    })).reverse();
  } catch (e) {
    console.error('fetchBinanceRatioWeekly error', e);
    return [];
  }
}

/**
 * 依照給定的多空比率資料和固定資金費率計算情緒分數序列
 * 公式：SS = w1*tanh(LSR-1) + w2*tanh(ΔLSR) + w3*tanh(FR*k)
 *
 * @param {Array<{time:string, ratio:number}>} ratioData 多空比率資料
 * @param {number} avgFR 平均資金費率，可為 null
 * @returns {Array<number>} 情緒分數陣列
 */
function calculateSentimentScores(ratioData, avgFR) {
  const scores = [];
  const w1 = 0.4;
  const w2 = 0.3;
  const w3 = 0.3;
  const k = 10000;
  for (let i = 0; i < ratioData.length; i++) {
    const ratio = ratioData[i].ratio;
    const prevRatio = i > 0 ? ratioData[i - 1].ratio : ratio;
    const delta = ratio - prevRatio;
    const lsrTerm = Math.tanh(ratio - 1);
    const deltaTerm = Math.tanh(delta);
    const frTerm = Math.tanh(((avgFR ?? 0) * k));
    const ss = w1 * lsrTerm + w2 * deltaTerm + w3 * frTerm;
    scores.push(ss);
  }
  return scores;
}

/**
 * 生成並渲染最近一週每小時情緒分數的折線圖
 * 對五種幣別使用 Binance 的每小時多空比率和平均資金費率計算分數
 */
async function updateSentimentChart() {
  const ctx = document.getElementById('sentimentChart').getContext('2d');
  const coins = [
    { symbol: 'BTCUSDT', ccy: 'BTC', name: '比特幣', color: '#ff6384' },
    { symbol: 'ETHUSDT', ccy: 'ETH', name: '以太幣', color: '#36a2eb' },
    { symbol: 'XRPUSDT', ccy: 'XRP', name: 'XRP', color: '#ffce56' },
    { symbol: 'DOGEUSDT', ccy: 'DOGE', name: '狗狗幣', color: '#4bc0c0' },
    { symbol: 'ADAUSDT', ccy: 'ADA', name: 'ADA', color: '#9966ff' },
    // 新增 Solana，用不同顏色
    { symbol: 'SOLUSDT', ccy: 'SOL', name: '索拉納', color: '#00c49a' }
  ];
  let labels = [];
  const datasets = [];
  // 取得每種幣的平均資金費率（採用最新值，不可取得歷史）
  const avgFRs = await Promise.all(coins.map(async (coin) => {
    const [bfr, ofr] = await Promise.all([
      fetchBinanceFundingRate(coin.symbol),
      fetchOKXFundingRate(`${coin.ccy}-USDT-SWAP`)
    ]);
    let avg = 0;
    if (bfr != null && ofr != null) avg = (bfr + ofr) / 2;
    else if (bfr != null) avg = bfr;
    else if (ofr != null) avg = ofr;
    return avg;
  }));
  // 分別取得每種幣的多空比率資料並計算情緒分數
  for (let i = 0; i < coins.length; i++) {
    const coin = coins[i];
    const ratioData = await fetchBinanceRatioWeekly(coin.symbol);
    if (ratioData.length === 0) continue;
    // 計算情緒分數並取樣每兩小時一筆，以加大水平間距
    const scores = calculateSentimentScores(ratioData, avgFRs[i]);
    // 取樣：保留偶數索引，提高點與點之間的間距
    const sampledScores = scores.filter((_, idx) => idx % 2 === 0);
    const sampledTimes = ratioData.filter((_, idx) => idx % 2 === 0).map((d) => d.time);
    // 為了讓越接近現在的時間排在左邊，對取樣後的資料進行反轉
    const reversedScores = sampledScores.slice().reverse();
    const reversedTimes = sampledTimes.slice().reverse();
    if (labels.length === 0) {
      labels = reversedTimes;
    }
    datasets.push({
      label: coin.name,
      data: reversedScores,
      borderColor: coin.color,
      backgroundColor: coin.color,
      fill: false,
      tension: 0.2
    });
  }
  // 若之前有生成過圖表，先銷毀
  if (window.sentimentChartInstance) {
    window.sentimentChartInstance.destroy();
  }
  window.sentimentChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        title: { display: false }
      },
      elements: {
        line: {
          borderWidth: 1
        },
        point: {
          radius: 0,
          hitRadius: 6,
          hoverRadius: 3
        }
      },
      scales: {
        x: {
          title: { display: true, text: '時間' },
          ticks: { autoSkip: true, maxTicksLimit: 6 }
        },
        y: {
          title: { display: true, text: '情緒分數' },
          min: -1,
          max: 1,
          ticks: {
            // 每 0.1 顯示一個刻度，讓變化更細緻
            stepSize: 0.1
          }
        }
      }
    }
  });
}

/**
 * 從幣安取得全局多空帳戶比資料
 * API 文件參考【923837169191340†L93-L146】
 * @param {string} symbol 幣安合約符號，如 BTCUSDT
 */
async function fetchBinanceRatio(symbol) {
  try {
    // period=5m 取得5分鐘更新資料；Binance 不提供 1m 多空比
    const url = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=20`;
    const res = await fetch(url);
    const data = await res.json();
    // 轉換成時間、比率
    return (data || []).map((d) => ({
      time: new Date(parseInt(d.timestamp)).toLocaleTimeString('zh-TW', { hour12: false }),
      ratio: parseFloat(d.longShortRatio)
    }));
  } catch (e) {
    console.error('fetchBinanceRatio error', e);
    return [];
  }
}

/**
 * 從 OKX 取得合約多空持倉人數比資料
 * 根據 okx v5 rubik 接口【503583044887734†L293-L304】
 * @param {string} ccy 幣種符號，如 BTC
 */
async function fetchOKXRatio(ccy) {
  try {
    const end = Date.now();
    const begin = end - 60 * 60 * 1000; // 最近一小時
    // OKX 介面要求毫秒時間，period 支援 5m, 15m, 30m, 1h 等
    const url = `https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}&period=5m&begin=${begin}&end=${end}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json || !json.data || json.data.length === 0) {
      return [];
    }
    return json.data.map((d) => ({
      time: new Date(parseInt(d.ts)).toLocaleTimeString('zh-TW', { hour12: false }),
      ratio: parseFloat(d.longShortRatio)
    }));
  } catch (e) {
    console.error('fetchOKXRatio error', e);
    return [];
  }
}

/**
 * 從幣安取得最新資金費率
 * @param {string} symbol 合約代碼，例如 BTCUSDT
 * 介面：GET https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1
 * 返回最近一條 funding rate 記錄
 */
async function fetchBinanceFundingRate(symbol) {
  try {
    const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const fr = parseFloat(data[0].fundingRate);
      return fr;
    }
    return null;
  } catch (e) {
    console.error('fetchBinanceFundingRate error', e);
    return null;
  }
}

/**
 * 從 OKX 取得最新資金費率
 * @param {string} instId 如 BTC-USDT-SWAP
 * 接口：GET https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP
 */
async function fetchOKXFundingRate(instId) {
  try {
    const url = `https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json && json.data && json.data.length > 0) {
      const fr = parseFloat(json.data[0].fundingRate);
      return fr;
    }
    return null;
  } catch (e) {
    console.error('fetchOKXFundingRate error', e);
    return null;
  }
}

// 本頁不再使用圖表，改為表格顯示，故 drawAnalysisChart 移除