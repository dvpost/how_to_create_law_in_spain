/* Local presentation only. No network, storage, or paid operations. */
'use strict';
const data = window.LAW_MAP;
const t=window.lawI18n.t;
const proofs = new Map(data.proofs.map(proof => [proof.id, proof]));
const viewport = document.getElementById('viewport');
const detail = document.getElementById('detail-content');
const dialog = document.getElementById('proof-dialog');
let selected = null;
let graph;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const glossary=createLawGlossary(data.glossary,document.getElementById('term-popover'),cite);

function cite(item) {
  return [item.ref,...(item.extraRefs || [])].map(id => `<button class="cite" data-proof="${id}" data-loc="${escapeHtml(item.loc || '')}" data-claim="${escapeHtml(item.text || item.summary || '')}">Источник №${id}${item.loc ? ' · '+escapeHtml(item.loc) : ''}</button>`).join('');
}
function facts(items = []) {
  return `<ul class="facts">${items.map(item => `<li>${escapeHtml(item.text)}${cite(item)}</li>`).join('')}</ul>`;
}
function topics(items=[]) {
  return items.map(item=>`<details><summary>${escapeHtml(item.title)}</summary>${facts(item.facts)}${topics(item.children||[])}</details>`).join('');
}
const detailPanel=document.getElementById('detail-panel');
const archiveDialog=document.getElementById('archive-dialog');
function closeDetail(){if(detailPanel.matches(':popover-open'))detailPanel.hidePopover();}
function showItem(entry,isExpanded,openDescription=true){
 selected=entry.id;glossary.close();
 if(!document.getElementById('show-descriptions').checked){closeDetail();return;}
 const item=entry.item,labels={actor:'Участник процесса',source:'Источник инициативы',process:'Процедурное действие',decision:'Процедурное решение',gateway:'Состояние документа',outcome:'Результат / ограничение',unknown:'Серая область'};
 const ending={amendment:'Конец пути поправки',text:'Конец рассмотрения этого текста'};
 detail.innerHTML=`<p class="eyebrow">${ending[item.endType]||labels[entry.kind]}</p><h2>${escapeHtml(item.title)}</h2>${item.es?`<p class="detail-es">${escapeHtml(item.es)}</p>`:''}${item.summary?`<p class="detail-summary">${escapeHtml(item.summary)}${cite(item)}</p>`:''}${facts(item.facts)}${topics(item.topics)}${item.note?`<p class="note">${escapeHtml(item.note)}</p>`:''}`;
 window.lawI18n.translateDOM(detail);glossary.annotate(detail);detailPanel.scrollTop=0;
 if(openDescription&&!detailPanel.matches(':popover-open'))detailPanel.showPopover();
 if(detailPanel.matches(':popover-open')){
  const anchor=document.querySelector(`[data-node-title="${entry.id}"]`).getBoundingClientRect();
  const onRight=anchor.left+anchor.width/2>innerWidth/2;
  detailPanel.style.right=onRight?'auto':'14px';detailPanel.style.left=onRight?Math.max(12,Math.min(innerWidth-detailPanel.offsetWidth-12,anchor.left-detailPanel.offsetWidth-18))+'px':'auto';
 }
}
function showProof(id, claim = '', locator = '') {
  glossary.close();
  const proof = proofs.get(id);
  document.getElementById('proof-content').innerHTML = `<h2 id="proof-title">Источник №${proof.id} · ${escapeHtml(proof.title)}</h2>${claim ? `<div class="selected-claim">${escapeHtml(claim)}<small>${escapeHtml(locator || 'Основание раскрыто ниже')}</small></div>` : ''}<p class="proof-note">CE — Конституция; RCD — Регламент Конгресса; RS — Регламент Сената. Оригиналы ниже — на испанском. <a href="proofs/${id}/index.html" target="_blank" rel="noopener">Открыть папку пруфа</a></p>${proof.sources.map(source => `<section class="proof-source"><h3>${escapeHtml(source.title)}</h3><p class="proof-meta">${escapeHtml(source.version)}<br>Загружено: ${escapeHtml(source.retrieved_at_utc)}<br>SHA-256: ${source.sha256}</p><div class="proof-links"><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">Официальный источник ↗</a><a href="proofs/${id}/${source.key}.html" download>Сохранённый исходный HTML ↓</a></div>${source.articles.map((article, index) => `<details${index===0 ? ' open' : ''}><summary>${escapeHtml(article.heading)}</summary><pre>${escapeHtml(article.text)}</pre><a href="${escapeHtml(source.url+'#'+article.anchor)}" target="_blank" rel="noopener">Статья на официальном сайте ↗</a></details>`).join('')}</section>`).join('')}`;
  window.lawI18n.translateDOM(document.getElementById('proof-content'));glossary.annotate(document.getElementById('proof-content'));
  dialog.showModal(); dialog.scrollTop=0;
}
function renderCatalog() {
  document.getElementById('proof-catalog').innerHTML = data.proofs.map(proof => `<article class="proof-row"><span class="proof-number">${proof.id}</span><div><h3>${escapeHtml(proof.title)}</h3><a href="proofs/${proof.id}/index.html" target="_blank" rel="noopener">Локальный пруф ↗</a></div><button data-proof="${proof.id}">Читать</button></article>`).join('');
  document.getElementById('scope-list').innerHTML = data.scope.map(item => `<article class="scope-row${item.unknown ? ' unknown' : ''}"><div><h3>${escapeHtml(item.title)}</h3><span class="status">${item.unknown ? 'Серая область · не проверено' : 'Граница подтверждена'}</span></div><div><p>${escapeHtml(item.text)}</p>${item.ref ? cite(item) : ''}</div></article>`).join('');
  window.lawI18n.translateDOM(archiveDialog);
}

document.addEventListener('click',event=>{
 const term=event.target.closest('[data-term]');
 if(term){event.preventDefault();event.stopPropagation();glossary.show(term.dataset.term,term);return;}
 const proof=event.target.closest('[data-proof]');
 if(proof){showProof(proof.dataset.proof,proof.dataset.claim||'',proof.dataset.loc||'');return;}
 const archive=event.target.closest('[data-archive]');
 if(archive){
  document.getElementById('project-menu').hidePopover();glossary.close();closeDetail();
  document.getElementById('archive-title').textContent=t(archive.dataset.archive==='proofs'?'Источники и пруфы':'Границы исследования');
  for(const name of ['proofs','scope'])document.getElementById(name+'-view').hidden=name!==archive.dataset.archive;
  renderCatalog();glossary.annotate(document.getElementById(archive.dataset.archive+'-view'));archiveDialog.showModal();archiveDialog.scrollTop=0;
 }
 if(event.target.closest('[data-close-archive]'))archiveDialog.close();
});
document.getElementById('close-detail').addEventListener('click',closeDetail);
document.getElementById('close-proof').addEventListener('click',()=>dialog.close());
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!dialog.open&&!archiveDialog.open&&!document.getElementById('term-popover').matches(':popover-open'))closeDetail();
});
document.getElementById('align').addEventListener('click',()=>graph.align());
document.getElementById('expand-all').addEventListener('click',()=>{glossary.close();closeDetail();selected=null;graph.expandAll();});
document.getElementById('reset-map').addEventListener('click',()=>{glossary.close();closeDetail();selected=null;graph.reset();});
document.getElementById('show-descriptions').addEventListener('change',event=>{if(!event.target.checked)closeDetail();});
document.getElementById('show-terms').addEventListener('change',event=>{
 glossary.setEnabled(event.target.checked);graph.refreshLabels();
 for(const node of [detail,document.getElementById('proof-content'),document.getElementById('proofs-view'),document.getElementById('scope-view')])glossary.annotate(node);
});
document.getElementById('show-returns').addEventListener('change',event=>graph.showReturns(event.target.checked));
document.querySelectorAll('input[name="law"]').forEach(input=>input.addEventListener('change',async()=>{
 await graph.setLawMode(input.value);
 if(selected&&!graph.getVisibleGraph().nodes.some(node=>node.id===selected))closeDetail();
}));
document.getElementById('fullscreen').addEventListener('click',async()=>{
 const status=document.getElementById('ui-status');status.hidden=true;
 try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
 catch(error){status.textContent=t('Браузер не включил полноэкранный режим: ')+t(error.message);status.hidden=false;}
});
document.addEventListener('fullscreenchange',()=>{
 const button=document.getElementById('fullscreen'),label=t(document.fullscreenElement?'Выйти из полноэкранного режима':'Развернуть на весь экран');
 button.setAttribute('aria-label',label);button.title=label;graph.resize();graph.fit();
});
graph=createLawGraph(viewport,data,window.LAW_GRAPH,{formatLabel:text=>glossary.html(text),onSelect:showItem,onProof:id=>showProof(id),onError:error=>{const status=document.getElementById('ui-status');status.hidden=!error;status.textContent=error?t('Не удалось построить карту: ')+t(error.message):'';}});
window.addEventListener('resize',()=>graph.resize());
