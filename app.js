'use strict';
const $=id=>document.getElementById(id), modes=['dda','ray','hybrid'], colors={dda:'#64d6b1',ray:'#b4a3f5',hybrid:'#f3ad73'};
let config,results,playing=false,fraction=1,lastFrame=0,activeTab='dda',benchData=null,revision=0;
let view={yaw:-.67,pitch:.47,zoom:1},drag=null,dirty=true;
const canvases=modes.map(m=>$('canvas-'+m));
function makeConfig(){const base=Voxel.norm([70,50,40]),a=Math.atan2(base[2],base[0]) + Number($('yaw').value)*Math.PI/180,b=Math.asin(base[1])+Number($('pitch').value)*Math.PI/180;return {o:[50,50,50],d:[Math.cos(b)*Math.cos(a),Math.sin(b),Math.cos(b)*Math.sin(a)],c:[120,100,90],r:35,v:Number($('voxel').value),step:Number($('fineStep').value),size:200}}
function recalculate(){playing=false;config=makeConfig();results=modes.map(m=>Voxel.scan(config,m));fraction=1;revision++;$('yawValue').value=$('yaw').value+'°';$('pitchValue').value=$('pitch').value+'°';benchData=null;$('download').disabled=true;$('benchStatus').textContent='설정이 바뀌면 새로 실험해 주세요. 아래 수치는 성능 실험 실행 시 계산됩니다.';$('benchRows').innerHTML=modes.map(m=>`<tr><td><span class="dot ${m==='dda'?'mint':m==='ray'?'purple':'orange'}"></span>${names[m]}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`).join('');updateUI();}
const names={dda:'DDA',ray:'Ray Casting',hybrid:'Hybrid'};
function count(r){return Math.min(r.events.length,Math.floor(fraction*r.events.length))}
function current(r){const n=count(r);return n?r.events[n-1]:null}
function displayNumber(n,d=2){return n===null?'—':n.toLocaleString('ko-KR',{maximumFractionDigits:d,minimumFractionDigits:d})}
function updateUI(){
 $('progress').value=Math.round(fraction*1000);$('progressLabel').textContent=Math.round(fraction*100)+'%';$('play').textContent=playing?'Ⅱ 일시 정지':fraction>=1?'▶ 다시 재생':'▶ 재생';
 results.forEach(r=>{const n=count(r),e=current(r),done=n===r.events.length;$('checks-'+r.mode).textContent=n.toLocaleString();$('error-'+r.mode).textContent=done?displayNumber(r.error,3):'—';$('status-'+r.mode).textContent=!n?'탐색 준비':done?(r.hit===null?'미탐지 · 탐색 종료':r.mode==='dda'?'후보 격자 도달':'구 내부 샘플 탐지'):(e.phase==='coarse'?'DDA · 격자 이동 중':'Ray · 정밀 샘플링 중')});
 const [a,b,c]=results,saved=(1-c.checks/b.checks)*100;
 $('finding').innerHTML=c.mismatch?'<strong>국소 탐색의 한계가 나타납니다.</strong> 실제로는 구와 만나지만, 첫 후보 격자 근처의 정밀 탐색 구간이 표면까지 도달하지 못해 Hybrid가 놓쳤습니다. 각도나 격자 크기를 바꾸어 비교해 보세요.':a.mismatch?'<strong>격자가 구와 겹쳐도, 광선이 구에 닿는 것은 아닙니다.</strong> 지금 DDA는 후보 셀을 탐지했지만 실제 광선은 구를 빗나갑니다. 정밀 탐색에서는 구 내부 샘플을 찾지 못합니다.':a.truth===null?'<strong>구를 빗나간 광선입니다.</strong> DDA는 공간의 격자를 따라 이동하고, Ray Casting은 빈 공간에서도 점을 반복 검사합니다. 세 방식 모두 탐색 범위 안에서 실제 구 표면을 탐지하지 않았습니다.':`<strong>빠른 접근 뒤에 정밀한 확인.</strong> 현재 광선에서 Hybrid는 Ray Casting보다 검사 횟수가 ${Math.abs(saved).toFixed(1)}% ${saved>=0?'적습니다':'많습니다'}. DDA 오차 ${displayNumber(a.error,3)}, Hybrid 오차 ${displayNumber(c.error,3)} unit. <span>검사 종류가 달라 실행 시간은 별도로 확인하세요.</span>`;
 renderExplanation();dirty=true;
}
const descriptions={
 dda:{title:'다음 격자 경계만<br>골라서 이동합니다.',body:'광선을 잘게 쪼개는 대신 X·Y·Z 경계까지의 거리를 비교합니다. 가장 가까운 경계로 이동하고, 새 격자가 구와 겹치는지 한 번 검사합니다.',equation:'tNext = min(tMaxX, tMaxY, tMaxZ)',steps:['현재 격자와 각 축의 다음 경계 거리를 계산','가장 가까운 경계를 지나 다음 격자로 이동','격자와 구가 겹치면, 격자 진입 거리로 종료'],code:['cell = floor(origin / voxel)','tMax, tDelta = nextBoundaries(ray)','while insideGrid(cell):','  if overlapsSphere(cell): return tEntry','  axis = argmin(tMax)','  cell[axis] += step[axis]','  tMax[axis] += tDelta[axis]'],note:'격자와 구의 겹침은 후보 판정입니다. 표면 교점과 일치하지 않을 수 있습니다.'},
 ray:{title:'작은 간격을 반복해서,<br>구 표면에 다가갑니다.',body:'시작점부터 일정한 거리 Δs마다 점을 찍습니다. 각 점이 구 안에 들어왔는지 확인하므로 같은 격자를 여러 번 검사할 수 있습니다.',equation:'p(t) = origin + direction × t',steps:['탐색 거리를 0부터 시작','Δs마다 점의 위치를 계산하고 구 내부인지 검사','처음 구 안에 들어온 샘플의 거리로 종료'],code:['t = 0','while t <= maxDistance:','  point = origin + direction * t','  if insideSphere(point): return t','  t += sampleStep'],note:'간격을 줄이면 일반적으로 오차가 작아지지만 검사가 늘어납니다. 큰 간격은 얇게 스치는 구간을 놓칠 수 있습니다.'},
 hybrid:{title:'DDA로 가까이,<br>Ray Casting으로 세밀하게.',body:'먼 구간은 격자 단위로 통과합니다. 구와 겹치는 첫 후보 격자를 찾으면 조금 앞에서 되돌아가 작은 간격의 탐색으로 전환합니다.',equation:'DDA → candidate → local fine sampling',steps:['DDA로 구와 겹치는 첫 후보 격자 탐색','셀 진입 거리 − voxel/2에서 정밀 탐색 시작','0.05 간격(기본값)으로 구 내부를 확인'],code:['candidate = ddaFindFirstOverlap(ray)','if noCandidate: return MISS','t = max(0, candidate.entry - voxel / 2)','end = candidate.entry + voxel * 1.5','while t <= end:','  if insideSphere(ray(t)): return t','  t += sampleStep','return MISS'],note:'발표자료의 국소 탐색 구간을 사용합니다. 후보 셀 겹침만으로 실제 충돌이 보장되지는 않으며, 이 구간 밖의 표면은 놓칠 수 있습니다.'}
};
function renderExplanation(){const d=descriptions[activeTab],r=results[modes.indexOf(activeTab)],e=current(r),done=count(r)===r.events.length; $('explainContent').innerHTML=`<h3>${d.title}</h3><p>${d.body}</p><div class="equation">${d.equation}</div><ol>${d.steps.map(s=>`<li>${s}</li>`).join('')}</ol><p>${d.note}</p>`;let line=-1;if(e){line=activeTab==='dda'?(e.hit?3:4):activeTab==='ray'?(e.hit?3:4):(e.phase==='coarse'?0:e.hit?5:6)}$('pseudocode').innerHTML=d.code.map((s,i)=>`<span class="code-line ${i===line?'active':''}">${s.replaceAll('<','&lt;').replaceAll('>','&gt;')}</span>`).join('');$('phaseLabel').textContent=activeTab.toUpperCase();$('inspector').innerHTML=e?`현재 셀 [${e.cell.join(', ')}] · 거리 t = ${e.t.toFixed(3)}<br>`+(e.next?`다음 경계 tMax = [${e.next.map(x=>Number.isFinite(x)?x.toFixed(2):'∞').join(', ')}]<br>`:'')+`DDA 검사 ${r.coarse}회 / 정밀 검사 ${r.fine}회 (전체)<br>해석적 교점 거리 ${displayNumber(r.truth,3)} · ${done?'탐색 종료':'과정 관찰 중'}`:'재생하거나 다음 단계 버튼을 눌러 시작하세요.';}
function rgba(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`}
function draw(canvas,r){
 const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const sy=Math.sin(view.yaw),cy=Math.cos(view.yaw),sp=Math.sin(view.pitch),cp=Math.cos(view.pitch),scale=Math.min(w/310,h/290)*view.zoom;
 function project(p){const x=p[0]-100,y=p[1]-83,z=p[2]-100,depth=x*cp*sy+y*sp+z*cp*cy,pers=600/(600-depth);return {x:w*.5+(x*cy-z*sy)*scale*pers,y:h*.53-(-x*sp*sy+y*cp-z*sp*cy)*scale*pers,depth}}
 function line(points,color,width=1,dash=[]){ctx.beginPath();points.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([])}
 function dot(p,color,rad=2){const q=project(p);ctx.beginPath();ctx.arc(q.x,q.y,rad,0,Math.PI*2);ctx.fillStyle=color;ctx.fill()}
 if($('showGrid').checked){for(let x=0;x<=200;x+=config.v){line([[x,0,0],[x,0,200]],'#42635655',.6);line([[0,0,x],[200,0,x]],'#42635655',.6)}}
 const corners=[[0,0,0],[200,0,0],[200,0,200],[0,0,200],[0,200,0],[200,200,0],[200,200,200],[0,200,200]],edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];edges.forEach(([a,b])=>line([corners[a],corners[b]],'#47675a66',.7));
 if($('showShell').checked){
  const spoint=(a,b)=>[config.c[0]+config.r*Math.cos(b)*Math.cos(a),config.c[1]+config.r*Math.sin(b),config.c[2]+config.r*Math.cos(b)*Math.sin(a)];
  const center=project(config.c);ctx.beginPath();ctx.arc(center.x,center.y,config.r*scale*600/(600-center.depth),0,Math.PI*2);ctx.fillStyle='#93b4a10b';ctx.fill();
  for(let j=-4;j<=4;j++){const b=j*Math.PI/10;line(Array.from({length:65},(_,i)=>spoint(i/64*Math.PI*2,b)),'#90b8a15c',.7)}
  for(let j=0;j<16;j++)line(Array.from({length:33},(_,i)=>spoint(j/16*Math.PI*2,-Math.PI/2+i/32*Math.PI)),'#90b8a14a',.65);
 }
 function cube(cell,color,alpha){const v=config.v,verts=corners.map(p=>cell.map((x,i)=>(x+p[i]/200)*v));const faces=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];faces.map(f=>({f,p:f.map(i=>project(verts[i]))})).sort((a,b)=>a.p.reduce((s,p)=>s+p.depth,0)-b.p.reduce((s,p)=>s+p.depth,0)).forEach(({p})=>{ctx.beginPath();p.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.fillStyle=rgba(color,alpha);ctx.fill();ctx.strokeStyle=rgba(color,.42);ctx.lineWidth=.65;ctx.stroke()})}
 const n=count(r),events=r.events.slice(0,n),e=current(r),coarse=events.filter(x=>x.phase==='coarse');
 if($('showPath').checked){coarse.sort((a,b)=>project(a.p).depth-project(b.p).depth).forEach(s=>cube(s.cell,colors.dda,s.hit?.17:.07));if(r.mode==='ray'){const visited=new Map();events.forEach(e=>visited.set(e.cell.join(','),e));[...visited.values()].sort((a,b)=>project(a.p).depth-project(b.p).depth).forEach(s=>cube(s.cell,colors.ray,.025))}}
 const rayEnd=Voxel.add(config.o,config.d,Math.min(r.truth===null?r.limit:r.truth+18,r.limit));line([config.o,rayEnd],'#8ba39455',.9,[3,5]);
 if(e){line([config.o,e.p],rgba(colors[r.mode],.75),1.5);if($('showPath').checked){const fineEvents=events.filter(x=>x.phase==='fine'),stride=Math.max(1,Math.ceil(fineEvents.length/700));for(let k=0;k<fineEvents.length;k+=stride)dot(fineEvents[k].p,rgba(colors[r.mode],.65),r.mode==='hybrid'?1.4:1.05)}dot(e.p,colors[r.mode],4);const ep=project(e.p);ctx.strokeStyle=rgba(colors[r.mode],.3);ctx.lineWidth=1;ctx.beginPath();ctx.arc(ep.x,ep.y,8,0,Math.PI*2);ctx.stroke()}
 if(r.truth!==null){const q=project(Voxel.add(config.o,config.d,r.truth));ctx.save();ctx.translate(q.x,q.y);ctx.rotate(Math.PI/4);ctx.strokeStyle='#f0f6e9';ctx.lineWidth=1.3;ctx.strokeRect(-3,-3,6,6);ctx.restore()}
 dot(config.o,'#f0d98b',4);const oq=project(config.o);ctx.fillStyle='#c4bb93';ctx.font='8px Consolas, monospace';ctx.fillText('SCANNER',oq.x-20,oq.y+17);
 const cpos=project([120,142,90]);ctx.fillStyle='#769586';ctx.font='8px Consolas, monospace';ctx.fillText('TARGET / r = 35',cpos.x-35,cpos.y);
 const ax=project([205,0,0]),ay=project([0,205,0]),az=project([0,0,205]);ctx.fillStyle='#648575';[ax,ay,az].forEach((p,i)=>ctx.fillText('XYZ'[i],p.x,p.y));
}
canvases.forEach(c=>{c.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};c.setPointerCapture(e.pointerId)});c.addEventListener('pointermove',e=>{if(!drag)return;view.yaw-=(e.clientX-drag.x)*.007;view.pitch=Math.max(.04,Math.min(1.4,view.pitch+(e.clientY-drag.y)*.007));drag={x:e.clientX,y:e.clientY};dirty=true});c.addEventListener('pointerup',()=>drag=null);c.addEventListener('pointercancel',()=>drag=null);c.addEventListener('wheel',e=>{e.preventDefault();view.zoom=Math.max(.55,Math.min(2.4,view.zoom*Math.exp(-e.deltaY*.001)));dirty=true},{passive:false})});
['yaw','pitch','voxel','fineStep'].forEach(id=>$(id).addEventListener('input',()=>{document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('selected'));recalculate()}));
['showGrid','showShell','showPath'].forEach(id=>$(id).addEventListener('change',()=>dirty=true));
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const key=b.dataset.preset;$('yaw').value=key==='edge'?22:key==='miss'?35:0;$('pitch').value=0;document.querySelectorAll('[data-preset]').forEach(x=>x.classList.toggle('selected',x===b));recalculate()});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));renderExplanation()});
$('play').onclick=()=>{if(fraction>=1)fraction=0;playing=!playing;updateUI()};
$('progress').oninput=()=>{playing=false;fraction=Number($('progress').value)/1000;updateUI()};
function stepBy(direction){playing=false;const fractions=results.map(r=>{const p=fraction*r.events.length;return direction>0?(Math.floor(p+1e-6)+1)/r.events.length:(Math.ceil(p-1e-6)-1)/r.events.length});fraction=Math.max(0,Math.min(1,direction>0?Math.min(...fractions):Math.max(...fractions)));updateUI()}
$('stepBack').onclick=()=>stepBy(-1);$('stepNext').onclick=()=>stepBy(1);
$('resetView').onclick=()=>{view={yaw:-.67,pitch:.47,zoom:1};dirty=true};
$('presentation').onclick=()=>{const on=document.body.classList.toggle('presenting');$('presentation').textContent=on?'⛶ 발표 모드 끝내기':'⛶ 발표 모드';dirty=true;window.scrollTo({top:0})};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('presenting'))$('presentation').click()});
window.addEventListener('resize',()=>dirty=true);
function tick(time){const dt=Math.min(80,time-lastFrame);lastFrame=time;if(playing){fraction=Math.min(1,fraction+dt/8500*Number($('speed').value));if(fraction>=1)playing=false;updateUI()}if(dirty){canvases.forEach((c,i)=>draw(c,results[i]));dirty=false}requestAnimationFrame(tick)}
function directions(n){const d=config.d,u=Voxel.norm([-d[2],0,d[0]]),v=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]];return Array.from({length:n},(_,i)=>{const a=i*2.399963229728653,b=Math.sqrt((i+.5)/n)*.58;return Voxel.norm(d.map((x,j)=>x+b*(Math.cos(a)*u[j]+Math.sin(a)*v[j])))})}
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
$('benchmark').onclick=async()=>{
 const runRevision=revision,params={...config},n=Number($('rayCount').value),dirs=directions(n),rows=[],button=$('benchmark');button.disabled=true;$('download').disabled=true;
 try{
  for(const mode of modes){const durations=[];let sums;
   for(let round=0;round<6;round++){let elapsed=0;sums={checks:0,error:0,valid:0,mismatch:0,falsePositive:0,falseNegative:0};
    for(let start=0;start<n;start+=25){if(revision!==runRevision)throw new Error('설정이 바뀌어 실험을 중단했습니다. 새 설정으로 다시 실행하세요.');$('benchStatus').textContent=`${names[mode]} · ${round===0?'준비 실행':round+'/5회 측정'} · ${Math.min(start+25,n)}/${n}개 광선`;await pause();const now=performance.now();for(let j=start;j<Math.min(start+25,n);j++){const r=Voxel.scan({...params,d:dirs[j]},mode,false);sums.checks+=r.checks;if(r.error!==null){sums.error+=r.error;sums.valid++}if(r.mismatch){sums.mismatch++;r.hit===null?sums.falseNegative++:sums.falsePositive++}}elapsed+=performance.now()-now}
    if(round)durations.push(elapsed);
   }
   durations.sort((a,b)=>a-b);rows.push({mode,time:durations[2],checks:sums.checks/n,error:sums.valid?sums.error/sums.valid:null,valid:sums.valid,mismatch:sums.mismatch,falsePositive:sums.falsePositive,falseNegative:sums.falseNegative,n,voxel:params.v,step:params.step,yaw:Number($('yaw').value),pitch:Number($('pitch').value)});
  }
  benchData=rows;$('benchRows').innerHTML=rows.map(r=>`<tr><td><span class="dot ${r.mode==='dda'?'mint':r.mode==='ray'?'purple':'orange'}"></span>${names[r.mode]}</td><td>${displayNumber(r.time,2)}</td><td>${displayNumber(r.checks,1)}</td><td>${displayNumber(r.error,4)} <small>(${r.valid}개)</small></td><td>${r.mismatch} <small>(오탐 ${r.falsePositive} / 미탐 ${r.falseNegative})</small></td></tr>`).join('');$('benchStatus').textContent=`${n.toLocaleString()}개 동일 광선 · 현재 각도 중심 약 ±30° 분포 · 5회 측정 완료 · 오차의 괄호는 유효 표본 수입니다.`;$('download').disabled=false;
 }catch(e){$('benchStatus').textContent=e.message}finally{button.disabled=false}
};
$('download').onclick=()=>{if(!benchData)return;const keys=['mode','n','voxel','step','yaw','pitch','time','checks','error','valid','mismatch','falsePositive','falseNegative'],csv='\uFEFF'+keys.join(',')+'\r\n'+benchData.map(r=>keys.map(k=>r[k]??'').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='voxel-lab-measurements.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
window.VoxelLab={get config(){return config},get results(){return results},get progress(){return fraction},get benchmark(){return benchData}};
recalculate();requestAnimationFrame(tick);
