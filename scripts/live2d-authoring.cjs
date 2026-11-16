'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {exportSource,png}=require('../private/live2d/authoring'),{decode}=require('../private/live2d/png'),registered=require('../private/live2d/registered-rig'),{validate}=require('../private/live2d/core'),{zip}=require('../private/live2d/zip');
async function repack(source,out){
 if(path.resolve(source)===path.resolve(out))throw Error('Use a separate output folder');
 const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'))),project=JSON.parse(fs.readFileSync(path.join(source,'project.json'))),metadata=JSON.parse(fs.readFileSync(path.join(source,'registration.json')));
 if(manifest.format!=='rice-live2d-authoring-v1'||project.format!=='rice-live2d-registered-v3')throw Error('Unsupported source format');
 const [w,h]=project.atlas,rgba=Buffer.alloc(w*h*4);
 for(const layer of project.layers){const image=decode(fs.readFileSync(path.join(source,'layers',layer.id+'.png'))),[l,t,r,b]=layer.source;if(image.width!==r-l||image.height!==b-t)throw Error('Preserve source dimensions for '+layer.id);for(let y=0;y<image.height;y++)image.rgba.copy(rgba,((y+t)*w+l)*4,y*image.width*4,(y+1)*image.width*4);}
 const texture=png(w,h,rgba);metadata.reference.rgbaSha256=crypto.createHash('sha256').update(registered.rawCanonical(texture,metadata)).digest('hex');
 const rebuilt=registered.createProject(metadata,texture),compiled=registered.rig(rebuilt),report=await validate(compiled.buffer),name=project.name,files={[name+'.moc3']:compiled.buffer,'textures/texture_00.png':texture,'registration.json':Buffer.from(JSON.stringify(metadata,null,2)),'validation.json':Buffer.from(JSON.stringify(report,null,2)),'README.md':fs.readFileSync(path.join(source,'README.md'))};
 for(const [file,value] of Object.entries(registered.modelDocuments(name,rebuilt)))files[file]=Buffer.from(JSON.stringify(value,null,2));
 for(const [file,bytes] of Object.entries(files)){const dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}fs.writeFileSync(path.join(out,name+'-edited.zip'),zip(Object.fromEntries(Object.entries(files).map(([f,b])=>[name+'/'+f,b]))));return {report,project:rebuilt,texture};
}
if(require.main===module)(async()=>{const [mode,input,out]=process.argv.slice(2);if(mode==='export'){if(!/^(miel|nari|ruri)$/.test(input)||!out)throw Error('export <miel|nari|ruri> <output.zip>');fs.writeFileSync(out,exportSource(path.join(__dirname,'../apps/live2d-studio/assets/samples',input)).buffer);}else if(mode==='repack'&&input&&out){await repack(input,out);}else throw Error('Use export or repack');})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={repack};
