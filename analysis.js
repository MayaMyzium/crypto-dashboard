// analysis.js: 分析頁邏輯

// 資產列表及其對應交易所代號
const assets = [
  { id: 'bitcoin',  name: '比特幣', symbol: 'BTCUSDT', okxInst: 'BTC-USDT-SWAP' },
  { id: 'ethereum', name: '以太幣', symbol: 'ETHUSDT', okxInst: 'ETH-USDT-SWAP' },
  { id: 'ripple',   name: 'XRP',   symbol: 'XRPUSDT', okxInst: 'XRP-USDT-SWAP' },
  { id: 'dogecoin', name: '狗狗幣', symbol: 'DOGEUSDT', okxInst: 'DOGE-USDT-SWAP' },
  { id: 'cardano',  name: 'ADA',   symbol: 'ADAUSDT', okxInst: 'ADA-USDT-SWAP' }
];

// 儲存上一分鐘價格與 OI 用以計算變化
const lastPrices = new Map();
const lastOI     = {}; // symbol -> 上次 OI

// 從 localStorage 讀取 worker URL
let WORKER = localStorage.getItem('workerBase') || '';

// 設定儲存 worker URL 按鈕功能
document.getElementById('saveWorker').addEventListener('click', () => {
  const input = document.getElementById('workerInput');
  const url = input.value.trim();
  if (url) {
    WORKER = url;
    localStorage.setItem('workerBase', WORKER);
    alert('已儲存 Worker URL！');
  } else {
    alert('請輸入有效的 Worker 網址');
  }
});

// 將已存的 URL 塞進輸入框
document.getElementById('workerInput').value = WORKER;

// 計算 30 日日線平均絕對變動作為簡易 ATR
function simpleATRfromCloses(closes) {
  if (!closes || closes.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < closes.length; i++) {
    sum += Math.abs(closes[i] - closes[i-1]);
  }
  return sum / (closes.length - 1);
}

// 綜合 RSI、短線動能、合約多空比例與 OI 變化來判斷偏向
function decideBias(rsi, oneMinChangePct, ls, oiDelta) {
  let score = 0;
  if (rsi < 30) score += 1;
  if (rsi > 70) score -= 1;
  if (oneMinChangePct > 0.15) score += 1;
  if (oneMinChangePct < -0.15) score -= 1;
  if (ls) {
    if ((ls.long - ls.short) > 5) score += 1;
    if ((ls.short - ls.long) > 5) score -= 1;
  }
  if (oiDelta != null) {
    if (oiDelta > 0 && oneMinChangePct > 0) score += 0.5;
    if (oiDelta > 0 && oneMinChangePct < 0) score -= 0.5;
  }
  if (score >= 1) return 'LONG';
  if (score <= -1) return 'SHORT';
  return 'NEUTRAL';
}

// 根據偏向與 ATR 計算進場/停損/停利
function makeLevels(now, atr, bias) {
  if (!now || !atr) return null;
  const trigger = Math.max(atr * 0.2, now * 0.001);
  const stop = atr * 1.0;
  const take = atr * 1.8;
  if (bias === 'LONG') {
    const entry = now + trigger;
    return {
      entry: entry,
      stop: entry - stop,
      take: entry + take
    };
  } else if (bias === 'SHORT') {
    const entry = now - trigger;
    return {
      entry: entry,
      stop: entry + stop,
      take: entry - take
    };
  }
  return null;
}

// 向 Worker 發送請求
async function wFetch(target, path, qs) {
  if (!WORKER) return null;
  const url = `${WORKER}?target=${target}&path=${path}${qs ? `&qs=${qs}` : ''}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// 取得合約指標：Binance top long/short ratio 與 OI 變化
async function fetchDerivsFor(asset) {
  const out = { ls: null, oiDelta: null };
  if (!WORKER) return out;
  try {
    // Top Long/Short Ratio
    const lsData = await wFetch('binance', '/futures/data/topLongShortAccountRatio', `symbol=${asset.symbol}&period=5m&limit=1`);
    if (Array.isArray(lsData) && lsData.length > 0) {
      const last = lsData[lsData.length - 1];
      // API 回傳可能包含 longShortRatio: '1.5' 代表 多/空；但原文件 indicated ratio field. We'll parse if object has longAccount and shortAccount.
      if (last.longAccount && last.shortAccount) {
        out.ls = { long: parseFloat(last.longAccount), short: parseFloat(last.shortAccount) };
      } else if (last.longShortRatio) {
        // 有些返回 ratio 以冒號分隔
        const parts = String(last.longShortRatio).split(":");
        if (parts.length === 2) {
          out.ls = { long: parseFloat(parts[0]), short: parseFloat(parts[1]) };
        }
      }
    }
    // Binance OI
    const oiRes = await wFetch('binance', '/fapi/v1/openInterest', `symbol=${asset.symbol}`);
    if (oiRes && oiRes.openInterest) {
      const nowOI = parseFloat(oiRes.openInterest);
      if (!Number.isNaN(nowOI)) {
        if (lastOI[asset.symbol] != null) {
          out.oiDelta = nowOI - lastOI[asset.symbol];
        }
        lastOI[asset.symbol] = nowOI;
      }
    }
    // OKX OI 可擴充（目前暫不使用於分析）
    await wFetch('okx', '/api/v5/public/open-interest', `instType=SWAP&instId=${asset.okxInst}`);
  } catch (e) {
    // 忽略
  }
  return out;
}

// 取得即時價格
async function fetchPrices(ids) {
  const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
  return await r.json();
}

// 取得 30 日日線收盤
async function fetchDailyCloses(id) {
  const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=30&interval=daily`);
  const j = await r.json();
  return (j.prices || []).map(p => p[1]);
}

// 主渲染函式
async function render() {
  const ids = assets.map(a => a.id).join(',');
  let prices;
  try {
    prices = await fetchPrices(ids);
  } catch (e) {
    prices = {};
  }
  const tbody = document.querySelector('#analysisTable tbody');
  tbody.innerHTML = '';
  for (const asset of assets) {
    const now = prices[asset.id]?.usd || 0;
    const prev = lastPrices.get(asset.id) || now;
    const changePct = ((now - prev) / (prev || 1)) * 100;
    lastPrices.set(asset.id, now);
    // RSI 與 ATR
    let closes = [];
    try {
      closes = await fetchDailyCloses(asset.id);
    } catch (e) {}
    // RSI
    let rsi = 50;
    const lookback = 14;
    if (closes && closes.length > lookback) {
      let gains=0, losses=0;
      for (let i = closes.length - lookback; i < closes.length; i++) {
        if (i <= 0) continue;
        const diff = closes[i] - closes[i-1];
        if (diff > 0) gains += diff; else losses += -diff;
      }
      const avgG = gains / lookback;
      const avgL = losses / lookback;
      if (avgL === 0 && avgG > 0) rsi = 100;
      else if (avgG === 0 && avgL > 0) rsi = 0;
      else if (avgL > 0) rsi = 100 - (100 / (1 + (avgG/avgL)));
    }
    const atr = simpleATRfromCloses(closes);
    // 取得合約資料
    const derivs = await fetchDerivsFor(asset);
    const bias = decideBias(rsi, changePct, derivs.ls, derivs.oiDelta);
    const levels = makeLevels(now, atr, bias);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${asset.name}</td>
      <td>${now.toLocaleString('en-US',{maximumFractionDigits:2})}</td>
      <td>${changePct.toFixed(2)}%</td>
      <td>${rsi.toFixed(1)}</td>
      <td>${bias === 'LONG' ? '偏多' : bias === 'SHORT' ? '偏空' : '中性'}</td>
      <td>${levels ? levels.entry.toFixed(2) : '—'}</td>
      <td>${levels ? levels.stop.toFixed(2) : '—'}</td>
      <td>${levels ? levels.take.toFixed(2) : '—'}</td>
    `;
    tbody.appendChild(tr);
  }
}

// 首次與每分鐘更新
render();
setInterval(render, 60_000);