'use strict';
// Strict JSON import boundary: no eval, HTML, executable scripts, external URLs,
// unsafe file paths or prototype-dependent keys. Metadata is copied to plain objects.
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
  const story={id:'',title:text(raw.title,100),subtitle:text(raw.subtitle),genre:text(raw.genre,70),
    teaser:text(raw.teaser,700),minutes:int(raw.minutes||90,1,600,'예상 플레이 시간'),
    players,synopsis:[],characters:[]};
  if(!story.title)throw Error('스토리 제목을 입력하세요.');
  if(!Array.isArray(raw.synopsis)||!raw.synopsis.length||raw.synopsis.length>25)throw Error('시놉시스 문단이 필요합니다.');
  story.synopsis=raw.synopsis.map(x=>text(x,3000));
  story.characters=raw.characters.map(c=>{
    c=obj(c);
    if(!id.test(c.id))throw Error('캐릭터 ID는 소문자 영문자로 시작해야 합니다.');
    if(!text(c.name))throw Error('캐릭터 이름이 필요합니다.');
    return {id:c.id,name:text(c.name,70),role:text(c.role,120),hint:text(c.hint,200),
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
      culprit:b.culprit===true,objectives:text(b.objectives,3000),notes:text(b.notes,1000)
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
        pattern:['wood','carpet','stone','tile','plain'].includes(a.pattern)?a.pattern:'plain'};
    });
    const doors=(Array.isArray(f.doors)?f.doors:[]).slice(0,80).map(d=>({
      id:text(d.id,40),name:text(d.name,80),...location(d,'문'),
      locked:d.locked===true,requiresItem:text(d.requiresItem,40)
    }));
    unique(doors.map(d=>d.id),'문');
    const portals=(Array.isArray(f.portals)?f.portals:[]).slice(0,80).map(t=>({
      ...location(t,'이동 타일'),toFloor:text(t.toFloor,40),
      toX:int(t.toX,0,35,'도착 x'),toY:int(t.toY,0,35,'도착 y'),
      label:text(t.label,70)||'다른 층으로 이동'
    }));
    const rooms=(Array.isArray(f.rooms)?f.rooms:[]).slice(0,80).map(r=>({
      ...location(r,'표지'),name:text(r.name,80),icon:text(r.icon,4)
    }));
    return {id:f.id,title:text(f.title,100)||f.id,legend:text(f.legend,250),tiles,rooms,areas,doors,portals};
  });
  unique(floors.map(f=>f.id),'층');
  for(const f of floors)for(const t of f.portals){
    const target=floors.find(x=>x.id===t.toFloor);
    if(!target||target.tiles[t.toY]?.[t.toX]!=='.')throw Error('계단 목적지('+t.label+')가 유효하지 않습니다.');
  }
  const spawn={};
  for(const c of story.characters){
    const rawSpawn=obj(g.spawn?.[c.id]),floor=floors.find(f=>f.id===rawSpawn.floor)||floors[0];
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
      type:['place','information','belonging'].includes(c.type)?c.type:'place',
      back:text(c.back,4000),owner:story.characters.some(x=>x.id===c.owner)?c.owner:null,
      blockedFor:blockedFor.filter(x=>story.characters.some(v=>v.id===x)),
      location,requires,visibility:c.visibility==='hidden'?'hidden':'locked',
      repeatable:c.repeatable===true,
      grant:c.grant&&id.test(c.grant.id)?{id:c.grant.id,name:text(c.grant.name,100),description:text(c.grant.description,1000)}:null};
  });
  unique(normalizedCards.map(x=>x.id),'카드');
  for(const c of normalizedCards)for(const x of c.requires)if(!normalizedCards.some(v=>v.id===x)||x===c.id)throw Error('선행 카드 ID가 잘못되었습니다: '+x);
  const phaseMinutes={};
  for(const [k,v] of Object.entries(obj(g.phaseMinutes)))if(['synopsis','characters','study','investigation1','discussion1','investigation2','discussion2','action','ending'].includes(k))phaseMinutes[k]=int(v,1,240,'권장 시간');
  const game={booklets,floors,phaseMinutes,investigation:{
    tokensPerPlayer:int(inv.tokensPerPlayer??4,1,20,'토큰'),
    maxTileOccupants:int(inv.maxTileOccupants??3,2,10,'타일 인원'),cards:normalizedCards
  }};
  return {format:'rice-mystery-v1',story,game,spawn};
}
module.exports={validate};
