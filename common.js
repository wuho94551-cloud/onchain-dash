/* 온체인 데스크 공통: 종목 종류 구분 + 캔들/볼륨 프로파일 차트 창 */
(function(){
const LWC='https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function j(u){const r=await fetch(u);if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}

/* ---- 종류 ---- */
const KIND={'':'코인',innovation:'코인',stock:'주식',ETF:'ETF',commodity:'원자재',forex:'외환'};
const KINDS=['코인','주식','ETF','원자재','외환'];
let typeMap=null;
async function loadTypes(){
  if(typeMap)return typeMap;
  try{const c=sessionStorage.getItem('od-types');if(c){typeMap=new Map(JSON.parse(c));return typeMap}}catch(e){}
  typeMap=new Map();
  try{let cur='';do{const r=await j('https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000'+(cur?'&cursor='+encodeURIComponent(cur):''));
      for(const x of r.result.list)typeMap.set(x.symbol,KIND[x.symbolType]??'코인');cur=r.result.nextPageCursor}while(cur);
    try{sessionStorage.setItem('od-types',JSON.stringify([...typeMap]))}catch(e){}}catch(e){}
  return typeMap;
}
const kindOf=sym=>(typeMap&&typeMap.get(sym))||'코인';


/* ---- 우측 상단 알림 팝업 (3초 뒤 사라짐, 열린 다른 탭에도 표시) ---- */
const tcss=`.od-toasts{position:fixed;top:64px;right:14px;z-index:60;display:flex;flex-direction:column;gap:8px;width:min(320px,calc(100vw - 28px));pointer-events:none}
.od-toast{white-space:pre-line;pointer-events:auto;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-left:3px solid var(--ink);box-shadow:0 6px 20px rgba(0,0,0,.18);padding:10px 12px;font-family:var(--sans);font-size:13px;line-height:1.4;cursor:pointer;opacity:0;transform:translateX(16px);transition:opacity .25s,transform .25s}
.od-toast.in{opacity:1;transform:none}
.od-toast b{display:block;font-size:14px;font-weight:600;margin-bottom:2px}
.od-toast.B{border-left-color:var(--up)}.od-toast.S{border-left-color:var(--dn)}
.od-toast small{color:var(--mute);font-size:11px;float:right;font-family:var(--mono)}
@media(prefers-reduced-motion:reduce){.od-toast{transition:none}}`;
let tbox=null;
function toast(title,body='',o={}){
  if(!tbox){const s=document.createElement('style');s.textContent=tcss;document.head.appendChild(s);tbox=document.createElement('div');tbox.className='od-toasts';tbox.setAttribute('role','status');tbox.setAttribute('aria-live','polite');document.body.appendChild(tbox)}
  const t=document.createElement('div');t.className='od-toast '+(o.side||'');
  const d=new Date(o.t||Date.now()),tm=[d.getHours(),d.getMinutes(),d.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');
  t.innerHTML=`<small>${tm}${o.from?' · '+esc(o.from):''}</small><b>${esc(title)}</b>${body?esc(body):''}`;
  if(o.href)t.onclick=()=>{location.href=o.href};else t.onclick=()=>t.remove();
  tbox.prepend(t);while(tbox.children.length>4)tbox.lastChild.remove();
  requestAnimationFrame(()=>t.classList.add('in'));
  setTimeout(()=>{t.classList.remove('in');setTimeout(()=>t.remove(),300)},o.ms||3000);
}
/* 알림 발생: 이 탭에 띄우고, 같은 사이트의 다른 열린 탭에도 전달 */
function notify(title,body='',o={}){toast(title,body,o);pushHist({title,body,side:o.side||'',href:o.href||'',from:o.from||document.title.split(' · ')[0],t:Date.now()});try{localStorage.setItem('od-alert',JSON.stringify({title,body,o:{...o,from:o.from||document.title.split(' · ')[0]},t:Date.now()}))}catch(e){}}
window.addEventListener('storage',e=>{if(e.key==='od-alerts')bellBadge();if(e.key==='od-fav')window.dispatchEvent(new Event('od-fav'));if(e.key!=='od-alert'||!e.newValue)return;try{const a=JSON.parse(e.newValue);if(Date.now()-a.t<10e3)toast(a.title,a.body,{...a.o,t:a.t})}catch(x){}});



/* ---- 알림 기록함 ---- */
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
function pushHist(a){const h=LS.get('od-alerts',[]);h.unshift(a);LS.set('od-alerts',h.slice(0,50));bellBadge()}
function bellBadge(){const b=document.getElementById('od-bell');if(!b)return;const seen=LS.get('od-alerts-seen',0),n=LS.get('od-alerts',[]).filter(a=>a.t>seen).length;
  let g=b.querySelector('.badge');if(n){if(!g){g=document.createElement('span');g.className='badge';b.appendChild(g)}g.textContent=n>9?'9+':n}else if(g)g.remove()}
const shcss=`.od-sync{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.45);display:grid;place-items:center;padding:12px}
.od-sync .box{background:var(--bg);color:var(--ink);border:1px solid var(--ink);width:min(460px,100%);padding:14px 16px;font-family:var(--sans);font-size:14px;max-height:90vh;overflow:auto}
.od-sync header{display:flex;justify-content:space-between;align-items:center}.od-sync header b{font-size:16px}.od-sync header button{background:transparent;color:var(--ink);border:0;min-height:32px;font-size:16px}
.od-sync p{color:var(--mute);font-size:13px;margin:8px 0}.od-sync .h{display:block;margin:12px 0 6px}
.od-sync textarea{width:100%;font:12px/1.4 var(--mono);color:var(--ink);background:transparent;border:1px solid var(--line);padding:8px;resize:vertical;word-break:break-all}
.od-sync button[data-copy],.od-sync button[data-apply]{margin-top:6px;min-height:38px;padding:0 14px}
.od-hist{position:fixed;z-index:65;top:56px;right:12px;width:min(360px,calc(100vw - 24px));max-height:min(520px,75vh);overflow:auto;background:var(--bg);border:1px solid var(--ink);box-shadow:0 10px 30px rgba(0,0,0,.25);font-family:var(--sans);font-size:13px}
.od-hist header{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg)}
.od-hist header b{font-size:15px}.od-hist header button{background:transparent;color:var(--mute);border:0;font:inherit;font-size:12px;cursor:pointer;min-height:32px}
.od-hist a{display:block;padding:9px 12px;border-bottom:1px solid var(--line);color:var(--ink);text-decoration:none;border-left:3px solid var(--line)}
.od-hist a.B{border-left-color:var(--up)}.od-hist a.S{border-left-color:var(--dn)}.od-hist a.new{background:color-mix(in srgb,var(--ink) 6%,transparent)}
.od-hist a:hover{background:color-mix(in srgb,var(--ink) 9%,transparent)}
.od-hist small{float:right;color:var(--mute);font-family:var(--mono);font-size:11px}.od-hist p{margin:2px 0 0;color:var(--mute)}
.od-hist .empty{padding:18px 12px;color:var(--mute)}
.odl{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px;margin:6px 0 0;font-family:var(--sans);align-items:center}
.odl span{color:var(--mute)}.odl a{color:var(--ink);text-underline-offset:3px}
.odl button{background:transparent;border:1px solid var(--line);color:var(--ink);min-height:32px;padding:0 10px;font:inherit;font-size:13px;cursor:pointer}
.odl button[aria-pressed=true]{color:#c99400;border-color:#c99400}`;
function shellStyle(){if(document.getElementById('od-shcss'))return;const st=document.createElement('style');st.id='od-shcss';st.textContent=shcss;document.head.appendChild(st)}
function openHist(){shellStyle();let p=document.querySelector('.od-hist');if(p){p.remove();return}
  const seen=LS.get('od-alerts-seen',0),h=LS.get('od-alerts',[]);p=document.createElement('div');p.className='od-hist';p.setAttribute('role','dialog');p.setAttribute('aria-label','알림 기록');
  const tm=t=>{const d=new Date(t);return`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
  p.innerHTML=`<header><b>알림 기록</b><span><a href="./alert.html" style="font-size:12px;color:var(--ink);margin-right:10px">📱 폰 알림 설정</a><button type="button" data-sync style="margin-right:8px">⇄ 기기 옮기기</button><button type="button" data-clear>모두 지우기</button></span></header>`+(h.length?h.map(a=>`<a href="${esc(a.href||'#')}" class="${esc(a.side)} ${a.t>seen?'new':''}"><small>${tm(a.t)}${a.from?' · '+esc(a.from):''}</small><b>${esc(a.title)}</b>${a.body?`<p>${esc(a.body)}</p>`:''}</a>`).join(''):'<div class="empty">아직 알림이 없어요. 실시간 청산·김프·호가 감시·급등 준비 페이지가 열려 있을 때 생겨요.</div>');
  document.body.appendChild(p);LS.set('od-alerts-seen',Date.now());bellBadge();
  p.querySelector('[data-sync]').onclick=()=>{p.remove();openSync()};
  p.querySelector('[data-clear]').onclick=()=>{LS.set('od-alerts',[]);p.remove();bellBadge()};
  setTimeout(()=>document.addEventListener('pointerdown',function off(e){if(!p.contains(e.target)&&!e.target.closest('#od-bell')){p.remove();document.removeEventListener('pointerdown',off)}}));
}
/* ---- 테마 ---- */
const THEMES=[['','◐','기기 설정 따르기'],['dark','☾','다크'],['light','☀','라이트']];
function setTheme(t){if(t)document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme;try{t?localStorage.setItem('od-theme',t):localStorage.removeItem('od-theme')}catch(e){}window.dispatchEvent(new Event('od-theme'))}
/* ---- 관심 코인 ---- */
const favs=()=>LS.get('od-fav',[]);
const isFav=b=>favs().includes(b);
function toggleFav(b){let f=favs();f=f.includes(b)?f.filter(x=>x!==b):[b,...f];LS.set('od-fav',f.slice(0,40));window.dispatchEvent(new Event('od-fav'));return f.includes(b)}
/* ---- 같은 코인 바로가기 ---- */
function coinLinks(host,base,here){shellStyle();const b=encodeURIComponent(base);
  const L=[['coin','코인 분석',`./coin.html#${b}`],['watch','호가 감시',`./watch.html#${b}`],['cvd','CVD',`./cvd.html#${b}`]].filter(x=>x[0]!==here);
  host.innerHTML=`<button type="button" data-fav aria-pressed="${isFav(base)}" title="관심 코인">${isFav(base)?'★':'☆'} 관심</button><span>이 코인으로</span>`+L.map(x=>`<a href="${x[2]}">${x[1]} →</a>`).join('')+(here!=='chart'?`<a href="#" data-chart>차트 창 →</a>`:'');
  host.querySelector('[data-fav]').onclick=e=>{const on=toggleFav(base);e.currentTarget.setAttribute('aria-pressed',on);e.currentTarget.textContent=(on?'★':'☆')+' 관심'};
  const ch=host.querySelector('[data-chart]');if(ch)ch.onclick=e=>{e.preventDefault();openChart(base)};
  host.classList.add('odl')}
/* ---- 메뉴 도구 (🔔, 테마) ---- */
function shell(){const t=document.getElementById('od-tools');if(!t||t.dataset.ok)return;t.dataset.ok=1;shellStyle();
  const cur=()=>document.documentElement.dataset.theme||'';
  t.innerHTML=`<button type="button" id="od-sync" title="다른 기기로 설정 옮기기" aria-label="다른 기기로 설정 옮기기">⇄</button><button type="button" id="od-theme" title="화면 테마"></button><button type="button" id="od-bell" title="알림 기록" aria-label="알림 기록">🔔</button>`;
  t.querySelector('#od-sync').onclick=openSync;
  const tb=t.querySelector('#od-theme'),paint=()=>{const th=THEMES.find(x=>x[0]===cur())||THEMES[0];tb.textContent=th[1];tb.title='화면 테마: '+th[2]+' (누르면 바뀜)';tb.setAttribute('aria-label',tb.title)};paint();
  tb.onclick=()=>{const i=THEMES.findIndex(x=>x[0]===cur());setTheme(THEMES[(i+1)%THEMES.length][0]);paint()};
  t.querySelector('#od-bell').onclick=openHist;bellBadge();
  }
/* ---- 코인 아이콘: 코인 분석에서 본 코인은 CoinGecko 이미지를 저장해 쓰고, 없으면 공개 아이콘 모음, 그것도 없으면 글자 배지 ---- */
const ICN=(()=>{try{return JSON.parse(localStorage.getItem('od-icons')||'{}')}catch(e){return{}}})();
function setIcon(sym,url){if(!sym||!url||ICN[sym]===url)return;ICN[sym]=url;try{localStorage.setItem('od-icons',JSON.stringify(ICN))}catch(e){}}
function coinIcon(sym,px=20){sym=String(sym||'').toUpperCase().replace(/^1000+/,'');const t=sym.slice(0,3),s=`width:${px}px;height:${px}px`;
  const badge=`<span class="od-ic od-icb" style="${s};font-size:${Math.round(px*.38)}px">${esc(t)}</span>`;
  const alt=`https://assets.coincap.io/assets/icons/${encodeURIComponent(sym.toLowerCase())}@2x.png`;
  const first=ICN[sym]||alt;
  return `<img class="od-ic" style="${s}" src="${esc(first)}" alt="" loading="lazy" data-alt="${ICN[sym]?esc(alt):''}" data-b="${esc(t)}" onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt=''}else{const b=document.createElement('span');b.className='od-ic od-icb';b.style.cssText=this.style.cssText+';font-size:${Math.round(px*.38)}px';b.textContent=this.dataset.b;this.replaceWith(b)}">`}
/* ---- 설정 옮기기: 관심 코인·저장 지갑·알림 조건 등을 코드 한 줄로 내보내고 다른 기기에서 붙여넣기 ----
   API 키(업비트·Dune 등)와 캐시·알림 기록은 넣지 않아요 */
const SKIP=/^(cg:|k-|uk-|od-alerts?$|od-alerts-seen$|kimp-names$|od-icons$|od-gh-token$|od-gist-id$|od-fx$|od-worker$)/;
function syncKeys(){const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||SKIP.test(k))continue;if(!/^(od-|odc-|scvd-|liq-|kimp-|lm-|sc-|su-|ul-|w-|coin$|tf$)/.test(k))continue;o[k]=localStorage.getItem(k)}return o}
const b64e=s=>btoa(String.fromCharCode(...new TextEncoder().encode(s))),b64d=s=>new TextDecoder().decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0)));
function openSync(){shellStyle();document.querySelector('.od-sync')?.remove();const o=syncKeys(),code='OD1:'+b64e(JSON.stringify(o));
  const fav=JSON.parse(o['od-fav']||'[]').length,wal=JSON.parse(o['od-wallets']||'[]').length;
  const p=document.createElement('div');p.className='od-sync';p.setAttribute('role','dialog');p.setAttribute('aria-label','설정 옮기기');
  p.innerHTML=`<div class="box"><header><b>다른 기기로 설정 옮기기</b><button type="button" data-x aria-label="닫기">✕</button></header>
  <p>이 기기 설정: 관심 코인 ${fav}개 · 저장 지갑 ${wal}개 · 알림 조건·테마·차트 색 등 ${Object.keys(o).length}항목. API 키는 넣지 않아요.</p>
  <b class="h">1. 이 기기에서 내보내기</b><textarea readonly rows="3">${esc(code)}</textarea><button type="button" data-copy>코드 복사</button>
  <b class="h">2. 다른 기기에서 붙여넣기</b><textarea rows="3" placeholder="OD1:로 시작하는 코드를 붙여넣으세요" data-in></textarea><button type="button" data-apply>이 기기에 적용</button><p data-msg></p></div>`;
  document.body.appendChild(p);const q=s=>p.querySelector(s);
  q('[data-x]').onclick=()=>p.remove();p.onclick=e=>{if(e.target===p)p.remove()};
  q('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(code);toast('코드를 복사했어요','다른 기기에서 ⇄ 버튼을 눌러 붙여넣으세요')}catch(e){p.querySelector('textarea').select();toast('복사가 막혀 있어요','선택된 글자를 직접 복사해 주세요')}};
  q('[data-apply]').onclick=()=>{const v=q('[data-in]').value.trim();try{if(!v.startsWith('OD1:'))throw 0;const d=JSON.parse(b64d(v.slice(4)));const ks=Object.keys(d).filter(k=>!SKIP.test(k)&&typeof d[k]==='string');if(!ks.length)throw 0;
      if(!confirmApply(ks.length))return;for(const k of ks)localStorage.setItem(k,d[k]);q('[data-msg]').textContent=`${ks.length}항목을 적용했어요. 새로고침할게요.`;setTimeout(()=>location.reload(),900)}
    catch(e){q('[data-msg]').textContent='코드가 올바르지 않아요. OD1:로 시작하는 코드 전체를 붙여넣어 주세요.'}};
  function confirmApply(n){const b=q('[data-apply]');if(b.dataset.sure)return true;b.dataset.sure=1;b.textContent=`덮어쓰기 확인 (${n}항목) · 한 번 더 누르세요`;q('[data-msg]').textContent='이 기기의 관심 코인·지갑·설정이 붙여넣은 내용으로 바뀌어요.';return false}}
/* ---- 공통 메뉴: 4묶음 + 지금 묶음의 페이지 줄. 모든 페이지가 같은 메뉴를 쓰도록 여기서 그림 ---- */
const NAV=[['시장',[['./','급등 준비'],['./scan.html','스캐너'],['./pump.html','세력 의심'],['./kimp.html','김프'],['./bt.html','신호 검증']]],
  ['코인',[['./fav.html','★ 관심'],['./view.html','한눈에'],['./coin.html','코인 분석'],['./watch.html','호가 감시'],['./cvd.html','CVD']]],
  ['청산',[['./liq.html','실시간 청산'],['./liqmap.html','청산 압력']]],
  ['온체인',[['./unlock.html','언락'],['./wallet.html','지갑']]],
  ['기록',[['./journal.html','매매 일지']]]];
/* ---- 페이지마다 데이터 출처: 맨 아래 접이식 상자 ---- */
const SRC_L={
  bybit:['Bybit 공개 시장 API','https://bybit-exchange.github.io/docs/v5/intro'],
  binF:['바이낸스 USDⓈ-M 선물 공개 API','https://developers.binance.com/docs/derivatives/usds-margined-futures/general-info'],
  binS:['바이낸스 현물 공개 API','https://developers.binance.com/docs/binance-spot-api-docs'],
  binV:['바이낸스 공개 데이터 저장소','https://data.binance.vision'],
  gate:['Gate.io 공개 API','https://www.gate.io/docs/developers/apiv4/'],
  okx:['OKX 공개 API','https://www.okx.com/docs-v5/en/'],
  upbit:['업비트 공개 API','https://docs.upbit.com'],
  bithumb:['빗썸 공개 API','https://apidocs.bithumb.com'],
  fx:['ExchangeRate-API (open.er-api.com)','https://www.exchangerate-api.com/docs/free'],
  cg:['CoinGecko API','https://docs.coingecko.com'],
  llama:['DefiLlama 언락 데이터','https://defillama.com/unlocks'],
  ethp:['Ethplorer API','https://github.com/EverexIO/Ethplorer/wiki/Ethplorer-API'],
  dune:['Dune API (내 키)','https://docs.dune.com/api-reference'],
  bs:['Blockscout API','https://docs.blockscout.com'],
  gh:['GitHub Gist API (내 토큰)','https://docs.github.com/rest/gists'],
  tg:['Telegram Bot API','https://core.telegram.org/bots/api'],
  cf:['Cloudflare Workers (내 워커)','https://developers.cloudflare.com/workers/'],
  coincap:['CoinCap 아이콘','https://coincap.io'],
  lwc:['TradingView Lightweight Charts','https://github.com/tradingview/lightweight-charts']};
const GATE_FB='바이낸스 선물에 없는 코인만 Gate.io 선물 contract_stats·candlesticks로 대신';
const SRC_P={
  './':[['bybit','종목·가격·24시간 변동·펀딩비(tickers), 미결제약정 변화(open-interest), 롱숏 계정 비율(account-ratio)'],['binF','CVD와 청산 추정용 1시간 봉·시장가 매수 금액(fapi/v1/klines), 미결제약정 기록(futures/data/openInterestHist, Bybit와 합산)'],['gate',GATE_FB]],
  './scan.html':[['bybit','종목·가격·거래량·펀딩비(tickers, kline), 미결제약정(open-interest)'],['binF','CVD용 1시간 봉 시장가 매수량(klines)'],['gate',GATE_FB]],
  './pump.html':[['bybit','종목·가격(tickers), 1시간 봉 240개(kline), 미결제약정(open-interest), 롱숏 계정 비율(account-ratio)'],['binF','CVD·청산 추정용 1시간 봉(klines), 미결제약정 기록(Bybit와 합산), 큰손 평단용 상위 트레이더 포지션 비율·전체 계정 비율·미결제약정 기록·시장가 매수/매도 비율(futures/data)'],['gate',GATE_FB],['','확률·검증 통과 조합: 이 사이트 신호 검증 결과(기본값은 pump-default.json)']],
  './kimp.html':[['upbit','원화 시세·마켓 목록·입출금 상태'],['bithumb','원화 시세·입출금 상태'],['binS','해외 기준가(현물 ticker/price, 기본)'],['bybit','해외 기준가(선택 시)'],['okx','해외 기준가(선택 시)'],['gate','해외 기준가(선택 시), 입출금 상태(spot/currencies, 바이낸스는 개인 키 없이 입출금 상태를 안 줌)'],['fx','달러/원 환율']],
  './bt.html':[['bybit','180일 1시간 봉(kline), 미결제약정(open-interest), 펀딩비 기록(funding/history), 롱숏 계정 비율(account-ratio), 실전 기록의 1·3·7일 뒤 가격(kline)'],['binF','180일 CVD·청산 추정용 1시간 봉 시장가 매수량(klines)'],['gate','바이낸스 선물에 없는 코인만 contract_stats·candlesticks (최근 180일까지만 제공)']],
  './fav.html':[['bybit','가격·펀딩비(tickers), 미결제약정(open-interest)'],['binS','현물 1시간 봉 시장가 매수량으로 CVD(data-api.binance.vision klines)'],['binF','현물이 없으면 선물 1시간 봉으로 CVD'],['upbit','원화 시세(김프)'],['bithumb','입출금 상태'],['gate','입출금 상태(spot/currencies)'],['fx','달러/원 환율']],
  './view.html':[['bybit','가격·차트(tickers, kline), 미결제약정(open-interest), 펀딩비 기록(funding/history), 롱숏 계정 비율(account-ratio)'],['binF','CVD·청산 추정용 1시간 봉(klines), 평단 나눠 보기(futures/data 상위 트레이더·전체 계정 비율·미결제약정 기록·시장가 매수/매도 비율, aggTrades 최근 2일 체결)'],['binS','현물 체결 크기별 평단(api/v3/aggTrades 최근 7일 체결)'],['gate',GATE_FB]],
  './coin.html':[['cg','코인 검색·정보·컨트랙트 주소'],['binF','CVD(klines의 시장가 매수량), 상위 트레이더 롱/숏(futures/data)'],['bybit','미결제약정·펀딩비'],['okx','최근 약 24시간 청산 합계(liquidation-orders)'],['gate','바이낸스에 없는 코인의 CVD'],['llama','언락 일정·물량'],['ethp','이더리움 보유자 상위 20'],['bs','상위 지갑 분산 흔적: 보유자·토큰 이동·주소 라벨(이더리움·Base·Arbitrum·Optimism·Polygon)'],['dune','거래소 유입·유출(내 Dune 키를 넣었을 때)'],['','주소 정보 링크: Arkham, Etherscan']],
  './watch.html':[['bybit','실시간 호가·체결(웹소켓 stream.bybit.com 선물·현물), 캔들·가격(kline, tickers)']],
  './cvd.html':[['binF','선물 실시간 체결(웹소켓 fstream.binance.com), 최근 체결(fapi/v1)'],['binS','현물 실시간 체결(웹소켓 stream.binance.com), 최근 체결(data-api.binance.vision)'],['binV','지난 체결 기록 파일(data.binance.vision)']],
  './liq.html':[['binF','실시간 청산(웹소켓 fstream.binance.com !forceOrder@arr, 종목마다 1초에 1건까지만 옴)'],['bybit','실시간 청산(웹소켓 stream.bybit.com), 종목 목록(tickers)'],['okx','실시간 청산(웹소켓 ws.okx.com), 계약 정보(instruments)'],['gate','실시간 청산(웹소켓 fx-ws.gateio.ws), 계약 배수(contracts)']],
  './liqmap.html':[['bybit','종목·가격·펀딩비(tickers), 미결제약정(open-interest), 롱숏 계정 비율(account-ratio)'],['binF','청산 구간 추정용 1시간 봉(klines), 미결제약정 기록(Bybit와 합산)'],['okx','실제 청산 금액(점화 경보, liquidation-orders 최근 약 24시간)'],['gate',GATE_FB]],
  './unlock.html':[['llama','언락 일정·물량(emissionsIndex)'],['bybit','가격(tickers)']],
  './wallet.html':[['bs','체인별 지갑 잔고·거래 내역(각 체인 blockscout.com)']],
  './journal.html':[['gh','일지 동기화(내 GitHub 토큰, 암호화한 뒤 저장)'],['','매매 기록은 내가 입력한 값']],
  './alert.html':[['tg','텔레그램 알림 보내기'],['cf','사이트를 꺼도 도는 알림 워커(내 Cloudflare 계정)'],['bybit','워커가 보는 가격·미결제약정·계정 비율'],['binF','워커의 CVD·청산 추정(사이트와 같음)'],['gate','워커에서 바이낸스가 막히거나 없는 코인만 대신']]};
const SRC_ALL=[['bybit','상단 분위기 줄의 BTC 가격·4시간 봉·미결제약정, 종목 분류(instruments-info)'],['upbit','상단 분위기 줄의 BTC 원화 가격(김프)'],['fx','달러/원 환율'],['cg','코인 아이콘(코인 분석에서 본 코인)'],['coincap','그 밖의 코인 아이콘'],['lwc','차트 그리기']];
function buildSrc(here){if(document.getElementById('od-src'))return;const P=SRC_P[here];if(!P)return;
  const li=([k,t])=>{const s=SRC_L[k];return`<li>${s?`<a href="${s[1]}" target="_blank" rel="noopener">${s[0]}</a>: `:''}${esc(t)}</li>`};
  const f=document.createElement('footer');f.id='od-src';f.className='od-src';
  f.innerHTML=`<details><summary>데이터 출처</summary><ul>${P.map(li).join('')}</ul><p>모든 페이지 공통</p><ul>${SRC_ALL.map(li).join('')}</ul><p>모두 무료 공개 데이터예요. 거래소마다 집계 방식이 달라 값이 조금씩 다를 수 있고, 추정이라고 적힌 값은 이 사이트가 계산한 값이에요.</p></details>`;
  const bb=document.querySelector('.od-bb');if(bb)document.body.insertBefore(f,bb);else document.body.appendChild(f)}
function buildNav(){const nav=document.querySelector('nav.top');if(!nav||nav.dataset.built)return;nav.dataset.built=1;
  const f=(location.pathname.split('/').pop()||'index.html').toLowerCase(),here=f==='index.html'?'./':'./'+f;
  const gi=NAV.findIndex(g=>g[1].some(p=>p[0]===here));
  nav.innerHTML=`<div class="band"><a class="brand" href="./" aria-label="홈으로"><em>Onchain</em>Desk</a>`+
    NAV.map((g,i)=>`<span class="od-dd"><a class="g" href="${g[1][0][0]}"${i===gi?' aria-current="true"':''} aria-haspopup="true">${g[0]}</a><span class="od-dm">${g[1].map(p=>`<a href="${p[0]}"${p[0]===here?' data-on="1"':''}>${p[1]}</a>`).join('')}</span></span>`).join('')+
    `<a class="g od-ph" href="./alert.html"${here==='./alert.html'?' aria-current="page"':''} title="사이트를 꺼도 텔레그램으로 알림">📱 폰 알림</a><span class="od-tools" id="od-tools"></span></div>`+
    (gi>=0?`<div class="od-sub">${NAV[gi][1].map(p=>`<a href="${p[0]}"${p[0]===here?' aria-current="page"':''}>${p[1]}</a>`).join('')}</div>`:'')+
    `<div class="od-mood" id="od-mood" aria-live="polite"></div>`;
  const bb=document.createElement('div');bb.className='od-bb';
  bb.innerHTML=NAV.map((g,i)=>`<a href="${g[1][0][0]}"${i===gi?' aria-current="true"':''}>${g[0]}</a>`).join('')+'<a href="#" data-srch>검색</a>';
  document.body.appendChild(bb);bb.querySelector('[data-srch]').onclick=e=>{e.preventDefault();openSearch()};
  buildSrc(here);
  mood()}
/* ---- 어디서나 코인 찾기: / 키 또는 폰 하단 '검색' → 한눈에 페이지 ---- */
let SRB=null;
function openSearch(){if(!SRB){const w=document.createElement('div');w.className='od-srch';w.innerHTML='<button type="button" aria-label="코인 검색"></button>';document.body.appendChild(w);SRB=w.querySelector('button');
    picker(SRB,b=>{location.href='./view.html#'+encodeURIComponent(b)},{searchLabel:'보기'})}
  SRB.click();setTimeout(()=>{const i=SRB.parentElement.querySelector('.odp input');i&&i.focus()},30)}
document.addEventListener('keydown',e=>{if(e.key!=='/'||e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t.closest&&t.closest('input,textarea,select,[contenteditable]'))return;e.preventDefault();openSearch()});
/* ---- 시장 분위기 한 줄: BTC 추세, 상위 30 펀딩 평균, BTC 미결제약정, 김프 (2분 캐시) ---- */
function ema(a,n){const k=2/(n+1);let e=a[0];const o=[e];for(let i=1;i<a.length;i++){e=a[i]*k+e*(1-k);o.push(e)}return o}
async function moodData(){try{const c=JSON.parse(sessionStorage.getItem('od-mood')||'null');if(c&&Date.now()-c.t<120e3)return c}catch(e){}
  const [tk,kl,oi,up,fx]=await Promise.allSettled([j('https://api.bybit.com/v5/market/tickers?category=linear'),j('https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=240&limit=60'),
    j('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1h&limit=25'),j('https://api.upbit.com/v1/ticker?markets=KRW-BTC'),
    (async()=>{try{const c=JSON.parse(localStorage.getItem('od-fx')||'null');if(c&&Date.now()-c.t<3600e3)return c.v}catch(e){}const r=await j('https://open.er-api.com/v6/latest/USD');const v=r.rates.KRW;localStorage.setItem('od-fx',JSON.stringify({t:Date.now(),v}));return v})()]);
  const m={t:Date.now()};
  if(tk.status==='fulfilled'){const L=tk.value.result.list.filter(x=>x.symbol.endsWith('USDT'));const b=L.find(x=>x.symbol==='BTCUSDT');if(b){m.p=+b.lastPrice;m.c=+b.price24hPcnt*100}
    const top=L.sort((a,b)=>b.turnover24h-a.turnover24h).slice(0,30);m.fr=top.reduce((a,x)=>a+ +x.fundingRate*100,0)/top.length;m.neg=top.filter(x=>+x.fundingRate<0).length}
  if(kl.status==='fulfilled'){const c=kl.value.result.list.map(a=>+a[4]).reverse(),e=ema(c,20),n=c.length-1;const r=e[n]>e[n-6];m.tr=c[n]>e[n]&&r?'up':c[n]<e[n]&&!r?'dn':'side'}
  if(oi.status==='fulfilled'){const l=oi.value.result.list;if(l.length>1)m.oi=(+l[0].openInterest/+l.at(-1).openInterest-1)*100}
  if(up.status==='fulfilled'&&fx.status==='fulfilled'&&m.p){m.kp=(up.value[0].trade_price/(m.p*fx.value)-1)*100}
  try{sessionStorage.setItem('od-mood',JSON.stringify(m))}catch(e){}return m}
async function mood(){const el=document.getElementById('od-mood');if(!el)return;try{const m=await moodData();
  const sg=v=>v==null||!isFinite(v)?'–':(v>0?'+':'')+v.toFixed(2)+'%';const cl=v=>v>0?'u':v<0?'d':'';
  const TR={up:['상승 추세','u'],dn:['하락 추세','d'],side:['방향 없음','']}[m.tr]||['–',''];
  el.innerHTML=`<span title="4시간 봉 20EMA 위/아래 + 기울기"><i>BTC</i><b class="${TR[1]}">${TR[0]}</b></span><span><i>BTC</i>${m.p?m.p.toLocaleString('en-US',{maximumFractionDigits:0}):'–'} <b class="${cl(m.c)}">${sg(m.c)}</b></span>`+
    `<span title="거래대금 상위 30개 무기한 선물 펀딩비 평균"><i>펀딩 평균</i><b class="${m.fr>0.01?'d':m.fr<0?'u':''}">${m.fr!=null?(m.fr>0?'+':'')+m.fr.toFixed(4)+'%':'–'}</b>${m.neg!=null?` · 음수 ${m.neg}/30`:''}</span>`+
    `<span><i>BTC 미결제약정 24h</i><b>${sg(m.oi)}</b></span><span><i>김프</i><b>${sg(m.kp)}</b></span>`;
  window.OD_MOOD=m;window.dispatchEvent(new Event('od-mood'))}catch(e){el.textContent=''}}
setInterval(()=>{if(!document.hidden){sessionStorage.removeItem('od-mood');mood()}},120e3);
buildNav();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',shell);else setTimeout(shell);

/* ---- 코인 선택 창: 버튼을 누르면 변동성 순 목록 + 검색 ---- */
const pcss=`.odp-wrap{position:relative;display:inline-block}
.odp-btn{background:transparent!important;border:0!important;padding:0!important;min-height:0!important;color:inherit!important;font:inherit!important;display:inline-flex;align-items:baseline;gap:10px;cursor:pointer;text-align:left}
.odp-btn:hover em{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:6px}
.odp-btn .car{font-size:.45em;color:var(--mute)}
.odp{position:absolute;z-index:20;top:calc(100% + 8px);left:0;width:min(420px,calc(100vw - 28px));background:var(--bg);border:1px solid var(--ink);box-shadow:0 10px 30px rgba(0,0,0,.2);padding:10px;font-family:var(--sans);font-size:14px;line-height:1.4;letter-spacing:0}
.odp input{width:100%;min-height:44px;font:inherit;font-size:16px;padding:0 12px;border:1px solid var(--line);color:var(--ink);background:transparent}
.odp .hd{display:flex;justify-content:space-between;font-size:12px;color:var(--mute);margin:8px 2px 4px}
.odp ul{list-style:none;margin:0;padding:0;max-height:min(420px,55vh);overflow:auto}
.odp li{display:grid;grid-template-columns:1fr auto auto auto;gap:12px;align-items:center;padding:8px 6px;border-top:1px solid var(--line);cursor:pointer;font-size:14px;font-style:normal}
.odp li b{font-weight:600}.odp li span{font-family:var(--mono);font-size:13px;white-space:nowrap;text-align:right}
.odp li .vb{color:var(--mute)}.odp li .u{color:var(--up)}.odp li .d{color:var(--dn)}
.odp li[aria-selected=true],.odp li:hover{background:color-mix(in srgb,var(--ink) 8%,transparent)}
.odp li.srch{grid-template-columns:1fr;color:var(--mute)}
.odp li{grid-template-columns:22px 1fr auto auto auto}.odp li.srch{grid-template-columns:1fr}
.odp li .st{background:transparent;border:0;color:var(--mute);font-size:16px;cursor:pointer;padding:0;min-height:0;line-height:1}.odp li .st.on{color:#c99400}
.odp li.sep{display:block;cursor:default;font-size:11px;color:var(--mute);padding:6px 6px 2px;border-top:0}.odp li.sep:hover{background:none}`;
let PKD=null,PKT=0;
async function pickData(){if(PKD&&Date.now()-PKT<60e3)return PKD;try{await loadTypes()}catch(e){}
  const r=await j('https://api.bybit.com/v5/market/tickers?category=linear');
  PKD=r.result.list.filter(x=>x.symbol.endsWith('USDT')&&kindOf(x.symbol)==='코인'&&+x.turnover24h>3e6).map(x=>{const b=x.symbol.replace(/USDT$/,'').replace(/^(1000000|10000|1000)|(1000000|10000|1000)$/g,'');const hi=+x.highPrice24h,lo=+x.lowPrice24h;
    return{b,p:+x.lastPrice,c:+x.price24hPcnt*100,rg:lo?(hi-lo)/lo*100:0}}).sort((a,b)=>b.rg-a.rg);PKT=Date.now();return PKD}
const pfx=n=>'$'+(n>=1000?n.toLocaleString('en-US',{maximumFractionDigits:0}):n>=1?n.toFixed(2):n.toPrecision(4));
function picker(btn,onPick,opt={}){
  if(!document.getElementById('odp-css')){const st=document.createElement('style');st.id='odp-css';st.textContent=pcss;document.head.appendChild(st)}
  const wrap=btn.parentElement;if(getComputedStyle(wrap).position==='static')wrap.style.position='relative';
  const pop=document.createElement('div');pop.className='odp';pop.hidden=true;
  pop.innerHTML=`<input placeholder="${esc(opt.placeholder||'코인 검색 (예: SOL, PEPE)')}" autocomplete="off" spellcheck="false" aria-label="코인 검색"><div class="hd"><span>변동성 순 · 24시간 고저폭</span><span data-r="st"></span></div><ul role="listbox"></ul>`;
  wrap.appendChild(pop);btn.setAttribute('aria-haspopup','listbox');btn.setAttribute('aria-expanded','false');
  const inp=pop.querySelector('input'),ul=pop.querySelector('ul'),st=pop.querySelector('[data-r=st]');let sel=0;
  let items=[];
  const render=()=>{const q=inp.value.trim().toUpperCase(),all=PKD||[],F=favs(),by=new Map(all.map(x=>[x.b,x]));
    let L=(q?all.filter(x=>x.b.includes(q)).sort((a,b)=>(b.b===q)-(a.b===q)||(b.b.startsWith(q))-(a.b.startsWith(q))||b.rg-a.rg):all).slice(0,40);
    let fv=[];if(!q&&F.length){fv=F.map(b=>by.get(b)||{b,p:null,c:null,rg:null});L=L.filter(x=>!F.includes(x.b))}
    items=[...fv,...L];sel=Math.min(sel,items.length);
    const row=(x,i)=>`<li role="option" data-s="${esc(x.b)}" aria-selected="${i===sel}"><button type="button" class="st ${F.includes(x.b)?'on':''}" data-star="${esc(x.b)}" aria-label="관심 코인">${F.includes(x.b)?'★':'☆'}</button><b style="display:inline-flex;align-items:center;gap:7px">${coinIcon(x.b,18)}${esc(x.b)}</b><span>${x.p!=null?pfx(x.p):''}</span><span class="${x.c>=0?'u':'d'}">${x.c!=null?(x.c>=0?'+':'')+x.c.toFixed(1)+'%':''}</span><span class="vb">${x.rg!=null?'폭 '+x.rg.toFixed(1)+'%':''}</span></li>`;
    ul.innerHTML=(fv.length?'<li class="sep">★ 관심 코인</li>':'')+fv.map((x,i)=>row(x,i)).join('')+(fv.length?'<li class="sep">변동성 순</li>':'')+L.map((x,i)=>row(x,i+fv.length)).join('')+
      (q?`<li class="srch" role="option" data-q="${esc(inp.value.trim())}" aria-selected="${sel===items.length}">"${esc(inp.value.trim())}" ${esc(opt.searchLabel||'그대로 열기')} ↵</li>`:'');
    st.textContent=all.length?`선물 ${all.length}개 중`:'불러오는 중…'};
  const opts=()=>[...ul.querySelectorAll('li[role=option]')];
  const open=()=>{pop.hidden=false;btn.setAttribute('aria-expanded','true');inp.value='';sel=0;render();inp.focus();pickData().then(render).catch(()=>{st.textContent='목록을 못 불러왔어요. 검색은 돼요.'})};
  const close=()=>{pop.hidden=true;btn.setAttribute('aria-expanded','false')};
  const go=li=>{if(!li)return;close();const s=li.dataset.s||li.dataset.q;if(s)onPick(s)};
  btn.addEventListener('click',()=>pop.hidden?open():close());
  inp.addEventListener('input',()=>{sel=0;render()});
  inp.addEventListener('keydown',e=>{const n=opts().length;
    if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(n-1,sel+1);render();opts()[sel]?.scrollIntoView({block:'nearest'})}
    else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);render();opts()[sel]?.scrollIntoView({block:'nearest'})}
    else if(e.key==='Enter'){e.preventDefault();if(opts()[sel])go(opts()[sel]);else if(inp.value.trim()){close();onPick(inp.value.trim())}}
    else if(e.key==='Escape'){close();btn.focus()}});
  ul.addEventListener('click',e=>{const s=e.target.closest('[data-star]');if(s){e.stopPropagation();toggleFav(s.dataset.star);render();return}const li=e.target.closest('li[role=option]');if(li)go(li)});
  document.addEventListener('pointerdown',e=>{if(!pop.hidden&&!wrap.contains(e.target))close()});
  return{open,close};
}

/* ---- 차트 창 ---- */
let lwcP=null;const loadLWC=()=>lwcP||(lwcP=new Promise((res,rej)=>{if(window.LightweightCharts)return res();const s=document.createElement('script');s.src=LWC;s.onload=res;s.onerror=()=>rej(new Error('차트 라이브러리를 불러오지 못했어요'));document.head.appendChild(s)}));
const css=`
.odc-back{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:50;display:flex;align-items:center;justify-content:center;padding:12px}
.odc{background:var(--bg);color:var(--ink);width:min(1100px,100%);max-height:96vh;overflow:auto;border:1px solid var(--ink);padding:14px 16px}
.odc-h{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:baseline;justify-content:space-between}
.odc-h h2{font-family:var(--serif);font-weight:400;font-size:34px;margin:0}
.odc-h .k{font-size:13px;color:var(--mute);margin-left:8px;font-family:var(--sans)}
.odc-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:10px 0}
.odc-tools button{min-height:36px;padding:0 12px;font-size:14px;background:transparent;color:var(--ink);border:1px solid var(--line);cursor:pointer;font-family:var(--sans)}
.odc-tools button[aria-pressed=true]{background:var(--ink);color:var(--bg)}
.odc-tools a{font-size:14px;color:var(--ink);margin-left:8px}
.odc-x{min-height:40px;min-width:40px;background:transparent!important;color:var(--ink)!important;border:1px solid var(--line)!important;font-size:18px;cursor:pointer}
.odc-wrap{position:relative;width:100%;aspect-ratio:16/8;min-height:300px;max-height:68vh}
@media(max-width:600px){.odc-wrap{aspect-ratio:4/3.4}}
.odc-wrap>div{position:relative;z-index:1}
.odc-wrap canvas.vp{position:absolute;top:0;left:0;z-index:0;pointer-events:none}
.odc-info{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px;margin-top:8px;font-family:var(--sans);font-variant-numeric:tabular-nums}
.odc-info span{white-space:nowrap}.odc-info i{font-style:normal;color:var(--mute);font-family:var(--sans);margin-right:4px}
.odc-note{font-size:13px;color:var(--mute);margin:6px 0 0}
.odc-tools .sp{flex:1}
.odc-set{border:1px solid var(--line);padding:12px 14px;margin:0 0 10px;position:relative;font-family:var(--sans);font-size:14px}
.odc-set h3{font-family:var(--serif);font-weight:400;font-size:20px;margin:0 0 6px}
.odc-set .r{display:flex;align-items:center;gap:10px;min-height:44px;border-bottom:1px solid var(--line)}
.odc-set .r>b{font-weight:500;flex:1}
.odc-set .d{font-size:12px;color:var(--mute);margin:2px 0 6px}
.odc-set input[type=checkbox]{width:20px!important;height:20px!important;min-height:0!important;min-width:0!important;padding:0!important;margin:0;flex:none;accent-color:var(--ink)}
.odc-set .odc-sw{flex:none}
.odc-sw{width:40px;height:30px;border:1px solid var(--line);cursor:pointer;padding:0;background-image:linear-gradient(45deg,#8884 25%,transparent 25%,transparent 75%,#8884 75%),linear-gradient(45deg,#8884 25%,transparent 25%,transparent 75%,#8884 75%);background-size:10px 10px;background-position:0 0,5px 5px;position:relative}
.odc-sw i{position:absolute;inset:0}
.odc-set .pre{display:flex;flex-wrap:wrap;gap:6px;padding:10px 0}
.odc-set .pre button,.odc-set .ft button{min-height:36px;padding:0 12px;font-size:14px;background:transparent;color:var(--ink);border:1px solid var(--line);cursor:pointer;font-family:var(--sans)}
.odc-set .ft{display:flex;gap:6px;justify-content:flex-end;padding-top:10px}
.odc-set .ft .ok{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.odc-pop{position:absolute;z-index:5;background:var(--bg);border:1px solid var(--ink);padding:10px;width:248px;box-shadow:0 6px 24px rgba(0,0,0,.25)}
.odc-pop .g{display:grid;grid-template-columns:repeat(10,1fr);gap:3px}
.odc-pop .g button{aspect-ratio:1;border:1px solid var(--line);padding:0;cursor:pointer;min-height:0}
.odc-pop .g button[aria-pressed=true]{outline:2px solid var(--ink);outline-offset:1px}
.odc-pop .cu{display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
.odc-pop .cu label{width:28px;height:28px;border:1px dashed var(--mute);display:grid;place-items:center;cursor:pointer;color:var(--mute);position:relative}
.odc-pop .cu label input{position:absolute;opacity:0;inset:0;cursor:pointer}
.odc-pop .cu .now{width:28px;height:28px;border:1px solid var(--line)}
.odc-pop .cu input[type=text]{min-height:0;width:90px;font-family:var(--mono);font-size:13px;background:transparent;color:var(--ink);border:1px solid var(--line);padding:4px 6px}
.odc-pop .al{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13px}
.odc-pop .al input{flex:1;accent-color:var(--ink)}.odc-pop .al b{font-family:var(--mono);font-weight:400;width:38px;text-align:right}
`;
let styled=false;function style(){if(styled)return;styled=true;const s=document.createElement('style');s.textContent=css;document.head.appendChild(s)}
const TFS=[['5','5분'],['15','15분'],['60','1시간'],['240','4시간'],['D','1일']];
const cvar=n=>{const e=document.createElement('span');e.style.color=`var(${n})`;e.style.display='none';document.body.appendChild(e);const c=getComputedStyle(e).color||'rgb(128,128,128)';e.remove();return c};
const alpha=(c,a)=>{const m=c.match(/[\d.]+/g);return m?`rgba(${m[0]},${m[1]},${m[2]},${a})`:c};

function volumeProfile(K,nb=48){
  const H=Math.max(...K.map(k=>k.high)),L=Math.min(...K.map(k=>k.low));const st=(H-L)/nb||1;const bins=new Float64Array(nb);
  for(const k of K){const a=Math.max(0,Math.floor((k.low-L)/st)),b=Math.min(nb-1,Math.floor((k.high-L)/st));const per=k.q/(b-a+1);for(let i=a;i<=b;i++)bins[i]+=per}
  const tot=bins.reduce((s,v)=>s+v,0);let poc=0;for(let i=1;i<nb;i++)if(bins[i]>bins[poc])poc=i;
  let lo=poc,hi=poc,acc=bins[poc];while(acc<tot*.7&&(lo>0||hi<nb-1)){const d=lo>0?bins[lo-1]:-1,u=hi<nb-1?bins[hi+1]:-1;if(u>=d){hi++;acc+=bins[hi]}else{lo--;acc+=bins[lo]}}
  const avg=tot/nb;
  return{bins:[...bins],L,st,nb,poc,lo,hi,POC:L+(poc+.5)*st,VAH:L+(hi+1)*st,VAL:L+lo*st,lvn:[...bins].map((v,i)=>v<avg*.35?i:-1).filter(i=>i>=0)};
}


/* ---- 캔들 색 설정 (모든 차트 공통, 기기마다 저장) ---- */
const isDark=()=>{const m=cvar('--bg').match(/[\d.]+/g);return m?(+m[0]+ +m[1]+ +m[2])/3<128:false};
const hexOf=c=>{const m=c.match(/[\d.]+/g);return m?'#'+m.slice(0,3).map(x=>(+x).toString(16).padStart(2,'0')).join('').toUpperCase():'#808080'};
const defCol=()=>{const dk=isDark(),u=['#5B9CF6',1],d=[dk?'#D1D4DC':'#5C5F66',1];return{v:4,prev:false,body:{on:true,up:[...u],dn:[...d]},border:{on:true,up:[...u],dn:[...d]},wick:{on:true,up:[...u],dn:[...d]}}};
const PRESETS=[['기본(파랑·회색)',null],['초록·빨강 채움',['GREENRED']],['민트·화이트',['#81D8D0','#FFFFFF']],['초록·빨강',['#26A69A','#EF5350']],['빨강·파랑',['#E8384F','#2F6BFF']],['흑백',['#9E9E9E','#424242']]];
const getCol=()=>{try{const s=JSON.parse(localStorage.getItem('odc-col'));if(s&&s.body&&s.v===4)return s}catch(e){}return defCol()};
const setCol=s=>{s.v=4;localStorage.setItem('odc-col',JSON.stringify(s));window.dispatchEvent(new Event('odc-col'))};
const rgba=([hx,a])=>{const n=parseInt(hx.slice(1),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};
const PAL=(()=>{const g=['#FFFFFF','#EBEBEB','#D6D6D6','#BDBDBD','#9E9E9E','#808080','#616161','#424242','#262626','#000000'];
  const hues=[[354,82],[33,100],[52,95],[122,39],[174,100],[187,100],[221,100],[262,52],[291,64],[340,82]];
  const lv=[56,88,80,70,62,50,40,30];
  const hsl=(h,s,l)=>{s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return'#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('').toUpperCase()};
  return[g,...lv.map(l=>hues.map(([hh,s])=>hsl(hh,s,l)))].flat()})();
function colorPop(anchor,box,val,onChange){
  box.querySelector('.odc-pop')?.remove();
  const p=document.createElement('div');p.className='odc-pop';
  const draw=()=>{p.innerHTML=`<div class="g">${PAL.map(c=>`<button type="button" data-c="${c}" style="background:${c}" aria-label="${c}" aria-pressed="${c===val[0]}"></button>`).join('')}</div>
    <div class="cu"><label title="직접 고르기">+<input type="color" value="${val[0].toLowerCase()}"></label><span class="now" style="background:${rgba(val)}"></span><input type="text" value="${val[0]}" maxlength="7" spellcheck="false" aria-label="색 코드"></div>
    <div class="al"><span>진하기</span><input type="range" min="0" max="100" value="${Math.round(val[1]*100)}" aria-label="진하기"><b>${Math.round(val[1]*100)}%</b></div>`};
  draw();
  const set=(v,redraw=true)=>{val=v;onChange(v);if(redraw)draw();else{p.querySelector('.now').style.background=rgba(v);p.querySelector('.al b').textContent=Math.round(v[1]*100)+'%'}};
  p.addEventListener('click',e=>{const b=e.target.closest('button[data-c]');if(b)set([b.dataset.c,val[1]])});
  p.addEventListener('input',e=>{const t=e.target;
    if(t.type==='range')set([val[0],t.value/100],false);
    else if(t.type==='color')set([t.value.toUpperCase(),val[1]],false),p.querySelector('input[type=text]').value=t.value.toUpperCase(),p.querySelector('.now').style.background=rgba(val);
    else if(t.type==='text'&&/^#[0-9a-f]{6}$/i.test(t.value))set([t.value.toUpperCase(),val[1]],false)});
  box.appendChild(p);
  const r=anchor.getBoundingClientRect(),br=box.getBoundingClientRect();
  p.style.top=(r.bottom-br.top+6)+'px';p.style.left=Math.max(0,Math.min(r.right-br.left-248,br.width-250))+'px';
  const off=e=>{if(!p.contains(e.target)&&e.target!==anchor&&!anchor.contains(e.target)){p.remove();document.removeEventListener('pointerdown',off,true)}};
  setTimeout(()=>document.addEventListener('pointerdown',off,true));
}
function colorPanel(box){
  const orig=JSON.stringify(getCol());let s=JSON.parse(orig);
  const rows=[['body','몸통'],['border','테두리'],['wick','심지']];
  const sw=(k,d)=>`<button type="button" class="odc-sw" data-k="${k}" data-d="${d}" aria-label="${d==='up'?'상승':'하락'} 색"><i style="background:${rgba(s[k][d])}"></i></button>`;
  const draw=()=>{box.innerHTML=`<h3>캔들 색</h3>
    <div class="r"><b>이전 종가 기준 색</b><input type="checkbox" data-prev ${s.prev?'checked':''}></div>
    <p class="d">켜면 봉 색을 그 봉 시가가 아니라 바로 앞 봉 종가와 비교해서 정해요. 앞 봉 종가보다 높게 끝나면 상승 색이에요.</p>
    ${rows.map(([k,l])=>`<div class="r"><b>${l} · 상승 · 하락</b><input type="checkbox" data-on="${k}" ${s[k].on?'checked':''} aria-label="${l} 보이기">${sw(k,'up')}${sw(k,'dn')}</div>`).join('')}
    <div class="pre"><b style="font-weight:500;align-self:center;margin-right:6px">색 바로 고르기</b>${PRESETS.map(([n],i)=>`<button type="button" data-p="${i}">${n}</button>`).join('')}</div>
    <div class="ft"><button type="button" data-a="cancel">취소</button><button type="button" class="ok" data-a="ok">확인</button></div>`};
  const live=()=>{s.v=4;localStorage.setItem('odc-col',JSON.stringify(s));window.dispatchEvent(new Event('odc-col'))};
  draw();box.hidden=false;
  box.onchange=e=>{const t=e.target;if(t.dataset.prev!=null)s.prev=t.checked;else if(t.dataset.on)s[t.dataset.on].on=t.checked;live()};
  box.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.classList.contains('odc-sw')){const {k,d}=b.dataset;colorPop(b,box,s[k][d],v=>{s[k][d]=v;b.querySelector('i').style.background=rgba(v);live()});return}
    if(b.dataset.p!=null){const p=PRESETS[+b.dataset.p][1];if(!p){const d=defCol();d.prev=s.prev;s=d}else if(p[0]==='GREENRED'){const u=hexOf(cvar('--up')),d=hexOf(cvar('--dn'));for(const[k]of rows){s[k].on=true;s[k].up=[u,1];s[k].dn=[d,1]}}else for(const[k]of rows){s[k].on=true;s[k].up=[p[0],1];s[k].dn=[p[1],1]}draw();live();return}
    if(b.dataset.a==='cancel'){localStorage.setItem('odc-col',orig);window.dispatchEvent(new Event('odc-col'));box.hidden=true;box.innerHTML=''}
    if(b.dataset.a==='ok'){setCol(s);box.hidden=true;box.innerHTML=''}};
}

/* mount a chart into an element. returns {setSymbol, destroy} */
async function mountChart(host,base,opt={}){
  style();await loadLWC();
  host.innerHTML=`<div class="odc-tools" data-r="tools"></div><div class="odc-set" data-r="set" hidden></div><div class="odc-wrap" data-r="wrap"><canvas class="vp" data-r="vp"></canvas></div><div class="odc-info" data-r="info"></div><p class="odc-note">Bybit 무기한 선물 캔들 · 오른쪽 막대는 화면에 보이는 구간의 볼륨 프로파일 (진한 선 POC, 점선 VAH·VAL, 옅은 칸은 매물 공백 LVN). 차트를 움직이면 다시 계산돼요.</p>`;
  const $=r=>host.querySelector(`[data-r="${r}"]`);const wrap=$('wrap'),cv=$('vp');
  let tf=opt.tf||localStorage.getItem('odc-tf')||'60',sym=null,K=[],vp=null,lines=[];
  let ink=cvar('--ink'),mute=cvar('--mute'),line=cvar('--line');
  const chart=LightweightCharts.createChart(wrap,{autoSize:true,layout:{background:{type:'solid',color:'transparent'},textColor:mute,fontFamily:'JetBrains Mono, monospace',fontSize:11},
    grid:{vertLines:{color:alpha(line,.05)},horzLines:{color:alpha(line,.07)}},rightPriceScale:{borderColor:line,scaleMargins:{top:.08,bottom:.22}},timeScale:{borderColor:line,timeVisible:true,secondsVisible:false},crosshair:{mode:0},
    localization:{locale:'ko-KR'}});
  const cs=chart.addCandlestickSeries({});
  let COL=getCol();
  const applyCol=()=>{COL=getCol();const T='rgba(0,0,0,0)',c=COL;
    cs.applyOptions({upColor:c.body.on?rgba(c.body.up):T,downColor:c.body.on?rgba(c.body.dn):T,borderVisible:c.border.on,borderUpColor:rgba(c.border.up),borderDownColor:rgba(c.border.dn),wickVisible:c.wick.on,wickUpColor:rgba(c.wick.up),wickDownColor:rgba(c.wick.dn)})};
  applyCol();
  const vs=chart.addHistogramSeries({priceScaleId:'v',priceFormat:{type:'volume'},color:mute});
  chart.priceScale('v').applyOptions({scaleMargins:{top:.82,bottom:0}});
  wrap.insertBefore(cv,wrap.firstChild);
  const tools=$('tools');
  const renderTools=()=>{tools.innerHTML=TFS.map(([v,l])=>`<button type="button" data-tf="${v}" aria-pressed="${v===tf}">${l}</button>`).join('')+'<span class="sp"></span><button type="button" data-set>차트 설정</button>'+(opt.links!==false?`<a href="./watch.html#${encodeURIComponent(base)}">호가 감시 →</a><a href="./coin.html#${encodeURIComponent(base)}">코인 분석 →</a>`:'')};
  renderTools();
  tools.addEventListener('click',e=>{if(e.target.closest('button[data-set]')){const sb=$('set');if(sb.hidden)colorPanel(sb);else{sb.querySelector('[data-a=cancel]')?.click()}return}const b=e.target.closest('button[data-tf]');if(!b)return;tf=b.dataset.tf;localStorage.setItem('odc-tf',tf);renderTools();load()});
  function drawVP(){
    const W=wrap.clientWidth,H=wrap.clientHeight;const dpr=window.devicePixelRatio||1;cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';
    const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
    const r=chart.timeScale().getVisibleLogicalRange();if(!r||!K.length)return;
    const vis=K.slice(Math.max(0,Math.floor(r.from)),Math.min(K.length,Math.ceil(r.to)+1));if(vis.length<5)return;
    vp=volumeProfile(vis);
    const psw=chart.priceScale('right').width(),maxW=(W-psw)*.18,x1=W-psw-2,mx=Math.max(...vp.bins);
    for(let i=0;i<vp.nb;i++){const yA=cs.priceToCoordinate(vp.L+i*vp.st),yB=cs.priceToCoordinate(vp.L+(i+1)*vp.st);if(yA==null||yB==null)continue;
      const h=Math.max(1,Math.abs(yA-yB)-1),w=vp.bins[i]/mx*maxW;const inVA=i>=vp.lo&&i<=vp.hi;
      g.globalAlpha=i===vp.poc?.5:inVA?.26:.12;g.fillStyle=i===vp.poc?ink:mute;g.fillRect(x1-w,Math.min(yA,yB),w,h)}
    g.globalAlpha=1;
    for(const l of lines)cs.removePriceLine(l);lines=[
      cs.createPriceLine({price:vp.POC,color:alpha(ink,.45),lineWidth:1,lineStyle:0,axisLabelVisible:true,title:'POC'}),
      cs.createPriceLine({price:vp.VAH,color:alpha(mute,.4),lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'VAH'}),
      cs.createPriceLine({price:vp.VAL,color:alpha(mute,.4),lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'VAL'})];
    const last=K.at(-1).close,ib=Math.floor((last-vp.L)/vp.st),inL=vp.lvn.includes(ib);
    const f=n=>n>=1000?n.toLocaleString('en-US',{maximumFractionDigits:2}):n>=1?(+n.toFixed(4)).toString():n.toPrecision(4);
    $('info').innerHTML=`<span><i>현재가</i>${f(last)}</span><span><i>POC</i>${f(vp.POC)}</span><span><i>VAH</i>${f(vp.VAH)}</span><span><i>VAL</i>${f(vp.VAL)}</span><span><i>위치</i>${last>vp.VAH?'가치 영역 위':last<vp.VAL?'가치 영역 아래':'가치 영역 안'}${inL?' · 매물 공백(LVN) 안':''}</span>`;
  }
  let raf=0;const sched=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(drawVP)};
  chart.timeScale().subscribeVisibleLogicalRangeChange(sched);
  const ro=new ResizeObserver(sched);ro.observe(wrap);
  let mq;const watchDpr=()=>{mq=matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);mq.addEventListener('change',()=>{sched();watchDpr()},{once:true})};watchDpr();
  function paint(){if(!K.length)return;const c=COL;
    const isUp=(k,i)=>c.prev&&i>0?k.close>=K[i-1].close:k.close>=k.open;
    cs.setData(K.map((k,i)=>{const o={time:k.time,open:k.open,high:k.high,low:k.low,close:k.close};
      if(c.prev){const u=isUp(k,i)?'up':'dn';o.color=c.body.on?rgba(c.body[u]):'rgba(0,0,0,0)';o.borderColor=rgba(c.border[u]);o.wickColor=rgba(c.wick[u])}return o}));
    vs.setData(K.map((k,i)=>{const u=isUp(k,i)?'up':'dn';return{time:k.time,value:k.q,color:rgba([c.border[u][0],.4])}}));
  }
  const onCol=()=>{applyCol();paint()};window.addEventListener('odc-col',onCol);
  const onTheme=()=>{ink=cvar('--ink');mute=cvar('--mute');line=cvar('--line');const m=mute,l=line;chart.applyOptions({layout:{textColor:m},grid:{vertLines:{color:alpha(l,.05)},horzLines:{color:alpha(l,.07)}},rightPriceScale:{borderColor:l},timeScale:{borderColor:l}});onCol();sched()};window.addEventListener('od-theme',onTheme);
  async function resolve(){for(const s of [base+'USDT','1000'+base+'USDT','10000'+base+'USDT','1000000'+base+'USDT',base+'1000USDT']){try{const r=await j(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${s}&interval=60&limit=1`);if(r.result?.list?.length)return s}catch(e){}}return null}
  async function load(){
    $('info').textContent='불러오는 중…';
    if(!sym)sym=await resolve();if(!sym){$('info').textContent=`Bybit 무기한 선물에 ${base}가 없어요.`;return}
    const r=await j(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${sym}&interval=${tf}&limit=1000`);
    K=r.result.list.map(a=>({time:Math.floor(+a[0]/1000),open:+a[1],high:+a[2],low:+a[3],close:+a[4],q:+a[6]})).sort((a,b)=>a.time-b.time);
    paint();
    const n=K.length;chart.timeScale().setVisibleLogicalRange({from:Math.max(0,n-200),to:n+3});sched();
  }
  await load().catch(e=>{$('info').textContent='차트를 불러오지 못했어요: '+e.message});
  const timer=setInterval(()=>{if(!document.hidden)load().catch(()=>{})},60e3);
  /* 알림선 표시 + 차트 클릭 가격 전달 */
  let alines=[];
  const setAlerts=list=>{for(const l of alines)cs.removePriceLine(l);alines=(list||[]).map(a=>cs.createPriceLine({price:a.price,color:alpha(ink,.8),lineWidth:1,lineStyle:1,axisLabelVisible:true,title:'🔔 '+(a.dir==='above'?'↑':'↓')}))};
  if(opt.onClick)chart.subscribeClick(pr=>{if(!pr.point)return;const v=cs.coordinateToPrice(pr.point.y);if(v!=null&&isFinite(v))opt.onClick(v)});
  return{setAlerts,destroy(){window.removeEventListener('odc-col',onCol);window.removeEventListener('od-theme',onTheme);clearInterval(timer);ro.disconnect();chart.remove()},reload:load};
}

async function openChart(base,meta={}){
  style();
  const back=document.createElement('div');back.className='odc-back';
  back.innerHTML=`<div class="odc" role="dialog" aria-modal="true" aria-label="${esc(base)} 차트"><div class="odc-h"><h2><em>${esc(base)}</em><span class="k">${esc(meta.kind||'')}</span></h2><button class="odc-x" aria-label="닫기">✕</button></div><div data-r="body"></div></div>`;
  document.body.appendChild(back);document.body.style.overflow='hidden';
  let inst=null;
  const close=()=>{inst&&inst.destroy();back.remove();document.body.style.overflow='';document.removeEventListener('keydown',onKey)};
  const onKey=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKey);
  back.addEventListener('click',e=>{if(e.target===back||e.target.closest('.odc-x'))close()});
  back.querySelector('.odc-x').focus();
  try{inst=await mountChart(back.querySelector('[data-r="body"]'),base)}catch(e){back.querySelector('[data-r="body"]').innerHTML=`<p class="odc-note">${esc(e.message)}</p>`}
}


/* ---- 급등 준비 조건 (급등 준비·신호 검증이 같은 기준을 씀) ---- */
const SIG_DEF={on:[1,1,1,1,1],c24:3,oi:8,fr:0,cvd:'both',ratio:1.3,pos:40};
function sigP(){try{const v=JSON.parse(localStorage.getItem('od-sig')||'null');return v?{...SIG_DEF,...v,on:(v.on||SIG_DEF.on).slice(0,5)}:{...SIG_DEF,on:[...SIG_DEF.on]}}catch(e){return{...SIG_DEF,on:[...SIG_DEF.on]}}}
function sigSave(P){localStorage.setItem('od-sig',JSON.stringify(P))}
function sigCond(d,P){const C=[
  d.doi!=null&&d.c24!=null?(Math.abs(d.c24)<=P.c24&&d.doi>=P.oi):null,
  d.fr!=null?d.fr<P.fr:null,
  d.cvd!=null?(P.cvd==='24'?d.cvd>0:d.cvd>0&&d.cvd4>0):null,
  d.up!=null?(d.up>0&&d.up>=d.dn*P.ratio):null,
  d.pos!=null?d.pos<=P.pos/100:null].map((v,i)=>P.on[i]?v:null);
  return{C,hits:C.filter(x=>x===true).length,max:P.on.filter(Boolean).length}}
function sigText(P){const sg=v=>(v>=0?'+':'')+v;return[
  `가격은 24시간 ±${P.c24}% 안, 미결제약정은 ${sg(P.oi)}% 이상 변화`,
  `펀딩비 ${P.fr}% 미만`,
  P.cvd==='24'?'24시간 CVD가 플러스':'24시간 CVD와 최근 4시간 CVD가 모두 플러스',
  `현재가 위 +8% 안의 숏 청산 추정 물량이 아래 롱 청산보다 ${P.ratio}배 이상`,
  `48시간 고저 범위의 아래쪽 ${P.pos}% 안에 가격이 있음`]}
/* ---- 가격 알림선: 이 기기 저장 + (설정했으면) 알림 워커로 올림 ---- */
function workerCfg(){try{const w=JSON.parse(localStorage.getItem('od-worker')||'null');return w&&w.url&&w.key?w:null}catch(e){return null}}
async function workerPut(path,body){const w=workerCfg();if(!w)return{skipped:true};const r=await fetch(w.url.replace(/\/$/,'')+path,{method:'POST',headers:{'content-type':'application/json','x-key':w.key},body:JSON.stringify(body)});const o=await r.json().catch(()=>({}));if(!r.ok)throw new Error(o.error||('HTTP '+r.status));return o}
function getLines(){try{return JSON.parse(localStorage.getItem('od-lines')||'[]')}catch(e){return[]}}
async function setLines(L){localStorage.setItem('od-lines',JSON.stringify(L));window.dispatchEvent(new Event('od-lines'));try{return await workerPut('/lines',L)}catch(e){toast('폰 알림 워커에 못 올렸어요',e.message);return{error:e.message}}}
async function checkLinesHere(){const L=getLines();if(!L.length)return;try{const t=await j('https://api.bybit.com/v5/market/tickers?category=linear');const px={};for(const x of t.result.list){if(!x.symbol.endsWith('USDT'))continue;const b=x.symbol.replace(/USDT$/,'').replace(/^(1000000|10000|1000)|(1000000|10000|1000)$/g,'');if(px[b]==null)px[b]=+x.lastPrice}
  const keep=[];for(const l of L){const p=px[l.sym];if(p!=null&&(l.dir==='above'?p>=l.price:p<=l.price))notify(`${l.sym} ${l.dir==='above'?'상향 돌파':'하향 이탈'} ${l.price}`,`지금 ${p}${l.note?' · '+l.note:''}`,{side:l.dir==='above'?'B':'S',href:'./view.html#'+l.sym});else keep.push(l)}
  if(keep.length!==L.length)setLines(keep)}catch(e){}}
setInterval(()=>{if(!document.hidden)checkLinesHere()},60e3);setTimeout(checkLinesHere,5000);
setTimeout(()=>{try{const t=+localStorage.getItem('od-siglog-t')||0;if(Date.now()-t>3600e3){localStorage.setItem('od-siglog-t',Date.now());sigLogFill().catch(()=>{})}}catch(e){}},9000);
/* ---- 지금과 같은 청산 추정 모델 ---- */
const LEV=[[10,.25],[20,.25],[25,.2],[50,.2],[100,.1]],MMR=.005;
function clusters(st,cs,price){const n=cs.length,smn=new Float64Array(n+1).fill(Infinity),smx=new Float64Array(n+1).fill(-Infinity);
  for(let k=n-1;k>=0;k--){smn[k]=Math.min(smn[k+1],cs[k].l);smx[k]=Math.max(smx[k+1],cs[k].h)}
  let up=0,dn=0,ci=0;for(let i=1;i<st.length;i++){const a=st[i],d=a.oiu-st[i-1].oiu;if(d<=0)continue;const p=a.mp;if(!p)continue;
    while(ci<n&&cs[ci].t<a.time)ci++;const mn=smn[ci],mx=smx[ci],ls=a.lsr/(1+a.lsr);
    for(const [lev,w] of LEV){const lp=p*(1-1/lev+MMR),sp=p*(1+1/lev-MMR);
      if(!(mn<=lp)&&lp>=price*.92&&lp<price)dn+=d*ls*w;if(!(mx>=sp)&&sp<=price*1.08&&sp>price)up+=d*(1-ls)*w}}
  return{up,dn}}

/* ---- 코인 하나: 매시 조건 계산 ---- */
function btSeries(c,mult){const H=3600e3;const K=c.k;if(K.length<60)return null;const n=K.length;
  const oiAt=(()=>{let p=0;return T=>{while(p+1<c.oi.length&&c.oi[p+1][0]<=T)p++;return c.oi[p]&&c.oi[p][0]<=T?c.oi[p][1]:null}})();
  const oiAt2=(()=>{let p=0;return T=>{while(p+1<c.oi.length&&c.oi[p+1][0]<=T)p++;return c.oi[p]&&c.oi[p][0]<=T?c.oi[p][1]:null}})();
  let fp=0,sp=0,cp=0;const S=[];
  for(let i=0;i<n;i++){const T=K[i][0]+H,price=K[i][4];const r={T,price,hi:K[i][2],lo:K[i][3]};S.push(r);if(i<48)continue;
    r.c24=(price/K[i-24][4]-1)*100;const o=oiAt(T),o0=oiAt2(T-24*H);r.doi=o&&o0?(o/o0-1)*100:null;
    while(fp+1<c.fr.length&&c.fr[fp+1][0]<=T)fp++;r.fr=c.fr[fp]&&c.fr[fp][0]<=T?c.fr[fp][1]:null;
    if(c.st&&c.st.length){while(sp<c.st.length&&c.st[sp].time*1000+H<=T)sp++;/* Gate 행은 그 시각부터 1시간 구간: 끝난 구간만 */
      if(sp>=24){let s24=0,s4=0;for(let q=sp-24;q<sp;q++){const a=c.st[q],v=(a.lt-a.stk)*mult*a.mp;s24+=v;if(q>=sp-4)s4+=v}r.cvd=s24;r.cvd4=s4}
      if(sp>=168){let s7=0,vol=0;for(let q=sp-168;q<sp;q++){const a=c.st[q];s7+=(a.lt-a.stk)*mult*a.mp;vol+=(a.lt+a.stk)*mult*a.mp}r.cvd7=s7;r.cvdr7=vol?s7/vol:null}
      while(cp<c.cs.length&&c.cs[cp].t*1000<T)cp++;
      if(cp>=48&&sp>=48){const cs=c.cs.slice(cp-48,cp),st=c.st.slice(sp-48,sp);const pg=price/(c.scale||1),k=clusters(st,cs,pg);r.up=k.up;r.dn=k.dn;
        let Hh=-Infinity,Ll=Infinity;for(const x of cs){if(x.h>Hh)Hh=x.h;if(x.l<Ll)Ll=x.l}r.pos=Hh>Ll?(pg-Ll)/(Hh-Ll):null}}
    }
  /* 세력 흔적 지표 (1시간 봉 거래대금·미결제약정 기반) */
  const tv=K.map(k=>k[5]||0),cum=[0];for(const v of tv)cum.push(cum.at(-1)+v);const t24=i=>cum[i+1]-cum[i-23];
  const rg=i=>{let h=-Infinity,l=Infinity;for(let q=i-23;q<=i;q++){if(K[q][2]>h)h=K[q][2];if(K[q][3]<l)l=K[q][3]}return(h-l)/K[i][4]};
  const oiAt4=(()=>{let p=0;return T=>{while(p+1<c.oi.length&&c.oi[p+1][0]<=T)p++;return c.oi[p]&&c.oi[p][0]<=T?c.oi[p][1]:null}})();
  const oiAt3=(()=>{let p=0;return T=>{while(p+1<c.oi.length&&c.oi[p+1][0]<=T)p++;return c.oi[p]&&c.oi[p][0]<=T?c.oi[p][1]:null}})();
  for(let i=192;i<n;i++){const r=S[i],T=r.T,now=t24(i);let prev=0;for(let d=1;d<=7;d++)prev+=t24(i-24*d);prev/=7;r.vs=prev?now/prev:null;
    let rs=0;for(let d=1;d<=7;d++)rs+=rg(i-24*d);rs/=7;r.sq=rs?rg(i)/rs:null;
    const o=oiAt3(T-168*H);r.c7=(r.price/K[i-168][4]-1)*100;const on=oiAt4(T);r.doi7=o&&on?(on/o-1)*100:null;
    }
  {let p=0;for(let i=24;i<n;i++){const T=S[i].T;while(p+1<c.oi.length&&c.oi[p+1][0]<=T)p++;const o=c.oi[p]&&c.oi[p][0]<=T?c.oi[p][1]:null;const t=t24(i);S[i].oit=o&&t?o*S[i].price/t:null}}
  return S}

/* ---- 세력 흔적 조건 (신호 검증 '조합 찾기'·세력 의심 화면이 같이 씀) ---- */
const PUMP=[['⑥ 거래대금 급증','24시간 거래대금이 지난 7일 하루 평균의 2배 이상',r=>r.vs!=null?r.vs>=2:null],
  ['⑦ 변동성 압축','24시간 고저폭이 지난 7일 평균의 60% 이하',r=>r.sq!=null?r.sq<=.6:null],
  ['⑧ 레버리지 쏠림','미결제약정(달러)이 24시간 거래대금의 1.5배 이상',r=>r.oit!=null?r.oit>=1.5:null],
  ['⑨ 조용한 매집','7일 가격 ±8% 안, 미결제약정 7일 +25% 이상',r=>r.doi7!=null&&r.c7!=null?(Math.abs(r.c7)<=8&&r.doi7>=25):null],
  ['⑩ 펀딩 극단 음수','펀딩비 −0.02% 이하',r=>r.fr!=null?r.fr<=-0.02:null],
  ['⑪ CVD 매집','7일 가격은 +2% 이하인데, 7일 CVD가 그 기간 체결량의 +3% 이상 매수 우위 (조용히 사 모으는 다이버전스)',r=>r.cvdr7!=null&&r.c7!=null?(r.c7<=2&&r.cvdr7>=.03):null]];
const ALLN=['① 포지션 누적','② 펀딩 음수','③ 체결 매수 우위','④ 상단 숏 클러스터','⑤ 바닥권',...PUMP.map(x=>x[0])];
/* 10개 조건을 비트로: 참이면 1. 데이터 없으면 0 */
function allMask(r,P){if(r.c24==null)return 0;const g=sigCond(r,{...P,on:[1,1,1,1,1]});let m=0;g.C.forEach((v,i)=>{if(v===true)m|=1<<i});PUMP.forEach((x,i)=>{if(x[2](r)===true)m|=1<<(5+i)});return m}

/* 심볼 배율: 1000PEPEUSDT(앞) · SHIB1000USDT(뒤, 바이비트) → 1000. 바이낸스는 항상 앞에 붙임(1000SHIBUSDT) */
const symScale=s=>{const m=String(s).match(/^(1000000|10000|1000)(?=[A-Z])|(1000000|10000|1000)USDT$/);return m?+(m[1]||m[2]):1};
const symBase=s=>String(s).replace(/USDT$/,'').replace(/^(1000000|10000|1000)|(1000000|10000|1000)$/g,'');
const BIN_ALIAS={PUMPFUNUSDT:'PUMPUSDT'};/* 이름이 다른 코인 */
const binSym=s=>{if(BIN_ALIAS[s])return BIN_ALIAS[s];const k=symScale(s);return k>1?k+symBase(s)+'USDT':String(s)};
/* 시간별 체결·미결제약정 묶음: 바이낸스 선물 1시간 봉(시장가 매수·매도) + 바이비트 미결제약정·롱숏 계정 비율.
   바이낸스 선물에 없는 코인만 Gate.io로 대체. 행 모양은 Gate contract_stats와 같게 맞춤(time=구간 시작 초, 크기는 코인 개수, 가격은 코인 1개 기준) */
let BYQ2=0;const byPace=async()=>{const t=Math.max(Date.now(),BYQ2);BYQ2=t+160;const w=t-Date.now();if(w>0)await new Promise(r=>setTimeout(r,w))};
async function fjson(u){for(let n=0;;n++){let r;try{if(u.includes('api.bybit.com'))await byPace();r=await fetch(u)}catch(e){if(n<3){await new Promise(x=>setTimeout(x,1500*2**n));continue}throw new Error('요청 제한')}
  if((r.status===429||r.status>=500)&&n<3){await new Promise(x=>setTimeout(x,1500*(n+1)));continue}if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;throw e}return r.json()}}
const GQM={};let GQP=null;const gateMult=async g=>{if(!GQP)GQP=fjson('https://api.gateio.ws/api/v4/futures/usdt/contracts').then(cs=>{for(const c of cs)GQM[c.name]=+c.quanto_multiplier||1}).catch(()=>{GQP=null});await GQP;return GQM[g]};
/* 같은 탭 안 페이지끼리 공유하는 캐시(sessionStorage) + 이 페이지 메모리. 지난 봉은 안 바뀌니 새 시간분만 더 받음 */
const MEMC=new Map();
const cGet=k=>{if(MEMC.has(k))return MEMC.get(k);try{const v=JSON.parse(sessionStorage.getItem('odc:'+k)||'null');if(v)MEMC.set(k,v);return v}catch(e){return null}};
const cPut=(k,v)=>{MEMC.set(k,v);try{sessionStorage.setItem('odc:'+k,JSON.stringify(v))}catch(e){try{for(const x of Object.keys(sessionStorage))if(x.startsWith('odc:'))sessionStorage.removeItem(x);sessionStorage.setItem('odc:'+k,JSON.stringify(v))}catch(e2){}}};
async function memo(k,ttl,fn){const c=cGet(k);if(c&&Date.now()-c.at<ttl)return c.v;const v=await fn();cPut(k,{at:Date.now(),v});return v}
async function flowRaw(sym,lo,to,prev,oiGiven){const H=3600e3,bs=binSym(sym);
  const K=prev?prev.K.filter(k=>k[0]<lo):[];for(let s=lo;s<to;){const r=await fjson(`https://fapi.binance.com/fapi/v1/klines?symbol=${bs}&interval=1h&startTime=${s}&endTime=${to}&limit=1500`);if(!r.length)break;for(const k of r)K.push([k[0],+k[1],+k[2],+k[3],+k[4],+k[7],+k[10]]);const nx=r.at(-1)[0]+H;if(r.length<1500||nx<=s)break;s=nx}
  if(K.length<2)throw new Error('바이낸스 없음');
  const OI=new Map(prev?prev.OI:[]),LR=new Map(prev?prev.LR:[]),OB=new Map(prev?prev.OB||[]:[]);if(oiGiven)for(const [t,v] of oiGiven)OI.set(+t,+v);
  const page=async(url,lim,put)=>{for(let e=to;;){const d=await fjson(url+`&startTime=${lo}&endTime=${Math.floor(e)}&limit=${lim}`);const l=d.result?.list||[];if(!l.length)break;let mn=Infinity;for(const x of l){put(x);mn=Math.min(mn,+x.timestamp)}if(l.length<lim||mn<=lo)break;e=mn-1}};
  await Promise.all([oiGiven?0:page(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${sym}&intervalTime=1h`,200,x=>OI.set(+x.timestamp,+x.openInterest)).catch(()=>{}),
    page(`https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${sym}&period=1h`,500,x=>LR.set(+x.timestamp,+x.sellRatio?+x.buyRatio/+x.sellRatio:1)).catch(()=>{}),
    /* 바이낸스 미결제약정(달러)도 더함. 바이낸스는 최근 30일까지만 줘서 짧은 기간에만 */
    !oiGiven&&to-lo<=29*24*H?fjson(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${bs}&period=1h&startTime=${lo}&limit=500`).then(r=>{if(Array.isArray(r))for(const x of r)OB.set(+x.timestamp,+x.sumOpenInterestValue)}).catch(()=>{}):0]);
  return{K,OI:[...OI.entries()],LR:[...LR.entries()],OB:[...OB.entries()]}}
function flowRows(raw,from,scale){const H=3600e3,OI=new Map(raw.OI),LR=new Map(raw.LR),OB=new Map(raw.OB||[]);let po=null,pl=1,pb=null;const st=[],cs=[];
  /* 바이낸스 값이 기간 처음부터 있을 때만 합산(중간에 생기면 가짜 증가로 보임) */const t0=raw.K.find(k=>k[0]>=from)?.[0],useB=OB.size>0&&t0!=null&&[...OB.keys()].some(t=>t<=t0+H);
  for(const k of raw.K){const [t,o,h,l,c,qv,tbq]=k,mp=c/scale;const oi=OI.get(t+H)??OI.get(t)??po;if(oi!=null)po=oi;const lr=LR.get(t+H)??LR.get(t)??pl;pl=lr;const ob=useB?(OB.get(t+H)??OB.get(t)??pb):null;if(ob!=null)pb=ob;if(t<from)continue;
    /* 크기 × 가격 = 실제 체결 금액이 되도록 금액 ÷ 종가로 둠 */
    st.push({time:t/1000,open_interest_usd:(po!=null?po*c:0)+(useB&&pb!=null?pb:0),lsr_account:lr,mark_price:mp,long_taker_size:mp?tbq/mp:0,short_taker_size:mp?(qv-tbq)/mp:0,buy_usd:tbq,sell_usd:qv-tbq});cs.push({t:t/1000,o:o/scale,h:h/scale,l:l/scale,c:mp})}
  const oi=raw.OI.filter(x=>x[0]>=from-H).sort((a,b)=>a[0]-b[0]);return{st,cs,oi,mult:1,src:'binance',oiN:raw.OI.length,lrN:raw.LR.length,obN:useB?OB.size:0}}
async function flowStats(o){const H=3600e3,{sym,scale=1}=o,base=o.base||symBase(sym);const to=o.to||Date.now(),from=Math.floor((o.from||to-(o.hours||48)*H)/H)*H;
  try{
    if(o.from){/* 긴 기간(신호 검증)은 캐시 없이: 바깥에서 따로 저장 */const raw=await flowRaw(sym,from,to,null,Array.isArray(o.oi)?o.oi:null);return flowRows(raw,from,scale)}
    const key='fs:'+sym,c=cGet(key),now=Date.now();let raw;
    if(c&&c.from<=from&&now-c.at<60e3)raw=c.raw;
    else if(c&&c.from<=from&&now-c.at<6*H){const last=c.raw.K.at(-1)[0];raw=await flowRaw(sym,last-2*H,to,c.raw);raw.K=raw.K.filter(k=>k[0]>=c.from);cPut(key,{at:now,from:c.from,raw})}
    else{raw=await flowRaw(sym,from,to,null);cPut(key,{at:now,from,raw})}
    return flowRows(raw,from,scale)}
  catch(e){if(o.noGate)throw e;const g=base+'_USDT',m=await gateMult(g);if(m==null)throw new Error('바이낸스·Gate 모두 없음');const lim=Math.min(1000,Math.ceil((to-from)/H)+1);
    const [st,cs]=await Promise.all([fjson(`https://api.gateio.ws/api/v4/futures/usdt/contract_stats?contract=${g}&interval=1h&limit=${lim}`),fjson(`https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=${g}&interval=1h&limit=${lim}`)]);
    return{st,cs:cs.map(x=>({t:+x.t,o:+x.o,h:+x.h,l:+x.l,c:+x.c})),oi:null,mult:m,src:'gate'}}}
/* 청산 기록: OKX 공개 API가 최근 약 24시간 청산 주문을 줌(바이낸스·바이비트는 실시간 웹소켓만). 시간별로 묶어 돌려줌 */
let OKQ=0;const okPace=async()=>{const t=Math.max(Date.now(),OKQ);OKQ=t+120;const w=t-Date.now();if(w>0)await new Promise(r=>setTimeout(r,w))};
const okxCt=()=>memo('okx-ct',3600e3,async()=>{const d=await fjson('https://www.okx.com/api/v5/public/instruments?instType=SWAP');const m={};for(const i of d.data||[])if(i.settleCcy==='USDT'&&i.ctType==='linear')m[i.instFamily]=+i.ctVal;return m});
async function okxLiq(base,hours=24,maxCalls=8){return memo('okl:'+base+':'+hours,5*60e3,async()=>{const fam=symBase(base)+'-USDT',ct=(await okxCt())[fam];if(!ct)return null;
  const H=3600e3,now=Date.now(),lo=now-hours*H,B=new Map();let after=null,oldest=now,calls=0,full=false;
  for(;calls<maxCalls;calls++){await okPace();const d=await fjson(`https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&state=filled&instFamily=${fam}&limit=100${after?'&after='+after:''}`);
    const det=(d.data||[]).flatMap(x=>x.details||[]);if(!det.length){full=true;break}let mn=Infinity;
    for(const x of det){const t=+x.ts;mn=Math.min(mn,t);if(t<lo)continue;const h=Math.floor(t/H)*H,u=+x.sz*ct*+x.bkPx,b=B.get(h)||{t:h,L:0,S:0};if(x.posSide==='short')b.S+=u;else b.L+=u;B.set(h,b)}
    oldest=mn;after=mn;if(mn<lo){full=true;break}}
  const from=Math.max(lo,oldest);return{rows:[...B.values()].sort((a,b)=>a.t-b.t),from,to:now,hours:(now-from)/H,full}})}
/* 실전 기록: 사이트에 뜬 신호를 그때 가격과 함께 저장하고, 1·3·7일 뒤 결과를 Bybit 1시간 봉으로 채움 */
const SLK='od-siglog';const slGet=()=>{try{return JSON.parse(localStorage.getItem(SLK)||'[]')}catch(e){return[]}};const slSet=L=>{try{localStorage.setItem(SLK,JSON.stringify(L.slice(-600)))}catch(e){}};
function sigLogAdd(e){/* e: {kind, base, sym, p, why, dir?, tp?, sl?} 같은 종류·코인은 24시간에 한 번만 */const L=slGet(),now=Date.now();
  if(L.some(x=>x.kind===e.kind&&x.base===e.base&&now-x.at<24*3600e3))return false;L.push({...e,at:now,id:now.toString(36)+Math.random().toString(36).slice(2,6)});slSet(L);return true}
async function sigLogFill(max=12){const L=slGet(),now=Date.now(),H=3600e3,D=24*H;let n=0;
  for(const e of L){if(e.done||now-e.at<D||n>=max)continue;const need=[1,3,7].filter(d=>now-e.at>=d*D&&e['r'+d]==null);if(!need.length&&!(now-e.at>=7*D&&e.hi==null))continue;n++;
    try{const st=Math.floor(e.at/H)*H,en=Math.min(now,st+7*D+H);const r=await fjson(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${e.sym}&interval=60&start=${st}&end=${en}&limit=200`);
      const K=(r.result?.list||[]).map(a=>[+a[0],+a[2],+a[3],+a[4]]).sort((a,b)=>a[0]-b[0]);if(!K.length)continue;
      for(const d of [1,3,7]){if(now-e.at<d*D)continue;const k=K.find(x=>x[0]>=st+d*D-H)||null;if(k)e['r'+d]=(k[3]/e.p-1)*100}
      const W=K.filter(x=>x[0]<=st+7*D);let hi=-Infinity,lo=Infinity,fu=null,fd=null;for(const x of W){if(x[1]>hi)hi=x[1];if(x[2]<lo)lo=x[2];if(fu==null&&x[1]>=e.p*1.1)fu=x[0];if(fd==null&&x[2]<=e.p*.9)fd=x[0]}
      e.mu=(hi/e.p-1)*100;e.md=(lo/e.p-1)*100;e.first10=fu&&(!fd||fu<fd)?'up':fd&&(!fu||fd<fu)?'dn':null;
      if(e.dir&&e.tp){const L1=e.dir==='L',tpP=e.p*(1+(L1?e.tp:-e.tp)/100),slP=e.p*(1+(L1?-e.sl:e.sl)/100);let res=null;for(const x of W){const hs=L1?x[2]<=slP:x[1]>=slP,ht=L1?x[1]>=tpP:x[2]<=tpP;if(hs){res=-e.sl;break}if(ht){res=e.tp;break}}e.res=res}
      if(now-e.at>=7*D+H){e.hi=hi;e.done=true}}catch(err){}}
  if(n)slSet(L);return L}
const SRCN={binance:'바이낸스 선물 체결 + 바이비트 미결제약정·계정 비율',gate:'Gate.io (바이낸스 선물에 없는 코인)'};
/* 평단 나눠 보기: 바이낸스 선물 공개 통계 + 체결 샘플. 모두 추정치 */
async function bget(u){for(let n=0;n<3;n++){try{const r=await fetch(u);if(r.ok)return r.json();if(r.status===400)return null}catch(e){}await new Promise(r=>setTimeout(r,1500*(n+1)))}return null}
async function costBasis(sym,scale=1){return memo('cb:'+sym+':'+scale,10*60e3,()=>costBasis0(sym,scale))}
async function costBasis0(sym,scale=1){sym=binSym(sym);const F='https://fapi.binance.com/futures/data/',q=`?symbol=${sym}&period=1h&limit=168`;
  const [oi,tp,ga,tk]=await Promise.all(['openInterestHist','topLongShortPositionRatio','globalLongShortAccountRatio','takerlongshortRatio'].map(e=>bget(F+e+q)));
  if(!Array.isArray(oi)||oi.length<24)return null;
  const px=new Map(oi.map(a=>[+a.timestamp,{q:+a.sumOpenInterest,p:+a.sumOpenInterestValue/+a.sumOpenInterest}]));
  /* 비율(롱 쪽 비중)이 '보유 물량'일 때: 롱·숏 물량 = 미결제약정 × 비중. 7일 동안 물량이 늘어난 시간마다 그 시간 가격으로 가중평균 (새로 들어온 물량의 평균가) */
  const stock=R=>{if(!Array.isArray(R)||R.length<24)return null;const A=[0,0],B=[0,0];let pv=null,f0=null;
    for(const a of R.slice().sort((x,y)=>x.timestamp-y.timestamp)){const o=px.get(+a.timestamp);if(!o||!o.p)continue;const l=o.q*+a.longAccount,s=o.q*+a.shortAccount;
      if(pv){const dl=l-pv.l,ds=s-pv.s;if(dl>0){A[0]+=dl*o.p;A[1]+=dl}if(ds>0){B[0]+=ds*o.p;B[1]+=ds}}else f0={l,s};pv={l,s,r:+a.longAccount}}
    return pv?{L:A[1]?A[0]/A[1]/scale:null,S:B[1]?B[0]/B[1]/scale:null,Lch:f0.l?(pv.l/f0.l-1)*100:null,Sch:f0.s?(pv.s/f0.s-1)*100:null,lr:pv.r}:null};
  /* 시장가 체결 비율은 '흐름'이라, 미결제약정이 늘어난 시간에만 매수 비중만큼 롱·나머지 숏으로 나눔 */
  const flow=R=>{if(!Array.isArray(R)||R.length<24)return null;const m=new Map(R.map(a=>[+a.timestamp,+a.buyVol/((+a.buyVol)+(+a.sellVol)||1)]));let L=0,Lw=0,S=0,Sw=0,pq=null;
    for(const [t,o] of [...px.entries()].sort((x,y)=>x[0]-y[0])){if(pq!=null){const d=o.q-pq,sh=m.get(t);if(d>0&&sh!=null){L+=d*sh*o.p;Lw+=d*sh;S+=d*(1-sh)*o.p;Sw+=d*(1-sh)}}pq=o.q}
    return{L:Lw?L/Lw/scale:null,S:Sw?S/Sw/scale:null,lr:Lw+Sw?Lw/(Lw+Sw):null}};
  const last=oi.at(-1);return{big:stock(tp),acct:stock(ga),all:flow(tk),oiUsd:+last.sumOpenInterestValue,from:+oi[0].timestamp,to:+last.timestamp}}
/* 체결 크기별 평단: 현물은 7일, 선물은 최근 47시간(바이낸스 선물 체결 조회가 2일까지만 됨)을 win개 구간으로 나눠 구간 시작부터 체결 1000건씩 샘플 → 큰 체결(≥big$)·작은 체결(<small$)의 시장가 매수/매도 평균가 */
async function sizeBasis(sym,spot,scale=1,win=28,big=5e4,small=1e3,prog){sym=binSym(sym);const H=3600e3,now=Date.now(),out={};let done=0;
  for(const [k,base,sc,span] of [['fut',`https://fapi.binance.com/fapi/v1/aggTrades?symbol=${sym}`,scale,47],['spot',spot?`https://api.binance.com/api/v3/aggTrades?symbol=${spot}`:null,1,168]]){
    if(!base){out[k]=null;done+=win;continue}const acc={bB:[0,0,0],bS:[0,0,0],sB:[0,0,0],sS:[0,0,0],tot:0,n:0,ok:0};
    const ts=Array.from({length:win},(_,i)=>now-(i+1)*(span/win)*H);let i=0,dead=false;
    await Promise.all([0,1,2].map(async()=>{while(i<ts.length&&!dead){const t=Math.floor(ts[i++]);const d=await bget(`${base}&startTime=${t}&endTime=${t+H-1}&limit=1000`);done++;prog&&prog(done,win*2);
      if(d===null&&acc.ok===0&&i>=3){dead=true;break}if(!Array.isArray(d))continue;acc.ok++;
      for(const x of d){const p=+x.p/sc,v=+x.p*+x.q;if(!p||!v)continue;acc.tot+=v;acc.n++;const buy=!x.m,b=v>=big?(buy?acc.bB:acc.bS):v<small?(buy?acc.sB:acc.sS):null;if(b){b[0]+=v;b[1]+=v/p;b[2]++}}}}));
    const f=a=>a[2]?{p:a[0]/a[1],v:a[0],n:a[2]}:null;out[k]=acc.ok?{bB:f(acc.bB),bS:f(acc.bS),sB:f(acc.sB),sS:f(acc.sS),tot:acc.tot,n:acc.n,ok:acc.ok,win,span}:null}
  return out}
window.OD={sigLog:{add:sigLogAdd,get:slGet,fill:sigLogFill,set:slSet},okxLiq,memo,symScale,symBase,binSym,byPace,flowStats,fjson,SRCN,costBasis,sizeBasis,btSeries,allMask,ALLN,PUMP,getLines,setLines,workerCfg,workerPut,sigP,sigSave,sigCond,sigText,SIG_DEF,coinIcon,setIcon,picker,toast,notify,favs,isFav,toggleFav,coinLinks,setTheme,loadTypes,kindOf,KINDS,openChart,mountChart,volumeProfile};
})();
