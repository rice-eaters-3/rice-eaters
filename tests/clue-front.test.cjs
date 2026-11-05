'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const front=require('../apps/murder-mystery/clue-front.js');
const E=require('../apps/murder-mystery/test-engine.js');
const d1=require('../mystery-content/d1-gaming.case.json');

test('unrevealed cards have stable, sequential owner and location labels',()=>{
  const cards=d1.game.investigation.cards,labels=front.labels(cards,d1.story.characters,d1.game.floors);
  assert.equal(labels.jobi_threat_phone,'조비의 소지품 1');
  assert.equal(labels.jobi_stage_mouse,'조비의 소지품 2');
  assert.equal(labels.jobi_qualifier_card,'조비의 소지품 3');
  assert.equal(labels.jobi_stopwatch,'조비의 소지품 4');
  const throne=cards.filter(c=>c.location?.floor==='penthouse'&&
    c.location.x>=1&&c.location.x<10&&c.location.y>=1&&c.location.y<6);
  assert.ok(throne.length>=2);
  for(const c of throne)assert.match(labels[c.id],/^배익호의 왕좌실 \d+$/);
  assert.equal(new Set(Object.values(labels)).size,cards.length,'visible card titles must be unique');
});
test('location-less evidence uses a neutral label or a studio-assigned place',()=>{
  const cards=[
    {id:'one',type:'information'},
    {id:'two',type:'place'},
    {id:'three',type:'information',frontPlace:'서재'},
    {id:'four',type:'information',frontPlace:'서재'}
  ];
  const names=front.labels(cards,[],[]);
  assert.equal(names.one,'사건 자료 1');
  assert.equal(names.two,'사건 자료 2');
  assert.equal(names.three,'서재 1');
  assert.equal(names.four,'서재 2');
});
test('Studio player views do not expose evidence title or subtitle until discovery',()=>{
  const state=E.create(d1);
  E.switchRole(state,'mayushi');
  E.switchPhase(state,'investigation1');
  const hidden=E.roomView(state).investigation.cards.find(c=>c.id==='jobi_threat_phone');
  assert.equal(hidden.frontTitle,'조비의 소지품 1');
  assert.equal(hidden.title,null);
  assert.equal(hidden.subtitle,null);
  assert.equal(hidden.revealed.length,0);
  E.reserve(state,'jobi_threat_phone');
  E.investigate(state,'jobi_threat_phone');
  const seen=E.roomView(state).investigation.cards.find(c=>c.id==='jobi_threat_phone');
  assert.equal(seen.title,'조비의 협박 메시지가 남은 휴대전화');
  assert.ok(seen.revealed[0].back.includes('21:47'));
});
