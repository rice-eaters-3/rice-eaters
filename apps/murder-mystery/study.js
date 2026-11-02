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
      '<article class="folio"><div class="folio-top">BLACKWOOD MANOR · CONFIDENTIAL <span>'+String(n+1).padStart(2,'0')+' / '+all.length+'</span></div>'+
      '<div class="folio-content"><span class="eyebrow">CHAPTER '+String(current.chapter+1).padStart(2,'0')+'</span><h3>'+esc(names[current.chapter])+'</h3>'+current.html+'</div>'+
      '<div class="folio-bottom"><small>해당 장 '+within+' / '+total+'</small><div>'+btn2('book-prev','← 이전 장','',n===0)+' '+btn2('book-next','다음 장 →','',n===all.length-1)+'</div></div></article></div>';
  }
  function mapHtml(room){
    const m=room.map;if(!m)return '<p>제공된 맵이 없습니다.</p>';
    const people=new Map(),rooms=new Map((m.rooms||[]).map(t=>[t.x+','+t.y,t]));
    for(const a of m.avatars){const id=a.x+','+a.y;people.set(id,[...(people.get(id)||[]),a]);}
    const portals=new Map((m.portals||[]).map(t=>[t.x+','+t.y,t]));
    const research=new Map();
    for(const c of room.investigation?.cards||[])if(c.location?.floor===m.floorId){
      const k=c.location.x+','+c.location.y;research.set(k,[...(research.get(k)||[]),c]);
    }
    return '<div id="mapTiles" class="map-tiles world-tiles" style="--map-width:'+m.tiles[0].length+'" role="img" aria-label="'+esc(m.title)+'">'+
      m.tiles.flatMap((row,y)=>Array.from(row,(tile,x)=>{
        const k=x+','+y,loc=rooms.get(k),portal=portals.get(k),here=people.get(k)||[],cards=research.get(k)||[];
        return '<div class="map-tile '+(tile==='#'?'wall':'walk')+(portal?' portal':'')+(cards.length?' investigable':'')+'" title="'+esc(portal?.label||loc?.name||'')+'">'+
          (loc?'<span class="map-room-name">'+esc(loc.icon)+' '+esc(loc.name)+'</span>':'')+
          (portal?'<span class="portal-sigil" title="'+esc(portal.label)+'">⇅</span>':'')+
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
    return '<section class="surface panel-pad whisper-panel"><div class="eyebrow">VOICE · PRIVATE CONVERSATION</div><h3>밀담</h3>'+
      '<p class="muted small">'+(group?'현재 밀담 중: '+group.members.length+'명. 이 그룹의 음성은 외부인에게 전달되더라도 재생되지 않습니다.':'같은 타일의 사람들과 밀담을 시작하거나 기존 밀담 참여를 요청할 수 있습니다.')+'</p>'+
      (group?btn2('whisper-leave','밀담 나가기'):btn('whisper-request','밀담 요청','btn btn-outline btn-sm',!mates.length))+
      invites.map(p=>'<div class="whisper-invite"><span>'+(p.kind==='join'?'새 멤버 참여 요청':'밀담 시작 동의 요청')+' · '+p.yes.length+'/'+p.voters.length+'</span>'+
        (p.voters.includes(room.me)&&!p.yes.includes(room.me)?btn('whisper-yes','동의','btn btn-primary btn-sm',false,'data-proposal="'+esc(p.id)+'"')+
          btn('whisper-no','거절','btn btn-outline btn-sm',false,'data-proposal="'+esc(p.id)+'"'):'<small>상대방의 응답을 기다리는 중</small>')+'</div>').join('')+'</section>';
  }
  function tileActions(room){
    const inv=room.investigation,pos=room.players.find(p=>p.id===room.me)?.position;
    const here=inv?.cards.filter(c=>c.location?.floor===pos?.floor&&c.location?.x===pos?.x&&c.location?.y===pos?.y&&!c.locked&&!c.taken&&!c.excluded)||[];
    if(!inv)return '';
    return '<p class="muted small">이 타일의 조사 정보</p>'+
      (here.length?here.map(c=>btn('reserve','🔎 '+esc(c.title),'btn btn-outline btn-sm',
        (!!c.reservedBy&&c.reservedBy!==room.me)||inv.tokens<1,'data-card="'+esc(c.id)+'"')).join(''):
      '<span class="muted small">현재 타일에 조사할 카드가 없습니다.</span>');
  }
  function roster(room){
    const pos=room.players.find(p=>p.id===room.me)?.position;
    return (room.players||[]).map(p=>'<span class="roster-chip '+(p.position?.floor!==pos?.floor?'off-floor':'')+'">'+
      esc(p.name)+' · '+esc(p.position?.floor||'-')+' ('+(p.position?.x??'-')+','+(p.position?.y??'-')+')</span>').join('');
  }
  function mapView(room){
    const inv=room.investigation;
    return '<div class="adventure-grid"><section class="surface panel-pad adventure-main"><div class="adventure-heading"><div class="eyebrow">WORLD MAP · '+esc(room.map?.floorId||'')+'</div><h2>'+esc(room.map?.title||'공용 건물')+'</h2>'+
      '<p class="muted small">WASD / 방향키로 이동 · ⇅ 계단 타일로 층 이동 · 타일 최대 '+(room.map?.capacity||3)+'명</p></div>'+
      '<div class="map-scroller big-map" tabindex="0">'+mapHtml(room)+'</div>'+
      '<div class="map-controls"><div class="dpad"><span></span>'+btn2('move','↑','data-direction="up"')+'<span></span>'+
      btn2('move','←','data-direction="left"')+btn2('move','↓','data-direction="down"')+btn2('move','→','data-direction="right"')+'</div>'+
      '<div class="map-action-column">'+btn('book-toggle','📖 책자 확인 (I)','btn btn-outline')+
      '<div id="tileResearch">'+tileActions(room)+'</div>'+'</div></div>'+
      '<div class="map-roster" id="mapRoster">'+roster(room)+'</div></section>'+
      '<aside class="adventure-side"><section class="surface panel-pad"><div class="eyebrow">PERSONAL RESOURCES</div>'+
      '<h3>조사 토큰 <span class="token-count">'+(inv?inv.tokens:'—')+'</span></h3>'+
      (inv?'<p class="muted small">조사 카드 선택 → 조사 실행 시 토큰 1개가 소모됩니다.</p>':'<p class="muted small">1차 조사 단계에서 조사 토큰이 지급됩니다.</p>')+'</section>'+
      '<section class="surface panel-pad">'+(window.MysteryVoice?.controls()||'<p>음성 준비 중</p>')+'</section>'+whisper(room)+
      (room.phase==='study'?'<section class="surface panel-pad"><h3>캐릭터 숙지 확인</h3><p class="small">'+room.players.filter(p=>p.studyReady).length+' / '+room.players.length+'명 확인</p>'+
        btn('study-ready','숙지 완료 · 1차 조사 대기','btn btn-primary btn-wide',!!room.players.find(p=>p.id===room.me)?.studyReady)+'</section>':'')+
      (inv?'<section class="surface panel-pad research-sidebar"><div class="eyebrow">INVESTIGATION · 01</div><h3>조사 가능 정보</h3>'+
        '<p class="muted small">카드 앞면을 보고 선택한 다음 토큰을 소모해 뒷면을 확인하세요.</p>'+investigationCards(room)+'</section>':'')+
      '</aside></div>';
  }
  function render(room){
    return roomHeader(room)+
      '<div class="section-row"><div><div class="eyebrow">'+(room.phase==='study'?'CHAPTER 03 / ROLE STUDY':'CHAPTER 04 / INVESTIGATION')+'</div>'+
      '<h2>'+(room.phase==='study'?'캐릭터 숙지':'1차 조사')+'</h2></div><span class="tag">'+(room.phase==='study'?3:4)+' / 9 단계</span></div>'+
      '<div id="adventureRoot">'+(ui.view==='book'?book(room):mapView(room))+'</div>';
  }
  function patch(room){
    // Keep the active book page and focus while other players move.
    if(!document.getElementById('adventureRoot'))return false;
    if(ui.view==='book')return true;
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
    const ready=document.querySelector('[data-action="study-ready"]');
    if(ready)ready.disabled=!!room.players.find(p=>p.id===room.me)?.studyReady;
    return true;
  }
  function navigate(action,chapter){
    if(action==='book-toggle'){ui.view=ui.view==='map'?'book':'map';return true}
    const all=pages(window.MysteryRoomState?.room||{});
    if(action==='book-chapter'){const n=all.findIndex(p=>p.chapter===Number(chapter));if(n>=0)ui.page=n;return true}
    if(action==='book-prev'){ui.page=Math.max(0,ui.page-1);return true}
    if(action==='book-next'){ui.page=Math.min(all.length-1,ui.page+1);return true}
    return false;
  }
  const currentView=()=>ui.view;
  return {render,patch,navigate,currentView};
})();
