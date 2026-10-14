'use strict';
// ELK owns stable node placement, port allocation and space for labels.
window.createLawLayout=function(config){
 const engine=new ELK({algorithms:['layered']});
 return async function(nodes,edges){
  const boxes=new Map(nodes.map(node=>[node.id,{...node}])),owners=new Map(),groups=[];
  for(const spec of config.participantGroups){
   if(!boxes.has(spec.participant))continue;
   const stage=boxes.get(spec.stage),participant=boxes.get(spec.participant);
   if(!stage)throw new Error('Participant has no visible stage: '+spec.participant);
   const link=edges.find(edge=>edge.kind==='membership'&&edge.source===stage.id&&edge.target===participant.id);
   if(!link)throw new Error('Participant has no membership link: '+participant.id);
   const gap=Math.max(60,link.labelSize.width+40),height=Math.max(stage.height,participant.height);
   const group={id:'group:'+stage.id,width:participant.width+gap+stage.width,height,
    members:[{...participant,x:0,y:(height-participant.height)/2},{...stage,x:participant.width+gap,y:(height-stage.height)/2}],link};
   groups.push(group);boxes.delete(stage.id);boxes.delete(participant.id);boxes.set(group.id,group);
   group.members.forEach(member=>owners.set(member.id,{group,member}));
  }
  const internal=new Set(groups.map(group=>group.link.id));
  const children=[...boxes.values()].map(box=>({id:box.id,width:box.width,height:box.height,ports:[],
   layoutOptions:{'elk.portConstraints':box.members?'FIXED_POS':'FIXED_SIDE'}}));
  const byId=new Map(children.map(node=>[node.id,node]));
  const ownerId=id=>owners.get(id)?.group.id||id;
  // Build a DAG for layout. Feedback links keep their legal direction in the
  // rendered graph, but cannot make ELK reverse the main legislative procedure.
  const outgoing=new Map(children.map(node=>[node.id,[]])),degrees=new Map(children.map(node=>[node.id,0]));
  for(const edge of edges){
   if(edge.feedback||internal.has(edge.id))continue;
   const a=ownerId(edge.source),b=ownerId(edge.target);outgoing.get(a).push(b);degrees.set(b,degrees.get(b)+1);
  }
  const pending=children.filter(node=>!degrees.get(node.id)).map(node=>node.id),order=new Map();
  for(let i=0;i<pending.length;i++){
   const id=pending[i];order.set(id,i);
   for(const target of outgoing.get(id)){degrees.set(target,degrees.get(target)-1);if(!degrees.get(target))pending.push(target);}
  }
  if(order.size!==children.length)throw new Error('Unclassified cycle in legislative procedure');
  const reversed=new Set(edges.filter(edge=>edge.feedback&&order.get(ownerId(edge.source))>order.get(ownerId(edge.target))).map(edge=>edge.id));
  function port(edge,end){
   const id=edge[end],owner=owners.get(id),node=byId.get(owner?owner.group.id:id),side=edge.kind==='return'||edge.feedback?'WEST':end==='source'?'SOUTH':'NORTH';
   const result={id:edge.id+':'+end,width:0,height:0,layoutOptions:{'elk.port.side':side}};
   if(owner){const m=owner.member;result.x=side==='WEST'?m.x:m.x+m.width/2;result.y=side==='SOUTH'?m.y+m.height:side==='NORTH'?m.y:m.y+m.height/2;}
   node.ports.push(result);return result.id;
  }
  const modelOrder=new Map(children.map((node,index)=>[node.id,index]));
  const orderedEdges=edges.filter(edge=>!internal.has(edge.id)).sort((a,b)=>modelOrder.get(ownerId(a.source))-modelOrder.get(ownerId(b.source))||modelOrder.get(ownerId(a.target))-modelOrder.get(ownerId(b.target)));
  const input={id:'law-map',layoutOptions:config.layout,children,edges:orderedEdges.map(edge=>({
   id:edge.id,sources:[port(edge,reversed.has(edge.id)?'target':'source')],targets:[port(edge,reversed.has(edge.id)?'source':'target')],
   labels:edge.label?[{id:edge.id+':label',text:edge.label,width:edge.labelSize.width,height:edge.labelSize.height,
    layoutOptions:{'elk.edgeLabels.placement':'CENTER'}}]:[]
  }))};
  const result=await engine.layout(input),positions=new Map(),endpoints=new Map();
  for(const node of result.children){
   const group=boxes.get(node.id);
   if(group.members){
    for(const member of group.members)positions.set(member.id,{x:node.x+member.x+member.width/2,y:node.y+member.y+member.height/2});
    const [participant,stage]=group.members,a={x:node.x+stage.x,y:node.y+stage.y+stage.height/2},b={x:node.x+participant.width,y:node.y+participant.y+participant.height/2};
    endpoints.set(group.link.id,{source:a,target:b});
   }else positions.set(node.id,{x:node.x+node.width/2,y:node.y+node.height/2});
  }
  for(const edge of result.edges){
   if(edge.sections?.length!==1)throw new Error('Invalid ELK route: '+edge.id);
   const section=edge.sections[0],ends={source:section.startPoint,target:section.endPoint};
   if(reversed.has(edge.id))[ends.source,ends.target]=[ends.target,ends.source];
   if(Object.values(ends).some(point=>!Number.isFinite(point.x)||!Number.isFinite(point.y)))throw new Error('Invalid ELK coordinates: '+edge.id);
   endpoints.set(edge.id,ends);
  }
  return {positions,endpoints};
 };
};
