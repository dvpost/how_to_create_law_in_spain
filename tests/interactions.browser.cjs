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
   assert.equal(before.indexOf('senate-source'),3,'Senate is the fourth source');
   for(const id of ['senate-source','government-source','congress-source','ilp-source','autonomy-source']){
    await page.evaluate(id=>graph.toggle(id),id);assert.deepEqual(await sourceOrder(),before,'Opening '+id+' must preserve source order');
    await page.evaluate(id=>graph.toggle(id),id);assert.deepEqual(await sourceOrder(),before,'Closing '+id+' must preserve source order');
   }
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
