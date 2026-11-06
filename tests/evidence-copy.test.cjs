'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validate}=require('../mystery-content/validate.js');
const cases=['d1-gaming','cruel-heart-island','neon-memory-quarantine','stellar-academy-first-case']
 .map(name=>require('../mystery-content/'+name+'.case.json'));

test('public evidence and personal inventory share the same observable copy after import',()=>{
 let cards=0,items=0;
 for(const original of cases){
  const pkg=validate(original),byId=new Map(pkg.game.investigation.cards.map(c=>[c.id,c]));
  for(const card of pkg.game.investigation.cards){
   cards++;assert.ok(card.back.trim(),card.id);
   assert.equal(card.subtitle||'','',card.id+' must not restore editorial hint subtitles');
   assert.doesNotMatch(card.back,/비교 증거가 된다|알리바이는 아니다|실질 동기다|생존 증거가 아니다|판단하라|하나의 행위자로 묶어야|본인만 알고 있는 추가 정보/,card.id);
  }
  for(const booklet of Object.values(pkg.game.booklets))for(const item of booklet.inventory){
   const card=byId.get(item.id);if(!card)continue;
   items++;assert.equal(item.description,card.back,pkg.story.id+'/'+item.id);
  }
 }
 assert.equal(cards,229);assert.equal(items,112);
});

test('D1 clock evidence gives readings and the ladle date needs another document to identify',()=>{
 const cards=new Map(cases[0].game.investigation.cards.map(c=>[c.id,c]));
 const oven=cards.get('cloud_oven_receipt').back;
 for(const time of ['00:23','00:26','00:29'])assert.ok(oven.includes(time));
 assert.doesNotMatch(oven,/8분|서버|증거|조명/);
 const comparison=cards.get('trick_clock_offset').back;
 assert.ok(comparison.includes('00:34')&&comparison.includes('00:26'));
 assert.doesNotMatch(comparison,/8분|같은 순간/);
 const ladle=cards.get('cloud_huoguo_ladle').back;
 const date=ladle.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];assert.ok(date);
 assert.doesNotMatch(ladle,/교단|행사|케이터링/);
 for(const id of ['chajiwoo_cult_invitation','cult_gargoyle_poster'])
  assert.ok(cards.get(id).back.includes(date),id+' must identify the same date');
});

test('source timestamps survive the copy edit without an asserted culprit reconstruction',()=>{
 const examples=[
  [0,'trick_reconstruction',['00:26','00:34','00:29']],
  [1,'island_final_cut',['23:04','23:17','13분']],
  [2,'memory_culprit_reconstruction',['00:08','00:16','00:21','00:30']],
  [3,'academy_culprit_chain',['00:38','00:42','00:45','01:10','01:12']]
 ];
 for(const [index,id,times] of examples){
  const back=cases[index].game.investigation.cards.find(c=>c.id===id).back;
  for(const time of times)assert.ok(back.includes(time),id+' retains '+time);
  assert.doesNotMatch(back,/범인|판단하라|설명할 수 있다|행위자로 묶어야/);
 }
});
