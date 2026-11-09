'use strict';
// All confidential booklet/back text comes from authorized room API responses.
window.MysteryStudy=(function(){
  const esc=v=>escapeHtml(v);
  const ui={view:'map',dock:null,localPage:0,localTile:null,page:0,lastResearchSignature:null,modalCardId:null,modalHoldingId:null,modalSide:'front',tileSize:44};
  const names=['기본 정보','중요 정보','사건에 대한 정보','나의 소지품','범인 여부','승리 목표','기타 정보'];
  // Render multi-paragraph fiction as separate folio paragraphs while escaping
  // every fragment; never treat author-supplied scene prose as markup.
  const para=t=>String(t??'').split(/\n\s*\n/).filter(x=>x.trim())
    .map(x=>'<p>'+esc(x.trim())+'</p>').join('');
  const btn2=(act,label,extra='',disabled=false)=>btn(act,label,'btn btn-outline',disabled,extra);
  const portrait=(c,story,small=false)=>window.MysteryArt?.portrait(c,story,small)||'<span>'+esc(c.symbol||'♟')+'</span>';
  const art=(c,story)=>window.MysteryArt?.clue(c,story)||'<span>✧</span>';
  const theme=room=>room.story?.artTheme||room.story?.id;
  const page=(ch,html)=>({chapter:ch,html});
  function pages(room){
    const b=room.booklet;if(!b)return [];
    const result=[];
    result.push(page(0,'<div class="book-identity"><div class="book-portrait illustrated-portrait">'+portrait(b.basic,theme(room))+'</div><div><h4>'+esc(b.basic.name)+'</h4><p>'+esc(b.basic.role)+'</p>'+para(b.basic.hint)+'</div></div>'));
    (b.background||[]).forEach(t=>result.push(page(1,para(t))));
    if(b.notes)result.push(page(1,'<h4>연기 참고</h4>'+para(b.notes)));
    (b.timeline||[]).forEach(t=>result.push(page(2,'<div class="time-stamp">'+esc(t.time)+'</div><h4>'+esc(t.title)+'</h4>'+para(t.detail))));
    (b.inventory||[]).forEach(t=>result.push(page(3,'<div class="item-stamp">POSSESSION</div><div class="book-item-art">'+art({id:t.id,title:t.name,subtitle:t.description},theme(room))+'</div><h4>'+esc(t.name)+'</h4>'+para(t.description))));
    result.push(page(4,'<div class="verdict '+(b.culprit?'guilty':'innocent')+'"><span>나의 범인 여부</span><strong>'+(b.culprit?'당신은 범인입니다.':'당신은 범인이 아닙니다.')+'</strong></div>'));
    result.push(page(5,para(b.objectives)+'<p class="book-footnote">승점은 게임 종료 후 수동으로 판정합니다.</p>'));
    (b.shared?.synopsis||[]).forEach(t=>result.push(page(6,'<h4>공용 시놉시스</h4>'+para(t))));
    const chars=b.shared?.characters||[];
    for(let i=0;i<chars.length;i+=2)result.push(page(6,'<h4>등장인물의 공개 정보</h4>'+
      '<div class="book-cast-gallery">'+chars.slice(i,i+2).map(c=>
        '<div class="book-cast-person"><div class="book-cast-portrait">'+portrait(c,theme(room),true)+'</div>'+
        '<p><b>'+esc(c.name)+'</b><small>'+esc(c.role)+'</small>'+esc(c.hint)+'</p></div>').join('')+'</div>'));
    result.push(page(6,'<h4>건물 약도</h4><p>지도 화면에서 I 키 또는 「지도 돌아가기」를 누르면 건물의 구조와 플레이어 위치를 확인할 수 있습니다.</p>'));
    if(b.actionOrder){
      const abilityText=(b.actionAbilities||[]).map(a=>
        '<h4>'+esc(a.title)+'</h4>'+para(a.description)+
        '<p class="muted small">분류: '+esc(a.kind)+
        (a.requiresItem?' · 필요 아이템: '+esc(a.requiresItem):'')+
        (a.requiresCard?' · 필요 조사 카드: '+esc(a.requiresCard):'')+'</p>').join('');
      result.push(page(7,'<h4>나의 행동 순서: '+b.actionOrder+'번째</h4>'+
        (b.actionNotes?para(b.actionNotes):'')+
        '<p class="book-footnote">행동 단계에서 내 차례가 되면 아래 행동 중 하나를 선택할 수 있습니다. 일단 선택하면 되돌릴 수 없습니다.</p>'+
        (abilityText||'<p>캐릭터 고유 행동이 지정되지 않았습니다.</p>')));
    }

    return result;
  }
  function book(room,embedded=false){
    const all=pages(room),n=Math.max(0,Math.min(ui.page,all.length-1));ui.page=n;
    if(!all.length)return '<p>이 캐릭터의 책자가 없습니다.</p>';
    const current=all[n],within=all.slice(0,n+1).filter(p=>p.chapter===current.chapter).length,
      total=all.filter(p=>p.chapter===current.chapter).length;
    const chapters=room.booklet?.actionOrder?[...names,'행동 단계']:names;
    return (embedded?'':'<div class="book-top"><div><span class="eyebrow">PRIVATE DOSSIER · PERSONAL ONLY</span><h2>나의 캐릭터 책자</h2></div>'+btn2('book-toggle','✕ 책자 닫기')+'</div>')+
      '<div class="book-layout"><nav class="book-index" aria-label="책자 목차">'+chapters.map((name,i)=>
        '<button class="index-tab '+(current.chapter===i?'selected':'')+'" data-action="book-chapter" data-chapter="'+i+'">'+String(i+1).padStart(2,'0')+' · '+name+'</button>').join('')+'</nav>'+
      '<article class="folio"><div class="folio-top">'+esc(room.story?.title||'MYSTERY CASE')+' · CONFIDENTIAL <span>'+String(n+1).padStart(2,'0')+' / '+all.length+'</span></div>'+
      '<div class="folio-content"><span class="eyebrow">CHAPTER '+String(current.chapter+1).padStart(2,'0')+'</span><h3>'+esc(chapters[current.chapter])+'</h3>'+current.html+'</div>'+
      '<div class="folio-bottom"><small>해당 장 '+within+' / '+total+'</small><div>'+btn2('book-prev','← 이전 장','',n===0)+' '+btn2('book-next','다음 장 →','',n===all.length-1)+'</div></div></article></div>';
  }
  function mapHtml(room){
    const m=room.map;if(!m)return '<p>제공된 맵이 없습니다.</p>';
    const direction=window.MysteryDirection,me=room.players?.find(p=>p.id===room.me);
    const facing=direction?.facing(me?.facing);
    const people=new Map(),rooms=new Map((m.rooms||[]).map(t=>[t.x+','+t.y,t]));
    const props=new Map();
    for(const o of m.objects||[]){const k=o.x+','+o.y;props.set(k,[...(props.get(k)||[]),o]);}
    for(const a of m.avatars){const id=a.x+','+a.y;people.set(id,[...(people.get(id)||[]),a]);}
    const portals=new Map();
    for(const t of (m.portals||[])){const k=t.x+','+t.y;portals.set(k,[...(portals.get(k)||[]),t]);}
    const doors=new Map((m.doors||[]).map(d=>[d.x+','+d.y,d]));
    const regions=new Map();
    for(const a of m.areas||[])for(let y=a.y;y<a.y+a.height;y++)for(let x=a.x;x<a.x+a.width;x++)
      regions.set(x+','+y,a);
    const regionAt=(x,y)=>regions.get(x+','+y);
    const research=new Map();
    for(const c of room.investigation?.cards||[])if(c.location?.floor===m.floorId){
      const k=c.location.x+','+c.location.y;research.set(k,[...(research.get(k)||[]),c]);
    }
    return '<div id="mapTiles" class="map-tiles world-tiles" style="--map-width:'+m.tiles[0].length+';--map-height:'+m.tiles.length+';--manual-tile-size:'+ui.tileSize+'px" role="img" aria-label="'+esc(m.title)+'">'+
      m.tiles.flatMap((row,y)=>Array.from(row,(tile,x)=>{
        const k=x+','+y,loc=rooms.get(k),portalsHere=portals.get(k)||[],door=doors.get(k),region=regionAt(x,y),here=people.get(k)||[],cards=research.get(k)||[],furniture=props.get(k)||[];
        const mine=here.some(a=>a.id===room.me);
        const blocked=tile!=='.'?'벽':furniture.some(o=>o.solid)?'가구':door?.locked?'잠긴 문':door&&!door.open?'닫힌 문':here.filter(a=>a.id!==room.me).length>=(m.capacity||3)?'정원 초과':'';
        const edge=region?['n','e','s','w'].filter((dir,i)=>{
          const [dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][i];
          return regionAt(x+dx,y+dy)?.id!==region.id;
        }).map(v=>' edge-'+v).join(''):'';
        return '<div class="map-tile '+(tile==='#'?'wall':'walk')+(portalsHere.length?' portal':'')+(door?' door-tile':'')+
          (door?.locked?' door-locked':door&&!door.open?' door-closed':door?' door-open':'')+(region?' map-region pattern-'+esc(region.pattern):'')+
          (cards.length?' investigable':'')+(furniture.length?' furnished':'')+(blocked?' movement-blocked':'')+(mine?' current-position':'')+
          (ui.dock==='context'&&door&&me?.position&&direction?.isAhead(me.position,door,facing)?' door-ahead':'')+edge+'" style="'+(region?'--region-color:'+esc(region.color)+';':'')+
          '" data-x="'+x+'" data-y="'+y+'" data-blocked="'+esc(blocked)+'" title="'+esc((blocked?'이동 불가 · '+blocked+' — ':'')+(mine?'내 위치 — ':'')+(door?.name||portalsHere[0]?.label||furniture.map(o=>o.name).join(' · ')||loc?.name||region?.name||'')+' ('+x+', '+y+')')+'">'+
          (mine&&facing?'<span class="map-facing face-'+facing+'" aria-label="'+direction.directions[facing][3]+' 바라봄">'+direction.directions[facing][2]+'</span>':'')+
          (furniture.length?'<span class="map-prop" title="'+esc(furniture.map(o=>o.name).join(' · '))+'">'+
             furniture.map(o=>window.MysteryArt?.object(o,theme(room))||'<span>✧</span>').join('')+'</span>':'')+
           (portalsHere.length?'<span class="portal-sigil">'+(window.MysteryArt?.stairs(portalsHere[0],theme(room))||'⇅')+'</span>':'')+
          (door?'<span class="door-icon">'+(window.MysteryArt?.door(door,theme(room))||(door.locked?'🔒':door.open?'◫':'🚪'))+'</span>':'')+
          (cards.length?'<span class="tile-spark" title="조사 가능한 장소">✧</span>':'')+
          (here.length?'<div class="map-sprites">'+here.map(a=>'<span class="map-sprite '+(a.id===room.me?'mine':'')+'" data-map-player="'+esc(a.id)+'" style="--sprite:'+esc(a.accent)+'" title="'+esc(a.name)+'">'+
              (window.MysteryArt?.avatar(a,theme(room))||esc(a.symbol))+'</span>').join('')+'</div>':'')+
          '</div>';
      })).join('')+'</div>';
  }
  function clueStatus(room,c){
    const inv=room.investigation;
    if(c.sequenceLocked)return '순서 잠김 · '+esc(c.sequenceAfter||'이전 카드')+' 조사 후 열림';
    if(c.requiresPresence&&!c.atLocation&&!c.heldByMe&&!c.public)return '이 카드의 현장 타일로 이동해야 합니다';
    if(c.public)return '전체 공개';
    if(c.sharedToMe)return '선택 공개받음';
    if(c.heldByMe)return '내 보유 카드';
    if(c.personLimitReached)return '이번 조사 단계에서 이 인물의 소지품 1장 조사 완료';
    if(c.taken)return '다른 플레이어가 조사함';
    if(c.locked)return '선행 조건 또는 조사 단계 잠김';
    if(c.excluded)return '내 배역은 이 카드를 조사할 수 없습니다';
    if(c.reservedBy&&c.reservedBy!==room.me)return '다른 참가자가 선택 중';
    if(!inv?.canInvestigate)return '현재는 조사 단계가 아닙니다';
    if(inv.tokens<1)return '조사 토큰이 부족합니다';
    return '조사 가능 · 토큰 1개';
  }
  function canSpend(room,c){
    const inv=room.investigation;
    return !!(inv?.canInvestigate&&!c.locked&&!c.sequenceLocked&&!c.personLimitReached&&!c.taken&&!c.excluded&&
      (!c.reservedBy||c.reservedBy===room.me)&&inv.tokens>=1&&!c.heldByMe&&
      (!c.requiresPresence||c.atLocation));
  }
  function clueModal(room){
    const c=room.investigation?.cards.find(c=>c.id===ui.modalCardId);
    if(!c)return '';
    const readable=!!c.revealed?.length,back=readable&&ui.modalSide==='back';
    const holding=room.investigation.myCards?.find(h=>h.id===ui.modalHoldingId&&h.cardId===c.id);
    const safeId=esc(c.id);
    return '<div class="clue-modal-root" id="clueModalRoot">'+
      '<div class="clue-modal-shade" aria-hidden="true"></div>'+
      '<section class="clue-modal" role="dialog" aria-modal="true" aria-labelledby="clueModalTitle">'+
      '<div class="clue-modal-heading"><span class="eyebrow">INVESTIGATION · EVIDENCE</span>'+
      btn('clue-close','✕ 닫기','btn btn-quiet btn-sm')+'</div>'+
      '<div class="clue-modal-card '+(back?'show-back':'show-front')+'">'+
      (back?'<div class="research-back"><div class="research-illustration">'+art(c,theme(room))+'</div>'+
        '<h3 id="clueModalTitle">'+esc(c.title||'조사 정보')+'</h3>'+
        (c.subtitle?'<p>'+esc(c.subtitle)+'</p>':'')+
        c.revealed.map(a=>para(a.back)+(a.insight?'<div class="psychometry-insight">🔮 나에게만 보이는 감응 · '+esc(a.insight)+'</div>':'')).join('')+
        '</div>':
        '<div class="clue-modal-front"><div class="research-meta">MYSTERY · SEALED EVIDENCE</div>'+
        '<div class="research-seal" aria-hidden="true">✦</div>'+
        '<h3 id="clueModalTitle">'+esc(c.frontTitle||'조사 카드')+'</h3>'+
        '<p>뒷면은 이 카드의 정보 조회 권한이 있을 때만 볼 수 있습니다.</p></div>')+
      '</div><div class="clue-modal-footer">'+
      '<p class="muted small">'+clueStatus(room,c)+'</p>'+
      (readable?btn('clue-flip',back?'↶ 앞면 보기':'↷ 뒷면 보기','btn btn-outline btn-sm',false,
        'data-card="'+safeId+'"'):'')+
      (canSpend(room,c)?btn('clue-investigate','🪙 조사 토큰 1개 사용하기','btn btn-primary',false,
        'data-card="'+safeId+'"'):'')+
      '</div>'+(holding?holdingActions(room,holding):'')+'</section></div>';
  }
  function cardFront(room,card,holding){
    const title=card?.frontTitle||holding?.title||'조사 카드';
    const status=holding?(holding.public?'전체 공개':'내 보유 카드'):clueStatus(room,card);
    const data='data-card="'+esc(card?.id||holding.cardId)+'"'+(holding?' data-holding="'+esc(holding.id)+'"':'');
    return '<article class="research-card"><div class="research-frame">'+
      '<div class="research-meta">MYSTERY · SEALED EVIDENCE</div><div class="research-seal" aria-hidden="true">✦</div>'+
      '<h4>'+esc(title)+'</h4><span class="research-status">'+status+'</span>'+
      btn('clue-open',holding?'카드 열기':card.revealed?.length?'카드 보기 · 앞/뒷면':'카드 보기','btn btn-clue-view btn-sm',false,data)+
      '</div></article>';
  }
  function investigationCards(room){
    const data=room.investigation;if(!data)return '';
    return '<div class="research-grid">'+data.cards.map(c=>cardFront(room,c)).join('')+'</div>';
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
    const player=room.players.find(p=>p.id===room.me);
    const inv=room.investigation,pos=player?.position,m=room.map;
    if(!pos||!m)return '';
    const here=inv?.canInvestigate?inv.cards.filter(c=>c.location?.floor===pos.floor&&c.location?.x===pos.x&&
      c.location?.y===pos.y):[];
    const portals=(m.portals||[]).map((p,i)=>({...p,index:i})).filter(p=>p.x===pos.x&&p.y===pos.y);
    const direction=window.MysteryDirection,facing=direction.facing(player.facing);
    const doors=(m.doors||[]).filter(d=>direction.isAhead(pos,d,facing));
    const actions='<div class="context-actions">'+
      (portals.length?portals.map(p=>btn('interact','⇅ '+esc(p.label),'btn btn-primary btn-sm',false,'data-kind="portal" data-index="'+p.index+'"')).join(''):'')+
      (doors.length?doors.map(d=>btn('interact',(d.open?'🚪 '+esc(d.name)+' 닫기':
          d.locked?'🔑 '+esc(d.name)+' 잠금 해제하고 열기':'🚪 '+esc(d.name)+' 열기'),
          'btn btn-outline btn-sm',false,'data-kind="door" data-door="'+esc(d.id)+
          '" data-door-action="'+(d.open?'close':'open')+'"')).join(''):'')+
      (!portals.length&&!doors.length?'<small class="muted">바로 앞에 조작할 문이 없습니다.</small>':'')+'</div>';
    if(!inv?.canInvestigate)return actions;
    const tileKey=[pos.floor,pos.x,pos.y].join(':');
    if(ui.localTile!==tileKey){ui.localTile=tileKey;ui.localPage=0;}
    const available=here.filter(c=>canSpend(room,c)).length;
    const ordered=[...here].sort((a,b)=>Number(canSpend(room,b))-Number(canSpend(room,a)));
    const pageCount=Math.max(1,Math.ceil(ordered.length/2));
    ui.localPage=Math.min(ui.localPage,pageCount-1);
    const cards=ordered.slice(ui.localPage*2,ui.localPage*2+2).map(c=>
      btn('clue-open','<strong>'+esc(c.frontTitle||'조사 카드')+'</strong><small>'+clueStatus(room,c)+'</small>',
        'btn local-clue'+(canSpend(room,c)?' available':''),false,'data-card="'+esc(c.id)+'"')).join('');
    return actions+'<div class="local-clues"><b>이 칸의 단서 <small>조사 가능 '+available+' / '+here.length+'</small></b>'+
      (cards||'<p class="muted small">이 칸에 조사 카드가 없습니다.</p>')+
      (pageCount>1?'<nav class="local-clue-pages" aria-label="현장 카드 페이지">'+
        btn('local-page','이전','btn btn-outline btn-sm',ui.localPage===0,'data-chapter="-1"')+
        '<span>'+(ui.localPage+1)+' / '+pageCount+'</span>'+
        btn('local-page','다음','btn btn-outline btn-sm',ui.localPage>=pageCount-1,'data-chapter="1"')+'</nav>':'')+'</div>';
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
      '<div class="map-toolbar" aria-label="지도 보기 설정">'+btn2('map-zoom-out','− 축소')+'<output id="mapZoomLabel" aria-live="polite">'+Math.round(ui.tileSize/44*100)+'%</output>'+btn2('map-zoom-in','＋ 확대')+btn2('map-center','◎ 내 위치')+'</div>'+
      '<div class="map-legend"><span>진한 테두리 · 통행 불가</span><span>✧ 조사 장소</span></div>'+
      '<p class="muted small">지도가 화면보다 크면 좌우·위아래로 스크롤하세요. 진한 테두리의 칸은 이동할 수 없습니다.</p>'+
      '<div class="map-scroller big-map" tabindex="0" role="region" aria-label="스크롤 가능한 지도">'+mapHtml(room)+'</div>'+
      '<div class="map-controls"><div class="dpad"><span></span>'+btn2('move','↑','data-direction="up"')+'<span></span>'+
      btn2('move','←','data-direction="left"')+btn2('move','↓','data-direction="down"')+btn2('move','→','data-direction="right"')+'</div>'+
      '<div class="map-action-column">'+btn('book-toggle','📖 책자 확인 (I)','btn btn-outline')+
      (inv?btn('research-toggle','🗂 조사 가능 정보 확인 (R)','btn btn-primary'):'')+
      '<div id="tileResearch">'+tileActions(room)+'</div>'+'</div></div>'+
      '<div class="map-roster" id="mapRoster">'+roster(room)+'</div></section>'+
      '<aside class="adventure-side"><section class="surface panel-pad"><div class="eyebrow">PERSONAL RESOURCES</div>'+
      '<h3>조사 토큰 <span class="token-count">'+(inv?inv.tokens:'—')+'</span></h3>'+
      (inv?'<p class="muted small">조사 카드 팝업에서 토큰 1개를 사용하면 뒷면을 볼 수 있습니다. 인물별 소지품은 조사 단계마다 1장씩만 조사할 수 있습니다.</p>'+
        '<div class="collected-items">'+(inv.collected?.length?'<b>조사로 획득한 물품</b>'+
          inv.collected.map(item=>'<p>⌑ '+esc(item.name)+' · '+esc(item.description)+'</p>').join(''):'')+'</div>':
        '<p class="muted small">1차 조사 단계에서 조사 토큰이 지급됩니다.</p>')+'</section>'+
      whisper(room)+
      (room.phase==='study'?'<section class="surface panel-pad"><h3>캐릭터 숙지 확인</h3><p class="small">'+room.players.filter(p=>p.studyReady).length+' / '+room.players.length+'명 확인</p>'+
        btn('study-ready','숙지 완료 · 1차 조사 대기','btn btn-primary btn-wide',!!room.players.find(p=>p.id===room.me)?.studyReady)+'</section>':'')+
      '</aside></div>';
  }
  function holdingActions(room,card){
    const inv=room.investigation;
    if(!inv.canInvestigate)return '';
    const near=inv.nearby||[],id='data-holding="'+esc(card.id)+'"';
    const picker='<label>같은 칸의 참가자 <select data-share-target aria-label="같은 칸의 참가자">'+
      '<option value="">참가자 선택</option>'+near.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')+'</select></label>';
    return '<section class="holding-actions" data-holding-card="'+esc(card.id)+'" aria-label="보유 카드 행동">'+
      (card.public?'<p class="clue-public">전체 공개된 카드</p>':btn('card-public','전체 공개','btn btn-outline btn-sm',false,id))+
      (card.public&&!card.transferable?'':picker)+
      (!card.public?btn('card-share','선택 공개','btn btn-outline btn-sm',!near.length,id):'')+
      (card.transferable?btn('exchange-offer','카드 양도 제안','btn btn-outline btn-sm',!near.length,'data-exchange-type="card" '+id):'')+
      (card.sharedWith?.length?'<div class="holding-shares">'+card.sharedWith.map(p=>esc(p.name)+' '+
        btn('card-unshare','공개 취소','btn btn-quiet btn-sm',false,id+' data-target="'+esc(p.id)+'"')).join(' ')+'</div>':'')+'</section>';
  }
  function exchangeTools(room){
    const inv=room.investigation;if(!inv)return '';
    const active=inv.canInvestigate;
    const near=inv.nearby||[];
    const own=(inv.myCards||[]).map(holding=>cardFront(room,inv.cards.find(c=>c.id===holding.cardId),holding)).join('');
    const offers=(inv.incomingOffers||[]).map(o=>
      '<div class="exchange-offer"><b>'+esc(o.fromName)+'님의 '+(o.type==='card'?'카드 「'+esc(o.cardTitle||'조사 카드')+'」':
          '토큰 '+o.amount+'개')+' 양도 제안</b>'+
      (active?'<div>'+btn('exchange-reply','양도 수락','btn btn-primary btn-sm',false,
        'data-offer-id="'+esc(o.id)+'" data-accept="true"')+
      btn('exchange-reply','거절','btn btn-outline btn-sm',false,
        'data-offer-id="'+esc(o.id)+'" data-accept="false"')+'</div>':'')+'</div>').join('');
    const outgoing=(inv.outgoingOffers||[]).map(o=>
      '<div class="exchange-offer">⏳ '+esc(o.toName)+'님이 '+(o.type==='card'?'카드':'토큰 '+o.amount+'개')+
      ' 양도를 검토 중 '+
      (active?btn('exchange-cancel','제안 취소','btn btn-quiet btn-sm',false,
        'data-offer-id="'+esc(o.id)+'"'):'')+'</div>').join('');
    return '<section class="exchange-section">'+
      '<div class="exchange-heading"><div class="eyebrow">INVENTORY · CLUE OWNERSHIP</div><h3>내가 보유한 조사 카드 ('+(inv.myCards?.length||0)+'장)</h3>'+
      '<p class="muted small">소지한 카드만 공개·양도할 수 있어요. 전체 공개는 영구적이며, 선택 공개는 같은 타일에서만 유지됩니다.</p></div>'+
      '<div class="research-grid owned-card-grid">'+(own||'<p class="muted small">아직 보유한 조사 카드가 없습니다. 조사를 완료하면 여기에 표시됩니다.</p>')+'</div>'+
      (active?'<details class="token-trade"><summary>조사 토큰 양도</summary>'+
      '<p class="muted small">같은 타일 플레이어에게 제안한 뒤 상대가 수락하면 이동합니다.</p>'+
      '<div class="token-trade-controls"><label>받는 사람 <select id="tokenTransferTarget"><option value="">선택</option>'+
        near.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')+
        '</select></label><label>수량 <input id="tokenTransferAmount" type="number" min="1" max="'+Math.min(100,inv.tokens)+'" value="1"></label>'+
        btn('exchange-offer','토큰 양도 제안','btn btn-outline btn-sm',!near.length||inv.tokens<1,
          'data-exchange-type="token"')+'</div></details>':'')+
      ((offers||outgoing)?'<section class="exchange-requests"><h4>양도 요청</h4>'+offers+outgoing+'</section>':'')+
      '</section>';
  }
  function researchView(room,embedded=!!window.MysteryStage){
    const inv=room.investigation;
    if(!inv)return '<p>조사 정보가 아직 준비되지 않았습니다.</p>';
    ui.lastResearchSignature=JSON.stringify({inv,players:room.players.map(p=>({id:p.id,position:p.position}))});
    if(ui.inventory)return '<section class="research-screen inventory-only" id="investigationScreen">'+exchangeTools(room)+'</section>';
    const phase=room.phase==='investigation2'?'2차 조사':room.phase==='investigation1'?'1차 조사':'사건 기록';
    return '<section class="research-screen '+(ui.inventory?'inventory-only':'catalog-only')+'" id="investigationScreen">'+
      '<div class="research-toolbar"><div><div class="eyebrow">INVESTIGATION · CARD LIBRARY</div>'+
      '<h2>'+phase+' · 조사 가능 정보</h2>'+
      '<p class="muted small">'+(inv.canInvestigate?
        '카드 팝업에서 토큰을 사용해 조사하면 뒷면을 확인하고 공개·양도할 수 있습니다.':
        '조사 단계가 아닙니다. 기존에 공개된 정보와 보유 카드는 계속 확인할 수 있습니다.')+'</p></div>'+
      '<div class="research-switches">'+(embedded?'':btn('research-toggle','← 지도로 돌아가기 (R)','btn btn-outline'))+
      btn('book-toggle','📖 개인 책자 (I)','btn btn-outline')+'</div></div>'+
      '<div class="research-token-bar">내 조사 토큰 <strong id="researchTokens">'+inv.tokens+'</strong> · '+
      (inv.canInvestigate?'조사/양도 사용 가능':'다음 조사 단계까지 사용 대기')+'</div>'+
      (!embedded?exchangeTools(room):'')+
      '<section class="all-clue-cards"><h3>전체 조사 정보 목록</h3><p class="muted small">전체 공개한 카드의 뒷면은 모두에게 영구히 표시됩니다. 선택 공개한 정보는 같은 타일을 벗어나면 사라집니다.</p>'+
      investigationCards(room)+'</section></section>';
  }
  function actionStage(room){
    if(room.phase!=='action'&&room.phase!=='ending')return '';
    const a=room.action;
    if(!a)return '';
    const rows=(a.order||[]).map(o=>'<span class="action-order-chip '+(o.done?'complete':'')+'">'+
      o.index+'. '+esc(o.name)+(o.done?' ✓':'')+'</span>').join('');
    const logs=(a.log||[]).map(o=>'<div class="action-log-entry"><strong>'+
      esc(o.actor)+'</strong> · '+esc(o.text)+'</div>').join('');
    const choices=(a.myTurn&&!a.done?'<div class="action-options"><h4>나의 행동 선택</h4>'+
      '<p class="muted small">캐릭터 책자의 행동 순서와 능력을 확인하세요. 아이템·조사카드 조건은 서버가 검증합니다.</p>'+
      (a.abilities||[]).map(opt=>{
        const picker=['other','any'].includes(opt.targetMode)?
          '<select id="action-target-'+esc(opt.id)+'" aria-label="'+esc(opt.title)+' 대상 선택">'+
          '<option value="">대상 선택</option>'+
          (a.targets||[]).filter(t=>opt.targetMode==='any'||t.id!==room.me)
            .map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+(t.id===room.me?' (나)':'')+'</option>').join('')+
          '</select>':'';
        return '<div class="action-option"><div><strong>'+esc(opt.title)+'</strong>'+
          '<p>'+esc(opt.description)+'</p>'+
          (opt.requiresItem?'<small>필요 아이템: '+esc(opt.requiresItem)+'</small>':'')+
          (opt.requiresCard?'<small> · 필요 증거 카드: '+esc(opt.requiresCard)+'</small>':'')+
          '</div><div class="action-option-controls">'+picker+
          btn('act','행동 사용','btn btn-primary btn-sm',!opt.usable,
            'data-ability="'+esc(opt.id)+'"')+'</div></div>';
      }).join('')+btn('act','이번 차례 행동하지 않기','btn btn-outline',false,
        'data-ability="pass"')+'</div>':
      a.done?'<p class="muted small">모든 행동이 끝났습니다. 전원 동의 후 방장이 결말로 진행할 수 있습니다.</p>':
      '<p class="muted small">현재 행동할 캐릭터를 기다리고 있습니다.</p>');
    return '<section id="actionStageRoot" class="surface action-stage"><div class="eyebrow">PRIVATE ACTION PHASE</div>'+
      '<h3>행동 단계 · '+(a.done?'모두 완료':'순서 '+a.turn+' / '+a.total)+'</h3>'+
      '<p class="muted small">현재 차례: '+esc(a.currentActor?.name||'종료')+
      ' · 행동 결과는 서버에서 순서대로 판정됩니다.</p>'+
      '<div class="action-order">'+rows+'</div>'+
      choices+'<div class="action-log"><h4>행동 결과 기록</h4>'+
      (logs||'<p class="muted small">아직 실행된 행동이 없습니다.</p>')+'</div></section>';
  }

  function verdictPanel(room){
    const v=room.verdict;
    if(!v||!v.isHost)return '';
    const selected=v.arrestedCharacterId||'';
    const options='<option value="">아무도 구속하지 않음</option>'+
      (v.candidates||[]).map(c=>'<option value="'+esc(c.id)+'"'+
        (selected===c.id?' selected':'')+(c.dead?' disabled':'')+'>'+esc(c.name)+
        (c.dead?' · 사망':'')+'</option>').join('');
    const names=room.ending?.editor?.characters||[];
    const adjudications=room.phase==='ending'?
      '<h4>캐릭터별 목표 및 최종 상태 판정 (방장 전용)</h4><p class="muted small">목표는 증거와 행동 기록을 확인해 달성/실패로 판정합니다. 행동 결과가 잘못 반영된 경우 상태를 정정할 수 있습니다.</p>'+
      '<div class="ending-goal-grid">'+names.map(c=>
        '<div class="ending-goal-row"><b>'+esc(c.name)+'</b><span class="muted small">'+
         (c.dead?'사망 · ':'')+(c.restrained?'제압 · ':'')+(c.escaped?'탈출 · ':'')+
         (selected===c.id?'구속 · ':'')+'</span>'+
        '<select class="ending-goal-select" data-character="'+esc(c.id)+'" aria-label="'+esc(c.name)+' 목표 달성 상태">'+
        [['','미판정'],['yes','달성'],['no','실패']].map(([value,label])=>
         '<option value="'+value+'"'+((c.goalMet===true&&value==='yes')||
         (c.goalMet===false&&value==='no')||(c.goalMet==null&&value==='')?' selected':'')+'>'+label+'</option>').join('')+
        '</select>'+btn('verdict-goal','목표 저장','btn btn-outline btn-sm',false,
         'data-character="'+esc(c.id)+'"')+
        '<select class="ending-status-select" aria-label="'+esc(c.name)+' 최종 상태 정정">'+
          [['auto','행동 결과 그대로'],['alive','생존'],['dead','사망'],['restrained','제압'],['escaped','탈출']].map(([value,label])=>
            '<option value="'+value+'"'+((c.override||'auto')===value?' selected':'')+'>'+label+'</option>').join('')+
        '</select>'+btn('verdict-status','상태 저장','btn btn-outline btn-sm',false,
         'data-character="'+esc(c.id)+'"')+'</div>').join('')+'</div>':'';
    return '<section class="ending-control surface panel-pad"><div class="eyebrow">HOST CONTROL · FINAL VERDICT</div>'+
      '<h3>'+ (room.phase==='ending'?'최종 구속 및 승리 목표 판정':'최종 구속 대상 결정')+'</h3>'+
      '<p class="muted small">구속 대상을 지목하면 결말 단계에서 진범 여부에 따라 공통 이야기가 선택됩니다. 진범은 결말 단계까지 미공개입니다.</p>'+
      '<div class="ending-arrest-row"><select id="endingArrestTarget" aria-label="구속할 플레이어">'+options+'</select>'+
      btn('verdict-arrest','구속 대상 확정','btn btn-primary')+'</div>'+
      adjudications+'</section>';
  }
  function endingStage(room){
    const ending=room.ending;
    if(!ending)return '<section class="surface panel-pad"><h3>결말 확인 대기</h3><p>진행자가 결말 단계를 열면 결과가 표시됩니다.</p></section>';
    const global=ending.common,personal=ending.personal;
    const caseCover=window.MysteryArt?.cover(theme(room))||'';
    const statusName={dead:'사망',arrested:'구속',restrained:'제압',escaped:'탈출',alive:'생존'};
    return '<div class="ending-story">'+
      '<section class="ending-common surface panel-pad">'+
      '<div class="eyebrow">EPILOGUE · COMMON ENDING</div>'+
      '<div class="ending-cover">'+caseCover+'</div>'+
      '<p class="ending-verdict">'+(global.verdictType==='captured'?'진범 구속 성공':
        global.verdictType==='wrongful'?'오인 구속 · 진범 미검거':'진범 미구속')+
        ' · '+(global.arrestedName?esc(global.arrestedName)+' 구속':'구속된 인물 없음')+'</p>'+
      '<h2>'+esc(global.title)+'</h2>'+
      (global.paragraphs||[]).map(t=>para(t)).join('')+'</section>'+
      (personal?'<section class="ending-personal surface panel-pad">'+
        '<div class="eyebrow">PERSONAL EPILOGUE · YOUR OWN STORY</div>'+
        '<div class="ending-character"><div class="ending-portrait">'+portrait({
          id:personal.characterId,name:personal.name},theme(room))+'</div><div>'+
          '<h2>'+esc(personal.title)+'</h2><p>'+
          '<span class="ending-status">'+esc(statusName[personal.status]||personal.status)+'</span>'+
          '<span class="ending-status">'+(personal.goalMet===true?'개인 목표 달성':
            personal.goalMet===false?'개인 목표 실패':'개인 목표 미판정')+'</span></p></div></div>'+
        (personal.paragraphs||[]).map(t=>para(t)).join('')+
        (personal.goalMet==null?'<p class="muted small">개인 목표 결과는 아직 진행자가 판정하지 않았습니다. 결말 내용은 판정 후 자동으로 갱신됩니다.</p>':'')+
        (personal.goalText?'<details class="ending-objective"><summary>나의 원래 승리 목표 다시 보기</summary>'+para(personal.goalText)+'</details>':'')+
        '</section>':'')+'</div>';
  }
  function dockContent(room){
    if(ui.dock==='context')return tileActions(room);
    if(ui.dock==='whisper')return whisper(room);
    if(ui.dock==='progress')return (room.phase==='study'?
      btn('study-ready','숙지 완료','btn btn-primary btn-sm',!!room.players.find(p=>p.id===room.me)?.studyReady):'')+
      nextStageControl(room)+verdictPanel(room)+actionStage(room);
    return '';
  }
  function updateDock(room){
    const dock=document.getElementById('hudUtility');
    if(dock&&ui.dock){
      const content=dockContent(room);
      if(dock.dataset.content!==content){dock.innerHTML=content;dock.dataset.content=content;}
    }
  }
  function render(room){
    if(window.MysteryStage&&room.phase!=='ending'){
      const stage=window.MysteryStage;
      const overlay=ui.view==='book'?stage.panel('나의 캐릭터 책자',book(room,true)):
        ui.view==='research'?stage.panel(ui.inventory?'내 보유 카드':'조사 정보',researchView(room)):'';
      const titles={context:'주변 행동',whisper:'밀담',progress:'단계 · 준비'};
      const left=ui.dock?'<section class="left-utility '+(ui.dock==='context'?'context-utility':'')+'" aria-label="'+titles[ui.dock]+'">'+
        '<header><strong>'+titles[ui.dock]+'</strong>'+btn('panel-close','닫기','btn btn-quiet btn-sm')+'</header>'+
        '<div id="hudUtility" class="left-utility-body">'+dockContent(room)+'</div></section>':'';
      return '<section class="game-scene"><div class="scene-hint"><div id="sceneLocation">'+stage.location(room)+'</div>'+
        '<span class="scene-controls">WASD · 방향키 · 옆 칸 터치 · Shift + 방향키로 방향만 바꾸기</span>'+
        '<button type="button" data-action="map-center" class="btn btn-sm">내 위치</button></div>'+
        '<div class="map-play-area'+(left?' with-utility':'')+'">'+left+
        '<div id="adventureRoot" class="scene-map big-map" tabindex="0" aria-label="게임 지도">'+mapHtml(room)+'</div></div>'+
        stage.dock(room,ui.dock)+overlay+clueModal(room)+'</section>';
    }
    return roomHeader(room)+
      '<div class="section-row"><div><div class="eyebrow">MYSTERY PHASE · '+esc(room.phase.toUpperCase())+'</div>'+
      '<h2>'+esc(({study:'캐릭터 숙지',investigation1:'1차 조사',discussion1:'1차 토론',investigation2:'2차 조사',
        discussion2:'2차 토론·최종 결정',action:'행동',ending:'결말'})[room.phase]||room.phase)+
      '</h2></div><span class="tag">'+({study:3,investigation1:4,discussion1:5,investigation2:6,discussion2:7,action:8,ending:9}[room.phase]||3)+' / 9 단계</span></div>'+
      '<section class="voice-global surface panel-pad">'+(window.MysteryVoice?.controls()||'<p>음성 준비 중</p>')+'</section>'+
      verdictPanel(room)+
      (room.phase==='ending'?endingStage(room):actionStage(room)+
      '<div id="adventureRoot">'+(ui.view==='book'?book(room):ui.view==='research'?researchView(room):mapView(room))+'</div>'+clueModal(room));
  }
  function patch(room){
    const location=document.getElementById('sceneLocation');if(location)location.innerHTML=window.MysteryStage.location(room);
    const hud=document.getElementById('hudStatus');if(hud)hud.innerHTML=window.MysteryStage.status(room);
    if(window.MysteryStage)updateDock(room);
    // Keep the active book page and focus while other players move.
    if(!document.getElementById('adventureRoot'))return false;
    const modal=document.getElementById('clueModalRoot');
    if(modal){
      const html=clueModal(room),picker=modal.querySelector('[data-share-target]');
      const selection=picker?.value,scroll=modal.querySelector('.clue-modal')?.scrollTop;
      if(html){
        modal.outerHTML=html;
        const next=document.getElementById('clueModalRoot');
        const updated=next.querySelector('[data-share-target]');
        if(updated&&Array.from(updated.options).some(o=>o.value===selection))updated.value=selection;
        if(scroll)next.querySelector('.clue-modal').scrollTop=scroll;
      }else modal.remove();
    }
    if(room.phase==='action'||room.phase==='ending'){
      const root=document.getElementById('actionStageRoot');
      if(room.action&&root){
        const temporary=document.createElement('div');
        temporary.innerHTML=actionStage(room);
        const replacement=temporary.firstElementChild;
        if(replacement&&JSON.stringify(room.action)!==root.dataset.actionSignature){
          replacement.dataset.actionSignature=JSON.stringify(room.action);
          root.replaceWith(replacement);
        }
      }
    }
    if(ui.view==='book')return true;
    if(ui.view==='research'){
      const root=document.getElementById('investigationScreen');
      if(!root)return false;
      const signature=JSON.stringify({inv:room.investigation,
        players:room.players.map(p=>({id:p.id,position:p.position}))});
      if(signature===ui.lastResearchSignature)return true;
      const selected=Array.from(root.querySelectorAll('select')).map(n=>[n.id||n.closest('[data-holding-card]')?.dataset.holdingCard||'',n.value]);
      const amount=document.getElementById('tokenTransferAmount')?.value;
      const tokenFormOpen=root.querySelector('.token-trade')?.open;
      root.outerHTML=researchView(room);
      for(const [key,value] of selected){
        const n=key==='tokenTransferTarget'?document.getElementById(key):
          document.querySelector('[data-holding-card="'+key+'"] select[data-share-target]');
        if(n&&Array.from(n.options).some(o=>o.value===value))n.value=value;
      }
      const input=document.getElementById('tokenTransferAmount');
      if(input&&amount)input.value=amount;
      const tokenForm=document.querySelector('#investigationScreen .token-trade');
      if(tokenForm&&tokenFormOpen)tokenForm.open=true;
      return true;
    }
    const oldMap=document.getElementById('mapTiles'),oldCards=document.querySelector('.research-sidebar');
    if(!oldMap)return false;
    const temporary=document.createElement('div');temporary.innerHTML=mapHtml(room);
    const replacement=temporary.firstElementChild;
    if(replacement){
      if(window.MysteryStage&&oldMap.closest('.scene-map'))window.MysteryStage.patchTiles(oldMap,replacement);
      else oldMap.innerHTML=replacement.innerHTML;
      oldMap.style.cssText=replacement.style.cssText;
      oldMap.setAttribute('aria-label',room.map.title);
    }
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
  function navigate(action,chapter,holdingId){
    if(action==='local-page'){ui.localPage=Math.max(0,ui.localPage+Number(chapter));return true;}
    if(action==='panel-close'){if(ui.view!=='map')ui.view='map';else ui.dock=null;return true;}
    if(action==='dock-reset'){ui.view='map';ui.dock=null;return true;}
    if(['context-toggle','whisper-toggle','progress-toggle'].includes(action)){
      const tab=action.split('-')[0];ui.dock=ui.dock===tab?null:tab;ui.localPage=0;ui.view='map';return true;
    }
    if(action==='inventory-toggle'){ui.view=ui.view==='research'&&ui.inventory?'map':'research';ui.inventory=true;return true;}
    if(action.startsWith('map-')){
      const grid=document.getElementById('mapTiles');
      if(action==='map-center'&&grid?.closest('.scene-map')){
        window.MysteryStage.highlightPosition(grid);return true;
      }
      const scroller=grid?.closest('.map-scroller');
      if(!grid||!scroller)return true;
      if(action==='map-center'){
        const me=grid.querySelector('.current-position');
        if(me){const a=me.getBoundingClientRect(),b=scroller.getBoundingClientRect();scroller.scrollBy({left:a.left-b.left-(scroller.clientWidth-a.width)/2,top:a.top-b.top-(scroller.clientHeight-a.height)/2,behavior:'auto'});}
      }else if(['map-zoom-in','map-zoom-out'].includes(action)){
        const old=ui.tileSize;ui.tileSize=Math.max(32,Math.min(64,old+(action==='map-zoom-in'?4:-4)));
        const x=(scroller.scrollLeft+scroller.clientWidth/2)/(old+1),y=(scroller.scrollTop+scroller.clientHeight/2)/(old+1);
        grid.style.setProperty('--manual-tile-size',ui.tileSize+'px');scroller.scrollLeft=x*(ui.tileSize+1)-scroller.clientWidth/2;scroller.scrollTop=y*(ui.tileSize+1)-scroller.clientHeight/2;
        document.getElementById('mapZoomLabel').textContent=Math.round(ui.tileSize/44*100)+'%';
      }
      return true;
    }
    if(action==='clue-close'){ui.modalCardId=null;ui.modalHoldingId=null;ui.modalSide='front';return true;}
    if(action==='clue-open'){
      if(!window.MysteryRoomState?.room?.investigation?.cards.some(c=>c.id===chapter))return false;
      ui.modalCardId=chapter;ui.modalHoldingId=holdingId||null;ui.modalSide='front';return true;
    }
    if(action==='clue-flip'){
      const c=window.MysteryRoomState?.room?.investigation?.cards.find(c=>c.id===ui.modalCardId);
      if(c?.revealed?.length)ui.modalSide=ui.modalSide==='front'?'back':'front';return true;
    }
    if(action==='clue-revealed'){ui.modalSide='back';return true;}
    if(action==='book-toggle'){ui.view=ui.view==='book'?'map':'book';return true}
    if(action==='research-toggle'){
      if(window.MysteryRoomState?.room?.investigation)
        ui.view=ui.view==='research'&&!ui.inventory?'map':'research';
      ui.inventory=false;
      return true;
    }
    const all=pages(window.MysteryRoomState?.room||{});
    if(action==='book-chapter'){const n=all.findIndex(p=>p.chapter===Number(chapter));if(n>=0)ui.page=n;return true}
    if(action==='book-prev'){ui.page=Math.max(0,ui.page-1);return true}
    if(action==='book-next'){ui.page=Math.min(all.length-1,ui.page+1);return true}
    return false;
  }
  const currentView=()=>ui.view;
  const isModalOpen=()=>!!ui.modalCardId;
  return {render,patch,navigate,currentView,isModalOpen,mapHtml,activeDock:()=>ui.dock};
})();
