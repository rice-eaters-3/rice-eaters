'use strict';
// Private role actions and server-authoritative one-turn-per-character resolution.
// The schema deliberately models game outcomes, not real-world procedures.
const EFFECTS=new Set(['guard','attack','restrain','reveal','escape']);
function bad(status,message){const err=new Error(message);err.status=status;throw err}
function init(room,game){
  const order=(game.action?.order||[]).map(id=>room.players.find(p=>p.characterId===id)?.id).filter(Boolean);
  if(order.length!==room.players.length)bad(500,'행동 순서 설정이 올바르지 않습니다.');
  room.actions={order,cursor:0,done:false,log:[],guards:[],dead:[],restrained:[],
    escaped:[],usedItems:{},choices:{},startedAt:Date.now()};
  return room.actions;
}
function equipment(room,player,game){
  const inv=game.booklets?.[player.characterId]?.inventory||[];
  const collected=room.investigation?.collected?.[player.id]||[];
  const ownedCards=(room.investigation?.holdings||[]).filter(h=>h.ownerId===player.id)
    .map(h=>game.investigation?.cards.find(c=>c.id===h.cardId)).filter(Boolean);
  return {items:[...inv,...collected].map(i=>i.id),
    cards:ownedCards.map(c=>c.id)};
}
function available(room,player,game){
  const inventory=equipment(room,player,game);
  const used=room.actions?.usedItems?.[player.id]||[];
  return (game.action?.roles?.[player.characterId]||[]).map(a=>({
    id:a.id,title:a.title,description:a.description,kind:a.kind,
    targetMode:a.targetMode,requiresItem:a.requiresItem||null,
    requiresCard:a.requiresCard||null,
    usable:(!a.requiresItem||(inventory.items.includes(a.requiresItem)&&!used.includes(a.requiresItem)))&&
      (!a.requiresCard||inventory.cards.includes(a.requiresCard))
  }));
}
function next(room){
  const state=room.actions;
  while(state.cursor<state.order.length){
    const id=state.order[state.cursor];
    if(!state.dead.includes(id)&&!state.restrained.includes(id))return;
    const p=room.players.find(x=>x.id===id);
    state.log.push({actor:p?.name||'참가자',target:null,kind:'skip',
      text:state.dead.includes(id)?'이미 탈락해 행동하지 못했습니다.':'제압된 상태여서 행동하지 못했습니다.'});
    state.cursor++;
  }
  state.done=true;
}
function view(room,player,game){
  const state=room.actions;
  if(!state)return null;
  const current=room.players.find(p=>p.id===state.order[state.cursor]);
  return {
    done:!!state.done,
    currentActor:current?{id:current.id,name:current.name,characterId:current.characterId}:null,
    turn:Math.min(state.cursor+1,state.order.length),total:state.order.length,
    order:state.order.map((id,index)=>{
      const p=room.players.find(x=>x.id===id);
      return {name:p.name,characterId:p.characterId,index:index+1,done:index<state.cursor};
    }),
    status:{dead:state.dead,restrained:state.restrained,guarded:state.guards,escaped:state.escaped},
    log:state.log,
    myTurn:!!current&&current.id===player.id,
    myChoice:state.choices[player.id]||null,
    abilities:current?.id===player.id?available(room,player,game):[],
    targets:room.players.filter(p=>p.id!==player.id&&!state.dead.includes(p.id))
      .map(p=>({id:p.id,name:p.name,characterId:p.characterId}))
  };
}
function submit(room,player,game,body){
  const state=room.actions;
  if(!state||state.done)bad(409,'행동 단계가 종료되었습니다.');
  next(room);
  if(state.done)bad(409,'행동 단계가 종료되었습니다.');
  if(state.order[state.cursor]!==player.id)bad(403,'현재 당신의 행동 차례가 아닙니다.');
  const a=body.abilityId==='pass'?{id:'pass',title:'행동하지 않음',kind:'pass',targetMode:'none'}:
    (game.action?.roles?.[player.characterId]||[]).find(x=>x.id===body.abilityId);
  if(!a)bad(400,'배정된 캐릭터가 사용할 수 없는 행동입니다.');
  if(a.id!=='pass'){
    if(!EFFECTS.has(a.kind))bad(400,'정의되지 않은 행동 효과입니다.');
    if(!available(room,player,game).find(x=>x.id===a.id)?.usable)
      bad(403,'사용할 수 있는 카드나 아이템이 부족합니다.');
  }
  const mode=a.targetMode||'none';
  const target=body.targetId?room.players.find(p=>p.id===body.targetId):null;
  if(mode==='other'&&(!target||target.id===player.id))bad(400,'다른 유효한 참가자를 선택하세요.');
  if(mode==='self'&&target&&target.id!==player.id)bad(400,'본인에게만 사용할 수 있습니다.');
  if(mode==='any'&&!target)bad(400,'대상을 선택하세요.');
  if(mode==='none'&&target)bad(400,'이 행동에는 대상이 필요하지 않습니다.');
  if(target&&state.dead.includes(target.id))bad(409,'이미 탈락한 참가자를 대상으로 할 수 없습니다.');
  const recipient=mode==='self'?player:target;
  if(a.range==='tile'&&recipient&&recipient.id!==player.id){
    const pos=room.mapPositions?.[player.id],other=room.mapPositions?.[recipient.id];
    if(!pos||!other||pos.floor!==other.floor||pos.x!==other.x||pos.y!==other.y)
      bad(409,'동일한 지도 타일의 상대에게만 사용할 수 있습니다.');
  }
  let summary=a.publicText||a.title;
  let outcome=a.kind;
  if(a.kind==='guard'){
    if(!recipient)bad(400,'보호 대상을 지정해야 합니다.');
    if(!state.guards.includes(recipient.id))state.guards.push(recipient.id);
    summary+=' · 보호 준비 완료';
  }
  if(a.kind==='attack'){
    if(!recipient)bad(400,'대상을 지정해야 합니다.');
    if(state.guards.includes(recipient.id)){
      state.guards=state.guards.filter(id=>id!==recipient.id);
      outcome='blocked';summary+=' · 방어에 의해 막혔습니다.';
    }else{
      state.dead.push(recipient.id);
      summary+=' · '+recipient.name+'이(가) 게임에서 사망했습니다.';
    }
  }
  if(a.kind==='restrain'){
    if(!recipient)bad(400,'대상을 지정해야 합니다.');
    if(state.guards.includes(recipient.id)){
      state.guards=state.guards.filter(id=>id!==recipient.id);
      outcome='blocked';summary+=' · 방어에 의해 막혔습니다.';
    }else{
      state.restrained.push(recipient.id);
      summary+=' · '+recipient.name+'이(가) 제압되었습니다.';
    }
  }
  if(a.kind==='escape'){
    if(!state.escaped.includes(player.id))state.escaped.push(player.id);
    summary+=' · 탈출 목표 달성';
  }
  if(a.requiresItem&&a.consumesItem!==false){
    state.usedItems[player.id]||=[];
    state.usedItems[player.id].push(a.requiresItem);
  }
  state.choices[player.id]=a.id;
  state.log.push({actor:player.name,target:recipient?.name||null,kind:outcome,text:summary});
  state.cursor++;
  next(room);
  return view(room,player,game);
}
module.exports={init,view,submit,available};
