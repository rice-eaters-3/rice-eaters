'use strict';
const crypto=require('node:crypto');
const {decode}=require('./png');
const {writeMoc}=require('./moc-writer');
const {PARAMS,documents}=require('./compiler');
// Facial anatomy is painted in the canonical portrait. Rectangles below select
// expression edits in ORIGINAL image coordinates; they never relocate features.
const PARAMETERS=PARAMS.filter(p=>!['ParamBrowLY','ParamBrowRY'].includes(p.id)).map(p=>({...p,keys:p.id==='ParamMouthOpenY'?[0,.18,1]:p.id.startsWith('ParamEye')?[0,.2,.8,1]:[...p.keys]}));
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const intersects=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
function split(rect,cut){
 if(!intersects(rect,cut))return [rect];const [l,t,r,b]=rect,x0=Math.max(l,cut[0]),y0=Math.max(t,cut[1]),x1=Math.min(r,cut[2]),y1=Math.min(b,cut[3]);
 return [[l,t,r,y0],[l,y0,x0,y1],[x0,y0,x1,y1],[x1,y0,r,y1],[l,y1,r,b]].filter(a=>a[2]>a[0]&&a[3]>a[1]);
}
function rawCanonical(atlas,metadata){const {width,rgba}=decode(atlas),[l,t,r,b]=metadata.reference.rect,result=Buffer.alloc((r-l)*(b-t)*4);for(let y=t;y<b;y++)rgba.copy(result,(y-t)*(r-l)*4,(y*width+l)*4,(y*width+r)*4);return result;}
function createProject(metadata,atlas){
 const raw=rawCanonical(atlas,metadata);if(crypto.createHash('sha256').update(raw).digest('hex')!==metadata.reference.rgbaSha256)throw Error('Canonical portrait changed during texture packing');
 const [w,h]=metadata.canvas,[ox,oy]=metadata.reference.rect,alpha=(x,y)=>raw[(y*w+x)*4+3];
 function trim(rect){let l=w,t=h,r=0,b=0;for(let y=rect[1];y<rect[3];y++)for(let x=rect[0];x<rect[2];x++)if(alpha(x,y)){l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=Math.max(b,y+1);}return r>l&&b>t?[l,t,r,b]:null;}
 const neck=metadata.neck,face=metadata.face;
 let rectangles=[[0,0,face[0],neck[1]],[face[0],0,face[2],neck[1]],[face[2],0,w,neck[1]],[0,neck[1],w,h]];
 rectangles=rectangles.flatMap(rect=>split(rect,metadata.mouth));
 const layers=rectangles.map(trim).filter(Boolean).map((rect,i)=>({id:'Portrait_'+i,name:'원화 영역 '+(i+1),kind:'base',target:rect,source:[rect[0]+ox,rect[1]+oy,rect[2]+ox,rect[3]+oy],visible:true,order:i}));
 for(const [key,patch] of Object.entries(metadata.patches))layers.push({id:key,name:{EyeLClosed:'왼쪽 눈 감김',EyeRClosed:'오른쪽 눈 감김',MouthOpen:'말하기'}[key],kind:key,target:patch.target,source:patch.source,visible:true,order:layers.length});
 return {...metadata,format:'rice-live2d-registered-v3',rig:'canonical-portrait-v3',parameters:PARAMETERS,layers};
}
function rig(project){
 if(project.format!=='rice-live2d-registered-v3')throw Error('Invalid registered portrait');
 const [w,h]=project.canvas,[aw,ah]=project.atlas,face=project.face,neck=project.neck,[px,py]=project.pivot,mouth=project.mouth,parameters=project.parameters,index=Object.fromEntries(parameters.map((p,i)=>[p.id,i]));
 const xs=new Set([0,w,face[0],face[2]]),ys=new Set([0,h,...neck]);for(let x=0;x<=w;x+=64)xs.add(x);for(let y=0;y<=h;y+=64)ys.add(y);
 for(const layer of project.layers){const r=layer.target;xs.add(r[0]);xs.add(r[2]);ys.add(r[1]);ys.add(r[3]);if(layer.kind!=='base'){xs.add((r[0]+r[2])/2);ys.add((r[1]+r[3])/2);}}
 const allX=[...xs].sort((a,b)=>a-b),allY=[...ys].sort((a,b)=>a-b);
 function localWeight(rect,x,y){if(x<=rect[0]||x>=rect[2]||y<=rect[1]||y>=rect[3])return 0;return Math.sin(Math.PI*(x-rect[0])/(rect[2]-rect[0]))**2*Math.sin(Math.PI*(y-rect[1])/(rect[3]-rect[1]))**2;}
 function transform(x,y,v,kind){
  const mw=localWeight(mouth,x,y),cx=(mouth[0]+mouth[2])/2,cy=(mouth[1]+mouth[3])/2,form=v.ParamMouthForm||0;
  x+=(x-cx)*form*.09*mw;y-=form*2*mw;
  if(kind==='MouthOpen')y+=(cy-y)*(1-(.65+.35*(v.ParamMouthOpenY||0)))*mw;
  const head=1-smooth(neck[0],neck[1],y),outer=Math.max(smooth(0,100,face[0]-x),smooth(0,100,x-face[2]));
  x+=(v.ParamHairSway||0)*4*outer*smooth(100,260,y)*head;
  const ax=(v.ParamAngleX||0)/30,ay=(v.ParamAngleY||0)/30,roll=(v.ParamAngleZ||0)*Math.PI/180*.38*head;
  x=px+(x-px)*(1-.07*Math.abs(ax)*head)+ax*9*head;y+=ay*8*head;
  let dx=x-px,dy=y-py;x=px+dx*Math.cos(roll)-dy*Math.sin(roll);y=py+dx*Math.sin(roll)+dy*Math.cos(roll);
  const torso=smooth(neck[1],neck[1]+180,y),breath=v.ParamBreath||0;
  x+=(v.ParamBodyAngleX||0)*.8*torso;x+=(x-px)*breath*.007*torso*(1-smooth(1200,h,y));y-=breath*3*torso*(1-smooth(1200,h,y));
  const body=(v.ParamBodyAngleZ||0)*Math.PI/180*.35;dx=x-px;dy=y-py;x=px+dx*Math.cos(body)-dy*Math.sin(body);y=py+dx*Math.sin(body)+dy*Math.cos(body);
  return [(x-w/2)/1000,(h/2-y)/1000];
 }
 const meshes=project.layers.filter(l=>l.visible).map(layer=>{
  const rect=layer.target,[l,t,r,b]=rect,[sl,st,sr,sb]=layer.source,xx=allX.filter(x=>x>=l&&x<=r),yy=allY.filter(y=>y>=t&&y<=b),points=[],uvs=[],indices=[];
  for(const y of yy)for(const x of xx){points.push(x,y);uvs.push((sl+(x-l)/(r-l)*(sr-sl))/aw,1-(st+(y-t)/(b-t)*(sb-st))/ah);}
  for(let y=0;y<yy.length-1;y++)for(let x=0;x<xx.length-1;x++){const a=y*xx.length+x,c=a+xx.length;indices.push(a,c,a+1,a+1,c,c+1);}
  const ids=['ParamBodyAngleZ'];if(t<neck[1])ids.push('ParamAngleX','ParamAngleY','ParamAngleZ');if(b>neck[1])ids.push('ParamBodyAngleX','ParamBreath');if(t<neck[1]&&b>100&&(l<face[0]||r>face[2]))ids.push('ParamHairSway');if(intersects(rect,mouth))ids.push('ParamMouthForm');if(layer.kind==='EyeLClosed')ids.push('ParamEyeLOpen');if(layer.kind==='EyeRClosed')ids.push('ParamEyeROpen');if(layer.kind==='MouthOpen')ids.push('ParamMouthOpenY');
  const deform=v=>{const out=[];for(let i=0;i<points.length;i+=2)out.push(...transform(points[i],points[i+1],v,layer.kind));return out;};
  return {id:layer.id,order:500+layer.order,vertices:deform({}),uvs,indices,bound:ids.map(id=>index[id]),deform,opacity(v){if(layer.kind==='EyeLClosed')return 1-clamp(((v.ParamEyeLOpen??1)-.2)/.6);if(layer.kind==='EyeRClosed')return 1-clamp(((v.ParamEyeROpen??1)-.2)/.6);if(layer.kind==='MouthOpen')return clamp((v.ParamMouthOpenY||0)/.18);return 1;},sourcePoints:points,kind:layer.kind};
 });
 return {...writeMoc({width:w,height:h,parameters,meshes}),parameters,meshes};
}
function modelDocuments(name,project){const out=documents(name,project);out[name+'.cdi3.json'].Parameters=project.parameters.map(p=>({Id:p.id,GroupId:'',Name:p.name}));return out;}
module.exports={PARAMETERS,createProject,rawCanonical,rig,modelDocuments};
