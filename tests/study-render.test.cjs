'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('RPG screen: map is main, 7-chapter booklet is paged, cards reveal only authorized backs',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/study.js'),'utf8');
  const sandbox={
    window:{MysteryVoice:{controls:()=>'<button>마이크 켜기</button>'}},
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
      avatars:[{id:'p1',name:'나',characterName:'엘레나',characterId:'elena',symbol:'♜',accent:'#aabbcc',x:1,y:1}]}
  };
  sandbox.window.MysteryRoomState={room};
  const map=view.render(room);
  assert.ok(map.includes('mapTiles'),'map is shown first');
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
    investigation:{tokens:4,cards:[
      {id:'desk',title:'서재 책상',subtitle:'서재',type:'place',location:{floor:'ground',x:2,y:1},
        locked:false,excluded:false,taken:false,reservedBy:null,revealed:[]},
      {id:'photo',title:'액자',subtitle:'응접실',type:'place',locked:false,excluded:false,
        taken:true,reservedBy:null,revealed:[{back:'사진 <증거>'}]}
    ]}};
  const invHtml=view.render(investigation);
  assert.ok(invHtml.includes('조사 토큰'));
  assert.ok(invHtml.includes('조사 가능 정보'));
  assert.ok(invHtml.includes('research-card'));
  assert.ok(invHtml.includes('사진 &lt;증거&gt;'),'investigated back escaped');
  assert.ok(invHtml.includes('data-card="desk"'),'first come selection action');
  const noMap={...room,map:null};
  assert.ok(view.render(noMap).includes('제공된 맵이 없습니다.'));
});
