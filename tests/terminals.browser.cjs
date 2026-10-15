'use strict';
const {chromium}=require(process.argv[2]);
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
const config=JSON.parse(fs.readFileSync(path.join(root,'graph.json'),'utf8'));
const items=new Map([...data.stages,...data.entities].map(node=>[node.id,node]));
const allEdges=[...config.edges,...Object.values(config.expansions).flatMap(spec=>spec.edges)];
const has=(a,b)=>allEdges.some(edge=>edge.source===a&&edge.target===b);
assert.ok(!items.has('final'),'Final approval is a condition of the incoming route, not another card before the King');
assert.equal(items.get('king').number,'06');
for(const source of ['senate','return','senate-review-result','veto-overcome','response-original-text','response-law-type','response-organic-vote','response-restore-original'])assert.ok(has(source,'king'),source+' must send the approved text directly to the King');
assert.ok(allEdges.every(edge=>edge.source!=='final'&&edge.target!=='final'&&edge.source!==edge.target));
assert.deepEqual(allEdges.filter(edge=>edge.source==='king').map(edge=>edge.target),['publication']);
const amendmentEnds=['amend-budget-blocked','amend-organic-blocked','senate-amend-blocked','response-amend-rejected','response-amends-discarded'];
const textEnds=['veto-rejected','single-reading-rejected','organic-rejected','congress-not-taken','senate-not-taken','government-returned','ilp-withdrawn','ilp-expired'];
for(const [kind,ids] of [['amendment',amendmentEnds],['text',textEnds]])for(const id of ids){
 assert.equal(items.get(id)?.endType,kind,id+' must name what ends');
 assert.ok(!allEdges.some(edge=>edge.source===id),id+' must have no continuation');
 assert.ok(items.get(id).facts.every(fact=>fact.ref&&fact.loc));
}
for(const [branch,stop,next] of [['amend-budget-exclude','amend-budget-blocked','amend-organic-effect'],['amend-organic-exclude','amend-organic-blocked','congress-commission'],['senate-amend-exclude','senate-amend-blocked','senate-review-result']]){
 assert.ok(has(branch,stop)&&has(branch,next),'Separate amendment end from the remaining bill: '+branch);
}
assert.ok(has('response-kind','veto-first-vote')&&has('response-kind','response-amend-vote'));
assert.ok(has('veto-first-vote','veto-overcome')&&has('veto-first-vote','veto-wait'));
assert.ok(has('veto-wait','veto-repeat-ordinary')&&has('veto-wait','veto-repeat-organic'));
assert.ok(has('veto-repeat-ordinary','veto-rejected')&&has('veto-repeat-organic','veto-rejected'));
assert.ok(has('response-amendments-present','response-original-text'),'Rejecting all amendments preserves the original bill');
assert.ok(has('response-organic-vote','response-restore-original'),'Failed organic amendment vote restores the original text');
assert.ok(!has('return','senate'));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.goto(pathToFileURL(path.join(root,'index.html')).href+'?lang=ru');await page.evaluate(()=>graph.whenReady());
  await page.evaluate(()=>graph.toggle('return'));
  let view=await page.evaluate(()=>graph.getVisibleGraph());
  assert.ok(!view.edges.some(edge=>edge.id==='return-king'),'Expanded Congress response has no summary shortcut');
  for(const id of ['veto-rejected','response-amend-rejected']){
   assert.ok(view.nodes.some(node=>node.id===id&&node.endType));
   const before=await page.evaluate(()=>graph.getState());await page.evaluate(id=>graph.activate(id),id);
   assert.match(await page.locator('#detail-content .eyebrow').textContent(),/Конец/);
   assert.deepEqual(await page.evaluate(()=>graph.getState()),before,'Reading a terminal does not change the map');
  }
  await page.evaluate(()=>graph.fit());await page.locator('#close-detail').click();
  await page.screenshot({path:path.join(root,'reports/terminal-paths.png')});
  for(const mode of ['ordinary','organic']){
   await page.evaluate(async mode=>{await graph.setLawMode(mode);await graph.expandAll();},mode);
   assert.equal(await page.evaluate(()=>graph.getState().layoutStatus),'ready');view=await page.evaluate(()=>graph.getVisibleGraph());
   assert.equal(view.nodes.some(node=>node.id==='veto-repeat-ordinary'),mode==='ordinary');
   assert.equal(view.nodes.some(node=>node.id==='veto-repeat-organic'),mode==='organic');
   for(const node of view.nodes.filter(node=>node.endType))assert.ok(!view.edges.some(edge=>edge.source===node.id));
  }
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  console.log('PASS: amendment and text terminals; separate bill continuation; ordinary/organic veto votes; amendment decisions and original-text restoration; no bypass; readable, filtered and offline');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
