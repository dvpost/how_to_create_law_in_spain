'use strict';
// Definitions are authored and sourced; matching never infers a meaning.
window.createLawGlossary=function(entries,popover,sourceLinks){
 const terms=new Map(entries.map(entry=>[entry.id,entry])),aliases=new Map();
 let enabled=true;
 const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 entries.forEach(entry=>entry.aliases.forEach(alias=>{
  const key=alias.toLocaleLowerCase();
  if(aliases.has(key)&&aliases.get(key)!==entry.id)throw new Error('Ambiguous glossary alias: '+alias);
  aliases.set(key,entry.id);
 }));
 const alternatives=[...aliases.keys()].sort((a,b)=>b.length-a.length).map(alias=>alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 const pattern=new RegExp('(?<![\\p{L}\\p{N}_])('+alternatives.join('|')+')(?![\\p{L}\\p{N}_])','giu');
 function html(value,skip=null){
  if(!enabled)return escape(value);
  const text=String(value);let result='',end=0;
  for(const match of text.matchAll(pattern)){
   result+=escape(text.slice(end,match.index));const id=aliases.get(match[0].toLocaleLowerCase());
   result+=id===skip?escape(match[0]):`<button type="button" class="term" data-term="${id}" aria-haspopup="dialog" aria-label="Пояснить: ${escape(match[0])}">${escape(match[0])}</button>`;
   end=match.index+match[0].length;
  }
  return result+escape(text.slice(end));
 }
 function annotate(root){
  if(!enabled){root.querySelectorAll('[data-term]').forEach(button=>button.replaceWith(document.createTextNode(button.textContent)));return;}
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode()){
   const node=walker.currentNode;
   if(!node.parentElement.closest('button,a,pre,script,style,code,textarea,select,[data-term]'))nodes.push(node);
  }
  nodes.forEach(node=>{
   const markup=html(node.textContent);if(!markup.includes('data-term='))return;
   const template=document.createElement('template');template.innerHTML=markup;node.replaceWith(template.content);
  });
 }
 function close(){if(popover.matches(':popover-open'))popover.hidePopover();}
 function sections(entry){
  if(!entry.sections?.length)return '';
  return `<div class="term-sections">${entry.sections.map(section=>`<section><h4>${escape(section.title)}</h4><p>${html(section.text,entry.id)}</p>${sourceLinks(section)}</section>`).join('')}</div>`;
 }
 function examples(entry){
  if(!entry.examples?.length)return '';
  return `<div class="term-examples">${entry.examples.map(example=>{
   const label=example.kind==='illustration'?'Условный пример':'Пример';
   const claim={...example,text:label+': '+example.text};
   return `<section class="term-example"><h4>${label}</h4><p>${html(example.text,entry.id)}</p>${sourceLinks(claim)}</section>`;
  }).join('')}</div>`;
 }
 function show(id,anchor){
  if(!enabled)return;
  const entry=terms.get(id);if(!entry)throw new Error('Unknown glossary term: '+id);
  const rect=anchor.getBoundingClientRect();
  close();
  popover.classList.toggle('term-extended',Boolean(entry.sections?.length));
  popover.innerHTML=`<div class="term-top"><span class="eyebrow">Пояснение термина</span><button type="button" data-close-term aria-label="Закрыть пояснение">×</button></div><h3 id="term-title">${escape(entry.title)}</h3><p class="term-es">${escape(entry.es)}</p>${entry.status==='partial'?'<p class="term-boundary">Серая область: определены только указанные в законе последствия.</p>':''}<p class="term-definition">${html(entry.text,id)}</p>${sections(entry)}${examples(entry)}<div class="term-sources">Основание определения${sourceLinks(entry)}</div>`;
  popover.showPopover();
  const width=popover.offsetWidth,height=popover.offsetHeight;
  const left=Math.max(12,Math.min(rect.left,innerWidth-width-12));
  const top=rect.bottom+8+height<=innerHeight-12?rect.bottom+8:Math.max(12,rect.top-height-8);
  popover.style.left=left+'px';popover.style.top=top+'px';
 }
 popover.addEventListener('click',event=>{if(event.target.closest('[data-close-term]'))close();});
 return {html,annotate,show,close,setEnabled:value=>{enabled=value;if(!enabled)close();}};
};
