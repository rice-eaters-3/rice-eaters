'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {analyzeAtlas,rig,documents}=require('../private/live2d/compiler');
const {decode,crc32}=require('../private/live2d/png');
const {runtime,open,validate}=require('../private/live2d/core');
const {createService}=require('../private/live2d/service');
const {zip}=require('../private/live2d/zip');
const sample=path.join(__dirname,'../apps/live2d-studio/assets/samples/lumi');
const portrait=require('../private/live2d/portrait-rig');
const registered=require('../private/live2d/registered-rig');
const atlas=fs.readFileSync(path.join(sample,'textures/texture_00.png'));
const key='test-only-key-never-persist-001';
function entries(buffer){const result={};let at=0;while(buffer.readUInt32LE(at)===0x04034b50){const size=buffer.readUInt32LE(at+18),n=buffer.readUInt16LE(at+26),extra=buffer.readUInt16LE(at+28),name=buffer.toString('utf8',at+30,at+30+n),start=at+30+n+extra,data=buffer.subarray(start,start+size);assert.equal(buffer.readUInt32LE(at+14),crc32(data));result[name]=data;at=start+size;}assert.equal(buffer.readUInt32LE(at),0x02014b50);return result;}
test('generated sample is a real runtime model; every authored parameter changes geometry or opacity',async()=>{
 const buffer=fs.readFileSync(path.join(sample,'Lumi.moc3'));assert.equal(buffer.toString('ascii',0,4),'MOC3');assert.ok(buffer.length>100000);
 const report=await validate(buffer);assert.equal(report.parameters,13);assert.equal(report.drawables,15);assert.ok(Object.values(report.effects).every(n=>n>0));assert.equal(report.steamVTubeStudioVerified,false);
 const handle=open(await runtime(),buffer);try{handle.model.update();for(const points of handle.model.drawables.vertexPositions)assert.ok(points.every(Number.isFinite));}finally{handle.release();}
});
test('atlas analysis finds 16 isolated parts and exports bottom-left UVs for Cubism',()=>{
 const p=analyzeAtlas(atlas),{meshes}=rig(p);assert.equal(p.layers.length,16);assert.ok(p.layers.every(l=>l.pixelCount>16));
 const source=p.layers.find(l=>l.id==='Face').source,mesh=meshes.find(m=>m.id==='Face');assert.equal(mesh.uvs[0],source[0]/p.atlas[0]);assert.equal(mesh.uvs[1],1-source[1]/p.atlas[1]);assert.ok(mesh.uvs[1]>mesh.uvs.at(-1));
 const corrupt=Buffer.from(atlas);corrupt[corrupt.length-10]^=1;assert.throws(()=>decode(corrupt),/PNG/);assert.throws(()=>decode(Buffer.from('not an image')),/PNG/);
});
test('downloaded sample ZIP contains all manifest references and no fabricated editor project',()=>{
 const source={};function collect(dir,prefix='Lumi/'){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isDirectory())collect(path.join(dir,e.name),prefix+e.name+'/');else if(!e.name.endsWith('.zip'))source[prefix+e.name]=fs.readFileSync(path.join(dir,e.name));}}collect(sample);const files=entries(zip(source)),doc=JSON.parse(files['Lumi/Lumi.model3.json']);
 for(const file of [doc.FileReferences.Moc,...doc.FileReferences.Textures,doc.FileReferences.Physics,doc.FileReferences.DisplayInfo,...doc.FileReferences.Expressions.map(e=>e.File)])assert.ok(files['Lumi/'+file],file);
 assert.ok(!Object.keys(files).some(p=>p.endsWith('.cmo3')||p.endsWith('.vtube.json')));assert.equal(doc.Groups.find(g=>g.Name==='LipSync').Ids[0],'ParamMouthOpenY');
 assert.deepEqual(Object.keys(entries(zip({'Model/a.txt':'hello'}))),['Model/a.txt']);assert.throws(()=>zip({'../secret':'x'}),/Unsafe/);
});
test('session-scoped API: connect, generate, validate, edit, export, restart; never persist API key',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'live2d-api-')),requests=[];let unblock;const blocked=new Promise(r=>{unblock=r;});
 const mock=async(url,options)=>{requests.push({url,options});assert.equal(options.headers.Authorization,'Bearer '+key);if(url.includes('/models/'))return Response.json({id:'gpt-image-2.5-flare'});assert.equal(JSON.parse(options.body).n,1);await blocked;return Response.json({data:[{b64_json:atlas.toString('base64')}]});};
 let service=createService({dataDir:dir,fetchImpl:mock}),server=http.createServer((req,res)=>service.handle(req,res,new URL(req.url,'http://localhost'),req.headers['x-session']||'owner'));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{service.close();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 async function call(route,method='GET',body,sid='owner',headers={}){const r=await fetch(base+'/api/live2d'+route,{method,headers:{'Content-Type':'application/json','X-Session':sid,...headers},body:body===undefined?undefined:JSON.stringify(body)});return {r,data:r.headers.get('content-type').includes('json')?await r.json():Buffer.from(await r.arrayBuffer())};}
 assert.equal((await call('/jobs','POST',{name:'A',prompt:'original adult character'})).r.status,401);
 assert.equal((await call('/connection','POST',{key,model:'gpt-image-2.5-flare'})).r.status,200);
 assert.ok((await call('/config')).data.connected);
 const {r,data:j}=await call('/jobs','POST',{name:'Original',prompt:'original adult astronomer with purple hair'});assert.equal(r.status,202);
 assert.equal((await call('/jobs','POST',{name:'Again',prompt:'original adult character'})).r.status,429);unblock();
 let ready;for(let i=0;i<100;i++){ready=(await call('/jobs/'+j.id)).data;if(['ready','error'].includes(ready.stage))break;await new Promise(r=>setTimeout(r,20));}assert.equal(ready.stage,'ready',JSON.stringify(ready));assert.equal(ready.report.parameters,13);
 assert.equal((await call('/jobs/'+j.id,'GET',undefined,'another')).r.status,404);
 assert.equal((await call('/jobs/'+j.id+'/export','GET',undefined,'another')).r.status,404);
 const project=(await call('/jobs/'+j.id+'/assets/project.json')).data;
 const changed=structuredClone(project);changed.canvas=[1,1];changed.layers[0].source=[0,0,1,1];changed.layers[0].role='invalid';changed.layers[0].target[0]+=7;
 assert.equal((await call('/jobs/'+j.id+'/project','PATCH',changed)).r.status,200);
 const saved=(await call('/jobs/'+j.id+'/assets/project.json')).data;assert.deepEqual(saved.canvas,project.canvas);assert.deepEqual(saved.layers[0].source,project.layers[0].source);assert.equal(saved.layers[0].role,project.layers[0].role);assert.equal(saved.layers[0].target[0],changed.layers[0].target[0]);
 const invalid=structuredClone(saved);invalid.layers[0].target[0]=Infinity;assert.equal((await call('/jobs/'+j.id+'/project','PATCH',invalid)).r.status,400);
 assert.equal((await call('/jobs/'+j.id+'/assets/job.json')).r.status,404);
 assert.equal((await call('/connection','POST',{key,model:'gpt-image-2.5-flare'},'owner',{Origin:'https://attacker.example'})).r.status,403);
 const bundle=entries((await call('/jobs/'+j.id+'/export')).data);assert.ok(bundle['Original/Original.moc3']);assert.equal(bundle['Original/textures/texture_00.png'].length,atlas.length);
 let content='';function scan(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const f=path.join(folder,entry.name);if(entry.isDirectory())scan(f);else content+=fs.readFileSync(f).toString('utf8');}}scan(dir);assert.ok(!content.includes(key));assert.ok(!JSON.stringify((await call('/config')).data).includes(key));
 assert.equal(requests.filter(r=>r.url.endsWith('/images/generations')).length,1);
 service.close();service=createService({dataDir:dir,fetchImpl:mock});assert.equal((await call('/config')).data.connected,false);assert.equal((await call('/jobs/'+j.id)).data.stage,'ready');assert.equal((await call('/jobs/'+j.id+'/export')).r.status,200);
});
test('upstream denial, URL-only images and missing parts fail honestly without a placeholder model',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'live2d-fail-'));let deny=false,calls=0;
 const service=createService({dataDir:dir,fetchImpl:async url=>{calls++;if(deny)return new Response('secret upstream diagnostic',{status:401});return Response.json(url.includes('/models/')?{id:'test'}:{data:[{url:'http://internal.example/secret'}]});}}),server=http.createServer((req,res)=>service.handle(req,res,new URL(req.url,'http://localhost'),'owner'));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{service.close();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port+'/api/live2d';const call=async(route,body)=>{const r=await fetch(base+route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});return {status:r.status,data:await r.json()};};
 await call('/connection',{key,model:'test'});const j=(await call('/jobs',{name:'Bad',prompt:'An original adult character'})).data;let status;for(let i=0;i<30;i++){status=(await call('/jobs/'+j.id)).data;if(status.stage==='error')break;await new Promise(r=>setTimeout(r,10));}assert.equal(status.stage,'error');assert.match(status.error,/base64/);assert.equal((await fetch(base+'/jobs/'+j.id+'/export')).status,409);assert.equal(calls,2);
 deny=true;const rejected=await call('/connection',{key,model:'test'});assert.equal(rejected.status,401);assert.ok(!JSON.stringify(rejected).includes('secret upstream'));assert.equal((await call('/config')).data.connected,false);
 assert.throws(()=>createService({dataDir:dir,baseUrl:'http://external.example/v1'}),/HTTPS/);
});
for(const [id,preset] of Object.entries(portrait.PRESETS))test(preset.name+' portrait rework: reproducible real MOC3, closed-eye sprites, all parameter extremes',async()=>{
 const dir=path.join(sample,'..',id),project=JSON.parse(fs.readFileSync(path.join(dir,'project.json'))),buffer=fs.readFileSync(path.join(dir,preset.name+'.moc3'));
 const v3=project.format==='rice-live2d-registered-v3';assert.ok(v3||project.format==='rice-live2d-portrait-v2');assert.deepEqual((v3?registered:portrait).rig(project).buffer,buffer);
 const report=await validate(buffer);assert.equal(report.parameters,project.parameters.length);assert.equal(report.drawables,project.layers.filter(l=>l.visible).length);assert.ok(Object.values(report.effects).every(n=>n>0));
 const official=JSON.parse(fs.readFileSync(path.join(dir,'official-core-validation.json')));assert.equal(official.runtime,'Live2D Cubism Core');assert.ok(Object.values(official.effects).every(n=>n>0));assert.equal(official.steamVTubeStudioVerified,false);
 const handle=open(await runtime(),buffer),m=handle.model;try{
  m.parameters.values.set(m.parameters.defaultValues);m.update();const leftOpen=m.drawables.ids.indexOf('EyeLOpen'),leftClosed=m.drawables.ids.indexOf('EyeLClosed');if(!v3)assert.equal(m.drawables.opacities[leftOpen],1);assert.equal(m.drawables.opacities[leftClosed],0);
  m.parameters.values[m.parameters.ids.indexOf('ParamEyeLOpen')]=0;m.update();if(!v3)assert.equal(m.drawables.opacities[leftOpen],0);assert.equal(m.drawables.opacities[leftClosed],1);
  if(['miel','nari','ruri'].includes(id)){m.parameters.values[m.parameters.ids.indexOf('ParamMouthOpenY')]=.3;m.update();assert.ok(m.drawables.opacities[m.drawables.ids.indexOf('MouthOpen')]>.99,'speaking mouth stays opaque');if(!v3)assert.ok(m.drawables.opacities[m.drawables.ids.indexOf('MouthClosed')]<.01,'closed mouth is absent while speaking');}
  for(const direction of [-1,1]){for(let i=0;i<m.parameters.count;i++)m.parameters.values[i]=direction<0?m.parameters.minimumValues[i]:m.parameters.maximumValues[i];m.update();for(const points of m.drawables.vertexPositions)assert.ok(points.every(Number.isFinite));}
  for(const uv of m.drawables.vertexUvs)assert.ok(uv.every(v=>v>=0&&v<=1));
 }finally{handle.release();}
});
test('built-in models export complete VTube Studio folders without an API key',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'live2d-samples-')),service=createService({dataDir:dir,fetchImpl:()=>{throw Error('sample must not call AI');}}),server=http.createServer((req,res)=>service.handle(req,res,new URL(req.url,'http://localhost'),'viewer'));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{service.close();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});const base='http://127.0.0.1:'+server.address().port+'/api/live2d';
 const config=await(await fetch(base+'/config')).json();assert.equal(config.connected,false);assert.equal(config.samples.length,6);
 for(const s of config.samples){const response=await fetch(base+'/samples/'+s.id+'/export');assert.equal(response.status,200);const files=entries(Buffer.from(await response.arrayBuffer())),doc=JSON.parse(files[s.name+'/'+s.name+'.model3.json']);for(const f of [doc.FileReferences.Moc,...doc.FileReferences.Textures,doc.FileReferences.Physics,doc.FileReferences.DisplayInfo,...doc.FileReferences.Expressions.map(e=>e.File)])assert.ok(files[s.name+'/'+f],f);assert.equal(files[s.name+'/'+doc.FileReferences.Moc].toString('ascii',0,4),'MOC3');}
 assert.equal((await fetch(base+'/samples/unknown/export')).status,404);
});
for(const id of ['miel','nari','ruri'])test(id+' canonical face is not repositioned, and the painted head/neck mesh stays continuous',async()=>{
 const dir=path.join(sample,'..',id),p=JSON.parse(fs.readFileSync(path.join(dir,'project.json'))),atlas=fs.readFileSync(path.join(dir,'textures/texture_00.png')),compiled=registered.rig(p),raw=registered.rawCanonical(atlas,p);
 assert.equal(require('node:crypto').createHash('sha256').update(raw).digest('hex'),p.reference.rgbaSha256,'packing preserves every canonical RGBA pixel');
 const metadata=JSON.parse(fs.readFileSync(path.join(dir,'registration.json')));assert.deepEqual(registered.createProject(metadata,atlas),p);
 const handle=open(await runtime(),compiled.buffer),m=handle.model;try{
  m.parameters.values.set(m.parameters.defaultValues);m.update();const vertices=new Map();
  for(const mesh of compiled.meshes.filter(x=>x.kind==='base')){const i=m.drawables.ids.indexOf(mesh.id),v=m.drawables.vertexPositions[i],uv=m.drawables.vertexUvs[i];for(let n=0;n<v.length;n+=2){const x=uv[n]*p.atlas[0]-p.reference.rect[0],y=(1-uv[n+1])*p.atlas[1]-p.reference.rect[1];assert.ok(Math.abs(v[n]-(x-p.canvas[0]/2)/1000)<1e-6);assert.ok(Math.abs(v[n+1]-(p.canvas[1]/2-y)/1000)<1e-6);const key=mesh.sourcePoints[n]+','+mesh.sourcePoints[n+1];if(!vertices.has(key))vertices.set(key,[]);vertices.get(key).push([i,n]);}}
  const pose={ParamAngleX:22,ParamAngleY:-17,ParamAngleZ:11,ParamBodyAngleZ:5,ParamBodyAngleX:4,ParamBreath:.8,ParamHairSway:.7,ParamMouthForm:-.2};for(const [key,value] of Object.entries(pose))m.parameters.values[m.parameters.ids.indexOf(key)]=value;m.update();let joins=0;
  for(const group of vertices.values()){if(group.length<2)continue;joins++;const [first,offset]=group[0],a=m.drawables.vertexPositions[first];for(const [i,n] of group.slice(1)){const b=m.drawables.vertexPositions[i];assert.ok(Math.abs(a[offset]-b[n])<2e-5&&Math.abs(a[offset+1]-b[n+1])<2e-5,'shared painted edges must not peel apart');}}
  assert.ok(joins>10);
 }finally{handle.release();}
 const decoded=decode(atlas);for(const layer of p.layers.filter(l=>l.kind!=='base')){assert.equal(layer.source[2]-layer.source[0],layer.target[2]-layer.target[0]);assert.equal(layer.source[3]-layer.source[1],layer.target[3]-layer.target[1]);for(let y=layer.source[1]+12;y<layer.source[3]-12;y++)for(let x=layer.source[0]+12;x<layer.source[2]-12;x++)assert.equal(decoded.rgba[(y*decoded.width+x)*4+3],255,'expression interior must cover the underlying open eye/closed lip');}
 assert.ok(p.registration.blink.medianErrorPx<1.5);assert.ok(p.registration.talk.medianErrorPx<1.5);
});
