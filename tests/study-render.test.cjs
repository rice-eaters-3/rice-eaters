'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('RPG screen: map is main, 7-chapter booklet is paged, cards reveal only authorized backs',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/study.js'),'utf8');
  const sandbox={
    window:{MysteryArt:{clue:c=>'<img data-clue-art="'+c.id+'">',avatar:()=>'',object:()=>'',door:()=>'',stairs:()=>'',portrait:()=>''},MysteryVoice:{controls:()=>'<button>마이크 켜기</button>'}},
    escapeHtml:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    btn:(action,label,cls='',disabled=false,extra='')=>'<button data-action="'+action+'" '+extra+' '+(disabled?'disabled':'')+'>'+label+'</button>',
    roomHeader:()=>'<div>자정의 저택</div>'
  };
  vm.runInNewContext(source,sandbox);
  const view=sandbox.window.MysteryStudy;
  const role={id:'elena',name:'엘레나',role:'조카',hint:'비밀이 있는 사람',symbol:'♜',accent:'#aabbcc'};
  const room={
    me:'p1',phase:'study',story:{players:4},characters:[role],
    players:[{id:'p1',name:'나',characterId:'elena',studyReady:false,position:{floor:'ground',x:1,y:1}}],
    booklet:{
      basic:role,background:['중요 <비밀>','이야기 2'],timeline:[{time:'22:20',title:'로비',detail:'증언'}],
      inventory:[{id:'key',name:'열쇠',description:'작은 열쇠'}],
      culprit:false,objectives:'수동 점수',notes:'침착하세요',
      shared:{synopsis:['모두 아는 시놉시스'],characters:[role]}
    },
    whispers:{groups:[],proposals:[]},
    map:{title:'저택',legend:'공유 약도',floorId:'ground',capacity:3,
      tiles:['#####','#...#','#####'],rooms:[{x:2,y:1,name:'복도',icon:'⌁'}],portals:[],
      doors:[{id:'door',name:'복도 문',x:2,y:1,locked:false,open:false}],areas:[],
      avatars:[{id:'p1',name:'나',characterName:'엘레나',characterId:'elena',symbol:'♜',accent:'#aabbcc',x:1,y:1}]}
  };
  sandbox.window.MysteryRoomState={room};
  const map=view.render(room);
  assert.ok(map.includes('mapTiles'),'map is shown first');
  assert.ok(map.includes('door-closed'),'a closed door has a distinct tile style');
  assert.ok(map.includes('data-door-action="open"'),'adjacent player may open a closed door');
  assert.ok(!map.includes('PRIVATE DOSSIER'),'book is initially closed');
  assert.ok(map.includes('data-direction="up"'),'directional controls shown');
  assert.ok(map.includes('책자 확인 (I)'),'I key book control');
  assert.ok(map.includes('밀담 요청'),'whisper actions');
  view.navigate('book-toggle');
  let html=view.render(room);
  for(const name of ['기본 정보','중요 정보','사건에 대한 정보','나의 소지품','범인 여부','승리 목표','기타 정보'])
    assert.ok(html.includes(name),'seven TOC entries');
  assert.ok(html.includes('folio-content')&&html.includes('다음 장'),'paged book, not scroll sections');
  view.navigate('book-chapter',1);
  html=view.render(room);
  assert.ok(html.includes('중요 &lt;비밀&gt;'),'secret escaped');
  assert.ok(!html.includes('중요 <비밀>'),'secret not raw HTML');
  assert.ok(!html.includes('이야기 2'),'only one narrative page shown at once');
  view.navigate('book-next');
  assert.ok(view.render(room).includes('이야기 2'),'next page advances');
  view.navigate('book-chapter',4);
  assert.ok(view.render(room).includes('당신은 범인이 아닙니다.'));
  view.navigate('book-toggle');
  const investigation={...room,phase:'investigation1',
    investigation:{tokens:4,totalTokens:4,canInvestigate:true,myCards:[],nearby:[],cards:[
      {id:'desk',frontTitle:'서재 1',title:null,subtitle:null,type:'place',location:{floor:'ground',x:1,y:1},
        locked:false,excluded:false,taken:false,reservedBy:null,revealed:[]},
      {id:'photo',title:'액자',subtitle:'응접실',type:'place',locked:false,excluded:false,
        taken:true,reservedBy:null,revealed:[{back:'사진 <증거>'}]}
    ]}};
  const mapWithResearch=view.render(investigation);
  assert.ok(mapWithResearch.includes('조사 토큰'));
  assert.ok(mapWithResearch.includes('🔎 서재 1'),'map action uses anonymous place label');
  assert.ok(mapWithResearch.includes('조사 가능 정보 확인 (R)'));
  assert.ok(!mapWithResearch.includes('research-card'),'map view no longer permanently renders card list');
  sandbox.window.MysteryRoomState.room=investigation;
  view.navigate('research-toggle');
  const invHtml=view.render(investigation);
  assert.ok(invHtml.includes('조사 가능 정보'));
  assert.ok(invHtml.includes('research-card'),'card list lives in dedicated view');
  assert.ok(invHtml.includes('사진 &lt;증거&gt;'),'investigated back escaped');
  assert.ok(invHtml.includes('data-card="desk"'),'first come selection action');
  assert.ok(!invHtml.includes('data-clue-art="desk"'),'hidden illustration never rendered');
  assert.ok(invHtml.includes('data-clue-art="photo"'),'authorized back contains illustration');
  assert.ok(invHtml.includes('지도로 돌아가기 (R)'),'research catalog has exit button');
  const ownCase={...investigation,investigation:{...investigation.investigation,
    myCards:[{id:'holding1',cardId:'desk',title:'조사한 편지',subtitle:'비밀 증거',
      back:'양도 전 비밀 <important>',transferable:true,public:false,sharedWith:[]}],
    nearby:[{id:'p2',name:'다른 참가자'}],
    incomingOffers:[{id:'offer1',type:'token',amount:2,fromName:'친구',expiresAt:123}],
    outgoingOffers:[{id:'offer2',type:'card',toName:'동료',expiresAt:123}],
    collected:[]
  }};
  const exchangeView=view.render(ownCase);
  for(const action of ['card-public','card-share','exchange-offer','exchange-reply','exchange-cancel'])
    assert.ok(exchangeView.includes('data-action="'+action+'"'),action+' control is visible');
  assert.ok(exchangeView.includes('tokenTransferTarget'),'token transfer target selector exists');
  assert.ok(exchangeView.includes('양도 전 비밀 &lt;important&gt;'),'private holding text is HTML escaped');
  const noTrades={...ownCase,phase:'discussion1',investigation:{...ownCase.investigation,canInvestigate:false}};
  const readOnly=view.render(noTrades);
  assert.ok(readOnly.includes('조사한 편지'),'owned cards remain readable in discussion');
  assert.ok(!readOnly.includes('data-action="card-public"'),'sharing controls unavailable outside an investigation');

  view.navigate('book-toggle');
  assert.ok(view.render(investigation).includes('folio-content'),'book is accessible from investigation catalog');
  view.navigate('book-toggle');
  // Whisper button must activate when a second person moves onto our tile.
  const teammate={id:'p2',name:'친구',characterId:'other',studyReady:false,
    position:{floor:'ground',x:1,y:1}};
  const two={...room,players:[...room.players,teammate]};
  const startIndex=view.render(two).indexOf('data-action="whisper-request"');
  assert.ok(startIndex>0,'whisper request is present');
  assert.ok(!view.render(two).slice(startIndex,startIndex+115).includes('disabled'),
    'two players sharing a tile can request a whisper');
  const alone={...room,players:[room.players[0],{...teammate,position:{floor:'ground',x:2,y:1}}]};
  const waiting=view.render(alone);
  const at=waiting.indexOf('data-action="whisper-request"');
  assert.ok(waiting.slice(at,at+115).includes('disabled'),'whisper disabled while separate');
  // The partial UI update must refresh whisper controls, not only sprite locations.
  let swapped='';
  const tile={innerHTML:''};
  const document={
    getElementById:id=>id==='adventureRoot'?{}:id==='mapTiles'?tile:
      id==='whisperPanel'?{replaceWith:node=>{swapped=node.innerHTML||node.html||''}}:null,
    querySelector:()=>null,
    createElement:()=>({
      set innerHTML(v){this.firstElementChild={innerHTML:v,html:v};},
      firstElementChild:null
    })
  };
  sandbox.document=document;
  assert.equal(view.patch(two),true,'live update handles same-tile arrival');
  assert.ok(swapped.includes('밀담 요청'),'whisper panel refreshed');
  assert.ok(!swapped.slice(swapped.indexOf('data-action="whisper-request"'),
    swapped.indexOf('data-action="whisper-request"')+115).includes('disabled'),
    'whisper button becomes active after map-only update');
  const opened={...room,map:{...room.map,doors:[{id:'door',name:'복도 문',x:2,y:1,locked:false,open:true}]}};
  assert.ok(view.render(opened).includes('data-door-action="close"'),'open doors show close interaction');
  const noMap={...room,map:null};
  assert.ok(view.render(noMap).includes('제공된 맵이 없습니다.'));
});
