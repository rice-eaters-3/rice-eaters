'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

test('server: four-player mystery flow, persistence, and Mars save endpoints',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rice-eaters-'));
  process.env.DATA_DIR=directory;
  const {handler}=require('../server.js');
  const server=http.createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const streams=[];
  t.after(async()=>{
    streams.forEach(x=>x.abort());
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(directory,{recursive:true,force:true});
  });
  const clients=Array.from({length:5},()=>({cookie:''}));
  async function call(client,route,method='GET',body){
    const headers={};
    if(client.cookie)headers.Cookie=client.cookie;
    if(body!==undefined)headers['Content-Type']='application/json';
    const response=await fetch(base+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    const setCookie=response.headers.get('set-cookie');
    if(setCookie)client.cookie=setCookie.split(';')[0];
    return {status:response.status,data:await response.json()};
  }
  async function post(client,route,body={}){
    return call(client,route,'POST',body);
  }
  const catalog=await call(clients[0],'/api/stories');
  assert.equal(catalog.status,200);
  assert.equal(catalog.data.stories[0].players,4);
  assert.equal(catalog.data.stories[0].title,'자정의 저택');
  const created=await post(clients[0],'/api/rooms',{storyId:'midnight-manor',name:'방장'});
  assert.equal(created.status,201);
  const code=created.data.code;
  assert.match(code,/^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(created.data.players.length,1);
  const tooEarly=await post(clients[0],'/api/rooms/'+code+'/start');
  assert.equal(tooEarly.status,409,'cannot start with fewer than four players');
  for(let i=1;i<4;i++){
    const joined=await post(clients[i],'/api/rooms/'+code+'/join',{name:'수사관 '+i});
    assert.equal(joined.status,200);
    assert.equal(joined.data.players.length,i+1);
  }
  const preview=await call(clients[4],'/api/rooms/'+code);
  assert.equal(preview.status,200);
  assert.equal(preview.data.me,null);
  const overflow=await post(clients[4],'/api/rooms/'+code+'/join',{name:'다섯 번째'});
  assert.equal(overflow.status,409,'fifth member is rejected');
  // Streaming connections constitute presence; each browser must connect before start.
  for(let i=0;i<4;i++){
    const abort=new AbortController();
    streams.push(abort);
    const resp=await fetch(base+'/api/events?room='+code,{
      headers:{Cookie:clients[i].cookie},
      signal:abort.signal
    });
    assert.equal(resp.status,200);
    assert.match(resp.headers.get('content-type'),/text\/event-stream/);
  }
  const online=await call(clients[0],'/api/rooms/'+code);
  assert.ok(online.data.players.every(p=>p.online),'all four players online');
  const nonHost=await post(clients[1],'/api/rooms/'+code+'/start');
  assert.equal(nonHost.status,403,'only host may start');
  const start=await post(clients[0],'/api/rooms/'+code+'/start');
  assert.equal(start.status,200);
  assert.equal(start.data.phase,'synopsis');
  assert.equal(start.data.synopsis.length,3);
  const peekAfterStart=await call(clients[4],'/api/rooms/'+code);
  assert.equal(peekAfterStart.data.synopsis,null,'synopsis is members-only');
  for(let i=0;i<3;i++){
    const ack=await post(clients[i],'/api/rooms/'+code+'/read');
    assert.equal(ack.status,200);
    assert.equal(ack.data.phase,'synopsis','wait for all acknowledgements');
  }
  const fourth=await post(clients[3],'/api/rooms/'+code+'/read');
  assert.equal(fourth.data.phase,'characters');
  assert.equal(fourth.data.characters.length,4);
  const firstPick=await post(clients[0],'/api/rooms/'+code+'/character',{characterId:'elena'});
  assert.equal(firstPick.status,200);
  const duplicate=await post(clients[1],'/api/rooms/'+code+'/character',{characterId:'elena'});
  assert.equal(duplicate.status,409,'characters must be exclusive');
  for(const [i,id] of [[1,'victor'],[2,'iris'],[3,'noah']]){
    assert.equal((await post(clients[i],'/api/rooms/'+code+'/character',{characterId:id})).status,200);
  }
  const final=await call(clients[0],'/api/rooms/'+code);
  assert.equal(final.data.players.filter(p=>p.characterId).length,4);
  assert.equal(final.data.phase,'characters','next phases are not implemented yet');

  const emptyMars=await call(clients[0],'/api/mars/data');
  assert.deepEqual(emptyMars.data,{progress:null,records:[]});
  const progress={version:3,savedAt:111,game:{gen:2,tiles:{}},mapId:'tharsis'};
  assert.equal((await post(clients[0],'/api/mars/progress',{progress})).status,200);
  assert.deepEqual((await call(clients[0],'/api/mars/data')).data.progress,progress);
  const records=[{date:'2026-10-30',score:42,corp:'test',hand:[],played:[]}];
  assert.equal((await post(clients[0],'/api/mars/records',{records})).status,200);
  assert.equal((await call(clients[0],'/api/mars/data')).data.records.length,1);
  assert.equal((await call(clients[1],'/api/mars/data')).data.records.length,0,'Mars saves isolated by browser session');
  assert.equal((await call(clients[0],'/api/mars/progress','DELETE')).status,200);
  assert.equal((await call(clients[0],'/api/mars/data')).data.progress,null);
  assert.equal((await call(clients[0],'/data/state.json')).status,403,'server state must remain private');
  const diskState=JSON.parse(fs.readFileSync(path.join(directory,'state.json'),'utf8'));
  assert.equal(diskState.rooms[code].phase,'characters');
  assert.equal(diskState.mars[clients[0].cookie.split('=')[1]].records[0].score,42);
  const log=fs.readFileSync(path.join(directory,'activity.jsonl'),'utf8');
  for(const action of ['room_created','room_joined','game_started','synopsis_read','character_selected','mars_records_saved']){
    assert.ok(log.includes('"action":"'+action+'"'),'logged event '+action);
  }
});
