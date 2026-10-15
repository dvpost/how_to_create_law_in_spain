'use strict';
const {chromium}=require(process.argv[2]);
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
const config=JSON.parse(fs.readFileSync(path.join(root,'graph.json'),'utf8'));
const items=new Map([...data.stages,...data.entities].map(item=>[item.id,item]));
const allEdges=[...config.edges,...Object.values(config.expansions).flatMap(spec=>spec.edges)];
const link=(a,b)=>allEdges.find(edge=>edge.source===a&&edge.target===b);
assert.equal(items.get('plenary-required')?.title,'Для этого вида текста обязательно одобрение пленума?');
assert.equal(link('plenary-required','congress-plenary')?.label,'Да','An excluded category must go to the Plenary');
assert.equal(link('plenary-required','commission-avocation')?.label,'Нет','Other categories still need the Plenary-retention check');
assert.ok(!items.has('commission-delegable'),'The replaced opposite-polarity decision must be removed');
assert.ok(!items.has('entry'),'A connector must not appear as a separate procedural stage');
assert.equal(data.stages.length,8);
assert.equal(items.get('admission').title,'Внесение и допуск в Конгрессе');
assert.equal(items.get('admission').number,'02');
assert.deepEqual(data.stages.filter(item=>/^\d+$/.test(item.number)).map(item=>item.number),['01','02','03','04','05','06']);
for(const source of ['government-send','congress-deputies','congress-group','senate-send','autonomy-direct','ilp-parliament']){
 assert.ok(link(source,'admission'),source+' must enter the common Congress admission stage');
}
assert.ok(link('admission','congress-mesa'),'Opening the merged stage must expose Mesa admission');
assert.ok(allEdges.every(edge=>edge.source!=='entry'&&edge.target!=='entry'&&edge.source!==edge.target),'No removed connector or self-loop remains');
// These decisions must be explicit, sourced model entries, not generated facts.
for(const id of ['congress-budget-effect','congress-budget-consent','senate-budget-effect','senate-budget-consent','senate-budget-review','amend-budget-effect','amend-budget-consent','senate-amend-consent','senate-amend-review','ilp-extension','ilp-timely','late-organic','plenary-required','commission-avocation']){
 assert.equal(items.get(id)?.kind,'decision',id+' must be an explicit decision');
 assert.ok(items.get(id).facts.some(fact=>fact.ref&&fact.loc),id+' needs exact legal provenance');
}
assert.ok(link('autonomy-direct','admission'),'Autonomy may file in Congress without Government adopting its text');
assert.ok(!link('autonomy-direct','government-source'),'Budget consent must not become a Government proyecto');
assert.ok(link('congress-budget-effect','congress-budget-wait'));
assert.ok(link('congress-budget-effect','congress-budget-consent'));
assert.ok(link('congress-budget-consent','congress-budget-blocked'));
assert.ok(!link('congress-budget-consent','government-approval'),'Consent does not transfer authorship');
assert.ok(!link('senate-mesa','senate-toma'),'Mesa alone must not bypass the Senate budget gate');
assert.ok(link('senate-budget-review','senate-ready')&&link('senate-budget-review','senate-budget-blocked'));
assert.ok(link('senate-ready','senate-toma'));
assert.ok(!link('amend-budget-blocked','amend-organic-effect'));
assert.ok(link('amend-budget-exclude','amend-organic-effect'),'Only the remaining bill continues after an amendment is excluded');
assert.ok(!link('senate-amend-blocked','senate-review-result'));
assert.ok(link('senate-amend-exclude','senate-review-result'));
assert.ok(link('ilp-refused','ilp-appeal')&&link('ilp-blocked','ilp-appeal'));
assert.ok(link('ilp-appeal','ilp-court-result')&&link('ilp-court-result','ilp-court-continue'));
assert.ok(link('ilp-extension','ilp-delivery')&&link('ilp-timely','ilp-expired'));
assert.ok(link('late-organic','late-debate-started')&&link('late-debate-started','late-organic-restart'));
assert.ok(link('senate-session-consent','senate-session-mesa')&&link('senate-session-mesa','senate-session-remedy'));
assert.ok(link('organic-first-vote','organic-new-report')&&link('organic-second-vote','organic-rejected'));
assert.ok(!allEdges.some(edge=>edge.source==='return'&&edge.target==='senate'));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.goto(pathToFileURL(path.join(root,'index.html')).href+'?lang=ru');await page.evaluate(()=>graph.whenReady());
  await page.evaluate(async()=>{await graph.toggle('admission');});
  let visible=await page.evaluate(()=>graph.getVisibleGraph());
  assert.ok(visible.nodes.some(node=>node.id==='congress-budget-effect'&&node.kind==='decision'));
  assert.ok(!visible.edges.some(edge=>edge.source==='congress-budget'&&edge.target==='congress-toma'),'No unconditional approval shortcut');
  await page.evaluate(()=>graph.activate('congress-budget-effect'));
  assert.match(await page.locator('#detail-content').textContent(),/ассигнован/);
  assert.ok(await page.locator('#detail-content [data-proof="006"]').count());
  assert.equal(await page.locator('#detail-content .detail-summary').count(),0,'Do not repeat a sourced paragraph as an identical summary');
  await page.evaluate(()=>graph.activate('congress-budget-consent'));
  await page.locator('#detail-content [data-term="budget-consent"]').first().click();
  assert.match(await page.locator('.term-definition').textContent(),/отличается от позиции/);
  assert.ok(await page.locator('#term-popover [data-proof="006"]').count());await page.keyboard.press('Escape');
  const before=await page.evaluate(()=>graph.getState());await page.evaluate(()=>graph.activate('congress-budget-consent'));
  assert.deepEqual(await page.evaluate(()=>graph.getState()),before,'Reading a condition preserves the map');
  await page.screenshot({path:path.join(root,'reports/budget-conditions.png')});
  await page.evaluate(()=>graph.expandAll());assert.equal(await page.evaluate(()=>graph.getState().layoutStatus),'ready');
  visible=await page.evaluate(()=>graph.getVisibleGraph());
  assert.equal(visible.nodes.length,items.size,'Bulk expansion reaches every explicit conditional branch');
  for(const mode of ['ordinary','organic']){
   await page.evaluate(async mode=>{await graph.setLawMode(mode);await graph.expandAll();},mode);visible=await page.evaluate(()=>graph.getVisibleGraph());
   assert.ok(visible.nodes.some(node=>node.id==='congress-budget-consent'));
   assert.equal(visible.nodes.some(node=>node.id==='congress-full-commission'),mode==='ordinary');
   assert.equal(visible.nodes.some(node=>node.id==='organic-first-vote'),mode==='organic');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  console.log('PASS: conditional budget gates, amendment-only refusal, ILP external bodies, late qualification, delegation and organic votes; sourced, readable, filtered, offline');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
