'use strict';
const fs=require('node:fs'),path=require('node:path');
const rig=require('../private/live2d/registered-rig');
const core=require('../private/live2d/core');
const {zip}=require('../private/live2d/zip');
async function build(id,outDir){
 const dir=path.join(__dirname,'../apps/live2d-studio/assets/samples',id),metadata=JSON.parse(fs.readFileSync(path.join(dir,'registration.json'))),texture=fs.readFileSync(path.join(dir,'textures/texture_00.png')),project=rig.createProject(metadata,texture),compiled=rig.rig(project),name=metadata.name,files={[name+'.moc3']:compiled.buffer,'textures/texture_00.png':texture};
 for(const [file,value] of Object.entries(rig.modelDocuments(name,project)))files[file]=Buffer.from(JSON.stringify(value,null,2)+'\n');
 files['validation.json']=Buffer.from(JSON.stringify(await core.validate(compiled.buffer),null,2)+'\n');
 if(process.env.LIVE2D_QA_CORE_PATH)files['official-core-validation.json']=Buffer.from(JSON.stringify(await core.validate(compiled.buffer,process.env.LIVE2D_QA_CORE_PATH),null,2)+'\n');
 files['README.md']=Buffer.from(`# ${name} — registered portrait model\n\nExtract the whole model folder into VTube Studio/Live2DModels. Reload the model list, choose ${name}, and run automatic parameter setup and camera calibration.\n\nThe neutral model reconstructs one canonical portrait without relocating its eyes, nose, mouth or bangs. Closed-eye and speaking edits are registered to that portrait; only local expression patches are blended. Head/neck/torso geometry shares continuous transforms. 11 authored parameters; small 2D turns only. No independent pupil tracking or editable cmo3.\n\nOfficial Cubism Core and browser validation are separate from Steam VTube Studio testing. Steam VTube Studio itself has NOT been executed here.\n`);
 for(const [file,bytes] of Object.entries(files)){const target=path.join(dir,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
 if(outDir){fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,name+'-v3.zip'),zip(Object.fromEntries(Object.entries(files).map(([f,b])=>[name+'/'+f,b]))));}
 if(process.env.LIVE2D_QA_DRAW_DIR){const handle=core.open(await core.runtime(),compiled.buffer);try{handle.model.update();const d=handle.model.drawables;fs.writeFileSync(path.join(process.env.LIVE2D_QA_DRAW_DIR,id+'-draw.json'),JSON.stringify({ids:[...d.ids],positions:d.vertexPositions.map(v=>[...v]),uvs:d.vertexUvs.map(v=>[...v]),indices:d.indices.map(v=>[...v]),orders:[...d.drawOrders],opacity:[...d.opacities]}));}finally{handle.release();}}
 console.log(name+': '+compiled.buffer.length+' bytes, '+project.layers.length+' meshes, '+project.parameters.length+' parameters');
}
if(require.main===module)(async()=>{for(const id of (process.argv[3]||'miel').split(','))await build(id,process.argv[2]);})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={build};
