'use strict';
const {chromium}=require(process.argv[2]);
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}});
  const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  const ready=()=>page.evaluate(()=>graph.whenReady());await ready();
  assert.equal(await page.locator('[data-edge-title="senate-king"] [data-term="veto"]').count(),1,'Arrow labels also expose terms');
  await page.evaluate(id=>graph.activate(id),'admission');
  assert.ok(await page.locator('#detail-content [data-term="ilp"]').count(),'ILP must have an inline definition');
  const initial=await page.evaluate(()=>graph.getState());
  for(const [term,expected] of [['ilp',/500 000/],['mesa',/руковод/]]){
   await page.locator(`#detail-content [data-term="${term}"]`).first().click();
   assert.match(await page.locator('#term-popover').textContent(),expected);
   assert.deepEqual(await page.evaluate(()=>graph.getState()),initial,'Definition must preserve the graph');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#term-popover').isVisible(),false);
  }
  await page.evaluate(()=>graph.toggle('approval'));
  const approvalState=await page.evaluate(()=>graph.getState());
  await page.locator('[data-node-title="plenary-required"] [data-term="plenary-required"]').click();
  const categories=await page.locator('.term-definition').textContent();
  for(const text of ['1. Изменение Конституции','2. Международные вопросы','3. Органические законы','4. Leyes de bases','5. Государственный бюджет'])assert.ok(categories.includes(text),'The complete mandatory-Plenary list must be readable');
  assert.equal(await page.locator('.term-definition').evaluate(element=>getComputedStyle(element).whiteSpace),'pre-line');
  await page.locator('#term-popover [data-term="bases"]').click();
  assert.match(await page.locator('.term-definition').textContent(),/Парламент принимает закон/);
  assert.match(await page.locator('.term-sections').textContent(),/конкретный срок/);
  assert.match(await page.locator('.term-sections').textContent(),/Decreto Legislativo/);
  assert.ok(await page.locator('#term-popover [data-proof="015"]').count());
  assert.deepEqual(await page.evaluate(()=>graph.getState()),approvalState,'Nested category/bases explanations must not change the map');
  await page.keyboard.press('Escape');await page.evaluate(()=>graph.toggle('approval'));
  // Terms on the canvas are real controls, distinct from card selection.
  await page.locator('[data-node-toggle="initiative"]').click();await ready();
  await page.evaluate(id=>graph.activate(id),'congress-source');await page.locator('#detail-content [data-term="congress"]').first().click();
  assert.ok(await page.locator('#term-popover [data-term="chambers"]').count(),'The word chambers inside the Congress explanation must be clickable');
  const chambersState=await page.evaluate(()=>graph.getState());await page.locator('#term-popover [data-term="chambers"]').first().click();assert.match(await page.locator('#term-title').textContent(),/Палаты парламента/);
  const nestedBounds=await page.locator('#term-popover').boundingBox();assert.ok(nestedBounds.x>=12&&nestedBounds.x+nestedBounds.width<=1588,'Nested explanation must fit the viewport even beside a right-hand panel');
  const chamberContent=await page.locator('.term-sections').textContent();assert.match(chamberContent,/доверие Конгресса/);assert.match(chamberContent,/территориального представительства/);assert.match(chamberContent,/может преодолеть вето/);assert.match(chamberContent,/давать территориям голос/);assert.deepEqual(await page.evaluate(()=>graph.getState()),chambersState);
  await page.locator('.term-sections [data-proof="018"]').first().click();assert.match(await page.locator('#proof-title').textContent(),/018/);await page.keyboard.press('Escape');
  const chamberForms=await page.evaluate(()=>glossary.html('палата, палаты, палате, палат, палатами; палаты парламента'));assert.equal((chamberForms.match(/data-term="chambers"/g)||[]).length,6,'Case forms and whole phrases open the same explanation');
  await page.evaluate(id=>graph.activate(id),'autonomy-source');const autonomyState=await page.evaluate(()=>graph.getState());
  await page.locator('#detail-content [data-term="autonomy"]').first().click();
  assert.equal(await page.locator('.term-examples').count(),1,'Term popover needs examples');
  assert.match(await page.locator('.term-examples').textContent(),/Валенсийское сообщество/,'Autonomy needs named examples');
  assert.match(await page.locator('.term-examples').textContent(),/Страна Басков/);
  assert.match(await page.locator('.term-examples').textContent(),/Les Corts/);assert.match(await page.locator('.term-examples').textContent(),/Parlamento Vasco/);
  await page.locator('.term-examples [data-proof="017"]').first().click();assert.match(await page.locator('#proof-title').textContent(),/017/);assert.match(await page.locator('.selected-claim').textContent(),/Валенсийское сообщество/);await page.keyboard.press('Escape');
  assert.deepEqual(await page.evaluate(()=>graph.getState()),autonomyState);await page.keyboard.press('Escape');
  // Both names on the shared card retain their own sourced definitions and examples.
  await page.evaluate(()=>graph.toggle('senate-source'));await page.evaluate(id=>graph.activate(id),'senate-commissions');
  const commissionsState=await page.evaluate(()=>graph.getState());
  for(const [term,expected] of [['local-commission',/муниципалитетов|муниципалитеты/],['autonomy-commission',/автономных сообществ/]]){
   assert.equal(await page.locator(`[data-node-title="senate-commissions"] [data-term="${term}"]`).count(),1);
   await page.locator(`#detail-content h2 [data-term="${term}"]`).click();assert.match(await page.locator('.term-definition').textContent(),expected);assert.ok(await page.locator('.term-examples [data-proof]').count());assert.deepEqual(await page.evaluate(()=>graph.getState()),commissionsState);await page.keyboard.press('Escape');
  }
  await page.locator('#detail-content h2 [data-term="local-commission"]').click();await page.locator('#term-popover [data-term="local-entity"]').first().click();assert.match(await page.locator('.term-examples').textContent(),/провинция Валенсия/i);await page.locator('.term-examples [data-proof="019"]').first().click();assert.match(await page.locator('#proof-title').textContent(),/019/);await page.keyboard.press('Escape');await page.evaluate(()=>graph.toggle('senate-source'));
  await page.evaluate(()=>graph.fit());const beforeTerm=await page.evaluate(()=>graph.getState());
  await page.locator('[data-node-title="ilp-source"] [data-term="ilp"]').click();
  assert.match(await page.locator('#term-title').textContent(),/народная законодательная/);
  assert.deepEqual(await page.evaluate(()=>graph.getState()),beforeTerm);await page.keyboard.press('Escape');
  await page.evaluate(id=>graph.activate(id),'ilp-source');await page.evaluate(()=>graph.toggle('ilp-source'));
  for(const [node,term,expected] of [['ilp-check','jec',/избирательной администрации/],['approval','full-competence',/вместо заключительного/],['king','sanction',/одобрение королём/],['king','promulgation',/объявляет принятие/],['publication','boe',/Официальное издание/],['discussion','ponencia',/Один или несколько/],['discussion','dictamen',/Документ/]]){
   await page.evaluate(id=>graph.activate(id),node);const saved=await page.evaluate(()=>graph.getState());
   await page.locator(`#detail-content [data-term="${term}"]`).first().click();assert.match(await page.locator('.term-definition').textContent(),expected);
   assert.ok(await page.locator('#term-popover [data-proof]').count(),'Every definition has proof links');assert.deepEqual(await page.evaluate(()=>graph.getState()),saved);
   await page.keyboard.press('Escape');
  }
  await page.evaluate(id=>graph.activate(id),'approval');
  const organicSummary=page.locator('#detail-content details').filter({has:page.locator('summary [data-term="organic"]')}).first();
  await organicSummary.locator('summary [data-term="organic"]').first().click();assert.equal(await organicSummary.getAttribute('open'),null,'A term click must not toggle its enclosing summary');await page.keyboard.press('Escape');
  await page.evaluate(id=>graph.activate(id),'king');await page.locator('#detail-content [data-term="promulgation"]').first().focus();await page.keyboard.press('Enter');
  await page.locator('#term-popover [data-proof="011"]').click();assert.match(await page.locator('#proof-title').textContent(),/011/);assert.equal(await page.locator('#term-popover').isVisible(),false);await page.keyboard.press('Escape');
  await page.evaluate(id=>graph.activate(id),'senate');await page.locator('#detail-content [data-term="absolute"]').first().click();assert.equal(await page.locator('.term-example h4').textContent(),'Условный пример');assert.match(await page.locator('.term-example').textContent(),/51 голос/);
  await page.locator('.term-example [data-proof="016"]').click();assert.match(await page.locator('.selected-claim').textContent(),/^Условный пример:/);await page.keyboard.press('Escape');
  const matching=await page.evaluate(()=>glossary.html('ILP, Mesa; ILPX XMesa <script>bad</script>'));
  assert.equal((matching.match(/data-term=/g)||[]).length,2,'Matching respects word boundaries');assert.ok(!matching.includes('<script>'),'Markup in content is escaped');
  await page.setViewportSize({width:390,height:844});await page.evaluate(id=>graph.activate(id),'publication');await page.locator('#detail-content [data-term="boe"]').first().click();
  const bounds=await page.locator('#term-popover').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.y>=0&&bounds.y+bounds.height<=844,'Popover stays in the mobile viewport');
  await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:480});await page.evaluate(id=>graph.activate(id),'autonomy-source');await page.locator('#detail-content [data-term="autonomy"]').first().click();
  const longBounds=await page.locator('#term-popover').boundingBox();assert.ok(longBounds.x>=0&&longBounds.x+longBounds.width<=390&&longBounds.y>=0&&longBounds.y+longBounds.height<=480,'Long examples stay inside a short mobile viewport');assert.equal(await page.locator('#term-popover').evaluate(e=>e.scrollHeight>e.clientHeight),true,'Long explanations can scroll');
  await page.locator('#term-popover').evaluate(e=>e.scrollTop=e.scrollHeight);await page.locator('.term-examples [data-proof="017"]').last().click();assert.match(await page.locator('#proof-title').textContent(),/017/);await page.keyboard.press('Escape');assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
  const refs=await page.evaluate(()=>{const ids=new Set(data.proofs.map(p=>p.id));const sourced=t=>t.text&&t.loc&&[t.ref,...(t.extraRefs||[])].every(id=>ids.has(id));return data.glossary.every(t=>sourced(t)&&(t.examples||[]).every(e=>sourced(e)&&['fact','illustration'].includes(e.kind))&&(t.sections||[]).every(sourced));});assert.equal(refs,true);
  console.log('PASS: map and panel definitions; seven requested terms; proofs; unchanged graph; keyboard/Escape; summary isolation; word boundaries; escaped text; mobile/offline');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
