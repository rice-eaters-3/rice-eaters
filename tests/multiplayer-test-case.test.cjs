'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const pkg=require('../mystery-content/multiplayer-test.case.json');

test('QA package is valid and every role has test actions, items and endings',()=>{
 const p=require('../mystery-content/validate.js').validate(pkg);
 assert.equal(p.story.players,7);assert.equal(pkg.story.testOnly,true);
 assert.equal(p.game.floors.length,2);assert.equal(p.game.investigation.cards.length,44);
 assert.equal(p.game.booklets.tester1.culprit,true);
 for(const c of p.story.characters){assert.equal(p.game.booklets[c.id].inventory.length,4);assert.ok(p.game.ending.characters[c.id].alive);}
});

test('real multiplayer QA rooms complete all phases for every capacity from 3 to 7',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-mystery-'));process.env.DATA_DIR=dir;
 const {handler}=require('../server.js');const server=http.createServer(handler);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 for(let count=3;count<=7;count++)await t.test(count+' separate player sessions',async()=>{
  const clients=Array.from({length:count+1},()=>({cookie:''}));
  async function req(i,url,body){const headers={Cookie:clients[i].cookie};if(body!==undefined)headers['Content-Type']='application/json';
   const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
   const cookie=r.headers.get('set-cookie');if(cookie)clients[i].cookie=cookie.split(';')[0];return {status:r.status,data:await r.json()};}
  async function post(i,url,body={}){const r=await req(i,url,body);assert.equal(r.status,url==='/api/rooms'?201:200,url+' '+JSON.stringify(r.data));return r.data;}
  for(const bad of [2,8,3.5,'3'])assert.equal((await req(0,'/api/rooms',{storyId:pkg.story.id,name:'bad',playerCount:bad})).status,400);
  const created=await post(0,'/api/rooms',{storyId:pkg.story.id,name:'host',playerCount:count});const endpoint='/api/rooms/'+created.code;
  assert.equal(created.story.players,count);assert.equal(created.story.testOnly,true);
  assert.equal((await req(0,endpoint+'/start',{})).status,409);
  for(let i=1;i<count;i++)await post(i,endpoint+'/join',{name:'guest'+i});
  assert.equal((await req(count,endpoint+'/join',{name:'overflow'})).status,409);
  for(let i=0;i<count;i++)await req(i,endpoint);
  assert.equal((await req(1,endpoint+'/start',{})).status,403);
  await post(0,endpoint+'/start');
  for(let i=0;i<count;i++)await post(i,endpoint+'/read');
  const cast=await post(0,endpoint+'/advance');assert.equal(cast.phase,'characters');assert.equal(cast.characters.length,count);
  if(count<7)assert.equal((await req(0,endpoint+'/character',{characterId:'tester7'})).status,400);
  for(let i=0;i<count;i++)await post(i,endpoint+'/character',{characterId:'tester'+(i+1)});
  assert.equal((await post(0,endpoint+'/advance')).phase,'study');
  for(let i=0;i<count;i++)await post(i,endpoint+'/study-ready');
  const first=await post(0,endpoint+'/advance');assert.equal(first.phase,'investigation1');
  assert.ok(!first.investigation.cards.some(c=>c.id.startsWith('tester'+(count+1)+'_')));
  assert.equal((await req(count,endpoint)).data.investigation,null);
  // Same-tile consent, private evidence, public reveal and ownership transfer.
  await post(0,endpoint+'/move',{direction:'right'});
  const peer=(await req(1,endpoint)).data.me;
  const whisper=await post(0,endpoint+'/whisper-request');const proposal=whisper.whispers.proposals[0];
  assert.equal((await post(1,endpoint+'/whisper-vote',{proposalId:proposal.id,accept:true})).whispers.groups[0].members.length,2);
  await post(0,endpoint+'/whisper-leave');
  async function investigate(i,id){await post(i,endpoint+'/reserve',{cardId:id});return post(i,endpoint+'/investigate',{cardId:id});}
  let view=await investigate(0,'tester2_item1');const holding=view.investigation.myCards.find(c=>c.cardId==='tester2_item1');
  assert.equal((await req(1,endpoint)).data.investigation.cards.find(c=>c.id==='tester2_item1').revealed.length,0);
  await post(0,endpoint+'/card-share',{holdingId:holding.id,toId:peer});
  assert.ok((await req(1,endpoint)).data.investigation.cards.find(c=>c.id==='tester2_item1').sharedToMe);
  const offered=await post(0,endpoint+'/exchange-offer',{type:'card',holdingId:holding.id,toId:peer});
  const accepted=await post(1,endpoint+'/exchange-reply',{offerId:offered.investigation.outgoingOffers[0].id,accept:true});
  assert.ok(accepted.investigation.myCards.some(c=>c.id===holding.id));
  assert.equal((await req(0,endpoint)).data.investigation.cards.find(c=>c.id==='tester2_item1').revealed.length,0);
  await post(1,endpoint+'/card-public',{holdingId:holding.id});
  assert.equal((await req(2,endpoint)).data.investigation.cards.find(c=>c.id==='tester2_item1').public,true);
  await investigate(0,'ground_left_1');
  assert.equal((await req(0,endpoint+'/reserve',{cardId:'ground_left_2'})).status,409);
  await investigate(1,'ground_left_2');
  await investigate(2,'tester2_item2');
  assert.equal((await req(0,endpoint+'/reserve',{cardId:'tester2_item3'})).status,409);
  async function advance(){for(let i=0;i<count;i++)await post(i,endpoint+'/advance-vote');return post(0,endpoint+'/advance');}
  assert.equal((await req(0,endpoint+'/advance',{})).status,409);
  assert.equal((await advance()).phase,'discussion1');assert.equal((await advance()).phase,'investigation2');
  assert.equal((await investigate(0,'tester2_item3')).investigation.myCards.some(c=>c.cardId==='tester2_item3'),true);
  if(count===3){
   async function move(direction,turnOnly=false){await new Promise(r=>setTimeout(r,130));return post(0,endpoint+'/move',{direction,turnOnly});}
   for(const dir of ['right','right','down'])await move(dir);
   await move('right',true);
   for(const doorAction of ['open','close','open']){
    const updated=await post(0,endpoint+'/interact',{kind:'door',doorId:'test_door',doorAction});
    assert.equal(updated.map.doors[0].open,doorAction==='open');
   }
   for(const dir of ['left','left','left','down','down'])await move(dir);
   assert.equal((await post(0,endpoint+'/interact',{kind:'portal',portalIndex:0})).map.floorId,'upper');
   for(const dir of ['right','right','right','up','up'])await move(dir);
   await move('right',true);
   const unlocked=await post(0,endpoint+'/interact',{kind:'door',doorId:'test_door',doorAction:'open'});
   assert.equal(unlocked.map.doors[0].locked,false,'investigated key opens the upper locked door');
  }
  assert.equal((await advance()).phase,'discussion2');
  assert.equal((await req(1,endpoint+'/verdict-arrest',{characterId:'tester1'})).status,403);
  await post(0,endpoint+'/verdict-arrest',{characterId:'tester1'});
  const action=await advance();assert.equal(action.phase,'action');assert.equal(action.action.total,count);
  for(let i=0;i<count;i++)await post(i,endpoint+'/act',{abilityId:i===0?'test_action1':i===1?'test_action2':i===2?'test_action3':'pass'});
  const final=await advance();assert.equal(final.phase,'ending');assert.ok(final.ending);
  for(let i=0;i<count;i++)assert.equal((await req(i,endpoint)).data.phase,'ending');
  const saved=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8')).rooms[created.code];
  assert.equal(saved.targetPlayers,count);assert.equal(saved.actions.done,true);
 });
 // Fixed-size stories cannot have their cap overridden by a request.
 const r=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({storyId:'jeju-lab-conference',name:'fixed',playerCount:3})});assert.equal((await r.json()).story.players,7);
});
