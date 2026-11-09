'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const E=require('../apps/murder-mystery/test-engine.js');
function makeCase(){
 const cast=[
  {id:'alpha',name:'알파',role:'탐험가',symbol:'♟',accent:'#aabbcc'},
  {id:'beta',name:'베타',role:'조사자',symbol:'♟',accent:'#ddccaa'},
  {id:'gamma',name:'감마',role:'경호원',symbol:'♟',accent:'#ccbbaa'}
 ];
 const booklets=Object.fromEntries(cast.map(c=>[c.id,{
  background:['비밀 '+c.id],timeline:[{time:'00:00',title:'과거',detail:'고유 기록 '+c.id}],
  inventory:[{id:'item_'+c.id,name:'개인 소지품',description:'고유 아이템'}],
  culprit:c.id==='gamma',objectives:'개별 목표 '+c.id
 }]));
 return {
  format:'rice-mystery-v1',
  story:{id:'smoke-case',title:'테스트 원고',genre:'추리',players:3,synopsis:['용의자 세 명의 이야기'],characters:cast},
  game:{booklets,investigation:{tokensPerPlayer:4,tokensPerSecondInvestigation:4,maxTileOccupants:3,
    cards:[
     {id:'alpha_note',title:'알파의 개인 노트',subtitle:'알파 관련',back:'알파의 독점 비밀',type:'belonging',owner:'alpha'},
     {id:'key_card',title:'문 열쇠',subtitle:'창고',back:'금속 열쇠가 있다',type:'place',
       grant:{id:'vault_key',name:'금고 열쇠',description:'잠금 해제'}},
     {id:'deep_record',title:'비밀 조사 결과',subtitle:'잠겨 있음',back:'심층의 비밀',visibility:'hidden',
       requires:['key_card'],type:'information'},
     {id:'late_card',title:'2차 조사 전용',subtitle:'기록',back:'2차 공개',type:'place',
       availableFromPhase:'investigation2'}
    ]},
   floors:[{id:'ground',title:'1층',tiles:['#####','#...#','#...#','#...#','#####'],
     areas:[],rooms:[],objects:[{id:'sink',kind:'sink',x:1,y:2,name:'싱크대',solid:true}],
     doors:[{id:'vault',x:2,y:1,name:'비밀 문',locked:true,closed:true,requiresItem:'vault_key'}],
     portals:[{x:3,y:2,label:'2층',toFloor:'upper',toX:1,toY:1}]},
   {id:'upper',title:'2층',tiles:['#####','#...#','#...#','#...#','#####'],
     areas:[],rooms:[],objects:[],doors:[],portals:[]}],
   action:{order:['alpha','gamma','beta'],roles:{
    alpha:[{id:'protect',title:'보호',kind:'guard',targetMode:'any'}],
    beta:[{id:'kill',title:'공격',kind:'attack',targetMode:'other'}],gamma:[]
   }}},
  spawn:{alpha:{floor:'ground',x:1,y:1},beta:{floor:'ground',x:1,y:1},gamma:{floor:'ground',x:3,y:3}}
 };
}
test('test lab supports all nine phases and changes private character POV without altering source JSON',()=>{
 const original=makeCase(),before=JSON.stringify(original),state=E.create(original);
 assert.equal(E.PHASES.length,9);
 assert.equal(E.roomView(state).booklet,null,'synopsis must not expose private book');
 E.switchPhase(state,'study');
 assert.equal(E.roomView(state).booklet.basic.name,'알파');
 assert.equal(E.roomView(state).booklet.timeline[0].detail,'고유 기록 alpha');
 E.switchRole(state,'beta');
 assert.equal(E.roomView(state).booklet.basic.name,'베타');
 assert.equal(E.roomView(state).booklet.timeline[0].detail,'고유 기록 beta');
 assert.equal(E.roomView(state).booklet.culprit,false);
 E.switchRole(state,'gamma');assert.equal(E.roomView(state).booklet.culprit,true);
 E.switchPhase(state,'ending');
 assert.equal(E.roomView(state).phase,'ending');
 E.switchPhase(state,'study');assert.equal(E.roomView(state).phase,'study');
 assert.equal(JSON.stringify(original),before,'test simulations must not mutate authored source');
 const reset=E.reset(state);assert.equal(reset.phase,'synopsis');
 assert.equal(reset.roleId,'alpha');
});
test('clue ownership, prerequisites, two rounds, reservations and secrecy work across perspectives',()=>{
 const s=E.create(makeCase());E.switchPhase(s,'investigation1');
 assert.equal(E.roomView(s).investigation.tokens,4);
 assert.ok(!E.roomView(s).investigation.cards.some(c=>c.id==='deep_record'),'hidden card invisible before unlock');
 assert.ok(E.roomView(s).investigation.cards.find(c=>c.id==='late_card').locked);
 assert.throws(()=>E.reserve(s,'alpha_note'),/이 배역/);
 E.switchRole(s,'beta');E.reserve(s,'alpha_note');
 assert.equal(E.roomView(s).investigation.cards.find(c=>c.id==='alpha_note').reservedBy,'test_beta');
 E.switchRole(s,'alpha');assert.throws(()=>E.reserve(s,'alpha_note'),/이 배역/);
 E.switchRole(s,'beta');E.investigate(s,'alpha_note');
 assert.equal(s.tokens.beta,3);
 assert.equal(E.roomView(s).investigation.cards.find(c=>c.id==='alpha_note').revealed[0].back,'알파의 독점 비밀');
 E.switchRole(s,'gamma');
 assert.equal(E.roomView(s).investigation.cards.find(c=>c.id==='alpha_note').revealed.length,0,
   'other role must never see investigated back unless shared');
 E.switchRole(s,'alpha');
 assert.equal(E.roomView(s).investigation.cards.find(c=>c.id==='alpha_note').revealed.length,0);
 E.switchRole(s,'beta');
 E.share(s,E.holdings(s,'beta')[0].id,'alpha');
 E.switchRole(s,'alpha');
 assert.equal(E.roomView(s).investigation.cards.find(c=>c.id==='alpha_note').revealed.length,1);
 E.switchRole(s,'beta');
 E.reserve(s,'key_card');E.investigate(s,'key_card');
 E.interact(s,'door','vault','open');
 E.move(s,'right');
 E.switchRole(s,'alpha');
 assert.equal(E.roomView(s).investigation.cards.find(c=>c.id==='alpha_note').revealed.length,0,
   'selective reveal expires when the owner leaves the tile');
});
test('case item unlock and one-shot investigation reservation work independently for each role',()=>{
 const s=E.create(makeCase());E.switchPhase(s,'investigation1');
 E.reserve(s,'key_card');E.investigate(s,'key_card');
 assert.ok(E.roomView(s).investigation.cards.some(c=>c.id==='deep_record'));
 assert.ok(E.roomView(s).investigation.collected.some(c=>c.id==='vault_key'));
 assert.throws(()=>E.reserve(s,'key_card'),/이미 조사/);
 E.switchRole(s,'beta');
 assert.equal(E.roomView(s).investigation.cards.find(c=>c.id==='key_card').revealed.length,0);
 assert.throws(()=>E.reserve(s,'key_card'),/이미 조사/);
 E.switchPhase(s,'investigation2');
 assert.equal(s.tokens.alpha,7);
 assert.equal(s.tokens.beta,8);
 E.switchPhase(s,'study');E.switchPhase(s,'investigation2');
 assert.equal(s.tokens.beta,8,'reentering the phase does not grant duplicate tokens');
});
test('tile collision, lock requirements, floor portals and persistent viewpoints',()=>{
 const s=E.create(makeCase());E.switchPhase(s,'study');
 assert.throws(()=>E.move(s,'down'),/가구/);
 assert.throws(()=>E.move(s,'right'),/닫힌 문/);
 assert.throws(()=>E.interact(s,'door','vault','open'),/열쇠/);
 E.switchPhase(s,'investigation1');E.reserve(s,'key_card');E.investigate(s,'key_card');
 E.interact(s,'door','vault','open');
 E.move(s,'right');assert.deepEqual(E.position(s),{floor:'ground',x:2,y:1});
 E.move(s,'right');E.move(s,'down');
 E.interact(s,'portal',0);
 assert.deepEqual(E.position(s),{floor:'upper',x:1,y:1});
 E.switchRole(s,'beta');
 assert.equal(E.position(s).floor,'ground','role positions are independent');
});
test('consensual card/token transfer, public irreversible share, and action sequence',()=>{
 const s=E.create(makeCase());E.switchPhase(s,'investigation1');
 E.switchRole(s,'beta');E.reserve(s,'alpha_note');E.investigate(s,'alpha_note');
 const holding=E.holdings(s,'beta')[0];
 E.makeOffer(s,'card',holding.id,'alpha');E.switchRole(s,'alpha');
 assert.equal(E.roomView(s).investigation.incomingOffers.length,1);
 E.replyOffer(s,s.offers[0].id,true);
 assert.equal(E.holdings(s,'alpha').length,1);
 E.publicShare(s,holding.id);E.switchRole(s,'gamma');
 assert.equal(E.roomView(s).investigation.cards.find(c=>c.id==='alpha_note').revealed.length,1);
 E.switchRole(s,'alpha');E.makeOffer(s,'token',null,'beta',2);
 E.switchRole(s,'beta');E.replyOffer(s,s.offers[0].id,true);
 assert.equal(s.tokens.alpha,2);assert.equal(s.tokens.beta,5);
 E.switchPhase(s,'action');
 E.switchRole(s,'beta');assert.throws(()=>E.act(s,'kill','alpha'),/차례/);
 E.switchRole(s,'alpha');E.act(s,'protect','gamma');
 E.switchRole(s,'gamma');E.act(s,'pass');
 E.switchRole(s,'beta');E.act(s,'kill','gamma');
 assert.equal(s.action.done,true);
 assert.equal(s.action.dead.length,0,'prior protection blocks later attack');
 assert.ok(s.action.log.some(e=>e.kind==='blocked'));
});
test('public test endpoints restrict unpublished manuscript access to the operator and never publish',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'studio-test-'));
 process.env.DATA_DIR=dir;
 process.env.STUDIO_ADMIN_PASSWORD=require('node:crypto').randomBytes(32).toString('hex');
 const auth='Basic '+Buffer.from('operator:'+process.env.STUDIO_ADMIN_PASSWORD).toString('base64');
 const {handler}=require('../server.js');
 const server=http.createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeAllConnections();await new Promise(done=>server.close(done));fs.rmSync(dir,{recursive:true,force:true})});
 const addr='http://127.0.0.1:'+server.address().port;
 let r=await fetch(addr+'/mystery-test',{headers:{Authorization:auth}});assert.equal(r.status,200);
 assert.match(await r.text(),/시나리오 테스트 모드/);
 r=await fetch(addr+'/api/editor/test-library',{headers:{Authorization:auth}});assert.equal(r.status,200);
 const list=(await r.json()).stories;
 assert.ok(list.some(x=>x.id==='d1-crown-of-ashes'));
 r=await fetch(addr+'/api/editor/test-case/d1-crown-of-ashes',{headers:{Authorization:auth}});
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.story.players,7);
 assert.ok(data.game.booklets.mac.culprit);
 r=await fetch(addr+'/api/editor/test-case/d1-crown-of-ashes',{headers:{'X-Forwarded-For':'203.0.113.99'}});
 assert.equal(r.status,401,'proxy clients cannot read secret booklets');
 r=await fetch(addr+'/api/editor/test-library',{headers:{'X-Forwarded-For':'203.0.113.99'}});
 assert.equal(r.status,401,'proxy clients cannot list author-only sources');
 r=await fetch(addr+'/mystery-content/d1-gaming.case.json');
 assert.equal(r.status,403,'private source remains blocked from static serving');
 r=await fetch(addr+'/api/editor/test-validate',{method:'POST',
   headers:{'Content-Type':'application/json',Authorization:auth},body:JSON.stringify({package:makeCase()})});
 assert.equal(r.status,200);
 const draft=await r.json();assert.equal(draft.story.players,3);
 r=await fetch(addr+'/api/editor/test-validate',{method:'POST',
   headers:{'Content-Type':'application/json','X-Forwarded-For':'203.0.113.99'},
   body:JSON.stringify({package:makeCase()})});
 assert.equal(r.status,401);
});
