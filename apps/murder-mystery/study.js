'use strict';
// All confidential booklet/back text comes from authorized room API responses.
window.MysteryStudy=(function(){
  const esc=v=>escapeHtml(v);
  const ui={view:'map',page:0,cardId:null,cardList:true};
  const names=['기본 정보','중요 정보','사건에 대한 정보','나의 소지품','범인 여부','승리 목표','기타 정보'];
  const para=t=>'<p>'+esc(t)+'</p>';
  const btn2=(act,label,extra='',disabled=false)=>btn(act,label,'btn btn-outline',disabled,extra);
  const page=(ch,html)=>({chapter:ch,html});
  function pages(room){
    const b=room.booklet;if(!b)return [];
    const result=[];
    result.push(page(0,'<div class="book-identity"><div class="book-portrait">'+esc(b.basic.symbol)+'</div><div><h4>'+esc(b.basic.name)+'</h4><p>'+esc(b.basic.role)+'</p>'+para(b.basic.hint)+'</div></div>'));
    (b.background||[]).forEach(t=>result.push(page(1,para(t))));
    if(b.notes)result.push(page(1,'<h4>연기 참고</h4>'+para(b.notes)));
    (b.timeline||[]).forEach(t=>result.push(page(2,'<div class="time-stamp">'+esc(t.time)+'</div><h4>'+esc(t.title)+'</h4>'+para(t.detail))));
    (b.inventory||[]).forEach(t=>result.push(page(3,'<div class="item-stamp">POSSESSION</div><h4>'+esc(t.name)+'</h4>'+para(t.description))));
    result.push(page(4,'<div class="verdict '+(b.culprit?'guilty':'innocent')+'"><span>나의 범인 여부</span><strong>'+(b.culprit?'당신은 범인입니다.':'당신은 범인이 아닙니다.')+'</strong></div>'));
    result.push(page(5,para(b.objectives)+'<p class="book-footnote">승점은 게임 종료 후 수동으로 판정합니다.</p>'));
    (b.shared?.synopsis||[]).forEach(t=>result.push(page(6,'<h4>공용 시놉시스</h4>'+para(t))));
    const chars=b.shared?.characters||[];
    for(let i=0;i<chars.length;i+=2)result.push(page(6,'<h4>등장인물의 공개 정보</h4>'+chars.slice(i,i+2).map(c=>'<p><b>'+esc(c.name)+'</b> — '+esc(c.role)+'<br>'+esc(c.hint)+'</p>').join('')));
    result.push(page(6,'<h4>건물 약도</h4><p>지도 화면에서 I 키 또는 「지도 돌아가기」를 누르면 건물의 구조와 플레이어 위치를 확인할 수 있습니다.</p>'));
    return result;
  }
  function book(room){
    const all=pages(room),n=Math.max(0,Math.min(ui.page,all.length-1));ui.page=n;
    if(!all.length)return '<p>이 캐릭터의 책자가 없습니다.</p>';
    const current=all[n],within=all.slice(0,n+1).filter(p=>p.chapter===current.chapter).length,
      total=all.filter(p=>p.chapter===current.chapter).length;
    return '<div class="book-top"><div><span class="eyebrow">PRIVATE DOSSIER · PERSONAL ONLY</span><h2>나의 캐릭터 책자</h2></div>'+btn2('book-toggle','✕ 책자 닫기')+'</div>'+
      '<div class="book-layout"><nav class="book-index" aria-label="책자 목차">'+names.map((name,i)=>
        '<button class="index-tab '+(current.chapter===i?'selected':'')+'" data-action="book-chapter" data-chapter="'+i+'">'+String(i+1).padStart(2,'0')+' · '+name+'</button>').join('')+'</nav>'+
      '<article class="folio"><div class="folio-top">'+esc(room.story?.title||'MYSTERY CASE')+' · CONFIDENTIAL <span>'+String(n+1).padStart(2,'0')+' / '+all.length+'</span></div>'+
      '<div class="folio-content"><span class="eyebrow">CHAPTER '+String(current.chapter+1).padStart(2,'0')+'</span><h3>'+esc(names[current.chapter])+'</h3>'+current.html+'</div>'+
      '<div class="folio-bottom"><small>해당 장 '+within+' / '+total+'</small><div>'+btn2('book-prev','← 이전 장','',n===0)+' '+btn2('book-next','다음 장 →','',n===all.length-1)+'</div></div></article></div>';
  }
  function mapHtml(room){
    const m=room.map;if(!m)return '<p>제공된 맵이 없습니다.</p>';
    const people=new Map(),rooms=new Map((m.rooms||[]).map(t=>[t.x+','+t.y,t]));
    for(const a of m.avatars){const id=a.x+','+a.y;people.set(id,[...(people.get(id)||[]),a]);}
    const portals=new Map();
    for(const t of (m.portals||[])){const k=t.x+','+t.y;portals.set(k,[...(portals.get(k)||[]),t]);}
    const doors=new Map((m.doors||[]).map(d=>[d.x+','+d.y,d]));
    const regions=new Map();
    for(const a of m.areas||[])for(let y=a.y;y<a.y+a.height;y++)for(let x=a.x;x<a.x+a.width;x++)
      regions.set(x+','+y,a);
    const regionAt=(x,y)=>regions.get(x+','+y);
    const zoneLabels=new Map();
    for(const a of m.areas||[]){
      const midX=Math.floor(a.x+a.width/2),midY=Math.floor(a.y+a.height/2);
      const candidates=[[midX,midY]];
      for(let yy=a.y;yy<a.y+a.height;yy++)for(let xx=a.x;xx<a.x+a.width;xx++)candidates.push([xx,yy]);
      const place=candidates.find(([xx,yy])=>m.tiles[yy]?.[xx]==='.'&&regionAt(xx,yy)?.id===a.id);
      if(place)zoneLabels.set(place[0]+','+place[1],a.name);
    }
    const research=new Map();
    for(const c of room.investigation?.cards||[])if(c.location?.floor===m.floorId){
      const k=c.location.x+','+c.location.y;research.set(k,[...(research.get(k)||[]),c]);
    }
    return '<div id="mapTiles" class="map-tiles world-tiles" style="--map-width:'+m.tiles[0].length+'" role="img" aria-label="'+esc(m.title)+'">'+
      m.tiles.flatMap((row,y)=>Array.from(row,(tile,x)=>{
        const k=x+','+y,loc=rooms.get(k),portalsHere=portals.get(k)||[],door=doors.get(k),region=regionAt(x,y),here=people.get(k)||[],cards=research.get(k)||[];
        const edge=region?['n','e','s','w'].filter((dir,i)=>{
          const [dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][i];
          return regionAt(x+dx,y+dy)?.id!==region.id;
        }).map(v=>' edge-'+v).join(''):'';
        return '<div class="map-tile '+(tile==='#'?'wall':'walk')+(portalsHere.length?' portal':'')+(door?' door-tile':'')+
          (door?.locked?' door-locked':door&&!door.open?' door-closed':door?' door-open':'')+(region?' map-region pattern-'+esc(region.pattern):'')+
          (cards.length?' investigable':'')+edge+'" style="'+(region?'--region-color:'+esc(region.color)+';':'')+
          '" title="'+esc(door?.name||portalsHere[0]?.label||loc?.name||region?.name||'')+'">'+
          (loc?'<span class="map-room-name">'+esc(loc.icon)+' '+esc(loc.name)+'</span>':
            zoneLabels.has(k)?'<span class="map-room-name region-name">'+esc(zoneLabels.get(k))+'</span>':'')+
          (portalsHere.length?'<span class="portal-sigil">⇅</span>':'')+
          (door?'<span class="door-icon">'+(door.locked?'🔒':door.open?'◫':'🚪')+'</span>':'')+
          (cards.length?'<span class="tile-spark" title="조사 가능한 장소">✧</span>':'')+
          (here.length?'<div class="map-sprites">'+here.map(a=>'<span class="map-sprite '+(a.id===room.me?'mine':'')+'" style="--sprite:'+esc(a.accent)+'" title="'+esc(a.name)+'">'+esc(a.symbol)+'</span>').join('')+'</div>':'')+
          '</div>';
      })).join('')+'</div>';
  }
  function investigationCards(room){
    const data=room.investigation;if(!data)return '';
    return '<div class="research-grid">'+data.cards.map(c=>{
      const locked=c.locked,held=c.reservedBy&&c.reservedBy!==room.me,mine=c.reservedBy===room.me;
      const status=c.taken?'조사 완료':locked?'잠김':c.excluded?'조사 불가':held?'다른 플레이어가 선택 중':mine?'내가 선택 중':'조사 가능';
      const unavailable=locked||c.taken||c.excluded||!!held||data.tokens<1;
      const flipped=c.revealed?.length>0;
      return '<article class="research-card '+(c.taken?'research-taken':'')+(locked?' research-locked':'')+'">'+
        '<div class="research-frame"><div class="research-meta">MYSTERY · '+esc(c.type.toUpperCase())+'</div><div class="research-emblem">'+(c.type==='belonging'?'♙':c.type==='information'?'♧':'⌂')+'</div>'+
        '<h4>'+esc(c.title)+'</h4><p>'+esc(c.subtitle)+'</p><span class="research-status">'+status+'</span>'+
        (flipped?'<div class="research-back"><b>조사한 카드의 뒷면</b>'+c.revealed.map(a=>para(a.back)).join('')+'</div>':'')+
        (mine?'<div class="research-buttons">'+btn('investigate','조사 실행 · 토큰 1개','btn btn-primary btn-sm')+btn2('release','취소')+'</div>':
          btn('reserve','카드 선택','btn btn-outline btn-sm',unavailable,'data-card="'+esc(c.id)+'"'))+
        '</div></article>';
    }).join('')+'</div>';
  }
  function whisper(room){
    const group=room.whispers?.groups.find(g=>g.members.includes(room.me));
    const invites=room.whispers?.proposals||[];
    const pos=room.players.find(p=>p.id===room.me)?.position;
    const mates=room.players.filter(p=>p.id!==room.me&&p.position?.floor===pos?.floor&&p.position?.x===pos?.x&&p.position?.y===pos?.y);
    return '<section id="whisperPanel" class="surface panel-pad whisper-panel"><div class="eyebrow">VOICE · PRIVATE CONVERSATION</div><h3>밀담</h3>'+
      '<p class="muted small">'+(group?'현재 밀담 중: '+group.members.length+'명. 이 그룹의 음성은 외부인에게 전달되더라도 재생되지 않습니다.':'같은 타일의 사람들과 밀담을 시작하거나 기존 밀담 참여를 요청할 수 있습니다.')+'</p>'+
      (group?btn2('whisper-leave','밀담 나가기'):btn('whisper-request','밀담 요청','btn btn-outline btn-sm',!mates.length))+
      invites.map(p=>'<div class="whisper-invite"><span>'+(p.kind==='join'?'새 멤버 참여 요청':'밀담 시작 동의 요청')+' · '+p.yes.length+'/'+p.voters.length+'</span>'+
        (p.voters.includes(room.me)&&!p.yes.includes(room.me)?btn('whisper-yes','동의','btn btn-primary btn-sm',false,'data-proposal="'+esc(p.id)+'"')+
          btn('whisper-no','거절','btn btn-outline btn-sm',false,'data-proposal="'+esc(p.id)+'"'):'<small>상대방의 응답을 기다리는 중</small>')+'</div>').join('')+'</section>';
  }
  function tileActions(room){
    const inv=room.investigation,pos=room.players.find(p=>p.id===room.me)?.position,m=room.map;
    if(!pos||!m)return '';
    const here=inv?.cards.filter(c=>c.location?.floor===pos.floor&&c.location?.x===pos.x&&c.location?.y===pos.y&&!c.locked&&!c.taken&&!c.excluded)||[];
    const portals=(m.portals||[]).map((p,i)=>({...p,index:i})).filter(p=>p.x===pos.x&&p.y===pos.y);
    const doors=(m.doors||[]).filter(d=>Math.abs(d.x-pos.x)+Math.abs(d.y-pos.y)<=1);
    return '<div class="context-actions"><b>⌁ 주변 상호작용</b>'+
      (portals.length?portals.map(p=>btn('interact','⇅ '+esc(p.label),'btn btn-primary btn-sm',false,'data-kind="portal" data-index="'+p.index+'"')).join(''):'')+
      (doors.length?doors.map(d=>btn('interact',(d.open?'🚪 '+esc(d.name)+' 닫기':
          d.locked?'🔑 '+esc(d.name)+' 잠금 해제하고 열기':'🚪 '+esc(d.name)+' 열기'),
          'btn btn-outline btn-sm',false,'data-kind="door" data-door="'+esc(d.id)+
          '" data-door-action="'+(d.open?'close':'open')+'"')).join(''):'')+
      (!portals.length&&!doors.length?'<small class="muted">현재 사용할 수 있는 이동·문 액션이 없습니다.</small>':'')+'</div>'+
      (inv?'<p class="muted small">이 타일의 조사 정보</p>'+
      (here.length?here.map(c=>btn('reserve','🔎 '+esc(c.title),'btn btn-outline btn-sm',
        (!!c.reservedBy&&c.reservedBy!==room.me)||inv.tokens<1,'data-card="'+esc(c.id)+'"')).join(''):
      '<span class="muted small">현재 타일에 조사할 카드가 없습니다.</span>'):'');
  }
  function roster(room){
    const pos=room.players.find(p=>p.id===room.me)?.position;
    return (room.players||[]).map(p=>'<span class="roster-chip '+(p.position?.floor!==pos?.floor?'off-floor':'')+'">'+
      esc(p.name)+' · '+esc(p.position?.floor||'-')+' ('+(p.position?.x??'-')+','+(p.position?.y??'-')+')</span>').join('');
  }
  function mapView(room){
    const inv=room.investigation;
    return '<div class="adventure-grid"><section class="surface panel-pad adventure-main"><div class="adventure-heading"><div class="eyebrow">WORLD MAP · '+esc(room.map?.floorId||'')+'</div><h2>'+esc(room.map?.title||'공용 건물')+'</h2>'+
      '<p class="muted small">WASD / 방향키 이동 · 계단 위에서 상호작용 버튼으로 층 이동 · 타일 최대 '+(room.map?.capacity||3)+'명</p></div>'+
      '<div class="map-scroller big-map" tabindex="0">'+mapHtml(room)+'</div>'+
      '<div class="map-controls"><div class="dpad"><span></span>'+btn2('move','↑','data-direction="up"')+'<span></span>'+
      btn2('move','←','data-direction="left"')+btn2('move','↓','data-direction="down"')+btn2('move','→','data-direction="right"')+'</div>'+
      '<div class="map-action-column">'+btn('book-toggle','📖 책자 확인 (I)','btn btn-outline')+
      (inv?btn('research-toggle','🗂 조사 가능 정보 확인 (R)','btn btn-primary'):'')+
      '<div id="tileResearch">'+tileActions(room)+'</div>'+'</div></div>'+
      '<div class="map-roster" id="mapRoster">'+roster(room)+'</div></section>'+
      '<aside class="adventure-side"><section class="surface panel-pad"><div class="eyebrow">PERSONAL RESOURCES</div>'+
      '<h3>조사 토큰 <span class="token-count">'+(inv?inv.tokens:'—')+'</span></h3>'+
      (inv?'<p class="muted small">조사 카드 선택 → 조사 실행 시 토큰 1개가 소모됩니다.</p>'+
        '<div class="collected-items">'+(inv.collected?.length?'<b>조사로 획득한 물품</b>'+
          inv.collected.map(item=>'<p>⌑ '+esc(item.name)+' · '+esc(item.description)+'</p>').join(''):'')+'</div>':
        '<p class="muted small">1차 조사 단계에서 조사 토큰이 지급됩니다.</p>')+'</section>'+
      whisper(room)+
      (room.phase==='study'?'<section class="surface panel-pad"><h3>캐릭터 숙지 확인</h3><p class="small">'+room.players.filter(p=>p.studyReady).length+' / '+room.players.length+'명 확인</p>'+
        btn('study-ready','숙지 완료 · 1차 조사 대기','btn btn-primary btn-wide',!!room.players.find(p=>p.id===room.me)?.studyReady)+'</section>':'')+
      '</aside></div>';
  }
  function researchView(room){
    const inv=room.investigation;
    if(!inv)return '<p>조사 단계에서 열람할 수 있습니다.</p>';
    return '<section class="research-screen" id="investigationScreen">'+
      '<div class="research-toolbar"><div><div class="eyebrow">INVESTIGATION · CARD LIBRARY</div>'+
      '<h2>조사 가능 정보</h2><p class="muted small">카드를 선택해 선점한 뒤 조사 토큰 1개를 소모하면 본인에게만 뒷면을 공개합니다.</p></div>'+
      '<div class="research-switches">'+btn('research-toggle','← 지도로 돌아가기 (R)','btn btn-outline')+
      btn('book-toggle','📖 개인 책자 (I)','btn btn-outline')+'</div></div>'+
      '<div class="research-token-bar">내 조사 토큰 <strong id="researchTokens">'+inv.tokens+'</strong> / '+inv.totalTokens+'</div>'+
      investigationCards(room)+'</section>';
  }
  function render(room){
    return roomHeader(room)+
      '<div class="section-row"><div><div class="eyebrow">'+(room.phase==='study'?'CHAPTER 03 / ROLE STUDY':'CHAPTER 04 / INVESTIGATION')+'</div>'+
      '<h2>'+(room.phase==='study'?'캐릭터 숙지':'1차 조사')+'</h2></div><span class="tag">'+(room.phase==='study'?3:4)+' / 9 단계</span></div>'+
      '<section class="voice-global surface panel-pad">'+(window.MysteryVoice?.controls()||'<p>음성 준비 중</p>')+'</section>'+
      '<div id="adventureRoot">'+(ui.view==='book'?book(room):ui.view==='research'?researchView(room):mapView(room))+'</div>';
  }
  function patch(room){
    // Keep the active book page and focus while other players move.
    if(!document.getElementById('adventureRoot'))return false;
    if(ui.view==='book')return true;
    if(ui.view==='research'){
      const grid=document.querySelector('#investigationScreen .research-grid');
      if(!grid)return false;
      const tmp=document.createElement('div');tmp.innerHTML=investigationCards(room);
      if(tmp.firstElementChild)grid.innerHTML=tmp.firstElementChild.innerHTML;
      const token=document.getElementById('researchTokens');
      if(token)token.textContent=room.investigation?.tokens??'0';
      return true;
    }
    const oldMap=document.getElementById('mapTiles'),oldCards=document.querySelector('.research-sidebar');
    if(!oldMap)return false;
    const temporary=document.createElement('div');temporary.innerHTML=mapHtml(room);
    if(temporary.firstElementChild)oldMap.innerHTML=temporary.firstElementChild.innerHTML;
    if(oldCards){const wrapper=document.createElement('div');wrapper.innerHTML=investigationCards(room);
      const present=oldCards.querySelector('.research-grid');
      if(present&&wrapper.firstElementChild)present.replaceWith(wrapper.firstElementChild);
    }
    // Re-render controls only when status changes, preserving map scroll when possible.
    const tile=document.getElementById('tileResearch');
    if(tile)tile.innerHTML=tileActions(room);
    const rosterEl=document.getElementById('mapRoster');
    if(rosterEl)rosterEl.innerHTML=roster(room);
    const text=document.querySelector('.token-count');
    if(text)text.textContent=room.investigation?.tokens??'—';
    const inventory=document.querySelector('.collected-items');
    if(inventory)inventory.innerHTML=(room.investigation?.collected?.length?'<b>조사로 획득한 물품</b>':'')+
      (room.investigation?.collected||[]).map(item=>'<p>⌑ '+esc(item.name)+' · '+esc(item.description)+'</p>').join('');
    const whisperRoot=document.getElementById('whisperPanel');
    if(whisperRoot){const tmp=document.createElement('div');tmp.innerHTML=whisper(room);
      if(tmp.firstElementChild)whisperRoot.replaceWith(tmp.firstElementChild);}
    const ready=document.querySelector('[data-action="study-ready"]');
    if(ready)ready.disabled=!!room.players.find(p=>p.id===room.me)?.studyReady;
    return true;
  }
  function navigate(action,chapter){
    if(action==='book-toggle'){ui.view=ui.view==='book'?'map':'book';return true}
    if(action==='research-toggle'){
      if(window.MysteryRoomState?.room?.phase==='investigation1')
        ui.view=ui.view==='research'?'map':'research';
      return true;
    }
    const all=pages(window.MysteryRoomState?.room||{});
    if(action==='book-chapter'){const n=all.findIndex(p=>p.chapter===Number(chapter));if(n>=0)ui.page=n;return true}
    if(action==='book-prev'){ui.page=Math.max(0,ui.page-1);return true}
    if(action==='book-next'){ui.page=Math.min(all.length-1,ui.page+1);return true}
    return false;
  }
  const currentView=()=>ui.view;
  return {render,patch,navigate,currentView};
})();
