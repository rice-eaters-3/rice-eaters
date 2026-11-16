'use strict';
// Portrait reworks keep the painted head intact. Feature sprites share its transform;
// authored closed eyelids replace the compressed-eye shortcut in the first draft.
const {decode}=require('./png');
const {writeMoc}=require('./moc-writer');
const {PARAMS,documents}=require('./compiler');
const PARTS=[['Body','몸·의상','body',0],['Head','얼굴·머리카락','head',1],['EyeLOpen','왼쪽 눈','eyeLOpen',2],['EyeROpen','오른쪽 눈','eyeROpen',3],['EyeLClosed','왼쪽 감은 눈','eyeLClosed',4],['EyeRClosed','오른쪽 감은 눈','eyeRClosed',5],['BrowL','왼쪽 눈썹','browL',6],['BrowR','오른쪽 눈썹','browR',7],['MouthClosed','다문 입','mouthClosed',8],['MouthOpen','열린 입','mouthOpen',9],['Accessory','보조 장식','accessory',10],['HairLock','보조 머리카락','hair',11]];
function vtuberPreset(name,title,{eyeY=331,mouthY=417,head=[300,20,724,470],body=[140,410,884,1536]}={}){
 return {name,title,pivot:[512,455],face:[390,275,645,465],targets:[body,head,[427,eyeY,483,eyeY+34],[552,eyeY,608,eyeY+34],[427,eyeY+25,483,eyeY+34],[552,eyeY+25,608,eyeY+34],[427,eyeY-23,483,eyeY-10],[552,eyeY-23,608,eyeY-10],[489,mouthY,541,mouthY+10],[495,mouthY-7,535,mouthY+25],[660,150,715,205],[330,100,410,190]],hidden:['Accessory','HairLock']};
}
const PRESETS={
 shizuku:{name:'Shizuku',title:'시즈쿠 · 음침한 미녀',pivot:[512,442],face:[395,230,640,435],headY:[[0,0],[128,235],[210,430],[270,510],[400,1100]],targets:[[100,390,920,1536],[180,0,844,1050],[441,270,492,295],[546,264,599,289],[441,286,492,295],[546,280,599,289],[440,247,493,259],[546,241,600,253],[503,374,537,382],[500,368,538,401],[400,235,625,320],[750,410,820,850]],hidden:['Accessory','HairLock']},
 miel:vtuberPreset('Miel','미엘 · 고양이 카페',{body:[140,375,884,1536]}),
 nari:vtuberPreset('Nari','나리 · 별빛 사서'),
 ruri:vtuberPreset('Ruri','루리 · 바다 탐험가',{eyeY:310,mouthY:380,body:[140,335,884,1536]}),
 haruto:{name:'Haruto',title:'하루토 · 쾌활한 반장',pivot:[512,310],face:[410,140,620,330],targets:[[78,270,946,1536],[343,0,681,315],[424,179,476,200],[529,177,582,198],[424,192,476,200],[529,190,582,198],[417,157,476,174],[524,155,587,172],[475,279,551,289],[478,269,549,301],[475,390,551,680],[425,0,540,100]],hidden:['Accessory','HairLock']}
};
function bounds(image,index){
 const {width:w,height:h,rgba}=image,cx=index%4,cy=Math.floor(index/4),x0=Math.floor(cx*w/4),x1=Math.floor((cx+1)*w/4),y0=Math.floor(cy*h/3),y1=Math.min(h,Math.floor((cy+1)*h/3)+(index<2?Math.floor(h*.06):0)),cw=x1-x0,ch=y1-y0,seen=new Uint8Array(cw*ch),q=new Int32Array(cw*ch);let best;
 for(let sy=0;sy<ch;sy++)for(let sx=0;sx<cw;sx++){const start=sy*cw+sx;if(seen[start]||rgba[((y0+sy)*w+x0+sx)*4+3]<48)continue;let read=0,count=1,l=x1,t=y1,r=x0,b=y0;q[0]=start;seen[start]=1;while(read<count){const at=q[read++],x=at%cw,y=Math.floor(at/cw);l=Math.min(l,x+x0);r=Math.max(r,x+x0+1);t=Math.min(t,y+y0);b=Math.max(b,y+y0+1);for(const [xx,yy] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(xx<0||xx>=cw||yy<0||yy>=ch)continue;const next=yy*cw+xx;if(!seen[next]&&rgba[((y0+yy)*w+x0+xx)*4+3]>=48){seen[next]=1;q[count++]=next;}}}if(!best||count>best.count)best={source:[l,t,r,b],count};}
 if(!best||best.count<12)throw Error('Missing portrait layer '+index);return best;
}
function analyze(png,id){
 const preset=PRESETS[id];if(!preset)throw Error('Unknown portrait preset');const image=decode(png);let transparent=0;for(let i=3;i<image.rgba.length;i+=4)if(image.rgba[i]<32)transparent++;if(transparent<image.width*image.height*.2)throw Error('Portrait atlas must have alpha transparency');
 return {format:'rice-live2d-portrait-v2',rig:'cohesive-portrait-v2',canvas:[1024,1536],atlas:[image.width,image.height],preset:id,pivot:preset.pivot,face:preset.face,headY:preset.headY||null,layers:PARTS.map(([key,name,role,order],i)=>{const b=bounds(image,i);if(id==='haruto'&&key==='Head')b.source[3]=345;return {id:key,name,role,order,source:b.source,pixelCount:b.count,target:preset.targets[i],visible:!preset.hidden.includes(key)};}),parameters:PARAMS.map(p=>({...p,keys:['miel','nari','ruri'].includes(id)&&p.id==='ParamMouthOpenY'?[0,.2,1]:[...p.keys]}))};
}
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
function interpolate(points,x){for(let i=1;i<points.length;i++){if(x<=points[i][0]){const [a,b]=[points[i-1],points[i]];return a[1]+(b[1]-a[1])*clamp((x-a[0])/(b[0]-a[0]));}}return points.at(-1)[1];}
function rig(project){
 if(project.format!=='rice-live2d-portrait-v2'||project.layers.length!==12)throw Error('Invalid portrait project');const [w,h]=project.canvas,[aw,ah]=project.atlas,[px,py]=project.pivot,face=project.face,parameters=project.parameters||PARAMS,idx=Object.fromEntries(parameters.map((p,i)=>[p.id,i]));
 const meshes=project.layers.filter(l=>l.visible).sort((a,b)=>a.order-b.order).map(layer=>{
  const [x0,y0,x1,y1]=layer.target,[u0,v0,u1,v1]=layer.source,isBody=layer.role==='body',isHead=layer.role==='head',grid=isHead?16:4,vertices=[],uvs=[],indices=[];
  const rows=Array.from({length:grid+1},(_,i)=>i/grid);if(isHead&&project.headY)for(const [source] of project.headY){const fraction=(source-v0)/(v1-v0);if(fraction>0&&fraction<1)rows.push(fraction);}rows.sort((a,b)=>a-b);
  for(const fy of rows)for(let x=0;x<=grid;x++){const fx=x/grid,sx=u0+fx*(u1-u0);let sy=v0+fy*(v1-v0);if(isHead&&project.preset==='haruto')sy=Math.min(sy,Math.max(270,337-.006*(sx-557)**2));const y=isHead&&project.headY?interpolate(project.headY,sy):y0+(sy-v0)/(v1-v0)*(y1-y0);vertices.push(x0+fx*(x1-x0),y);uvs.push(sx/aw,1-sy/ah);}
  for(let y=0;y<rows.length-1;y++)for(let x=0;x<grid;x++){const a=y*(grid+1)+x,b=a+1,c=a+grid+1,d=c+1;indices.push(a,c,b,b,c,d);}
  const bound=['ParamBodyAngleX','ParamBodyAngleZ','ParamBreath'];if(!isBody)bound.push('ParamAngleX','ParamAngleY','ParamAngleZ');if(layer.role.startsWith('eyeL'))bound.push('ParamEyeLOpen');if(layer.role.startsWith('eyeR'))bound.push('ParamEyeROpen');if(layer.role==='browL')bound.push('ParamBrowLY');if(layer.role==='browR')bound.push('ParamBrowRY');if(layer.role.startsWith('mouth'))bound.push('ParamMouthOpenY','ParamMouthForm');if(isHead)bound.push('ParamHairSway');
  // The torso is anchored at the neck. Head/features share the same head transform.
  // Keep body motion below this anchor so separate meshes never open a neck seam.
  const authored=isBody?bound:bound.filter(id=>!['ParamBodyAngleX','ParamBodyAngleZ','ParamBreath'].includes(id));
  function deform(values){const out=[];for(let i=0;i<vertices.length;i+=2){let x=vertices[i],y=vertices[i+1];
   if(layer.role.startsWith('mouth')){const cx=(x0+x1)/2,cy=(y0+y1)/2,form=values.ParamMouthForm||0;x=cx+(x-cx)*(1+.12*form);y-=form*3*(1-Math.abs(x-cx)/((x1-x0)/2));if(layer.role==='mouthOpen')y=cy+(y-cy)*(.12+.88*clamp(values.ParamMouthOpenY||0));}
   if(layer.role==='browL'||layer.role==='browR')y-=(values[layer.role==='browL'?'ParamBrowLY':'ParamBrowRY']||0)*5;
   if(!isBody){if(isHead){const outside=Math.max(clamp((face[0]-x)/70),clamp((x-face[2])/70),clamp((y-face[3])/110)),depth=clamp((y-50)/850);x+=(values.ParamHairSway||0)*outside*depth*9;}
    const ax=(values.ParamAngleX||0)/30,ay=(values.ParamAngleY||0)/30,neck=1-clamp((y-py+42)/65),angle=(values.ParamAngleZ||0)*Math.PI/180*.32;
    // Small draft turns, tapered into the neck, keep features on the same face plane.
    const dx=x-px,dy=y-py;x=px+dx*(1-Math.abs(ax)*.035)+ax*9*neck;y+=ay*7*neck;const rx=x-px,ry=y-py;x=px+rx*Math.cos(angle)-ry*Math.sin(angle);y=py+rx*Math.sin(angle)+ry*Math.cos(angle);
   }
   if(isBody){const amount=clamp((y-py)/180),breath=values.ParamBreath||0,angle=(values.ParamBodyAngleZ||0)*Math.PI/180*.35,dx=x-px,dy=y-py;x=px+dx*Math.cos(angle)-dy*Math.sin(angle)+(values.ParamBodyAngleX||0)*amount*.8;y=py+dx*Math.sin(angle)+dy*Math.cos(angle)-breath*amount*4;x+=(x-px)*breath*.009*amount;}
   out.push((x-w/2)/1000,(h/2-y)/1000);
  }return out;}
  return {id:layer.id,order:500+layer.order,vertices:deform({}),uvs,indices,bound:authored.map(id=>idx[id]),deform,opacity(values){const open=clamp(values[layer.role.startsWith('eyeL')?'ParamEyeLOpen':'ParamEyeROpen']??1);if(layer.role.endsWith('Open')&&layer.role.startsWith('eye'))return clamp((open-.2)/.65);if(layer.role.endsWith('Closed')&&layer.role.startsWith('eye'))return 1-clamp((open-.2)/.65);if(layer.role==='mouthOpen')return clamp((values.ParamMouthOpenY||0)*5);if(layer.role==='mouthClosed')return 1-clamp((values.ParamMouthOpenY||0)*5);return 1;}};
 });
 return {...writeMoc({width:w,height:h,parameters,meshes}),parameters,meshes};
}
function modelDocuments(name,project){return documents(name,project);}
module.exports={PRESETS,analyze,rig,modelDocuments};
