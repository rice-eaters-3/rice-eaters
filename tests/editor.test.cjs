'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');

function scenario(){
 const chars=[
   {id:'alpha',name:'작가',role:'방문자',hint:'비밀을 간직한 손님',symbol:'♜',accent:'#aabbcc'},
   {id:'beta',name:'관리인',role:'집을 지키는 사람',hint:'열쇠를 찾는다',symbol:'♟',accent:'#aaccee'}
 ];
 const map=()=>['#####','#...#','#...#','#...#','#####'];
 return {format:'rice-mystery-v1',story:{title:'테스트 추리 극장',subtitle:'JSON 제작 도구 테스트',
   genre:'미스터리',teaser:'비밀이 밝혀지는 밤',minutes:60,players:2,
   synopsis:['첫 번째 공동 시놉시스'],characters:chars},
  spawn:{alpha:{floor:'ground',x:1,y:1},beta:{floor:'ground',x:3,y:1}},
  game:{
    booklets:{
      alpha:{background:['역할 A만 아는 비밀'],timeline:[{time:'01:00',title:'도착',detail:'A 행적'}],
        inventory:[{id:'keya',name:'작은 열쇠',description:'잠긴 문을 연다'}],
        culprit:true,objectives:'살아남기',notes:'조용히 행동'},
      beta:{background:['역할 B만 아는 비밀'],timeline:[],inventory:[],culprit:false,
        objectives:'진실을 밝히기',notes:'누구도 믿지 마라'}
    },
    phaseMinutes:{synopsis:5,characters:5,study:20,investigation1:20},
    investigation:{tokensPerPlayer:4,maxTileOccupants:3,cards:[
      {id:'letter',title:'비밀 편지',subtitle:'책상 위의 편지',type:'information',
        back:'편지 뒷면의 단서',repeatable:false,requires:[],visibility:'locked'}
    ]},
    floors:[
      {id:'ground',title:'1층',legend:'방과 복도',tiles:map(),rooms:[],
        areas:[{id:'dining',name:'식당',x:1,y:1,width:2,height:3,color:'#779977',pattern:'tile'}],
        doors:[{id:'locked1',name:'작은 잠긴 문',x:2,y:1,locked:true,requiresItem:'keya'}],
        portals:[
          {x:2,y:2,toFloor:'upper',toX:2,toY:2,label:'위층 올라가기'},
          {x:2,y:2,toFloor:'basement',toX:2,toY:2,label:'아래층 내려가기'}
        ]},
      {id:'upper',title:'2층',legend:'2층',tiles:map(),rooms:[],areas:[],doors:[],
        portals:[{x:2,y:2,toFloor:'ground',toX:2,toY:2,label:'1층 내려가기'}]},
      {id:'basement',title:'지하',legend:'지하',tiles:map(),rooms:[],areas:[],doors:[],
        portals:[{x:2,y:2,toFloor:'ground',toX:2,toY:2,label:'1층 올라가기'}]}
    ]
  }
 };
}

test('editor JSON import validation, creator-only secrets, room play, manual portal & locked door',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mystery-editor-'));
 process.env.DATA_DIR=dir;
 const {handler}=require('../server.js');
 const srv=http.createServer(handler);
 await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
 t.after(async()=>{srv.closeAllConnections();await new Promise(done=>srv.close(done));fs.rmSync(dir,{force:true,recursive:true})});
 const base='http://127.0.0.1:'+srv.address().port;
 const people=[{cookie:''},{cookie:''},{cookie:''}];
 async function req(i,route,method='GET',payload){
   const person=people[i],headers={};
   if(person.cookie)headers.Cookie=person.cookie;
   if(payload!==undefined)headers['Content-Type']='application/json';
   const r=await fetch(base+route,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)});
   if(r.headers.get('set-cookie'))person.cookie=r.headers.get('set-cookie').split(';')[0];
   return {status:r.status,data:await r.json()};
 }
 const post=(i,route,body={})=>req(i,route,'POST',body);
 const proxied=await fetch(base+'/api/editor/publish',{method:'POST',headers:{
   'Content-Type':'application/json','X-Forwarded-For':'203.0.113.9'
 },body:JSON.stringify({package:scenario()})});
 assert.equal(proxied.status,403,'Cloudflare-style forwarded client must not be able to publish secrets');
 const externalHost=await fetch(base+'/api/editor/own',{headers:{Host:'public.trycloudflare.com'}});
 assert.equal(externalHost.status,403,'public tunnel host cannot open local author manuscripts');
 const pkg=scenario();
 const invalid=scenario();invalid.game.floors[0].portals[0].toX=99;
 assert.equal((await post(0,'/api/editor/publish',{package:invalid})).status,400,'bad portal rejected');
 const created=await post(0,'/api/editor/publish',{package:pkg});
 assert.equal(created.status,201,JSON.stringify(created.data));
 assert.match(created.data.id,/^custom-/);
 const id=created.data.id;
 const catalog=(await req(2,'/api/stories')).data.stories;
 assert.ok(catalog.some(v=>v.id===id&&v.players===2),'new author story is playable by guests');
 assert.equal(JSON.stringify(catalog).includes('역할 A만 아는 비밀'),false,'story catalog does not contain book secrets');
 assert.equal((await req(1,'/api/editor/own/'+id)).status,403,'non-owner cannot download a case manuscript');
 const authorDraft=await req(0,'/api/editor/own/'+id);
 assert.equal(authorDraft.status,200);
 assert.equal(authorDraft.data.game.booklets.alpha.culprit,true);
 assert.equal(authorDraft.data.game.floors[0].portals.length,2,'tile supports both up and down');
 const lobby=await post(0,'/api/rooms',{storyId:id,name:'호스트'});
 assert.equal(lobby.status,201);
 const code=lobby.data.code;
 assert.equal((await post(1,'/api/rooms/'+code+'/join',{name:'손님'})).status,200);
 await req(0,'/api/rooms/'+code);await req(1,'/api/rooms/'+code);
 const started=await post(0,'/api/rooms/'+code+'/start');
 assert.equal(started.data.phase,'synopsis');
 assert.equal((await post(0,'/api/rooms/'+code+'/read')).data.phase,'synopsis');
 assert.equal((await post(1,'/api/rooms/'+code+'/read')).data.phase,'characters');
 await post(0,'/api/rooms/'+code+'/character',{characterId:'alpha'});
 const selected=await post(1,'/api/rooms/'+code+'/character',{characterId:'beta'});
 assert.equal(selected.data.phase,'study');
 assert.equal(selected.data.booklet.background[0],'역할 B만 아는 비밀');
 assert.equal(selected.data.map.areas[0].name,'식당');
 assert.equal(selected.data.map.doors[0].locked,true);
 assert.equal((await req(2,'/api/rooms/'+code)).data.booklet,null,'non-member sees no secret');
 assert.equal((await req(0,'/api/rooms/'+code)).data.booklet.background[0],'역할 A만 아는 비밀');
 // Walk through a locked door is forbidden even though tile is floor.
 const blocked=await post(1,'/api/rooms/'+code+'/move',{direction:'left'});
 assert.equal(blocked.status,409,'locked door cannot be traversed');
 assert.equal((await post(1,'/api/rooms/'+code+'/interact',{kind:'door',doorId:'locked1'})).status,403,
   'player without key cannot unlock');
 const door=await post(0,'/api/rooms/'+code+'/interact',{kind:'door',doorId:'locked1'});
 assert.equal(door.status,200,'key holder unlocks adjacent door');
 assert.equal(door.data.map.doors[0].locked,false);
 assert.equal((await post(1,'/api/rooms/'+code+'/move',{direction:'left'})).status,200,
   'unlocked door can be walked through');
 // Player is on door, must move one step down to the dual-purpose portal.
 await new Promise(resolve=>setTimeout(resolve,145));
 const move=await post(1,'/api/rooms/'+code+'/move',{direction:'down'});
 assert.equal(move.status,200);
 assert.equal(move.data.map.floorId,'ground','entering portal never auto-travels');
 assert.equal(move.data.map.portals.length,2,'both stair choices visible');
 assert.equal((await post(0,'/api/rooms/'+code+'/interact',{kind:'portal',portalIndex:0})).status,409,
   'cannot use stairs remotely');
 const descend=await post(1,'/api/rooms/'+code+'/interact',{kind:'portal',portalIndex:1});
 assert.equal(descend.status,200);
 assert.equal(descend.data.map.floorId,'basement','explicit downstairs action leads to basement');
 const db=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8'));
 assert.equal(db.customStories[id].owner,people[0].cookie.split('=')[1]);
 assert.equal(db.rooms[code].mapPositions[selected.data.me].floor,'basement');
});

test('editor import rejects malformed map, bad character count and missing card prerequisites',()=>{
 const {validate}=require('../mystery-content/validate.js');
 const good=scenario();
 assert.equal(validate(good).story.title,'테스트 추리 극장');
 const badCount=scenario();badCount.story.players=3;
 assert.throws(()=>validate(badCount),/등장인물 수/);
 const badMap=scenario();badMap.game.floors[0].tiles[0]='#';
 assert.throws(()=>validate(badMap),/맵은/);
 const badCard=scenario();badCard.game.investigation.cards[0].requires=['missing'];
 assert.throws(()=>validate(badCard),/선행 카드/);
});
