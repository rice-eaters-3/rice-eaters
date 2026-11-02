'use strict';
// Public presentation only. Confidential character material is delivered by the server,
// for the authenticated participant and only during the 'study' phase.
window.MysteryStudy=(function(){
  const esc=v=>escapeHtml(v);
  const section=(index,title,body)=>'<section class="book-section" id="book-'+index+'"><div class="book-number">CHAPTER '+String(index).padStart(2,'0')+'</div><h3>'+esc(title)+'</h3>'+body+'</section>';
  const paras=values=>(values||[]).map(x=>'<p>'+esc(x)+'</p>').join('');
  const characterCard=(ch)=>'<div class="shared-role"><span class="shared-role-symbol" style="--accent:'+esc(ch.accent)+'">'+esc(ch.symbol)+'</span><div><b>'+esc(ch.name)+'</b><span>'+esc(ch.role)+' · '+esc(ch.hint)+'</span></div></div>';
  function booklet(room){
    const b=room.booklet;
    if(!b)return '<div class="notice">개인 책자를 찾을 수 없습니다. 페이지를 새로고침하세요.</div>';
    const names=['기본 정보','중요 정보','사건에 대한 정보','나의 소지품','범인 여부','승리 목표','기타 정보'];
    const nav='<nav class="book-toc" aria-label="책자 목차">'+names.map((n,i)=>'<a href="#book-'+(i+1)+'"><span>'+String(i+1).padStart(2,'0')+'</span>'+n+'</a>').join('')+'</nav>';
    const basic='<div class="book-identity"><div class="book-portrait" style="--accent:'+esc(b.basic.accent)+'">'+esc(b.basic.symbol)+'</div><div><h4>'+esc(b.basic.name)+'</h4><div class="book-role">'+esc(b.basic.role)+'</div><p>'+esc(b.basic.hint)+'</p></div></div>';
    const timeline='<ol class="timeline">'+(b.timeline||[]).map(t=>'<li><div class="timeline-time">'+esc(t.time)+'</div><div class="timeline-content"><b>'+esc(t.title)+'</b><p>'+esc(t.detail)+'</p></div></li>').join('')+'</ol>';
    const items='<div class="item-grid">'+(b.inventory||[]).map(item=>'<article class="item-paper"><div class="item-stamp">EVIDENCE · '+esc(item.id).toUpperCase()+'</div><h4>⌑ '+esc(item.name)+'</h4><p>'+esc(item.description)+'</p></article>').join('')+'</div><p class="book-footnote">자신의 소지품은 조사 토큰을 소모하지 않고 확인할 수 있습니다. 다른 사람의 소지품 조사는 다음 페이즈에서 구현됩니다.</p>';
    const culprit='<div class="verdict '+(b.culprit?'guilty':'innocent')+'"><span>당신의 범인 여부</span><strong>'+(b.culprit?'당신은 이번 사건의 범인입니다.':'당신은 이번 사건의 범인이 아닙니다.')+'</strong></div>';
    const goals='<p>'+esc(b.objectives)+'</p><div class="book-footnote">승리 목표 및 점수는 게임 종료 후 수동 판정합니다.</div>';
    const shared='<h4>공동 시놉시스</h4>'+paras(b.shared?.synopsis)+
      '<h4>등장인물 공개 정보</h4><div class="shared-roles">'+(b.shared?.characters||[]).map(characterCard).join('')+'</div>'+
      '<h4>건물 약도</h4><p>'+ (room.map?'오른쪽 「공용 저택 약도」에서 움직임과 다른 참가자의 위치를 확인하세요. 이 책자에서는 약도의 내용만 공동 정보로 다룹니다.':'이 시나리오에는 건물 약도가 제공되지 않았습니다.') +'</p>';
    return '<div class="book-paper"><div class="book-cover"><div class="book-crest">♠</div><p class="book-overline">BLACKWOOD MANOR · PRIVATE CASEFILE</p><h2>당신의 이야기</h2><p>이 책자는 '+esc(b.basic.name)+' 역할을 맡은 플레이어만 열람할 수 있습니다.</p><div class="book-private">CONFIDENTIAL — 본인 외 열람 금지</div></div>'+
      nav+section(1,names[0],basic)+section(2,names[1],paras(b.background)+(b.notes?'<div class="personal-note"><b>역할 연기 참고</b><p>'+esc(b.notes)+'</p></div>':''))+
      section(3,names[2],timeline)+section(4,names[3],items)+section(5,names[4],culprit)+
      section(6,names[5],goals)+section(7,names[6],shared)+
      '<div class="book-end">— END OF PRIVATE CASE FILE —</div></div>';
  }
  function mapHtml(room){
    const map=room.map;
    if(!map)return '<div class="notice">이 사건에는 이동 가능한 건물 약도가 없습니다.</div>';
    const width=map.tiles[0].length,avatarsByCell=new Map();
    for(const p of map.avatars){
      const key=p.x+','+p.y;
      if(!avatarsByCell.has(key))avatarsByCell.set(key,[]);
      avatarsByCell.get(key).push(p);
    }
    const landmarks=new Map(map.rooms.map(loc=>[loc.x+','+loc.y,loc]));
    const tiles=map.tiles.flatMap((row,y)=>Array.from(row,(v,x)=>{
      const wall=v==='#',loc=landmarks.get(x+','+y),people=avatarsByCell.get(x+','+y)||[];
      const charIcons=people.map(p=>'<span class="map-sprite '+(p.id===room.me?'mine':'')+'" style="--sprite:'+esc(p.accent)+'" title="'+esc(p.name)+' · '+esc(p.characterName)+'" aria-label="'+esc(p.name)+' 위치">'+esc(p.symbol)+'</span>').join('');
      return '<div class="map-tile '+(wall?'wall':'walk')+(loc?' landmark':'')+'" title="'+esc(loc?.name||'')+'">'+
        (loc?'<span class="map-room-name">'+esc(loc.icon)+' '+esc(loc.name)+'</span>':'')+
        (people.length?'<div class="map-sprites">'+charIcons+'</div>':'')+'</div>';
    })).join('');
    return '<div id="mapTiles" class="map-tiles" role="img" aria-label="'+esc(map.title)+'" style="--map-width:'+width+'">'+tiles+'</div>';
  }
  function readyMarkup(room){
    return room.players.map(p=>'<div class="ready-item"><div><span class="ready-name">'+esc(p.name)+'</span><div class="player-sub">'+esc(room.characters.find(c=>c.id===p.characterId)?.name||'')+'</div></div>'+
      '<span class="'+(p.studyReady?'ready-yes':'ready-no')+'">'+(p.studyReady?'✓ 숙지 완료':'◷ 숙지 중')+'</span></div>').join('');
  }
  function roster(room){
    return room.map?.avatars.map(p=>'<div class="map-roster-row"><span class="roster-dot" style="background:'+esc(p.accent)+'"></span><b>'+esc(p.name)+'</b><span>'+esc(p.characterName)+'</span><code>('+p.x+','+p.y+')</code></div>').join('')||'';
  }
  function render(room){
    const readyCount=room.players.filter(p=>p.studyReady).length;
    const mine=room.players.find(p=>p.id===room.me);
    return roomHeader(room)+
      '<div class="section-row"><div><div class="eyebrow">CHAPTER 03 / CHARACTER DOSSIER</div><h2 style="margin-bottom:0">캐릭터 숙지</h2>'+
      '<p class="muted" style="margin:7px 0 0">내 비밀과 사건 당시 행적을 읽고 다음 조사에 대비하세요.</p></div><span class="tag">3 / 9 단계</span></div>'+
      '<div class="study-layout"><article class="book-container">'+booklet(room)+'</article>'+
      '<aside class="study-aside"><section class="surface panel-pad map-panel"><div class="eyebrow">LIVE FLOORPLAN</div><h2>공용 저택 약도</h2>'+
      '<p class="muted small">화살표 / WASD로 한 칸씩 이동합니다. 다른 참가자도 현재 위치를 확인할 수 있습니다.</p>'+
      '<div class="map-scroller" tabindex="0">'+mapHtml(room)+'</div>'+
      '<p class="map-hint">'+esc(room.map?.legend||'')+'</p>'+
      (room.map?'<div class="dpad" aria-label="이동 버튼">'+
        '<span></span>'+btn('move','↑','btn dpad-button',false,'data-direction="up" aria-label="위로 이동"')+'<span></span>'+
        btn('move','←','btn dpad-button',false,'data-direction="left" aria-label="왼쪽으로 이동"')+
        btn('move','↓','btn dpad-button',false,'data-direction="down" aria-label="아래로 이동"')+
        btn('move','→','btn dpad-button',false,'data-direction="right" aria-label="오른쪽으로 이동"')+
        '</div>':'')+
      '<div class="map-roster" id="mapRoster">'+roster(room)+'</div></section>'+
      '<section class="surface panel-pad study-ready-panel"><div class="eyebrow">READINESS CHECK</div><h2>숙지 확인</h2>'+
      '<div class="progress"><div class="progress-fill" id="studyProgress" style="width:'+(readyCount/room.story.players*100)+'%"></div></div>'+
      '<p class="small" id="studyCounter">'+readyCount+' / '+room.story.players+'명 완료</p>'+
      '<div class="ready-list" id="studyReadyList">'+readyMarkup(room)+'</div>'+
      btn('study-ready',mine?.studyReady?'내 책자 숙지 완료 ✓':'책자를 모두 읽었습니다 ✓','btn btn-primary btn-wide',!!mine?.studyReady,'id="studyReadyButton"')+
      '<p class="muted small" id="studyNext">'+(readyCount===room.story.players?'전원이 숙지를 완료했습니다. 다음 조사 단계는 추후 추가됩니다.':'모든 인원이 확인해도 이번 버전에서는 다음 페이즈로 자동 이동하지 않습니다.')+'</p></section></aside></div>';
  }
  function patch(room){
    const mapEl=document.getElementById('mapTiles');
    const ready=document.getElementById('studyReadyList');
    if(!ready)return false;
    if(room.map){
      const temp=document.createElement('div');
      temp.innerHTML=mapHtml(room);
      if(mapEl)mapEl.innerHTML=temp.firstElementChild.innerHTML;
      const rosterEl=document.getElementById('mapRoster');
      if(rosterEl)rosterEl.innerHTML=roster(room);
    }
    ready.innerHTML=readyMarkup(room);
    const count=room.players.filter(p=>p.studyReady).length;
    const progress=document.getElementById('studyProgress');
    if(progress)progress.style.width=(count/room.story.players*100)+'%';
    document.getElementById('studyCounter').textContent=count+' / '+room.story.players+'명 완료';
    const mine=room.players.find(p=>p.id===room.me);
    const button=document.getElementById('studyReadyButton');
    if(button){button.disabled=!!mine?.studyReady;button.textContent=mine?.studyReady?'내 책자 숙지 완료 ✓':'책자를 모두 읽었습니다 ✓'}
    const next=document.getElementById('studyNext');
    if(next&&count===room.story.players)next.textContent='전원이 숙지를 완료했습니다. 다음 조사 단계는 추후 추가됩니다.';
    return true;
  }
  return {render,patch};
})();
