'use strict';
const $=id=>document.getElementById(id);
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={stories:[],room:null,busy:false,stream:null,streamRoom:null,connection:'연결 중',name:localStorage.getItem('mystery_display_name')||''};
const phaseNames=['전체 시놉시스 안내','캐릭터 선택','캐릭터 숙지','1차 조사','1차 토론','2차 조사','2차 토론·최종 결정','행동','결말'];
function toast(message){
  const box=$('toast');box.textContent=message;box.classList.add('visible');
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.classList.remove('visible'),4200);
}
async function api(route,method='GET',payload){
  const options={method,credentials:'same-origin',headers:{}};
  if(payload!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(payload)}
  const response=await fetch(route,options);
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'서버에 연결할 수 없습니다.');
  return data;
}
function inviteUrl(code){return location.origin+'/mystery?room='+encodeURIComponent(code)}
function routeRoom(code){history.replaceState(null,'','/mystery?room='+code)}
function closeStream(){
  if(state.stream){state.stream.close();state.stream=null}
  state.streamRoom=null;
}
function connectStream(){
  if(!state.room?.me){closeStream();return}
  const code=state.room.code;
  if(state.stream&&state.streamRoom===code)return;
  closeStream();
  state.streamRoom=code;
  state.connection='연결 중';
  const events=new EventSource('/api/events?room='+encodeURIComponent(code));
  state.stream=events;
  events.addEventListener('state',event=>{
    if(state.stream!==events)return;
    const room=JSON.parse(event.data);
    state.room=room;state.connection='실시간 동기화 중';
    render();
  });
  events.onerror=()=>{
    if(state.stream!==events)return;
    state.connection='연결 재시도 중';
    render();
  };
}
function setRoom(room){
  state.room=room;
  if(room){routeRoom(room.code);connectStream()}
  else{closeStream();history.replaceState(null,'','/mystery')}
  render();
}
function btn(action,label,cls='btn',disabled=false,extra=''){
  return '<button type="button" class="'+cls+'" data-action="'+action+'" '+(disabled?'disabled ':'')+extra+'>'+label+'</button>';
}
function stepper(room){
  if(room.phase==='lobby')return '';
  const active=room.phase==='synopsis'?0:1;
  return '<div class="step-track" aria-label="게임 진행 단계">'+phaseNames.map((name,i)=>
    '<div class="step '+(i===active?'active':i<active?'done':'')+'" '+(i===active?'aria-current="step"':'')+'><strong>'+String(i+1).padStart(2,'0')+'</strong>'+escapeHtml(name)+'</div>'
  ).join('')+'</div>';
}
function storyTile(story){
  return '<div class="story-card"><div class="eyebrow">CASE FILE 001 · '+escapeHtml(story.genre)+'</div>'+
  '<h3 class="story-title">'+escapeHtml(story.title)+'</h3><p>'+escapeHtml(story.teaser)+'</p>'+
  '<div class="story-meta"><span>♟ '+story.players+'인 전용</span><span>◷ 약 '+story.minutes+'분</span><span>✦ 추리와 비밀</span></div></div>';
}
function home(){
  const story=state.stories[0];
  return '<section class="hero"><div><div class="eyebrow">A NIGHT OF SECRETS · MULTIPLAYER MYSTERY</div>'+
    '<h1>모든 비밀에는<br><span class="highlight">목격자</span>가 있다.</h1>'+
    '<p class="intro">한 방에 모인 네 사람, 서로 다른 기억, 단 하나의 진실. 방을 만들고 친구를 초대해 사건의 첫 장을 열어보세요.</p>'+
    '<span class="tag">실시간 방 동기화</span> <span class="tag">4인용 더미 시나리오</span></div>'+
    '<div class="hero-decor"><div class="orbit"></div><div class="emblem"><span class="emblem-symbol">♠</span><span class="emblem-caption">MURDER MYSTERY</span></div></div></section>'+
    '<div class="section-row"><div><div class="eyebrow">SELECT YOUR CASE</div><h2 style="margin-bottom:0">플레이할 이야기</h2></div><span class="muted small">현재 시나리오 1편 제공</span></div>'+
    '<div class="story-layout">'+(story?storyTile(story):'<p>시나리오를 불러오지 못했습니다.</p>')+
    '<section class="surface form-box"><h3 class="form-title">새로운 방 만들기</h3><p class="subheading">방장이 되어 친구를 초대하세요. 정원 4명이 모두 접속하면 게임을 시작할 수 있습니다.</p>'+
    '<div><label class="field-label" for="displayName">플레이어 표시 이름</label><input class="text-field" id="displayName" maxlength="18" autocomplete="nickname" placeholder="예: 탐정 김" value="'+escapeHtml(state.name)+'"></div>'+
    btn('create','사건의 방 만들기 →','btn btn-primary btn-wide',!story)+
    '<div class="line"></div><label class="field-label" for="roomCode">친구가 보낸 방 코드가 있나요?</label>'+
    '<input class="text-field" id="roomCode" autocomplete="off" maxlength="6" placeholder="6자리 방 코드" style="text-transform:uppercase">'+
    btn('find','코드로 참가하기','btn btn-outline btn-wide')+
    '</section></div>';
}
function roomHeader(room){
  return '<div class="room-header surface"><div><div class="eyebrow" style="margin:0 0 6px">CASE FILE 001 / '+(room.phase==='lobby'?'WAITING ROOM':room.phase==='synopsis'?'PROLOGUE':'CASTING')+'</div>'+
    '<h1>'+escapeHtml(room.story.title)+'</h1></div><div class="room-head-right"><div class="code-box"><small>ROOM CODE</small><strong>'+escapeHtml(room.code)+'</strong></div>'+
    btn('copy','초대 링크 복사','btn btn-outline btn-sm')+'</div></div>'+stepper(room);
}
function players(room){
  const filled=room.players.map((p,i)=>
    '<div class="player"><div class="player-avatar">'+escapeHtml(String(i+1).padStart(2,'0'))+'</div><div>'+
    '<div class="player-name">'+escapeHtml(p.name)+(p.id===room.hostId?' <span style="color:var(--gold);font-size:10px">HOST</span>':'')+(p.id===room.me?' <span style="color:#85c5ce;font-size:10px">YOU</span>':'')+'</div>'+
    '<div class="player-sub">'+(p.online?'● 접속 중':'○ 접속 대기')+'</div></div></div>'
  );
  while(filled.length<room.story.players){
    const i=filled.length+1;
    filled.push('<div class="player empty"><div class="player-avatar">'+String(i).padStart(2,'0')+'</div><div><div class="player-name">빈 자리</div><div class="player-sub">초대받을 플레이어를 기다리는 중</div></div></div>');
  }
  return filled.join('');
}
function lobby(room){
  const isHost=room.me===room.hostId,full=room.players.length===room.story.players;
  const allOnline=room.players.every(p=>p.online);
  return roomHeader(room)+
    '<div class="section-row"><div><div class="eyebrow">ASSEMBLING SUSPECTS</div><h2 style="margin-bottom:0">참가자 대기실</h2></div><span class="tag">'+room.players.length+' / '+room.story.players+'명 참가</span></div>'+
    '<div class="room-grid"><section class="surface panel-pad"><div class="section-head"><h2>참가자 명단</h2><span class="pill">● '+room.players.filter(p=>p.online).length+'명 온라인</span></div>'+
    '<div class="player-grid">'+players(room)+'</div>'+
    '<div class="line"></div><p class="muted small">방 코드를 공유하면 다른 브라우저나 기기에서도 이 방에 참가할 수 있습니다.</p></section>'+
    '<aside class="surface panel-pad"><div class="eyebrow">GAME SETUP</div><h2>'+escapeHtml(room.story.title)+'</h2>'+
    '<p class="muted">'+escapeHtml(room.story.teaser)+'</p>'+
    '<div class="notice"><strong>'+(isHost?'방장 권한':'참가 완료')+'</strong><p>'+
      (isHost?'네 명의 플레이어가 모두 모여 온라인 상태가 되면 게임 시작 버튼이 활성화됩니다.':'방장이 게임을 시작하면 모든 참가자에게 시놉시스가 표시됩니다.')+
      '</p></div><div class="action-stack">'+
      (isHost?btn('start',full&&allOnline?'게임 시작 · 시놉시스 열기 →':'전원 접속 대기 ('+room.players.filter(p=>p.online).length+'/'+room.story.players+')','btn btn-primary btn-wide',!full||!allOnline):'<div class="notice">방장의 시작 신호를 기다리고 있습니다.</div>')+
      btn('leave','대기실 나가기','btn btn-quiet btn-wide')+
    '</div></aside></div>';
}
function synopsis(room){
  const readCount=room.players.filter(p=>p.read).length,my=room.players.find(p=>p.id===room.me);
  return roomHeader(room)+
    '<div class="section-row"><div><div class="eyebrow">CHAPTER 01 / THE PROLOGUE</div><h2 style="margin-bottom:0">사건의 시작</h2></div><span class="tag">1 / 9 단계</span></div>'+
    '<div class="reading-layout"><article class="paper"><div class="stamp">CONFIDENTIAL · DO NOT LEAVE THIS ROOM</div>'+
    '<h2>'+escapeHtml(room.story.title)+'</h2>'+room.synopsis.map(p=>'<p>'+escapeHtml(p)+'</p>').join('')+
    '<div class="stamp" style="text-align:right;border:0;margin-top:30px">— END OF PROLOGUE —</div></article>'+
    '<aside class="surface panel-pad reading-sidebar"><div class="eyebrow">READING CONFIRMATION</div><h2>모두 읽으셨나요?</h2>'+
    '<p class="muted small">각 플레이어가 확인 버튼을 눌러야 캐릭터 선택으로 넘어갑니다. 상태는 모든 참가자에게 실시간으로 반영됩니다.</p>'+
    '<div class="progress" aria-label="읽음 진행률"><div class="progress-fill" style="width:'+Math.round(readCount/room.story.players*100)+'%"></div></div>'+
    '<p class="small">'+readCount+' / '+room.story.players+'명 확인 완료</p>'+
    '<div class="ready-list">'+room.players.map(p=>'<div class="ready-item"><span class="ready-name">'+escapeHtml(p.name)+'</span>'+
      '<span class="'+(p.read?'ready-yes':'ready-no')+'">'+(p.read?'✓ 읽음 완료':'◷ 읽는 중')+'</span></div>').join('')+'</div>'+
    btn('read',my?.read?'확인 완료 · 다른 플레이어 대기 중':'시놉시스를 모두 읽었습니다 ✓','btn btn-primary btn-wide',!!my?.read)+
    '</aside></div>';
}
function characters(room){
  const my=room.players.find(p=>p.id===room.me),taken=room.players.filter(p=>p.characterId).length;
  const allDone=taken===room.story.players;
  return roomHeader(room)+
  '<div class="section-row"><div><div class="eyebrow">CHAPTER 02 / CASTING</div><h2 style="margin-bottom:0">당신은 누구인가요?</h2>'+
  '<p class="muted" style="margin:6px 0 0">서로 다른 네 명의 등장인물. 한 명을 선택하세요. 선택은 서버에서 공유되며 중복 선택할 수 없습니다.</p></div><span class="tag">2 / 9 단계</span></div>'+
  '<div class="room-grid"><div class="character-grid">'+room.characters.map(c=>{
    const owner=room.players.find(p=>p.characterId===c.id);
    const mine=owner?.id===room.me;
    return '<article class="character-card '+(mine?'selected':owner?'taken':'')+'" style="--accent:'+escapeHtml(c.accent)+'">'+
    (mine?'<span class="chosen-label">내 캐릭터</span>':owner?'<span class="chosen-label">선택 완료</span>':'')+
    '<div class="char-symbol">'+escapeHtml(c.symbol)+'</div>'+
    '<h3 class="character-name">'+escapeHtml(c.name)+'</h3><div class="character-role">'+escapeHtml(c.role)+'</div>'+
    '<p class="char-hint">'+escapeHtml(c.hint)+'</p>'+
    btn('character',mine?'선택한 캐릭터입니다 ✓':owner?'이미 선택된 캐릭터':'이 캐릭터 선택','btn '+(mine?'btn-outline':'btn-primary'),!!owner,'data-character="'+escapeHtml(c.id)+'"')+
    '</article>';
  }).join('')+'</div>'+
  '<aside class="surface panel-pad"><div class="eyebrow">CHARACTER ASSIGNMENT</div><h2>배역 현황</h2>'+
  '<div class="ready-list">'+room.players.map(p=>{
    const c=room.characters.find(x=>x.id===p.characterId);
    return '<div class="ready-item"><div><span class="ready-name">'+escapeHtml(p.name)+'</span>'+
    '<div class="player-sub">'+(c?escapeHtml(c.name):'배역 미선택')+'</div></div>'+
    '<span class="'+(c?'ready-yes':'ready-no')+'">'+(c?'✓ 선택됨':'◷ 대기')+'</span></div>';
  }).join('')+'</div>'+
  '<div class="notice"><strong>'+taken+' / '+room.story.players+'명 선택 완료</strong><p>'+
    (my?.characterId?'선택한 캐릭터를 변경하려면 아직 비어 있는 다른 카드를 누르세요.':'카드를 선택하면 다른 참가자에게 즉시 반영됩니다.')+
    '</p></div><div class="line"></div>'+
  '<p class="muted small">이번 개발 범위는 캐릭터 선택까지입니다. 캐릭터 개인 정보 및 숙지 시간, 조사, 밀담과 추리 단계는 다음 버전에서 이어집니다.</p></aside></div>'+
  (allDone?'<div class="all-chosen"><div class="eyebrow">ALL ROLES ASSIGNED</div><h2>네 명의 배역이 모두 정해졌습니다.</h2><p class="muted">다음 업데이트에서는 캐릭터별 비밀 문서와 숙지 단계를 이어갑니다.</p></div>':'');
}
function preview(room){
  return roomHeader(room)+
  '<div class="surface join-panel"><div class="eyebrow">INVITATION RECEIVED</div><h2>'+escapeHtml(room.story.title)+'에 초대받았습니다.</h2>'+
  '<p class="muted">'+escapeHtml(room.story.teaser)+'</p>'+
  '<div class="notice">정원: '+room.players.length+' / '+room.story.players+'명 · '+(room.phase==='lobby'?'입장 대기 중':'이미 시작된 사건')+'</div>'+
  '<div class="line"></div><label for="displayName" class="field-label">플레이어 표시 이름</label>'+
  '<input class="text-field" id="displayName" maxlength="18" placeholder="이름을 입력해주세요" value="'+escapeHtml(state.name)+'">'+
  '<div class="action-stack">'+btn('join','이 방에 참가하기 →','btn btn-primary btn-wide',room.phase!=='lobby'||room.players.length>=room.story.players)+
  btn('back','다른 사건 보기','btn btn-quiet btn-wide')+'</div></div>';
}
function render(){
  const root=$('app'),room=state.room;
  if(!room){root.innerHTML=home();return}
  if(!room.me){root.innerHTML=preview(room);return}
  root.innerHTML='<div class="status-strip"><span>◉ '+escapeHtml(state.connection)+' · 참가자별 독립 세션</span><span>새로고침해도 방에 다시 연결됩니다.</span></div>'+
    (room.phase==='lobby'?lobby(room):room.phase==='synopsis'?synopsis(room):characters(room));
}
function nameFromInput(){
  const name=($('displayName')?.value||state.name).trim().slice(0,18);
  if(!name)throw Error('플레이어 표시 이름을 입력해주세요.');
  state.name=name;localStorage.setItem('mystery_display_name',name);
  return name;
}
async function perform(action,button){
  if(state.busy)return;
  state.busy=true;
  button.disabled=true;
  try{
    const room=state.room,code=room?.code;
    if(action==='create'){
      const name=nameFromInput();
      if(!state.stories[0])throw Error('스토리를 불러오지 못했습니다.');
      setRoom(await api('/api/rooms','POST',{storyId:state.stories[0].id,name}));
    } else if(action==='find'){
      const value=($('roomCode')?.value||'').trim().toUpperCase();
      if(!/^[A-HJ-NP-Z2-9]{6}$/.test(value))throw Error('6자리 영문/숫자 방 코드를 입력해주세요.');
      setRoom(await api('/api/rooms/'+value));
    } else if(action==='join'){
      setRoom(await api('/api/rooms/'+code+'/join','POST',{name:nameFromInput()}));
    } else if(action==='back'){
      setRoom(null);
    } else if(action==='leave'){
      await api('/api/rooms/'+code+'/leave','POST',{});
      setRoom(null);
    } else if(action==='start'||action==='read'){
      setRoom(await api('/api/rooms/'+code+'/'+action,'POST',{}));
    } else if(action==='character'){
      const characterId=button.dataset.character;
      setRoom(await api('/api/rooms/'+code+'/character','POST',{characterId}));
    } else if(action==='copy'){
      const address=inviteUrl(code);
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(address);toast('초대 링크를 복사했습니다.')}
      else window.prompt('다음 링크를 친구에게 전송해주세요.',address);
    }
  }catch(err){toast(err.message)}
  finally{state.busy=false;render()}
}
$('app').addEventListener('click',e=>{
  const button=e.target.closest('button[data-action]');
  if(button)perform(button.dataset.action,button);
});
$('app').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.id==='roomCode'){
    const button=$('app').querySelector('[data-action="find"]');
    if(button)perform('find',button);
  }
});
(async function init(){
  try{
    const catalog=await api('/api/stories');
    state.stories=catalog.stories;
    const initialCode=new URLSearchParams(location.search).get('room');
    if(initialCode){
      try{state.room=await api('/api/rooms/'+encodeURIComponent(initialCode.toUpperCase()))}
      catch(err){toast(err.message);history.replaceState(null,'','/mystery')}
    }
    render();connectStream();
  }catch(err){
    $('app').innerHTML='<div class="surface panel-pad"><h2>서버 연결 실패</h2><p class="muted">'+escapeHtml(err.message)+'</p><p>Node 서버가 실행 중인지 확인해주세요.</p></div>';
  }
})();
