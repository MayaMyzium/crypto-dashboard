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
    // 建立圖表容器
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '2rem';
    const title = document.createElement('h3');
    title.textContent = `${coin.name} (${coin.symbol}/${coin.ccy})`;
    const canvas = document.createElement('canvas');
    canvas.id = `chart-${coin.ccy}`;
    canvas.height = 250;
    wrapper.appendChild(title);
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);
    // 取得資料並繪製
    updateAnalysis(coin).catch((err) => {
      console.error('分析資料取得失敗', coin, err);
      const ctx = canvas.getContext('2d');
      ctx.font = '14px Arial';
      ctx.fillText('無法取得資料', 10, 30);
    });
  });
});

async function updateAnalysis(coin) {
  // 同時取得幣安與 OKX 資料
  const [binance, okx] = await Promise.all([
    fetchBinanceRatio(coin.symbol),
    fetchOKXRatio(coin.ccy)
  ]);
  drawAnalysisChart(coin.ccy, coin.name, binance, okx);
}

/**
 * 從幣安取得全局多空帳戶比資料
 * API 文件參考【923837169191340†L93-L146】
 * @param {string} symbol 幣安合約符號，如 BTCUSDT
 */
async function fetchBinanceRatio(symbol) {
  try {
    const url = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=50`;
    const res = await fetch(url);
    const data = await res.json();
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
    // 部分環境可能無法取得或需要 API KEY，若失敗則返回空
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

let analysisCharts = {};
function drawAnalysisChart(ccy, name, binanceData, okxData) {
  const ctx = document.getElementById(`chart-${ccy}`).getContext('2d');
  const labels = binanceData.map((d) => d.time);
  const bData = binanceData.map((d) => d.ratio);
  // OKX 可能日期數量與 Binance 不同；使用 binance labels 對齊
  const okxMap = {};
  okxData.forEach((d) => {
    okxMap[d.time] = d.ratio;
  });
  const oData = labels.map((t) => (okxMap[t] !== undefined ? okxMap[t] : null));
  if (analysisCharts[ccy]) {
    // 更新
    analysisCharts[ccy].data.labels = labels;
    analysisCharts[ccy].data.datasets[0].data = bData;
    analysisCharts[ccy].data.datasets[1].data = oData;
    analysisCharts[ccy].update();
    return;
  }
  analysisCharts[ccy] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `${name} 多空比 (Binance)`,
          data: bData,
          borderColor: '#2980b9',
          backgroundColor: 'rgba(41, 128, 185, 0.2)',
          tension: 0.1,
          fill: false,
          pointRadius: 0
        },
        {
          label: `${name} 多空比 (OKX)`,
          data: oData,
          borderColor: '#e67e22',
          backgroundColor: 'rgba(230, 126, 34, 0.2)',
          tension: 0.1,
          fill: false,
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
            maxTicksLimit: 6,
            maxRotation: 0,
            minRotation: 0
          }
        },
        y: {
          title: {
            display: true,
            text: '多／空比'
          }
        }
      },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`
          }
        }
      }
    }
  });
}