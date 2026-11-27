/* 온체인 데스크 폰 알림 워커 (Cloudflare Workers, 무료 플랜)
   - 1분마다(cron) 시세·펀딩비·김프·지갑·급등 준비 신호를 확인해서 조건이 맞으면 텔레그램으로 보냄
   - 필요한 설정 (Cloudflare 대시보드 → 워커 → Settings)
     · Secret   TG_TOKEN : 텔레그램 봇 토큰 (BotFather에서 받음)
     · Variable CONFIG   : 사이트의 '폰 알림' 설정 JSON (README 참고)
     · KV 바인딩 STATE   : 아무 KV 네임스페이스 (같은 알림 반복 방지·알림선·일지 요약 저장)
     · Secret   SITE_KEY : 아무 긴 문자열. 사이트가 알림선·일지 요약을 올릴 때 쓰는 비밀번호
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


/* ---- 급등 준비 신호 + 무효화 (사이트와 같은 조건·같은 기준) ----
   무료 플랜 요청 수 제한(50) 때문에 1분에 6개 코인씩 돌아가며 점검. 상위 30개면 5분에 한 바퀴. */
const LEV = [[10, .25], [20, .25], [25, .2], [50, .2], [100, .1]], MMR = .005;
function clusters(st, cs, price) { let up = 0, dn = 0;
  for (let i = 1; i < st.length; i++) { const a = st[i], d = (a.open_interest_usd || 0) - (st[i - 1].open_interest_usd || 0); if (d <= 0) continue; const p = +a.mark_price; if (!p) continue;
    const r = a.lsr_account || 1, ls = r / (1 + r); let mn = Infinity, mx = -Infinity; for (const c of cs) if (c.t >= a.time) { mn = Math.min(mn, +c.l); mx = Math.max(mx, +c.h); }
    for (const [lev, w] of LEV) { const lp = p * (1 - 1 / lev + MMR), sp = p * (1 + 1 / lev - MMR);
      if (!(mn <= lp) && lp >= price * .92 && lp < price) dn += d * ls * w;
      if (!(mx >= sp) && sp <= price * 1.08 && sp > price) up += d * (1 - ls) * w; } }
  return { up, dn }; }
function sigCond(d, P) { const C = [
  d.doi != null && d.c24 != null ? (Math.abs(d.c24) <= P.c24 && d.doi >= P.oi) : null,
  d.fr != null ? d.fr < P.fr : null,
  d.cvd != null ? (P.cvd === '24' ? d.cvd > 0 : d.cvd > 0 && d.cvd4 > 0) : null,
  d.up != null ? (d.up > 0 && d.up >= d.dn * P.ratio) : null,
  d.pos != null ? d.pos <= P.pos / 100 : null].map((v, i) => P.on[i] ? v : null);
  return { C, hits: C.filter(x => x === true).length }; }
/* 사이트와 같은 데이터: 바이낸스 선물 1시간 봉(시장가 매수 금액) + Bybit 미결제약정·롱숏 계정 비율. 바이낸스가 막히거나 없으면 Gate.io */
const symScale = s => { const m = String(s).match(/^(1000000|10000|1000)(?=[A-Z])|(1000000|10000|1000)USDT$/); return m ? +(m[1] || m[2]) : 1; };
const symBase = s => String(s).replace(/USDT$/, '').replace(/^(1000000|10000|1000)|(1000000|10000|1000)$/g, '');
const binSym = s => { const k = symScale(s); return k > 1 ? k + symBase(s) + 'USDT' : String(s); };
let GM = null, SRCS = {};
async function flow(sym, sc, b, oiList) { const H = 3600e3;
  try { const K = await j(`https://fapi.binance.com/fapi/v1/klines?symbol=${binSym(sym)}&interval=1h&limit=48`); if (!Array.isArray(K) || K.length < 5) throw new Error('바이낸스 없음');
    const lr = await j(`https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${sym}&period=1h&limit=50`).then(d => new Map((d.result?.list || []).map(x => [+x.timestamp, +x.sellRatio ? +x.buyRatio / +x.sellRatio : 1]))).catch(() => new Map());
    const OI = new Map(oiList.map(x => [+x.timestamp, +x.openInterest])); let po = null, pl = 1; const st = [], cs = [];
    for (const k of K) { const t = k[0], c = +k[4], mp = c / sc, qv = +k[7], tbq = +k[10]; const oi = OI.get(t + H) ?? OI.get(t) ?? po; if (oi != null) po = oi; const r = lr.get(t + H) ?? lr.get(t) ?? pl; pl = r;
      st.push({ time: t / 1000, open_interest_usd: po != null ? po * c : 0, lsr_account: r, mark_price: mp, long_taker_size: mp ? tbq / mp : 0, short_taker_size: mp ? (qv - tbq) / mp : 0 }); cs.push({ t: t / 1000, h: +k[2] / sc, l: +k[3] / sc }); }
    SRCS.binance = (SRCS.binance || 0) + 1; return { st, cs, mult: 1, src: 'binance' };
  } catch (e) {
    if (!GM) { GM = {}; try { for (const x of await j('https://api.gateio.ws/api/v4/futures/usdt/contracts')) GM[x.name] = +x.quanto_multiplier || 1; } catch (e2) {} }
    const g = b + '_USDT'; if (!GM[g]) throw new Error('바이낸스·Gate 모두 없음');
    const [st, cs] = await Promise.all([j(`https://api.gateio.ws/api/v4/futures/usdt/contract_stats?contract=${g}&interval=1h&limit=48`), j(`https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=${g}&interval=1h&limit=48`)]);
    SRCS.gate = (SRCS.gate || 0) + 1; SRCS.why = e.message; return { st, cs, mult: GM[g], src: 'gate' }; } }
async function checkSignals(env, cfg, out, errs) {
  const S = cfg.sig; if (!S || !S.n) return;
  const P = { on: [1, 1, 1, 1, 1], c24: 3, oi: 8, fr: 0, cvd: 'both', ratio: 1.3, pos: 40, ...(S.P || {}) }, K = S.k || 3, hold = S.hold || 72;
  const t = await j('https://api.bybit.com/v5/market/tickers?category=linear');
  const top = t.result.list.filter(x => x.symbol.endsWith('USDT')).sort((a, b) => b.turnover24h - a.turnover24h).slice(0, Math.min(30, S.n));
  const per = 6, slices = Math.ceil(top.length / per), sl = env.SLICE != null ? env.SLICE : Math.floor(Date.now() / 60e3) % slices;
  const part = env.SLICE === 'all' ? top : top.slice(sl * per, sl * per + per);
  const NM = ['포지션 누적', '펀딩 음수', '체결 매수 우위', '숏 클러스터', '바닥권'];
  await Promise.all(part.map(async x => { try {
    const b = symBase(x.symbol), sc = symScale(x.symbol), p = +x.lastPrice;
    const d = { c24: +x.price24hPcnt * 100, fr: +x.fundingRate * 100 };
    const oiL = await j(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${x.symbol}&intervalTime=1h&limit=50`).then(r => r.result?.list || []).catch(() => []);
    if (oiL.length >= 25) d.doi = (+oiL[0].openInterest / +oiL[24].openInterest - 1) * 100;
    const f = await flow(x.symbol, sc, b, oiL).catch(() => null);
    if (f && f.st.length > 4) { const s = f.st; let c = 0, c4 = 0; s.slice(-24).forEach((a, i, arr) => { const v = ((a.long_taker_size || 0) - (a.short_taker_size || 0)) * f.mult * (+a.mark_price || 0); c += v; if (i >= arr.length - 4) c4 += v; }); d.cvd = c; d.cvd4 = c4;
      if (f.cs.length) { const pg = p / sc, cs = f.cs.slice(-48), k = clusters(s.slice(-48), cs, pg); d.up = k.up; d.dn = k.dn; const H = Math.max(...cs.map(y => +y.h)), L = Math.min(...cs.map(y => +y.l)); d.pos = H > L ? (pg - L) / (H - L) : null; } }
    const { C, hits } = sigCond(d, P), key = 'sg:' + b, prev = env.STATE ? await env.STATE.get(key) : null, now = Date.now();
    const on = C.map((v, i) => v ? NM[i] : '').filter(Boolean).join(', ');
    if (!prev) {
      if (hits >= K) { out.push(`🚀 ${b} 급등 준비 ${hits}개 충족 (${on}) · ${fmt(p)} · 24h ${d.c24 >= 0 ? '+' : ''}${d.c24.toFixed(1)}% · OI ${d.doi != null ? (d.doi >= 0 ? '+' : '') + d.doi.toFixed(1) + '%' : '–'}`);
        if (env.STATE) await env.STATE.put(key, JSON.stringify({ p, at: now, c4: d.cvd4 > 0 }), { expirationTtl: (hold + 24) * 3600 }); }
    } else { const v = JSON.parse(prev), r = (p / v.p - 1) * 100, hrs = (now - v.at) / 36e5, rs = `${r >= 0 ? '+' : ''}${r.toFixed(1)}%`;
      let why = null;
      if (hits < Math.max(1, K - 1)) why = `충족 ${hits}개로 줄어듦`; else if (S.inv !== false && v.c4 && d.cvd4 != null && d.cvd4 < 0) why = '4시간 CVD 마이너스 전환';
      if (why) { out.push(`⚠️ ${b} 신호 무효화: ${why} · 신호 뒤 ${rs} (${hrs.toFixed(0)}시간)`); if (env.STATE) await env.STATE.delete(key); }
      else if (hrs >= hold) { out.push(`⏰ ${b} 신호 ${hold}시간 경과 · 신호 뒤 ${rs} · 정리 여부 확인`); if (env.STATE) await env.STATE.delete(key); } }
  } catch (e) { errs.push(x.symbol + ' ' + e.message); } }));
}


/* ---- 가격 알림선: 사이트에서 /lines 로 올린 가격에 닿으면 한 번 알리고 지움 ---- */
async function checkLines(env, cfg, out) {
  if (!env.STATE) return; const L = JSON.parse(await env.STATE.get('lines') || '[]'); if (!L.length) return;
  const t = await j('https://api.bybit.com/v5/market/tickers?category=linear'); const px = {};
  for (const x of t.result.list) { const b = symBase(x.symbol); const sc = symScale(x.symbol); if (x.symbol.endsWith('USDT') && px[b] == null) px[b] = { p: +x.lastPrice, sc }; }
  const keep = [];
  for (const l of L) { const q = px[l.sym]; if (!q) { keep.push(l); continue; } const p = q.p;
    const hit = l.dir === 'above' ? q.p >= l.price : q.p <= l.price;
    if (hit) out.push(`🎯 ${l.sym} ${l.dir === 'above' ? '상향 돌파' : '하향 이탈'} ${fmt(l.price)} · 지금 ${fmt(p)}${l.note ? ' · ' + l.note : ''}`); else keep.push(l); }
  if (keep.length !== L.length && !env.DRY) await env.STATE.put('lines', JSON.stringify(keep));
}
/* ---- 주간 리포트: 매주 월요일 오전 9시(한국)에 지난 7일 매매 요약 ---- */
async function checkWeekly(env, cfg, out) {
  if (!env.STATE || cfg.weekly === false) return; const now = new Date(Date.now() + 9 * 36e5);
  if (!env.FORCE_WEEKLY && !(now.getUTCDay() === 1 && now.getUTCHours() === 9 && now.getUTCMinutes() < 5)) return;
  const wk = now.toISOString().slice(0, 10); if (!env.FORCE_WEEKLY && !(await once(env, 'wk:' + wk, 60 * 24))) return;
  const T = JSON.parse(await env.STATE.get('journal') || '[]').filter(t => t.c >= Date.now() - 7 * 864e5);
  if (!T.length) { out.push('📒 주간 리포트: 지난 7일 동안 끝난 매매가 없어요.'); return; }
  const usd = T.every(t => t.u != null), v = t => usd ? t.u : t.p, sum = T.reduce((a, t) => a + v(t), 0), w = T.filter(t => v(t) > 0).length;
  const f = x => usd ? (x >= 0 ? '+$' : '−$') + Math.abs(x).toFixed(0) : (x >= 0 ? '+' : '') + x.toFixed(2) + '%';
  const by = k => { const m = {}; for (const t of T) for (const g of [].concat(t[k] || [])) { m[g] = m[g] || { n: 0, s: 0 }; m[g].n++; m[g].s += v(t); } return Object.entries(m); };
  const setups = by('s').sort((a, b) => b[1].s - a[1].s), mis = by('m').sort((a, b) => b[1].n - a[1].n);
  const lines = [`📒 주간 리포트 (지난 7일)`, `매매 ${T.length}건 · 승률 ${(w / T.length * 100).toFixed(0)}% · 손익 ${f(sum)}`];
  if (setups.length) lines.push(`가장 잘 된 셋업: ${setups[0][0] || '(없음)'} ${f(setups[0][1].s)}` + (setups.length > 1 ? ` · 가장 안 된 셋업: ${setups.at(-1)[0] || '(없음)'} ${f(setups.at(-1)[1].s)}` : ''));
  if (mis.length) lines.push(`가장 많이 한 실수: ${mis[0][0]} ${mis[0][1].n}번 (${f(mis[0][1].s)})`);
  const best = T.slice().sort((a, b) => v(b) - v(a))[0], worst = T.slice().sort((a, b) => v(a) - v(b))[0];
  lines.push(`최고 ${best.y} ${f(v(best))} · 최악 ${worst.y} ${f(v(worst))}`); out.push(lines.join('\n'));
}

async function run(env) {
  const cfg = typeof env.CONFIG === 'object' ? env.CONFIG : JSON.parse(env.CONFIG || '{}'); const out = [], errs = []; SRCS = {};
  for (const f of [checkPrice, checkKimp, checkWallets, checkSignals, checkLines, checkWeekly]) { try { await f(env, cfg, out, errs); } catch (e) { errs.push(e.message); } }
  if (out.length && !env.DRY) await tg(env, cfg, out.join('\n'));
  return { count: out.length, sent: out.length > 0 && !env.DRY, out, errs, src: SRCS };
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,x-key' };
const txt = (s, status = 200) => new Response(s, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...CORS } });
const jsn = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } });
export default {
  run, // 사이트의 '폰 알림' 페이지가 미리보기에 씀
  async scheduled(ev, env, ctx) { ctx.waitUntil(run(env)); },
  async fetch(req, env) {
    const u = new URL(req.url); const cfg = JSON.parse(env.CONFIG || '{}');
    try {
      if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
      /* 사이트에서 쓰는 저장 API: 비밀값 SITE_KEY 가 맞아야 함 */
      if (u.pathname === '/lines' || u.pathname === '/journal') {
        if (!env.SITE_KEY || req.headers.get('x-key') !== env.SITE_KEY) return jsn({ error: 'SITE_KEY가 맞지 않아요' }, 401);
        if (!env.STATE) return jsn({ error: 'KV(STATE)가 연결되지 않았어요' }, 500);
        const k = u.pathname.slice(1);
        if (req.method === 'POST') { const b = await req.json(); if (!Array.isArray(b)) return jsn({ error: '배열이어야 해요' }, 400); await env.STATE.put(k, JSON.stringify(b.slice(0, 500))); return jsn({ ok: true, n: b.length }); }
        return jsn(JSON.parse(await env.STATE.get(k) || '[]'));
      }
      if (u.pathname === '/weekly') { const out = []; await checkWeekly({ ...env, FORCE_WEEKLY: true }, cfg, out); if (out.length) await tg(env, cfg, out.join('\n')); return txt(out.join('\n') || '보낼 내용이 없어요'); }
      if (u.pathname === '/test') { await tg(env, cfg, '✅ 온체인 데스크 알림 연결됐어요.'); return txt('텔레그램으로 테스트 메시지를 보냈어요.'); }
      if (u.pathname === '/run') return new Response(JSON.stringify(await run(env), null, 1), { headers: { 'content-type': 'application/json; charset=utf-8' } });
      return txt('온체인 데스크 알림 워커. /test = 테스트 메시지, /run = 지금 한 번 확인');
    } catch (e) { return txt('오류: ' + e.message, 500); }
  }
};
