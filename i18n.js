'use strict';
// Language selection and presentation only; the legal graph and originals stay intact.
window.lawI18n=(()=>{
 const supported=['es','ru','en'];
 function negotiate(header){
  const candidates=String(header).split(',').map((part,index)=>{
   const [tag,...parameters]=part.trim().toLowerCase().split(';');
   const weight=parameters.find(value=>value.trim().startsWith('q='));
   const raw=weight===undefined?'1':weight.trim().slice(2);
   const q=/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(raw)?Number(raw):0;
   return {language:tag.split('-')[0],q,index};
  }).filter(item=>item.q>0&&supported.includes(item.language));
  candidates.sort((a,b)=>b.q-a.q||a.index-b.index);
  return candidates[0]?.language||'es';
 }
 const requested=new URLSearchParams(location.search).get('lang');
 const preferences=window.LAW_ACCEPT_LANGUAGE===null?navigator.languages.join(','):window.LAW_ACCEPT_LANGUAGE;
 const language=supported.includes(requested)?requested:negotiate(preferences);
 const catalog=window.LAW_TRANSLATIONS;
 const dictionary=new Map(catalog.content.map(row=>[row[0],row[supported.indexOf(language)+1]]));
 const locators=new Map(catalog.locators.map(row=>[row[0],row[supported.indexOf(language)+1]]));
 const ui=new Map();
 for(const row of catalog.ui){
  const value=row[supported.indexOf(language)+1];
  // index.html is authored in Spanish; dynamic templates use the retained Russian keys.
  ui.set(row[0],value);ui.set(row[1],value);
 }
 const fragments=catalog.fragments.map(key=>[key,ui.get(key)]).sort((a,b)=>b[0].length-a[0].length);
 function t(value){
  if(locators.has(value))return locators.get(value);
  if(ui.has(value))return ui.get(value);
  if(dictionary.has(value))return dictionary.get(value);
  const trimmed=value.trim();
  if(locators.has(trimmed))return value.replace(trimmed,locators.get(trimmed));
  if(ui.has(trimmed))return value.replace(trimmed,ui.get(trimmed));
  if(dictionary.has(trimmed))return value.replace(trimmed,dictionary.get(trimmed));
  for(const [key,translation] of fragments)value=value.split(key).join(translation);
  return value;
 }
 function locator(value){
  return locators.get(value)??value;
 }
 function localize(value,key=''){
  if(typeof value==='string')return key==='es'?value:key==='loc'?locator(value):(dictionary.get(value)??ui.get(value)??value);
  if(Array.isArray(value))return value.map(item=>localize(item,key));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,name==='aliases'?item:localize(item,name)]));
  return value;
 }
 function translateDOM(root){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode())if(!walker.currentNode.parentElement.closest('pre,script,style,code,textarea,.term-es,.detail-es'))nodes.push(walker.currentNode);
  for(const node of nodes)node.textContent=t(node.textContent);
  const elements=[...(root instanceof Element?[root]:[]),...root.querySelectorAll('[aria-label],[title],[data-claim],[data-loc]')];
  for(const element of elements)for(const attr of ['aria-label','title','data-claim','data-loc'])if(element.hasAttribute(attr))element.setAttribute(attr,attr==='data-loc'?locator(element.getAttribute(attr)):t(element.getAttribute(attr)));
  for(const link of root.querySelectorAll('a[href]')){
   const url=new URL(link.getAttribute('href'),location.href);
   if(url.origin===location.origin&&/(?:\/index\.html|\/)$/.test(url.pathname)){
    url.searchParams.set('lang',language);link.setAttribute('href',url.href);
   }
  }
 }
 function initialize(){
  document.documentElement.lang=language;
  translateDOM(document);
  document.title=t(document.title);
  const description=document.querySelector('meta[name="description"]');
  if(description)description.content=t('Интерактивная карта: как принимают законы в Испании. Этапы, участники и официальные источники.');
  for(const link of document.querySelectorAll('[data-language]')){
   const url=new URL(location.href);url.searchParams.set('lang',link.dataset.language);link.href=url.href;
   if(link.dataset.language===language)link.setAttribute('aria-current','true');
  }
  if(window.LAW_MAP){
   window.LAW_MAP=localize(window.LAW_MAP);
   for(const term of window.LAW_MAP.glossary){
    term.aliases=[...new Set([...term.aliases,...(catalog.aliases[language]?.[term.id]||[])])];
   }
   window.LAW_GRAPH=localize(window.LAW_GRAPH);
  }
 }
 initialize();
 return {language,negotiate,t,translateDOM,localize,locator};
})();
