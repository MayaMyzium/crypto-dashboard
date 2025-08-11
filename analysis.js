// 永續合約多空分析腳本
document.addEventListener('DOMContentLoaded', () => {
  const coins = [
    { symbol: 'BTCUSDT', ccy: 'BTC', name: '比特幣' },
    { symbol: 'ETHUSDT', ccy: 'ETH', name: '以太幣' },
    { symbol: 'XRPUSDT', ccy: 'XRP', name: 'XRP' },
    { symbol: 'DOGEUSDT', ccy: 'DOGE', name: '狗狗幣' },
    { symbol: 'ADAUSDT', ccy: 'ADA', name: 'ADA' }
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
    thead.innerHTML = `<tr><th>時間</th><th>Binance 比率</th><th>Binance 變化</th><th>OKX 比率</th><th>OKX 變化</th><th>分析</th></tr>`;
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
      td.colSpan = 6;
      td.textContent = '無法取得資料';
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
  });
});

async function updateAnalysis(coin, tbody) {
  // 同時取得幣安與 OKX 資料
  const [binance, okx] = await Promise.all([
    fetchBinanceRatio(coin.symbol),
    fetchOKXRatio(coin.ccy)
  ]);
  // 對 OKX 資料以時間為鍵建立 map
  const okxMap = {};
  okx.forEach((d) => {
    okxMap[d.time] = d;
  });
  for (let i = 0; i < binance.length; i++) {
    const row = document.createElement('tr');
    const time = binance[i].time;
    const bRatio = binance[i].ratio;
    const bPrev = i > 0 ? binance[i - 1].ratio : bRatio;
    const bDiff = bRatio - bPrev;
    const okData = okxMap[time];
    const oRatio = okData ? okData.ratio : null;
    const oPrev = okData && okxMap[binance[i - 1]?.time] ? okxMap[binance[i - 1].time].ratio : oRatio;
    const oDiff = oRatio != null && oPrev != null ? oRatio - oPrev : null;
    // 分析：若二者皆 >1 則偏多；若皆 <1 則偏空；其餘為中性
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
    // 分析
    const tdAnalysis = document.createElement('td');
    tdAnalysis.textContent = analysis;
    row.appendChild(tdAnalysis);
    tbody.appendChild(row);
  }
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

// 本頁不再使用圖表，改為表格顯示，故 drawAnalysisChart 移除