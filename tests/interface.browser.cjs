'use strict';
const {chromium}=require(process.argv[2]);
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href+'?lang=ru');
  const ready=()=>page.evaluate(()=>graph.whenReady());await ready();
  const state=()=>page.evaluate(()=>graph.getState()),view=()=>page.evaluate(()=>graph.getVisibleGraph());
  const settings=async()=>{if(!await page.locator('#settings-menu').isVisible())await page.locator('#settings-toggle').click();};
  const closeSettings=async()=>{if(await page.locator('#settings-menu').isVisible())await page.locator('#settings-toggle').click();};
  const noScroll=()=>page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth&&scrollY===0&&scrollX===0);
  // Initial page consists of the whole-viewport map and six small controls.
  const area=await page.locator('#viewport').boundingBox();assert.deepEqual(area,{x:0,y:0,width:1600,height:1000});
  assert.equal(await noScroll(),true);assert.equal(await page.locator('header,footer,select,input[type=file],#export-layout,#import-layout').count(),0);
  for(const id of ['detail-panel','settings-menu','project-menu','help-menu'])assert.equal(await page.locator('#'+id).isVisible(),false);
  assert.equal(await page.locator('.map-controls button').count(),5);assert.equal((await state()).lawMode,'all');
  const initial=await state(),root=initial.positions.initiative;
  assert.ok(Math.abs(root.x*initial.viewport.zoom+initial.viewport.pan.x-800)<320,'Initial route is near the horizontal centre');
  await page.screenshot({path:path.resolve(__dirname,'../reports/map.png')});
  await page.locator('#menu-toggle').click();assert.match(await page.locator('#project-menu').textContent(),/Как появляется закон.*v23/s);await page.locator('#menu-toggle').click();
  await page.locator('#help-toggle').click();assert.match(await page.locator('#help-menu').textContent(),/Связь без стрелки/);assert.equal(await noScroll(),true);await page.locator('#help-toggle').click();
  // Reading and independently disabling descriptions/terms must preserve the graph.
  await page.evaluate(()=>graph.activate('publication'));assert.equal(await page.locator('#detail-panel').isVisible(),true);assert.deepEqual(await state(),initial);
  await settings();await page.locator('#show-descriptions').uncheck();await closeSettings();assert.equal(await page.locator('#detail-panel').isVisible(),false);
  await page.evaluate(()=>graph.activate('king'));assert.equal(await page.locator('#detail-panel').isVisible(),false);
  await page.locator('[data-node-title="publication"] [data-term="boe"]').click();assert.equal(await page.locator('#term-popover').isVisible(),true);await page.keyboard.press('Escape');
  await settings();await page.locator('#show-terms').uncheck();await closeSettings();assert.equal(await page.locator('#viewport [data-term]').count(),0);assert.deepEqual(await state(),initial);
  await settings();await page.locator('#show-descriptions').check();await closeSettings();await page.evaluate(()=>graph.activate('publication'));assert.equal(await page.locator('#detail-panel').isVisible(),true);assert.equal(await page.locator('#detail-content [data-term]').count(),0);
  await page.locator('#close-detail').click();await settings();await page.locator('#show-terms').check();await closeSettings();assert.ok(await page.locator('#viewport [data-term]').count());assert.deepEqual(await state(),initial);
  // Disclosure itself must leave the description popup closed.
  await page.locator('[data-node-toggle="initiative"]').click();await ready();assert.equal(await page.locator('#detail-panel').isVisible(),false);
  await settings();await page.locator('#show-returns').uncheck();await ready();await closeSettings();assert.ok((await view()).edges.every(edge=>edge.kind!=='return'));
  await settings();await page.locator('#show-returns').check();await ready();await closeSettings();assert.ok((await view()).edges.some(edge=>edge.kind==='return'));
  // Both qualified types are explicit; the ILP refusal has an actual deciding body.
  await page.evaluate(async()=>{await graph.toggle('admission');await graph.toggle('ilp-source');});let visible=await view();
  for(const id of ['congress-law-type','congress-ordinary-type','congress-organic-type','ilp-admit','ilp-blocked'])assert.ok(visible.nodes.some(node=>node.id===id));
  assert.ok(visible.edges.some(edge=>edge.source==='congress-mesa'&&edge.target==='congress-toma-needed'),'Qualification can occur later; the initial classification fork is not mandatory');
  assert.ok(visible.edges.some(edge=>edge.source==='ilp-admit'&&edge.target==='ilp-blocked'));assert.ok(!visible.edges.some(edge=>edge.source==='ilp-source'&&edge.target==='ilp-blocked'));
  await page.evaluate(()=>graph.activate('congress-law-type'));assert.match(await page.locator('#detail-content').textContent(),/Junta de Portavoces/);await page.locator('#detail-content [data-proof="020"]').first().click();assert.match(await page.locator('#proof-title').textContent(),/020/);await page.keyboard.press('Escape');await page.locator('#close-detail').click();
  await settings();await page.locator('input[value="organic"]').check();await ready();await closeSettings();visible=await view();assert.ok(visible.nodes.some(node=>node.id==='ilp-admit'));assert.ok(!visible.nodes.some(node=>node.id==='ilp-signatures'||node.id==='congress-ordinary-type'));
  await settings();await page.locator('input[value="ordinary"]').check();await ready();await closeSettings();visible=await view();assert.ok(visible.nodes.some(node=>node.id==='ilp-signatures'));assert.ok(!visible.nodes.some(node=>node.id==='ilp-blocked'||node.id==='congress-organic-type'));
  await settings();await page.locator('input[value="all"]').check();await ready();await page.locator('#reset-map').click();await ready();await settings();await page.locator('#align').click();await ready();await closeSettings();assert.deepEqual((await state()).expanded,[]);
  // Actual browser fullscreen API, including the exit control.
  await page.locator('#fullscreen').click();await page.waitForFunction(()=>document.fullscreenElement===document.documentElement);assert.equal(await noScroll(),true);assert.match(await page.locator('#fullscreen').getAttribute('aria-label'),/Выйти/);
  await page.locator('#fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);
  await page.locator('#menu-toggle').click();await page.locator('[data-archive="proofs"]').click();assert.equal(await page.locator('#archive-dialog').isVisible(),true);assert.equal(await page.locator('.proof-row').count(),20);await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{graph.resize();graph.fit();});assert.equal(await noScroll(),true);assert.deepEqual(await page.locator('#viewport').boundingBox(),{x:0,y:0,width:390,height:844});
  for(const label of await page.locator('[data-node-title]').all()){
   const bounds=await label.boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=390&&bounds.y+bounds.height<=844,'The fitted mobile map must actually be visible');
  }
  await settings();const mobile=await page.locator('#settings-menu').boundingBox();assert.ok(mobile.x>=0&&mobile.x+mobile.width<=390&&mobile.y+mobile.height<=844);await closeSettings();
  await page.screenshot({path:path.resolve(__dirname,'../reports/map-mobile.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  console.log('PASS: full-viewport map; no page scrolling or removed controls; hidden menus; independent description/term toggles without reflow; explicit type/ILP decisions; browser fullscreen enter/exit; proof access; mobile; offline');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
