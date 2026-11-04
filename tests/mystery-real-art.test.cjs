'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const http=require('node:http');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'apps/murder-mystery/illustrations.js'),'utf8');
const context={window:{}};vm.runInNewContext(source,context);
const art=context.window.MysteryArt;
const scenarios=[
 ['d1-gaming.case.json','d1-crown-of-ashes','d1.webp',7,22,71],
 ['cruel-heart-island.case.json','cruel-heart-island','island.webp',8,15,56],
 ['neon-memory-quarantine.case.json','neon-memory-quarantine','neon.webp',7,14,54],
 ['stellar-academy-first-case.case.json','stellar-academy-first-case','academy.webp',6,14,48]
];
const imagePath=name=>path.join(root,'apps/murder-mystery/assets',name);
test('all four original concept-sheet WebP image files are real binary assets with a RIFF/WEBP header',()=>{
 for(const [,id,file] of scenarios){
  const bytes=fs.readFileSync(imagePath(file));
  assert.ok(bytes.length>100000,id+' should contain actual illustrated art, not a placeholder');
  assert.equal(bytes.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(bytes.subarray(8,12).toString('ascii'),'WEBP');
  const atlas=art.atlas[id];
  assert.equal(atlas.file,file);
  const all=[...Object.values(atlas.portraits),...Object.values(atlas.objects),
    ...Object.values(atlas.clues),...Object.values(atlas.doors),...Object.values(atlas.stairs)];
  const [width,height]=atlas.size;
  for(const [x,y,w,h] of all){
   assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=width&&y+h<=height,
     id+' source artwork crop must be inside the real source image');
  }
 }
});
test('every player, map prop and clue has a case illustration',()=>{
 for(const [filename,id,file,cast,props,clues] of scenarios){
  const data=require('../mystery-content/'+filename);
  assert.equal(data.story.id,id);
  assert.equal(data.story.characters.length,cast);
  let tally=0;
  for(const character of data.story.characters){
   const visual=art.portrait(character,id);
   assert.match(visual,/<svg/);
   assert.ok(visual.includes(file),character.id+' should use its own case artwork');
   assert.ok(visual.includes('<image '),'player image must be clipped original art, not generated strokes');
   assert.doesNotMatch(visual,/<path(?:\s|>)/,'no geometric cartoon portrait substitution');
   const avatar=art.avatar({characterId:character.id,name:character.name},id);
   assert.ok(avatar.includes(file),'map avatar must use case artwork too');
  }
  for(const floor of data.game.floors){
   for(const o of floor.objects||[]){
    const v=art.object(o,id);
    assert.ok(v.includes(file),id+' object '+o.kind+' has no original art');
    tally++;
   }
   for(const door of floor.doors||[]){
    const v=art.door({name:door.name,locked:door.locked,open:!door.closed&&!door.locked},id);
    assert.ok(v?.includes(file),'door state must have real painted game sprite');
   }
   for(const portal of floor.portals||[]){
    const v=art.stairs(portal,id);
    assert.ok(v?.includes(file),'portal must use painted floor transition');
   }
  }
  assert.equal(tally,props);
  assert.equal(data.game.investigation.cards.length,clues);
  for(const [index,clue] of data.game.investigation.cards.entries()){
   const v=art.clue(clue,id);
   const standalone=id==='d1-crown-of-ashes'&&index<10;
   if(standalone){
    const name='clues/'+id+'/'+clue.id+'.webp';
    assert.ok(v.includes(name));
    assert.ok(!v.includes(file));
    assert.ok(art.clue({...clue,id:'holding_abc',cardId:clue.id},id).includes(name));
    assert.ok(art.clue({id:clue.id,name:clue.title},id).includes(name));
   }else{
    assert.ok(v.includes(file),id+' clue '+clue.id+' must show case-specific painting');
   }
  }
  assert.ok(art.cover(id).includes(file),'scenario preview banner needs the matching art');
 }
});
test('illustrated evidence picker chooses specific character and case clues, not a single generic image',()=>{
 const d1='d1-crown-of-ashes',island='cruel-heart-island',neon='neon-memory-quarantine',school='stellar-academy-first-case';
 assert.equal(art.clueKind({title:'클라우드의 오염된 대형 식칼'},d1),'knife');
 assert.equal(art.clueKind({title:'차지우의 가고일 미니어처'},d1),'mini');
 assert.equal(art.clueKind({title:'카알의 수상한 털뭉치 노트'},d1),'furry');
 assert.equal(art.clueKind({title:'관리자 출입 태그'},d1),'badge');
 assert.equal(art.clueKind({title:'드론 메모리 카드'},island),'drone');
 assert.equal(art.clueKind({title:'젖은 운동화'},island),'shoes');
 assert.equal(art.clueKind({title:'매칭 알고리즘 백업 드라이브'},island),'drive');
 assert.equal(art.clueKind({title:'신분 메모리 칩'},neon),'chip');
 assert.equal(art.clueKind({title:'의료 생체기록 패널'},neon),'medical');
 assert.equal(art.clueKind({title:'이온의 정비 승인 토큰'},neon),'token');
 assert.equal(art.clueKind({title:'공연 음성 장치'},school),'audio');
 assert.equal(art.clueKind({title:'지하 출구 인증서'},school),'exit');
});
test('malicious labels are escaped in the real-art markup, and other scenarios fall back safely',()=>{
 const v=art.portrait({id:'jobi',name:'조비 <img onerror=alert(1)>'},'d1-crown-of-ashes');
 assert.match(v,/&lt;img onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(v,/<img /);
 assert.match(v,/<image href="\/apps\/murder-mystery\/assets\/d1\.webp"/);
 // An attribute-like string inside escaped aria-label text must never
 // appear as an injected HTML element or executable handler.
 assert.doesNotMatch(v,/<img\s/i);
 const other=art.portrait({id:'mystery',symbol:'♟',name:'커스텀'},'custom-case');
 assert.ok(other.includes('♟'));
});
test('live game and studio both load artwork module and connect painted props/doors to real map',()=>{
 for(const entry of ['index.html','test.html','editor.html']){
  const html=fs.readFileSync(path.join(root,'apps/murder-mystery',entry),'utf8');
  assert.ok(html.includes('illustrations.js'));
  if(entry!=='editor.html')assert.ok(html.indexOf('illustrations.js')<html.indexOf('study.js'));
  else assert.ok(html.indexOf('illustrations.js')<html.indexOf('editor.js'));
 }
 const screen=fs.readFileSync(path.join(root,'apps/murder-mystery/study.js'),'utf8');
 for(const token of ['MysteryArt?.object(o,theme(room))','MysteryArt?.door(door,theme(room))',
  'MysteryArt?.stairs(portalsHere[0],theme(room))','MysteryArt?.avatar(a,theme(room))',
  'portrait(b.basic','art(c,theme(room))'])assert.ok(screen.includes(token),token);
 const game=fs.readFileSync(path.join(root,'apps/murder-mystery/app.js'),'utf8');
 assert.ok(game.includes('MysteryArt?.cover(story.artTheme||story.id)'));
 assert.ok(game.includes('MysteryArt?.portrait(c,room.story?.artTheme||room.story?.id)'));
 const editor=fs.readFileSync(path.join(root,'apps/murder-mystery/editor.js'),'utf8');
 assert.ok(editor.includes('MysteryArt?.portrait(c,visualStory())'));
 assert.ok(editor.includes('MysteryArt?.object(furniture,visualStory())'));
 const studio=fs.readFileSync(path.join(root,'apps/murder-mystery/test-ui.js'),'utf8');
 assert.ok(studio.includes("dataset.story=room.story?.artTheme||room.story?.id"));
});
test('local HTTP server serves original and standalone artwork with image/webp MIME and bytes',async t=>{
 const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'illustrated-mystery-'));
 process.env.DATA_DIR=dir;
 const {handler}=require('../server.js');
 const server=http.createServer(handler);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 t.after(async()=>{
  server.closeAllConnections();
  await new Promise(ok=>server.close(ok));
  fs.rmSync(dir,{recursive:true,force:true});
 });
 const base='http://127.0.0.1:'+server.address().port;
 const independent=require('../mystery-content/d1-gaming.case.json').game.investigation.cards.slice(0,10)
  .map(({id})=>['','d1-crown-of-ashes','clues/d1-crown-of-ashes/'+id+'.webp']);
 for(const [,id,file] of [...scenarios,...independent]){
  const response=await fetch(base+'/apps/murder-mystery/assets/'+file);
  assert.equal(response.status,200,id+' artwork must be browser-accessible');
  assert.match(response.headers.get('content-type')||'',/image\/webp/);
  const binary=Buffer.from(await response.arrayBuffer());
  assert.ok(binary.length>(file.includes('/')?1000:100000));
  assert.equal(binary.subarray(0,4).toString('ascii'),'RIFF');
 }
});
