'use strict';
window.MysteryStage=(()=>{
  const esc=value=>escapeHtml(value);
  const phaseNames=['시놉시스','캐릭터 선택','캐릭터 숙지','1차 조사','1차 토론','2차 조사','2차 토론 · 최종 결정','행동','결말'];
  const phases=['synopsis','characters','study','investigation1','discussion1','investigation2','discussion2','action','ending'];
  const shortcuts={r:'research-toggle',c:'inventory-toggle',i:'book-toggle',e:'context-toggle',
    t:'whisper-toggle',p:'progress-toggle',m:'voice-mic',v:'voice-speaker'};
  let selected=null,castRoom=null,introKey=null;
  const phaseHelp={
    study:'I 키로 개인 책자를 열고 ← → 방향키로 책장을 넘기세요. 다 읽으면 P 키로 숙지 완료를 표시하세요.',
    investigation1:'E 키로 현재 칸의 단서를 찾고, R 키로 조사 목록을 여세요. 단서 뒷면을 확인할 때 토큰을 사용합니다.',
    discussion1:'C 키로 수집한 단서를 확인하고 참가자들과 첫 번째 추리를 나누세요. 준비되면 P 키에서 다음 단계에 동의하세요.',
    investigation2:'새로 열린 단서와 1차에서 놓친 단서를 조사하세요. E 키로 현재 칸을 확인할 수 있습니다.',
    discussion2:'수집한 단서를 대조해 진범을 결정하세요. P 키에서 최종 결정과 다음 단계 진행을 확인하세요.',
    action:'P 키로 행동 순서와 내 차례에 가능한 행동을 확인하세요.',
    ending:'공통 결말과 내 캐릭터의 목표 달성 여부를 확인하세요.'
  };
  const theme=room=>room.story?.artTheme||room.story?.id;
  const keyLabel=action=>Object.keys(shortcuts).find(key=>shortcuts[key]===action)?.toUpperCase();
  function button(action,label,disabled=false,extra=''){
    const key=keyLabel(action);
    return btn(action,label+(key?' <kbd>'+key+'</kbd>':''),'btn hud-button',disabled,extra);
  }
  function location(room){
    const player=room.players.find(p=>p.id===room.me),position=player?.position,map=room.map;
    const zone=position&&(map?.areas||[]).find(a=>position.x>=a.x&&position.x<a.x+a.width&&
      position.y>=a.y&&position.y<a.y+a.height);
    const namedTile=position&&map?.rooms?.find(r=>r.x===position.x&&r.y===position.y);
    const place=namedTile?.name||zone?.name||(position?'현재 칸 ('+position.x+', '+position.y+')':'');
    const direction=window.MysteryDirection;
    const [, ,arrow,name]=direction.directions[direction.facing(player?.facing)];
    return '<strong>'+esc(map?.title||room.story.title)+(place?' · '+esc(place):'')+'</strong>'+
      '<span class="scene-facing">'+arrow+' '+name+'을 바라보는 중</span>';
  }
  function status(room){
    const phase=phases.indexOf(room.phase);
    return '<b>'+esc(phaseNames[phase]||room.phase)+' <small>'+(phase+1)+' / '+phases.length+'</small></b>'+
      '<div class="hud-metrics"><span>진행 <strong data-hud-clock="total">00:00:00</strong></span>'+
      '<span>남은 시간 <strong data-hud-clock="remaining">--:--</strong></span>'+
      '<span>조사 토큰 <strong class="token-count">'+(room.investigation?.tokens??'—')+'</strong></span></div>';
  }
  function voices(room){
    const privateChannel=room.whispers?.groups?.some(g=>g.members.includes(room.me));
    const voice=window.MysteryVoice;
    const chips=room.players.filter(p=>p.characterId).map(p=>{
      const c=room.characters?.find(c=>c.id===p.characterId)||{name:p.name,symbol:'♟'};
      const state=voice?.status?.(p.id)||{audible:false,label:'미리보기'};
      const portrait=window.MysteryArt?.portrait(c,theme(room),true)||esc(c.symbol);
      return '<div class="speaker-chip'+(state.audible?'':' unavailable')+'" data-voice-player="'+esc(p.id)+'" title="'+esc(state.label)+'">'+
        '<div class="speaker-portrait">'+portrait+'</div><span>'+esc(c.name)+'</span><small class="speaker-state">'+esc(state.label)+'</small></div>';
    });
    return '<div class="hud-voice-title">'+(privateChannel?'밀담 채널 · 그룹 외 음소거':'근접 음성 · 초록 테두리 = 발화')+'</div>'+
      '<div class="speaker-list">'+chips.join('')+'</div><div class="hud-voice-buttons">'+
      button('voice-mic',voice?.setMicrophone?(voice.micOn?'● 마이크 켜짐':'○ 마이크 꺼짐'):'마이크 미리보기',!voice?.setMicrophone,'aria-pressed="'+!!voice?.micOn+'"')+
      button('voice-speaker',voice?.setSpeaker?(voice.speakerOn?'듣기 켜짐':'듣기 꺼짐'):'듣기 미리보기',!voice?.setSpeaker,'aria-pressed="'+!!voice?.speakerOn+'"')+'</div>';
  }
  function panel(title,content,closeAction='panel-close'){
    return '<section class="scene-panel" role="region" aria-label="'+esc(title)+'">'+
      '<header class="scene-panel-header"><h2>'+esc(title)+'</h2>'+btn(closeAction,'닫기 <kbd>Esc</kbd>','btn btn-outline btn-sm')+'</header>'+
      '<div class="scene-panel-body" tabindex="0">'+content+'</div></section>';
  }
  function dock(room,active){
    const invites=room.whispers?.proposals?.filter(p=>p.voters.includes(room.me)&&!p.yes.includes(room.me)).length||0;
    const pendingTurn=room.action?.currentActor?.id===room.me;
    const progress=room.progress;
    let progressLabel='단계 · 준비';
    if(pendingTurn)progressLabel='내 행동 차례';
    else if(progress?.total&&room.phase==='study')progressLabel='숙지 '+progress.ready+'/'+progress.total;
    const toggle=(tab,label)=>button(tab+'-toggle',label,false,'aria-pressed="'+(active===tab)+'"');
    return '<footer class="game-dock"><nav class="hud-actions" aria-label="게임 액션">'+
      button('research-toggle','조사 정보',!room.investigation)+button('inventory-toggle','보유 카드',!room.investigation)+
      button('book-toggle','책자')+toggle('context','주변 행동')+toggle('whisper',invites?'밀담 ('+invites+')':'밀담')+
      toggle('progress',progressLabel)+'</nav><section id="hudStatus" class="hud-status" aria-label="현재 게임 상황">'+
      status(room)+'</section><section class="hud-voice" aria-label="음성 참여자">'+voices(room)+'</section></footer>';
  }
  function casting(room,test=false){
    const cast=room.characters||[];
    if(castRoom!==room.code||!cast.some(c=>c.id===selected)){
      selected=room.players.find(p=>p.id===room.me)?.characterId||cast[0]?.id;
      castRoom=room.code;
    }
    const c=cast.find(c=>c.id===selected);
    if(!c)return '<p class="notice">선택 가능한 캐릭터가 없습니다.</p>';
    const owner=room.players.find(p=>p.characterId===c.id),mine=owner?.id===room.me;
    const portrait=window.MysteryArt?.portrait(c,theme(room))||esc(c.symbol);
    const map=room.castingMap;
    const background=map?window.MysteryStudy.mapHtml({...room,map:{...map,avatars:[]}}):
      '<div class="casting-backdrop">'+(window.MysteryArt?.cover(theme(room))||'')+'</div>';
    const roster=cast.map(x=>{
      const player=room.players.find(p=>p.characterId===x.id);
      const thumb=window.MysteryArt?.portrait(x,theme(room),true)||esc(x.symbol);
      return btn('cast-preview','<span class="cast-thumb">'+thumb+'</span><b>'+esc(x.name)+'</b><small>'+
        esc(player?player.name+' 선택':'선택 가능')+'</small>','cast-choice '+(x.id===selected?'selected':''),false,
        'data-character="'+esc(x.id)+'" aria-pressed="'+(x.id===selected)+'"');
    }).join('');
    const ready=room.players.filter(p=>p.characterId).length;
    return '<section class="casting-scene"><div class="casting-map scene-map big-map" aria-hidden="true">'+background+'</div>'+
      '<div class="casting-top"><b>'+esc(room.story.title)+'</b><span>캐릭터 선택 · ← → 탐색 · Enter 확정</span>'+
      button('progress-toggle',test?'단계 진행':'선택 '+ready+'/'+cast.length)+'</div>'+
      '<div class="casting-feature"><div class="casting-portrait">'+portrait+'</div><article class="casting-description">'+
      '<small>공개 인물 정보</small><h1>'+esc(c.name)+'</h1><h2>'+esc(c.role)+'</h2><p>'+esc(c.hint)+'</p>'+
      (c.startLine?'<blockquote>“'+esc(c.startLine)+'”</blockquote>':'')+
      '<p>'+esc(owner?(mine?'내가 선택한 인물':owner.name+'님이 선택한 인물'):'선택 가능한 인물')+'</p>'+
      btn(test?'test-role':'character',test?'이 인물 시점 선택':mine?'선택 완료':'이 인물로 확정 <kbd>Enter</kbd>',
        'btn btn-primary',!test&&!!owner,'data-character="'+esc(c.id)+'" data-role="'+esc(c.id)+'"')+'</article></div>'+
      '<nav class="casting-roster" aria-label="캐릭터 목록">'+roster+'</nav></section>';
  }
  function preview(id,room){
    const cast=room.characters;
    if(!cast?.length)return;
    const index=cast.findIndex(c=>c.id===selected);
    if(id==='next')selected=cast[(index+1)%cast.length].id;
    else if(id==='prev')selected=cast[(index+cast.length-1)%cast.length].id;
    else if(cast.some(c=>c.id===id))selected=id;
  }
  function tileDirection(target,room){
    const tile=target?.closest?.('.game-scene .map-tile');
    if(!tile||!room?.map)return null;
    const position=room.players.find(p=>p.id===room.me)?.position;
    if(!position)return null;
    const delta=[Number(tile.dataset.x)-position.x,Number(tile.dataset.y)-position.y].join(',');
    return {'0,-1':'up','0,1':'down','-1,0':'left','1,0':'right'}[delta]||null;
  }
  function turnAtBlockedTile(room,direction){
    const pos=room?.players.find(p=>p.id===room.me)?.position;
    if(!pos||!window.MysteryDirection.valid(direction))return false;
    const [dx,dy]=window.MysteryDirection.directions[direction];
    const target=document.querySelector('#mapTiles [data-x="'+(pos.x+dx)+'"][data-y="'+(pos.y+dy)+'"]');
    return !target||!!target.dataset.blocked;
  }
  function patchTiles(grid,next){
    // Keep the board and untouched tiles mounted when a player takes a step.
    const animated=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sprites=()=>Array.from(grid.querySelectorAll('[data-map-player]'));
    const before=new Map();
    if(animated)for(const sprite of sprites())before.set(sprite.dataset.mapPlayer,sprite.getBoundingClientRect());
    const oldTiles=Array.from(grid.children),newTiles=Array.from(next.children);
    if(oldTiles.length!==newTiles.length)grid.replaceChildren(...newTiles);
    else newTiles.forEach((tile,index)=>{
      if(!oldTiles[index].isEqualNode(tile))oldTiles[index].replaceWith(tile);
    });
    if(animated)for(const sprite of sprites()){
      const previous=before.get(sprite.dataset.mapPlayer);
      if(!previous)continue;
      const now=sprite.getBoundingClientRect(),x=previous.left-now.left,y=previous.top-now.top;
      if(Math.abs(x)<1&&Math.abs(y)<1)continue;
      sprite.animate([{translate:x+'px '+y+'px'},{translate:'0 0'}],{duration:140,easing:'ease-out'});
    }
  }
  function highlightPosition(grid){
    const marker=grid.querySelector('.map-sprite.mine');
    if(!marker)return;
    marker.tabIndex=-1;
    marker.focus({preventScroll:true});
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      marker.animate([{scale:1},{scale:1.32},{scale:1}],{duration:420,easing:'ease-out'});
  }
  function phaseIntro(room,phaseStartedAt){
    const key=room?[room.code,room.story.id,room.phase,phaseStartedAt??room.clock?.phaseStartedAt].join(':'):null;
    if(key===introKey)return;
    introKey=key;
    const previous=document.getElementById('phaseIntro');
    if(previous){previous.close();previous.remove();}
    const help=phaseHelp[room?.phase];
    if(!help)return;
    const dialog=document.createElement('dialog');
    dialog.id='phaseIntro';dialog.className='phase-intro';dialog.setAttribute('aria-labelledby','phaseIntroTitle');
    const phase=phases.indexOf(room.phase);
    dialog.innerHTML='<p>단계 '+(phase+1)+' / '+phases.length+'</p><h1 id="phaseIntroTitle">'+phaseNames[phase]+
      '</h1><p>'+help+'</p><form method="dialog"><button class="btn btn-outline" autofocus>계속하기</button></form>';
    document.body.append(dialog);dialog.showModal();
    const timer=setTimeout(()=>dialog.close(),5500);
    dialog.addEventListener('close',()=>{clearTimeout(timer);dialog.remove();},{once:true});
  }
  function confirmAction(room,action,body={}){
    const inv=room?.investigation;
    const card=inv?.myCards?.find(c=>c.id===body.holdingId);
    const title=card?'「'+card.title+'」':'이 조사 카드';
    const to=room?.players.find(p=>p.id===body.toId)?.name;
    let message;
    if(action==='clue-investigate'||action==='investigate')message='조사 토큰 1개를 사용해 카드 뒷면을 확인할까요?';
    if(action==='card-public')message=title+'을 모든 참가자에게 영구 공개할까요? 공개 후에는 취소할 수 없습니다.';
    if(action==='card-share'){
      if(!to)throw Error('공개할 참가자를 선택하세요.');
      message=title+'을 '+to+'님에게 선택 공개할까요? 같은 타일에 있는 동안만 보입니다.';
    }
    if(action==='exchange-offer'){
      if(!to)throw Error('받는 참가자를 선택하세요.');
      if(body.type==='token'&&(!Number.isInteger(body.amount)||body.amount<1||body.amount>(inv?.tokens??0)))
        throw Error('보유 토큰 안에서 양도할 수량을 입력하세요.');
      message=(body.type==='token'?'조사 토큰 '+body.amount+'개':title)+'를 '+to+'님에게 양도 제안할까요? 상대가 수락하면 이동합니다.';
    }
    if(action==='exchange-reply'&&body.accept){
      const offer=inv?.incomingOffers?.find(o=>o.id===body.offerId);
      if(!offer)throw Error('이 양도 제안은 더 이상 유효하지 않습니다.');
      message=offer.fromName+'님의 '+(offer.type==='token'?'조사 토큰 '+offer.amount+'개':offer.cardTitle||'카드')+' 양도를 수락할까요?';
    }
    return !message||window.confirm(message);
  }
  function mount(room,phaseStartedAt){
    phaseIntro(room,phaseStartedAt);
    const immersive=!!document.querySelector('.game-scene,.casting-scene');
    document.body.classList.toggle('immersive-game',immersive&&!document.body.classList.contains('studio-testing'));
    const roster=document.querySelector('.casting-roster'),selection=roster?.querySelector('.selected');
    if(selection)roster.scrollLeft=selection.offsetLeft-(roster.clientWidth-selection.offsetWidth)/2;
  }
  return {dock,panel,location,status,voices,confirmAction,casting,preview,mount,patchTiles,highlightPosition,shortcuts,tileDirection,turnAtBlockedTile};
})();
