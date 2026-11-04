'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ending=require('../apps/murder-mystery/ending-engine.js');
const lab=require('../apps/murder-mystery/test-engine.js');
const {validate}=require('../mystery-content/validate.js');
const cases=[
 ['d1-gaming.case.json','mac',7],
 ['cruel-heart-island.case.json','harin',8],
 ['neon-memory-quarantine.case.json','ion',7],
 ['stellar-academy-first-case.case.json','gabin',6]
];
test('All four author cases provide distinct fully written shared and personal endings',()=>{
 for(const [filename,culpritId,num] of cases){
  const raw=require('../mystery-content/'+filename),norm=validate(raw);
  const common=norm.game.ending.common;
  assert.equal(raw.story.characters.length,num);
  assert.equal(raw.game.booklets[culpritId].culprit,true);
  assert.equal(common.captured.paragraphs.length,3);
  assert.equal(common.missed.paragraphs.length,3);
  assert.notEqual(common.captured.title,common.missed.title);
  for(const role of raw.story.characters){
   const c=norm.game.ending.characters[role.id];
   for(const field of ['intro','goalAchieved','goalFailed','alive','dead','restrained','arrested','escaped','closing'])
    assert.ok(c[field].length>=20,filename+' '+role.id+' '+field+' is a nontrivial authored ending fragment');
  }
 }
});
test('Correct/incorrect arrest selects distinct common endings without changing individual goal or status',()=>{
 for(const [filename,culpritId] of cases){
  const pkg=validate(require('../mystery-content/'+filename)),story=pkg.story,game=pkg.game;
  const innocent=story.characters.find(c=>c.id!==culpritId);
  const good=ending.summary(story,game,{arrestedCharacterId:culpritId,goals:{[innocent.id]:true}},
    {dead:[],restrained:[],escaped:[]},innocent.id,false);
  assert.equal(good.common.captured,true);
  assert.equal(good.personal.goalMet,true);
  assert.equal(good.personal.status,'alive');
  assert.ok(good.personal.paragraphs.some(p=>p===game.ending.characters[innocent.id].goalAchieved));
  assert.equal(good.editor,undefined,'normal players must not see host-only adjudication');
  const bad=ending.summary(story,game,{arrestedCharacterId:innocent.id,goals:{[innocent.id]:false}},
    {dead:[innocent.id],restrained:[],escaped:[]},innocent.id,false);
  assert.equal(bad.common.captured,false);
  assert.equal(bad.personal.goalMet,false);
  assert.equal(bad.personal.status,'dead','death wins over mistaken arrest');
  assert.notDeepEqual(bad.common.paragraphs,good.common.paragraphs);
  const cust=ending.summary(story,game,{arrestedCharacterId:innocent.id,goals:{}},
    {dead:[],restrained:[],escaped:[]},innocent.id,true);
  assert.equal(cust.personal.status,'arrested');
  assert.equal(cust.editor.characters.length,story.players);
  const escaped=ending.summary(story,game,{}, {dead:[],restrained:[],escaped:[innocent.id]},innocent.id,false);
  assert.equal(escaped.personal.status,'escaped');
 }
});
test('Academy escape outcome is independent from arrest verdict',()=>{
 const pkg=validate(require('../mystery-content/stellar-academy-first-case.case.json'));
 const empty=ending.summary(pkg.story,pkg.game,{arrestedCharacterId:'gabin'},
   {dead:[],restrained:[],escaped:[]},'seoha',false);
 const free=ending.summary(pkg.story,pkg.game,{arrestedCharacterId:'gabin'},
   {dead:[],restrained:[],escaped:['seoha']},'seoha',false);
 assert.equal(empty.common.captured,true);
 assert.equal(free.common.captured,true);
 assert.notDeepEqual(empty.common.paragraphs,free.common.paragraphs,'exit is a separate victory track');
});
test('Author test simulates every role and death/arrest/restraint/escape plus goal achievement',()=>{
 const pkg=validate(require('../mystery-content/cruel-heart-island.case.json'));
 const state=lab.create(pkg);
 lab.switchPhase(state,'ending');
 const innocent='minjae',culprit='harin';
 lab.setArrest(state,culprit);
 lab.setGoal(state,innocent,true);
 lab.setStatus(state,innocent,'dead');
 lab.switchRole(state,innocent);
 let view=lab.roomView(state);
 assert.equal(view.ending.common.captured,true);
 assert.equal(view.ending.personal.status,'dead');
 assert.equal(view.ending.personal.goalMet,true);
 assert.ok(view.ending.editor);
 lab.setStatus(state,innocent,'restrained');
 assert.equal(lab.roomView(state).ending.personal.status,'restrained');
 lab.setStatus(state,innocent,'escaped');
 assert.equal(lab.roomView(state).ending.personal.status,'escaped');
 lab.setStatus(state,innocent,'alive');
 assert.equal(lab.roomView(state).ending.personal.status,'alive');
 lab.setArrest(state,innocent);
 assert.equal(lab.roomView(state).ending.personal.status,'arrested');
 assert.equal(lab.roomView(state).ending.common.captured,false);
 lab.switchRole(state,culprit);
 assert.equal(lab.roomView(state).ending.personal.characterId,culprit);
 assert.equal(lab.roomView(state).ending.personal.goalMet,null);
 assert.equal(lab.roomView(state).ending.personal.status,'alive');
 lab.setStatus(state,culprit,'dead');
 assert.throws(()=>lab.setArrest(state,culprit),/사망/);
});
test('Scenario editor visual theme persists through validation for custom story ID',()=>{
 const data=JSON.parse(JSON.stringify(require('../mystery-content/d1-gaming.case.json')));
 data.story.id='custom-art-review';
 data.story.artTheme='d1-crown-of-ashes';
 const normalized=validate(data);
 assert.equal(normalized.story.artTheme,'d1-crown-of-ashes');
 assert.equal(normalized.game.ending.characters.jobi.intro,data.game.ending.characters.jobi.intro);
 data.story.artTheme='https://evil.example/fake.webp';
 assert.equal(validate(data).story.artTheme,'','the validator must not permit external asset URLs');
});
test('automatic artwork theme survives validation of imported built-in drafts',()=>{
 for(const [filename] of cases){
  const data=require('../mystery-content/'+filename);
  const story=validate(data).story;
  assert.equal(story.id,'','publication still assigns a new story ID');
  assert.equal(story.artTheme,data.story.id);
 }
 const data=require('../mystery-content/d1-gaming.case.json');
 assert.equal(validate({...data,story:{...data.story,id:'d1-gaming'}}).story.artTheme,'d1-crown-of-ashes');
});
test('Common and private ending renderer is shared by real game and test lab, not a placeholder',()=>{
 const html=['test.html','editor.html','index.html'].map(name=>fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/'+name),'utf8'));
 assert.match(html[0],/ending-engine\.js/);
 assert.match(html[1],/illustrations\.js/);
 assert.match(html[1],/data-tab="ending"/);
 const study=fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/study.js'),'utf8');
 assert.match(study,/function endingStage\(room\)/);
 assert.match(study,/function verdictPanel\(room\)/);
 const testUi=fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/test-ui.js'),'utf8');
 assert.match(testUi,/engine\.setArrest/);
 assert.match(testUi,/engine\.setStatus/);
 assert.match(testUi,/engine\.setGoal/);
 const art=fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/illustrations.js'),'utf8');
 const win={};vm.runInNewContext(art,{window:win});
 assert.ok(win.MysteryArt.portrait({id:'jobi',name:'조비'},'d1-crown-of-ashes').includes('d1.webp'));
});
