/*
 * script.js
 *
 * 這個腳本負責讀取比特幣地址交易資料、計算每日餘額以及從 CoinGecko 抓取行情並計算 RSI。
 * 由於瀏覽器限制，請確保在 Github Pages 部署後網站啟用 HTTPS，否則某些 API 會因混用 HTTP 而無法存取。
 */

document.addEventListener('DOMContentLoaded', () => {
  // 啟動兩個主要資料取得功能
  fetchBtcAddressData();
  fetchMarketData();
});

/**
 * 取得比特幣地址的交易資訊並繪製餘額折線圖
 */
async function fetchBtcAddressData() {
  const address = '1Ay8vMC7R1UbyCCZRVULMV7iQpHSAbguJP';
  const url = `https://blockchain.info/rawaddr/${address}?cors=true`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('無法取得交易資料');
    }
    const data = await response.json();
    const txs = data.txs || [];

    // 依時間排序（早到晚）
    txs.sort((a, b) => a.time - b.time);

    // 計算每日餘額變化
    const dailyBalances = {};
    let runningBalance = 0;
    for (const tx of txs) {
      // tx.result 為該地址在此交易中的淨變化，單位 satoshi【993493370501237†L118-L137】
      runningBalance += tx.result;
      const date = new Date(tx.time * 1000);
      const dayStr = date.toISOString().slice(0, 10);
      dailyBalances[dayStr] = runningBalance;
    }
    const labels = Object.keys(dailyBalances).sort();
    const balances = labels.map((d) => dailyBalances[d] / 1e8); // 轉為 BTC

    // 使用 Chart.js 繪圖
    const ctx = document.getElementById('btcBalanceChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'BTC 餘額',
            data: balances,
            borderWidth: 2,
            fill: false,
            tension: 0.1,
          },
        ],
      },
      options: {
        scales: {
          x: {
            title: { display: true, text: '日期' },
            ticks: { maxTicksLimit: 7 },
          },
          y: {
            title: { display: true, text: 'BTC 數量' },
          },
        },
        plugins: {
          legend: { display: true },
        },
      },
    });
  } catch (err) {
    console.error(err);
    alert('取得比特幣餘額資料時發生錯誤：' + err.message);
  }
}

/**
 * 取得各幣種的市場資料並計算 RSI，最後動態更新表格。
 */
async function fetchMarketData() {
  const coins = [
    { id: 'bitcoin', symbol: 'BTC' },
    { id: 'ethereum', symbol: 'ETH' },
    { id: 'ripple', symbol: 'XRP' },
    { id: 'dogecoin', symbol: 'DOGE' },
    { id: 'cardano', symbol: 'ADA' },
  ];
  const tbody = document.querySelector('#marketTable tbody');
  tbody.innerHTML = '';
  for (const coin of coins) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=90`
      );
      if (!res.ok) {
        throw new Error('無法取得價格資料');
      }
      const data = await res.json();
      const prices = data.prices.map((p) => p[1]);
      const lastPrice = prices[prices.length - 1];
      const rsi = calculateRSI(prices, 14);
      let zone = '等待';
      if (rsi < 30) zone = '可買';
      if (rsi > 70) zone = '可賣';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${coin.symbol}</td>
        <td>${lastPrice.toFixed(2)}</td>
        <td>${rsi.toFixed(2)}</td>
        <td>${zone}</td>`;
      tbody.appendChild(row);
    } catch (err) {
      console.error(err);
      const row = document.createElement('tr');
      row.innerHTML = `<td>${coin.symbol}</td><td colspan="3">資料取得失敗</td>`;
      tbody.appendChild(row);
    }
  }
}

/**
 * 計算 RSI 指標。
 * @param {number[]} prices - 價格陣列
 * @param {number} period - RSI 週期，一般取 14
 * @returns {number} RSI 數值
 */
function calculateRSI(prices, period) {
  if (!prices || prices.length <= period) return 50;
  const gains = [];
  const losses = [];
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      gains.push(diff);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(-diff);
    }
  }
  // 前 period 次的平均
  let avgGain = average(gains.slice(0, period));
  let avgLoss = average(losses.slice(0, period));
  let rsi = 50;
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);
  }
  return rsi;
}

function average(arr) {
  if (!arr || arr.length === 0) return 0;
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum / arr.length;
}