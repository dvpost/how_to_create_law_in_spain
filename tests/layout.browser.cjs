'use strict';
const {chromium}=require(process.argv[2]);
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs');
const language=process.argv[3]||'ru';
assert.ok(['es','ru','en'].includes(language),'Language must be es, ru or en');
const reportSuffix=language==='ru'?'':'-'+language;
function crossings(geometry){
 const edges=geometry.edges.filter(edge=>edge.kind!=='return'),pairs=[];
 function cuts(a,b,c,d){
  const orient=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  return orient(a,b,c)*orient(a,b,d)<-.01&&orient(c,d,a)*orient(c,d,b)<-.01;
 }
 for(const [i,a] of edges.entries())for(const b of edges.slice(i+1)){
  if([a.source,a.target].some(id=>id===b.source||id===b.target))continue;
  if(a.points.slice(1).some((p,j)=>b.points.slice(1).some((q,k)=>cuts(a.points[j],p,b.points[k],q))))pairs.push([a.id,b.id]);
 }return pairs;
}
function nodeHits(geometry){
 const hits=[];
 function cuts(a,b,r){
  let low=0,high=1;const dx=b.x-a.x,dy=b.y-a.y,p=[-dx,dx,-dy,dy],q=[a.x-r.x-.2,r.x+r.width-.2-a.x,a.y-r.y-.2,r.y+r.height-.2-a.y];
  for(let i=0;i<4;i++){if(Math.abs(p[i])<1e-8){if(q[i]<0)return false;}else{const t=q[i]/p[i];if(p[i]<0)low=Math.max(low,t);else high=Math.min(high,t);if(low>high)return false;}}return low<high;
 }
 for(const edge of geometry.edges)for(const node of geometry.nodes){if(node.id===edge.source||node.id===edge.target)continue;if(edge.points.slice(1).some((point,i)=>cuts(edge.points[i],point,node)))hits.push([edge.id,node.id]);}
 return hits;
}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href+'?lang='+language);await page.evaluate(()=>graph.whenReady());
  // The reported reproduction: reveal initiative sources and the Senate pre-procedure.
  await page.evaluate(async()=>{await graph.toggle('initiative');await graph.toggle('senate-source');});
  let geometry=await page.evaluate(()=>graph.getGeometry());
  const scenarios=[];
  function verify(geometry,name){
   assert.deepEqual(nodeHits(geometry),[],name+': arrows must avoid unrelated cards');
   const overlaps=[];
   for(const [i,a] of geometry.nodes.entries())for(const b of geometry.nodes.slice(i+1)){
    if(a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height)overlaps.push([a.id,b.id]);
   }
   assert.deepEqual(overlaps,[],name+': cards must not overlap');
   for(const ids of [['ilp-source','autonomy-source','government-source','congress-source','senate-source'],['senators-25','senate-group','senate-commissions']]){
    const row=ids.map(id=>geometry.nodes.find(node=>node.id===id));
    if(row.every(Boolean))for(let i=1;i<row.length;i++)assert.ok(row[i-1].x<row[i].x,name+': sibling order must remain stable');
   }
   scenarios.push({name,nodes:geometry.nodes.length,edges:geometry.edges.length,nodeOverlaps:overlaps.length,edgeNodeHits:nodeHits(geometry).length,crossingPairs:crossings(geometry).length});
   for(const edge of geometry.edges)for(let i=1;i<edge.points.length;i++){
    const a=edge.points[i-1],b=edge.points[i];assert.ok(Math.abs(a.x-b.x)<.1||Math.abs(a.y-b.y)<.1,name+': route must be orthogonal: '+edge.id);
   }
   const order=stagePositions(geometry);
   for(let i=1;i<order.length;i++)assert.ok(order[i-1]<order[i],name+': main stages must retain their order');
   const returnNode=geometry.nodes.find(node=>node.id==='return');
   if(returnNode)assert.ok(returnNode.y>order[4]&&returnNode.y<order[5],name+': Senate return belongs between Senate review and the King');
  }
  function stagePositions(g){return ['initiative','admission','discussion','approval','senate','king','publication'].map(id=>g.nodes.find(n=>n.id===id).y);}
  verify(geometry,'Senate');
  assert.ok(crossings(geometry).length<=2,'The Senate reproduction must have at most two crossing pairs');
  await page.screenshot({path:path.resolve(__dirname,'../reports/senate'+reportSuffix+'.png')});
  // Every disclosure is exercised, including the sideways ILP role group.
  const owners=await page.evaluate(()=>Object.keys(LAW_GRAPH.expansions));
  for(const id of owners){
   await page.evaluate(async id=>{if(!graph.getState().expanded.includes(id))await graph.toggle(id);},id);
   verify(await page.evaluate(()=>graph.getGeometry()),'Reveal '+id);
  }
  const role=await page.evaluate(()=>graph.getState().positions);
  assert.equal(role['ilp-electors'].y,role['ilp-signatures'].y);assert.ok(role['ilp-electors'].x<role['ilp-signatures'].x);
  await page.evaluate(()=>graph.fit());await page.screenshot({path:path.resolve(__dirname,'../reports/expanded'+reportSuffix+'.png')});
  for(const mode of ['ordinary','organic','all']){
   await page.evaluate(mode=>graph.setLawMode(mode),mode);verify(await page.evaluate(()=>graph.getGeometry()),mode);
  }
  await page.evaluate(()=>graph.showReturns(false));verify(await page.evaluate(()=>graph.getGeometry()),'No returns');
  // A newer request must win even while a previous layout is computing.
  await page.evaluate(async()=>{await Promise.all([graph.setLawMode('organic'),graph.setLawMode('ordinary')]);});
  assert.equal(await page.evaluate(()=>graph.getState().lawMode),'ordinary');
  assert.ok(!(await page.evaluate(()=>graph.getVisibleGraph().nodes)).some(n=>n.id==='ilp-blocked'));
  verify(await page.evaluate(()=>graph.getGeometry()),'Latest request');
  await page.evaluate(()=>graph.reset());
  const beforeDrag=await page.evaluate(()=>({state:graph.getState(),edge:graph.getGeometry().edges.find(edge=>edge.id==='initiative-admission')}));
  const root=beforeDrag.state.positions.initiative,z=beforeDrag.state.viewport.zoom,pan=beforeDrag.state.viewport.pan;
  await page.mouse.move(root.x*z+pan.x,root.y*z+pan.y);await page.mouse.down();await page.mouse.move(root.x*z+pan.x+90,root.y*z+pan.y+15,{steps:12});await page.mouse.up();await page.evaluate(()=>graph.whenReady());
  const afterDrag=await page.evaluate(()=>({state:graph.getState(),edge:graph.getGeometry().edges.find(edge=>edge.id==='initiative-admission'),geometry:graph.getGeometry()}));
  assert.deepEqual(nodeHits(afterDrag.geometry),[],'Dropped routes must avoid other cards');
  const delta=afterDrag.state.positions.initiative.x-root.x;assert.ok(delta>50,'Node remains draggable');
  assert.ok(Math.abs(afterDrag.edge.points[0].x-beforeDrag.edge.points[0].x-delta)<.1,'Arrow source follows dragged node');
  assert.deepEqual(afterDrag.edge.points.at(-1),beforeDrag.edge.points.at(-1),'Other endpoint remains attached');
  await page.evaluate(()=>graph.align());verify(await page.evaluate(()=>graph.getGeometry()),'Reset and align');
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  // An engine failure is visible and leaves no stale or alternate layout behind.
  const failed=await browser.newPage();
  await failed.addInitScript(()=>Object.defineProperty(window,'ELK',{get(){return class{layout(){return Promise.reject(new Error('test-layout-error'));}};},set(){},configurable:true}));
  await failed.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href+'?lang='+language);assert.equal(await failed.evaluate(()=>graph.whenReady()),false);
  assert.match(await failed.locator('#ui-status').textContent(),/test-layout-error/);assert.equal(await failed.locator('#ui-status').isVisible(),true);
  assert.deepEqual(await failed.evaluate(()=>graph.getVisibleGraph()),{nodes:[],edges:[]});assert.equal(await failed.locator('#viewport').getAttribute('aria-busy'),'false');await failed.close();
  fs.writeFileSync(path.resolve(__dirname,'../reports/layout-checks'+reportSuffix+'.json'),JSON.stringify({language,placement:'elkjs 0.12.0',routing:'libavoid-js 0.5.0-beta.5',scenarios,offlineRequests:network,errors},null,2)+'\n');
  console.log('PASS: every disclosure and law mode; orthogonal rendered routes; zero node/edge collisions; main-stage order; ILP group; latest async request; visible engine failure without fallback; offline');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
