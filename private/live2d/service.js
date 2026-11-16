'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {analyzeAtlas,validateProject,rig,documents}=require('./compiler.js');
const {validate}=require('./core.js');
const {zip}=require('./zip.js');
const MODEL='gpt-image-2.5-flare';
const SAMPLES=require('./samples.json');
const jsonText=v=>JSON.stringify(v,null,2)+'\n';
function fault(status,message){throw Object.assign(Error(message),{status});}
const productionPrompt=description=>`Create an ORIGINAL adult anime VTuber character based on this direction: ${description}\nThis is a production texture atlas, NOT a portrait or a reference sheet. Square transparent PNG. EXACTLY 4 columns x 4 rows of equally sized cells, no lines, text, labels, backgrounds, shadows or watermarks. Each cell contains ONLY ONE isolated colored character part, centered with generous 12% transparent margin; entire part visible. All parts match one character, front facing, symmetrical, clean polished cel shading. Parts in row-major order: (1) back hair silhouette, (2) upper torso costume with neck but NO head or face, (3) blank skin face oval with subtle nose, NO eyes brows mouth hair, (4) front bangs only, (5) character left open eye, sclera iris lashes together, (6) right matching eye, (7) small closed smiling mouth line, (8) open mouth interior only, (9) left eyebrow, (10) right eyebrow, (11) left ear, (12) right ear, (13) left side hair lock, (14) right side hair lock, (15) small hair ornament, (16) neck ribbon. Eyes and mouths contain no surrounding skin patch. Do not add features to the blank face. Do not connect cells. Keep back hair no longer than shoulder length for this rig.`;
function readBody(req){return new Promise((resolve,reject)=>{let size=0,parts=[];req.on('data',b=>{size+=b.length;if(size>32768){reject(Object.assign(Error('요청이 너무 큽니다.'),{status:413}));parts=[];}else parts.push(b);});req.on('end',()=>{if(size>32768)return;try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')||'{}'));}catch{reject(Object.assign(Error('JSON 요청이 필요합니다.'),{status:400}));}});req.on('error',reject);});}
function output(res,status,data,headers={}){const body=Buffer.isBuffer(data)?data:Buffer.from(JSON.stringify(data));res.writeHead(status,{'Content-Type':Buffer.isBuffer(data)?'application/octet-stream':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(body);}
const instructions=name=>`# ${name} — VTube Studio import\n\n1. Extract this ZIP first. Copy the entire ${name} folder into VTube Studio/Live2DModels.\n2. Restart VTube Studio or reload the model list, then select ${name}.\n3. Use the VTube Studio auto-setup and camera calibration. The app creates its own .vtube.json configuration.\n4. Eye blink, mouth opening and head/body angles use standard parameter IDs. Adjust tracking ranges in VTube Studio if necessary.\n\nThis is an automatically assembled draft with 16 image parts and 13 rig parameters. No independent pupil tracking, hand rig or editable .cmo3 project is included. project.json preserves layer placement for this web app. The .moc3 is a real binary runtime model, not a renamed image. Runtime validation does not replace testing in the Steam VTube Studio application.\n\nThe artwork was AI-generated. Review anatomy, layer seams and rights before public/commercial use.\n`;
async function build(name,project,atlas){
 const {buffer}=rig(project),report=await validate(buffer),files={};
 for(const [file,value] of Object.entries(documents(name,project)))files[file]=Buffer.from(jsonText(value));
 files[name+'.moc3']=buffer;files['textures/texture_00.png']=atlas;files['validation.json']=Buffer.from(jsonText(report));files['README.md']=Buffer.from(instructions(name));
 return {files,report};
}
function createService({dataDir,fetchImpl=globalThis.fetch,baseUrl=process.env.LIVE2D_AI_BASE_URL||'https://api.openai.com/v1',defaultModel=process.env.LIVE2D_IMAGE_MODEL||MODEL,requestTimeout=480000}={}){
 const base=new URL(baseUrl);if(base.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('LIVE2D_AI_BASE_URL requires HTTPS');
 const endpoint=base.href.replace(/\/$/,''),connections=new Map(),jobs=new Map(),running=new Set(),ttl=3600000;
 const root=path.join(dataDir,'live2d');fs.mkdirSync(root,{recursive:true});
 const owner=sid=>crypto.createHash('sha256').update(sid).digest('hex');
 const directory=(sid,id)=>path.join(root,owner(sid),id);
 function connection(sid){const c=connections.get(sid);if(c&&c.expires>Date.now())return c;connections.delete(sid);return null;}
 const sweeper=setInterval(()=>{for(const sid of connections.keys())connection(sid);},60000);sweeper.unref();
 const view=j=>({id:j.id,name:j.name,prompt:j.prompt,stage:j.stage,error:j.error||null,createdAt:j.createdAt,report:j.report||null});
 function save(sid,j){const dir=directory(sid,j.id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'job.json'),jsonText(view(j)));}
 function list(sid){const hash=owner(sid);if(!jobs.has(hash)){const found=new Map();let names=[];try{names=fs.readdirSync(path.join(root,hash));}catch{}for(const id of names.filter(n=>/^[a-f0-9-]{36}$/.test(n)).slice(-30)){try{const j=JSON.parse(fs.readFileSync(path.join(directory(sid,id),'job.json'),'utf8'));if(j.id!==id)continue;if(!['ready','error'].includes(j.stage)){j.stage='error';j.error='서버 재시작으로 작업이 중단되었습니다.';}found.set(id,j);}catch{}}jobs.set(hash,found);}return jobs.get(hash);}
 function get(sid,id){const j=list(sid).get(id);if(!j)fault(404,'작업을 찾을 수 없습니다.');return j;}
 function fileNames(j){return [j.name+'.moc3',j.name+'.model3.json',j.name+'.physics3.json',j.name+'.cdi3.json','expressions/smile.exp3.json','project.json','textures/texture_00.png','validation.json','README.md'];}
 function write(sid,j,result){const dir=directory(sid,j.id);for(const [file,data] of Object.entries(result.files)){const target=path.join(dir,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target+'.tmp',data);fs.renameSync(target+'.tmp',target);}j.report=result.report;j.stage='ready';save(sid,j);}
 async function upstream(route,key,options={}){
  let response;try{response=await fetchImpl(endpoint+route,{...options,redirect:'error',signal:AbortSignal.timeout(requestTimeout),headers:{Authorization:'Bearer '+key,...options.headers}});}catch{fault(502,'AI 서버에 연결하지 못했습니다. 연결 주소와 네트워크를 확인해 주세요.');}
  if(!response.ok){try{await response.body?.cancel();}catch{}const status=response.status;fault(status===401||status===403?401:502,status===401||status===403?'API 키 또는 해당 이미지 모델의 사용 권한을 확인해 주세요.':status===429?'AI API 한도 또는 잔액을 확인해 주세요.':'AI 서버가 작업을 완료하지 못했습니다. (HTTP '+status+')');}
  const reader=response.body.getReader();let size=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>40*1024*1024){await reader.cancel();fault(502,'AI 응답 크기가 제한을 초과했습니다.');}chunks.push(Buffer.from(value));}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fault(502,'AI 서버가 올바른 JSON을 반환하지 않았습니다.');}
 }
 async function generate(sid,j,c){
  const set=stage=>{j.stage=stage;save(sid,j);};
  try{
   set('generating');const result=await upstream('/images/generations',c.key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:c.model,prompt:productionPrompt(j.prompt),n:1,size:'1024x1024',quality:'high',background:'transparent',output_format:'png'})});
   const encoded=result.data?.[0]?.b64_json;if(typeof encoded!=='string'||encoded.length>36*1024*1024||!/^[-A-Za-z0-9+/=\r\n]+$/.test(encoded))fault(502,'투명 PNG의 base64 응답이 필요합니다. 다른 이미지 모델을 선택해 주세요.');
   const atlas=Buffer.from(encoded,'base64');set('parts');const project=analyzeAtlas(atlas);set('rigging');const compiled=rig(project);set('validating');const report=await validate(compiled.buffer);
   const files={};for(const [file,value] of Object.entries(documents(j.name,project)))files[file]=Buffer.from(jsonText(value));Object.assign(files,{[j.name+'.moc3']:compiled.buffer,'textures/texture_00.png':atlas,'validation.json':Buffer.from(jsonText(report)),'README.md':Buffer.from(instructions(j.name))});write(sid,j,{files,report});
  }catch(e){j.stage='error';j.error=e.status?e.message:'파츠 분석 또는 모델 생성에 실패했습니다. 생성된 아틀라스의 구성이 올바르지 않을 수 있습니다.';save(sid,j);}finally{running.delete(owner(sid));}
 }
 async function handle(req,res,url,sid){
  try{
   const route=url.pathname.slice('/api/live2d'.length),method=req.method;
   if(!['GET','HEAD'].includes(method)){
    const origin=req.headers.origin;if((origin&&origin!=='http://'+req.headers.host&&origin!=='https://'+req.headers.host)||req.headers['sec-fetch-site']==='cross-site')fault(403,'다른 출처의 요청은 허용되지 않습니다.');
    if(!String(req.headers['content-type']||'').startsWith('application/json'))fault(415,'JSON 요청이 필요합니다.');
   }
   if(method==='GET'&&(route==='/sample/export'||/^\/samples\/[^/]+\/export$/.test(route))){
    const id=route==='/sample/export'?'lumi':route.split('/')[2],sample=SAMPLES.find(s=>s.id===id);if(!sample)fault(404,'샘플을 찾을 수 없습니다.');
    const dir=path.join(__dirname,'../../apps/live2d-studio/assets/samples',sample.id),files={};for(const file of fileNames(sample))files[sample.name+'/'+file]=fs.readFileSync(path.join(dir,file));if(fs.existsSync(path.join(dir,'official-core-validation.json')))files[sample.name+'/official-core-validation.json']=fs.readFileSync(path.join(dir,'official-core-validation.json'));return output(res,200,zip(files),{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="'+sample.name+'.zip"'});
   }
   if(method==='GET'&&route==='/config'){const c=connection(sid);return output(res,200,{endpoint,defaultModel,samples:SAMPLES,connected:!!c,model:c?.model||null,expiresAt:c?.expires||null});}
   if(method==='POST'&&route==='/connection'){
    connections.delete(sid);const body=await readBody(req);if(typeof body.key!=='string'||body.key.length<10||body.key.length>512||/[\r\n]/.test(body.key)||!/^[-a-zA-Z0-9_.:]{1,100}$/.test(body.model||''))fault(400,'API 키와 이미지 모델 ID를 입력해 주세요.');
    await upstream('/models/'+encodeURIComponent(body.model),body.key);connections.set(sid,{key:body.key,model:body.model,expires:Date.now()+ttl});return output(res,200,{connected:true,model:body.model,expiresAt:Date.now()+ttl});
   }
   if(method==='DELETE'&&route==='/connection'){connections.delete(sid);return output(res,200,{connected:false});}
   if(method==='GET'&&route==='/jobs')return output(res,200,{jobs:[...list(sid).values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(view)});
   if(method==='POST'&&route==='/jobs'){
    const c=connection(sid);if(!c)fault(401,'먼저 이미지 생성 API를 연결해 주세요.');
    if(running.has(owner(sid))||running.size>=2)fault(429,'진행 중인 작업이 있습니다. 완료 후 다시 시도해 주세요.');
    if(list(sid).size>=20)fault(429,'이 세션의 작업 저장 한도(20개)에 도달했습니다.');
    const body=await readBody(req);if(typeof body.prompt!=='string'||body.prompt.trim().length<10||body.prompt.length>3000||!(/^[A-Za-z][A-Za-z0-9_-]{0,35}$/).test(body.name||''))fault(400,'10~3000자의 설명과 영문 모델 이름을 입력해 주세요.');
    const j={id:crypto.randomUUID(),name:body.name,prompt:body.prompt.trim(),stage:'queued',createdAt:new Date().toISOString()};list(sid).set(j.id,j);running.add(owner(sid));save(sid,j);void generate(sid,j,{...c});return output(res,202,view(j));
   }
   const match=route.match(/^\/jobs\/([a-f0-9-]{36})(?:\/(project|export|assets\/(.+)))?$/);if(!match)fault(404,'지원하지 않는 경로입니다.');
   const j=get(sid,match[1]),dir=directory(sid,j.id);
   if(method==='GET'&&!match[2])return output(res,200,view(j));
   if(j.stage!=='ready')fault(409,'모델이 준비되지 않았습니다.');
   if(method==='GET'&&match[2]==='export'){
    const files={};for(const file of fileNames(j))files[j.name+'/'+file]=fs.readFileSync(path.join(dir,file));return output(res,200,zip(files),{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="'+j.name+'.zip"'});
   }
   if(method==='GET'&&match[3]){
    const file=match[3];if(!fileNames(j).includes(file))fault(404,'파일을 찾을 수 없습니다.');const mime=file.endsWith('.json')?'application/json':file.endsWith('.png')?'image/png':'application/octet-stream';return output(res,200,fs.readFileSync(path.join(dir,file)),{'Content-Type':mime});
   }
   if(method==='PATCH'&&match[2]==='project'){
    const body=await readBody(req),original=JSON.parse(fs.readFileSync(path.join(dir,'project.json'),'utf8'));
    if(!Array.isArray(body.layers)||body.layers.length!==16||new Set(body.layers.map(l=>l.id)).size!==16)fault(400,'16개 파츠의 배치가 필요합니다.');
    const layers=original.layers.map(layer=>{const update=body.layers.find(l=>l.id===layer.id);if(!update||typeof update.visible!=='boolean')fault(400,'파츠 정보가 올바르지 않습니다.');return {...layer,target:update.target,visible:update.visible};});
    if(layers.filter(l=>l.visible).length<1)fault(400,'적어도 하나의 파츠를 표시해 주세요.');
    const project={...original,layers};try{validateProject(project);}catch(e){fault(400,e.message);}
    j.stage='rigging';try{write(sid,j,await build(j.name,project,fs.readFileSync(path.join(dir,'textures/texture_00.png'))));}catch{j.stage='ready';fault(400,'해당 배치에서는 모든 파라미터를 검증할 수 없습니다. 눈·입·머리카락 파츠를 표시해 주세요.');}return output(res,200,view(j));
   }
   fault(405,'지원하지 않는 요청입니다.');
  }catch(e){output(res,e.status||500,{error:e.status?e.message:'모델 작업을 처리하지 못했습니다.'});}
 }
 return {handle,close(){clearInterval(sweeper);connections.clear();},endpoint};
}
module.exports={createService,build,productionPrompt,instructions};
