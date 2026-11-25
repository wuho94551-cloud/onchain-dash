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
.odc-tools .sp{flex:1}
.odc-set{border:1px solid var(--line);padding:12px 14px;margin:0 0 10px;position:relative;font-family:var(--sans);font-size:14px}
.odc-set h3{font-family:var(--serif);font-weight:400;font-size:20px;margin:0 0 6px}
.odc-set .r{display:flex;align-items:center;gap:10px;min-height:44px;border-bottom:1px solid var(--line)}
.odc-set .r>b{font-weight:500;flex:1}
.odc-set .d{font-size:12px;color:var(--mute);margin:2px 0 6px}
.odc-set input[type=checkbox]{width:20px;height:20px;accent-color:var(--ink)}
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
.odc-pop .cu input[type=text]{width:90px;font-family:var(--mono);font-size:13px;background:transparent;color:var(--ink);border:1px solid var(--line);padding:4px 6px}
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
const defCol=()=>{const dn=isDark()?'#FFFFFF':'#1F1F1F';return{prev:false,body:{on:true,up:['#81D8D0',1],dn:[dn,1]},border:{on:true,up:['#81D8D0',1],dn:[dn,1]},wick:{on:true,up:['#81D8D0',1],dn:[dn,1]}}};
const PRESETS=[['민트·화이트',null],['초록·빨강',['#26A69A','#EF5350']],['빨강·파랑',['#E8384F','#2F6BFF']],['흑백',['#9E9E9E','#424242']]];
const getCol=()=>{try{const s=JSON.parse(localStorage.getItem('odc-col'));if(s&&s.body)return s}catch(e){}return defCol()};
const setCol=s=>{localStorage.setItem('odc-col',JSON.stringify(s));window.dispatchEvent(new Event('odc-col'))};
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
  const live=()=>{localStorage.setItem('odc-col',JSON.stringify(s));window.dispatchEvent(new Event('odc-col'))};
  draw();box.hidden=false;
  box.onchange=e=>{const t=e.target;if(t.dataset.prev!=null)s.prev=t.checked;else if(t.dataset.on)s[t.dataset.on].on=t.checked;live()};
  box.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.classList.contains('odc-sw')){const {k,d}=b.dataset;colorPop(b,box,s[k][d],v=>{s[k][d]=v;b.querySelector('i').style.background=rgba(v);live()});return}
    if(b.dataset.p!=null){const p=PRESETS[+b.dataset.p][1];if(!p){const d=defCol();d.prev=s.prev;s=d}else for(const[k]of rows){s[k].up=[p[0],1];s[k].dn=[p[1],1]}draw();live();return}
    if(b.dataset.a==='cancel'){localStorage.setItem('odc-col',orig);window.dispatchEvent(new Event('odc-col'));box.hidden=true;box.innerHTML=''}
    if(b.dataset.a==='ok'){setCol(s);box.hidden=true;box.innerHTML=''}};
}

/* mount a chart into an element. returns {setSymbol, destroy} */
async function mountChart(host,base,opt={}){
  style();await loadLWC();
  host.innerHTML=`<div class="odc-tools" data-r="tools"></div><div class="odc-set" data-r="set" hidden></div><div class="odc-wrap" data-r="wrap"><canvas class="vp" data-r="vp"></canvas></div><div class="odc-info" data-r="info"></div><p class="odc-note">Bybit 무기한 선물 캔들 · 오른쪽 막대는 화면에 보이는 구간의 볼륨 프로파일 (진한 선 POC, 점선 VAH·VAL, 옅은 칸은 매물 공백 LVN). 차트를 움직이면 다시 계산돼요.</p>`;
  const $=r=>host.querySelector(`[data-r="${r}"]`);const wrap=$('wrap'),cv=$('vp');
  let tf=opt.tf||localStorage.getItem('odc-tf')||'60',sym=null,K=[],vp=null,lines=[];
  const ink=cvar('--ink'),mute=cvar('--mute'),line=cvar('--line'),up=cvar('--up'),dn=cvar('--dn');
  const chart=LightweightCharts.createChart(wrap,{autoSize:true,layout:{background:{type:'solid',color:'transparent'},textColor:mute,fontFamily:'JetBrains Mono, monospace',fontSize:11},
    grid:{vertLines:{color:line},horzLines:{color:line}},rightPriceScale:{borderColor:line,scaleMargins:{top:.08,bottom:.22}},timeScale:{borderColor:line,timeVisible:true,secondsVisible:false},crosshair:{mode:0},
    localization:{locale:'ko-KR'}});
  const cs=chart.addCandlestickSeries({});
  let COL=getCol();
  const applyCol=()=>{COL=getCol();const T='rgba(0,0,0,0)',c=COL;
    cs.applyOptions({upColor:c.body.on?rgba(c.body.up):T,downColor:c.body.on?rgba(c.body.dn):T,borderVisible:c.border.on,borderUpColor:rgba(c.border.up),borderDownColor:rgba(c.border.dn),wickVisible:c.wick.on,wickUpColor:rgba(c.wick.up),wickDownColor:rgba(c.wick.dn)})};
  applyCol();
  const vs=chart.addHistogramSeries({priceScaleId:'v',priceFormat:{type:'volume'},color:mute});
  chart.priceScale('v').applyOptions({scaleMargins:{top:.82,bottom:0}});
  wrap.insertBefore(cv,null);
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
  function paint(){if(!K.length)return;const c=COL;
    const isUp=(k,i)=>c.prev&&i>0?k.close>=K[i-1].close:k.close>=k.open;
    cs.setData(K.map((k,i)=>{const o={time:k.time,open:k.open,high:k.high,low:k.low,close:k.close};
      if(c.prev){const u=isUp(k,i)?'up':'dn';o.color=c.body.on?rgba(c.body[u]):'rgba(0,0,0,0)';o.borderColor=rgba(c.border[u]);o.wickColor=rgba(c.wick[u])}return o}));
    vs.setData(K.map((k,i)=>{const u=isUp(k,i)?'up':'dn';return{time:k.time,value:k.q,color:rgba([c.body[u][0],.4])}}));
  }
  const onCol=()=>{applyCol();paint()};window.addEventListener('odc-col',onCol);
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
  return{destroy(){window.removeEventListener('odc-col',onCol);clearInterval(timer);ro.disconnect();chart.remove()},reload:load};
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
