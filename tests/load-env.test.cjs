'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const {loadEnv}=require('../private/load-env.js');

test('.env supports Windows BOM/CRLF, quoted hashes, comments, and preserves hosting values',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rice-env-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const env={PORT:'9000',EMPTY:''};
 loadEnv(dir,env);assert.deepEqual(env,{PORT:'9000',EMPTY:''});
 fs.writeFileSync(path.join(dir,'.env'),'\uFEFF# local configuration\r\nSTUDIO_ADMIN_PASSWORD="long # password with spaces"\r\nPORT=3000\r\nEMPTY=from-file\r\nHOST=127.0.0.1 # comment\r\nDATA_DIR=C:\\rice-data\r\n');
 loadEnv(dir,env);
 assert.equal(env.STUDIO_ADMIN_PASSWORD,'long # password with spaces');
 assert.equal(env.PORT,'9000');assert.equal(env.EMPTY,'');assert.equal(env.HOST,'127.0.0.1');assert.equal(env.DATA_DIR,'C:\\rice-data');
 // Read failures other than a missing optional file must remain visible.
 fs.rmSync(path.join(dir,'.env'));fs.mkdirSync(path.join(dir,'.env'));
 assert.throws(()=>loadEnv(dir,{}));
});

test('server reads its own .env before operator authentication from a different working directory',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rice-env-server-')),root=path.join(__dirname,'..');
 const app=path.join(dir,'app'),cwd=path.join(dir,'elsewhere');fs.mkdirSync(app);fs.mkdirSync(cwd);
 fs.copyFileSync(path.join(root,'server.js'),path.join(app,'server.js'));
 for(const name of ['private','mystery-content'])fs.cpSync(path.join(root,name),path.join(app,name),{recursive:true});
 const scripts=path.join(app,'apps','murder-mystery');fs.mkdirSync(scripts,{recursive:true});
 for(const name of fs.readdirSync(path.join(root,'apps','murder-mystery')))
  if(name.endsWith('.js'))fs.copyFileSync(path.join(root,'apps','murder-mystery',name),path.join(scripts,name));
 const password='local-test-password-#-with-spaces';
 fs.writeFileSync(path.join(app,'.env'),'STUDIO_ADMIN_PASSWORD="'+password+'"\nDATA_DIR="'+path.join(dir,'state').replace(/\\/g,'/')+'"\nPORT=4567\n');
 const env={...process.env};for(const key of ['STUDIO_ADMIN_PASSWORD','DATA_DIR','RAILWAY_VOLUME_MOUNT_PATH','PORT'])delete env[key];
 const code='const {handler}=require('+JSON.stringify(path.join(app,'server.js'))+');const s=require("node:http").createServer(handler);s.listen(0,"127.0.0.1",()=>console.log(JSON.stringify({port:s.address().port,configuredPort:process.env.PORT})));';
 const child=spawn(process.execPath,['-e',code],{cwd,env,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 t.after(async()=>{if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill();await stopped;}fs.rmSync(dir,{recursive:true,force:true});});
 const address=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Server startup timed out')),10000);
  child.on('error',e=>{clearTimeout(timer);reject(e);});
  child.on('exit',()=>{clearTimeout(timer);reject(Error('Server exited before readiness: '+stderr));});
  child.stdout.on('data',()=>{const line=stdout.split('\n').find(s=>s.startsWith('{"port":'));if(line){clearTimeout(timer);resolve(JSON.parse(line));}});
 });
 assert.equal(address.configuredPort,'4567');const base='http://127.0.0.1:'+address.port;
 assert.equal((await fetch(base+'/healthz')).status,200);
 assert.equal((await fetch(base+'/api/editor/test-library')).status,401);
 const auth='Basic '+Buffer.from('operator:'+password).toString('base64');
 assert.equal((await fetch(base+'/api/editor/test-library',{headers:{Authorization:auth}})).status,200);
 const blocked=await fetch(base+'/.env');assert.ok([403,404].includes(blocked.status));
 assert.equal((await blocked.text()).includes(password),false);
 assert.equal((stdout+stderr).includes(password),false,'startup must not log passwords');
});
