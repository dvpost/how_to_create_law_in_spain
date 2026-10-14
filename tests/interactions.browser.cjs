'use strict';
const {chromium}=require(process.argv[2]);
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),failures=[];
 const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
 async function scenario(name,run){
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],network=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url());});
  try{await page.goto(url);await page.evaluate(()=>graph.whenReady());await run(page);assert.deepEqual(errors,[]);assert.deepEqual(network,[]);console.log('PASS: '+name);}
  catch(error){failures.push(name+': '+error.message);}finally{await page.close();}
 }
 try{
  await scenario('Stable source order through expansion and collapse',async page=>{
   await page.evaluate(()=>graph.toggle('initiative'));
   const sourceOrder=()=>page.evaluate(()=>graph.getVisibleGraph().nodes.filter(node=>node.parent==='initiative').sort((a,b)=>graph.getState().positions[a.id].x-graph.getState().positions[b.id].x).map(node=>node.id));
   const before=await sourceOrder();
   assert.deepEqual(before,['ilp-source','autonomy-source','government-source','congress-source','senate-source'],'Autonomy is the second source');
   for(const id of ['senate-source','government-source','congress-source','ilp-source','autonomy-source']){
    await page.evaluate(id=>graph.toggle(id),id);assert.deepEqual(await sourceOrder(),before,'Opening '+id+' must preserve source order');
    await page.evaluate(id=>graph.toggle(id),id);assert.deepEqual(await sourceOrder(),before,'Closing '+id+' must preserve source order');
   }
  });
  await scenario('Collapsed alternatives differ from returns and resolve on expansion',async page=>{
   await page.evaluate(()=>graph.toggle('initiative'));
   const view=()=>page.evaluate(()=>graph.getVisibleGraph());let visible=await view();
   assert.ok(visible.edges.some(edge=>edge.kind==='preview'&&edge.source==='autonomy-source'&&edge.target==='government-source'),'Collapsed autonomy must expose its Government alternative');
   assert.ok(visible.edges.some(edge=>edge.kind==='collapsed'&&edge.source==='autonomy-source'&&edge.target==='entry'),'Common summarized route remains visible');
   const before=await page.evaluate(()=>graph.getState()),route=await page.evaluate(()=>graph.getGeometry().edges.find(edge=>edge.kind==='preview').points);
   const segments=route.slice(1).map((b,i)=>({a:route[i],b,length:Math.hypot(b.x-route[i].x,b.y-route[i].y)})).sort((a,b)=>b.length-a.length),{a,b}=segments[0];
   await page.mouse.click((a.x+b.x)/2*before.viewport.zoom+before.viewport.pan.x,(a.y+b.y)/2*before.viewport.zoom+before.viewport.pan.y);
   assert.deepEqual(await page.evaluate(()=>graph.getState()),before,'Reading the preview must preserve the map');
   assert.match(await page.locator('#detail-content').textContent(),/бюджет/);assert.ok(await page.locator('#detail-content [data-proof="006"]').count());
   await page.locator('#close-detail').click();await page.screenshot({path:path.resolve(__dirname,'../reports/autonomy-collapsed.png')});
   await page.evaluate(()=>graph.showReturns(false));assert.ok((await view()).edges.some(edge=>edge.kind==='preview'),'Hiding returns must not hide alternatives');
   await page.evaluate(()=>graph.toggle('autonomy-source'));visible=await view();
   assert.ok(!visible.edges.some(edge=>edge.kind==='preview'));assert.ok(visible.edges.some(edge=>edge.kind==='flow'&&edge.source==='autonomy-request'&&edge.target==='government-source'));
   assert.ok(visible.edges.some(edge=>edge.kind==='flow'&&edge.source==='autonomy-direct'&&edge.target==='entry'));
   await page.screenshot({path:path.resolve(__dirname,'../reports/autonomy-expanded.png')});
   await page.evaluate(()=>graph.toggle('autonomy-source'));assert.equal((await view()).edges.filter(edge=>edge.kind==='preview').length,1,'Collapse restores exactly one summary alternative');
   await page.evaluate(()=>graph.toggle('initiative'));assert.ok(!(await view()).edges.some(edge=>edge.kind==='preview'));
  });
  await scenario('Senate amendments end with the Congress decision',async page=>{
   const visible=await page.evaluate(()=>graph.getVisibleGraph());
   assert.ok(visible.edges.some(edge=>edge.source==='senate'&&edge.target==='return'&&edge.kind==='return'));
   assert.ok(visible.edges.some(edge=>edge.source==='return'&&edge.target==='final'&&edge.kind==='flow'&&/Вето снято/.test(edge.label)));
   assert.ok(!visible.edges.some(edge=>edge.source==='return'&&edge.target==='senate'));
   await page.evaluate(()=>graph.activate('return'));assert.match(await page.locator('#detail-content').textContent(),/повторного направления текста в Сенат нет/);assert.ok(await page.locator('#detail-content [data-proof="010"]').count());
  });
  await scenario('Expansion has intermediate positions and keeps its anchor',async page=>{
   await page.evaluate(()=>graph.toggle('initiative'));
   const result=await page.evaluate(async()=>{
    const before=graph.getState(),screen=state=>{const p=state.positions['senate-source'];return {x:p.x*state.viewport.zoom+state.viewport.pan.x,y:p.y*state.viewport.zoom+state.viewport.pan.y};};
    let done=false;const frames=[];const pending=graph.toggle('senate-source').then(()=>{done=true;});
    while(!done){frames.push(graph.getState().positions);await new Promise(requestAnimationFrame);}
    await pending;return {before,after:graph.getState(),frames,anchorBefore:screen(before),anchorAfter:screen(graph.getState())};
   });
   const moved=Object.keys(result.before.positions).filter(id=>Math.hypot(result.before.positions[id].x-result.after.positions[id].x,result.before.positions[id].y-result.after.positions[id].y)>20);
   assert.ok(moved.some(id=>result.frames.some(frame=>frame[id]&&Math.hypot(frame[id].x-result.before.positions[id].x,frame[id].y-result.before.positions[id].y)>2&&Math.hypot(frame[id].x-result.after.positions[id].x,frame[id].y-result.after.positions[id].y)>2)),'Cards must move through intermediate positions');
   assert.ok(Math.hypot(result.anchorBefore.x-result.anchorAfter.x,result.anchorBefore.y-result.anchorAfter.y)<2,'Expanded card must stay at its screen position');
   assert.equal(result.before.viewport.zoom,result.after.viewport.zoom,'Disclosure must preserve zoom');
  });
  await scenario('Drop reroutes orthogonally without moving other cards',async page=>{
   const before=await page.evaluate(()=>graph.getState()),p=before.positions.initiative,z=before.viewport.zoom,pan=before.viewport.pan;
   await page.mouse.move(p.x*z+pan.x,p.y*z+pan.y);await page.mouse.down();await page.mouse.move(p.x*z+pan.x+130,p.y*z+pan.y+35,{steps:15});await page.mouse.up();await page.evaluate(()=>graph.whenReady());
   const after=await page.evaluate(()=>({state:graph.getState(),geometry:graph.getGeometry()}));
   assert.ok(after.state.positions.initiative.x-p.x>100);
   for(const id of Object.keys(before.positions).filter(id=>id!=='initiative'))assert.deepEqual(after.state.positions[id],before.positions[id],id+' must stay put');
   assert.deepEqual(after.state.viewport,before.viewport,'Drop must preserve the camera');
   for(const edge of after.geometry.edges)for(let i=1;i<edge.points.length;i++){
    const a=edge.points[i-1],b=edge.points[i];assert.ok(Math.abs(a.x-b.x)<.1||Math.abs(a.y-b.y)<.1,'Drop must recompute orthogonal bends: '+edge.id);
   }
  });
  await scenario('Reduced motion keeps the disclosure anchor',async page=>{
   await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>graph.toggle('initiative'));
   const result=await page.evaluate(async()=>{
    const screen=()=>{const state=graph.getState(),p=state.positions['senate-source'];return {x:p.x*state.viewport.zoom+state.viewport.pan.x,y:p.y*state.viewport.zoom+state.viewport.pan.y};};
    const before=screen();await graph.toggle('senate-source');return {before,after:screen()};
   });assert.ok(Math.hypot(result.before.x-result.after.x,result.before.y-result.after.y)<2);
  });
  await scenario('A newer request cancels an active transition',async page=>{
   await page.evaluate(()=>graph.toggle('initiative'));
   await page.evaluate(async()=>{
    const before=graph.getState().positions['senate-source'];const opening=graph.toggle('senate-source');
    while(Math.abs(graph.getState().positions['senate-source'].x-before.x)<5)await new Promise(requestAnimationFrame);
    await graph.setLawMode('organic');await opening;
   });
   const state=await page.evaluate(()=>graph.getState());assert.equal(state.lawMode,'organic');assert.equal(state.layoutStatus,'ready');
   assert.ok(!(await page.evaluate(()=>graph.getVisibleGraph().nodes)).some(node=>node.id==='ilp-signatures'));
   assert.equal(await page.locator('#viewport').getAttribute('aria-busy'),'false');
  });
  await scenario('Routing failure is visible without another router',async page=>{
   await page.evaluate(()=>{AvoidLib.getInstance().Router=function(){throw new Error('test-router-error');};});
   const state=await page.evaluate(()=>graph.getState()),p=state.positions.initiative,z=state.viewport.zoom,pan=state.viewport.pan;
   await page.mouse.move(p.x*z+pan.x,p.y*z+pan.y);await page.mouse.down();await page.mouse.move(p.x*z+pan.x+100,p.y*z+pan.y+20,{steps:10});await page.mouse.up();
   assert.equal(await page.evaluate(()=>graph.whenReady()),false);assert.match(await page.locator('#ui-status').textContent(),/test-router-error/);
   assert.deepEqual(await page.evaluate(()=>graph.getVisibleGraph()),{nodes:[],edges:[]});
  });
 }finally{await browser.close();}
 if(failures.length)throw new Error(failures.join('\n'));
})().catch(error=>{console.error(error);process.exitCode=1;});
