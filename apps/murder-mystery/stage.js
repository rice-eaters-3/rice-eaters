'use strict';
window.MysteryStage=(()=>{
  const esc=value=>escapeHtml(value);
  const phaseNames=['시놉시스','캐릭터 선택','캐릭터 숙지','1차 조사','1차 토론','2차 조사','2차 토론 · 최종 결정','행동','결말'];
  const phases=['synopsis','characters','study','investigation1','discussion1','investigation2','discussion2','action','ending'];
  const shortcuts={r:'research-toggle',c:'inventory-toggle',i:'book-toggle',e:'context-toggle',
    t:'whisper-toggle',p:'progress-toggle',m:'voice-mic',v:'voice-speaker'};
  let selected=null,castRoom=null;
  const theme=room=>room.story?.artTheme||room.story?.id;
  const keyLabel=action=>Object.keys(shortcuts).find(key=>shortcuts[key]===action)?.toUpperCase();
  function button(action,label,disabled=false,extra=''){
    const key=keyLabel(action);
    return btn(action,label+(key?' <kbd>'+key+'</kbd>':''),'btn hud-button',disabled,extra);
  }
  function status(room){
    const position=room.players.find(p=>p.id===room.me)?.position,map=room.map;
    const zone=position&&(map?.areas||[]).find(a=>position.x>=a.x&&position.x<a.x+a.width&&
      position.y>=a.y&&position.y<a.y+a.height);
    const namedTile=position&&map?.rooms?.find(r=>r.x===position.x&&r.y===position.y);
    const place=namedTile?.name||zone?.name;
    const phase=phases.indexOf(room.phase);
    return '<div class="hud-location">'+esc(map?.title||room.story.title)+(place?' · '+esc(place):'')+'</div>'+
      '<b>'+esc(phaseNames[phase]||room.phase)+' <small>'+(phase+1)+' / '+phases.length+'</small></b>'+
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
      button('voice-mic','마이크',false,'aria-pressed="'+!!voice?.micOn+'"')+
      button('voice-speaker','듣기',false,'aria-pressed="'+!!voice?.speakerOn+'"')+'</div>';
  }
  function dock(room){
    const invites=room.whispers?.proposals?.filter(p=>p.voters.includes(room.me)&&!p.yes.includes(room.me)).length||0;
    const pendingTurn=room.action?.currentActor?.id===room.me;
    const progress=room.progress;
    let progressLabel='단계 · 준비';
    if(pendingTurn)progressLabel='내 행동 차례';
    else if(progress?.total&&room.phase==='study')progressLabel='숙지 '+progress.ready+'/'+progress.total;
    return '<footer class="game-dock"><nav class="hud-actions" aria-label="게임 액션">'+
      button('research-toggle','조사 정보',!room.investigation)+button('inventory-toggle','보유 카드',!room.investigation)+
      button('book-toggle','책자')+button('context-toggle','주변 행동')+button('whisper-toggle',invites?'밀담 ('+invites+')':'밀담')+
      button('progress-toggle',progressLabel)+'</nav><section id="hudStatus" class="hud-status" aria-label="현재 게임 상황">'+
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
    if(!tile||tile.dataset.blocked||!room?.map)return null;
    const position=room.players.find(p=>p.id===room.me)?.position;
    if(!position)return null;
    const delta=[Number(tile.dataset.x)-position.x,Number(tile.dataset.y)-position.y].join(',');
    return {'0,-1':'up','0,1':'down','-1,0':'left','1,0':'right'}[delta]||null;
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
  function mount(){
    const immersive=!!document.querySelector('.game-scene,.casting-scene');
    document.body.classList.toggle('immersive-game',immersive&&!document.body.classList.contains('studio-testing'));
    const roster=document.querySelector('.casting-roster'),selection=roster?.querySelector('.selected');
    if(selection)roster.scrollLeft=selection.offsetLeft-(roster.clientWidth-selection.offsetWidth)/2;
  }
  return {dock,status,voices,casting,preview,mount,patchTiles,highlightPosition,shortcuts,tileDirection};
})();
