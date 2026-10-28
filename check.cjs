const assert=require('node:assert/strict');
const V=require('./algorithms.js');
const base={o:[50,50,50],d:V.norm([70,50,40]),c:[120,100,90],r:35,v:10,step:.05,size:200};
let tests=0;
function check(c){const rs=['dda','ray','hybrid'].map(m=>V.scan(c,m));for(const r of rs){assert.equal(r.checks,r.events.length);assert.ok(r.events.every(e=>Number.isFinite(e.t)));const lean=V.scan(c,r.mode,false);assert.equal(lean.checks,r.checks);assert.equal(lean.hit,r.hit);tests++}const ray=rs[1];if(ray.hit!==null&&ray.truth!==null){assert.ok(ray.hit>=ray.truth-1e-6);assert.ok(ray.error<=c.step+1e-6)}for(const r of rs.slice(0,1))if(r.truth!==null)assert.notEqual(r.hit,null);return rs}
let r=check(base);assert.ok(r[2].checks<r[1].checks);assert.ok(r[2].error<r[0].error);
for(const d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[1,1,1],[-1,-1,-1]])check({...base,d:V.norm(d)});
let seed=42;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let i=0;i<150;i++){const d=V.norm([random()*2-1,random()*2-1,random()*2-1]);check({...base,d,v:[5,10,20][i%3],step:[.05,.2,1,5][i%4]});const limit=V.boxExit(base.o,d,200),cells=V.cells(base.o,d,10,limit);for(const cell of cells){const point=V.add(base.o,d,(cell.t+cell.end)/2);assert.deepEqual(point.map(x=>Math.floor(x/10)),cell.cell);assert.ok(cell.end>cell.t)}}
assert.deepEqual(V.cells([50,50,50],[1,0,0],10,150)[0].cell,[5,5,5]);assert.deepEqual(V.cells([50,50,50],[-1,0,0],10,50)[0].cell,[4,5,5]);
assert.equal(V.sphereHit([0,0,0],[1,0,0],[10,0,0],2),8);assert.equal(V.sphereHit([0,3,0],[1,0,0],[10,0,0],2),null);
console.log(`Passed ${tests} algorithm checks, randomized cell-midpoint oracle, axis-aligned, negative, diagonal and sphere-reference cases.`);
