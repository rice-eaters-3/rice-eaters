'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {decode,crc32}=require('./png'),registered=require('./registered-rig'),{zip}=require('./zip');
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
function png(width,height,rgba){
 const chunk=(name,data)=>{const body=Buffer.concat([Buffer.from(name),data]),head=Buffer.alloc(4),tail=Buffer.alloc(4);head.writeUInt32BE(data.length);tail.writeUInt32BE(crc32(body));return Buffer.concat([head,body,tail]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const raw=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)rgba.copy(raw,y*(width*4+1)+1,y*width*4,(y+1)*width*4);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
function exportSource(dir){
 const project=JSON.parse(fs.readFileSync(path.join(dir,'project.json')));if(project.format!=='rice-live2d-registered-v3')throw Error('Registered portrait source required');
 const atlas=decode(fs.readFileSync(path.join(dir,'textures/texture_00.png'))),compiled=registered.rig(project),files={};
 const capabilities={format:'rice-live2d-authoring-v1',name:project.name,canvas:project.canvas,atlas:project.atlas,coordinateOrigin:'top-left',semanticArtSeparation:false,occludedAreasPainted:false,independentPupils:false,editableCmo3:false,headBodySwapReady:false,headYaw:'small 2D translation/compression; no side-face reconstruction',expressions:['MouthForm only'],steamVTubeStudioTested:false,layers:[]};
 for(const layer of project.layers){const [l,t,r,b]=layer.source,width=r-l,height=b-t,rgba=Buffer.alloc(width*height*4);for(let y=t;y<b;y++)atlas.rgba.copy(rgba,(y-t)*width*4,(y*atlas.width+l)*4,(y*atlas.width+r)*4);const file='layers/'+layer.id+'.png';files[file]=png(width,height,rgba);capabilities.layers.push({id:layer.id,name:layer.name,kind:layer.kind,source:layer.source,target:layer.target,order:layer.order,file});}
 files['manifest.json']=json(capabilities);files['project.json']=json(project);files['registration.json']=fs.readFileSync(path.join(dir,'registration.json'));
 files['mesh-neutral.json']=json(compiled.meshes.map(m=>({id:m.id,kind:m.kind,vertices:m.vertices,uvs:m.uvs,indices:m.indices,sourcePoints:m.sourcePoints,parameterIds:m.bound.map(i=>compiled.parameters[i].id)})));
 files['README.md']=Buffer.from(`# ${project.name}: actual mesh-source archive\n\nThese PNGs are exact crops of the current runtime meshes, with original pixel sizes, placement and stable IDs. They are NOT anatomical Live2D art layers. Portrait_* regions contain face, hair and/or clothing together. EyeLClosed/EyeRClosed/MouthOpen are local overlays, not independently separated pupils, lids or lips.\n\nThis archive is NOT ready for head/body swapping (뚜따). No PSD or editable .cmo3 is included. Hidden face/forehead, sclera behind pupils, back hair, neck under jaw and torso under clothing have NOT been reconstructed.\n\nEdit same-sized layer PNGs without moving their contents; source and target rectangles use top-left image coordinates. Repack using: node scripts/live2d-authoring.cjs repack <this-folder> <output-folder>. It writes a new texture, updated project/registration and actual MOC3 after runtime validation. It never overwrites the bundled samples. This is a project-specific editing route, not a Cubism Editor project.\n\nA proper modular rebuild needs separate back/front/side hair, a complete face/ears, brows, sclera/iris/lids/lashes per eye, mouth interior/lips, neck, torso/clothes/arms/accessories; painted overlap margins; head/body deformer hierarchy; and an editable Cubism project. Merely dividing an image into mesh rectangles does not provide those assets.\n\nCompiler source: private/live2d/registered-rig.js and private/live2d/moc-writer.js in this repository.\n`);
 return {files,capabilities,buffer:zip(files)};
}
module.exports={exportSource,png};
