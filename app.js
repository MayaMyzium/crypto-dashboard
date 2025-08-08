const coins = [
  { id: 'bitcoin', name: '比特幣' },
  { id: 'ethereum', name: '以太幣' },
  { id: 'ripple', name: 'XRP' },
  { id: 'dogecoin', name: '狗狗幣' },
  { id: 'cardano', name: 'ADA' }
];

async function fetchData() {
  try {
    // Fetch fear & greed index
    const fngRes = await fetch('https://api.alternative.me/fng/?limit=1');
    const fngJson = await fngRes.json();
    if (fngJson && fngJson.data && fngJson.data.length > 0) {
      const fngData = fngJson.data[0];
      const value = fngData.value;
      const classification = fngData.value_classification;
      const updateTime = new Date(parseInt(fngData.timestamp) * 1000);
      document.getElementById('fngValue').textContent = `${value} (${classification}) 更新時間：${updateTime.toLocaleString('zh-TW')}`;
    } else {
      document.getElementById('fngValue').textContent = '無法取得資料';
    }

    // Set BTC reserves placeholder because reliable public API is not available
    document.getElementById('btcReserve').textContent = '暫無即時數據 (無適用免費 API)';

    // Fetch latest prices
    const ids = coins.map(c => c.id).join(',');
    const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
    const priceData = await priceRes.json();

    const tbody = document.querySelector('#cryptoTable tbody');
    tbody.innerHTML = '';

    // Loop through each coin to fetch historical data and compute RSI
    for (const coin of coins) {
      const priceUsd = priceData[coin.id] && priceData[coin.id].usd ? priceData[coin.id].usd : 0;

      // Fetch 30-day daily prices to compute RSI and ranges
      const chartRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=30&interval=daily`);
      const chartJson = await chartRes.json();
      const pricePoints = chartJson.prices || [];
      const prices = pricePoints.map(point => point[1]);

      // Compute RSI using last 14 differences
      let gains = 0;
      let losses = 0;
      const lookback = 14;
      if (prices.length > lookback) {
        for (let i = prices.length - lookback; i < prices.length; i++) {
          const change = prices[i] - prices[i - 1];
          if (change > 0) gains += change;
          else losses += Math.abs(change);
        }
      }
      const avgGain = gains / lookback;
      const avgLoss = losses / lookback;
      let rsi = 50;
      if (avgLoss === 0 && avgGain !== 0) {
        rsi = 100;
      } else if (avgGain === 0) {
        rsi = 0;
      } else if (avgLoss !== 0) {
        const rs = avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));
      }

      // Compute buy/sell ranges based on 30-day min and max
      let minPrice = Math.min(...prices);
      let maxPrice = Math.max(...prices);
      if (!isFinite(minPrice) || !isFinite(maxPrice) || prices.length === 0) {
        minPrice = priceUsd;
        maxPrice = priceUsd;
      }
      const range = maxPrice - minPrice;
      const buyLow = minPrice;
      const buyHigh = minPrice + range * 0.2;
      const sellLow = maxPrice - range * 0.2;
      const sellHigh = maxPrice;

      // Determine recommendation based on RSI
      let action = '持有';
      if (rsi < 30) {
        action = '考慮買入';
      } else if (rsi > 70) {
        action = '考慮賣出';
      }

      // Create table row
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${coin.name}</td>
        <td>${priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>${rsi.toFixed(2)}</td>
        <td>${buyLow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - ${buyHigh.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>${sellLow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - ${sellHigh.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>${action}</td>
      `;
      tbody.appendChild(tr);
    }

  } catch (error) {
    console.error('資料取得錯誤：', error);
  }
}

// Initial fetch and periodic updates
fetchData();
// Update every minute (60000 ms)
setInterval(fetchData, 60000);
