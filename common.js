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
.odc-wrap{position:relative;height:min(62vh,560px)}
.odc-wrap canvas.vp{position:absolute;top:0;pointer-events:none}
.odc-info{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px;margin-top:8px;font-family:var(--mono)}
.odc-info span{white-space:nowrap}.odc-info i{font-style:normal;color:var(--mute);font-family:var(--sans);margin-right:4px}
.odc-note{font-size:13px;color:var(--mute);margin:6px 0 0}
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

/* mount a chart into an element. returns {setSymbol, destroy} */
async function mountChart(host,base,opt={}){
  style();await loadLWC();
  host.innerHTML=`<div class="odc-tools" data-r="tools"></div><div class="odc-wrap" data-r="wrap"><canvas class="vp" data-r="vp"></canvas></div><div class="odc-info" data-r="info"></div><p class="odc-note">Bybit 무기한 선물 캔들 · 오른쪽 막대는 화면에 보이는 구간의 볼륨 프로파일 (진한 선 POC, 점선 VAH·VAL, 옅은 칸은 매물 공백 LVN). 차트를 움직이면 다시 계산돼요.</p>`;
  const $=r=>host.querySelector(`[data-r="${r}"]`);const wrap=$('wrap'),cv=$('vp');
  let tf=opt.tf||localStorage.getItem('odc-tf')||'60',sym=null,K=[],vp=null,lines=[];
  const ink=cvar('--ink'),mute=cvar('--mute'),line=cvar('--line'),up=cvar('--up'),dn=cvar('--dn');
  const chart=LightweightCharts.createChart(wrap,{autoSize:true,layout:{background:{type:'solid',color:'transparent'},textColor:mute,fontFamily:'JetBrains Mono, monospace',fontSize:11},
    grid:{vertLines:{color:line},horzLines:{color:line}},rightPriceScale:{borderColor:line,scaleMargins:{top:.08,bottom:.22}},timeScale:{borderColor:line,timeVisible:true,secondsVisible:false},crosshair:{mode:0},
    localization:{locale:'ko-KR'}});
  const cs=chart.addCandlestickSeries({upColor:up,downColor:dn,borderUpColor:up,borderDownColor:dn,wickUpColor:up,wickDownColor:dn});
  const vs=chart.addHistogramSeries({priceScaleId:'v',priceFormat:{type:'volume'},color:mute});
  chart.priceScale('v').applyOptions({scaleMargins:{top:.82,bottom:0}});
  wrap.insertBefore(cv,null);
  const tools=$('tools');
  const renderTools=()=>{tools.innerHTML=TFS.map(([v,l])=>`<button type="button" data-tf="${v}" aria-pressed="${v===tf}">${l}</button>`).join('')+(opt.links!==false?`<a href="./watch.html#${encodeURIComponent(base)}">호가 감시 →</a><a href="./#${encodeURIComponent(base)}">코인 분석 →</a>`:'')};
  renderTools();
  tools.addEventListener('click',e=>{const b=e.target.closest('button[data-tf]');if(!b)return;tf=b.dataset.tf;localStorage.setItem('odc-tf',tf);renderTools();load()});
  function drawVP(){
    const W=wrap.clientWidth,H=wrap.clientHeight;const dpr=window.devicePixelRatio||1;cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';
    const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
    const r=chart.timeScale().getVisibleLogicalRange();if(!r||!K.length)return;
    const vis=K.slice(Math.max(0,Math.floor(r.from)),Math.min(K.length,Math.ceil(r.to)+1));if(vis.length<5)return;
    vp=volumeProfile(vis);
    const psw=chart.priceScale('right').width(),maxW=(W-psw)*.22,x1=W-psw-2,mx=Math.max(...vp.bins);
    for(let i=0;i<vp.nb;i++){const yA=cs.priceToCoordinate(vp.L+i*vp.st),yB=cs.priceToCoordinate(vp.L+(i+1)*vp.st);if(yA==null||yB==null)continue;
      const h=Math.max(1,Math.abs(yA-yB)-1),w=vp.bins[i]/mx*maxW;const inVA=i>=vp.lo&&i<=vp.hi;
      g.globalAlpha=i===vp.poc?.85:inVA?.38:.16;g.fillStyle=i===vp.poc?ink:mute;g.fillRect(x1-w,Math.min(yA,yB),w,h)}
    g.globalAlpha=1;
    for(const l of lines)cs.removePriceLine(l);lines=[
      cs.createPriceLine({price:vp.POC,color:ink,lineWidth:2,lineStyle:0,axisLabelVisible:true,title:'POC'}),
      cs.createPriceLine({price:vp.VAH,color:mute,lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'VAH'}),
      cs.createPriceLine({price:vp.VAL,color:mute,lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'VAL'})];
    const last=K.at(-1).close,ib=Math.floor((last-vp.L)/vp.st),inL=vp.lvn.includes(ib);
    const f=n=>n>=1000?n.toLocaleString('en-US',{maximumFractionDigits:2}):n>=1?(+n.toFixed(4)).toString():n.toPrecision(4);
    $('info').innerHTML=`<span><i>현재가</i>${f(last)}</span><span><i>POC</i>${f(vp.POC)}</span><span><i>VAH</i>${f(vp.VAH)}</span><span><i>VAL</i>${f(vp.VAL)}</span><span><i>위치</i>${last>vp.VAH?'가치 영역 위':last<vp.VAL?'가치 영역 아래':'가치 영역 안'}${inL?' · 매물 공백(LVN) 안':''}</span>`;
  }
  let raf=0;const sched=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(drawVP)};
  chart.timeScale().subscribeVisibleLogicalRangeChange(sched);
  const ro=new ResizeObserver(sched);ro.observe(wrap);
  async function resolve(){for(const s of [base+'USDT','1000'+base+'USDT','10000'+base+'USDT','1000000'+base+'USDT']){try{const r=await j(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${s}&interval=60&limit=1`);if(r.result?.list?.length)return s}catch(e){}}return null}
  async function load(){
    $('info').textContent='불러오는 중…';
    if(!sym)sym=await resolve();if(!sym){$('info').textContent=`Bybit 무기한 선물에 ${base}가 없어요.`;return}
    const r=await j(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${sym}&interval=${tf}&limit=1000`);
    K=r.result.list.map(a=>({time:Math.floor(+a[0]/1000),open:+a[1],high:+a[2],low:+a[3],close:+a[4],q:+a[6]})).sort((a,b)=>a.time-b.time);
    cs.setData(K.map(({time,open,high,low,close})=>({time,open,high,low,close})));
    vs.setData(K.map(k=>({time:k.time,value:k.q,color:k.close>=k.open?alpha(up,.4):alpha(dn,.4)})));
    const n=K.length;chart.timeScale().setVisibleLogicalRange({from:Math.max(0,n-200),to:n+3});sched();
  }
  await load().catch(e=>{$('info').textContent='차트를 불러오지 못했어요: '+e.message});
  const timer=setInterval(()=>{if(!document.hidden)load().catch(()=>{})},60e3);
  return{destroy(){clearInterval(timer);ro.disconnect();chart.remove()},reload:load};
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

window.OD={loadTypes,kindOf,KINDS,openChart,mountChart,volumeProfile};
})();
