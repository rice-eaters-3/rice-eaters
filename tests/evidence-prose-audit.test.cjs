'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');

const cases=[
  require('../mystery-content/d1-gaming.case.json'),
  require('../mystery-content/cruel-heart-island.case.json'),
  require('../mystery-content/neon-memory-quarantine.case.json'),
  require('../mystery-content/stellar-academy-first-case.case.json')
];
const copyExplainingInsteadOfShowing=/(?:암시한다|살해할 구상|증거가 된다|범인이라고 단정|살인범이 아니다|실제 범행 계획은 없다|알리바이가 무너진다|범행 의도|범행의 동기|범인을 특정|따라서 범인)/;

test('every built-in clue describes inspectable evidence, not an author verdict',()=>{
  for(const pkg of cases)for(const clue of pkg.game.investigation.cards){
    assert.ok(typeof clue.back==='string'&&clue.back.trim(),pkg.story.id+'/'+clue.id);
    assert.doesNotMatch(clue.back,copyExplainingInsteadOfShowing,
      pkg.story.id+'/'+clue.id+' explains the answer rather than presenting evidence');
  }
});

test('all private inventory descriptions match the exact inspectable clue back',()=>{
  for(const pkg of cases)for(const clue of pkg.game.investigation.cards){
    if(!clue.owner)continue;
    const personal=pkg.game.booklets[clue.owner]?.inventory||[];
    const item=personal.find(x=>x.id===clue.id);
    assert.ok(item,pkg.story.id+'/'+clue.id+' has no personal inventory entry');
    assert.equal(item.description,clue.back,
      pkg.story.id+'/'+clue.id+' reveals inconsistent evidence in the private booklet');
  }
});

test('Cloud oven printout alone cannot explain server offset, and ladle carries a literal date',()=>{
  const cards=cases[0].game.investigation.cards;
  const oven=cards.find(c=>c.id==='cloud_oven_receipt');
  const ladle=cards.find(c=>c.id==='cloud_huoguo_ladle');
  assert.ok(oven.back.includes('00:23')&&oven.back.includes('00:26')&&oven.back.includes('00:29'));
  assert.ok(!oven.back.includes('3층 서버')&&!oven.back.includes('8분'));
  assert.match(ladle.back,/\b2021-09-18\b/);
  assert.ok(!ladle.back.includes('교단 행사 케이터링'));
});

test('ambiguous evidence labels do not state a conclusion prematurely',()=>{
  const idToTitle=new Map(cases.flatMap(pkg=>pkg.game.investigation.cards.map(c=>[c.id,c.title])));
  assert.equal(idToTitle.get('trick_voice_recording'),'「살았죠?」 음성 파일');
  assert.equal(idToTitle.get('nova_empty_notebook'),'노바의 메모 수첩');
  assert.equal(idToTitle.get('academy_voice_witness'),'01:10 관측관 음성 파일');
});
