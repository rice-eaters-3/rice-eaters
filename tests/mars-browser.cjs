const {chromium} = require('playwright');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(12000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog', async dialog=>{await dialog.accept('1')});
 await page.goto('file://'+path.resolve(__dirname,'../apps/terraforming-mars/index.html'));
 await page.getByRole('button',{name:'새 게임 시작'}).click();
 assert.equal(await page.locator('#setup').isVisible(),true,'setup visible after click');
 await page.locator('#mapOptions .map-choice').filter({hasText:'타르시스'}).click();
 assert.equal(await page.locator('#mapOptions .map-choice.active').count(),1,'exactly one selected map');
 await page.locator('#corpChoices button.choose').first().click();
 await page.locator('#firstCards input[type=checkbox]').first().check();
 await page.getByRole('button',{name:'기업 확정하고 게임 시작'}).click();
 assert.equal(await page.locator('#game').isVisible(),true,'game visible after corporation confirmation');
 assert.equal(await page.locator('#activeMapName').textContent(),'타르시스','selected map is used');
 await page.evaluate(()=>{
   const all=CARDS.map(c=>cardHTML(c,'hand'));
   const scratch=document.createElement('div');
   scratch.style.cssText='position:fixed;left:-20000px;top:0;';
   scratch.innerHTML=all.join('');document.body.append(scratch);
   window.__scratch=scratch;
 });
 const imgs=page.locator('div.card-effect-icons img.effect-icon');
 await imgs.first().waitFor({state:'attached'});
 await page.waitForTimeout(500);
 const bad=await imgs.evaluateAll(arr=>arr.filter(x=>!x.complete||x.naturalWidth===0).map(x=>x.src));
 assert.deepEqual(bad,[],'project effect SVG asset loads');
 
 const mapChecks=await page.evaluate(()=>{
  const old=G,mapResults=[];
  for(const id of MAP_IDS){
   const a=applyMapPreset(id);
   const first=JSON.stringify(BOARD_BONUSES),waterA=Array.from(OCEAN_SLOTS).sort().join('|');
   const second=applyMapPreset(id);
   const limits=mapLimits();
   mapResults.push([id,first===JSON.stringify(BOARD_BONUSES),waterA===Array.from(OCEAN_SLOTS).sort().join('|'),OCEAN_SLOTS.size>=limits.ocean]);
  }
  applyMapPreset('tharsis');G.mapId='tharsis';
  return mapResults
 });
 assert.equal(mapChecks.length,7,'seven official board options');
 assert.deepEqual(mapChecks.filter(x=>x.slice(1).some(v=>!v)),[],'fixed map coordinates do not shuffle when reselected');
 await page.evaluate(()=>{const c=CARDS.find(x=>x.id==='base-003');G.hand=[{...c}];G.res.mc=100;G.res.steel=10;G.res.titanium=10;G.phase='action';renderGame()});
 await page.locator('#hand button.choose').first().click();
 assert.equal(await page.locator('#paymentModal').isVisible(),true,'card payment opens before card play');
 const steelfield=page.getByRole('spinbutton',{name:'강철 사용 개수'});
 await steelfield.fill('4');
 await page.getByRole('spinbutton',{name:'메가크레딧 사용 개수'}).fill('5');
 assert.equal(await page.locator('#paymentConfirm').isEnabled(),true);
 await page.locator('#paymentConfirm').click();
 assert.equal(await page.locator('#paymentModal').isVisible(),false,'modal closes after confirmation');
 const paid=await page.evaluate(()=>({mc:G.res.mc,steel:G.res.steel,played:G.played.some(c=>c.id==='base-003')}));
 assert.deepEqual(paid,{mc:95,steel:6,played:true},'mixed MC/steel payment deducts exact allocation');

 const outcomes=await page.evaluate(()=>{
   const tests=[];
   const zero=()=>({mc:150,steel:10,titanium:10,plant:10,energy:10,heat:10});
   const prod=()=>({mc:0,steel:0,titanium:0,plant:0,energy:5,heat:0});
   const mk=()=>{const tiles={};for(const k of OCEAN_SLOTS)tiles[k]={type:'ocean-slot',reserved:true};tiles['0,0']={type:'special',reserved:true};return {phase:'action',gen:1,tr:14,temp:-30,oxy:0,ocean:0,corp:'credicor',corpName:'Credicor',ability:'',res:zero(),prod:prod(),hand:[],played:[],tiles,selected:null,logs:[],score:0,seenCardIds:new Set(),excludedCards:[]}};
   const card=name=>({...CARDS.find(x=>x.name===name),stored:{}});
   let g=mk();G=g;let c=card('칼루나');g.hand=[c];playCard(c.id);tests.push(['cold Caluna blocked',g.hand.length===1&&g.res.mc===150]);g.temp=-14;playCard(c.id);tests.push(['Caluna works at -14',g.hand.length===0&&g.prod.plant===1]);
   g=mk();G=g;c=card('혜성 견인');g.hand=[c];playCard(c.id);tests.push(['Comet all effects',g.oxy===1&&g.ocean===1&&g.res.plant===12]);
   g=mk();G=g;c=card('표토 섭식 미생물');g.played=[c];onAction(c.id);tests.push(['microbe stored',c.stored.microbe===1]);onAction(c.id);tests.push(['action limited once',c.stored.microbe===1]);
   g=mk();G=g;c=card('가축');c.stored.animal=4;g.played=[c];tests.push(['animal VP',cardScore(c)===4]);
   g=mk();G=g;c=card('인공 광합성 기술');g.hand=[c];playCard(c.id);tests.push(['choice applied',g.prod.plant===1]);
   g=mk();G=g;c=card('극지 미세조류');g.played=[c];g.selected=[...OCEAN_SLOTS][0];placeTile('ocean');tests.push(['persistent ocean +2 plant',g.res.plant===12]);
   return tests;
 });
 assert.deepEqual(outcomes.filter(x=>!x[1]),[],JSON.stringify(outcomes));

 const allProjectResults=await page.evaluate(()=>{
   applyMapPreset('tharsis');
   const failed=[];
   for(const c of CARDS){
     const slots={};for(const k of OCEAN_SLOTS)slots[k]={type:'ocean-slot',reserved:true};slots['0,0']={type:'special',reserved:true};
     const tags=['science','science','science','plant','plant','plant','microbe','animal','jovian','power','power'];
     const g={phase:'action',gen:1,tr:14,temp:8,oxy:14,ocean:6,corp:'credicor',corpName:'Credicor',ability:'',res:{mc:1000,steel:10,titanium:10,plant:10,heat:10,energy:10},prod:{mc:0,steel:3,titanium:3,plant:10,heat:10,energy:10},tiles:slots,selected:'3,0',hand:[{...c}],played:tags.map((tag,i)=>({id:'test-tag-'+i,type:'ongoing',tags:[tag],effectText:'',vp:0})),seenCardIds:new Set(),excludedCards:[],logs:[],score:0};
     const cond=c.condition||'';
     for(const [kind,key] of [['기온','temp'],['산소','oxy'],['해양','ocean']]){
       if(cond.includes(kind)){const m=cond.match(new RegExp(kind+'.*?([-+]?\\d+)'));if(m)g[key]=Number(m[1])}
     }
     if(c.id==='base-017')g.selected='0,0';
     if(['base-059','base-142','base-174'].includes(c.id))g.selected=[...OCEAN_SLOTS][0];
     if(c.id==='base-067')g.selected='-2,0';
     if(c.id==='base-020')g.selected='4,0';
     if(c.id==='base-128'){g.tiles['2,0']={type:'greenery'};g.selected='3,0'}
     G=g;
     try{playCard(c.id);if(!g.played.some(x=>x.id===c.id))failed.push(c.name+': not played')}catch(e){failed.push(c.name+': '+e.message)}
   }
   return {tested:CARDS.length,failed};
 });
 assert.equal(allProjectResults.tested,137);
 assert.deepEqual(allProjectResults.failed,[],'every base-game project card play handles valid test state');
 await page.evaluate(()=>window.__scratch?.remove());

 assert.deepEqual(errors,[],'unhandled page JavaScript errors');
 await page.screenshot({path:'mars-browser-smoke.png',fullPage:true});
 const imageCount=await imgs.count();await browser.close();console.log(JSON.stringify({status:'PASS',checks:outcomes.length,cardCases:allProjectResults.tested,images:imageCount,pageErrors:errors.length}));
})().catch(e=>{console.error('Browser smoke failed:',e);process.exit(1)});