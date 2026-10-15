'use strict';
// Real HTTP boundary: the fixture supplies the request header in the same safe
// JavaScript-string form as nginx. It never consults the browser's locale.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require(process.argv[2]);
const root=path.resolve(__dirname,'..');
const original=JSON.parse(fs.readFileSync(path.join(root,'proofs/001/metadata.json'),'utf8')).sources[0].articles[0].text;
const organicSpanish=JSON.parse(fs.readFileSync(path.join(root,'glossary.json'),'utf8')).find(term=>term.id==='organic').es;
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.wasm':'application/wasm','.txt':'text/plain; charset=utf-8'};
const server=http.createServer((request,response)=>{
 const url=new URL(request.url,'http://127.0.0.1');
 response.setHeader('Cache-Control','no-store');
 if(url.pathname==='/browser-language.js'){
  response.setHeader('Content-Type',mime['.js']);
  response.end('window.LAW_ACCEPT_LANGUAGE = '+JSON.stringify(request.headers['accept-language']||'')+';\n');
  return;
 }
 let pathname;
 try{pathname=decodeURIComponent(url.pathname);}catch{response.writeHead(400).end();return;}
 const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
 const relative=path.relative(root,file);
 if(relative.startsWith('..')||path.isAbsolute(relative)||!mime[path.extname(file)]||!fs.existsSync(file)||!fs.statSync(file).isFile()){
  response.writeHead(404).end();return;
 }
 response.setHeader('Content-Type',mime[path.extname(file)]);
 fs.createReadStream(file).pipe(response);
});

async function ready(page){
 await page.waitForFunction(()=>window.lawI18n&&typeof graph!=='undefined'&&graph);
 assert.equal(await page.evaluate(()=>graph.whenReady()),true,'The translated graph must finish its layout');
 assert.equal(await page.evaluate(()=>graph.getState().layoutStatus),'ready');
 assert.equal(await page.locator('#ui-status').isVisible(),false);
}
async function noCyrillic(page,label){
 if(await page.locator('html').getAttribute('lang')==='ru')return;
 const untranslated=await page.evaluate(()=>{
  const result=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
   const node=walker.currentNode,parent=node.parentElement;
   if(parent.closest('script,style,pre,code,noscript')||!parent.checkVisibility())continue;
   const range=document.createRange();range.selectNodeContents(node);
   if(range.getClientRects().length&&/[\u0400-\u04ff]/.test(node.textContent))result.push(node.textContent.trim());
  }
  for(const element of document.querySelectorAll('[aria-label],[title]')){
   if(!element.checkVisibility())continue;
   for(const attribute of ['aria-label','title']){
    if(attribute==='title'&&element.matches('[data-language="ru"]'))continue;
    const value=element.getAttribute(attribute)||'';
    if(/[\u0400-\u04ff]/.test(value))result.push(attribute+': '+value);
   }
  }
  return result;
 });
 assert.deepEqual(untranslated,[],label+' must have no untranslated Cyrillic');
}
async function noPageScroll(page){
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight&&scrollX===0&&scrollY===0),true,'The map must fit one viewport');
}

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 const errors=[],external=[],failed=[];
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  async function context(header){
   const instance=await browser.newContext({locale:'en-US',viewport:{width:1600,height:1000},reducedMotion:'reduce',extraHTTPHeaders:{'Accept-Language':header}});
   await instance.route('**/*',async route=>{
    if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());await route.abort();return;}
    await route.continue();
   });
   instance.on('page',page=>{
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400)failed.push(response.status()+' '+response.url());});
   });
   return instance;
  }
  // navigator remains English in every context: these assertions distinguish
  // negotiation of the actual request header from client-locale guessing.
  for(const [header,query,expected] of [
   ['ru','', 'ru'],['es-MX','', 'es'],['en-GB','', 'en'],
   ['fr-FR,de;q=0.9','', 'es'],['','', 'es'],
   ['ru;q=0.2,en-US;q=0.9','', 'en'],['ru;q=0,en;q=0.5','', 'en'],
   ['ru','?lang=es','es'],['es','?lang=en','en'],['ru','?lang=invalid','ru']
  ]){
   const instance=await context(header);
   try{
    const page=await instance.newPage();await page.goto(origin+'/index.html'+query);await ready(page);
    assert.equal(await page.evaluate(()=>navigator.language),'en-US');
    assert.equal(await page.evaluate(()=>window.LAW_ACCEPT_LANGUAGE),header);
    assert.equal(await page.locator('html').getAttribute('lang'),expected,JSON.stringify({header,query}));
   }finally{await instance.close();}
  }
  const expectedTitles={es:'Cómo se aprueba una ley · España',ru:'Как появляется закон · Испания',en:'How a law is passed · Spain'};
  const publicationTitles={es:'Publicación y entrada en vigor',ru:'Публикация и вступление в силу',en:'Publication and entry into force'};
  for(const language of ['es','ru','en']){
   const instance=await context(language);
   try{
    const page=await instance.newPage();await page.goto(origin+'/index.html');await ready(page);
    assert.equal(await page.title(),expectedTitles[language]);
    assert.equal(await page.locator('html').getAttribute('lang'),language);
    assert.equal(await page.locator(`[data-language="${language}"]`).getAttribute('aria-current'),'true');
    assert.equal((await page.evaluate(()=>graph.getVisibleGraph())).nodes.length,8);
    assert.ok((await page.locator('[data-node-title="publication"]').textContent()).includes(publicationTitles[language]));
    await noPageScroll(page);await noCyrillic(page,language+' initial map');
    const choices=[
     ['', 'es'],['ru-RU,es;q=0.8','ru'],['ru;q=0.2,en-US;q=0.9','en'],
     ['en;q=0,ru;q=0','es'],['*','es'],['xx,en;q=0.4','en'],
     ['ru;q=invalid,en;q=0.3','en'],['ru;q=1.1,en;q=0.4','en'],
     ['ru;q=0.500,en;q=0.500','ru'],['ES-es;q=1','es']
    ];
    assert.deepEqual(await page.evaluate(cases=>cases.map(([header])=>lawI18n.negotiate(header)),choices),choices.map(([,expected])=>expected),'Header parser respects weights, exclusions, regional tags, order and default');

    // A real card click and inline term click exercise translated HTML labels,
    // the description renderer, glossary aliases and source-link templates.
    const beforeReading=await page.evaluate(()=>graph.getState());
    const publication=await page.evaluate(()=>{
     const node=graph.getGeometry().nodes.find(node=>node.id==='publication'),{zoom,pan}=graph.getState().viewport;
     // A card's title contains real term buttons. Click its blank interior,
     // below the text, so this exercises the underlying Cytoscape node.
     return {x:(node.x+node.width/2)*zoom+pan.x,y:(node.y+node.height-10)*zoom+pan.y};
    });
    await page.mouse.click(publication.x,publication.y);
    assert.equal(await page.locator('#detail-panel').isVisible(),true);
    assert.equal(await page.locator('#detail-content h2').textContent(),publicationTitles[language]);
    await noCyrillic(page,language+' description');
    await page.locator('#detail-content [data-term="boe"]').first().click();
    assert.equal(await page.locator('#term-popover').isVisible(),true);
    assert.ok((await page.locator('.term-definition').textContent()).length>30);
    await noCyrillic(page,language+' glossary');
    assert.deepEqual(await page.evaluate(()=>graph.getState()),beforeReading,'Reading translated content must not alter the map');
    await page.keyboard.press('Escape');await page.locator('#close-detail').click();
    await page.evaluate(()=>showProof('001'));
    assert.equal(await page.locator('#proof-dialog').isVisible(),true);
    assert.equal(await page.locator('#proof-content pre').first().textContent(),original,'Original legal text must remain byte-for-byte Spanish text');
    const proofLink=await page.locator('#proof-content .proof-note a').getAttribute('href');
    assert.equal(new URL(proofLink,origin).searchParams.get('lang'),language);
    await noCyrillic(page,language+' proof dialog');await page.keyboard.press('Escape');
    for(const id of await page.evaluate(()=>data.proofs.map(proof=>proof.id))){
     await page.evaluate(id=>showProof(id),id);
     await page.locator('#proof-content details').evaluateAll(items=>items.forEach(item=>item.open=true));
     await noCyrillic(page,language+' source '+id);await page.keyboard.press('Escape');
    }

    for(const archive of ['proofs','scope']){
     await page.locator('#menu-toggle').click();await page.locator(`[data-archive="${archive}"]`).click();
     assert.equal(await page.locator('#archive-dialog').isVisible(),true);
     if(archive==='proofs'){
      assert.equal(await page.locator('.proof-row').count(),20);
      for(const href of await page.locator('.proof-row a').evaluateAll(links=>links.map(link=>link.href)))assert.equal(new URL(href).searchParams.get('lang'),language);
     }else assert.ok(await page.locator('.scope-row').count());
     await noCyrillic(page,language+' '+archive+' archive');await page.keyboard.press('Escape');
    }
    for(const menu of ['settings','help']){
     await page.locator('#'+menu+'-toggle').click();await noCyrillic(page,language+' '+menu);await page.locator('#'+menu+'-toggle').click();
    }
    // The major translated expansions must remain usable in every language.
    for(const id of ['initiative','admission','senate','return'])await page.evaluate(id=>graph.toggle(id),id);
    await ready(page);await noCyrillic(page,language+' expanded map');
    assert.ok((await page.evaluate(()=>graph.getVisibleGraph())).nodes.length>30);
    for(const id of await page.evaluate(()=>graph.getVisibleGraph().nodes.map(node=>node.id))){
     await page.evaluate(id=>graph.activate(id),id);
     // Open nested facts so their localization is checked as visible content.
     await page.locator('#detail-content details').evaluateAll(items=>items.forEach(item=>item.open=true));
     await noCyrillic(page,language+' card '+id);
    }
    await page.locator('#close-detail').click();
    await page.evaluate(()=>graph.fit());
    for(const id of await page.evaluate(()=>data.glossary.map(term=>term.id))){
     await page.evaluate(id=>glossary.show(id,document.querySelector('[data-node-title="publication"]')),id);
     assert.ok(await page.locator('#term-popover [data-proof]').count(),'Every translated term retains its sources: '+id);
     await noCyrillic(page,language+' term '+id);
    }
    await page.evaluate(()=>glossary.show('organic',document.querySelector('[data-node-title="publication"]')));
    assert.equal(await page.locator('#term-popover .term-es').textContent(),organicSpanish,'The original Spanish legal term must stay Spanish in every language');
    await page.evaluate(()=>glossary.show('jec',document.querySelector('[data-node-title="publication"]')));
    const exampleSource=page.locator('#term-popover .term-example [data-proof="005"]').first();
    const exampleLabel={es:'Ejemplo hipotético:',ru:'Условный пример:',en:'Hypothetical example:'}[language];
    assert.ok((await exampleSource.getAttribute('data-claim')).startsWith(exampleLabel),'An illustration source link carries its translated hypothetical label');
    await exampleSource.click();
    assert.equal(await page.locator('#proof-dialog').isVisible(),true);
    const exampleClaim=await page.locator('.selected-claim').textContent();
    assert.ok(exampleClaim.startsWith(exampleLabel),'Opening illustration evidence must preserve the translated hypothetical label');
    const exampleNumbers=exampleClaim.replace(/[,\s]/g,'');
    assert.ok(exampleNumbers.includes('510000')&&exampleNumbers.includes('490000'),'The source dialog must retain the selected illustration, with localized digit grouping');
    await noCyrillic(page,language+' illustration evidence');
    await page.keyboard.press('Escape');
    if(language==='es'){
     await page.evaluate(()=>graph.reset());await ready(page);
     await page.screenshot({path:path.join(root,'reports/site-es.png')});
     await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{graph.resize();graph.fit();});
     await noPageScroll(page);
     for(const link of await page.locator('.language-controls a').all()){
      const box=await link.boundingBox();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844,'Language controls must fit the mobile viewport');
     }
     const mobileBoxes=await page.evaluate(()=>{
      const bounds=element=>{const {left,top,right,bottom}=element.getBoundingClientRect();return {left,top,right,bottom};};
      return {labels:[...document.querySelectorAll('[data-node-title]')].map(element=>({id:element.dataset.nodeTitle,...bounds(element)})),controls:[...document.querySelectorAll('.map-controls,#fullscreen,.language-controls')].map(bounds)};
     });
     for(const label of mobileBoxes.labels){
      assert.ok(label.left>=0&&label.top>=0&&label.right<=390&&label.bottom<=844,'The fitted mobile title must be in view: '+label.id);
      for(const control of mobileBoxes.controls)assert.equal(label.left<control.right&&label.right>control.left&&label.top<control.bottom&&label.bottom>control.top,false,'Mobile controls must not cover a card title: '+label.id);
     }
     await page.screenshot({path:path.join(root,'reports/site-mobile.png')});
     await page.setViewportSize({width:1600,height:1000});
    }
    // Real links reload the page, preserve the explicit language in the URL,
    // and override the unchanged request header in both directions.
    for(const chosen of ['en','ru','es']){
     await Promise.all([page.waitForURL(url=>url.searchParams.get('lang')===chosen),page.locator(`[data-language="${chosen}"]`).click()]);
     await ready(page);assert.equal(await page.locator('html').getAttribute('lang'),chosen);assert.equal(await page.title(),expectedTitles[chosen]);
    }
    await page.goto(origin+'/proofs/001/index.html?lang='+language);
    await page.waitForFunction(()=>window.lawI18n);
    assert.equal(await page.locator('html').getAttribute('lang'),language);
    assert.equal(await page.locator('pre').first().textContent(),original);
    assert.equal(new URL(await page.locator('a').first().getAttribute('href'),page.url()).searchParams.get('lang'),language);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),true,'Standalone evidence has content below the viewport');
    await page.evaluate(()=>scrollTo(0,150));
    assert.ok(await page.evaluate(()=>scrollY>0),'Standalone evidence must allow scrolling to the rest of the source');
    await page.evaluate(()=>scrollTo(0,0));
    await noCyrillic(page,language+' standalone evidence');
   }finally{await instance.close();}
  }
  assert.deepEqual(errors,[],'No browser script errors');assert.deepEqual(failed,[],'No missing local assets');assert.deepEqual(external,[],'No request may leave the test origin');
  console.log('PASS: real Accept-Language negotiation, q weights/defaults, explicit language links, three translated maps/descriptions/glossaries/archives, intact Spanish evidence, local-only requests and mobile layout');
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
