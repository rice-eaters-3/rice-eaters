'use strict';
const fs=require('node:fs'),path=require('node:path');
const portrait=require('../private/live2d/portrait-rig');
const core=require('../private/live2d/core');
const {zip}=require('../private/live2d/zip');
async function build(id,outDir){
 const dir=path.join(__dirname,'../apps/live2d-studio/assets/samples',id),atlas=fs.readFileSync(path.join(dir,'textures/texture_00.png')),project=portrait.analyze(atlas,id),name=portrait.PRESETS[id].name,compiled=portrait.rig(project),files={[name+'.moc3']:compiled.buffer,'textures/texture_00.png':atlas};
 for(const [file,value] of Object.entries(portrait.modelDocuments(name,project)))files[file]=Buffer.from(JSON.stringify(value,null,2)+'\n');
 files['validation.json']=Buffer.from(JSON.stringify(await core.validate(compiled.buffer),null,2)+'\n');
 files['README.md']=Buffer.from(`# ${name}\n\nUnzip the entire ${name} folder into VTube Studio/Live2DModels, reload the model list, select ${name}, and run automatic parameter setup and camera calibration. VTube Studio creates its own .vtube.json.\n\nActual binary MOC3, 13 rig parameters, 10 visible meshes. Closed-eye sprites replace flattened open-eye textures. The head illustration is kept cohesive, facial features share one transform, and the torso is anchored at the neck. Transparent atlas and project layout included.\n\nSmall 2D head turns only; no independent pupil tracking, hand rig or editable Cubism Editor .cmo3. This is an original AI-generated adult character reworked into a runtime puppet. Steam VTube Studio direct execution has NOT been tested. Consult validation.json for runtime evaluation results.\n`);
 if(process.env.LIVE2D_QA_CORE_PATH)files['official-core-validation.json']=Buffer.from(JSON.stringify(await core.validate(compiled.buffer,process.env.LIVE2D_QA_CORE_PATH),null,2)+'\n');
 for(const [file,bytes] of Object.entries(files)){const target=path.join(dir,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
 if(outDir){fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,name+'.zip'),zip(Object.fromEntries(Object.entries(files).map(([file,bytes])=>[name+'/'+file,bytes]))));}
 if(process.env.LIVE2D_QA_DRAW_DIR){const handle=core.open(await core.runtime(),compiled.buffer);try{handle.model.update();const d=handle.model.drawables;fs.mkdirSync(process.env.LIVE2D_QA_DRAW_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.LIVE2D_QA_DRAW_DIR,id+'-draw.json'),JSON.stringify({ids:[...d.ids],positions:d.vertexPositions.map(v=>[...v]),uvs:d.vertexUvs.map(v=>[...v]),indices:d.indices.map(v=>[...v]),orders:[...d.drawOrders],opacity:[...d.opacities]}));}finally{handle.release();}}
 console.log(name+': '+compiled.buffer.length+' bytes, 13 parameters; all runtime effects verified');
}
if(require.main===module)(async()=>{for(const id of process.argv[3]?process.argv[3].split(','):Object.keys(portrait.PRESETS))await build(id,process.argv[2]);})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={build};
