'use strict';
// Isolated in-browser test run for mystery scenario authors.
// Never writes to room APIs or the scenario JSON. This module has no network I/O.
(function(root,factory){
  const Ending=root?.MysteryEnding||
    (typeof require==='function'?require('./ending-engine.js'):null);
  const ClueFront=root?.MysteryClueFront||
    (typeof require==='function'?require('./clue-front.js'):null);
  const Direction=root?.MysteryDirection||(typeof require==='function'?require('./map-direction.js'):null);
  const api=factory(Ending,ClueFront,Direction);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.MysteryTestEngine=api;
})(typeof window!=='undefined'?window:null,function(Ending,ClueFront,Direction){
  const PHASES=['synopsis','characters','study','investigation1','discussion1','investigation2','discussion2','action','ending'];
  const PHASE_NAMES=['시놉시스','캐릭터 선택','캐릭터 숙지','1차 조사','1차 토론','2차 조사','2차 토론·최종 결정','행동 단계','결말'];
  const deep=value=>JSON.parse(JSON.stringify(value));
  const error=message=>{throw Error(message)};
  const id=role=>'test_'+role;
  const playPhases=PHASES.slice(2),investigationPhases=['investigation1','investigation2'];
  const afterFirst=PHASES.slice(3);
  const roleOf=(state,rid)=>state.pkg.story.characters.find(c=>c.id===rid);
  const floorOf=(state,where)=>state.pkg.game.floors.find(f=>f.id===where.floor);
  const player=state=>roleOf(state,state.roleId);
  const position=state=>state.positions[state.roleId];
  const cards=state=>state.pkg.game.investigation?.cards||[];
  const near=(state,other)=>{const a=position(state),b=state.positions[other];return !!(a&&b&&a.floor===b.floor&&a.x===b.x&&a.y===b.y)};
  const stateError=s=>{if(!s.pkg.story.characters.length)error('캐릭터 정보가 없습니다.');};
  function create(pkg){
    if(pkg?.format!=='rice-mystery-v1'||!Array.isArray(pkg?.story?.characters)||!pkg.story.characters.length||
      !Array.isArray(pkg?.game?.floors)||!pkg.game.floors.length)error('지원되는 시나리오 JSON이 아닙니다.');
    const normalized=deep(pkg),cast=normalized.story.characters;
    const positions=Object.fromEntries(cast.map(c=>{
      const starting=normalized.spawn?.[c.id]||normalized.game.spawn?.[c.id]||{floor:normalized.game.floors[0].id,x:1,y:1};
      return [c.id,deep(starting)];
    }));
    const state={pkg:normalized,phase:'synopsis',roleId:cast[0].id,positions,facings:{},
      selected:{},tokens:Object.fromEntries(cast.map(c=>[c.id,0])),granted:{},discovered:{},
      holdings:[],collected:{},publicCards:{},selectiveShares:[],offers:[],reservations:{},
      doorStates:{},action:null,verdict:{arrestedCharacterId:null,goals:{}},statusOverrides:{},serial:1,notes:[],studyReady:{}};
    stateError(state);return state;
  }
  const phaseIndex=phase=>PHASES.indexOf(phase);
  function switchRole(state,roleId){
    if(!roleOf(state,roleId))error('해당 캐릭터가 없습니다.');
    state.roleId=roleId;return state;
  }
  function switchPhase(state,phase){
    if(!PHASES.includes(phase))error('지원하지 않는 게임 단계입니다.');
    state.phase=phase;
    for(const p of investigationPhases)if(phaseIndex(phase)>=phaseIndex(p)&&!state.granted[p]){
      for(const c of state.pkg.story.characters)state.tokens[c.id]+=
        p==='investigation1'?Number(state.pkg.game.investigation?.tokensPerPlayer||4):
          Number(state.pkg.game.investigation?.tokensPerSecondInvestigation??4);
      state.granted[p]=true;
    }
    if(!investigationPhases.includes(phase))state.reservations={};
    if(!investigationPhases.includes(phase))state.selectiveShares=[];
    if(phase==='action'&&!state.action)initActions(state);
    return state;
  }
  function reset(state){return create(state.pkg)}
  const doorKey=(floorId,doorId)=>floorId+':'+doorId;
  function doorView(state,f,door){
    const status=state.doorStates[doorKey(f.id,door.id)];
    return {locked:!!door.locked&&!status?.unlocked,
      open:status?.open??(door.closed===false&&!door.locked)};
  }
  function occupied(state,spot,exclude){
    return Object.entries(state.positions).filter(([role,p])=>role!==exclude&&
      p.floor===spot.floor&&p.x===spot.x&&p.y===spot.y).length;
  }
  function canEnter(state,next,exclude){
    const floor=floorOf(state,next);
    if(!floor||floor.tiles[next.y]?.[next.x]!=='.')error('벽이나 지도 밖으로 이동할 수 없습니다.');
    if((floor.objects||[]).some(o=>o.solid&&o.x===next.x&&o.y===next.y))error('가구가 놓인 칸은 지나갈 수 없습니다.');
    const door=(floor.doors||[]).find(d=>d.x===next.x&&d.y===next.y);
    if(door&&!doorView(state,floor,door).open)error('닫힌 문입니다. 옆에서 열어주세요.');
    if(occupied(state,next,exclude)>=Number(state.pkg.game.investigation?.maxTileOccupants||3))
      error('이 타일의 최대 인원을 초과했습니다.');
  }
  function clearTemporaryShares(state){
    state.selectiveShares=state.selectiveShares.filter(s=>near(state,s.from)&&near(state,s.to));
    state.offers=state.offers.filter(s=>near(state,s.from)&&near(state,s.to));
  }
  function move(state,direction,turnOnly=false){
    if(!playPhases.includes(state.phase))error('지도 이동은 캐릭터 숙지부터 가능합니다.');
    if(!Direction.valid(direction))error('방향을 선택하세요.');
    const old=position(state);
    if(turnOnly){state.facings[state.roleId]=direction;return old;}
    const [dx,dy]=Direction.directions[direction];
    const next={floor:old.floor,x:old.x+dx,y:old.y+dy};
    canEnter(state,next,state.roleId);
    state.positions[state.roleId]=next;state.facings[state.roleId]=direction;clearTemporaryShares(state);return next;
  }
  function interact(state,kind,arg,operation){
    if(!playPhases.includes(state.phase))error('현재 사용할 수 없는 타일입니다.');
    const pos=position(state),floor=floorOf(state,pos);
    if(kind==='portal'){
      const portal=floor.portals?.[arg];
      if(!portal||portal.x!==pos.x||portal.y!==pos.y)error('이동 타일 위에서만 층을 바꿀 수 있습니다.');
      const next={floor:portal.toFloor,x:portal.toX,y:portal.toY};
      canEnter(state,next,state.roleId);
      state.positions[state.roleId]=next;clearTemporaryShares(state);return next;
    }
    if(kind==='door'){
      const door=floor.doors?.find(d=>d.id===arg);
      if(!door||!Direction.isAhead(pos,door,state.facings[state.roleId]))error('바라보는 바로 앞의 문만 조작할 수 있습니다.');
      const key=doorKey(floor.id,door.id),status=doorView(state,floor,door);
      if(operation==='open'){
        if(status.locked){
          const bag=state.pkg.game.booklets?.[state.roleId]?.inventory||[];
          const earned=state.collected[state.roleId]||[];
          if(door.requiresItem&&![...bag,...earned].some(v=>v.id===door.requiresItem))
            error('이 문에 필요한 열쇠가 없습니다.');
        }
        state.doorStates[key]={unlocked:true,open:true};
      }else if(operation==='close'){
        if(occupied(state,{...pos,x:door.x,y:door.y},null))error('문 타일에 참가자가 있어 닫을 수 없습니다.');
        state.doorStates[key]={unlocked:!status.locked,open:false};
      }else error('알 수 없는 문 조작입니다.');
      return state.doorStates[key];
    }
    error('알 수 없는 상호작용입니다.');
  }
  function unlocked(state,c){
    return (c.availableFromPhase!=='investigation2'||['investigation2','discussion2','action','ending'].includes(state.phase))&&
      (c.requires||[]).every(x=>(state.discovered[x]||[]).length>0);
  }
  function holdings(state,roleId){return state.holdings.filter(h=>h.ownerId===roleId)}
  function canReserve(state,cardId){
    if(!investigationPhases.includes(state.phase))error('현재 조사 단계가 아닙니다.');
    const c=cards(state).find(x=>x.id===cardId);
    if(!c)error('조사 카드가 없습니다.');
    if(ClueFront.isConcealedCard(c,state.pkg.game.floors,(f,d)=>doorView(state,f,d)))
      error('이 조사 구역은 아직 잠겨 있습니다.');
    if(!unlocked(state,c))error('아직 해금되지 않은 카드입니다.');
    const previous=ClueFront.sequenceAfter(cards(state),state.pkg.game.floors)[cardId];
    if(previous&&!(state.discovered[previous]||[]).length)
      error('이 장소의 이전 조사 카드를 먼저 조사해야 합니다.');
    if(c.owner===state.roleId||(c.blockedFor||[]).includes(state.roleId))error('이 배역은 해당 카드를 조사할 수 없습니다.');
    if(ClueFront.placeInvestigationUsed(cards(state),state.pkg.game.floors,state.discovered,id(state.roleId),state.phase,c))
      error('이번 조사 단계에서 같은 장소의 단서는 1장만 조사할 수 있습니다.');
    if(c.type==='belonging'&&ClueFront.personalInvestigationUsed(
      cards(state),state.discovered,id(state.roleId),state.phase,c.owner))
      error('이번 조사 단계에서 해당 인물의 소지품은 1장만 조사할 수 있습니다. 2차 조사에서는 다시 1장을 조사할 수 있습니다.');
    if(c.requiresPresence&&c.location){
      const p=position(state);
      if(c.location.floor!==p.floor||c.location.x!==p.x||c.location.y!==p.y)error('조사 장소 타일로 이동해야 합니다.');
    }
    if((state.discovered[cardId]||[]).length&&!c.repeatable)error('이미 조사 완료한 카드입니다.');
    if((state.tokens[state.roleId]||0)<1)error('조사 토큰이 부족합니다.');
    if(state.reservations[cardId]&&state.reservations[cardId]!==state.roleId)error('다른 플레이어가 선택한 카드입니다.');
    return c;
  }
  function reserve(state,cardId){
    canReserve(state,cardId);
    for(const [card,owner] of Object.entries(state.reservations))if(owner===state.roleId)delete state.reservations[card];
    state.reservations[cardId]=state.roleId;return true;
  }
  function release(state,cardId){
    if(state.reservations[cardId]===state.roleId)delete state.reservations[cardId];return true;
  }
  function investigate(state,cardId){
    const c=canReserve(state,cardId);
    if(state.reservations[cardId]!==state.roleId)error('먼저 카드를 선택해야 합니다.');
    delete state.reservations[cardId];
    state.tokens[state.roleId]--;
    state.discovered[cardId]||=[];state.discovered[cardId].push({playerId:id(state.roleId),phase:state.phase,at:Date.now()});
    const h={id:'test_h'+state.serial++,cardId,ownerId:state.roleId};state.holdings.push(h);
    if(c.grant){state.collected[state.roleId]||=[];state.collected[state.roleId].push(deep(c.grant));}
    return h;
  }
  function makeOffer(state,kind,holdingId,to,amount){
    if(!investigationPhases.includes(state.phase))error('양도는 조사 단계에서만 가능합니다.');
    if(!roleOf(state,to)||to===state.roleId||!near(state,to))error('같은 타일의 다른 사람에게만 제안할 수 있습니다.');
    if(kind==='card'){
      const h=state.holdings.find(v=>v.id===holdingId&&v.ownerId===state.roleId);
      const card=h&&cards(state).find(v=>v.id===h.cardId);
      if(!card||card.transferable===false)error('해당 카드는 양도할 수 없습니다.');
    }else if(kind==='token'){
      if(!Number.isInteger(amount)||amount<1||amount>state.tokens[state.roleId])error('유효한 토큰 수량을 입력하세요.');
    }else error('알 수 없는 양도 유형입니다.');
    const offer={id:'test_o'+state.serial++,type:kind,from:state.roleId,to,holdingId,amount};
    state.offers.push(offer);return offer;
  }
  function replyOffer(state,offerId,accept){
    const offer=state.offers.find(o=>o.id===offerId&&o.to===state.roleId);
    if(!offer)error('나에게 온 요청이 아닙니다.');
    if(!near(state,offer.from))error('서로 같은 타일에 있어야 합니다.');
    state.offers=state.offers.filter(o=>o.id!==offerId);
    if(!accept)return false;
    if(offer.type==='card'){
      const h=state.holdings.find(v=>v.id===offer.holdingId);
      if(!h||h.ownerId!==offer.from)error('카드 소유자가 변경되었습니다.');
      h.ownerId=offer.to;
      state.selectiveShares=state.selectiveShares.filter(v=>v.holdingId!==h.id);
    }else{
      if(state.tokens[offer.from]<offer.amount)error('양도할 토큰이 부족합니다.');
      state.tokens[offer.from]-=offer.amount;state.tokens[offer.to]+=offer.amount;
    }
    return true;
  }
  function share(state,holdingId,to){
    const h=holdings(state,state.roleId).find(x=>x.id===holdingId);
    if(!h)error('본인이 보유하지 않은 카드입니다.');
    if(!roleOf(state,to)||!near(state,to)||to===state.roleId)error('같은 타일 참가자에게만 선택 공개할 수 있습니다.');
    if(!state.selectiveShares.some(x=>x.holdingId===holdingId&&x.to===to))
      state.selectiveShares.push({holdingId,from:state.roleId,to});
    return true;
  }
  function unshare(state,holdingId,to){
    state.selectiveShares=state.selectiveShares.filter(x=>!(x.holdingId===holdingId&&x.to===to&&x.from===state.roleId));
  }
  function publicShare(state,holdingId){
    const h=holdings(state,state.roleId).find(x=>x.id===holdingId);
    if(!h)error('보유하지 않은 조사 카드입니다.');
    state.publicCards[h.cardId]={at:Date.now()};return true;
  }
  function equipment(state,rid){
    return {items:[...(state.pkg.game.booklets?.[rid]?.inventory||[]),...(state.collected[rid]||[])].map(x=>x.id),
      cards:holdings(state,rid).map(h=>h.cardId)};
  }
  function initActions(state){
    const order=(state.pkg.game.action?.order||state.pkg.story.characters.map(c=>c.id))
      .filter(rid=>!!roleOf(state,rid));
    state.action={order,cursor:0,done:!order.length,log:[],guards:[],dead:[],restrained:[],
      escaped:[],usedItems:{},choices:{}};
  }
  function advanceAction(state){
    const a=state.action;
    while(a.cursor<a.order.length){
      const rid=a.order[a.cursor];
      if(!a.dead.includes(rid)&&!a.restrained.includes(rid))return;
      a.log.push({actor:roleOf(state,rid).name,kind:'skip',text:a.dead.includes(rid)?'사망으로 행동 불가':'제압으로 행동 불가'});
      a.cursor++;
    }
    a.done=true;
  }
  function availableActions(state,rid){
    const stuff=equipment(state,rid),used=state.action?.usedItems?.[rid]||[];
    return (state.pkg.game.action?.roles?.[rid]||[]).map(a=>({
      id:a.id,title:a.title,description:a.description,kind:a.kind,targetMode:a.targetMode,
      requiresItem:a.requiresItem||null,requiresCard:a.requiresCard||null,
      usable:(!a.requiresItem||(stuff.items.includes(a.requiresItem)&&!used.includes(a.requiresItem)))&&
        (!a.requiresCard||stuff.cards.includes(a.requiresCard))
    }));
  }
  function act(state,abilityId,targetId){
    if(state.phase!=='action')error('행동 단계에서만 사용할 수 있습니다.');
    if(!state.action)initActions(state);
    const a=state.action;advanceAction(state);
    if(a.done)error('모든 행동이 종료되었습니다.');
    if(a.order[a.cursor]!==state.roleId)error('지금은 이 배역의 행동 차례가 아닙니다.');
    const opt=abilityId==='pass'?{id:'pass',title:'행동하지 않음',kind:'pass',targetMode:'none'}:
      (state.pkg.game.action?.roles?.[state.roleId]||[]).find(v=>v.id===abilityId);
    if(!opt)error('해당 배역이 사용할 수 없는 행동입니다.');
    if(abilityId!=='pass'&&!availableActions(state,state.roleId).find(x=>x.id===opt.id)?.usable)
      error('필요한 카드 또는 아이템이 부족합니다.');
    const mode=opt.targetMode||'none',target=targetId?roleOf(state,targetId):null;
    if(mode==='other'&&(!target||targetId===state.roleId))error('다른 참가자를 선택하세요.');
    if(mode==='any'&&!target)error('대상을 선택하세요.');
    if(mode==='self'&&targetId&&targetId!==state.roleId)error('자신만 대상으로 선택할 수 있습니다.');
    if(mode==='none'&&target)error('대상이 필요하지 않은 행동입니다.');
    if(target&&a.dead.includes(targetId))error('이미 탈락한 참가자입니다.');
    const recipient=mode==='self'?state.roleId:targetId;
    if(opt.range==='tile'&&recipient!==state.roleId&&!near(state,recipient))error('같은 타일에 있는 대상만 가능합니다.');
    if(['guard','attack','restrain'].includes(opt.kind)&&!recipient)error('대상을 지정해야 합니다.');
    let summary=opt.publicText||opt.title,kind=opt.kind;
    if(kind==='guard'){if(!a.guards.includes(recipient))a.guards.push(recipient);summary+=' · 보호 준비 완료';}
    if(['attack','restrain'].includes(kind)){
      if(a.guards.includes(recipient)){
        a.guards=a.guards.filter(x=>x!==recipient);kind='blocked';summary+=' · 보호로 차단되었습니다.';
      }else if(kind==='attack'){
        a.dead.push(recipient);summary+=' · '+roleOf(state,recipient).name+' 사망';
      }else{a.restrained.push(recipient);summary+=' · '+roleOf(state,recipient).name+' 제압';}
    }
    if(kind==='escape'){a.escaped.push(state.roleId);summary+=' · 탈출 성공';}
    if(opt.requiresItem&&opt.consumesItem!==false){
      a.usedItems[state.roleId]||=[];a.usedItems[state.roleId].push(opt.requiresItem);
    }
    a.choices[state.roleId]=opt.id;a.log.push({actor:player(state).name,kind,text:summary});
    a.cursor++;advanceAction(state);return a;
  }
  function actionView(state){
    if(!state.action)initActions(state);
    const a=state.action,now=a.order[a.cursor];
    return {done:a.done,currentActor:now?{id:id(now),name:roleOf(state,now).name,characterId:now}:null,
      turn:Math.min(a.cursor+1,a.order.length),total:a.order.length,
      order:a.order.map((rid,i)=>({name:roleOf(state,rid).name,characterId:rid,index:i+1,done:i<a.cursor})),
      status:{dead:a.dead.map(id),restrained:a.restrained.map(id),guarded:a.guards.map(id),escaped:a.escaped.map(id)},
      log:a.log,myTurn:now===state.roleId&&!a.done,myChoice:a.choices[state.roleId]||null,
      abilities:now===state.roleId&&!a.done?availableActions(state,state.roleId):[],
      targets:state.pkg.story.characters.filter(c=>!a.dead.includes(c.id)).map(c=>({id:id(c.id),name:c.name,characterId:c.id}))};
  }

  function setArrest(state,roleId){
    if(roleId!==null&&!roleOf(state,roleId))error('구속 대상을 찾을 수 없습니다.');
    if(roleId&&combinedEndingStatus(state).dead.includes(roleId))
      error('사망한 캐릭터를 구속할 수 없습니다.');
    state.verdict.arrestedCharacterId=roleId;return state;
  }
  function setGoal(state,roleId,achieved){
    if(!roleOf(state,roleId))error('존재하지 않는 캐릭터입니다.');
    if(achieved!==true&&achieved!==false&&achieved!==null)error('목표 결과 값이 올바르지 않습니다.');
    state.verdict.goals[roleId]=achieved;return state;
  }
  function setStatus(state,roleId,status){
    if(!roleOf(state,roleId))error('존재하지 않는 캐릭터입니다.');
    if(!['auto','alive','dead','restrained','escaped'].includes(status))error('상태 값이 올바르지 않습니다.');
    if(status==='auto')delete state.statusOverrides[roleId];
    else state.statusOverrides[roleId]=status;
    if(state.verdict.arrestedCharacterId===roleId&&combinedEndingStatus(state).dead.includes(roleId))state.verdict.arrestedCharacterId=null;
    return state;
  }
  function combinedEndingStatus(state){
    const action=state.action||{},override=state.statusOverrides||{};
    const out={dead:[...(action.dead||[])],restrained:[...(action.restrained||[])],escaped:[...(action.escaped||[])]};
    for(const [rid,status] of Object.entries(override)){
      for(const list of Object.values(out)){
        const idx=list.indexOf(rid);if(idx>=0)list.splice(idx,1);
      }
      if(out[status])out[status].push(rid);
    }
    return out;
  }
  function roomView(state){
    const s=state.pkg.story,g=state.pkg.game,role=player(state),phase=state.phase;
    const member=rid=>id(rid),yourPos=position(state),floor=floorOf(state,yourPos);
    const players=s.characters.map(c=>({id:member(c.id),name:c.name,characterId:c.id,
      position:state.positions[c.id],facing:Direction.facing(state.facings[c.id]),studyReady:!!state.studyReady[c.id],online:true}));
    const book=g.booklets?.[role.id],booklet=playPhases.includes(phase)&&book?{
      basic:{...role},background:book.background||[],timeline:book.timeline||[],inventory:book.inventory||[],
      culprit:!!book.culprit,objectives:book.objectives||'',notes:book.notes||'',
      actionOrder:g.action?.order?.indexOf(role.id)+1||null,
      actionNotes:book.actionNotes,actionAbilities:g.action?.roles?.[role.id]||[],
      shared:{synopsis:s.synopsis,characters:s.characters}
    }:null;
    const isMap=playPhases.includes(phase);
    const visibleFloor=ClueFront.playerFloor(floor,(f,d)=>doorView(state,f,d));
    const map=isMap?{title:visibleFloor.title,legend:visibleFloor.legend,tiles:visibleFloor.tiles,rooms:visibleFloor.rooms,
      objects:visibleFloor.objects||[],floorId:visibleFloor.id,
      floors:g.floors.map(f=>({id:f.id,title:f.title})),portals:visibleFloor.portals||[],areas:visibleFloor.areas||[],
      doors:(visibleFloor.doors||[]).map(d=>({id:d.id,name:d.name,x:d.x,y:d.y,
        ...doorView(state,floor,d),requiresItem:d.requiresItem||null})),
      capacity:g.investigation?.maxTileOccupants||3,
      avatars:s.characters.filter(c=>state.positions[c.id]?.floor===floor.id)
        .map(c=>({id:member(c.id),name:c.name,characterId:c.id,characterName:c.name,
          symbol:c.symbol,accent:c.accent,facing:Direction.facing(state.facings[c.id]),...state.positions[c.id]}))}:null;
    const canInvestigate=investigationPhases.includes(phase);
    const frontTitles=ClueFront.labels(cards(state),s.characters,g.floors);
    const sequence=ClueFront.sequenceAfter(cards(state),g.floors);
    const investigation=afterFirst.includes(phase)?{
      tokens:state.tokens[role.id]||0,totalTokens:g.investigation?.tokensPerPlayer||4,canInvestigate,
      cards:cards(state).flatMap(c=>{
        if(ClueFront.isConcealedCard(c,g.floors,(f,d)=>doorView(state,f,d)))return [];
        const mine=holdings(state,role.id).filter(h=>h.cardId===c.id);
        const visible=!!state.publicCards[c.id]||mine.length>0||
          state.selectiveShares.some(v=>v.to===role.id&&state.holdings.some(h=>h.id===v.holdingId&&h.cardId===c.id));
        const phaseLocked=!unlocked(state,c);
        const previous=sequence[c.id];
        const sequenceLocked=!!previous&&!(state.discovered[previous]||[]).length;
        const placeLimitReached=ClueFront.placeInvestigationUsed(
          cards(state),g.floors,state.discovered,member(role.id),phase,c);
        const personLimitReached=c.type==='belonging'&&ClueFront.personalInvestigationUsed(
          cards(state),state.discovered,member(role.id),state.phase,c.owner);
        const locked=phaseLocked||sequenceLocked;
        if(phaseLocked&&c.visibility==='hidden'&&!visible)return [];
        const at=c.location&&yourPos.floor===c.location.floor&&yourPos.x===c.location.x&&yourPos.y===c.location.y;
        const prior=state.discovered[c.id]||[];
        return [{id:c.id,frontTitle:frontTitles[c.id],
          title:visible?c.title:null,subtitle:visible?c.subtitle:null,
          type:c.type,location:c.location||null,
          locked,sequenceLocked,sequenceAfter:sequenceLocked?frontTitles[previous]:null,
          personLimitReached,placeLimitReached,
          requiresPresence:!!c.requiresPresence,atLocation:!!at,
          excluded:c.owner===role.id||(c.blockedFor||[]).includes(role.id),
          taken:prior.length>0&&!c.repeatable,repeatable:!!c.repeatable,transferable:c.transferable!==false,
          public:!!state.publicCards[c.id],heldByMe:mine.length,sharedToMe:visible&&
             !mine.length&&!state.publicCards[c.id]?1:0,
          reservedBy:state.reservations[c.id]?member(state.reservations[c.id]):null,
          acquiredBy:prior.map(p=>p.playerId),
          revealed:visible?[{at:state.publicCards[c.id]?.at||prior[0]?.at||Date.now(),
            back:c.back,grant:c.grant||null,insight:c.insights?.[role.id]||null}]:[]}]
      }),
      myCards:holdings(state,role.id).flatMap(h=>{
        const c=cards(state).find(v=>v.id===h.cardId);
        return c?[{id:h.id,cardId:c.id,title:c.title,subtitle:c.subtitle,back:c.back,
          transferable:c.transferable!==false,insight:c.insights?.[role.id]||null,
          public:!!state.publicCards[c.id],sharedWith:state.selectiveShares
            .filter(v=>v.holdingId===h.id).map(v=>({id:member(v.to),name:roleOf(state,v.to)?.name||''}))}]:[];
      }),
      nearby:s.characters.filter(c=>c.id!==role.id&&near(state,c.id)).map(c=>({id:member(c.id),name:c.name})),
      incomingOffers:state.offers.filter(o=>o.to===role.id).map(o=>({
        id:o.id,type:o.type,amount:o.amount||null,
        cardTitle:frontTitles[state.holdings.find(h=>h.id===o.holdingId)?.cardId]||'',
        fromName:roleOf(state,o.from).name})),
      outgoingOffers:state.offers.filter(o=>o.from===role.id).map(o=>({
        id:o.id,type:o.type,amount:o.amount||null,toName:roleOf(state,o.to).name})),
      collected:state.collected[role.id]||[]
    }:null;
    const statuses=combinedEndingStatus(state);
    const verdict=['discussion2','action','ending'].includes(phase)?{
      isHost:true,arrestedCharacterId:state.verdict.arrestedCharacterId,
      candidates:s.characters.map(c=>({id:c.id,name:c.name,dead:statuses.dead.includes(c.id)}))}:null;
    return {code:'TEST',phase,story:s,characters:s.characters,
      castingMap:phase==='characters'&&g.floors[0]?{title:g.floors[0].title,tiles:g.floors[0].tiles}:null,me:member(role.id),players,hostId:member(role.id),
      progress:{ready:s.players,total:s.players,canAdvance:true},
      clock:null,advanceVotes:{},booklet,map,investigation,verdict,
      ending:phase==='ending'&&Ending?Ending.summary(s,g,{...state.verdict,statuses:state.statusOverrides},statuses,role.id,true):null,
      whispers:{groups:[],proposals:[]},action:phase==='action'||phase==='ending'?actionView(state):null};
  }
  return {PHASES,PHASE_NAMES,create,reset,switchRole,switchPhase,move,interact,unlocked,
    reserve,release,investigate,holdings,makeOffer,replyOffer,share,unshare,publicShare,act,
    roomView,near,position,setArrest,setGoal,setStatus,combinedEndingStatus};
});
