document.addEventListener('DOMContentLoaded', () => {
  updateFearGreed();
  updateBTC();
  updateCryptos();
  setInterval(updateFearGreed, 60 * 60 * 1000);
  setInterval(updateBTC, 60 * 60 * 1000);
  setInterval(updateCryptos, 15 * 60 * 1000);
});

async function updateFearGreed() {
  const valueEl = document.getElementById('fng-value');
  const classEl = document.getElementById('fng-class');
  const updateEl = document.getElementById('fng-update');
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1&format=json');
    const json = await res.json();
    if (json && json.data && json.data.length > 0) {
      const fng = json.data[0];
      valueEl.textContent = fng.value;
      classEl.textContent = fng.value_classification;
      if (fng.time_until_update) {
        const secs = parseInt(fng.time_until_update, 10);
        const hours = Math.floor(secs / 3600);
        const minutes = Math.floor((secs % 3600) / 60);
        const seconds = secs % 60;
        updateEl.textContent = `距離下次更新：${hours} 小時 ${minutes} 分 ${seconds} 秒`;
      } else {
        updateEl.textContent = '';
      }
    } else {
      valueEl.textContent = '--';
      classEl.textContent = '無法取得資料';
    }
  } catch (e) {
    console.error('取得恐懼貪婪指數失敗', e);
    valueEl.textContent = '--';
    classEl.textContent = '載入失敗';
    updateEl.textContent = '';
  }
}

async function updateBTC() {
  const address = document.getElementById('btc-address').textContent;
  const balanceEl = document.getElementById('btc-balance');
  try {
    const url = `https://blockchain.info/rawaddr/${address}?limit=1000&cors=true`;
    const res = await fetch(url);
    const data = await res.json();
    const finalBalanceBTC = data.final_balance / 1e8;
    balanceEl.textContent = finalBalanceBTC.toFixed(8);
    const txs = data.txs || [];
    const chartData = computeBTCBalances(txs, finalBalanceBTC);
    drawBTCChart(chartData.labels, chartData.data);
  } catch (e) {
    console.error('取得比特幣地址資料失敗', e);
    balanceEl.textContent = '--';
  }
}

function computeBTCBalances(txs, finalBalance) {
  const targetDays = 90;
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const netMap = {};
  for (const tx of txs) {
    const tsDate = new Date(tx.time * 1000);
    const dayStr = formatDate(tsDate);
    let net = 0;
    if (Array.isArray(tx.out)) {
      for (const o of tx.out) {
        if (o.addr === document.getElementById('btc-address').textContent) {
          net += o.value;
        }
      }
    }
    if (Array.isArray(tx.inputs)) {
      for (const i of tx.inputs) {
        if (i.prev_out && i.prev_out.addr === document.getElementById('btc-address').textContent) {
          net -= i.prev_out.value;
        }
      }
    }
    if (!netMap[dayStr]) netMap[dayStr] = 0;
    netMap[dayStr] += net;
  }
  const labels = [];
  const data = [];
  let currentBalance = finalBalance;
  for (let i = 0; i < targetDays; i++) {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - i);
    const dayStr = formatDate(date);
    labels.unshift(dayStr);
    data.unshift(parseFloat(currentBalance.toFixed(8)));
    if (netMap[dayStr]) {
      currentBalance -= netMap[dayStr] / 1e8;
    }
  }
  return { labels, data };
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

let btcChart;
function drawBTCChart(labels, data) {
  const ctx = document.getElementById('btcChart').getContext('2d');
  if (btcChart) {
    btcChart.data.labels = labels;
    btcChart.data.datasets[0].data = data;
    btcChart.update();
    return;
  }
  btcChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'BTC 餘額',
          data: data,
          borderColor: '#3498db',
          backgroundColor: 'rgba(52,152,219,0.2)',
          tension: 0.1,
          fill: true,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 5,
            maxRotation: 0,
            minRotation: 0
          }
        },
        y: {
          beginAtZero: true
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.y} BTC`
          }
        }
      }
    }
  });
}

async function updateCryptos() {
  const coins = [
    { id: 'bitcoin', symbol: 'BTC', name: '比特幣' },
    { id: 'ethereum', symbol: 'ETH', name: '以太幣' },
    { id: 'ripple', symbol: 'XRP', name: 'XRP' },
    { id: 'dogecoin', symbol: 'DOGE', name: '狗狗幣' },
    { id: 'cardano', symbol: 'ADA', name: 'ADA' },
    { id: 'solana', symbol: 'SOL', name: '索拉納' }
  ];
  const tbody = document.getElementById('crypto-tbody');
  tbody.innerHTML = '';
  for (const coin of coins) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${coin.name} (${coin.symbol})</td>
      <td id="price-${coin.id}">載入中…</td>
      <td id="rsi-${coin.id}">--</td>
      <td id="rec-${coin.id}"></td>
    `;
    tbody.appendChild(tr);
    updateCoinInfo(coin).catch((err) => {
      console.error('取得幣種資料失敗', coin.id, err);
      document.getElementById(`price-${coin.id}`).textContent = '無法取得資料';
    });
  }
}

async function updateCoinInfo(coin) {
  const url = `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=90&interval=daily`;
  const res = await fetch(url);
  const data = await res.json();
  const prices = data.prices || [];
  if (prices.length === 0) throw new Error('無價格資料');
  const lastPrice = prices[prices.length - 1][1];
  document.getElementById(`price-${coin.id}`).textContent = `價格: $${lastPrice.toFixed(2)}`;
  const closes = prices.map((p) => p[1]);
  const rsiVal = calculateRSI(closes.slice(-15));
  document.getElementById(`rsi-${coin.id}`).textContent = `RSI: ${rsiVal.toFixed(2)}`;
  let rec = '';
  if (rsiVal < 30) rec = '偏買區';
  else if (rsiVal > 70) rec = '偏賣區';
  else rec = '中立區';
  document.getElementById(`rec-${coin.id}`).textContent = rec;
}

function calculateRSI(closes) {
  if (closes.length < 2) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const period = closes.length - 1;
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return rsi;
}