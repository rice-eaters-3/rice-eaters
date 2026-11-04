'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {validate}=require('../mystery-content/validate.js');
const actions=require('../mystery-content/action-engine.js');
const cases=[
 require('../mystery-content/cruel-heart-island.case.json'),
 require('../mystery-content/neon-memory-quarantine.case.json'),
 require('../mystery-content/stellar-academy-first-case.case.json')
];
const caseStats=[
 {id:'cruel-heart-island',players:8,items:32,extras:24,culprit:'harin',round2:12},
 {id:'neon-memory-quarantine',players:7,items:28,extras:26,culprit:'ion',round2:14},
 {id:'stellar-academy-first-case',players:6,items:24,extras:24,culprit:'gabin',round2:12}
];

test('three independent original murder scenarios are complete, 6-8 players and schema-valid',()=>{
 for(let i=0;i<cases.length;i++){
  const pkg=cases[i],stat=caseStats[i],normal=validate(pkg);
  assert.equal(pkg.story.id,stat.id);
  assert.equal(pkg.story.players,stat.players);
  assert.equal(normal.story.players,stat.players);
  assert.equal(pkg.story.characters.length,stat.players);
  assert.ok(pkg.story.synopsis.length>=4,'fully authored common synopsis');
  assert.equal(pkg.game.floors.length,3,'each story contains three accessible environments');
  assert.equal(pkg.game.action.order.length,stat.players,'private unique action order');
  assert.equal(new Set(pkg.game.action.order).size,stat.players);
  assert.ok(pkg.creatorGuide.culprit,'spoiler only in private manuscript');
  assert.ok(pkg.creatorGuide.solution||pkg.creatorGuide.fullExplanation,'author solution is present');
  assert.ok(pkg.creatorGuide.endings,'multiple endings exist');
  const cast=pkg.story.characters;
  assert.equal(cast.filter(c=>pkg.game.booklets[c.id].culprit).length,1);
  assert.equal(pkg.game.booklets[stat.culprit].culprit,true);
  for(const c of cast){
   const b=pkg.game.booklets[c.id];
   assert.ok(b.background.length>=3,c.name+' has conflicting private motives');
   assert.ok(b.timeline.length>=6,c.name+' has at least six grounded eyewitness events');
   assert.equal(b.inventory.length,4,c.name+' must have four items');
   assert.ok(b.objectives.length>=50,c.name+' needs competing manual score goals');
   assert.ok(b.actionNotes.length>20,c.name+' has private action instructions');
   assert.ok(pkg.game.action.roles[c.id].length>=1,c.name+' has a special ability');
  }
  const cards=pkg.game.investigation.cards;
  const personal=cards.filter(c=>c.owner),extra=cards.filter(c=>!c.owner);
  assert.equal(personal.length,stat.items);
  assert.equal(extra.length,stat.extras);
  assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
  assert.equal(cards.filter(c=>c.availableFromPhase==='investigation2').length,stat.round2);
  assert.equal(pkg.game.investigation.tokensPerPlayer,4);
  assert.equal(pkg.game.investigation.tokensPerSecondInvestigation,4);
  assert.equal(normal.game.action.order.length,stat.players,'import validator preserves stage order');
  assert.equal(normal.game.action.roles[stat.culprit].some(a=>a.kind==='attack'),true,
    'culprit has optional fictional second-murder action');
  assert.ok(cards.some(c=>c.grant),'a clue can grant an action/door item');
  assert.ok(cards.some(c=>c.requiresPresence),'map tile clues require travel');
  assert.ok(pkg.game.floors.some(f=>f.doors.some(d=>d.locked)),'second round uses a locked area');
  const ids=new Set(cards.map(c=>c.id));
  for(const c of cards)for(const dep of c.requires||[])assert.ok(ids.has(dep),c.id+' dependency must exist');
 }
 const show=cases[0];
 assert.equal(show.story.players,8);
 assert.equal(show.story.characters.filter(c=>c.hint.startsWith('남')).length,4);
 assert.equal(show.story.characters.filter(c=>c.hint.startsWith('여')).length,4);
 assert.equal(cases[2].creatorGuide.escapeSolution?.length>100,true,
   'academy contains a distinct detailed escape solution');
});

test('secret action turns, defense against fictional attack, restraint skips, and item gating',()=>{
 const pkg=cases[2],game=validate(pkg).game;
 const room={players:pkg.story.characters.map((c,i)=>({id:'p'+i,name:c.name,characterId:c.id})),
   investigation:{collected:{},holdings:[]},mapPositions:{},phase:'action'};
 actions.init(room,game);
 const find=id=>room.players.find(p=>p.characterId===id);
 const first=find('yeonju'),second=find('seoha'),rescuer=find('jinwoo'),
    restrainer=find('taewon'),decoder=find('rion'),killer=find('gabin');
 assert.equal(actions.view(room,second,game).abilities.length,0,'other character private abilities hidden');
 assert.throws(()=>actions.submit(room,killer,game,{abilityId:'shadow',targetId:first.id}),{status:403});
 assert.equal(actions.submit(room,first,game,{abilityId:'stars'}).myTurn,false);
 assert.equal(actions.view(room,second,game).myTurn,true);
 assert.throws(()=>actions.submit(room,second,game,{abilityId:'escape'}),{status:403},
   'escape without discovered pass forbidden');
 actions.submit(room,second,game,{abilityId:'shield',targetId:rescuer.id});
 actions.submit(room,rescuer,game,{abilityId:'pass'});
 actions.submit(room,restrainer,game,{abilityId:'pass'});
 actions.submit(room,decoder,game,{abilityId:'pass'});
 const blocked=actions.submit(room,killer,game,{abilityId:'shadow',targetId:rescuer.id});
 assert.equal(blocked.done,true);
 assert.deepEqual(room.actions.dead,[],'guard negates later additional murder');
 assert.ok(blocked.log.some(e=>e.kind==='blocked'));
 assert.throws(()=>actions.submit(room,killer,game,{abilityId:'pass'}),{status:409},
   'actor cannot execute a second action');
 // In a new game, earlier restraint must prevent a later target from acting.
 const another={...room,actions:null};actions.init(another,game);
 const all=[first,second,rescuer,restrainer,decoder];
 for(const person of all){
  if(person===restrainer)actions.submit(another,person,game,{abilityId:'trap',targetId:killer.id});
  else actions.submit(another,person,game,{abilityId:'pass'});
 }
 assert.equal(another.actions.done,true);
 assert.ok(another.actions.log.some(x=>x.kind==='skip'&&x.actor===killer.name),
   'restrained late actor automatically skips');
 // A clue with grant can unlock special escape ability.
 const escapeCase={...room,actions:null,investigation:{collected:{[rescuer.id]:[
  {id:'academy_escape_pass',name:'공동 탈출 인증서'}]},holdings:[]}};
 actions.init(escapeCase,game);
 for(const id of escapeCase.actions.order){
  const p=escapeCase.players.find(x=>x.id===id);
  if(p.id===rescuer.id){
   assert.equal(actions.available(escapeCase,p,game).find(a=>a.id==='escape').usable,true);
   actions.submit(escapeCase,p,game,{abilityId:'escape'});
   assert.ok(escapeCase.actions.escaped.includes(p.id));
   break;
  }
  actions.submit(escapeCase,p,game,{abilityId:'pass'});
 }
});

test('host advances full six-player academy after all action turns; no role secrets in public APIs',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'academy-stage-'));
 process.env.DATA_DIR=dir;
 const {handler}=require('../server.js');
 const srv=http.createServer(handler);
 await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
 t.after(async()=>{srv.closeAllConnections();await new Promise(ok=>srv.close(ok));
   fs.rmSync(dir,{force:true,recursive:true})});
 const base='http://127.0.0.1:'+srv.address().port;
 const people=Array.from({length:7},()=>({cookie:''}));
 async function call(i,url,method='GET',body){
  const headers={};if(people[i].cookie)headers.Cookie=people[i].cookie;
  if(body!==undefined)headers['Content-Type']='application/json';
  const r=await fetch(base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  if(r.headers.get('set-cookie'))people[i].cookie=r.headers.get('set-cookie').split(';')[0];
  return {status:r.status,data:await r.json()};
 }
 const post=(i,u,v={})=>call(i,u,'POST',v);
 const catalog=(await call(6,'/api/stories')).data.stories;
 for(const s of caseStats)assert.ok(catalog.some(x=>x.id===s.id&&x.players===s.players));
 assert.ok(!JSON.stringify(catalog).includes('유가빈은'),'public catalog hides murderer details');
 assert.equal((await call(6,'/mystery-content/stellar-academy-first-case.case.json')).status,403,
   'spoiler-packed case file must not be available as a static URL');
 const room=await post(0,'/api/rooms',{storyId:'stellar-academy-first-case',name:'Host'});
 assert.equal(room.status,201);
 const ep='/api/rooms/'+room.data.code;
 for(let i=1;i<6;i++)assert.equal((await post(i,ep+'/join',{name:'Friend'+i})).status,200);
 for(let i=0;i<6;i++)await call(i,ep);
 assert.equal((await post(0,ep+'/start')).status,200);
 for(let i=0;i<6;i++)await post(i,ep+'/read');
 await post(0,ep+'/advance');
 for(let i=0;i<6;i++)await post(i,ep+'/character',{characterId:cases[2].story.characters[i].id});
 await post(0,ep+'/advance');
 const booklet=(await call(0,ep)).data.booklet;
 assert.equal(booklet.actionOrder,2,'player private booklet includes assigned position');
 assert.equal(booklet.actionAbilities.length,2);
 assert.equal((await call(6,ep)).data.booklet,null,'visitor cannot access role private action plan');
 for(let i=0;i<6;i++)await post(i,ep+'/study-ready');
 await post(0,ep+'/advance');
 for(const phase of ['discussion1','investigation2','discussion2','action']){
  for(let i=0;i<6;i++)assert.equal((await post(i,ep+'/advance-vote')).status,200);
  const result=await post(0,ep+'/advance');
  assert.equal(result.data.phase,phase);
 }
 assert.equal((await post(0,ep+'/advance')).status,409,'host cannot skip unfinished action stage');
 const start=(await call(1,ep)).data;
 assert.equal(start.action.myTurn,false);
 assert.equal(start.action.abilities.length,0,'not current turn has no active choices');
 assert.equal((await post(1,ep+'/act',{abilityId:'shield'})).status,403,
   'out-of-turn secret action rejected');
 const participantIds=(await call(0,ep)).data.players.map(p=>p.id);
 for(let turn=0;turn<6;turn++){
   const state=(await call(0,ep)).data.action;
   const idx=participantIds.indexOf(state.currentActor?.id);
   assert.ok(idx>=0,'turn owner is one of six members');
   assert.equal((await post(idx,ep+'/act',{abilityId:'pass'})).status,200);
 }
 const done=(await call(0,ep)).data.action;
 assert.equal(done.done,true);
 assert.equal(done.log.length,6);
 assert.equal((await post(1,ep+'/advance')).status,403);
 for(let i=0;i<6;i++)await post(i,ep+'/advance-vote');
 assert.equal((await post(0,ep+'/advance')).data.phase,'ending');
 const murderer=cases[2].story.characters.find(c=>cases[2].game.booklets[c.id].culprit).id;
 const firstRole=cases[2].story.characters[0].id;
 // Only the host can set the final prisoner or decide personal goal outcomes.
 assert.equal((await post(1,ep+'/verdict-arrest',{characterId:murderer})).status,403);
 assert.equal((await post(1,ep+'/verdict-goal',{characterId:firstRole,achieved:true})).status,403);
 let wrong=await post(0,ep+'/verdict-arrest',{characterId:firstRole});
 assert.equal(wrong.status,200);
 assert.equal(wrong.data.ending.common.captured,false);
 assert.equal(wrong.data.ending.personal.status,'arrested');
 let correct=await post(0,ep+'/verdict-arrest',{characterId:murderer});
 assert.equal(correct.status,200);
 assert.equal(correct.data.ending.common.captured,true);
 assert.equal(correct.data.ending.common.arrestedCharacterId,murderer);
 const achieved=await post(0,ep+'/verdict-goal',{characterId:firstRole,achieved:true});
 assert.equal(achieved.status,200);
 assert.equal(achieved.data.ending.personal.goalMet,true);
 const innocentView=(await call(1,ep)).data;
 assert.equal(innocentView.ending.common.captured,true);
 assert.equal(innocentView.ending.editor,undefined);
 assert.equal(innocentView.ending.personal.goalText,cases[2].game.booklets[cases[2].story.characters[1].id].objectives);
 assert.notEqual(innocentView.ending.personal.characterId,achieved.data.ending.personal.characterId);
 const secondRole=cases[2].story.characters[1].id;
 assert.equal((await post(1,ep+'/verdict-status',{characterId:secondRole,status:'dead'})).status,403);
 assert.equal((await post(0,ep+'/verdict-goal',{characterId:secondRole,achieved:false})).status,200);
 for(const [override,expected] of [['restrained','restrained'],['escaped','escaped'],['dead','dead'],['auto','alive']]){
  assert.equal((await post(0,ep+'/verdict-status',{characterId:secondRole,status:override})).status,200);
  const {ending}= (await call(1,ep)).data;
  assert.equal(ending.common.captured,true);
  assert.equal(ending.personal.status,expected);
  assert.equal(ending.personal.goalMet,false);
  assert.ok(ending.personal.paragraphs.includes(cases[2].game.ending.characters[secondRole][expected]));
 }
 assert.equal((await post(0,ep+'/verdict-status',{characterId:murderer,status:'dead'})).status,200);
 const missed=(await call(1,ep)).data.ending.common;
 assert.equal(missed.verdictType,'unresolved');
 assert.equal(missed.arrestedName,null);
 assert.equal((await post(0,ep+'/verdict-arrest',{characterId:murderer})).status,409);
 const victim=(await call(6,ep)).data;
 assert.equal(victim.ending,null,'a visitor must never receive private endings');
 assert.equal((await post(0,ep+'/verdict-arrest',{characterId:'not_a_character'})).status,400);
});
