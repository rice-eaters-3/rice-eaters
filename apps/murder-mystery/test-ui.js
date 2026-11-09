'use strict';
// The test lab intentionally does not call multiplayer room APIs.
const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(action,label,cls='btn',disabled=false,extra='')=>
  '<button type="button" data-action="'+escapeHtml(action)+'" class="'+cls+'" '+(disabled?'disabled ':'')+extra+'>'+label+'</button>';
const phaseNames=window.MysteryTestEngine.PHASE_NAMES;
const engine=window.MysteryTestEngine;
const key='rice_mystery_editor_v1';
let state=null,testStart=0,phaseStart=0,sourceName='현재 작업';
window.MysteryRoomState={room:null};
window.MysteryVoice={controls:()=>'<div class="test-voice-note">🎙 마이크·스피커 및 밀담은 실제 멀티플레이 방에서만 동작합니다. 여기서는 화면 흐름을 미리 확인합니다.</div>'};
function roomHeader(room){
  return '<div class="test-game-head surface panel-pad">'+
    '<div class="eyebrow">PREVIEW SESSION · '+escapeHtml(room.phase.toUpperCase())+'</div>'+
    '<div class="test-game-head-grid"><div><h2>'+escapeHtml(room.story.title)+'</h2>'+
    '<p class="muted small">이 화면은 선택한 배역인 <b>'+escapeHtml(
      room.players.find(p=>p.id===room.me)?.name||'')+'</b>의 시점입니다. 다른 배역의 비공개 정보는 아래 화면에 표시되지 않습니다.</p></div>'+
    '<div class="test-time-group"><span>총 진행 시간 <b id="testGameElapsed">00:00:00</b></span>'+
      '<span>단계 권장 남은 시간 <b id="testPhaseRemaining">--:--</b></span></div></div></div>';
}
function note(text,error=false){
  const target=$('testStatus');
  target.textContent=text;target.classList.toggle('error',error);
}
async function library(){
  try{
    const r=await fetch('/api/editor/test-library',{credentials:'same-origin'});
    if(!r.ok)throw Error('기본 시나리오는 localhost에서만 선택 가능합니다.');
    const d=await r.json(),picker=$('testSource');
    for(const s of d.stories||[]){
      const option=document.createElement('option');option.value='server:'+s.id;
      option.textContent=(s.source==='published'?'📁 등록한 원고 · ':'📕 기본 원고 · ')+s.title+' ('+s.players+'인)';
      picker.appendChild(option);
    }
  }catch(e){note('현재 편집 중인 JSON은 테스트할 수 있습니다. 기본 시나리오 선택은 http://localhost:3000/mystery-test 에서 가능합니다.');}
}
async function load(){
  const chosen=$('testSource').value;
  try{
    let pkg;
    if(chosen==='draft'){
      const saved=localStorage.getItem(key);
      if(!saved)throw Error('먼저 제작소에서 시나리오를 편집하거나 JSON을 불러오세요.');
      pkg=JSON.parse(saved);sourceName='현재 편집 원고';
      if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)){
        const validation=await fetch('/api/editor/test-validate',{
          method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({package:pkg})
        });
        const result=await validation.json();
        if(!validation.ok)throw Error('원고 검증 실패: '+(result.error||validation.status));
        pkg=result;
      }
    }else{
      const id=chosen.slice('server:'.length);
      if(!/^[a-z0-9-]+$/.test(id))throw Error('잘못된 시나리오 ID입니다.');
      const r=await fetch('/api/editor/test-case/'+id,{credentials:'same-origin'});
      const data=await r.json();
      if(!r.ok)throw Error(data.error||'시나리오 원고를 불러올 수 없습니다.');
      pkg=data;sourceName='선택한 기본/등록 원고';
    }
    state=engine.create(pkg);testStart=phaseStart=Date.now();
    window.MysteryRoomState.room=engine.roomView(state);
    const roles=$('testRole');roles.innerHTML=state.pkg.story.characters.map(c=>
      '<option value="'+escapeHtml(c.id)+'">'+escapeHtml(c.name)+' · '+escapeHtml(c.role)+'</option>').join('');
    $('testPhase').innerHTML=engine.PHASES.map((p,i)=>
      '<option value="'+p+'">'+(i+1)+'단계 · '+phaseNames[i]+'</option>').join('');
    $('testReset').disabled=false;$('testControls').hidden=false;
    render();
    note('「'+state.pkg.story.title+'」 테스트 시작 · 각 단계와 배역을 자유롭게 변경할 수 있습니다.');
  }catch(e){
    if(!state){$('testControls').hidden=true;$('testStage').innerHTML='<div class="notice">시나리오를 열 수 없습니다.</div>';}
    note('테스트 시작 실패: '+e.message,true);
  }
}
function phaseTo(phase){
  if(!state)return;
  engine.switchPhase(state,phase);phaseStart=Date.now();
  if(window.MysteryStudy.currentView()==='book')window.MysteryStudy.navigate('book-toggle');
  else if(window.MysteryStudy.currentView()==='research')window.MysteryStudy.navigate('research-toggle');
  render();
}
function roleTo(role){
  if(!state)return;
  engine.switchRole(state,role);render();
}
function format(sec){
  const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=Math.floor(sec%60);
  return [h,m,s].map(n=>String(n).padStart(2,'0')).join(':');
}
function updateClock(){
  if(!state)return;
  const elapsed=Math.floor((Date.now()-testStart)/1000);
  const phaseSeconds=Math.floor((Date.now()-phaseStart)/1000);
  const remaining=Math.max(0,Number(state.pkg.game.phaseMinutes?.[state.phase]||5)*60-phaseSeconds);
  const game=$('testGameElapsed'),phase=$('testPhaseRemaining');
  if(game)game.textContent=format(elapsed);
  if(phase)phase.textContent=format(remaining).slice(3);
}
function meta(){
  const phase=engine.PHASES.indexOf(state.phase),room=window.MysteryRoomState.room;
  $('testRole').value=state.roleId;$('testPhase').value=state.phase;
  $('testPrev').disabled=phase===0;$('testNext').disabled=phase===engine.PHASES.length-1;
  $('testPhaseRail').innerHTML=engine.PHASES.map((p,i)=>
    '<button type="button" data-test-phase="'+p+'" class="test-phase-chip '+(state.phase===p?'active':'')+'">'+
      String(i+1).padStart(2,'0')+' · '+phaseNames[i]+'</button>').join('');
  const tokens=room.investigation?.tokens, owned=engine.holdings(state,state.roleId).length;
  $('testMeta').innerHTML='<span>👤 <b>'+escapeHtml(
    state.pkg.story.characters.find(c=>c.id===state.roleId).name)+'</b> 시점</span>'+
    '<span>⏳ '+phaseNames[phase]+'</span>'+
    (tokens!==undefined?'<span>🪙 조사 토큰 <b>'+tokens+'</b></span>':'')+
    '<span>🗂 보유 조사 카드 <b>'+owned+'</b>장</span>'+
    (state.phase==='action'&&room.action?.currentActor?
      '<button type="button" id="testFocusTurn" class="btn btn-outline btn-sm" data-test-focus="'+escapeHtml(room.action.currentActor.characterId)+'">현재 차례 캐릭터로 전환</button>':'');
}
function synopsis(){
  const s=state.pkg.story;
  const cover=window.MysteryArt?.cover(s.artTheme||s.id);
  return roomHeader(window.MysteryRoomState.room)+
    '<div class="reading-layout"><article class="paper"><div class="stamp">STORY PREVIEW · PUBLIC PROLOGUE</div>'+
    (cover?'<div class="story-illustration">'+cover+'</div>':'')+
    (window.MysteryArt?.victim(s)||'')+
    '<h2>'+escapeHtml(s.title)+'</h2>'+(s.synopsis||[]).map(v=>'<p>'+escapeHtml(v)+'</p>').join('')+
    '</article><aside class="surface panel-pad"><h3>1단계 · 시놉시스 확인</h3>'+
    '<p>모든 플레이어가 공동으로 읽는 이야기야. 개인 비밀은 여기에 보이지 않아야 해.</p>'+
    '<p class="muted small">제작자 테스트에서는 준비 완료를 기다리지 않고 언제든 다음 단계로 이동할 수 있어.</p>'+
    btn('test-stage-next','캐릭터 선택 미리 보기 →','btn btn-primary')+'</aside></div>';
}
function casting(){
  const s=state.pkg.story;
  return roomHeader(window.MysteryRoomState.room)+
    '<div class="section-row"><div><div class="eyebrow">CHAPTER 02 · CASTING PREVIEW</div><h2>누구의 시점으로 플레이할까?</h2>'+
    '<p class="muted small">카드를 눌러 배역을 바꾸면 나머지 단계의 책자·보유 정보도 해당 인물 기준으로 보여.</p></div></div>'+
    '<div class="character-grid">'+s.characters.map(c=>
      '<article class="character-card '+(c.id===state.roleId?'selected':'')+'" style="--accent:'+escapeHtml(c.accent)+'">'+
      '<div class="char-symbol char-illustration">'+(window.MysteryArt?.portrait(c,s.artTheme||s.id)||escapeHtml(c.symbol))+'</div>'+
      '<h3 class="character-name">'+escapeHtml(c.name)+'</h3><div class="character-role">'+escapeHtml(c.role)+'</div>'+
      '<p class="char-hint">'+escapeHtml(c.hint)+'</p>'+
      (c.startLine?'<p class="char-start">“'+escapeHtml(c.startLine)+'”</p>':'')+
      btn('test-role',c.id===state.roleId?'✓ 현재 시점':'이 캐릭터 시점으로',c.id===state.roleId?'btn btn-outline':'btn btn-primary',
        false,'data-role="'+escapeHtml(c.id)+'"')+'</article>').join('')+
    '</div>';
}
function render(){
  if(!state)return;
  const room=engine.roomView(state);window.MysteryRoomState.room=room;
  meta();
  const phase=state.phase;
  let body;
  try{
    body=phase==='synopsis'?synopsis():phase==='characters'?casting():window.MysteryStudy.render(room);
  }catch(e){
    body='<section class="notice">이 화면을 그리지 못했습니다: '+escapeHtml(e.message)+'</section>';
    note('렌더링 오류: '+e.message,true);
  }
  if(phase==='ending'){
    const status=state.statusOverrides[state.roleId]||'auto';
    body='<section class="test-ending surface panel-pad"><h3>🧪 캐릭터 상태를 바꿔 개인 결말 확인</h3>'+
      '<p class="muted small">테스트 모드에서만 생존·사망·제압·탈출 상태를 직접 지정할 수 있습니다. 실제 게임에서는 행동 결과가 적용됩니다.</p>'+
      '<div class="ending-arrest-row"><select id="testEndingStatus">'+
      [['auto','행동 결과 그대로'],['alive','생존'],['dead','사망'],['restrained','제압'],['escaped','탈출']].map(([key,label])=>
        '<option value="'+key+'"'+(status===key?' selected':'')+'>'+label+'</option>').join('')+
      '</select>'+btn('test-set-status','이 캐릭터 상태 적용','btn btn-outline')+'</div></section>'+body;
  }
  $('testStage').dataset.story=room.story?.artTheme||room.story?.id||'';
  $('testStage').innerHTML=body;
  updateClock();
}
function requireHolding(button){
  const el=button.closest('[data-holding-card]'),holdingId=button.dataset.holding||el?.dataset.holdingCard;
  if(!holdingId)throw Error('조사 카드를 먼저 선택해주세요.');
  return holdingId;
}
const roleFromPlayerId=v=>v?.startsWith('test_')?v.slice(5):v;
function currentReserved(){
  return Object.keys(state.reservations).find(card=>state.reservations[card]===state.roleId);
}
function runAction(button){
  const action=button.dataset.action;
  if(action==='test-stage-next'){phaseTo('characters');return;}
  if(action==='test-role'){roleTo(button.dataset.role);return;}
  if(action==='test-set-status'){
    engine.setStatus(state,state.roleId,$('testEndingStatus')?.value||'auto');
    note('선택한 캐릭터 상태가 결말 시뮬레이션에 적용되었습니다.');render();return;
  }
  if(action==='verdict-arrest'){
    engine.setArrest(state,$('endingArrestTarget')?.value||null);
    note('최종 구속 대상이 변경되었습니다. 공통 결말을 다시 확인해 주세요.');render();return;
  }
  if(action==='verdict-status'){
    const characterId=button.dataset.character;
    const status=button.closest('.ending-goal-row')?.querySelector('.ending-status-select')?.value||'auto';
    engine.setStatus(state,characterId,status);
    note('캐릭터 최종 상태가 결말에 반영되었습니다.');render();return;
  }
  if(action==='verdict-goal'){
    const characterId=button.dataset.character;
    const value=button.closest('.ending-goal-row')?.querySelector('.ending-goal-select')?.value||'';
    engine.setGoal(state,characterId,value==='yes'?true:value==='no'?false:null);
    note('개인 목표 판정이 반영되었습니다.');render();return;
  }
  if(['map-zoom-in','map-zoom-out','map-center'].includes(action)){window.MysteryStudy.navigate(action);return;}
  if(['clue-open','clue-flip','clue-close'].includes(action)){
    window.MysteryStudy.navigate(action,button.dataset.card);render();return;
  }
  if(['book-toggle','research-toggle','book-prev','book-next','book-chapter'].includes(action)){
    window.MysteryStudy.navigate(action,button.dataset.chapter);render();return;
  }
  if(action==='move'){engine.move(state,button.dataset.direction);render();return;}
  if(action==='interact'){
    engine.interact(state,button.dataset.kind,button.dataset.kind==='portal'?Number(button.dataset.index):button.dataset.door,button.dataset.doorAction);
    render();return;
  }
  if(action==='study-ready'){
    state.studyReady[state.roleId]=true;note('숙지 완료 처리됨 (현재 캐릭터만).');render();return;
  }
  if(action==='clue-investigate'){
    const cardId=button.dataset.card;
    if(state.reservations[cardId]!==state.roleId)engine.reserve(state,cardId);
    engine.investigate(state,cardId);
    window.MysteryStudy.navigate('clue-revealed');
    note('조사 토큰 1개 사용 · 카드 뒷면 열람 권한을 얻었습니다.');render();return;
  }
  if(action==='reserve'){
    engine.reserve(state,button.dataset.card);note('카드를 선택했습니다. 「조사 실행」으로 토큰을 사용해 뒷면을 확인하세요.');render();return;
  }
  if(action==='release'){engine.release(state,currentReserved());render();return;}
  if(action==='investigate'){
    const c=currentReserved();if(!c)throw Error('먼저 조사를 진행할 카드를 선택하세요.');
    engine.investigate(state,c);note('조사 완료 · 해당 캐릭터의 토큰 1개가 소모되었습니다.');render();return;
  }
  if(action==='card-public'){engine.publicShare(state,requireHolding(button));note('전체 공개 완료 · 모든 캐릭터에게 영구 공개됩니다.');render();return;}
  if(action==='card-share'){
    const holding=requireHolding(button),target=button.closest('[data-holding-card]')?.querySelector('select[data-share-target]')?.value;
    engine.share(state,holding,roleFromPlayerId(target));note('같은 타일에서만 보이는 선택 공개를 적용했습니다.');render();return;
  }
  if(action==='card-unshare'){engine.unshare(state,requireHolding(button),roleFromPlayerId(button.dataset.target));render();return;}
  if(action==='exchange-offer'){
    const kind=button.dataset.exchangeType;
    if(kind==='card'){
      const holder=button.closest('[data-holding-card]'),target=holder?.querySelector('select[data-share-target]')?.value;
      engine.makeOffer(state,'card',requireHolding(button),roleFromPlayerId(target));
    }else if(kind==='token'){
      engine.makeOffer(state,'token',null,roleFromPlayerId($('tokenTransferTarget')?.value),Number($('tokenTransferAmount')?.value));
    }else throw Error('지원하지 않는 양도 방식입니다.');
    note('양도 요청을 보냈습니다. 받는 캐릭터 시점으로 변경해 수락 또는 거절을 테스트하세요.');render();return;
  }
  if(action==='exchange-reply'){
    const accept=button.dataset.accept==='true';
    engine.replyOffer(state,button.dataset.offerId,accept);note(accept?'양도가 완료되었습니다.':'양도를 거절했습니다.');render();return;
  }
  if(action==='exchange-cancel'){
    state.offers=state.offers.filter(o=>!(o.id===button.dataset.offerId&&o.from===state.roleId));render();return;
  }
  if(action==='act'){
    const target=$('action-target-'+button.dataset.ability)?.value;
    engine.act(state,button.dataset.ability,roleFromPlayerId(target));render();return;
  }
  if(['whisper-request','whisper-yes','whisper-no','whisper-leave'].includes(action)){
    note('밀담과 실제 음성 통신은 여러 브라우저가 연결된 멀티플레이 방에서만 테스트할 수 있습니다.');return;
  }
  note('이 버튼은 멀티플레이 전용입니다: '+action);
}
$('testStage').addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||!state)return;
  try{runAction(button)}catch(e){note('테스트 동작: '+e.message,true);
    if(button.dataset.action==='interact')window.alert('액션을 수행할 수 없습니다.\n'+e.message);}
});
$('testLoad').addEventListener('click',load);
$('testReset').addEventListener('click',()=>{
  if(!state)return;
  state=engine.reset(state);testStart=phaseStart=Date.now();
  if(window.MysteryStudy.currentView()==='book')window.MysteryStudy.navigate('book-toggle');
  else if(window.MysteryStudy.currentView()==='research')window.MysteryStudy.navigate('research-toggle');
  render();note('테스트 상태를 초기화했습니다. 편집 원고는 변경되지 않았습니다.');
});
$('testRole').addEventListener('change',event=>{try{roleTo(event.target.value)}catch(e){note(e.message,true)}});
$('testPhase').addEventListener('change',event=>{try{phaseTo(event.target.value)}catch(e){note(e.message,true)}});
$('testPrev').addEventListener('click',()=>{if(state){const i=engine.PHASES.indexOf(state.phase);if(i>0)phaseTo(engine.PHASES[i-1]);}});
$('testNext').addEventListener('click',()=>{if(state){const i=engine.PHASES.indexOf(state.phase);if(i<8)phaseTo(engine.PHASES[i+1]);}});
$('testPhaseRail').addEventListener('click',event=>{const btn=event.target.closest('[data-test-phase]');if(btn)phaseTo(btn.dataset.testPhase);});
$('testMeta').addEventListener('click',event=>{
  const btn=event.target.closest('[data-test-focus]');if(btn)roleTo(btn.dataset.testFocus);
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&window.MysteryStudy?.isModalOpen?.()){
    event.preventDefault();window.MysteryStudy.navigate('clue-close');render();return;
  }
  if(window.MysteryStudy?.isModalOpen?.())return;
  if(!state||event.altKey||event.metaKey||event.ctrlKey||
     ['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName)||event.target?.isContentEditable)return;
  const key=event.key.toLowerCase();
  if(key==='i'&&engine.PHASES.indexOf(state.phase)>=2){
    event.preventDefault();window.MysteryStudy.navigate('book-toggle');render();return;
  }
  if(key==='r'&&engine.PHASES.indexOf(state.phase)>=3){
    event.preventDefault();window.MysteryStudy.navigate('research-toggle');render();return;
  }
  const dir={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'}[key];
  if(dir&&window.MysteryStudy.currentView()==='map'){
    event.preventDefault();try{engine.move(state,dir);render()}catch(e){note(e.message,true)}
  }
});
setInterval(updateClock,1000);
library();
if(localStorage.getItem(key))load();
