'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {validate}=require('../mystery-content/validate.js');
const specs=[
 ['d1-gaming.case.json',7,73,7,24],
 ['cruel-heart-island.case.json',8,49,6,20],
 ['neon-memory-quarantine.case.json',7,42,7,21],
 ['stellar-academy-first-case.case.json',6,37,6,21]
];
test('all four case files have a coherent full-author narration and detailed role-limited scenes',()=>{
  for(const [file,n,scenes,chapters,paragraphs] of specs){
    const doc=require('../mystery-content/'+file),normalized=validate(doc);
    assert.equal(normalized.story.players,n);
    const story=doc.creatorGuide.omniscientStory;
    assert.equal(story.length,chapters,'full omniscient chapter count '+file);
    assert.equal(story.reduce((total,part)=>total+part.paragraphs.length,0),paragraphs,
      'full narrative paragraph count '+file);
    for(const section of story){
      assert.ok(section.title.length>8,section.title);
      assert.ok(section.paragraphs.length>=2,section.title);
      assert.ok(section.paragraphs.every(p=>p.length>=65),section.title+' includes substantial prose');
    }
    let allScenes=[];
    for(const role of doc.story.characters){
      const b=doc.game.booklets[role.id],scenes=b.timeline;
      assert.equal(b.culprit,role.name===doc.creatorGuide.culprit,'canonical killer flag '+role.name);
      assert.ok(b.background.length>=3,'private background '+role.name);
      assert.ok(b.objectives.length>25,'individual score goals '+role.name);
      assert.ok(scenes.length>=6,'multi-scene role arc '+role.name);
      for(const e of scenes){
        assert.ok(e.time&&e.title,'scene has local time and title');
        assert.ok(e.detail.length>=125,'scene has behavior, inner thoughts and interactions '+role.name+' '+e.time);
        assert.equal(e.detail.split(/\n\n/).length,3,
          'scene uses paragraph breaks, not a single line '+role.name+' '+e.time);
        assert.equal(e.detail.includes('undefined'),false,'no missing narrative snippets');
      }
      allScenes.push(...scenes);
    }
    assert.equal(allScenes.length,scenes,'expected role events '+file);
    const original=doc.game.investigation.cards;
    assert.equal(normalized.game.investigation.cards.length,original.length,
      'narrative work preserves gameplay clues '+file);
    assert.equal(normalized.game.floors.length,doc.game.floors.length);
    assert.ok(doc.creatorGuide.continuityChecklist?.length>=4);
    assert.ok(doc.creatorGuide.narrativeMethod.length>45);
  }
});
test('booklet HTML splits prose into escaped paragraphs rather than flattening or executing it',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/study.js'),'utf8');
  const sandbox={window:{MysteryVoice:{controls:()=>''}},roomHeader:()=>'', 
    escapeHtml:value=>String(value??'').replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
    btn:(action,label)=>'<button data-action="'+action+'">'+label+'</button>'};
  vm.runInNewContext(source,sandbox);
  const ui=sandbox.window.MysteryStudy,role={id:'jobi',name:'조비',role:'지망생',hint:'',symbol:'♟',accent:'#fafafa'};
  const room={me:'p1',phase:'study',players:[],story:{title:'비공개 이야기'},booklet:{
    basic:role,background:['도입 서술'],timeline:[{time:'00:26',title:'사건',
      detail:'첫 번째 문장 <스포일러>.\n\n두 번째 감정.\n\n세 번째 행동 & 결과.'}],
    inventory:[],culprit:false,objectives:'목표',shared:{synopsis:[],characters:[]}},map:null};
  sandbox.window.MysteryRoomState={room};
  ui.navigate('book-toggle');
  ui.navigate('book-chapter',2);
  const html=ui.render(room);
  assert.ok(html.includes('첫 번째 문장 &lt;스포일러&gt;.'));
  assert.ok(html.includes('두 번째 감정.'));
  assert.ok(html.includes('세 번째 행동 &amp; 결과.'));
  assert.ok(html.includes('</p><p>두 번째 감정.</p><p>세 번째 행동 &amp; 결과.</p>'),
    'each manuscript paragraph is displayed separately on one booklet page');
  assert.equal(html.includes('<스포일러>'),false,'manuscript markup escaped');
});

test('cross-character chronology distinguishes recording, scheduling, and witnessed events',()=>{
 const island=require('../mystery-content/cruel-heart-island.case.json');
 const academy=require('../mystery-content/stellar-academy-first-case.case.json');
 const event=(d,r,title)=>d.game.booklets[r].timeline.find(t=>t.title===title);
 const minutes=t=>Number(t.split(':')[0])*60+Number(t.split(':')[1]);
 assert.equal(minutes(event(island,'yura','모니터 재생').time)-minutes(event(island,'yura','숙소 촬영').time),13);
 const raw=island.game.investigation.cards.find(c=>c.id==='island_interview_raw').back;
 for(const time of ['22:10','23:17','23:30'])assert.ok(raw.includes(time));
 assert.equal(event(academy,'jinwoo','생활동 순찰').time,event(academy,'gabin','생활동 복귀').time);
 assert.ok(minutes(event(academy,'rion','언어 연구실').time)<minutes(event(academy,'gabin','연호와 대화').time));
 assert.match(academy.game.investigation.cards.find(c=>c.id==='academy_autopsy_time').back,/안전 센서/);
 const d1=require('../mystery-content/d1-gaming.case.json');
 assert.doesNotMatch(event(d1,'karl','시체 발견').detail,/종료 신호가 없/);
 assert.match(event(d1,'mac','미리 설정한 살인').detail,/직접 시작 버튼/);
});
