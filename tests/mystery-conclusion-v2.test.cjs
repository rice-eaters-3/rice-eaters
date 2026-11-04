'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {validate}=require('../mystery-content/validate.js');
const Ending=require('../apps/murder-mystery/ending-engine.js');
const Studio=require('../apps/murder-mystery/test-engine.js');
const ids=['d1-gaming','cruel-heart-island','neon-memory-quarantine','stellar-academy-first-case'];

test('28 player epilogues have authored outcome-dependent text after validation',()=>{
 let count=0;
 for(const file of ids){
  const {story,game}=validate(require('../mystery-content/'+file+'.case.json'));
  const culprit=story.characters.find(c=>game.booklets[c.id]?.culprit);
  assert.ok(culprit);
  for(const character of story.characters){
   const branch=game.ending.characters[character.id];
   assert.ok(branch.captured.length>=40,character.id+' captured');
   assert.ok(branch.missed.length>=40,character.id+' missed');
   assert.notEqual(branch.captured,branch.missed);
   const good=Ending.outcome(story,game,{arrestedCharacterId:culprit.id,goals:{[character.id]:true}},
    {dead:[],restrained:[],escaped:[]},character.id);
   const wrong=Ending.outcome(story,game,{arrestedCharacterId:null,goals:{[character.id]:false}},
    {dead:[],restrained:[],escaped:[]},character.id);
   assert.equal(good.common.verdictType,'captured');
   assert.equal(wrong.common.verdictType,'unresolved');
   assert.ok(good.personal.paragraphs.includes(branch.captured));
   assert.ok(wrong.personal.paragraphs.includes(branch.missed));
   assert.equal(good.personal.goalMet,true);
   assert.equal(wrong.personal.goalMet,false);
   count++;
  }
 }
 assert.equal(count,28);
});
test('wrongful arrest has an explicit consequence; a stale dead arrest never counts as caught',()=>{
 const {story,game}=validate(require('../mystery-content/d1-gaming.case.json'));
 const wrong=Ending.outcome(story,game,{arrestedCharacterId:'jobi',goals:{}},
   {dead:[],restrained:[],escaped:[]},'jobi');
 assert.equal(wrong.common.verdictType,'wrongful');
 assert.equal(wrong.personal.status,'arrested');
 assert.match(wrong.common.paragraphs.at(-1),/조비/);
 const stale=Ending.outcome(story,game,{arrestedCharacterId:'mac',goals:{}},
   {dead:['mac'],restrained:[],escaped:[]},'mac');
 assert.equal(stale.common.captured,false);
 assert.equal(stale.common.verdictType,'unresolved');
 assert.equal(stale.personal.status,'dead');
});
test('studio ending reconciles status and can restore simulated action result',()=>{
 const p=validate(require('../mystery-content/neon-memory-quarantine.case.json'));
 const s=Studio.create(p);
 Studio.switchPhase(s,'ending');
 Studio.setArrest(s,'ion');
 Studio.setStatus(s,'nova','dead');
 assert.equal(Studio.roomView(s).ending.personal.status,'dead');
 assert.equal(Studio.roomView(s).ending.editor.characters.find(c=>c.id==='nova').override,'dead');
 Studio.setStatus(s,'nova','auto');
 assert.equal(Studio.roomView(s).ending.personal.status,'alive');
 assert.equal(Studio.roomView(s).ending.editor.characters.find(c=>c.id==='nova').override,'auto');
 Studio.setStatus(s,'ion','dead');
 assert.equal(s.verdict.arrestedCharacterId,null);
 assert.equal(Studio.roomView(s).ending.common.verdictType,'unresolved');
});
test('all four case visuals are composed per asset instead of returning a plain atlas crop',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/illustrations.js'),'utf8');
 const w={};vm.runInNewContext(code,{window:w});
 const art=w.MysteryArt;
 for(const file of ids){
  const {story,game}=require('../mystery-content/'+file+'.case.json');
  const storyId=story.artTheme||story.id;
  const portraits=story.characters.map(c=>art.portrait(c,storyId));
  assert.equal(new Set(portraits).size,portraits.length);
  for(const p of portraits){
   assert.match(p,/composed-mystery-art/);
   assert.match(p,/<radialGradient/);
   assert.match(p,/<image href=/);
   assert.match(p,/PERSONNEL DOSSIER/);
  }
  const first=game.investigation.cards.slice(0,12);
  const artSet=first.map(c=>art.clue(c,storyId));
  assert.equal(new Set(artSet).size,first.length);
  assert.ok(artSet.every(p=>p.includes('EVIDENCE RECORD')));
 }
});
