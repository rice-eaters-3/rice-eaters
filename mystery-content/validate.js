'use strict';
// Strict JSON import boundary: no eval, HTML, executable scripts, external URLs,
// unsafe file paths or prototype-dependent keys. Metadata is copied to plain objects.
const artThemes=new Set(['d1-crown-of-ashes','cruel-heart-island','neon-memory-quarantine','stellar-academy-first-case']);
const id=/^[a-z][a-z0-9_-]{0,35}$/;
const text=(s,max=160)=>typeof s==='string'?s.trim().slice(0,max):'';
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const int=(v,min,max,name)=>{if(!Number.isInteger(v)||v<min||v>max)throw Error(name+' 범위 오류');return v};
function unique(values,name){if(new Set(values).size!==values.length)throw Error(name+' ID가 중복됩니다.')}
function validate(input){
  if(!input||typeof input!=='object')throw Error('올바른 시나리오 JSON이 아닙니다.');
  const p=obj(input),raw=obj(p.story),g=obj(p.game);
  if(p.format!=='rice-mystery-v1')throw Error('지원하지 않는 시나리오 파일 버전입니다.');
  const players=int(raw.players,2,10,'플레이어');
  if(!Array.isArray(raw.characters)||raw.characters.length!==players)throw Error('등장인물 수가 플레이어 수와 달라요.');
  const autoTheme=raw.id==='d1-gaming'?'d1-crown-of-ashes':raw.id;
  const theme=raw.artTheme||autoTheme;
  const story={id:'',title:text(raw.title,100),subtitle:text(raw.subtitle),genre:text(raw.genre,70),
    teaser:text(raw.teaser,700),minutes:int(raw.minutes||90,1,600,'예상 플레이 시간'),
    players,artTheme:artThemes.has(theme)?theme:'',synopsis:[],characters:[]};
  const victim=obj(raw.victim);
  if(typeof victim.id==='string'&&id.test(victim.id)&&text(victim.name,70))
    story.victim={id:victim.id,name:text(victim.name,70)};
  if(!story.title)throw Error('스토리 제목을 입력하세요.');
  if(!Array.isArray(raw.synopsis)||!raw.synopsis.length||raw.synopsis.length>25)throw Error('시놉시스 문단이 필요합니다.');
  story.synopsis=raw.synopsis.map(x=>text(x,3000));
  story.characters=raw.characters.map(c=>{
    c=obj(c);
    if(!id.test(c.id))throw Error('캐릭터 ID는 소문자 영문자로 시작해야 합니다.');
    if(!text(c.name))throw Error('캐릭터 이름이 필요합니다.');
    return {id:c.id,name:text(c.name,70),role:text(c.role,120),hint:text(c.hint,200),startLine:text(c.startLine,260),
      symbol:text(c.symbol,4)||'♟',accent:/^#[0-9a-fA-F]{6}$/.test(c.accent)?c.accent:'#8ab1c0'};
  });
  unique(story.characters.map(c=>c.id),'캐릭터');
  const booklets={};
  for(const c of story.characters){
    const b=obj(g.booklets?.[c.id]);
    const timeline=Array.isArray(b.timeline)?b.timeline:[];
    const inventory=Array.isArray(b.inventory)?b.inventory:[];
    if(timeline.length>100||inventory.length>100)throw Error('책자 항목 수 초과');
    booklets[c.id]={
      background:(Array.isArray(b.background)?b.background:[]).slice(0,20).map(x=>text(x,3000)),
      timeline:timeline.map(x=>({time:text(x.time,30),title:text(x.title,150),detail:text(x.detail,3000)})),
      inventory:inventory.map(x=>{
        if(!id.test(x.id))throw Error('아이템 ID는 소문자 영문자로 시작해야 합니다.');
        return {id:x.id,name:text(x.name,100),description:text(x.description,1500)};
      }),
      culprit:b.culprit===true,objectives:text(b.objectives,3000),notes:text(b.notes,1000),
      actionNotes:text(b.actionNotes,2000)
    };
    unique(booklets[c.id].inventory.map(x=>x.id),'개인 아이템');
  }
  const candidateFloors=Array.isArray(g.floors)?g.floors:[];
  if(!candidateFloors.length||candidateFloors.length>8)throw Error('지도는 1~8개 층이 필요합니다.');
  const floors=candidateFloors.map(f=>{
    f=obj(f);
    if(!id.test(f.id))throw Error('층 ID가 올바르지 않습니다.');
    if(!Array.isArray(f.tiles)||f.tiles.length<3||f.tiles.length>36)throw Error('맵 높이는 3~36칸입니다.');
    const tiles=f.tiles.map(t=>String(t));
    const width=tiles[0].length;
    if(width<3||width>36||tiles.some(t=>t.length!==width||!/^[#.]+$/.test(t)))throw Error('맵은 같은 길이의 #벽/.길로 구성하세요.');
    const location=(p,label)=>{
      const x=int(p.x,0,width-1,label+' x'),y=int(p.y,0,tiles.length-1,label+' y');
      if(tiles[y][x]!=='.')throw Error(label+'은 이동 가능한 칸에 지정해야 합니다.');
      return {x,y};
    };
    const areas=(Array.isArray(f.areas)?f.areas:[]).slice(0,80).map(a=>{
      const x=int(a.x,0,width-1,'구역 x'),y=int(a.y,0,tiles.length-1,'구역 y');
      const w=int(a.width,1,width,'구역 너비'),h=int(a.height,1,tiles.length,'구역 높이');
      if(x+w>width||y+h>tiles.length)throw Error('구역 경계가 맵을 벗어납니다.');
      return {id:text(a.id,40),name:text(a.name,80),x,y,width:w,height:h,
        color:/^#[a-fA-F0-9]{6}$/.test(a.color)?a.color:'#7a8190',
        pattern:['wood','carpet','stone','tile','plain'].includes(a.pattern)?a.pattern:'plain',
        revealDoor:text(a.revealDoor,40),hiddenName:text(a.hiddenName,80),
        hiddenDoorName:text(a.hiddenDoorName,80)};
    });
    const doors=(Array.isArray(f.doors)?f.doors:[]).slice(0,80).map(d=>({
      id:text(d.id,40),name:text(d.name,80),...location(d,'문'),
      locked:d.locked===true,closed:d.closed!==false,requiresItem:text(d.requiresItem,40)
    }));
    unique(doors.map(d=>d.id),'문');
    for(const area of areas)if(area.revealDoor&&!doors.some(d=>d.id===area.revealDoor&&d.locked))
      throw Error('비밀 구역은 잠긴 문 ID를 지정해야 합니다: '+area.id);
    const portals=(Array.isArray(f.portals)?f.portals:[]).slice(0,80).map(t=>({
      ...location(t,'이동 타일'),toFloor:text(t.toFloor,40),
      toX:int(t.toX,0,35,'도착 x'),toY:int(t.toY,0,35,'도착 y'),
      label:text(t.label,70)||'다른 층으로 이동'
    }));
    const rooms=(Array.isArray(f.rooms)?f.rooms:[]).slice(0,80).map(r=>({
      ...location(r,'표지'),name:text(r.name,80),icon:text(r.icon,4)
    }));
    // Objects are decoration by default. Solid props are kept distinct from the
    // existing wall/door logic, so author maps and collisions stay predictable.
    const objects=(Array.isArray(f.objects)?f.objects:[]);
    if(objects.length>100)throw Error('층별 오브젝트는 100개 이하로 배치하세요.');
    const cleaned=objects.map(o=>{
      o=obj(o);if(!id.test(o.id))throw Error('지도 오브젝트 ID 오류');
      return {id:o.id,...location(o,'오브젝트'),name:text(o.name,80)||o.id,
        kind:text(o.kind,32)||'other',icon:text(o.icon,4),solid:o.solid===true};
    });
    unique(cleaned.map(o=>o.id),'지도 오브젝트');
    for(const o of cleaned){
      if(o.solid&&(doors.some(d=>d.x===o.x&&d.y===o.y)||
          portals.some(p=>p.x===o.x&&p.y===o.y)))
        throw Error('문 또는 계단 위에 통과 불가 오브젝트를 배치할 수 없습니다.');
    }
    return {id:f.id,title:text(f.title,100)||f.id,legend:text(f.legend,250),
      hiddenLegend:text(f.hiddenLegend,250),
      tiles,rooms,areas,doors,portals,objects:cleaned};
  });
  unique(floors.map(f=>f.id),'층');
  for(const f of floors)for(const t of f.portals){
    const target=floors.find(x=>x.id===t.toFloor);
    if(!target||target.tiles[t.toY]?.[t.toX]!=='.')throw Error('계단 목적지('+t.label+')가 유효하지 않습니다.');
  }
  const spawn={};
  for(const c of story.characters){
    const rawSpawn=obj((p.spawn||g.spawn)?.[c.id]),floor=floors.find(f=>f.id===rawSpawn.floor)||floors[0];
    const x=int(rawSpawn.x,0,floor.tiles[0].length-1,c.name+' 시작 x'),y=int(rawSpawn.y,0,floor.tiles.length-1,c.name+' 시작 y');
    if(floor.tiles[y][x]!=='.')throw Error(c.name+' 시작 칸은 이동 가능해야 합니다.');
    spawn[c.id]={floor:floor.id,x,y};
  }
  const inv=obj(g.investigation),cards=(Array.isArray(inv.cards)?inv.cards:[]);
  if(cards.length>200)throw Error('카드 최대 200장');
  const normalizedCards=cards.map(c=>{
    c=obj(c);if(!id.test(c.id))throw Error('조사 카드 ID 오류');
    let location=null;
    if(c.location){const f=floors.find(x=>x.id===c.location.floor);
      if(!f)throw Error('카드 위치 층 ID 오류');
      const x=int(c.location.x,0,f.tiles[0].length-1,'카드 x'),y=int(c.location.y,0,f.tiles.length-1,'카드 y');
      if(f.tiles[y][x]!=='.')throw Error('카드는 이동 가능한 칸에 배치하세요.');
      location={floor:f.id,x,y};
    }
    const requires=Array.isArray(c.requires)?c.requires.map(x=>String(x)):[];
    const blockedFor=Array.isArray(c.blockedFor)?c.blockedFor.map(x=>String(x)):[];
    return {id:c.id,title:text(c.title,100)||c.id,subtitle:text(c.subtitle,180),
      frontPlace:text(c.frontPlace,100),
      type:['place','information','belonging'].includes(c.type)?c.type:'place',
      back:text(c.back,4000),owner:story.characters.some(x=>x.id===c.owner)?c.owner:null,
      blockedFor:blockedFor.filter(x=>story.characters.some(v=>v.id===x)),
      location,requires,visibility:c.visibility==='hidden'?'hidden':'locked',
      repeatable:c.repeatable===true,transferable:c.transferable!==false,
      availableFromPhase:c.availableFromPhase==='investigation2'?'investigation2':'investigation1',
      requiresPresence:c.requiresPresence===true,
      clueKind:['cult','timeline','trick'].includes(c.clueKind)?c.clueKind:null,
      insights:Object.fromEntries(Object.entries(obj(c.insights))
        .filter(([role])=>story.characters.some(v=>v.id===role))
        .map(([role,note])=>[role,text(note,2000)])),
      grant:c.grant&&id.test(c.grant.id)?{id:c.grant.id,name:text(c.grant.name,100),description:text(c.grant.description,1000)}:null};
  });
  unique(normalizedCards.map(x=>x.id),'카드');
  for(const c of normalizedCards)for(const x of c.requires)if(!normalizedCards.some(v=>v.id===x)||x===c.id)throw Error('선행 카드 ID가 잘못되었습니다: '+x);
  const phaseMinutes={};
  for(const [k,v] of Object.entries(obj(g.phaseMinutes)))if(['synopsis','characters','study','investigation1','discussion1','investigation2','discussion2','action','ending'].includes(k))phaseMinutes[k]=int(v,1,240,'권장 시간');
  // The action stage is optional for older stories. When present, every player
  // must have one explicit secret turn position, with bounded validated effects.
  const rawAction=obj(g.action);
  let action=null;
  if(Array.isArray(rawAction.order)){
    if(rawAction.order.length!==players)throw Error('행동 순서의 인원 수가 다릅니다.');
    unique(rawAction.order,'행동 순서');
    if(rawAction.order.some(v=>!story.characters.some(c=>c.id===v)))
      throw Error('행동 순서에 존재하지 않는 캐릭터가 있습니다.');
    const roles={};
    const inventoryIds=new Set(Object.values(booklets).flatMap(b=>b.inventory.map(i=>i.id)));
    const grantedIds=new Set(normalizedCards.filter(c=>c.grant).map(c=>c.grant.id));
    for(const c of story.characters){
      const abilities=rawAction.roles?.[c.id]||[];
      if(!Array.isArray(abilities)||abilities.length>8)
        throw Error(c.name+' 행동 능력 수가 유효하지 않습니다.');
      roles[c.id]=abilities.map(a=>{
        a=obj(a);
        if(!id.test(a.id)||a.id==='pass')throw Error('행동 능력 ID 오류');
        if(!['guard','attack','restrain','reveal','escape'].includes(a.kind))
          throw Error('지원하지 않는 행동 효과입니다: '+a.kind);
        if(!['none','self','other','any'].includes(a.targetMode))
          throw Error('행동 대상 지정 방식 오류');
        if(['guard','attack','restrain'].includes(a.kind)&&a.targetMode==='none')
          throw Error('보호·공격·제압은 대상 지정이 필요합니다.');
        if(a.kind==='escape'&&a.targetMode!=='self'&&a.targetMode!=='none')
          throw Error('탈출은 자기 자신의 행동이어야 합니다.');
        const item=a.requiresItem||null,cardId=a.requiresCard||null;
        if(item&&!inventoryIds.has(item)&&!grantedIds.has(item))
          throw Error('없는 행동 아이템: '+item);
        if(cardId&&!normalizedCards.some(v=>v.id===cardId))
          throw Error('없는 행동 카드: '+cardId);
        return {id:a.id,title:text(a.title,100)||a.id,description:text(a.description,1500),
          kind:a.kind,targetMode:a.targetMode,range:a.range==='tile'?'tile':'anywhere',
          publicText:text(a.publicText,260)||text(a.title,100)||'행동을 실행했다.',
          requiresItem:item,requiresCard:cardId,consumesItem:a.consumesItem!==false};
      });
      unique(roles[c.id].map(a=>a.id),'능력');
    }
    action={order:rawAction.order,roles,intro:text(rawAction.intro,1400),
      endingNotes:text(rawAction.endingNotes,2000)};
  }
  // Endings are public only AFTER the conclusion stage. Private author-only
  // creatorGuide remains entirely outside the normalized game payload.
  const rawEnding=obj(g.ending);
  const paragraphs=(input)=>Array.isArray(input)?input.slice(0,12).map(v=>text(v,3000)).filter(Boolean):[];
  const normalizeChapter=(input)=>({title:text(obj(input).title,110),
    paragraphs:paragraphs(obj(input).paragraphs)});
  const commonEnding=obj(rawEnding.common),rawEndingRoles=obj(rawEnding.characters);
  const ending={
    common:{captured:normalizeChapter(commonEnding.captured),
      missed:normalizeChapter(commonEnding.missed)},
    characters:{},escape:{
      succeeded:normalizeChapter(obj(rawEnding.escape).succeeded),
      failed:normalizeChapter(obj(rawEnding.escape).failed)
    }
  };
  for(const c of story.characters){
    const p=obj(rawEndingRoles[c.id]);
    ending.characters[c.id]={};
    for(const key of ['intro','captured','missed','goalAchieved','goalFailed','dead','arrested',
      'restrained','escaped','alive','closing'])
      ending.characters[c.id][key]=text(p[key],2500);
  }
  const game={booklets,floors,phaseMinutes,investigation:{
    tokensPerPlayer:int(inv.tokensPerPlayer??4,1,20,'토큰'),
    tokensPerSecondInvestigation:int(inv.tokensPerSecondInvestigation??4,0,20,'2차 조사 토큰'),
    maxTileOccupants:int(inv.maxTileOccupants??3,2,10,'타일 인원'),cards:normalizedCards
  }};
  if(action)game.action=action;
  game.ending=ending;
  return {format:'rice-mystery-v1',story,game,spawn};
}
module.exports={validate};
