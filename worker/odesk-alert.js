/* 온체인 데스크 폰 알림 워커 (Cloudflare Workers, 무료 플랜)
   - 1분마다(cron) 시세·펀딩비·김프·지갑을 확인해서 조건이 맞으면 텔레그램으로 보냄
   - 필요한 설정 (Cloudflare 대시보드 → 워커 → Settings)
     · Secret   TG_TOKEN : 텔레그램 봇 토큰 (BotFather에서 받음)
     · Variable CONFIG   : 사이트의 '폰 알림' 설정 JSON (README 참고)
     · KV 바인딩 STATE   : 아무 KV 네임스페이스 (같은 알림 반복 방지용)
     · Trigger  Cron     : * * * * *
   - 브라우저로 https://<워커주소>/test 를 열면 테스트 메시지를 보냄 */
const UA = typeof document === 'undefined' ? { 'user-agent': 'odesk-alert/1.0' } : {}; // 브라우저 미리보기에선 헤더 생략
async function j(u, n = 0) { const r = await fetch(u, { headers: UA });
  if (r.status === 429 && n < 2) { await new Promise(f => setTimeout(f, 1500 * (n + 1))); return j(u, n + 1); } /* 업비트 초당 제한: 잠깐 쉬고 다시 */ if (!r.ok) throw new Error(u.split('?')[0] + ' HTTP ' + r.status); return r.json(); }
const fmt = n => { const a = Math.abs(n); return a >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : a >= 1 ? n.toFixed(2) : n.toPrecision(4); };

async function tg(env, cfg, text) {
  if (!env.TG_TOKEN || !cfg.chat) throw new Error('TG_TOKEN 또는 chat id 없음');
  const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: cfg.chat, text, disable_web_page_preview: true })
  });
  if (!r.ok) throw new Error('telegram HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
/* 같은 키는 coolMin 분 안에 한 번만 */
async function once(env, key, coolMin) {
  if (!env.STATE) return true;
  const v = await env.STATE.get('c:' + key);
  if (v && Date.now() - +v < coolMin * 60e3) return false;
  await env.STATE.put('c:' + key, String(Date.now()), { expirationTtl: Math.max(60, coolMin * 120) });
  return true;
}

async function checkPrice(env, cfg, out) {
  const coins = cfg.coins || []; if (!coins.length || !(cfg.move > 0 || cfg.fund > 0)) return;
  const t = await j('https://api.bybit.com/v5/market/tickers?category=linear');
  const by = new Map(t.result.list.map(x => [x.symbol, x]));
  for (const b of coins) {
    let x = null, m = 1;
    for (const [p, k] of [['', 1], ['1000', 1e3], ['10000', 1e4]]) { x = by.get(p + b + 'USDT'); if (x) { m = k; break; } }
    if (!x) continue;
    const c = +x.price24hPcnt * 100, f = +x.fundingRate * 100, p = +x.lastPrice / m;
    if (cfg.move > 0 && Math.abs(c) >= cfg.move && await once(env, 'mv:' + b + ':' + Math.sign(c) + ':' + Math.floor(Math.abs(c) / cfg.move), cfg.cool || 60))
      out.push(`📈 ${b} 24시간 ${c >= 0 ? '+' : ''}${c.toFixed(1)}% · $${fmt(p)}`);
    if (cfg.fund > 0 && Math.abs(f) >= cfg.fund && await once(env, 'fd:' + b + ':' + Math.sign(f), cfg.cool || 60))
      out.push(`💸 ${b} 펀딩비 ${f >= 0 ? '+' : ''}${f.toFixed(4)}% (Bybit)`);
  }
}

async function checkKimp(env, cfg, out) {
  if (!(cfg.kimp > 0)) return;
  const coins = cfg.kimpCoins?.length ? cfg.kimpCoins : cfg.coins || []; if (!coins.length) return;
  const want = new Set(coins);
  const [all, fx, t] = await Promise.all([
    j('https://api.upbit.com/v1/ticker/all?quote_currencies=KRW'), // 원화마켓 전체를 한 번에 (요청 1번)
    j('https://open.er-api.com/v6/latest/USD').then(d => d.rates.KRW),
    j('https://api.bybit.com/v5/market/tickers?category=spot')
  ]);
  const up = all.filter(u => want.has(u.market.slice(4)));
  const by = new Map(t.result.list.map(x => [x.symbol, +x.lastPrice]));
  for (const u of up) {
    const b = u.market.slice(4), g = by.get(b + 'USDT'); if (!g) continue;
    const k = (u.trade_price / (g * fx) - 1) * 100;
    if (Math.abs(k) >= cfg.kimp && await once(env, 'kp:' + b + ':' + Math.sign(k), cfg.cool || 60))
      out.push(`🇰🇷 ${b} 김프 ${k >= 0 ? '+' : ''}${k.toFixed(2)}% · 업비트 ${u.trade_price.toLocaleString()}원`);
  }
}

async function checkWallets(env, cfg, out, errs) {
  for (const w of cfg.wallets || []) {
    try {
      const d = await j(`https://${w.chain}.blockscout.com/api/v2/addresses/${w.addr}/token-transfers`);
      const items = (d.items || []).filter(x => !x.token?.is_scam); if (!items.length) continue;
      const key = 'w:' + w.chain + ':' + w.addr.toLowerCase();
      const last = (env.STATE ? +(await env.STATE.get(key) || 0) : 0) || env.SINCE || 0;
      const newest = Date.parse(items[0].timestamp);
      if (env.STATE) await env.STATE.put(key, String(Math.max(last, newest)));
      if (!last) continue; // 처음 한 번은 기준점만 저장
      const me = w.addr.toLowerCase();
      for (const x of items.filter(x => Date.parse(x.timestamp) > last).reverse()) {
        const outg = x.from.hash.toLowerCase() === me, o = outg ? x.to : x.from;
        const q = +(x.total?.value || 0) / 10 ** +(x.total?.decimals || 18);
        const p = x.token?.exchange_rate ? +x.token.exchange_rate : null;
        const tags = o?.metadata?.tags || [];
        const cex = tags.some(t => /^(exchange|cex|hot-wallet)$/.test(t.slug));
        const nm = tags.find(t => t.tagType === 'name')?.name || o?.name || o.hash.slice(0, 8);
        if (outg || (cfg.walletIn && p)) // 받은 것은 가격 있는 토큰만 (스팸 에어드랍 제외)
          out.push(`${outg ? (cex ? '🚨 거래소 입금' : '↗ 보냄') : '↙ 받음'} ${w.label || w.addr.slice(0, 8)}: ${fmt(q)} ${x.token?.symbol || ''}${p ? ` ($${fmt(q * p)})` : ''} ${outg ? '→' : '←'} ${nm}`);
      }
    } catch (e) { errs.push((w.label || w.addr) + ': ' + e.message); }
  }
}

async function run(env) {
  const cfg = typeof env.CONFIG === 'object' ? env.CONFIG : JSON.parse(env.CONFIG || '{}'); const out = [], errs = [];
  for (const f of [checkPrice, checkKimp, checkWallets]) { try { await f(env, cfg, out, errs); } catch (e) { errs.push(e.message); } }
  if (out.length && !env.DRY) await tg(env, cfg, out.join('\n'));
  return { count: out.length, sent: out.length > 0 && !env.DRY, out, errs };
}

const txt = (s, status = 200) => new Response(s, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
export default {
  run, // 사이트의 '폰 알림' 페이지가 미리보기에 씀
  async scheduled(ev, env, ctx) { ctx.waitUntil(run(env)); },
  async fetch(req, env) {
    const u = new URL(req.url); const cfg = JSON.parse(env.CONFIG || '{}');
    try {
      if (u.pathname === '/test') { await tg(env, cfg, '✅ 온체인 데스크 알림 연결됐어요.'); return txt('텔레그램으로 테스트 메시지를 보냈어요.'); }
      if (u.pathname === '/run') return new Response(JSON.stringify(await run(env), null, 1), { headers: { 'content-type': 'application/json; charset=utf-8' } });
      return txt('온체인 데스크 알림 워커. /test = 테스트 메시지, /run = 지금 한 번 확인');
    } catch (e) { return txt('오류: ' + e.message, 500); }
  }
};
