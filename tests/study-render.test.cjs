'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('browser-independent renderer: seven private book chapters and shared map',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/study.js'),'utf8');
  const sandbox={
    window:{},
    escapeHtml:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    btn:(action,label,cls='',disabled=false,extra='')=>'<button data-action="'+action+'" '+extra+' '+(disabled?'disabled':'')+'>'+label+'</button>',
    roomHeader:()=>'<div>자정의 저택</div>',
  };
  vm.runInNewContext(source,sandbox);
  const view=sandbox.window.MysteryStudy;
  const role={id:'elena',name:'엘레나',role:'조카',hint:'비밀이 있는 사람',symbol:'♜',accent:'#aabbcc'};
  const room={
    me:'p1',story:{players:4},
    characters:[role],
    players:[{id:'p1',name:'나',characterId:'elena',studyReady:false}],
    booklet:{
      basic:role,background:['중요 <비밀>'],timeline:[{time:'22:20',title:'로비',detail:'증언'}],
      inventory:[{id:'key',name:'열쇠',description:'작은 열쇠'}],
      culprit:false,objectives:'수동 점수',notes:'침착하세요',
      shared:{synopsis:['모두 아는 시놉시스'],characters:[role]}
    },
    map:{
      title:'저택',legend:'공유 약도',tiles:['#####','#...#','#####'],
      rooms:[{x:2,y:1,name:'복도',icon:'⌁'}],
      avatars:[{id:'p1',name:'나',characterName:'엘레나',characterId:'elena',symbol:'♜',accent:'#aabbcc',x:1,y:1}]
    }
  };
  const html=view.render(room);
  for(let i=1;i<=7;i++)assert.ok(html.includes('id="book-'+i+'"'),'all booklet sections');
  for(const title of ['기본 정보','중요 정보','사건에 대한 정보','나의 소지품','범인 여부','승리 목표','기타 정보']){
    assert.ok(html.includes(title),'book section '+title);
  }
  assert.ok(html.includes('중요 &lt;비밀&gt;'),'personal data is HTML escaped');
  assert.ok(!html.includes('중요 <비밀>'),'unsanitized personal data absent');
  assert.ok(html.includes('역할 연기 참고'));
  assert.ok(html.includes('mapTiles'),'shared map visible');
  assert.ok(html.includes('data-direction="up"'),'keyboard/button-compatible map movement');
  assert.ok(html.includes('data-action="study-ready"'),'study ready button');
  const noMap={...room,map:null};
  assert.ok(view.render(noMap).includes('건물 약도'), 'story with no map still renders booklet');
  assert.ok(!view.render(noMap).includes('data-direction="up"'),'no map means no movement');
  const noBook={...room,booklet:null};
  assert.ok(view.render(noBook).includes('개인 책자를 찾을 수 없습니다.'));
});
