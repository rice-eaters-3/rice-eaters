'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const front=require('../apps/murder-mystery/clue-front.js');
const E=require('../apps/murder-mystery/test-engine.js');
const d1=require('../mystery-content/d1-gaming.case.json');

test('unrevealed cards have stable, sequential owner and location labels',()=>{
  const cards=d1.game.investigation.cards,labels=front.labels(cards,d1.story.characters,d1.game.floors);
  assert.equal(labels.jobi_threat_phone,'조비의 소지품 4');
  assert.equal(labels.jobi_stage_mouse,'조비의 소지품 1');
  assert.equal(labels.jobi_qualifier_card,'조비의 소지품 2');
  assert.equal(labels.jobi_stopwatch,'조비의 소지품 3');
  const throne=cards.filter(c=>c.location?.floor==='penthouse'&&
    c.location.x>=1&&c.location.x<10&&c.location.y>=1&&c.location.y<6);
  assert.ok(throne.length>=2);
  for(const c of throne)assert.match(labels[c.id],/^배익호의 왕좌실 \d+$/);
  assert.equal(new Set(Object.values(labels)).size,cards.length,'visible card titles must be unique');
});
test('location-less evidence uses a neutral label or a studio-assigned place',()=>{
  const cards=[
    {id:'one',type:'information'},
    {id:'two',type:'place'},
    {id:'three',type:'information',frontPlace:'서재'},
    {id:'four',type:'information',frontPlace:'서재'}
  ];
  const names=front.labels(cards,[],[]);
  assert.equal(names.one,'사건 자료 1');
  assert.equal(names.two,'사건 자료 2');
  assert.equal(names.three,'서재 1');
  assert.equal(names.four,'서재 2');
});
test('Studio player views do not expose evidence title or subtitle until discovery',()=>{
  const state=E.create(d1);
  E.switchRole(state,'mayushi');
  E.switchPhase(state,'investigation1');
  const hidden=E.roomView(state).investigation.cards.find(c=>c.id==='jobi_threat_phone');
  assert.equal(hidden.frontTitle,'조비의 소지품 4');
  assert.equal(hidden.title,null);
  assert.equal(hidden.subtitle,null);
  assert.equal(hidden.revealed.length,0);
  for(const prerequisite of ['jobi_stage_mouse','jobi_qualifier_card','jobi_stopwatch']){
    E.reserve(state,prerequisite);E.investigate(state,prerequisite);
  }
  E.reserve(state,'jobi_threat_phone');
  E.investigate(state,'jobi_threat_phone');
  const seen=E.roomView(state).investigation.cards.find(c=>c.id==='jobi_threat_phone');
  assert.equal(seen.title,'조비의 메시지가 남은 휴대전화');
  assert.ok(seen.revealed[0].back.includes('21:47'));
});

test('built-in clues have specific scene locations rather than generic case-file names',()=>{
 const stories=[d1,require('../mystery-content/cruel-heart-island.case.json'),
  require('../mystery-content/neon-memory-quarantine.case.json'),
  require('../mystery-content/stellar-academy-first-case.case.json')];
 for(const pkg of stories){
  const fronts=front.labels(pkg.game.investigation.cards,pkg.story.characters,pkg.game.floors);
  for(const card of pkg.game.investigation.cards){
   assert.ok(!fronts[card.id].startsWith('사건 자료 '),pkg.story.id+'/'+card.id);
   if(card.type==='belonging')continue;
   assert.ok(card.location,pkg.story.id+'/'+card.id+' needs a location');
   const floor=pkg.game.floors.find(f=>f.id===card.location.floor);
   assert.equal(floor?.tiles[card.location.y]?.[card.location.x],'.',card.id);
  }
  assert.equal(new Set(Object.values(fronts)).size,pkg.game.investigation.cards.length,pkg.story.id);
 }
 const d1Names=front.labels(d1.game.investigation.cards,d1.story.characters,d1.game.floors);
 for(let i=1;i<=4;i++)assert.ok(d1Names['trick_baetho_note_'+i].startsWith('배익호의 왕좌실 '));
});
test('tactical board never directly explains the culprit method',()=>{
 const c=d1.game.investigation.cards.find(c=>c.id==='mac_tactical_board');
 const item=d1.game.booklets.mac.inventory.find(c=>c.id==='mac_tactical_board');
 for(const value of [c.back,item.description]){
  assert.ok(!value.includes('배익호를 직접 공격하지 않고 살해할 구상을 암시한다'));
 }
});

test('all four test-mode catalogs preserve numbered fronts when backs become public',()=>{
 const packages=[d1,require('../mystery-content/cruel-heart-island.case.json'),
  require('../mystery-content/neon-memory-quarantine.case.json'),
  require('../mystery-content/stellar-academy-first-case.case.json')];
 for(const pkg of packages){
  const state=E.create(pkg);E.switchPhase(state,'investigation2');
  const hidden=E.roomView(state).investigation.cards;
  const labels=front.labels(pkg.game.investigation.cards,pkg.story.characters,pkg.game.floors);
  for(const c of hidden){
   assert.equal(c.title,null);assert.equal(c.subtitle,null);assert.deepEqual(c.revealed,[]);
   assert.equal(c.frontTitle,labels[c.id]);
  }
  for(const c of pkg.game.investigation.cards)state.publicCards[c.id]={at:1};
  // Even globally published backs cannot expose the unrevealed room's catalog.
  for(const f of pkg.game.floors||[])for(const a of f.areas||[])if(a.revealDoor){
    assert.equal(E.roomView(state).investigation.cards.some(c=>
      pkg.game.investigation.cards.find(x=>x.id===c.id)?.location?.floor===f.id&&
      a.x<=c.location?.x&&c.location?.x<a.x+a.width&&
      a.y<=c.location?.y&&c.location?.y<a.y+a.height),false);
    state.doorStates[f.id+':'+a.revealDoor]={unlocked:true,open:true};
  }
  const revealed=E.roomView(state).investigation.cards;
  assert.equal(revealed.length,pkg.game.investigation.cards.length);
  for(const c of revealed){
   const original=pkg.game.investigation.cards.find(x=>x.id===c.id);
   assert.equal(c.frontTitle,labels[c.id]);assert.equal(c.title,original.title);
   assert.equal(c.revealed[0].back,original.back);
  }
 }
});


test('all authored scenarios rank every clue in a solvable, acyclic place or owner chain',()=>{
  const {validate}=require('../mystery-content/validate.js');
  for(const pkg of [
    d1,require('../mystery-content/cruel-heart-island.case.json'),
    require('../mystery-content/neon-memory-quarantine.case.json'),
    require('../mystery-content/stellar-academy-first-case.case.json')
  ]){
    const original=pkg.game.investigation.cards,normalized=validate(pkg).game.investigation.cards;
    const byId=new Map(original.map(c=>[c.id,c]));
    const seq=front.sequenceAfter(original,pkg.game.floors);
    const named=front.labels(original,pkg.story.characters,pkg.game.floors);
    const buckets=new Map();
    for(const card of original){
      assert.ok(Number.isInteger(card.sequenceOrder)&&card.sequenceOrder>=1,pkg.story.id+'/'+card.id);
      assert.equal(normalized.find(c=>c.id===card.id)?.sequenceOrder,card.sequenceOrder,
        'Studio import must retain authored order');
      const group=front.groupKey(card,pkg.game.floors);
      if(!buckets.has(group))buckets.set(group,[]);
      buckets.get(group).push(card);
      assert.ok(named[card.id].endsWith(' '+card.sequenceOrder),
        'front label must reflect the same rank as the server');
    }
    for(const group of buckets.values()){
      const sorted=group.slice().sort((a,b)=>a.sequenceOrder-b.sequenceOrder);
      assert.deepEqual(sorted.map(c=>c.sequenceOrder),sorted.map((_,i)=>i+1));
      for(let i=1;i<sorted.length;i++)assert.equal(seq[sorted[i].id],sorted[i-1].id);
    }
    // Ordering and explicit author prerequisites must never create a deadlock.
    const done=new Set(),stack=new Set();
    function visit(id){
      if(stack.has(id))assert.fail(pkg.story.id+' circular clue dependency at '+id);
      if(done.has(id))return;
      stack.add(id);
      for(const before of [...(byId.get(id).requires||[]),...(seq[id]?[seq[id]]:[])])visit(before);
      stack.delete(id);done.add(id);
    }
    for(const card of original)visit(card.id);
    for(const [role,book] of Object.entries(pkg.game.booklets)){
      const personal=book.inventory.map(x=>byId.get(x.id)).filter(Boolean);
      assert.deepEqual(personal.map(c=>c.sequenceOrder),personal.map((_,i)=>i+1),
        pkg.story.id+'/'+role+' booklet order must match numbered card fronts');
    }
  }
});

test('sequential owner evidence cannot be skipped, and previous discovery unlocks later cards',()=>{
  const s=E.create(d1);E.switchPhase(s,'investigation1');E.switchRole(s,'mayushi');
  assert.throws(()=>E.reserve(s,'jobi_qualifier_card'),/이전 조사 카드/);
  assert.equal(E.roomView(s).investigation.cards.find(c=>c.id==='jobi_qualifier_card').sequenceLocked,true);
  E.reserve(s,'jobi_stage_mouse');E.investigate(s,'jobi_stage_mouse');
  assert.equal(E.roomView(s).investigation.cards.find(c=>c.id==='jobi_qualifier_card').sequenceLocked,false);
  E.reserve(s,'jobi_qualifier_card');E.investigate(s,'jobi_qualifier_card');
  E.switchRole(s,'cloud');
  assert.equal(E.roomView(s).investigation.cards.find(c=>c.id==='jobi_stopwatch').sequenceLocked,false,
    'a previous card investigated by another role globally unlocks the following card');
  assert.equal(E.roomView(s).investigation.cards.find(c=>c.id==='jobi_qualifier_card').title,null,
    'previous research does not automatically leak the private reverse to all players');
});


test('one belonging per target per investigation round, independently for every player',()=>{
  const state=E.create(d1);
  E.switchRole(state,'jobi');
  E.switchPhase(state,'investigation1');
  E.reserve(state,'cloud_huoguo_ladle');
  E.investigate(state,'cloud_huoguo_ladle');
  assert.deepEqual(state.discovered.cloud_huoguo_ladle.map(x=>x.phase),['investigation1']);
  assert.throws(()=>E.reserve(state,'cloud_elephant_eggplant'),/소지품은 1장만/);
  let view=E.roomView(state);
  assert.equal(view.investigation.cards.find(c=>c.id==='cloud_elephant_eggplant').personLimitReached,true);
  assert.equal(view.investigation.cards.find(c=>c.id==='hasu_solo_kill_log').personLimitReached,false);
  E.reserve(state,'hasu_solo_kill_log');E.investigate(state,'hasu_solo_kill_log');
  E.switchRole(state,'mayushi');
  assert.equal(E.roomView(state).investigation.cards.find(c=>c.id==='cloud_elephant_eggplant').personLimitReached,false);
  E.reserve(state,'cloud_elephant_eggplant');E.investigate(state,'cloud_elephant_eggplant');
  E.switchRole(state,'jobi');
  E.switchPhase(state,'discussion1');
  E.switchPhase(state,'investigation2');
  view=E.roomView(state);
  assert.equal(view.investigation.cards.find(c=>c.id==='cloud_tainted_cleaver').personLimitReached,false);
  E.reserve(state,'cloud_tainted_cleaver');E.investigate(state,'cloud_tainted_cleaver');
  assert.deepEqual(state.discovered.cloud_tainted_cleaver.map(x=>x.phase),['investigation2']);
  assert.throws(()=>E.reserve(state,'cloud_oven_receipt'),/소지품은 1장만/);
  assert.equal(E.roomView(state).investigation.cards.find(c=>c.id==='cloud_oven_receipt').personLimitReached,true);
  E.switchRole(state,'mayushi');
  assert.equal(E.roomView(state).investigation.cards.find(c=>c.id==='cloud_oven_receipt').personLimitReached,false);
  E.reserve(state,'cloud_oven_receipt');
});
test('legacy discovery history with no phase is counted for first investigation only',()=>{
  const c={id:'other_item',type:'belonging',owner:'cloud'};
  const found={other_item:[{playerId:'playerA',at:1}]};
  assert.equal(front.personalInvestigationUsed([c],found,'playerA','investigation1','cloud'),true);
  assert.equal(front.personalInvestigationUsed([c],found,'playerA','investigation2','cloud'),false);
  assert.equal(front.personalInvestigationUsed([c],found,'playerB','investigation1','cloud'),false);
  assert.equal(front.personalInvestigationUsed([c],found,'playerA','investigation1','karl'),false);
  assert.equal(front.personalInvestigationUsed([c],{other_item:[{playerId:'playerA',phase:'investigation2'}]},
    'playerA','investigation2','cloud'),true);
});
