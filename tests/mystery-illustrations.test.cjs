'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {validate}=require('../mystery-content/validate.js');
const specs=[['d1-gaming',22],['cruel-heart-island',15],['neon-memory-quarantine',14],['stellar-academy-first-case',14]];
test('Four cases validate and furnish every mapped setting without obstructing players',()=>{
 for(const [id,count] of specs){
  const raw=require('../mystery-content/'+id+'.case.json'),normal=validate(raw);
  const props=normal.game.floors.flatMap(f=>f.objects.map(o=>({o,f})));
  assert.equal(props.length,count,id+' props');
  assert.equal(raw.game.investigation.cards.length,normal.game.investigation.cards.length);
  for(const {o,f} of props){
   assert.equal(f.tiles[o.y][o.x],'.');
   assert.ok(o.name.length>2);
   assert.equal(o.solid,false);
  }
 }
 const d1=require('../mystery-content/d1-gaming.case.json');
 const kinds=new Set(d1.game.floors.flatMap(f=>f.objects.map(o=>o.kind)));
 for(const kind of ['sink','fridge','pc','gargoyle','throne'])assert.ok(kinds.has(kind),kind);
});
test('Import validation rejects duplicate props and coordinates outside the map',()=>{
 const pkg=JSON.parse(JSON.stringify(require('../mystery-content/d1-gaming.case.json'))),f=pkg.game.floors[0];
 f.objects.push({...f.objects[0]});assert.throws(()=>validate(pkg),/중복/);
 f.objects.pop();f.objects[0].x=-1;assert.throws(()=>validate(pkg),/범위/);
});
test('Illustration renderer draws portraits and evidence art with HTML escaping',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/illustrations.js'),'utf8');
 const window={},sandbox={window};vm.runInNewContext(source,sandbox);
 const art=window.MysteryArt;
 const p=art.portrait({id:'jobi',name:'조비 <img src=x>',accent:'#123456'},'d1-crown-of-ashes');
 assert.match(p,/<svg/);assert.match(p,/&lt;img/);assert.doesNotMatch(p,/<img/);
 const c=art.clue({id:'knife',title:'오염된 대형 식칼'},'d1-crown-of-ashes');
 assert.match(c,/<svg/);assert.match(c,/d1\.webp/);
 assert.equal(art.clueKind({id:'cloud_tainted_cleaver',title:'오염된 대형 식칼'},'d1-crown-of-ashes'),'knife');
 assert.match(art.object({kind:'gargoyle',name:'가고일 전시 조각상'},'d1-crown-of-ashes'),/d1\.webp/);
 assert.match(p,/d1\.webp/);
 assert.doesNotMatch(p,/<path/,'the portrait must be real artwork, not a geometric drawing');
});
test('Frontend loads committed concept artwork before book, and map/card/portrait UI are wired',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/index.html'),'utf8');
 assert.ok(html.indexOf('illustrations.js')<html.indexOf('study.js'));
 const ui=fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/study.js'),'utf8');
 assert.ok(ui.includes('portrait(b.basic'));
 assert.ok(ui.includes('map-prop'));
 assert.ok(ui.includes('research-illustration'));
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 assert.ok(server.includes('objects:floor.objects||[]'));
});
