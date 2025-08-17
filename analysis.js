document.addEventListener('DOMContentLoaded', () => {
  const coins = [
    { symbol: 'BTCUSDT', ccy: 'BTC', name: '比特幣' },
    { symbol: 'ETHUSDT', ccy: 'ETH', name: '以太幣' },
    { symbol: 'XRPUSDT', ccy: 'XRP', name: 'XRP' },
    { symbol: 'DOGEUSDT', ccy: 'DOGE', name: '狗狗幣' },
    { symbol: 'ADAUSDT', ccy: 'ADA', name: 'ADA' },
    { symbol: 'SOLUSDT', ccy: 'SOL', name: '索拉納' }
  ];
  const container = document.getElementById('analysis-container');
  coins.forEach((coin) => {
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '2rem';
    const title = document.createElement('h3');
    title.textContent = `${coin.name} (${coin.symbol}/${coin.ccy})`;
    wrapper.appendChild(title);
    const table = document.createElement('table');
    table.className = 'analysis-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th>時間</th><th>Binance 比率</th><th>Binance 變化</th><th>Bybit 比率</th><th>Bybit 變化</th><th>Binance 資金費率</th><th>Bybit 資金費率</th><th>情緒分數</th><th>分析</th></tr>`;
    const tbody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);
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
  updateSentimentChart().catch((err) => {
    console.error('情緒分數折線圖資料取得失敗', err);
  });

  try {
    updateSpecializedCETS();
  } catch (e) {
    console.error('updateSpecializedCETS error', e);
  }
  setInterval(() => {
    try {
      updateSpecializedCETS();
    } catch (e) {
      console.error('updateSpecializedCETS error', e);
    }
  }, 10 * 60 * 1000);

  try {
    updateTSAnalysis();
  } catch (e) {
    console.error('updateTSAnalysis error', e);
  }
  setInterval(() => {
    try {
      updateTSAnalysis();
    } catch (e) {
      console.error('updateTSAnalysis error', e);
    }
  }, 10 * 60 * 1000);

  try {
    updateGIRGAnalysis();
  } catch (e) {
    console.error('updateGIRGAnalysis error', e);
  }
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 1) {
      try {
        updateGIRGAnalysis();
      } catch (e) {
        console.error('updateGIRGAnalysis error', e);
      }
    }
  }, 60 * 1000);
});

async function updateAnalysis(coin, tbody) {
  const [binanceRatios, bybitRatios, binanceFR, bybitFR] = await Promise.all([
    fetchBinanceRatio(coin.symbol),
    fetchBybitRatio(coin.ccy),
    fetchBinanceFundingRate(coin.symbol),
    fetchBybitFundingRate(coin.symbol)
  ]);
  const binance = binanceRatios.slice(-3);
  const bybit = bybitRatios;
  const bybitMap = {};
  bybit.forEach((d) => {
    bybitMap[d.time] = d;
  });
  for (let idx = 0; idx < binance.length; idx++) {
    const i = idx;
    const row = document.createElement('tr');
    const time = binance[i].time;
    const bRatio = binance[i].ratio;
    const bPrev = i > 0 ? binance[i - 1].ratio : bRatio;
    const bDiff = bRatio - bPrev;
    const byData = bybitMap[time];
    const byRatio = byData ? byData.ratio : null;
    const byPrev = byData && bybitMap[binance[i - 1]?.time] ? bybitMap[binance[i - 1].time].ratio : byRatio;
    const byDiff = byRatio != null && byPrev != null ? byRatio - byPrev : null;
    const w1 = 0.4;
    const w2 = 0.3;
    const w3 = 0.3;
    const k = 10000;
    const lsrTerm = Math.tanh(bRatio - 1);
    const deltaTerm = Math.tanh(bDiff);
    const frVals = [];
    if (binanceFR !== null) frVals.push(binanceFR);
    if (bybitFR !== null) frVals.push(bybitFR);
    const avgFR = frVals.length > 0 ? frVals.reduce((a, b) => a + b, 0) / frVals.length : 0;
    const frTerm = Math.tanh(avgFR * k);
    const sentimentScore = w1 * lsrTerm + w2 * deltaTerm + w3 * frTerm;
    let analysis = '';
    if (bRatio > 1 && (byRatio == null || byRatio > 1)) analysis = '市場偏多';
    else if (bRatio < 1 && (byRatio != null && byRatio < 1)) analysis = '市場偏空';
    else analysis = '中性';
    const tdTime = document.createElement('td');
    tdTime.textContent = time;
    row.appendChild(tdTime);
    const tdBRatio = document.createElement('td');
    tdBRatio.textContent = bRatio.toFixed(3);
    row.appendChild(tdBRatio);
    const tdBDiff = document.createElement('td');
    tdBDiff.textContent = i === 0 ? '-' : bDiff.toFixed(3);
    row.appendChild(tdBDiff);
    const tdByRatio = document.createElement('td');
    tdByRatio.textContent = byRatio != null ? byRatio.toFixed(3) : 'N/A';
    row.appendChild(tdByRatio);
    const tdByDiff = document.createElement('td');
    tdByDiff.textContent = byDiff != null && i > 0 ? byDiff.toFixed(3) : (i === 0 ? '-' : 'N/A');
    row.appendChild(tdByDiff);
    const tdBFR = document.createElement('td');
    tdBFR.textContent = binanceFR !== null ? binanceFR.toFixed(6) : 'N/A';
    row.appendChild(tdBFR);
    const tdBybitFRCell = document.createElement('td');
    tdBybitFRCell.textContent = bybitFR !== null ? bybitFR.toFixed(6) : 'N/A';
    row.appendChild(tdBybitFRCell);
    const tdSS = document.createElement('td');
    tdSS.textContent = sentimentScore.toFixed(3);
    row.appendChild(tdSS);
    const tdAnalysis = document.createElement('td');
    tdAnalysis.textContent = analysis;
    row.appendChild(tdAnalysis);
    tbody.appendChild(row);
  }
}

async function fetchBinanceRatioWeekly(symbol) {
  try {
    const url = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=168`;
    const res = await fetch(url);
    const data = await res.json();
    return (data || []).map((d) => ({
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

async function fetchOKXRatio(ccy) {
  try {
    const end = Date.now();
    const begin = end - 60 * 60 * 1000;
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

async function fetchBybitRatio(ccy) {
  return fetchOKXRatio(ccy);
}

async function fetchBybitRatio(symbol) {
  try {
    const url = `https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${symbol}&period=5min&limit=3`;
    const res = await fetch(url);
    const json = await res.json();
    if (json && json.result && Array.isArray(json.result.list)) {
      return json.result.list.map((d) => {
        const buy = parseFloat(d.buyRatio);
        const sell = parseFloat(d.sellRatio);
        const ratio = sell === 0 ? null : buy / sell;
        return {
          time: new Date(parseInt(d.timestamp)).toLocaleTimeString('zh-TW', { hour12: false }),
          ratio: ratio != null ? ratio : null
        };
      });
    }
    return [];
  } catch (e) {
    console.error('fetchBybitRatio error', e);
    return [];
  }
}

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

async function fetchBybitFundingRate(symbol) {
  try {
    const url = `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${symbol}&limit=1`;
    const res = await fetch(url);
    const json = await res.json();
    if (json && json.result && Array.isArray(json.result.list) && json.result.list.length > 0) {
      const frStr = json.result.list[0].fundingRate;
      const fr = parseFloat(frStr);
      if (!isNaN(fr)) return fr;
    }
    return null;
  } catch (e) {
    console.error('fetchBybitFundingRate error', e);
    return null;
  }
}

async function fetchCoinbaseFundingRate(instId) {
  try {
    return null;
  } catch (e) {
    console.error('fetchCoinbaseFundingRate error', e);
    return null;
  }
}

function updateSpecializedCETS() {
  const L = 0.65;
  const S = 0.70;
  const configs = {
    BTC: { O: 0.85, w1: 0.25, w2: 0.25, w3: 0.50 },
    ETH: { O: 0.90, w1: 0.30, w2: 0.35, w3: 0.35 },
    XRP: { O: 0.50, w1: 0.35, w2: 0.35, w3: 0.30 },
    DOGE: { O: 0.50, w1: 0.20, w2: 0.50, w3: 0.30 },
    ADA: { O: 0.35, w1: 0.25, w2: 0.30, w3: 0.45 },
    SOL: { O: 0.90, w1: 0.25, w2: 0.30, w3: 0.45 }
  };
  Object.keys(configs).forEach((key) => {
    const cfg = configs[key];
    const cets = cfg.w1 * L + cfg.w2 * S + cfg.w3 * cfg.O;
    let category;
    if (cets >= 0.75) category = '高勝率進場區';
    else if (cets >= 0.55) category = '中性觀望區';
    else category = '風險高區';
    const valEl = document.getElementById(`cets-value-${key.toLowerCase()}`);
    const catEl = document.getElementById(`cets-category-${key.toLowerCase()}`);
    if (valEl) valEl.textContent = cets.toFixed(3);
    if (catEl) catEl.textContent = category;
  });
}

function updateTSAnalysis() {
  const configs = {
    btc: { M: 0.5, S: 0.7, O: 0.54, w1: 0.25, w2: 0.25, w3: 0.50 },
    eth: { M: 0.6, S: 0.7, O: 0.80, w1: 0.30, w2: 0.35, w3: 0.35 },
    xrp: { M: 0.8, S: 0.7, O: 0.83, w1: 0.35, w2: 0.35, w3: 0.30 },
    doge: { M: 0.4, S: 0.7, O: 0.82, w1: 0.20, w2: 0.50, w3: 0.30 },
    ada: { M: 0.6, S: 0.7, O: 0.79, w1: 0.25, w2: 0.30, w3: 0.45 },
    sol: { M: 0.6, S: 0.7, O: 0.80, w1: 0.25, w2: 0.30, w3: 0.45 }
  };
  Object.keys(configs).forEach((key) => {
    const cfg = configs[key];
    const ts = cfg.w1 * cfg.M + cfg.w2 * cfg.S + cfg.w3 * cfg.O;
    let cat;
    if (ts > 0.6) cat = '強烈看漲';
    else if (ts >= 0.3) cat = '中性';
    else cat = '看跌';
    const valEl = document.getElementById(`ts-value-${key}`);
    const catEl = document.getElementById(`ts-category-${key}`);
    if (valEl) valEl.textContent = ts.toFixed(2);
    if (catEl) catEl.textContent = cat;
  });
}

async function updateGIRGAnalysis() {
  const [sahm, usPmi, yc, globalPmi] = await Promise.all([
    fetchSahm(),
    fetchUSManufacturingPMI(),
    fetchYieldCurve(),
    fetchGlobalPMI()
  ]);

  const girg = 0.5 * (sahm / 0.50) +
               0.2 * (Math.max(0, 50 - usPmi) / 10) +
               0.15 * (Math.max(0, -yc) / 0.50) +
               0.15 * (Math.max(0, 50 - globalPmi) / 10);

  let category;
  if (girg < 0.5) category = '綠燈（穩定）';
  else if (girg < 1.0) category = '黃燈（警戒）';
  else category = '紅燈（高風險衰退）';

  document.getElementById('girg-value').textContent = girg.toFixed(2);
  document.getElementById('girg-category').textContent = category;
  document.getElementById('girg-s').textContent = sahm.toFixed(2);
  document.getElementById('girg-us-pmi').textContent = usPmi.toFixed(1);
  document.getElementById('girg-yc').textContent = yc.toFixed(2) + '%';
  document.getElementById('girg-global-pmi').textContent = globalPmi.toFixed(1);
}

async function fetchSahm() {
  try {
    const apiKey = 'YOUR_FRED_API_KEY';
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=SAHMREALTIME&api_key=${apiKey}&file_type=json&limit=1&sort_order=desc`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.observations && data.observations.length > 0) {
      return parseFloat(data.observations[0].value);
    }
    return 0.10;
  } catch (e) {
    console.error('fetchSahm error', e);
    return 0.10;
  }
}

async function fetchUSManufacturingPMI() {
  try {
    return 48.0;
  } catch (e) {
    console.error('fetchUSManufacturingPMI error', e);
    return 48.0;
  }
}

async function fetchYieldCurve() {
  try {
    const apiKey = 'YOUR_FRED_API_KEY';
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=T10Y2Y&api_key=${apiKey}&file_type=json&limit=1&sort_order=desc`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.observations && data.observations.length > 0) {
      return parseFloat(data.observations[0].value);
    }
    return 0.58;
  } catch (e) {
    console.error('fetchYieldCurve error', e);
    return 0.58;
  }
}

async function fetchGlobalPMI() {
  try {
    return 50.3;
  } catch (e) {
    console.error('fetchGlobalPMI error', e);
    return 50.3;
  }
}