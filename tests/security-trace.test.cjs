'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../apps/security-trace/engine.js');
const cases=require('../apps/security-trace/cases.js');
const G=require('../apps/security-trace/archive.js');

test('each historical case supplies playable rules, graduated hints, and primary sources',()=>{
  assert.deepEqual(cases.map(c=>c.id),['cipher','ledger','trust','mitm','heartbeat','ddos','outbreak']);
  for(const c of cases){
    assert.equal(c.hints.length,3);
    assert.ok(c.rules.length>=3);
    assert.ok(c.history&&c.model&&c.ending);
    assert.ok(c.sources.every(s=>new URL(s.url).protocol==='https:'));
    assert.ok(E.valid(c.id,E.initial(c.id)),c.id);
    assert.equal(E.evaluate(c.id,E.initial(c.id)).ok,false,c.id+' is not solved on entry');
  }
});
test('recovering a reused key restores both telegrams consistently',()=>{
  const state=E.initial('cipher');
  assert.equal(E.evaluate('cipher',state).ok,false);
  for(const [index,turns] of [7,3,1,8,4,6,2,5].entries()){
    for(let i=0;i<turns;i++)state.key=E.act('cipher',state,{type:'dial',index,delta:1}).key;
  }
  assert.equal(E.evaluate('cipher',state).ok,true);
  assert.deepEqual(E.decipher(state.key,E.cipher.first),E.cipher.known);
  assert.equal(E.decipher(state.key,E.cipher.second).join(''),'58302290');
  assert.equal(E.act('cipher',E.initial('cipher'),{type:'dial',index:0,delta:-1}).key[0],9);
});
test('ledger evidence requires both a matching identity chain and corrected clocks',()=>{
  const board={session:'S-04',job:'J-62',print:'P-3',jobShift:-3,printShift:2};
  assert.equal(E.evaluate('ledger',board).ok,true);
  assert.equal(E.evaluate('ledger',{...board,jobShift:0}).ok,false);
  assert.equal(E.evaluate('ledger',{...board,print:'P-4'}).ok,false,'same timestamp is not the same operation');
  assert.equal(E.evaluate('ledger',{...board,session:'S-02'}).ok,false);
});
test('attack route and defense cuts obey trust requirements and retain essential services',()=>{
  let b=E.initial('trust');
  assert.throws(()=>E.act('trust',b,{type:'travel',id:'lab'}),/연결/);
  for(const id of ['mail','lab','backup','archive'])b=E.act('trust',b,{type:'travel',id});
  assert.equal(E.evaluate('trust',b).ok,true);
  b=E.act('trust',b,{type:'switch'});
  assert.equal(b.stage,1);
  b=E.act('trust',b,{type:'cut',id:'m-l'});
  assert.equal(E.evaluate('trust',b).ok,false,'the print-room bypass remains');
  b=E.act('trust',b,{type:'cut',id:'m-p'});
  assert.equal(E.evaluate('trust',b).ok,true);
  assert.deepEqual(E.trustReach(b.cuts),['guest','mail']);
  assert.deepEqual(E.act('trust',b,{type:'cut',id:'g-m'}),b,'essential mail remains enabled');
  assert.throws(()=>E.act('trust',b,{type:'cut',id:'p-b'}),/두 연결/);
});
test('memory leak requires an observed response and its repair accepts all legitimate packet sizes',()=>{
  let b=E.act('heartbeat',E.initial('heartbeat'),{type:'length',value:8});
  assert.equal(E.evaluate('heartbeat',b).ok,false,'changing a request is not observing a response');
  b=E.act('heartbeat',b,{type:'probe'});
  assert.equal(b.response.join(''),'CAT|4729');
  b=E.act('heartbeat',b,{type:'switch'});
  assert.equal(E.evaluate('heartbeat',b).ok,false,'equality wrongly rejects short legitimate requests');
  b=E.act('heartbeat',b,{type:'operator',value:'≤'});
  assert.equal(E.evaluate('heartbeat',b).ok,true);
  assert.throws(()=>E.act('heartbeat',{...E.initial('heartbeat'),claimed:9},{type:'probe'}),/8칸/);
});
test('containment planning models successive infection, cost, and an alternate route',()=>{
  let b=E.initial('outbreak');
  assert.ok(E.spread(b).at(-1).includes('store'));
  b=E.act('outbreak',b,{type:'patch',id:'hub'});
  assert.equal(E.evaluate('outbreak',b).ok,false,'the lab can still infect the ward directly');
  assert.throws(()=>E.act('outbreak',b,{type:'patch',id:'ward'}),/3점/);
  assert.equal(E.cost(b),2,'failed edits preserve the previous plan');
  b=E.act('outbreak',b,{type:'cut',id:'l-w'});
  assert.equal(E.evaluate('outbreak',b).ok,true);
  assert.deepEqual(E.spread(b),[['intake'],['intake','desk','lab']]);
  assert.deepEqual(E.act('outbreak',b,{type:'cut',id:'d-h'}),b);
});
test('MITM needs two distinct encrypted connections and a tested identity policy',()=>{
  let b=E.initial('mitm');
  assert.throws(()=>E.act('mitm',b,{type:'relay'}),/중계/);
  b=E.act('mitm',b,{type:'front',id:'forged'});
  b=E.act('mitm',b,{type:'back',id:'real'});
  assert.equal(E.evaluate('mitm',b).ok,false,'selecting certificates is not observing interception');
  b=E.act('mitm',b,{type:'relay'});
  assert.equal(E.evaluate('mitm',b).ok,true);
  b=E.act('mitm',b,{type:'switch'});
  assert.equal(E.evaluate('mitm',b).ok,false);
  b=E.act('mitm',b,{type:'root',id:'ROOT-D'});
  assert.equal(E.evaluate('mitm',b).ok,false,'trusted issuance alone accepts a different host');
  b=E.act('mitm',b,{type:'hostname'});
  assert.equal(E.evaluate('mitm',b).ok,true);
  b=E.act('mitm',b,{type:'root',id:'ROOT-G'});
  assert.equal(E.evaluate('mitm',b).ok,false,'blocking all connections also blocks the intended service');
});
test('DDoS policies preserve real clients and handle peak origin load within budget',()=>{
  let b=E.initial('ddos');
  assert.equal(E.evaluate('ddos',b).ok,false);
  const limited=E.act('ddos',b,{type:'defense',id:'limit'});
  assert.ok(E.trafficRounds(limited).some(r=>r.served<r.expected),'shared-address clients suffer collateral blocking');
  for(const id of ['challenge','ticket'])b=E.act('ddos',b,{type:'defense',id});
  assert.equal(E.evaluate('ddos',b).ok,false,'legitimate peak load still needs capacity relief');
  b=E.act('ddos',b,{type:'defense',id:'cache'});
  assert.equal(E.evaluate('ddos',b).ok,true);
  assert.equal(E.defenseCost(b),4);
  assert.deepEqual(E.trafficRounds(b).map(r=>r.load),[3,2,3,2]);
  assert.throws(()=>E.act('ddos',b,{type:'defense',id:'limit'}),/4점/);
});
test('archive dossiers require cross-document evidence before sequential boxes open',()=>{
  const s=G.initial();
  assert.equal(G.available(s).length,6);
  assert.equal(new Set(G.records.map(r=>r.person)).size,7);
  assert.deepEqual(G.records.map(r=>r.id),cases.map(c=>c.id));
  for(const r of G.records){
    assert.ok(r.evidence.every(id=>G.documents.some(d=>d.id===id&&d.phase===r.phase)));
    s.drafts[r.id]={person:r.person,team:r.team,outcome:r.outcome,evidence:[...r.evidence]};
  }
  assert.equal(G.assess('cipher',s).ok,false,'correct guesses are insufficient without reading their sources');
  for(const id of ['members','rooms','a-field','a-letter'])s.read.push(id);
  assert.equal(G.assess('cipher',s).ok,true);
  assert.equal(G.seal('cipher',s,[]),false,'a narrative hypothesis also needs its field puzzle');
  assert.equal(G.seal('cipher',s,['cipher']),true);
  assert.equal(G.available(s).length,6,'one recovered file does not open the next box');
  s.read.push('b-field','b-letter');
  G.seal('ledger',s,['ledger']);
  assert.equal(G.available(s).length,10);
  for(const group of [['trust','mitm'],['heartbeat','ddos'],['outbreak']]){
    for(const id of group){
      const r=G.records.find(r=>r.id===id);
      assert.ok(r.evidence.every(source=>G.available(s).some(d=>d.id===source)));
      s.read.push(...r.evidence);
      assert.equal(G.seal(id,s,[id]),true);
    }
  }
  s.pins=['g-field','g-letter'];s.notes['g-field']='나중에 다시 읽기';
  assert.deepEqual(G.restore(JSON.parse(JSON.stringify(s))),{...s,hints:Object.fromEntries(G.records.map(r=>[r.id,0]))});
  const damaged=G.restore({sealed:['outbreak'],read:['g-field','g-letter'],drafts:s.drafts,pins:['g-field']});
  assert.equal(damaged.sealed.length,0,'future sources cannot be unlocked by a damaged save');
  assert.equal(damaged.pins.length,0);
});
test('progress restore retains real solutions and recovers safely from damaged or obsolete saves',()=>{
  const solved={key:[7,3,1,8,4,6,2,5]};
  const raw={version:1,current:'cipher',completed:['cipher','ledger','unknown'],cases:{
    cipher:{board:solved,hints:2},ledger:{board:E.initial('ledger'),hints:0},
    trust:{board:{stage:1,path:['guest','archive'],cuts:[]},hints:0}
  }};
  const restored=E.restore(raw);
  assert.deepEqual(restored.completed,['cipher']);
  assert.deepEqual(restored.cases.cipher,{board:solved,hints:2});
  assert.equal(restored.cases.trust,undefined);
  assert.deepEqual(E.restore({version:0}),E.restore(null));
  assert.equal(E.valid('heartbeat',{...E.initial('heartbeat'),response:['stolen']}),false);
  assert.equal(E.valid('outbreak',{patched:['hub','hub'],cuts:[]}),false);
});
test('the app library and both short URLs serve the new application and its assets',async t=>{
  const http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'trace-routes-'));
  process.env.DATA_DIR=dataDir;
  const {handler}=require('../server.js');
  const server=http.createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(dataDir,{force:true,recursive:true});
  });
  const base='http://127.0.0.1:'+server.address().port;
  const home=await (await fetch(base+'/')).text();
  assert.match(home,/href="\/trace"/);
  for(const route of ['/trace','/trace/','/apps/security-trace/index.html']){
    const r=await fetch(base+route);assert.equal(r.status,200);
    assert.match(await r.text(),/패킷의 흔적/);
  }
  for(const file of ['style.css','app.js','engine.js','cases.js','archive.js']){
    assert.equal((await fetch(base+'/apps/security-trace/'+file)).status,200,file);
  }
});
