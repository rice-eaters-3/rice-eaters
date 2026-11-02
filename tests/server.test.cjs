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
  const health=await fetch(base+'/healthz');
  assert.equal(health.status,200,'healthcheck must return 200');
  assert.deepEqual(await health.json(),{ok:true});
  assert.equal(health.headers.get('set-cookie'),null,'healthcheck should not allocate a session');
  assert.equal((await call(clients[0],'/server.js')).status,403,'internal server code must be blocked');
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
  // Cloudflare Quick Tunnels reject SSE. A separate room must work using
  // ordinary GET requests only, including all-online check and game start.
  const pollCreated=await post(clients[0],'/api/rooms',{storyId:'midnight-manor',name:'터널 방장'});
  const pollCode=pollCreated.data.code;
  for(let i=1;i<4;i++){
    const joined=await post(clients[i],'/api/rooms/'+pollCode+'/join',{name:'터널 친구 '+i});
    assert.equal(joined.status,200);
  }
  const outsidersView=await call(clients[4],'/api/rooms/'+pollCode);
  assert.equal(outsidersView.data.players.filter(p=>p.online).length,0,'outsider preview does not set presence');
  for(let i=0;i<4;i++){
    assert.equal((await call(clients[i],'/api/rooms/'+pollCode)).status,200);
  }
  const pollOnline=await call(clients[0],'/api/rooms/'+pollCode);
  assert.equal(pollOnline.data.players.filter(p=>p.online).length,4,'four HTTP-only players online');
  assert.equal((await post(clients[0],'/api/rooms/'+pollCode+'/start')).data.phase,'synopsis','polling-only lobby can start');
  for(let i=0;i<4;i++){
    const ack=await post(clients[i],'/api/rooms/'+pollCode+'/read');
    assert.equal(ack.status,200);
  }
  assert.equal((await call(clients[2],'/api/rooms/'+pollCode)).data.phase,'characters','polling-only synopsis advances');

  const nonHost=await post(clients[1],'/api/rooms/'+code+'/start');
  assert.equal(nonHost.status,403,'only host may start');
  const start=await post(clients[0],'/api/rooms/'+code+'/start');
  assert.equal(start.status,200);
  assert.equal(start.data.phase,'synopsis');
  assert.equal(start.data.synopsis.length,3);
  assert.ok(start.data.clock.gameStartedAt>0);
  assert.equal(start.data.clock.phaseMinutes.synopsis,5);
  assert.equal(start.data.clock.phaseMinutes.characters,5);
  assert.equal(start.data.clock.phaseMinutes.study,20);
  assert.equal(start.data.clock.phaseMinutes.investigation1,20);
  assert.equal(start.data.clock.phaseMinutes.discussion1,15);
  assert.equal(start.data.clock.phaseMinutes.investigation2,20);
  assert.equal(start.data.clock.phaseMinutes.discussion2,20);
  assert.equal(start.data.clock.phaseMinutes.action,10);
  assert.equal(start.data.clock.phaseMinutes.ending,15);
  assert.equal(start.data.clock.phaseStartedAt,start.data.clock.gameStartedAt);
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
  assert.equal(final.data.phase,'study','all four picks advance automatically');
  assert.equal(final.data.booklet.basic.name,'엘레나 블랙우드');
  assert.equal(final.data.booklet.culprit,false);
  assert.equal(final.data.booklet.timeline.length,4);
  assert.equal(final.data.booklet.inventory.length,2);
  assert.equal(final.data.booklet.shared.characters.length,4);
  assert.equal(final.data.map.avatars.length,4);
  assert.equal(final.data.map.tiles.length,11);
  assert.equal(final.data.map.avatars.find(p=>p.id===final.data.me).x,2);
  assert.equal((await call(clients[0],'/private/mystery-data.js')).status,403,'private source must not be served');
  assert.equal((await call(clients[0],'/api/events?room=ZZZZZZ')).status,404,'wrong room cannot stream');
  const stranger=await call(clients[4],'/api/rooms/'+code);
  assert.equal(stranger.data.booklet,null,'non-members never see a booklet');
  assert.equal(stranger.data.map,null,'non-members never see the floorplan or positions');
  assert.equal(stranger.data.characters,null,'non-members cannot request characters');
  const strangerStream=await call(clients[4],'/api/rooms/'+code+'/move','POST',{direction:'right'});
  assert.equal(strangerStream.status,403);
  const strangerReady=await post(clients[4],'/api/rooms/'+code+'/study-ready');
  assert.equal(strangerReady.status,403);
  for(const [i,character,culprit] of [[0,'엘레나 블랙우드',false],[1,'빅터 헤일',false],[2,'아이리스 모건',false],[3,'노아 그레이',true]]){
    const detail=(await call(clients[i],'/api/rooms/'+code)).data;
    assert.equal(detail.booklet.basic.name,character);
    assert.equal(detail.booklet.culprit,culprit);
    assert.equal(detail.booklet.background.length,3);
    assert.equal(detail.booklet.timeline.length,4);
    assert.equal(detail.booklet.inventory.length,2);
    assert.ok(detail.booklet.objectives);
    assert.ok(detail.booklet.shared.synopsis.length>0);
    assert.equal(detail.booklet.background.some(t=>t.includes('당신은 이번 사건의 범인입니다')),culprit,'culprit secret is never disclosed to others');
    assert.equal(detail.map.avatars.length,4,'positions are visible to the room');
  }
  const oldPick=await post(clients[1],'/api/rooms/'+code+'/character',{characterId:'elena'});
  assert.equal(oldPick.status,409,'casting is locked once study starts');
  assert.equal((await post(clients[0],'/api/rooms/'+code+'/move',{direction:'warp'})).status,400,'invalid direction rejected');
  const moving=await post(clients[0],'/api/rooms/'+code+'/move',{direction:'left'});
  assert.equal(moving.status,200);
  assert.equal(moving.data.map.avatars.find(p=>p.id===moving.data.me).x,1,'move exactly one tile');
  assert.equal((await call(clients[1],'/api/rooms/'+code)).data.map.avatars.find(p=>p.id===final.data.me).x,1,'other player observes move');
  const fastMove=await post(clients[0],'/api/rooms/'+code+'/move',{direction:'down'});
  assert.equal(fastMove.status,429,'movement cooldown enforced');
  await new Promise(resolve=>setTimeout(resolve,160));
  const wall=await post(clients[0],'/api/rooms/'+code+'/move',{direction:'left'});
  assert.equal(wall.status,409,'cannot walk through a wall');
  assert.equal((await call(clients[0],'/api/rooms/'+code)).data.map.avatars.find(p=>p.id===final.data.me).x,1,'invalid move does not change position');
  for(let i=0;i<4;i++){
    const ack=await post(clients[i],'/api/rooms/'+code+'/study-ready');
    assert.equal(ack.status,200);
    assert.equal(ack.data.players.filter(p=>p.studyReady).length,i+1);
  }
  const afterReady=await call(clients[0],'/api/rooms/'+code);
  assert.equal(afterReady.data.phase,'investigation1','all four ready starts investigation1');
  assert.equal(afterReady.data.clock.phaseMinutes.investigation1,20);
  assert.ok(afterReady.data.clock.phaseStartedAt>=start.data.clock.phaseStartedAt);
  assert.equal(afterReady.data.investigation.tokens,4,'four tokens allocated');
  assert.ok(afterReady.data.investigation.cards.find(c=>c.id==='desk'));
  assert.ok(!afterReady.data.investigation.cards.find(c=>c.id==='desk_corner'),'hidden prerequisite card not listed');
  assert.equal(afterReady.data.investigation.cards.find(c=>c.id==='elena_belongings').excluded,true);
  assert.equal(afterReady.data.investigation.cards.find(c=>c.id==='archives').locked,true);
  assert.equal((await post(clients[0],'/api/rooms/'+code+'/study-ready')).status,409,'study stage cannot repeat');
  assert.equal((await post(clients[0],'/api/rooms/'+code+'/reserve',{cardId:'elena_belongings'})).status,403,'cannot investigate own belongings');
  const firstReservation=await post(clients[0],'/api/rooms/'+code+'/reserve',{cardId:'desk'});
  assert.equal(firstReservation.status,200);
  assert.equal(firstReservation.data.investigation.cards.find(c=>c.id==='desk').reservedBy,final.data.me);
  assert.equal((await post(clients[1],'/api/rooms/'+code+'/reserve',{cardId:'desk'})).status,409,'server rejects competing reservation');
  assert.equal((await post(clients[1],'/api/rooms/'+code+'/investigate',{cardId:'desk'})).status,409,'cannot bypass reservation');
  const revealed=await post(clients[0],'/api/rooms/'+code+'/investigate',{cardId:'desk'});
  assert.equal(revealed.status,200);
  assert.equal(revealed.data.investigation.tokens,3,'one token consumed exactly once');
  assert.equal(revealed.data.investigation.cards.find(c=>c.id==='desk').revealed.length,1,'investigator sees back');
  assert.ok(revealed.data.investigation.cards.some(c=>c.id==='desk_corner'),'prerequisite unlocks hidden card');
  const otherCards=(await call(clients[1],'/api/rooms/'+code)).data.investigation.cards;
  assert.equal(otherCards.find(c=>c.id==='desk').taken,true,'claimed card is greyed out globally');
  assert.deepEqual(otherCards.find(c=>c.id==='desk').revealed,[],'other player never receives investigation back');
  assert.equal((await post(clients[1],'/api/rooms/'+code+'/reserve',{cardId:'desk'})).status,409,'duplicate investigation forbidden');
  const release=await post(clients[1],'/api/rooms/'+code+'/reserve',{cardId:'photo'});
  assert.equal(release.status,200);
  assert.equal((await post(clients[1],'/api/rooms/'+code+'/release',{cardId:'photo'})).status,200);
  assert.equal((await post(clients[2],'/api/rooms/'+code+'/reserve',{cardId:'photo'})).status,200,'released card can be claimed by another');
  assert.equal(afterReady.data.players.filter(p=>p.studyReady).length,4);
  assert.equal((await post(clients[0],'/api/rooms/'+code+'/reserve',{cardId:'nonexistent'})).status,404);
  assert.equal((await post(clients[4],'/api/rooms/'+code+'/reserve',{cardId:'photo'})).status,403,'outsiders cannot reserve cards');
  assert.equal((await post(clients[0],'/api/rooms/'+code+'/whisper-request')).status,409,'one person alone cannot whisper');
  assert.equal((await post(clients[0],'/api/rooms/'+code+'/signal',{to:'not-a-member',type:'offer',payload:{sdp:{}}})).status,400);
  const hello=await post(clients[0],'/api/rooms/'+code+'/signal',{to:afterReady.data.players[1].id,type:'hello',payload:{}});
  assert.equal(hello.status,200);
  const signal=await call(clients[1],'/api/rooms/'+code+'/signals?after=0');
  assert.equal(signal.status,200);
  assert.equal(signal.data.signals[0].from,afterReady.data.me);
  assert.equal((await call(clients[4],'/api/rooms/'+code+'/signals?after=0')).status,403);

  // Simultaneous selections must have exactly one winner.
  const [raceA,raceB]=await Promise.all([
    post(clients[0],'/api/rooms/'+code+'/reserve',{cardId:'dining'}),
    post(clients[1],'/api/rooms/'+code+'/reserve',{cardId:'dining'})
  ]);
  assert.deepEqual([raceA.status,raceB.status].sort(),[200,409],
    'concurrent card race has one winner');
  await post(clients[raceA.status===200?0:1],'/api/rooms/'+code+'/release',{cardId:'dining'});

  async function walk(i,moves){
    for(const direction of moves){
      const result=await post(clients[i],'/api/rooms/'+code+'/move',{direction});
      assert.equal(result.status,200,'walk '+direction+' succeeds: '+JSON.stringify(result.data));
      await new Promise(resolve=>setTimeout(resolve,145));
    }
  }
  // Character 1 traverses the stairs from ground to upper floor.
  await walk(1,['down','down','left','left','left','left']);
  const upstairs=(await call(clients[1],'/api/rooms/'+code)).data;
  assert.equal(upstairs.map.floorId,'upper','stepping on stairs changes map floor');
  assert.equal(upstairs.players.find(p=>p.id===upstairs.me).position.floor,'upper');
  assert.ok(!((await call(clients[0],'/api/rooms/'+code)).data.map.avatars.some(p=>p.id===upstairs.me)),
    'different-floor avatars do not appear on ground floor');
  // Elena and Iris meet on the dining room floor and start a unanimous whisper.
  await walk(0,['right','down','down','right','down','down','down','down']);
  await walk(2,['right']);
  const joinedPos=(await call(clients[0],'/api/rooms/'+code)).data.players;
  assert.deepEqual(joinedPos.find(p=>p.id===final.data.me).position,
    {floor:'ground',x:3,y:9});
  const request=await post(clients[0],'/api/rooms/'+code+'/whisper-request');
  assert.equal(request.status,200);
  const proposal=request.data.whispers.proposals[0];
  assert.equal(proposal.yes.length,1,'requester self-approves');
  assert.equal(proposal.voters.length,2,'same-tile peers vote');
  assert.equal((await post(clients[1],'/api/rooms/'+code+'/whisper-vote',
    {proposalId:proposal.id,accept:true})).status,403,'remote players cannot vote');
  const voting=await post(clients[2],'/api/rooms/'+code+'/whisper-vote',
    {proposalId:proposal.id,accept:true});
  assert.equal(voting.status,200);
  assert.equal(voting.data.whispers.groups[0].members.length,2,'unanimity creates private group');
  await walk(0,['left']);
  assert.equal((await call(clients[2],'/api/rooms/'+code)).data.whispers.groups.length,0,
    'leaving the shared tile automatically ends one-to-one whisper');

  // SSE still works: all updates are serialized through each member's own view.
  assert.equal(final.data.booklet.basic.name,'엘레나 블랙우드');

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
  assert.equal(diskState.rooms[code].phase,'investigation1');
  assert.equal(diskState.rooms[code].investigation.tokens[final.data.me],3);
  assert.equal(diskState.rooms[code].mapPositions[final.data.me].x,2,'position after leaving whisper tile');
  assert.equal(diskState.mars[clients[0].cookie.split('=')[1]].records[0].score,42);
  const log=fs.readFileSync(path.join(directory,'activity.jsonl'),'utf8');
  for(const action of ['room_created','room_joined','game_started','synopsis_read','character_selected','phase_study','study_ready','phase_investigation1','card_investigated','mars_records_saved']){
    assert.ok(log.includes('"action":"'+action+'"'),'logged event '+action);
  }
});
