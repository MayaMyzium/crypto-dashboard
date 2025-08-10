// Cloudflare Worker：Binance / OKX 輕量代理
// 允許特定端點並處理 CORS，支援 GET/OPTIONS，快取 30 秒

const ALLOW = {
  binance: 'https://fapi.binance.com',
  okx: 'https://www.okx.com'
};

const BINANCE_PATHS = [
  /^\/fapi\/v1\/openInterest$/,
  /^\/futures\/data\/topLongShortAccountRatio$/,
  /^\/futures\/data\/openInterestHist$/
];

const OKX_PATHS = [
  /^\/api\/v5\/public\/open-interest$/
];

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    const url = new URL(request.url);
    const target = url.searchParams.get('target');
    const path   = url.searchParams.get('path') || '/';
    const qs     = url.searchParams.get('qs') || '';
    if (!target || !(target in ALLOW)) {
      return json({ error: 'target not allowed' }, 400);
    }
    // 路徑白名單檢查
    if (target === 'binance' && !BINANCE_PATHS.some(rx => rx.test(path))) {
      return json({ error: 'binance path not allowed' }, 400);
    }
    if (target === 'okx' && !OKX_PATHS.some(rx => rx.test(path))) {
      return json({ error: 'okx path not allowed' }, 400);
    }
    const upstream = `${ALLOW[target]}${path}${qs ? `?${qs}` : ''}`;
    try {
      const resp = await fetch(upstream, {
        headers: { accept: 'application/json' },
        cf: { cacheTtl: 30, cacheEverything: true }
      });
      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: {
          ...corsHeaders(),
          'content-type': resp.headers.get('content-type') || 'application/json'
        }
      });
    } catch (e) {
      return json({ error: e.message }, 502);
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), 'content-type': 'application/json' }
  });
}