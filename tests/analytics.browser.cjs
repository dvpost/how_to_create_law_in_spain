'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.argv[2]);
const root=path.resolve(__dirname,'..');
const productionHost='how-to-create-law-in-spain.criteriascout.xyz';
const measurement='G-ZBZX7NP7HV';
const loader='https://www.googletagmanager.com/gtag/js?id='+measurement;
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.wasm':'application/wasm'};

async function check(browser,origin,pathname,enabled){
 const context=await browser.newContext({locale:'es-ES',reducedMotion:'reduce'});
 const errors=[],unexpected=[],google=[];
 try{
  // Every HTTP request is intercepted before network access. The Google stub
  // only marks successful loading; it cannot send collection requests.
  await context.route('**/*',async route=>{
   const requestURL=route.request().url(),url=new URL(requestURL);
   if(requestURL===loader){
    google.push(requestURL);
    await route.fulfill({status:200,contentType:mime['.js'],body:'window.__analyticsLoaderLoaded = true;'});
    return;
   }
   if(url.protocol==='file:'){await route.continue();return;}
   if(url.origin!==origin){unexpected.push(requestURL);await route.abort();return;}
   if(url.pathname==='/browser-language.js'){
    await route.fulfill({status:200,contentType:mime['.js'],body:'window.LAW_ACCEPT_LANGUAGE = "es";'});return;
   }
   let pathname;
   try{pathname=decodeURIComponent(url.pathname);}catch{unexpected.push(requestURL);await route.abort();return;}
   const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
   const relative=path.relative(root,file);
   if(relative.startsWith('..')||path.isAbsolute(relative)||!mime[path.extname(file)]||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    unexpected.push(requestURL);await route.abort();return;
   }
   await route.fulfill({status:200,contentType:mime[path.extname(file)],body:fs.readFileSync(file)});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const url=origin==='file:'?pathToFileURL(path.join(root,pathname)).href:origin+'/'+pathname;
  await page.goto(url+'?lang=es');
  await page.waitForFunction(()=>window.lawI18n);
  if(pathname==='index.html'){
   await page.waitForFunction(()=>typeof graph!=='undefined'&&graph);
   assert.equal(await page.evaluate(()=>graph.whenReady()),true,'Analytics must not prevent map initialization');
  }else assert.ok(await page.locator('pre').count(),'The standalone proof still renders its original documents');
  const actual=await page.evaluate(()=>({
   queue:(window.dataLayer||[]).map(command=>Array.from(command).map(value=>value instanceof Date?'DATE':value)),
   jsDate:(window.dataLayer||[]).filter(command=>command[0]==='js').every(command=>command[1] instanceof Date&&!Number.isNaN(command[1].getTime())),
   loaderLoaded:window.__analyticsLoaderLoaded===true,
   scripts:[...document.scripts].filter(script=>script.src.startsWith('https://www.googletagmanager.com/')).map(script=>({src:script.src,async:script.async}))
  }));
  if(enabled){
   assert.deepEqual(actual.queue,[['js','DATE'],['config',measurement]],url+' initializes exactly one GA4 config with the requested ID');
   assert.equal(actual.jsDate,true);
   assert.deepEqual(actual.scripts,[{src:loader,async:true}],url+' has one asynchronous Google loader');
   assert.equal(actual.loaderLoaded,true,'The stub Google loader actually executes');
   assert.deepEqual(google,[loader],'Exactly one loader request is made');
  }else{
   assert.deepEqual(actual.queue,[],url+' must not queue analytics for local use');
   assert.deepEqual(actual.scripts,[],url+' must not inject the Google loader for local use');
   assert.equal(actual.loaderLoaded,false);
   assert.deepEqual(google,[],url+' must not request Google services');
  }
  assert.deepEqual(unexpected,[],'No unhandled or collection requests are permitted');
  assert.deepEqual(errors,[],'Analytics must not produce browser errors');
 }finally{await context.close();}
}

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const pathname of ['index.html','proofs/001/index.html']){
   for(const origin of ['https://'+productionHost,'http://'+productionHost])await check(browser,origin,pathname,true);
   for(const origin of ['file:','http://localhost','http://127.0.0.1','http://[::1]'])await check(browser,origin,pathname,false);
  }
  console.log('PASS: GA4 config exactly once and async loader on HTTP/HTTPS map and proof; file/localhost/IPv4/IPv6 stay analytics-free; all Google requests stubbed, no real hits');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
