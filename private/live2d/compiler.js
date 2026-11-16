'use strict';
const {decode}=require('./png.js');
const {writeMoc}=require('./moc-writer.js');
const PARTS=[
 ['HairBack','뒷머리',[268,100,756,760],'hair',0],
 ['Body','의상·목',[150,592,874,1500],'body',1],
 ['Face','얼굴',[334,178,690,650],'head',4],
 ['HairFront','앞머리',[276,95,748,395],'hair',13],
 ['EyeL','왼쪽 눈',[369,360,477,437],'eyeL',5],
 ['EyeR','오른쪽 눈',[547,360,655,437],'eyeR',6],
 ['MouthClosed','다문 입',[468,520,556,548],'mouthClosed',9],
 ['MouthOpen','열린 입',[475,510,549,570],'mouthOpen',10],
 ['BrowL','왼쪽 눈썹',[374,331,478,352],'browL',7],
 ['BrowR','오른쪽 눈썹',[546,331,650,352],'browR',8],
 ['EarL','왼쪽 귀',[307,365,356,477],'head',2],
 ['EarR','오른쪽 귀',[668,365,717,477],'head',3],
 ['HairSideL','왼쪽 옆머리',[286,285,375,760],'hair',11],
 ['HairSideR','오른쪽 옆머리',[649,285,738,760],'hair',12],
 ['StarClip','머리 장식',[655,249,717,297],'head',14],
 ['Ribbon','리본',[430,721,594,836],'body',15]
];
const PARAMS=[
 ['ParamAngleX','고개 좌우',-30,30,0,[-30,0,30]],['ParamAngleY','고개 상하',-30,30,0,[-30,0,30]],['ParamAngleZ','고개 기울기',-30,30,0,[-30,0,30]],
 ['ParamEyeLOpen','왼쪽 눈',0,1,1,[0,1]],['ParamEyeROpen','오른쪽 눈',0,1,1,[0,1]],
 ['ParamBrowLY','왼쪽 눈썹',-1,1,0,[-1,0,1]],['ParamBrowRY','오른쪽 눈썹',-1,1,0,[-1,0,1]],
 ['ParamMouthOpenY','입 벌리기',0,1,0,[0,1]],['ParamMouthForm','입 모양',-1,1,0,[-1,0,1]],
 ['ParamBodyAngleX','몸 좌우',-10,10,0,[-10,0,10]],['ParamBodyAngleZ','몸 기울기',-10,10,0,[-10,0,10]],
 ['ParamBreath','호흡',0,1,0,[0,1]],['ParamHairSway','머리카락 흔들림',-1,1,0,[-1,0,1]]
].map(([id,name,min,max,def,keys])=>({id,name,min,max,default:def,keys}));
function analyzeAtlas(png){
 const {width,height,rgba}=decode(png);if(width!==height||width<512)throw Error('512px 이상 정사각형 파츠 아틀라스가 필요합니다.');
 let transparent=0;for(let i=3;i<rgba.length;i+=4)if(rgba[i]<32)transparent++;
 if(transparent/(width*height)<0.15)throw Error('투명 배경이 없습니다. 투명 PNG를 지원하는 이미지 모델을 연결해 주세요.');
 const layers=PARTS.map(([id,name,target,role,order],index)=>{
  const cx=index%4,cy=Math.floor(index/4),x0=Math.floor(cx*width/4),y0=Math.floor(cy*height/4),x1=Math.floor((cx+1)*width/4),y1=Math.floor((cy+1)*height/4);
  const cw=x1-x0,ch=y1-y0,seen=new Uint8Array(cw*ch),queue=new Int32Array(cw*ch);let best=null;
  for(let sy=0;sy<ch;sy++)for(let sx=0;sx<cw;sx++){
   const start=sy*cw+sx;if(seen[start]||rgba[((y0+sy)*width+x0+sx)*4+3]<=48)continue;
   let read=0,write=1,left=x1,top=y1,right=x0,bottom=y0;queue[0]=start;seen[start]=1;
   while(read<write){const pos=queue[read++],x=pos%cw,y=Math.floor(pos/cw);left=Math.min(left,x+x0);right=Math.max(right,x+x0+1);top=Math.min(top,y+y0);bottom=Math.max(bottom,y+y0+1);
    for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(nx<0||nx>=cw||ny<0||ny>=ch)continue;const ni=ny*cw+nx;if(!seen[ni]&&rgba[((y0+ny)*width+x0+nx)*4+3]>48){seen[ni]=1;queue[write++]=ni;}}
   }
   if(!best||write>best.count)best={left,top,right,bottom,count:write};
  }
  const {left,top,right,bottom,count}=best||{left:0,top:0,right:0,bottom:0,count:0};
  if(count<16||right<=left||bottom<=top)throw Error(name+' 파츠가 비어 있습니다. 결과 이미지를 확인하고 다시 생성해 주세요.');
  return {id,name,role,order,source:[left,top,right,bottom],target:[...target],visible:true,pixelCount:count};
 });
 return {format:'rice-live2d-project-v1',canvas:[1024,1536],atlas:[width,height],layers,parameters:PARAMS.map(p=>({...p})),rig:'automatic-draft-v1'};
}
function validateProject(project){
 if(project?.format!=='rice-live2d-project-v1'||!Array.isArray(project.layers)||project.layers.length!==16)throw Error('프로젝트 형식이 올바르지 않습니다.');
 const expected=new Map(PARTS.map(p=>[p[0],p]));
 for(const layer of project.layers){
  if(!expected.has(layer.id))throw Error('알 수 없는 파츠입니다.');expected.delete(layer.id);
  if(!Array.isArray(layer.target)||layer.target.length!==4||layer.target.some(v=>!Number.isFinite(v)||v< -1024||v>3072)||layer.target[2]-layer.target[0]<2||layer.target[3]-layer.target[1]<2)throw Error('파츠 배치 범위가 올바르지 않습니다.');
 }
 if(expected.size)throw Error('중복된 파츠입니다.');return project;
}
function rig(project){
 validateProject(project);const [w,h]=project.canvas,[aw,ah]=project.atlas,parameters=PARAMS;
 const idx=Object.fromEntries(parameters.map((p,i)=>[p.id,i]));
 const meshes=project.layers.filter(l=>l.visible!==false).sort((a,b)=>a.order-b.order).map(layer=>{
  const [x0,y0,x1,y1]=layer.target,[u0,v0,u1,v1]=layer.source,vertices=[],uvs=[],indices=[],grid=4;
  for(let y=0;y<=grid;y++)for(let x=0;x<=grid;x++){const fx=x/grid,fy=y/grid;vertices.push((x0+fx*(x1-x0)-w/2)/1000,(h/2-y0-fy*(y1-y0))/1000);uvs.push((u0+fx*(u1-u0))/aw,1-(v0+fy*(v1-v0))/ah);}
  for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){const a=y*(grid+1)+x,b=a+1,c=a+grid+1,d=c+1;indices.push(a,c,b,b,c,d);}
  const isBody=layer.role==='body',bound=isBody?['ParamBodyAngleX','ParamBodyAngleZ','ParamBreath']:['ParamAngleX','ParamAngleY','ParamAngleZ'];
  if(layer.role==='eyeL')bound.push('ParamEyeLOpen');if(layer.role==='eyeR')bound.push('ParamEyeROpen');
  if(layer.role==='browL')bound.push('ParamBrowLY');if(layer.role==='browR')bound.push('ParamBrowRY');
  if(layer.role.startsWith('mouth'))bound.push('ParamMouthOpenY','ParamMouthForm');if(layer.role==='hair')bound.push('ParamHairSway');
  return {id:layer.id,order:500+layer.order,vertices,uvs,indices,bound:bound.map(id=>idx[id]),opacity:values=>layer.role==='mouthOpen'?(values.ParamMouthOpenY??0):layer.role==='mouthClosed'?1-(values.ParamMouthOpenY??0):1,
   deform(values){const result=[];for(let i=0;i<vertices.length;i+=2){let x=vertices[i]*1000+w/2,y=h/2-vertices[i+1]*1000;
    if(layer.role==='eyeL'||layer.role==='eyeR'){const open=values[layer.role==='eyeL'?'ParamEyeLOpen':'ParamEyeROpen']??1;y=y1-(y1-y)*(0.055+0.945*open);}
    if(layer.role==='browL'||layer.role==='browR')y-=12*(values[layer.role==='browL'?'ParamBrowLY':'ParamBrowRY']??0);
    if(layer.role.startsWith('mouth')){const cx=(x0+x1)/2;x=cx+(x-cx)*(1+0.16*(values.ParamMouthForm??0));y+=(values.ParamMouthForm??0)*5*(1-Math.abs(x-cx)/((x1-x0)/2));}
    if(isBody){const breath=values.ParamBreath??0,weight=Math.max(0,(1500-y)/1000);x+=(x-512)*breath*0.018*weight;y-=breath*7*weight;const a=(values.ParamBodyAngleZ??0)*Math.PI/180*0.65,dx=x-512,dy=y-1450;x=512+dx*Math.cos(a)-dy*Math.sin(a)+(values.ParamBodyAngleX??0)*weight*2;y=1450+dx*Math.sin(a)+dy*Math.cos(a);}
    else{if(layer.role==='hair'){const sway=values.ParamHairSway??0,depth=(y-y0)/(y1-y0);x+=sway*14*depth*depth;}
     const ax=(values.ParamAngleX??0)/30,ay=(values.ParamAngleY??0)/30;x=512+(x-512)*(1-0.045*Math.abs(ax))+ax*(layer.role==='head'?10:18);y+=ay*(layer.role==='hair'?8:16);const a=(values.ParamAngleZ??0)*Math.PI/180*0.5,dx=x-512,dy=y-618;x=512+dx*Math.cos(a)-dy*Math.sin(a);y=618+dx*Math.sin(a)+dy*Math.cos(a);}
    result.push((x-w/2)/1000,(h/2-y)/1000);
   }return result;}
  };
 });
 const moc=writeMoc({width:w,height:h,parameters,meshes});return {...moc,parameters,meshes};
}
function documents(name,project){
 const physics={Version:3,Meta:{PhysicsSettingCount:1,TotalInputCount:1,TotalOutputCount:1,VertexCount:3,EffectiveForces:{Gravity:{X:0,Y:-1},Wind:{X:0,Y:0}},PhysicsDictionary:[{Id:'PhysicsHair',Name:'Hair sway'}],Fps:60},PhysicsSettings:[{Id:'PhysicsHair',Input:[{Source:{Target:'Parameter',Id:'ParamAngleX'},Weight:100,Type:'Angle',Reflect:false}],Output:[{Destination:{Target:'Parameter',Id:'ParamHairSway'},VertexIndex:2,Scale:0.025,Weight:100,Type:'Angle',Reflect:false}],Vertices:[{Position:{X:0,Y:0},Mobility:0.8,Delay:0.2,Acceleration:1,Radius:0},{Position:{X:0,Y:10},Mobility:0.8,Delay:0.25,Acceleration:1,Radius:10},{Position:{X:0,Y:20},Mobility:0.8,Delay:0.3,Acceleration:1,Radius:10}],Normalization:{Position:{Minimum:-10,Default:0,Maximum:10},Angle:{Minimum:-30,Default:0,Maximum:30}}}]};
 const manifest={Version:3,FileReferences:{Moc:name+'.moc3',Textures:['textures/texture_00.png'],Physics:name+'.physics3.json',DisplayInfo:name+'.cdi3.json',Expressions:[{Name:'Smile',File:'expressions/smile.exp3.json'}]},Groups:[{Target:'Parameter',Name:'EyeBlink',Ids:['ParamEyeLOpen','ParamEyeROpen']},{Target:'Parameter',Name:'LipSync',Ids:['ParamMouthOpenY']}],HitAreas:[]};
 const display={Version:3,Parameters:PARAMS.map(p=>({Id:p.id,GroupId:'',Name:p.name})),ParameterGroups:[],Parts:project.layers.map(l=>({Id:'Part_'+l.id,Name:l.name}))};
 const smile={Type:'Live2D Expression',FadeInTime:0.3,FadeOutTime:0.3,Parameters:[{Id:'ParamMouthForm',Value:1,Blend:'Overwrite'}]};
 return {[name+'.model3.json']:manifest,[name+'.physics3.json']:physics,[name+'.cdi3.json']:display,'expressions/smile.exp3.json':smile,'project.json':project};
}
module.exports={PARTS,PARAMS,analyzeAtlas,validateProject,rig,documents};
