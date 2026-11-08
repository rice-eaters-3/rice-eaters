'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const raw=require('../mystery-content/d1-gaming.case.json');
const {validate}=require('../mystery-content/validate.js');

test('D1 mystery JSON has seven roles, 28 owned belongings, 43 layered clues and a solvable map',()=>{
  const normalized=validate(raw);
  assert.equal(raw.format,'rice-mystery-v1');
  assert.equal(raw.story.id,'d1-crown-of-ashes');
  assert.equal(normalized.story.players,7);
  assert.equal(normalized.story.characters.length,7);
  assert.deepEqual(raw.story.characters.map(c=>c.name),
    ['조비','마유시','차지우','클라우드','카알','하수','맥']);
  assert.equal(raw.story.characters.some(c=>c.name==='배익호'),false,'the victim is not a playable role');
  const booklets=raw.game.booklets,ids=raw.story.characters.map(c=>c.id);
  assert.equal(Object.keys(booklets).length,7);
  assert.equal(ids.filter(id=>booklets[id].culprit).length,1);
  assert.equal(booklets.mac.culprit,true,'author canonical solution uses a single culprit');
  assert.equal(booklets.karl.culprit,false,'manager is explicitly innocent');
  for(const id of ids){
    assert.equal(booklets[id].inventory.length,4,id+' has exactly four items');
    assert.ok(booklets[id].timeline.length>=9,id+' has a detailed timeline');
    assert.ok(booklets[id].objectives.includes('점'),id+' has text-only manual score goals');
    assert.ok(booklets[id].background.length>=4,id+' has a multidimensional private story');
  }
  const cards=raw.game.investigation.cards;
  assert.equal(cards.length,71);
  assert.equal(new Set(cards.map(c=>c.id)).size,71,'cards require stable unique IDs');
  const personal=cards.filter(c=>c.type==='belonging');
  assert.equal(personal.length,28);
  for(const id of ids){
    assert.equal(personal.filter(c=>c.owner===id).length,4,id+' owns 4 private clue cards');
    for(const item of booklets[id].inventory)assert.ok(personal.some(c=>c.owner===id&&c.id===item.id));
  }
  const others=cards.filter(c=>c.type!=='belonging');
  assert.equal(others.length,43);
  assert.deepEqual(['cult','timeline','trick'].map(k=>others.filter(c=>c.clueKind===k).length),[12,12,19]);
  assert.equal(cards.filter(c=>c.availableFromPhase==='investigation2').length,21,
    'some hidden information is inaccessible in first round');
  assert.equal(cards.filter(c=>c.visibility==='hidden').length,10,
    'late clues can remain invisible rather than merely locked');
  assert.ok(cards.filter(c=>c.requiresPresence).length>=10,'map must be meaningful to the investigation');
  assert.equal(raw.game.investigation.tokensPerPlayer,4);
  assert.equal(raw.game.investigation.tokensPerSecondInvestigation,4);
  assert.equal(raw.story.players*(4+4),56,'exactly 56 investigation tokens are issued');
  assert.equal(raw.game.floors.length,4);
  const penthouse=raw.game.floors.find(f=>f.id==='penthouse');
  const galleryDoor=penthouse.doors.find(d=>d.id==='ne_door');
  assert.equal(galleryDoor.locked,true,'secret gallery is initially sealed');
  assert.equal(galleryDoor.requiresItem,'gallery_key');
  assert.equal(penthouse.areas.find(a=>a.id==='northeast').revealDoor,'ne_door');
  assert.equal(normalized.game.floors.find(f=>f.id==='penthouse').areas.find(a=>a.id==='northeast').revealDoor,'ne_door');
  const throne=cards.find(c=>c.id==='trick_throne_scene');
  assert.equal(throne.requiresPresence,true,'gallery key requires physically inspecting the throne');
  assert.equal(throne.grant?.id,'gallery_key');
  assert.equal(normalized.game.investigation.cards.find(c=>c.id==='trick_throne_scene').grant?.id,'gallery_key');
  const hasuDinner=booklets.hasu.timeline.find(t=>t.time==='19:30').detail;
  for(const phrase of ['후원금이 어디로 갑니까','교단 후원금','교단을 언급'])
    assert.ok(!hasuDinner.includes(phrase),'cult must stay secret at dinner');
  assert.equal(raw.game.floors.some(f=>f.doors.some(d=>d.requiresItem==='vault_override')),true,
    'vault cannot be entered until the investigation item is acquired');
  const vault=cards.find(c=>c.id==='trick_spare_override');
  assert.equal(vault.availableFromPhase,'investigation2');
  assert.equal(vault.grant.id,'vault_override');
  assert.equal(vault.requiresPresence,true);
  assert.equal(normalized.game.investigation.cards.find(c=>c.id==='trick_spare_override').requiresPresence,true,
    'editor import must preserve location-bound mechanics');
  assert.equal(normalized.game.investigation.cards.find(c=>c.id==='time_mayushi_warning').insights.mayushi?.length>0,true,
    'psychometry insight belongs to a single character');
  const floorMap=new Map(raw.game.floors.map(f=>[f.id,f]));
  for(const floor of raw.game.floors){
    assert.ok(floor.areas.length>=4,'areas delineate functional rooms');
    for(const door of floor.doors)assert.equal(floor.tiles[door.y][door.x],'.');
    for(const portal of floor.portals)assert.equal(floorMap.get(portal.toFloor)?.tiles[portal.toY][portal.toX],'.');
  }
  for(const card of cards)if(card.location){
    const floor=floorMap.get(card.location.floor);
    assert.equal(floor?.tiles[card.location.y][card.location.x],'.',card.id+' must be placed on walkable tile');
  }
  assert.equal(raw.creatorGuide.culprit,'맥');
  assert.equal(raw.creatorGuide.canonicalTimes.some(x=>x.includes('00:26')),true);
});

test('seven-player D1 case: private visions, first-round sealed clues, second-round key and vault',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'d1-playtest-'));
  process.env.DATA_DIR=dataDir;
  const {handler}=require('../server.js');
  const server=http.createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(done=>server.close(done));
    fs.rmSync(dataDir,{force:true,recursive:true})});
  const base='http://127.0.0.1:'+server.address().port,people=Array.from({length:8},()=>({cookie:''}));
  async function call(i,route,method='GET',payload){
    const headers={};if(people[i].cookie)headers.Cookie=people[i].cookie;
    if(payload!==undefined)headers['Content-Type']='application/json';
    const res=await fetch(base+route,{method,headers,
      body:payload===undefined?undefined:JSON.stringify(payload)});
    if(res.headers.get('set-cookie'))people[i].cookie=res.headers.get('set-cookie').split(';')[0];
    const type=res.headers.get('content-type')||'';
    return {status:res.status,data:type.includes('application/json')?await res.json():await res.text()};
  }
  const post=(i,route,body={})=>call(i,route,'POST',body);
  const catalog=(await call(7,'/api/stories')).data.stories;
  assert.ok(catalog.some(x=>x.id===raw.story.id&&x.players===7));
  assert.equal(JSON.stringify(catalog).includes('맥은'),false,'catalog must not contain culprit secrets');
  assert.equal((await call(7,'/mystery-content/d1-gaming.case.json')).status,403,
    'JSON containing spoilers is not downloadable from the application');
  const room=await post(0,'/api/rooms',{storyId:raw.story.id,name:'방장'});
  assert.equal(room.status,201);
  const endpoint='/api/rooms/'+room.data.code;
  for(let i=1;i<7;i++)assert.equal((await post(i,endpoint+'/join',{name:'참가자'+i})).status,200);
  for(let i=0;i<7;i++)await call(i,endpoint);
  assert.equal((await post(0,endpoint+'/start')).status,200);
  for(let i=0;i<7;i++)await post(i,endpoint+'/read');
  assert.equal((await post(0,endpoint+'/advance')).data.phase,'characters');
  const names=['jobi','mayushi','chajiwoo','cloud','karl','hasu','mac'];
  for(let i=0;i<7;i++)assert.equal((await post(i,endpoint+'/character',{characterId:names[i]})).status,200);
  assert.equal((await post(0,endpoint+'/advance')).data.phase,'study');
  const ma=(await call(1,endpoint)).data;
  assert.equal(ma.booklet.culprit,false);
  assert.equal(ma.booklet.inventory.length,4);
  assert.equal((await call(6,endpoint)).data.booklet.culprit,true);
  assert.equal((await call(7,endpoint)).data.booklet,null,'visitors cannot read any book');
  for(let i=0;i<7;i++)await post(i,endpoint+'/study-ready');
  const first=await post(0,endpoint+'/advance');
  assert.equal(first.data.phase,'investigation1');
  const before=await Promise.all(names.map((_,i)=>call(i,endpoint)));
  assert.equal(before.reduce((n,r)=>n+r.data.investigation.tokens,0),28);
  const galleryRemote=await post(4,endpoint+'/reserve',{cardId:'cult_hero_landing_syllabus'});
  assert.equal(galleryRemote.status,409,'remote gallery evidence is inaccessible while locked');
  assert.equal(before[4].data.investigation.cards.some(c=>c.id==='cult_hero_landing_syllabus'),false,
    'sealed room cards are absent from player catalog');
  const unavailable=await post(4,endpoint+'/reserve',{cardId:'trick_spare_override'});
  assert.equal(unavailable.status,409,'round 2 item is locked before stage 2');
  assert.equal(before[4].data.investigation.cards.some(c=>c.id==='trick_spare_override'),false,
    'hidden stage 2 clue must not leak its existence in phase one');
  // A baseline fund clue opens a second-round document.
  assert.equal((await post(0,endpoint+'/reserve',{cardId:'cult_fund_account'})).status,200);
  assert.equal((await post(0,endpoint+'/investigate',{cardId:'cult_fund_account'})).status,200);
  // New rule: each investigator can inspect only one belonging per other role, per round.
  assert.equal((await post(0,endpoint+'/reserve',{cardId:'cloud_huoguo_ladle'})).status,200);
  assert.equal((await post(0,endpoint+'/investigate',{cardId:'cloud_huoguo_ladle'})).status,200);
  const limited=(await call(0,endpoint)).data.investigation;
  assert.equal(limited.cards.find(c=>c.id==='cloud_elephant_eggplant').personLimitReached,true);
  assert.equal((await post(0,endpoint+'/reserve',{cardId:'cloud_elephant_eggplant'})).status,409,
    'Jobi cannot investigate a second Cloud belonging in round one');
  assert.equal((await post(0,endpoint+'/investigate',{cardId:'cloud_elephant_eggplant'})).status,409,
    'direct investigate also enforces the personal target limit');
  assert.equal((await call(0,endpoint)).data.investigation.tokens,2,
    'blocked attempts do not spend any tokens');
  assert.equal((await post(0,endpoint+'/reserve',{cardId:'hasu_solo_kill_log'})).status,200,
    'different target characters each have an independent allowance');
  assert.equal((await post(0,endpoint+'/investigate',{cardId:'hasu_solo_kill_log'})).status,200);
  assert.equal((await post(1,endpoint+'/reserve',{cardId:'cloud_elephant_eggplant'})).status,200,
    'another investigator can inspect Cloud belongings in the same round');
  assert.equal((await post(1,endpoint+'/investigate',{cardId:'cloud_elephant_eggplant'})).status,200);
  // Mayushi's psychometry is visible to her only, even if her clue is made public.
  assert.equal((await post(1,endpoint+'/reserve',{cardId:'time_mayushi_warning'})).status,200);
  const vision=await post(1,endpoint+'/investigate',{cardId:'time_mayushi_warning'});
  assert.equal(vision.status,200);
  const held=vision.data.investigation.myCards.find(c=>c.cardId==='time_mayushi_warning');
  assert.ok(held.insight?.includes('🔮'));
  assert.equal((await call(0,endpoint)).data.investigation.cards.find(c=>c.id==='time_mayushi_warning').revealed.length,0);
  assert.equal((await post(1,endpoint+'/card-public',{holdingId:held.id})).status,200);
  const borrowed=(await call(0,endpoint)).data.investigation.cards.find(c=>c.id==='time_mayushi_warning').revealed[0];
  assert.ok(borrowed.back.length>0);
  assert.equal(borrowed.insight,null,'global publication never leaks private psychometry');
  for(let i=0;i<7;i++)await post(i,endpoint+'/advance-vote');
  assert.equal((await post(0,endpoint+'/advance')).data.phase,'discussion1');
  for(let i=0;i<7;i++)await post(i,endpoint+'/advance-vote');
  const second=await post(0,endpoint+'/advance');
  assert.equal(second.data.phase,'investigation2');
  const wallets=await Promise.all(names.map((_,i)=>call(i,endpoint)));
  assert.equal(wallets.reduce((n,r)=>n+r.data.investigation.tokens,0),51,
    '56 tokens issued in total minus five phase-one investigations');
  assert.equal(wallets[0].data.investigation.cards.find(c=>c.id==='cloud_tainted_cleaver').personLimitReached,false,
    'the round-one Cloud limit resets when round two begins');
  assert.equal((await post(0,endpoint+'/reserve',{cardId:'cloud_tainted_cleaver'})).status,200,
    'same player can inspect the same character again in round two');
  assert.equal((await post(0,endpoint+'/investigate',{cardId:'cloud_tainted_cleaver'})).status,200);
  assert.equal((await post(0,endpoint+'/reserve',{cardId:'cloud_oven_receipt'})).status,409,
    'round two separately limits the same player to one Cloud belonging');
  assert.equal((await call(0,endpoint)).data.investigation.cards.find(c=>c.id==='cloud_oven_receipt').personLimitReached,true);
  assert.equal(wallets[4].data.investigation.cards.some(c=>c.id==='trick_spare_override'),true,
    'stage two hidden key becomes visible');
  assert.equal((await post(4,endpoint+'/reserve',{cardId:'trick_spare_override'})).status,409,
    'site-only clue cannot be taken from 2nd floor');
  // Karl moves two tiles left on the training floor and uses the upward staircase.
  async function walk(i,moves){
    for(const direction of moves){
      const r=await post(i,endpoint+'/move',{direction});
      assert.equal(r.status,200,'walk '+direction+' '+JSON.stringify(r.data));
      await new Promise(ok=>setTimeout(ok,150));
    }
  }
  await walk(4,['left','left']);
  const staircase=await post(4,endpoint+'/interact',{kind:'portal',portalIndex:1});
  assert.equal(staircase.status,200,'operations floor is reached via explicit portal action');
  assert.equal(staircase.data.map.floorId,'operations');
  assert.equal((await post(4,endpoint+'/reserve',{cardId:'trick_spare_override'})).status,409,
    'first inspect the access log before the case containing its key');
  assert.equal((await post(4,endpoint+'/reserve',{cardId:'time_karl_badge'})).status,200);
  assert.equal((await post(4,endpoint+'/investigate',{cardId:'time_karl_badge'})).status,200);
  const keyReservation=await post(4,endpoint+'/reserve',{cardId:'trick_spare_override'});
  assert.equal(keyReservation.status,200);
  const foundKey=await post(4,endpoint+'/investigate',{cardId:'trick_spare_override'});
  assert.equal(foundKey.status,200);
  assert.ok(foundKey.data.investigation.collected.some(i=>i.id==='vault_override'));
  const roof=await post(4,endpoint+'/interact',{kind:'portal',portalIndex:1});
  assert.equal(roof.status,200);
  assert.equal(roof.data.map.floorId,'penthouse');
  assert.equal(JSON.stringify(roof.data.map).includes('가고일'),false,
    'map areas, objects, door labels and legends must conceal secret gallery');
  assert.ok(roof.data.map.rooms.some(r=>r.name==='출입 제한 구역'));
  assert.ok(!roof.data.investigation.cards.some(c=>c.id==='cult_founder_mask'),
    'locked room clues must not leak through card fronts');
  assert.equal((await post(4,endpoint+'/reserve',{cardId:'cult_founder_signature'})).status,409,
    'victim archives remain site-specific even in round two');
  await walk(4,['right','right','right','right','right']);
  assert.equal((await post(4,endpoint+'/interact',{kind:'door',doorId:'ne_door',mode:'open'})).status,403,
    'the gallery lock rejects players without the throne key');
  const unlocked=await post(4,endpoint+'/interact',{kind:'door',doorId:'se_door',mode:'open'});
  assert.equal(unlocked.status,200,'round-two clue grants the real key to the sealed archive');
  assert.equal(unlocked.data.map.doors.find(d=>d.id==='se_door').open,true);
  await walk(4,['down','down','right','down']);
  assert.equal((await post(4,endpoint+'/reserve',{cardId:'cult_founder_signature'})).status,409,
    'new sequential room clues cannot be skipped after opening the vault');
  const founderCard=(await call(4,endpoint)).data.investigation.cards.find(c=>c.id==='cult_founder_signature');
  assert.equal(founderCard.sequenceLocked,true);
  assert.ok(founderCard.sequenceAfter,'player receives neutral previous-front hint');
  assert.equal((await call(7,endpoint)).data.investigation,null,'observer receives no investigation backs');
});

test('Studio simulator reveals sealed gallery only after throne evidence grants its key',()=>{
  const engine=require('../apps/murder-mystery/test-engine.js');
  const state=engine.create(raw);
  engine.switchRole(state,'karl');
  engine.switchPhase(state,'investigation1');
  state.positions.karl={floor:'penthouse',x:15,y:6};
  let view=engine.roomView(state);
  assert.equal(JSON.stringify(view.map).includes('가고일'),false);
  assert.equal(view.map.doors.find(d=>d.id==='ne_door').name,'4층 출입 제한 구역 문');
  assert.equal(view.investigation.cards.some(c=>c.id==='cult_gargoyle_poster'),false);
  assert.throws(()=>engine.reserve(state,'cult_hero_landing_syllabus'),/잠겨/);
  assert.throws(()=>engine.interact(state,'door','ne_door','open'),/열쇠|필수/);
  state.positions.karl={floor:'penthouse',x:4,y:3};
  engine.reserve(state,'trick_throne_scene');
  engine.investigate(state,'trick_throne_scene');
  assert.ok(state.collected.karl.some(i=>i.id==='gallery_key'));
  state.positions.karl={floor:'penthouse',x:15,y:6};
  engine.interact(state,'door','ne_door','open');
  view=engine.roomView(state);
  assert.equal(view.map.doors.find(d=>d.id==='ne_door').name,'가고일 전시실·옥상 출입문');
  assert.ok(view.map.rooms.some(r=>r.name==='가고일 전시실·옥상'));
  assert.ok(view.map.objects.some(o=>o.name==='갈리온 전시 석상'));
  assert.ok(view.investigation.cards.some(c=>c.id==='cult_gargoyle_poster'));
  assert.throws(()=>engine.reserve(state,'cult_hero_landing_syllabus'),/이전 조사 카드/,
    'later cards require the earlier gallery evidence before they are accessible');
  assert.throws(()=>engine.reserve(state,'cult_gargoyle_poster'),/조사 장소 타일/,
    'the first gallery evidence still requires entering the opened room');
  engine.switchPhase(state,'investigation2');
  engine.move(state,'up');engine.move(state,'up');engine.move(state,'up');
  for(const [id,x,y] of [['cult_gargoyle_poster',15,3],['time_chajiwoo_photo',16,3],['cult_founder_mask',15,3]]){
    state.positions.karl={floor:'penthouse',x,y};
    engine.reserve(state,id);engine.investigate(state,id);
  }
  assert.equal(engine.reserve(state,'cult_hero_landing_syllabus'),true,
    'gallery evidence unlocks in story order after site research');
});
