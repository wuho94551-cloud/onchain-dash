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
const SKIP=/^(cg:|k-|uk-|od-alerts?$|od-alerts-seen$|kimp-names$|od-icons$)/;
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
const NAV=[['시장',[['./','급등 준비'],['./scan.html','스캐너'],['./kimp.html','김프'],['./bt.html','신호 검증']]],
  ['코인',[['./fav.html','★ 관심'],['./coin.html','코인 분석'],['./watch.html','호가 감시'],['./cvd.html','CVD']]],
  ['청산',[['./liq.html','실시간 청산'],['./liqmap.html','청산 압력']]],
  ['온체인',[['./unlock.html','언락'],['./wallet.html','지갑']]]];
function buildNav(){const nav=document.querySelector('nav.top');if(!nav||nav.dataset.built)return;nav.dataset.built=1;
  const f=(location.pathname.split('/').pop()||'index.html').toLowerCase(),here=f==='index.html'?'./':'./'+f;
  const gi=NAV.findIndex(g=>g[1].some(p=>p[0]===here));
  nav.innerHTML=`<div class="band"><a class="brand" href="./" aria-label="홈으로"><em>Onchain</em>Desk</a>`+
    NAV.map((g,i)=>`<a class="g" href="${g[1][0][0]}"${i===gi?' aria-current="true"':''}>${g[0]}</a>`).join('')+
    `<a class="g od-ph" href="./alert.html"${here==='./alert.html'?' aria-current="page"':''} title="사이트를 꺼도 텔레그램으로 알림">📱 폰 알림</a><span class="od-tools" id="od-tools"></span></div>`+
    (gi>=0?`<div class="od-sub">${NAV[gi][1].map(p=>`<a href="${p[0]}"${p[0]===here?' aria-current="page"':''}>${p[1]}</a>`).join('')}</div>`:'')}
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
  PKD=r.result.list.filter(x=>x.symbol.endsWith('USDT')&&kindOf(x.symbol)==='코인'&&+x.turnover24h>3e6).map(x=>{const b=x.symbol.replace(/USDT$/,'').replace(/^(1000000|10000|1000)/,'');const hi=+x.highPrice24h,lo=+x.lowPrice24h;
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
  async function resolve(){for(const s of [base+'USDT','1000'+base+'USDT','10000'+base+'USDT','1000000'+base+'USDT']){try{const r=await j(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${s}&interval=60&limit=1`);if(r.result?.list?.length)return s}catch(e){}}return null}
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
  return{destroy(){window.removeEventListener('odc-col',onCol);window.removeEventListener('od-theme',onTheme);clearInterval(timer);ro.disconnect();chart.remove()},reload:load};
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

window.OD={coinIcon,setIcon,picker,toast,notify,favs,isFav,toggleFav,coinLinks,setTheme,loadTypes,kindOf,KINDS,openChart,mountChart,volumeProfile};
})();
