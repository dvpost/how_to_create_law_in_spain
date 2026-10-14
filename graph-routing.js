'use strict';
// The single connector router, used for automatic layouts and manual drops.
window.createLawRouter=function(){
 let ready;
 return async function(nodes,edges){
  if(!ready)ready=AvoidLib.load().then(()=>AvoidLib.getInstance());
  const A=await ready,router=new A.Router(2),shapes=new Map(),routes=new Map(); // libavoid OrthogonalRouting = 2
  try{
   router.setRoutingParameter(A.RoutingParameter.shapeBufferDistance,8);
   router.setRoutingParameter(A.RoutingParameter.idealNudgingDistance,10);
   router.setRoutingParameter(A.RoutingParameter.segmentPenalty,30);
   router.setRoutingParameter(A.RoutingParameter.crossingPenalty,100);
   for(const node of nodes){
    const centre=new A.Point(node.x,node.y),rectangle=new A.Rectangle(centre,node.width,node.height);
    shapes.set(node.id,{node,shape:new A.ShapeRef(router,rectangle),nextPin:1});rectangle.delete();centre.delete();
   }
   function end(id,offset){
    const {node,shape}=shapes.get(id),holder=shapes.get(id),pinId=holder.nextPin++;
    const vertical=Math.abs(offset.y)/(node.height/2)>=Math.abs(offset.x)/(node.width/2);
    const direction=vertical?(offset.y<0?1:2):(offset.x<0?4:8);
    const pin=new A.ShapeConnectionPin(shape,pinId,.5+offset.x/node.width,.5+offset.y/node.height,true,0,direction);
    pin.setExclusive(false);return new A.ConnEnd(shape,pinId);
   }
   const connectors=edges.map(edge=>{
    const source=end(edge.source,edge.sourceOffset),target=end(edge.target,edge.targetOffset);
    const connector=new A.ConnRef(router,source,target);source.delete();target.delete();return {edge,connector};
   });
   router.processTransaction();
   for(const {edge,connector} of connectors){
    const line=connector.displayRoute(),points=[];
    for(let i=0;i<line.size();i++){const point=line.at(i);points.push({x:point.x,y:point.y});point.delete();}
    if(points.length<2)throw new Error('Не найден путь стрелки: '+edge.id);
    for(let i=1;i<points.length;i++)if(Math.abs(points[i].x-points[i-1].x)>.1&&Math.abs(points[i].y-points[i-1].y)>.1)throw new Error('Непрямоугольный путь стрелки: '+edge.id);
    routes.set(edge.id,{points,label:null});
   }
   const labels=[];
   const overlaps=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
   function cuts(a,b,box){
    return Math.abs(a.x-b.x)<.1?a.x>box.x&&a.x<box.x+box.width&&Math.max(a.y,b.y)>box.y&&Math.min(a.y,b.y)<box.y+box.height:
     a.y>box.y&&a.y<box.y+box.height&&Math.max(a.x,b.x)>box.x&&Math.min(a.x,b.x)<box.x+box.width;
   }
   for(const edge of edges.filter(edge=>edge.label)){
    const route=routes.get(edge.id),candidates=[],size=edge.labelSize;
    const segments=route.points.slice(1).map((b,i)=>({a:route.points[i],b,length:Math.hypot(b.x-route.points[i].x,b.y-route.points[i].y)})).sort((a,b)=>b.length-a.length);
    for(const [rank,{a,b}] of segments.entries())for(const fraction of [.5,.25,.75])for(const side of [-1,1]){
     const horizontal=Math.abs(a.y-b.y)<.1,x=a.x+(b.x-a.x)*fraction+(horizontal?0:side*(size.width/2+6)),y=a.y+(b.y-a.y)*fraction+(horizontal?side*(size.height/2+6):0);
     const box={x:x-size.width/2,y:y-size.height/2,...size};let score=rank*.1+Math.abs(fraction-.5);
     for(const node of nodes)if(overlaps(box,{x:node.x-node.width/2,y:node.y-node.height/2,width:node.width,height:node.height}))score+=1000;
     for(const placed of labels)if(overlaps(box,placed))score+=100;
     for(const [id,other] of routes)if(id!==edge.id&&other.points.slice(1).some((point,i)=>cuts(other.points[i],point,box)))score+=10;
     candidates.push({x,y,box,score});
    }
    candidates.sort((a,b)=>a.score-b.score);const chosen=candidates[0];route.label={x:chosen.x,y:chosen.y};labels.push(chosen.box);
   }
   return routes;
  }finally{router.delete();}
 };
};
