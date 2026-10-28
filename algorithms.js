/* Educational implementation based on the supplied report, slides 12–21. */
(function(root){
'use strict';
const add=(o,d,t)=>o.map((x,i)=>x+d[i]*t);
const norm=v=>{const m=Math.hypot(...v);return v.map(x=>x/m)};
const inside=(p,c,r)=>p.reduce((s,x,i)=>s+(x-c[i])**2,0)<=r*r+1e-9;
function overlaps(cell,v,c,r){return cell.reduce((s,x,i)=>s+Math.max(x*v-c[i],0,c[i]-(x+1)*v)**2,0)<=r*r+1e-9}
function sphereHit(o,d,c,r){const q=o.map((x,i)=>x-c[i]),b=q.reduce((s,x,i)=>s+x*d[i],0),k=q.reduce((s,x)=>s+x*x,0)-r*r,h=b*b-k;if(k<=0)return 0;if(h<0)return null;const t=-b-Math.sqrt(h);return t>=0?t:null}
function boxExit(o,d,size){return Math.min(...d.map((x,i)=>x>0?(size-o[i])/x:x<0?-o[i]/x:Infinity))}
function cells(o,d,v,limit){
 const cell=o.map((x,i)=>Math.floor(x/v)-(d[i]<0&&Math.abs(x/v-Math.round(x/v))<1e-10?1:0));
 const step=d.map(Math.sign),delta=d.map(x=>x===0?Infinity:v/Math.abs(x));
 const next=d.map((x,i)=>x===0?Infinity:((x>0?(cell[i]+1)*v:cell[i]*v)-o[i])/x);
 const out=[];let t=0,axis='開始';
 for(let it=0;it<10000&&t<limit-1e-8;it++){
  const end=Math.min(...next,limit);out.push({cell:[...cell],t,end,axis,next:[...next]});
  const n=Math.min(...next);if(!Number.isFinite(n)||n>=limit-1e-8)break;
  const axes=[];for(let i=0;i<3;i++)if(Math.abs(next[i]-n)<1e-8){cell[i]+=step[i];next[i]+=delta[i];axes.push('XYZ'[i])}
  t=n;axis=axes.join('+');
 }return out;
}
function scan(config,mode,trace=true){
 const {o,d,c,r,v,step,size}=config,limit=Math.min(500,boxExit(o,d,size));
 const events=[];let checks=0,hit=null,phase='miss',coarse=0,fine=0,candidate=null;
 function event(e){checks++;if(trace)events.push(e)}
 function sample(start,end){for(let k=0;;k++){const t=start+k*step;if(t>Math.min(end,limit)+1e-9)break;const p=add(o,d,t),yes=inside(p,c,r);event({t,p,phase:'fine',hit:yes,cell:p.map(x=>Math.floor(x/v))});fine++;if(yes)return t}return null}
 if(mode==='ray') {hit=sample(0,limit);phase=hit===null?'miss':'fine'}
 else {
  for(const s of cells(o,d,v,limit)){
   const yes=overlaps(s.cell,v,c,r);event({...s,p:add(o,d,s.t),phase:'coarse',hit:yes});coarse++;
   if(yes){candidate=s;break}
  }
  if(candidate){
   if(mode==='dda'){hit=candidate.t;phase='coarse'}
   else{const start=Math.max(0,candidate.t-v/2),end=Math.min(limit,candidate.t+v*1.5);hit=sample(start,end);phase=hit===null?'miss':'fine'}
  }
 }
 const exact=sphereHit(o,d,c,r),truth=exact!==null&&exact<limit?exact:null;
 return {mode,events,checks,coarse,fine,hit,phase,candidate,limit,truth,error:hit!==null&&truth!==null?Math.abs(hit-truth):null,mismatch:(hit===null)!==(truth===null)};
}
const api={add,norm,inside,overlaps,sphereHit,boxExit,cells,scan};root.Voxel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
