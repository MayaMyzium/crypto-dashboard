/*
 * analysis.js
 *
 * 此腳本負責從 Binance API 取得 top 長短比資料，以及透過 Amberdata
 * 取得 OKX 的永續合約長短比。為了使用 Amberdata，請註冊 API 金鑰並填入
 * AMBER_API_KEY 常數。資料取得後會把最近兩筆數據計算差值並呈現在表格中。
 *
 */

document.addEventListener('DOMContentLoaded', () => {
  fetchLongShortData();
  renderAlgoCode();
});

/**
 * 從 Binance 和 Amberdata/OKX 取得各幣種多空比資料
 * 並動態填充到表格
 */
async function fetchLongShortData() {
  const tbody = document.querySelector('#ratioTable tbody');
  // 設定幣種代碼對應
  const coins = [
    { symbol: 'BTC', binance: 'BTCUSDT', okx: 'BTC-USD-SWAP' },
    { symbol: 'ETH', binance: 'ETHUSDT', okx: 'ETH-USD-SWAP' },
    { symbol: 'XRP', binance: 'XRPUSDT', okx: 'XRP-USD-SWAP' },
    { symbol: 'DOGE', binance: 'DOGEUSDT', okx: 'DOGE-USD-SWAP' },
    { symbol: 'ADA', binance: 'ADAUSDT', okx: 'ADA-USD-SWAP' },
  ];
  const AMBER_API_KEY = 'YOUR_AMBERDATA_API_KEY';
  for (const coin of coins) {
    // 處理 Binance
    try {
      const binanceResp = await fetch(
        `https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${coin.binance}&period=1m&limit=2`
      );
      const binanceData = await binanceResp.json();
      if (Array.isArray(binanceData) && binanceData.length >= 2) {
        const last = binanceData[0];
        const prev = binanceData[1];
        const ratio = parseFloat(last.longShortRatio);
        const prevRatio = parseFloat(prev.longShortRatio);
        const change = ratio - prevRatio;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${coin.symbol}</td>
          <td>Binance</td>
          <td>${ratio.toFixed(2)}</td>
          <td>${change >= 0 ? '+' : ''}${change.toFixed(2)}</td>`;
        tbody.appendChild(tr);
      }
    } catch (err) {
      console.error('Binance 資料取得錯誤', err);
    }
    // 處理 OKX - 使用 Amberdata 代理
    try {
      const url = `https://api.amberdata.com/markets/futures/long-short-ratio?exchange=OKX&period=1m&instrument=${coin.okx}&size=2`;
      const okxResp = await fetch(url, {
        headers: {
          'x-api-key': AMBER_API_KEY,
        },
      });
      const okxData = await okxResp.json();
      // 根據返回格式選取數據
      let records = [];
      if (Array.isArray(okxData)) {
        records = okxData;
      } else if (okxData && (okxData.records || okxData.data)) {
        records = okxData.records || okxData.data;
      }
      if (Array.isArray(records) && records.length >= 2) {
        const last = records[records.length - 1];
        const prev = records[records.length - 2];
        const ratio = parseFloat(last.ratio);
        const prevRatio = parseFloat(prev.ratio);
        const change = ratio - prevRatio;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${coin.symbol}</td>
          <td>OKX</td>
          <td>${ratio.toFixed(2)}</td>
          <td>${change >= 0 ? '+' : ''}${change.toFixed(2)}</td>`;
        tbody.appendChild(tr);
      }
    } catch (err) {
      console.error('OKX 資料取得錯誤', err);
    }
  }
}

/**
 * 將改良後的多空比分析算法原文顯示在頁面上。
 * 這段程式碼取自上一輪的 Python 模型，供使用者參考。
 */
function renderAlgoCode() {
  const pre = document.getElementById('algo-code');
  pre.textContent = `
# 算法概述：
# 1. 對多空比 (LSR) 做 winsorize 去掉極端值，然後計算滾動 Z 分數；
# 2. 計算 LSR 變化率的 Z 分數及價格動能 momen；
# 3. 根據成交量的 Z 分數作權重放大；
# 4. 綜合以上計算 signal = alpha*z_lsr + beta*z_dlsr + gamma*momen，再乘以 (1 + eta*vol_z)；
# 5. 只在信號方向與趨勢一致時使用，並透過歷史分位數作為進出場門檻；
# 6. 以 ATR 自適應設置進場點位、止損和追蹤停利。

import numpy as np
import pandas as pd

def compute_signals(price, high, low, lsr, volume,
                    n=48, m=1000, alpha=0.55, beta=0.35, gamma=0.10, eta=0.25,
                    q_lo=0.20, q_hi=0.80,
                    c=0.3, k_sl=1.5, k_tp=2.0,
                    risk_pct=0.0075, point_value=1.0,
                    ema_fast=21, ema_slow=55):
    # (以下為節選過的原程式)
    lsr_w = winsorize(lsr)
    z_lsr = rolling_z(lsr_w, n)
    z_dlsr = rolling_z(np.diff(lsr_w), n)
    momen = rolling_z(np.diff(np.log(price)), n)
    z_vol = rolling_z(volume, n).clip(lower=0.0)
    trend = np.sign(ema(price, ema_fast) - ema(price, ema_slow))
    S = alpha*z_lsr + beta*z_dlsr + gamma*momen
    S_star = S * (1 + eta*z_vol) * ((S * trend) > 0)
    # 更多細節請參考完整程式
  `;
}