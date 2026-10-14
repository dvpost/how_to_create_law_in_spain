'use strict';
// Explicit participants and procedures; descriptive facts never generate nodes.
window.createLawGraph=function(container,data,config,callbacks){
 const model=new Map(),expanded=new Set();
 let lawMode='all',returns=true,current=null,revision=0,latest,layoutStatus='pending';
 const arrange=createLawLayout(config),edgeLabels=new Map();
 const kinds={initiative:'source',entry:'gateway',admission:'process',discussion:'process',approval:'process',senate:'process',final:'gateway',king:'actor',publication:'process',return:'process'};
 data.stages.forEach(item=>model.set(item.id,{id:item.id,item,kind:kinds[item.id],core:true,parent:null,children:[]}));
 data.entities.forEach(item=>model.set(item.id,{id:item.id,item,kind:item.kind,core:false,parent:null,children:[]}));
 for(const [id,spec] of Object.entries(config.expansions)){
  if(!model.has(id))throw new Error('Unknown expansion: '+id);
  for(const child of spec.nodes){if(!model.has(child)||model.get(child).parent)throw new Error('Invalid node owner: '+child);model.get(child).parent=id;}
 }
 const allowed=(mode,type=lawMode)=>!mode||type==='all'||mode===type;
 const children=(id,type=lawMode)=>(config.expansions[id]?.nodes||[]).filter(child=>allowed(config.nodeModes[child],type));
 function label(entry){return (entry.core&&entry.item.number?entry.item.number+' · ':'')+entry.item.title;}
 const cy=cytoscape({container,elements:[],layout:{name:'preset'},minZoom:.08,maxZoom:2.5,style:[
  {selector:'node',style:{shape:'round-rectangle',width:'data(width)',height:'data(height)','background-color':'#fffdf8','border-width':1.2,'border-color':'#b7c9c2',label:'',color:'#112a46','font-family':'Segoe UI, Arial, sans-serif','font-size':'data(fontSize)','text-wrap':'wrap','text-max-width':'data(textWidth)','text-valign':'center','text-halign':'center','line-height':1.3,'overlay-opacity':0}},
  {selector:'node.actor',style:{'background-color':'#e0eee7','border-color':'#57988b'}},
  {selector:'node.source',style:{'background-color':'#eaece6','border-color':'#80988c'}},
  {selector:'node.decision',style:{shape:'diamond','background-color':'#f5ead2','border-color':'#c5aa71'}},
  {selector:'node.outcome',style:{'background-color':'#f3e5df','border-color':'#b77265'}},
  {selector:'node.unknown',style:{'background-color':'#e5e5e0','border-color':'#969d96','border-style':'dashed'}},
  {selector:'node.gateway',style:{'background-color':'#e2ecec','border-width':2,'border-color':'#547d80'}},
  {selector:'node[id="king"]',style:{'background-color':'#112a46','border-color':'#112a46',color:'#f7f3ea'}},
  {selector:'node.current',style:{'border-width':3,'border-color':'#187a75'}},
  {selector:'edge',style:{width:1.8,'line-color':'#112a46','target-arrow-color':'#112a46','target-arrow-shape':'triangle','curve-style':'segments','edge-distances':'node-position','segment-weights':'data(weights)','segment-distances':'data(distances)','source-endpoint':'data(sourceEndpoint)','target-endpoint':'data(targetEndpoint)',label:'','font-size':11,color:'#5c6874','text-wrap':'wrap','overlay-opacity':0}},
  {selector:'edge.return',style:{'line-style':'dashed','line-color':'#187a75','target-arrow-color':'#187a75'}},
  {selector:'edge.membership',style:{'line-color':'#8baca2','line-style':'dotted','target-arrow-shape':'none',width:1.4}},
  {selector:'edge.unverified',style:{'line-style':'dotted','line-color':'#969d96','target-arrow-shape':'none'}}
 ]});
 const actions=document.createElement('div');actions.className='node-actions';container.append(actions);
 for(const eventName of ['mousedown','touchstart'])actions.addEventListener(eventName,event=>{if(event.target.closest('a,[data-term]'))event.stopPropagation();});
 function positionActions(){
  const zoom=cy.zoom();
  actions.querySelectorAll('[data-edge-title]').forEach(element=>{
   const edge=cy.getElementById(element.dataset.edgeTitle),label=edgeLabels.get(edge.id());
   if(!label)return;
   const a=edge.source().position(),b=edge.target().position(),pan=cy.pan();
   const p={x:label.x+(a.x-label.source.x+b.x-label.target.x)/2,y:label.y+(a.y-label.source.y+b.y-label.target.y)/2};
   element.style.left=(p.x*zoom+pan.x)+'px';element.style.top=(p.y*zoom+pan.y)+'px';element.style.transform=`translate(-50%,-50%) scale(${zoom})`;
  });
  actions.querySelectorAll('[data-node-toggle],[data-node-title]').forEach(element=>{
   const node=cy.getElementById(element.dataset.nodeToggle||element.dataset.nodeTitle),p=node.renderedPosition();
   const offset=element.dataset.nodeToggle?node.height()/2-18:(node.hasClass('expandable')?-13:0);
   element.style.left=p.x+'px';element.style.top=(p.y+offset*zoom)+'px';element.style.transform=`translate(-50%,-50%) scale(${zoom})`;
  });
 }
 function rebuildActions(){
  actions.replaceChildren();
  cy.nodes().forEach(node=>{
   const entry=model.get(node.id()),title=document.createElement('div');title.className='node-title';title.dataset.nodeTitle=entry.id;
   title.innerHTML=callbacks.formatLabel(node.data('label'));title.style.width=node.style('text-max-width');title.style.fontSize=node.style('font-size');title.style.color=node.style('color');actions.append(title);
   if(!entry.children.length)return;
   const link=document.createElement('a');
   link.href='#'+entry.id;link.setAttribute('role','button');link.dataset.nodeToggle=entry.id;
   link.textContent=`${expanded.has(entry.id)?'Свернуть':'Раскрыть'} (${entry.children.length})`;
   link.setAttribute('aria-expanded',String(expanded.has(entry.id)));link.setAttribute('aria-label',link.textContent+' · '+entry.item.title);
   link.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggle(entry.id);});
   link.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();link.click();}});
   actions.append(link);
  });
  cy.edges().forEach(edge=>{
   if(!edge.data('label'))return;
   const title=document.createElement('div');title.className='edge-title';title.dataset.edgeTitle=edge.id();title.style.width=edge.data('labelSize').width+'px';title.innerHTML=callbacks.formatLabel(edge.data('label'));actions.prepend(title);
  });
  positionActions();
 }
 cy.on('pan zoom resize position render',positionActions);
 function visibleIds(){const ids=[];function visit(id){if(!allowed(config.nodeModes[id]))return;ids.push(id);if(expanded.has(id))children(id).forEach(visit);}data.stages.forEach(s=>{if(s.id!=='return'||returns)visit(s.id);});return ids;}
 function measure(text,className,width,fontSize){
  const element=document.createElement('div');element.className=className;element.innerHTML=callbacks.formatLabel(text);
  Object.assign(element.style,{position:'absolute',visibility:'hidden',width:className==='edge-title'?'max-content':width+'px',maxWidth:width+'px',fontSize:fontSize+'px',transform:'none'});
  document.body.append(element);const size={width:element.offsetWidth,height:element.offsetHeight};element.remove();return size;
 }
 function dimensions(entry){
  const width=entry.kind==='decision'?320:entry.core||entry.id==='senate-commissions'?300:entry.kind==='source'?220:250;
  const textWidth=entry.kind==='decision'?206:width-26,fontSize=['decision','outcome','unknown'].includes(entry.kind)?14:16;
  const text=measure(label(entry),'node-title',textWidth,fontSize);
  return {id:entry.id,width,height:Math.max(entry.kind==='decision'?154:104,text.height+(entry.children.length?52:30)),textWidth,fontSize};
 }
 function snapshot(){
  model.forEach(entry=>entry.children=children(entry.id));
  const ids=visibleIds(),visible=new Set(ids);let edges=[...config.edges];
  ids.forEach(id=>{if(expanded.has(id)){const spec=config.expansions[id];edges=edges.filter(e=>!spec.removeEdges.includes(e.id));edges.push(...spec.edges);}});
  edges=edges.filter(e=>allowed(e.mode)&&(returns||e.kind!=='return')).map(e=>{
   const out={...e,label:lawMode==='organic'&&e.organicLabel?e.organicLabel:lawMode==='all'&&e.organicLabel?e.label+' / органический: '+e.organicLabel:(e.label||''),ref:lawMode==='organic'&&e.organicRef?e.organicRef:e.ref};
   for(const [owner,target] of Object.entries(e.sourceWhenExpanded||{}))if(expanded.has(owner)&&visible.has(target))out.source=target;
   for(const [owner,target] of Object.entries(e.targetWhenExpanded||{}))if(expanded.has(owner)&&visible.has(target))out.target=target;
   out.labelSize=out.label?measure(out.label,'edge-title',235,11):{width:0,height:0};return out;
  }).filter(e=>visible.has(e.source)&&visible.has(e.target));
  return {nodes:ids.map(id=>dimensions(model.get(id))),edges};
 }
 function edgeData(edge,route,positions,sizes){
  const source=positions.get(edge.source),target=positions.get(edge.target);
  const points=route.points.map(point=>({...point}));
  // ELK's rectangular ports are extended to the actual diamond boundary.
  function endpoint(point,id){
   if(model.get(id).kind!=='decision')return point;
   const centre=positions.get(id),size=sizes.get(id),dx=point.x-centre.x,dy=point.y-centre.y;
   const adjusted={...point};
   if(Math.abs(dy)>=size.height/2-.1)adjusted.y=centre.y+Math.sign(dy)*size.height/2*(1-Math.abs(dx)/(size.width/2));
   else adjusted.x=centre.x+Math.sign(dx)*size.width/2*(1-Math.abs(dy)/(size.height/2));
   return adjusted;
  }
  points.unshift(endpoint(points[0],edge.source));points.push(endpoint(points[points.length-1],edge.target));
  const clean=points.filter((point,i)=>!i||Math.hypot(point.x-points[i-1].x,point.y-points[i-1].y)>.01);
  const first=clean[0],last=clean[clean.length-1],bends=clean.slice(1,-1);
  if(!bends.length)bends.push({x:(first.x+last.x)/2,y:(first.y+last.y)/2});
  const dx=target.x-source.x,dy=target.y-source.y,length=Math.hypot(dx,dy);
  if(!length)throw new Error('Coincident connected nodes: '+edge.id);
  const weights=bends.map(point=>((point.x-source.x)*dx+(point.y-source.y)*dy)/(length*length));
  const distances=bends.map(point=>(dx*(point.y-source.y)-dy*(point.x-source.x))/length);
  if(route.label)edgeLabels.set(edge.id,{...route.label,source:{...source},target:{...target}});
  return {...edge,weights,distances,sourceEndpoint:`${first.x-source.x}px ${first.y-source.y}px`,targetEndpoint:`${last.x-target.x}px ${last.y-target.y}px`};
 }
 function rebuild(after=()=>focus(cy.elements())){
  const version=++revision,spec=snapshot();layoutStatus='pending';container.setAttribute('aria-busy','true');cy.nodes().ungrabify();
  latest=(async()=>{
   try{
    const result=await arrange(spec.nodes,spec.edges);
    if(version!==revision)return false;
    const sizes=new Map(spec.nodes.map(node=>[node.id,node]));actions.replaceChildren();edgeLabels.clear();
    cy.batch(()=>{
     cy.elements().remove();
     cy.add(spec.nodes.map(node=>{const entry=model.get(node.id);return {group:'nodes',data:{...node,label:label(entry),kind:entry.kind},position:result.positions.get(node.id),classes:entry.kind+(entry.core?' core':'')+(entry.children.length?' expandable':'')+(node.id===current?' current':'')};}));
     cy.add(spec.edges.map(edge=>({group:'edges',data:edgeData(edge,result.routes.get(edge.id),result.positions,sizes),classes:edge.kind})));
    });
    layoutStatus='ready';rebuildActions();after();callbacks.onError(null);return true;
   }catch(error){
    if(version!==revision)return false;
    layoutStatus='error';cy.elements().remove();actions.replaceChildren();callbacks.onError(error);return false;
   }finally{if(version===revision){container.setAttribute('aria-busy','false');cy.nodes().grabify();}}
  })();return latest;
 }
 function focus(collection,anchor=null){
  cy.fit(collection,35);if(cy.zoom()>1.05)cy.zoom({level:1.05,renderedPosition:{x:container.clientWidth/2,y:container.clientHeight/2}});
  if(anchor&&cy.zoom()<.5){cy.zoom(.5);const p=cy.getElementById(anchor).position();cy.pan({x:container.clientWidth/2-p.x*cy.zoom(),y:90-p.y*cy.zoom()});}
 }
 function select(id){current=id;cy.nodes().removeClass('current');cy.getElementById(id).addClass('current');}
 function collapse(id){expanded.delete(id);(config.expansions[id]?.nodes||[]).forEach(collapse);}
 function subtree(id){return [id,...children(id).flatMap(child=>subtree(child))];}
 function activate(id){
  const entry=model.get(id);if(!entry||!cy.getElementById(id).length)return;
  select(id);callbacks.onSelect(entry,expanded.has(id));
 }
 async function toggle(id){
  const entry=model.get(id);if(!entry||!cy.getElementById(id).length||!entry.children.length)return;current=id;
  if(expanded.has(id))collapse(id);else expanded.add(id);
  const applied=await rebuild(()=>{
   if(expanded.has(id)){const targets=new Set(subtree(id));if(entry.parent)targets.add(entry.parent);if(['government-source','congress-source','senate-source','autonomy-source','ilp-source'].includes(id))targets.add('entry');focus(cy.nodes().filter(n=>targets.has(n.id())),id);}
   else if(entry.parent)focus(cy.getElementById(entry.parent).union(cy.getElementById(id)));else focus(cy.elements());
  });
  if(applied)callbacks.onSelect(entry,expanded.has(id),false);
 }
 cy.on('tap','node',e=>activate(e.target.id()));cy.on('tap','edge',e=>{if(e.target.data('kind')==='collapsed')activate(e.target.source().id());else if(e.target.data('ref'))callbacks.onProof(e.target.data('ref'));});
 function getState(){return {expanded:[...expanded],lawMode,returns,layoutStatus,positions:Object.fromEntries(cy.nodes().map(n=>[n.id(),{...n.position()}])),viewport:{zoom:cy.zoom(),pan:{...cy.pan()}}};}
 rebuild();
 return {activate,toggle,getState,whenReady:()=>latest,
  getGeometry:()=>({nodes:cy.nodes().map(n=>({id:n.id(),x:n.position('x')-n.outerWidth()/2,y:n.position('y')-n.outerHeight()/2,width:n.outerWidth(),height:n.outerHeight()})),edges:cy.edges().map(e=>({id:e.id(),source:e.source().id(),target:e.target().id(),kind:e.data('kind'),points:[e.sourceEndpoint(),...e.segmentPoints(),e.targetEndpoint()]}))}),
  refreshLabels:rebuildActions,getVisibleGraph:()=>({nodes:cy.nodes().map(n=>({id:n.id(),kind:model.get(n.id()).kind,title:model.get(n.id()).item.title,parent:model.get(n.id()).parent,label:n.data('label')})),edges:cy.edges().map(e=>({...e.data()}))}),fit:()=>focus(cy.elements()),
  align:()=>rebuild(),showReturns:value=>{returns=value;return rebuild();},
  setLawMode:async mode=>{if(!['all','ordinary','organic'].includes(mode))throw new Error('Unknown law mode');lawMode=mode;if(mode==='organic'){expanded.add('initiative');expanded.add('ilp-source');}[...expanded].forEach(id=>{if(!children(id).length)collapse(id);});const applied=await rebuild();if(applied&&current&&cy.getElementById(current).length)callbacks.onSelect(model.get(current),expanded.has(current),false);return applied;},
  reset:()=>{expanded.clear();current=null;return rebuild();},resize:()=>cy.resize()};
};
