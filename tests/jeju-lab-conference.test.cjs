'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const original=require('../mystery-content/jeju-lab-conference.case.json');
const {validate}=require('../mystery-content/validate.js');
const engine=require('../apps/murder-mystery/test-engine.js');
const front=require('../apps/murder-mystery/clue-front.js');
const ending=require('../apps/murder-mystery/ending-engine.js');

test('Jeju scenario registers exactly 2 PhD, 3 MS, 1 undergraduate and 1 administrator',()=>{
  const pkg=validate(original),roles=pkg.story.characters;
  assert.equal(original.story.id,'jeju-lab-conference');
  assert.equal(pkg.story.id,'','Studio sanitizer intentionally assigns fresh IDs on import');
  assert.equal(pkg.story.players,7);
  assert.equal(roles.length,7);
  assert.equal(roles.filter(c=>c.role.includes('박사과정')).length,2);
  assert.equal(roles.filter(c=>c.role.includes('석사과정')).length,3);
  assert.equal(roles.filter(c=>c.role.includes('학부연구생')).length,1);
  assert.equal(roles.filter(c=>c.role.includes('행정직원')).length,1);
  assert.ok(roles.find(c=>c.id==='jiwoo')?.hint.includes('해외'));
  assert.ok(roles.find(c=>c.id==='sion')?.hint.includes('취업'));
  assert.equal(pkg.story.victim?.name,'정윤석');
  assert.equal(roles.some(c=>c.id==='prof_jeong'),false);
  assert.equal(pkg.story.artTheme,'jeju-lab-conference');
  assert.deepEqual(pkg.game.floors.map(f=>f.id),['ground','upper','annex']);
  assert.equal(Object.values(pkg.game.booklets).filter(b=>b.culprit).length,1);
  for(const r of roles){
    const b=pkg.game.booklets[r.id];
    assert.equal(b.inventory.length,4,r.id);
    assert.ok(b.background.length>=4,r.id+' needs substantial private history');
    assert.ok(b.timeline.length>=8,r.id+' needs event timeline');
    assert.ok(b.objectives.length>=20);
    assert.ok(pkg.game.ending.characters[r.id]?.intro);
    assert.ok(pkg.game.ending.characters[r.id]?.captured);
    assert.ok(pkg.game.ending.characters[r.id]?.missed);
  }
  assert.ok(pkg.game.ending.common.captured.paragraphs.length>=4);
  assert.ok(pkg.game.ending.common.missed.paragraphs.length>=4);
  assert.equal(pkg.game.action.order.length,7);
  assert.ok(pkg.game.action.order.every(c=>pkg.game.action.roles[c].length===1));
  assert.equal(pkg.game.investigation.tokensPerPlayer,4);
  assert.equal(pkg.game.investigation.tokensPerSecondInvestigation,4);
});

test('64 cards: 28 belongings, 36 location records, ordered from mild to late clues with valid evidence chain',()=>{
  const pkg=validate(original),cards=pkg.game.investigation.cards;
  assert.equal(cards.length,64);
  assert.equal(cards.filter(c=>c.type==='belonging').length,28);
  assert.equal(cards.filter(c=>c.type!=='belonging').length,36);
  assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
  const byId=new Map(cards.map(c=>[c.id,c]));
  const names=front.labels(cards,pkg.story.characters,pkg.game.floors);
  const after=front.sequenceAfter(cards,pkg.game.floors);
  const groups=new Map();
  for(const c of cards){
    const key=front.groupKey(c,pkg.game.floors);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(c);
    assert.ok(c.back.length>20,c.id);
    assert.equal(c.subtitle,'',c.id+' must not accidentally hint at culprit on front');
    assert.equal(names[c.id].endsWith(' '+c.sequenceOrder),true,c.id+' front rank');
    if(c.type==='belonging')assert.equal(c.location,null);
    else{
      assert.equal(c.requiresPresence,true,c.id);
      const f=pkg.game.floors.find(f=>f.id===c.location.floor);
      assert.equal(f.tiles[c.location.y][c.location.x],'.');
    }
  }
  for(const cs of groups.values()){
    const ranks=cs.map(c=>c.sequenceOrder).sort((a,b)=>a-b);
    assert.deepEqual(ranks,ranks.map((_,i)=>i+1));
  }
  const seen=new Set(),active=new Set();
  function visit(id){
    assert.ok(byId.has(id),'missing '+id);
    if(active.has(id))assert.fail('circular prereqs at '+id);
    if(seen.has(id))return;
    active.add(id);
    const c=byId.get(id);
    for(const before of [...c.requires,...(after[id]?[after[id]]:[])])visit(before);
    active.delete(id);seen.add(id);
  }
  for(const c of cards)visit(c.id);
  for(const ch of pkg.story.characters){
    const owned=cards.filter(c=>c.owner===ch.id).sort((a,b)=>a.sequenceOrder-b.sequenceOrder);
    const items=pkg.game.booklets[ch.id].inventory;
    assert.deepEqual(owned.map(c=>c.id),items.map(i=>i.id));
    for(const item of items)assert.equal(byId.get(item.id).back,item.description);
  }
  assert.equal(pkg.game.investigation.cards.find(c=>c.id==='lobby_safety_envelope').grant.id,'prof_suite_key');
  assert.ok(pkg.game.investigation.cards.find(c=>c.id==='prof_corrected_draft').requires.includes('annex_eval_manifest'));
  assert.ok(pkg.game.investigation.cards.some(c=>c.availableFromPhase==='investigation2'));
});

test('studio simulation: locked professor suite, lobby key, two investigation stages, and authorized reveal',()=>{
  const state=engine.create(original);
  engine.switchRole(state,'seoha');
  engine.switchPhase(state,'investigation1');
  let view=engine.roomView(state);
  assert.equal(JSON.stringify(view).includes('제작자 전용 스포일러'),false);
  assert.equal(view.investigation.cards.some(c=>c.id==='prof_scene_sketch'),false);
  assert.throws(()=>engine.reserve(state,'prof_scene_sketch'),/잠겨/);
  assert.throws(()=>engine.reserve(state,'lobby_safety_envelope'),/이전 조사 카드/);
  engine.reserve(state,'lobby_checkin');engine.investigate(state,'lobby_checkin');
  engine.reserve(state,'lobby_safety_envelope');engine.investigate(state,'lobby_safety_envelope');
  assert.ok(state.collected.seoha.some(c=>c.id==='prof_suite_key'));
  state.positions.seoha={floor:'upper',x:4,y:5};
  assert.equal(engine.roomView(state).map.rooms.some(r=>r.name==='교수 객실'),false);
  engine.interact(state,'door','nw_door','open');
  view=engine.roomView(state);
  assert.ok(view.map.rooms.some(r=>r.name==='교수 객실'));
  assert.ok(view.investigation.cards.some(c=>c.id==='prof_scene_sketch'));
  state.positions.seoha={floor:'upper',x:3,y:2};
  engine.reserve(state,'prof_scene_sketch');engine.investigate(state,'prof_scene_sketch');
  engine.reserve(state,'prof_watch_reading');engine.investigate(state,'prof_watch_reading');
  assert.throws(()=>engine.reserve(state,'prof_protection_memo'),/해금/);
  engine.switchRole(state,'sion');state.positions.sion={floor:'annex',x:3,y:2};
  engine.reserve(state,'print_job_log');engine.investigate(state,'print_job_log');
  engine.reserve(state,'print_credit_plan');engine.investigate(state,'print_credit_plan');
  engine.switchPhase(state,'discussion1');
  engine.switchPhase(state,'investigation2');
  engine.switchRole(state,'seoha');
  assert.equal(engine.roomView(state).investigation.cards.find(c=>c.id==='prof_protection_memo').locked,false);
  engine.reserve(state,'prof_protection_memo');engine.investigate(state,'prof_protection_memo');
  assert.ok(engine.roomView(state).investigation.myCards.some(c=>c.cardId==='prof_protection_memo'));
  engine.switchRole(state,'jiwoo');
  const privateBack=engine.roomView(state).investigation.cards.find(c=>c.id==='prof_protection_memo');
  assert.equal(privateBack.revealed.length,0,'discovery must not automatically leak private reverse');
});

test('the player-specific one-belonging-per-person cap resets for second investigation',()=>{
  const s=engine.create(original);engine.switchPhase(s,'investigation1');engine.switchRole(s,'jiwoo');
  engine.reserve(s,'seoha_commit_print');engine.investigate(s,'seoha_commit_print');
  assert.throws(()=>engine.reserve(s,'seoha_defense_email'),/소지품은 1장만/);
  engine.switchRole(s,'minji');
  engine.reserve(s,'seoha_defense_email');engine.investigate(s,'seoha_defense_email');
  engine.switchRole(s,'jiwoo');engine.switchPhase(s,'discussion1');engine.switchPhase(s,'investigation2');
  assert.equal(engine.roomView(s).investigation.cards.find(c=>c.id==='seoha_phone_log').personLimitReached,false);
  engine.reserve(s,'seoha_phone_log');engine.investigate(s,'seoha_phone_log');
  assert.throws(()=>engine.reserve(s,'seoha_review_letter'),/소지품은 1장만/);
});

test('common and individual endings branch by real culprit and preserve all seven roles',()=>{
  const p=validate(original),statuses={dead:[],restrained:[],escaped:[]};
  const captured=ending.outcome(p.story,p.game,{arrestedCharacterId:'doyun',goals:{jiwoo:true}},statuses,'jiwoo');
  const missed=ending.outcome(p.story,p.game,{arrestedCharacterId:'seoha',goals:{jiwoo:false}},statuses,'jiwoo');
  assert.equal(captured.common.captured,true);
  assert.equal(missed.common.captured,false);
  assert.equal(captured.personal.goalMet,true);
  assert.equal(missed.personal.goalMet,false);
  for(const character of p.story.characters){
    const e=ending.outcome(p.story,p.game,{arrestedCharacterId:'doyun'},statuses,character.id);
    assert.equal(e.personal.characterId,character.id);
    assert.ok(e.personal.paragraphs.length>=5);
  }
});

test('Jeju artwork uses only in-browser placeholders; no real or generated image assets',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/illustrations.js'),'utf8');
  const context={window:{}};
  vm.runInNewContext(source,context);
  const art=context.window.MysteryArt;
  const theme=original.story.id;
  const c=original.story.characters[0];
  const screens=[art.cover(theme),art.portrait(c,theme),art.clue({id:'lobby_checkin',title:'로비 기록'},theme),art.victim(original.story)];
  for(const picture of screens){
    assert.match(picture,/data-placeholder="true"/);
    assert.doesNotMatch(picture,/<image\s+href=/,'no image file should be requested');
  }
  assert.match(art.cover(theme),/ART PLACEHOLDER/);
});


test('new Jeju case is available from real server catalog while its culprit and cards stay private',async t=>{
  const http=require('node:http'),os=require('node:os');
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'jeju-case-http-'));
  const previous=process.env.DATA_DIR;process.env.DATA_DIR=folder;
  process.env.STUDIO_ADMIN_PASSWORD=require('node:crypto').randomBytes(32).toString('hex');
  const auth='Basic '+Buffer.from('operator:'+process.env.STUDIO_ADMIN_PASSWORD).toString('base64');
  const {handler}=require('../server.js');
  const server=http.createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{
    server.closeAllConnections();
    await new Promise(done=>server.close(done));
    fs.rmSync(folder,{force:true,recursive:true});
    if(previous===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=previous;
  });
  const base='http://127.0.0.1:'+server.address().port;
  const catalog=await fetch(base+'/api/stories');
  assert.equal(catalog.status,200);
  const stories=(await catalog.json()).stories;
  const listing=stories.find(s=>s.id==='jeju-lab-conference');
  assert.ok(listing);
  assert.equal(listing.players,7);
  assert.ok(!JSON.stringify(stories).includes('creatorGuide'));
  assert.ok(!JSON.stringify(stories).includes('prof_corrected_draft'));
  const author=await fetch(base+'/api/editor/test-case/jeju-lab-conference',{headers:{Authorization:auth}});
  assert.equal(author.status,200);
  const pkg=await author.json();
  assert.equal(pkg.game.investigation.cards.length,64);
  assert.equal(pkg.game.floors.length,3);
  assert.equal(pkg.game.ending.common.captured.paragraphs.length,5);
  const created=await fetch(base+'/api/rooms',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({storyId:'jeju-lab-conference',name:'게임방장'})
  });
  assert.equal(created.status,201);
  const room=await created.json();
  assert.equal(room.story.players,7);
  assert.equal(room.story.id,'jeju-lab-conference');
  assert.equal(JSON.stringify(room).includes('creatorGuide'),false);
  assert.equal(JSON.stringify(room).includes('dy_research'),false);
});
