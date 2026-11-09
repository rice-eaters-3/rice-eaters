'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
async function serve(t,password){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'operator-auth-'));
 process.env.DATA_DIR=dir;
 if(password===undefined)delete process.env.STUDIO_ADMIN_PASSWORD;else process.env.STUDIO_ADMIN_PASSWORD=password;
 delete require.cache[require.resolve('../private/studio-auth.js')];delete require.cache[require.resolve('../server.js')];
 const server=http.createServer(require('../server.js').handler);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 return 'http://127.0.0.1:'+server.address().port;
}
const protectedPaths=['/mystery-editor','/mystery-editor/','/mystery-test','/apps/murder-mystery/editor.html',
 '/apps/murder-mystery/%65ditor.html','/apps/murder-mystery/editor.js','/apps/murder-mystery/editor.css',
 '/apps/murder-mystery/test.html','/apps/murder-mystery/test-ui.js','/apps/murder-mystery/test-engine.js',
 '/apps/murder-mystery/test.css','/api/editor/own','/api/editor/test-library','/api/editor/test-case/d1-crown-of-ashes'];
test('unset and short operator passwords fail closed without disabling ordinary play',async t=>{
 for(const password of [undefined,'too-short'])await t.test(String(password),async t=>{
  const base=await serve(t,password);
  for(const p of protectedPaths)assert.equal((await fetch(base+p)).status,503,p);
  for(const p of ['/healthz','/mystery','/api/stories'])assert.equal((await fetch(base+p)).status,200,p);
 });
});
test('operator auth protects all studio entry points, rejects spoofing and CSRF, and allows remote authenticated access',async t=>{
 const password=crypto.randomBytes(32).toString('hex'),base=await serve(t,password);
 const Authorization='Basic '+Buffer.from('operator:'+password).toString('base64');
 for(const p of protectedPaths){
  const response=await fetch(base+p);assert.equal(response.status,401,p);assert.match(response.headers.get('www-authenticate'),/Basic/);
  assert.equal(response.headers.get('cache-control'),'no-store');
 }
 for(const p of ['/api/editor/publish','/api/editor/test-validate','/api/editor/future-endpoint'])
  assert.equal((await fetch(base+p,{method:'POST',headers:{'X-Forwarded-For':'127.0.0.1','X-Forwarded-Host':'localhost'}})).status,401,p);
 assert.equal((await fetch(base+'/apps/murder-mystery/editor.html',{method:'HEAD'})).status,401);
 for(const p of protectedPaths){
  const response=await fetch(base+p,{headers:{Authorization,'X-Forwarded-For':'203.0.113.8','X-Forwarded-Proto':'https'}});
  assert.equal(response.status,200,p);assert.equal(response.headers.get('cache-control'),'no-store');
 }
 for(const headers of [{Origin:'https://attacker.example'},{'Sec-Fetch-Site':'cross-site'}]){
  const r=await fetch(base+'/api/editor/publish',{method:'POST',headers:{Authorization,...headers,'Content-Type':'application/json'},body:'{}'});
  assert.equal(r.status,403);
 }
 assert.equal((await fetch(base+'/private/studio-auth.js',{headers:{Authorization}})).status,403);
 const wrong='Basic '+Buffer.from('operator:wrong-password').toString('base64');
 for(let i=0;i<10;i++)assert.equal((await fetch(base+'/api/editor/own',{headers:{Authorization:wrong}})).status,401);
 const limited=await fetch(base+'/api/editor/own',{headers:{Authorization:wrong}});assert.equal(limited.status,429);assert.ok(limited.headers.get('retry-after'));
 assert.equal((await fetch(base+'/api/editor/own',{headers:{Authorization}})).status,200,'valid operator is not locked out by anonymous failures');
 assert.equal((await fetch(base+'/api/stories')).status,200);
});
