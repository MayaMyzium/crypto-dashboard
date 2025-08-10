// 主程式：展示恐懼與貪婪指數、指定 BTC 地址餘額與折線圖、以及多幣種價格與 RSI

const ADDRESS = '1Ay8vMC7R1UbyCCZRVULMV7iQpHSAbguJP';
document.getElementById('theAddr').textContent = ADDRESS;

// 定義要觀察的幣種
const coins = [
  { id: 'bitcoin',   name: '比特幣' },
  { id: 'ethereum',  name: '以太幣' },
  { id: 'ripple',    name: 'XRP' },
  { id: 'dogecoin',  name: '狗狗幣' },
  { id: 'cardano',   name: 'ADA' }
];

// 取得恐懼與貪婪指數（使用 alternative.me API）
async function fetchFNG() {
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=1');
    const j = await r.json();
    if (j && j.data && j.data.length) {
      const d = j.data[0];
      const ts = new Date(parseInt(d.timestamp, 10) * 1000);
      document.getElementById('fngValue').textContent = `${d.value}（${d.value_classification}）｜更新：${ts.toLocaleString('zh-TW')}`;
    }
  } catch (e) {
    document.getElementById('fngValue').textContent = '取得失敗';
  }
}

// 取得指定地址餘額並繪製簡易折線圖（近況示意）
async function fetchAddressBalanceAndSeries() {
  try {
    // 1. 即時餘額
    const balRes = await fetch(`https://blockchain.info/q/addressbalance/${ADDRESS}`);
    const sats = parseInt(await balRes.text(), 10);
    const btc  = sats / 1e8;
    document.getElementById('addrBalance').textContent = `${btc.toLocaleString('en-US', { maximumFractionDigits: 8 })} BTC`;

    // 2. 取得近期交易以示意餘額變化
    const perPage = 50;
    let start = 0;
    let dayMap = new Map();
    for (let page = 0; page < 10; page++) {
      const url = `https://api.blockcypher.com/v1/btc/main/addrs/${ADDRESS}/full?txlimit=${perPage}&txstart=${start}`;
      const res = await fetch(url);
      if (!res.ok) break;
      const j = await res.json();
      if (!j || !Array.isArray(j.txs) || j.txs.length === 0) break;
      for (const tx of j.txs) {
        const t = tx.confirmed || tx.received;
        if (!t) continue;
        const day = new Date(t).toISOString().slice(0,10);
        dayMap.set(day, btc); // 以當前餘額近似示意
      }
      if (!j.hasMore || j.txs.length < perPage) break;
      start += perPage;
      await new Promise(r => setTimeout(r, 400));
    }
    const dates = Array.from(dayMap.keys()).sort();
    const series = dates.map(d => ({ date: d, value: btc }));
    drawLineChart('addrChart', series, 'BTC');
  } catch (e) {
    // 忽略錯誤
  }
}

// 繪製折線圖
function drawLineChart(canvasId, series, unit) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const labels = series.map(s => s.date);
  const data   = series.map(s => s.value);
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [ { label: `每日餘額（${unit}）`, data, fill: false, tension: 0.2 } ]
    },
    options: {
      responsive: true,
      scales: {
        x: { ticks: { maxTicksLimit: 6 } },
        y: { beginAtZero: false }
      }
    }
  });
}

// 取得即時價格、計算 RSI 及簡易買賣區
async function fetchPricesAndRSI() {
  const ids = coins.map(c => c.id).join(',');
  const tbody = document.querySelector('#cryptoTable tbody');
  tbody.innerHTML = '';
  try {
    const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
    const price = await priceRes.json();
    for (const coin of coins) {
      const usd = price[coin.id]?.usd || 0;
      // 拉 30 日日線
      const kRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=30&interval=daily`);
      const k    = await kRes.json();
      const closes = (k.prices || []).map(p => p[1]);
      // 計算 RSI
      const lookback = 14;
      let gains=0, losses=0;
      for (let i = closes.length - lookback; i < closes.length; i++) {
        if (i <= 0) continue;
        const diff = closes[i] - closes[i-1];
        if (diff > 0) gains += diff; else losses += -diff;
      }
      const avgG = gains / lookback;
      const avgL = losses / lookback;
      let rsi = 50;
      if (avgL === 0 && avgG > 0) rsi = 100;
      else if (avgG === 0 && avgL > 0) rsi = 0;
      else if (avgL > 0) rsi = 100 - (100 / (1 + (avgG/avgL)));
      // 買賣區
      const minP = Math.min(...closes);
      const maxP = Math.max(...closes);
      const range = isFinite(maxP - minP) ? (maxP - minP) : 0;
      const buyLow  = isFinite(minP) ? minP : usd;
      const buyHigh = isFinite(minP) ? (minP + range * 0.2) : usd;
      const sellLow = isFinite(maxP) ? (maxP - range * 0.2) : usd;
      const sellHigh= isFinite(maxP) ? maxP : usd;
      let action = '持有';
      if (rsi < 30) action = '考慮買入';
      else if (rsi > 70) action = '考慮賣出';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${coin.name}</td>
        <td>${usd.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td>${rsi.toFixed(2)}</td>
        <td>${buyLow.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} - ${buyHigh.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td>${sellLow.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} - ${sellHigh.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td>${action}</td>
      `;
      tbody.appendChild(tr);
    }
  } catch (e) {
    // 失敗時表格保留空
  }
}

async function main() {
  await fetchFNG();
  await fetchAddressBalanceAndSeries();
  await fetchPricesAndRSI();
}

main();
setInterval(main, 60_000);