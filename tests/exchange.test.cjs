'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');

function mystery(){
  const roles=['alpha','beta'].map((id,i)=>({id,name:'역할 '+id,role:'방문객',hint:'사건을 조사한다',
    accent:'#aabbcc',symbol:'♟'}));
  const booklets=Object.fromEntries(roles.map(c=>[c.id,{
    background:['비밀 '+c.id],timeline:[],inventory:[],culprit:false,
    objectives:'사건을 해결한다',notes:'침착하게 조사한다'
  }]));
  const cards=[
    {id:'evidence',title:'유리 조각',subtitle:'살인 사건의 흔적',type:'belonging',
      back:'유리 조각의 비밀은 여기에만 기록된다',transferable:true},
    {id:'private',title:'비공개 편지',subtitle:'비밀 서신',type:'information',
      back:'편지의 비밀은 원래 소유자에게 남으면 안 된다',transferable:true},
    {id:'sealed',title:'봉인 기록',subtitle:'양도 금지',type:'information',
      back:'이 기록은 양도 금지이다',transferable:false},
    {id:'later',title:'마지막 증언',subtitle:'두 번째 라운드',type:'place',
      back:'2차 조사에서 발견한 마지막 증거',transferable:true}
  ].map(c=>({...c,owner:null,blockedFor:[],requires:[],repeatable:false,visibility:'locked',
    location:null,grant:null}));
  return {format:'rice-mystery-v1',story:{
    title:'카드 공유 테스트 사건',subtitle:'교환 테스트',genre:'미스터리',
    teaser:'두 명의 등장인물',minutes:45,players:2,
    synopsis:['이 사건을 조사합니다.'],characters:roles
  },spawn:{alpha:{floor:'ground',x:1,y:1},beta:{floor:'ground',x:1,y:1}},
  game:{booklets,phaseMinutes:{synopsis:5,characters:5,study:20,investigation1:20,
    discussion1:15,investigation2:20,discussion2:20,action:10,ending:15},
    investigation:{tokensPerPlayer:7,tokensPerSecondInvestigation:2,maxTileOccupants:3,cards},
    floors:[{id:'ground',title:'1층',legend:'복도',tiles:['######','#....#','#....#','######'],
      areas:[],rooms:[],doors:[],portals:[]}]}
  };
}
test('private clue sharing, transfer consent, ownership, same-tile expiration and stage votes',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'mystery-shares-'));
  process.env.DATA_DIR=dataDir;
  const {handler}=require('../server.js');
  const server=http.createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    fs.rmSync(dataDir,{recursive:true,force:true})});
  const base='http://127.0.0.1:'+server.address().port,people=[{cookie:''},{cookie:''},{cookie:''}];
  async function req(id,route,method='GET',data){
    const headers={};if(people[id].cookie)headers.Cookie=people[id].cookie;
    if(data!==undefined)headers['Content-Type']='application/json';
    const result=await fetch(base+route,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});
    const cookie=result.headers.get('set-cookie');if(cookie)people[id].cookie=cookie.split(';')[0];
    const parsed=await result.json();
    return {status:result.status,data:parsed};
  }
  const post=(id,route,data={})=>req(id,route,'POST',data);
  const author=await post(0,'/api/editor/publish',{package:mystery()});
  assert.equal(author.status,201,JSON.stringify(author.data));
  const created=await post(0,'/api/rooms',{storyId:author.data.id,name:'Alice'});
  assert.equal(created.status,201);
  const code=created.data.code,endpoint='/api/rooms/'+code;
  const guest=await post(1,endpoint+'/join',{name:'Bob'});
  assert.equal(guest.status,200);
  const a=created.data.me,b=guest.data.me;
  await req(0,endpoint);await req(1,endpoint);
  assert.equal((await post(0,endpoint+'/start')).status,200);
  for(const i of [0,1])assert.equal((await post(i,endpoint+'/read')).status,200);
  assert.equal((await post(0,endpoint+'/advance')).data.phase,'characters');
  await post(0,endpoint+'/character',{characterId:'alpha'});
  await post(1,endpoint+'/character',{characterId:'beta'});
  assert.equal((await post(0,endpoint+'/advance')).data.phase,'study');
  for(const i of [0,1])await post(i,endpoint+'/study-ready');
  const phase1=await post(0,endpoint+'/advance');
  assert.equal(phase1.data.phase,'investigation1');
  assert.equal(phase1.data.investigation.tokens,7);
  assert.equal(phase1.data.investigation.myCards.length,0);
  assert.equal((await req(2,endpoint)).data.investigation,null,'nonmember never gets clue content');
  const investigate=async cardId=>{
    assert.equal((await post(0,endpoint+'/reserve',{cardId})).status,200);
    const result=await post(0,endpoint+'/investigate',{cardId});
    assert.equal(result.status,200,JSON.stringify(result.data));
    return result.data.investigation.myCards.find(h=>h.cardId===cardId);
  };
  const evidence=await investigate('evidence');
  assert.ok(evidence.id);
  let bob=(await req(1,endpoint)).data.investigation;
  assert.deepEqual(bob.cards.find(c=>c.id==='evidence').revealed,[],'the back starts private');
  assert.equal((await post(1,endpoint+'/card-public',{holdingId:evidence.id})).status,403,
    'other member cannot publish another player card');
  assert.equal((await post(0,endpoint+'/card-share',{holdingId:evidence.id,toId:b})).status,200);
  bob=(await req(1,endpoint)).data.investigation;
  assert.equal(bob.cards.find(c=>c.id==='evidence').sharedToMe,true);
  assert.match(bob.cards.find(c=>c.id==='evidence').revealed[0].back,/유리 조각/);
  assert.equal((await post(0,endpoint+'/card-share',{holdingId:evidence.id,toId:'invalid'})).status,400);
  const away=await post(1,endpoint+'/move',{direction:'right'});
  assert.equal(away.status,200);
  bob=(await req(1,endpoint)).data.investigation;
  assert.equal(bob.cards.find(c=>c.id==='evidence').revealed.length,0,
    'moving apart immediately revokes targeted disclosure');
  assert.equal((await post(0,endpoint+'/card-share',{holdingId:evidence.id,toId:b})).status,409);
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal((await post(1,endpoint+'/move',{direction:'left'})).status,200);
  bob=(await req(1,endpoint)).data.investigation;
  assert.equal(bob.cards.find(c=>c.id==='evidence').revealed.length,0,
    'returning to tile never revives an old share');
  const permanent=await post(0,endpoint+'/card-public',{holdingId:evidence.id});
  assert.equal(permanent.status,200);
  assert.equal(permanent.data.investigation.cards.find(c=>c.id==='evidence').public,true);
  assert.equal((await req(1,endpoint)).data.investigation.cards.find(c=>c.id==='evidence').revealed.length,1,
    'global reveal available to every game member');
  const secret=await investigate('private'),nontransfer=await investigate('sealed');
  assert.equal((await post(0,endpoint+'/exchange-offer',
    {type:'card',holdingId:nontransfer.id,toId:b})).status,403,
    'card-specific transfer prohibition is enforced on server');
  const proposed=await post(0,endpoint+'/exchange-offer',
    {type:'card',holdingId:secret.id,toId:b});
  assert.equal(proposed.status,200);
  let offer=proposed.data.investigation.outgoingOffers[0].id;
  assert.equal((await req(1,endpoint)).data.investigation.incomingOffers[0].cardTitle,'비공개 편지');
  assert.equal((await post(0,endpoint+'/exchange-reply',{offerId:offer,accept:true})).status,403,
    'sender cannot self-accept');
  assert.equal((await req(1,endpoint)).data.investigation.cards.find(c=>c.id==='private').revealed.length,0,
    'sending a trade offer must not leak the clue back');
  assert.equal((await req(0,endpoint)).data.investigation.myCards.some(c=>c.id===secret.id),true,
    'ownership must remain with proposer before two-party consent');
  const accepted=await post(1,endpoint+'/exchange-reply',{offerId:offer,accept:true});
  assert.equal(accepted.status,200);
  assert.equal(accepted.data.investigation.myCards.some(c=>c.id===secret.id),true,
    'acceptance assigns the card to recipient');
  assert.equal(accepted.data.investigation.cards.find(c=>c.id==='private').revealed.length,1);
  assert.equal((await req(0,endpoint)).data.investigation.cards.find(c=>c.id==='private').revealed.length,0,
    'sender loses access to nonpublic card after transfer');
  assert.equal((await post(1,endpoint+'/exchange-reply',{offerId:offer,accept:true})).status,404,
    'second acceptance cannot transfer the same holding twice');
  const declined=await post(1,endpoint+'/exchange-offer',
    {type:'card',holdingId:secret.id,toId:a});
  assert.equal(declined.status,200);
  offer=declined.data.investigation.outgoingOffers[0].id;
  assert.equal((await post(0,endpoint+'/exchange-reply',{offerId:offer,accept:false})).status,200);
  assert.equal((await req(1,endpoint)).data.investigation.myCards.some(c=>c.id===secret.id),true,
    'rejecting transfer leaves ownership unchanged');
  const tokensBefore=(await req(0,endpoint)).data.investigation.tokens;
  const tokensGuestBefore=(await req(1,endpoint)).data.investigation.tokens;
  assert.equal(tokensBefore,4,'three investigations consumed exactly three tokens');
  assert.equal((await post(0,endpoint+'/exchange-offer',
    {type:'token',amount:tokensBefore+1,toId:b})).status,409,'cannot offer more tokens than owned');
  const tokenOffer=await post(0,endpoint+'/exchange-offer',{type:'token',amount:2,toId:b});
  assert.equal(tokenOffer.status,200);
  assert.equal(tokenOffer.data.investigation.tokens,tokensBefore,'offer alone does not change balance');
  offer=tokenOffer.data.investigation.outgoingOffers[0].id;
  assert.equal((await post(1,endpoint+'/exchange-reply',{offerId:offer,accept:true})).status,200);
  assert.equal((await req(0,endpoint)).data.investigation.tokens,tokensBefore-2);
  assert.equal((await req(1,endpoint)).data.investigation.tokens,tokensGuestBefore+2);
  const cancelled=await post(0,endpoint+'/exchange-offer',{type:'token',amount:1,toId:b});
  assert.equal(cancelled.status,200);
  offer=cancelled.data.investigation.outgoingOffers[0].id;
  await new Promise(resolve=>setTimeout(resolve,160));
  assert.equal((await post(1,endpoint+'/move',{direction:'right'})).status,200);
  assert.equal((await post(1,endpoint+'/exchange-reply',{offerId:offer,accept:true})).status,404,
    'leaving the tile voids an unaccepted transfer');
  // Voting is independent of timer; host cannot force the next step.
  assert.equal((await post(0,endpoint+'/advance')).status,409,'host cannot skip investigation vote');
  assert.equal((await post(0,endpoint+'/advance-vote')).data.progress.ready,1);
  assert.equal((await post(0,endpoint+'/advance')).status,409,'one vote is not unanimous');
  assert.equal((await post(1,endpoint+'/advance-vote')).data.progress.canAdvance,true);
  assert.equal((await post(1,endpoint+'/advance')).status,403,'only host actually advances');
  assert.equal((await post(0,endpoint+'/advance-unvote')).data.progress.ready,1,'votes can be withdrawn');
  assert.equal((await post(0,endpoint+'/advance')).status,409,'host cannot advance after withdrawal');
  assert.equal((await post(0,endpoint+'/advance-vote')).data.progress.ready,2);
  const discussion=await post(0,endpoint+'/advance');
  assert.equal(discussion.data.phase,'discussion1');
  assert.equal(discussion.data.progress.ready,0,'new phase resets votes');
  assert.equal(discussion.data.investigation.cards.find(c=>c.id==='evidence').public,true,
    'global card publication persists across phases');
  assert.equal(discussion.data.investigation.canInvestigate,false);
  assert.equal((await post(0,endpoint+'/exchange-offer',{type:'token',toId:b,amount:1})).status,409,
    'trading is limited to the investigation phases');
  assert.equal((await post(0,endpoint+'/reserve',{cardId:'later'})).status,409,
    'discussion cannot consume investigation tokens');
  await post(0,endpoint+'/advance-vote');await post(1,endpoint+'/advance-vote');
  const round2=await post(0,endpoint+'/advance');
  assert.equal(round2.data.phase,'investigation2');
  assert.equal(round2.data.investigation.tokens,tokensBefore-2+2,
    'second stage gives additional tokens while carrying the existing balance');
  assert.equal(round2.data.investigation.myCards.some(c=>c.id===evidence.id),true,
    'old clue ownership persists into second investigation');
  assert.equal(round2.data.investigation.cards.find(c=>c.id==='evidence').public,true);
  assert.equal(round2.data.investigation.canInvestigate,true);
  assert.equal((await post(0,endpoint+'/reserve',{cardId:'later'})).status,200,
    'new card can be investigated during stage 2');
  const newClue=await post(0,endpoint+'/investigate',{cardId:'later'});
  assert.equal(newClue.status,200);
  assert.equal(newClue.data.investigation.myCards.some(c=>c.cardId==='later'),true);
  for(const i of [0,1])await post(i,endpoint+'/advance-vote');
  assert.equal((await post(0,endpoint+'/advance')).data.phase,'discussion2');
  for(const i of [0,1])await post(i,endpoint+'/advance-vote');
  assert.equal((await post(0,endpoint+'/advance')).data.phase,'action');
  for(const i of [0,1])await post(i,endpoint+'/advance-vote');
  const ending=await post(0,endpoint+'/advance');
  assert.equal(ending.data.phase,'ending');
  assert.equal(ending.data.progress.next,null,'ending is terminal until story ending rules are implemented');
  const saved=JSON.parse(fs.readFileSync(path.join(dataDir,'state.json'),'utf8'));
  assert.equal(saved.rooms[code].investigation.publicCards.evidence.by,a);
  assert.equal(saved.rooms[code].investigation.holdings.find(c=>c.id===secret.id).ownerId,b);
  assert.equal(saved.rooms[code].investigation.tokens[a],tokensBefore-2+2-1);
});
