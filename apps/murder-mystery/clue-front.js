'use strict';
// Shared, spoiler-free labels for clue fronts. Works in live rooms and Studio test mode.
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.MysteryClueFront=api;
})(typeof window!=='undefined'?window:null,function(){
  const label=value=>typeof value==='string'?value.trim():'';
  function locationName(card,floors){
    if(label(card.frontPlace))return label(card.frontPlace);
    const pos=card.location;
    const floor=pos&&(floors||[]).find(f=>f.id===pos.floor);
    if(!floor)return '사건 자료'; // No authored location: never invent a room.
    const room=(floor.rooms||[]).find(r=>r.x===pos.x&&r.y===pos.y);
    if(label(room?.name))return label(room.name);
    const area=(floor.areas||[]).find(a=>pos.x>=a.x&&pos.y>=a.y&&
      pos.x<a.x+a.width&&pos.y<a.y+a.height);
    if(label(area?.name)){
      const sameNameElsewhere=(floors||[]).some(f=>f!==floor&&
        (f.areas||[]).some(a=>a.name===area.name));
      if(!sameNameElsewhere)return label(area.name);
      const floorId=label(floor.title).match(/\d+층/);
      return (floorId?floorId[0]:label(floor.title)||floor.id)+' '+label(area.name);
    }
    return label(floor.title)||'사건 자료';
  }
  function groupKey(card,floors){
    return card.type==='belonging'&&card.owner?
      'owner:'+card.owner:'place:'+locationName(card,floors);
  }
  function orderedGroups(cards,floors){
    const groups=new Map();
    for(const card of cards||[]){
      const key=groupKey(card,floors);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(card);
    }
    for(const group of groups.values()){
      // Only authored ranks change established card numbering. Unranked editor
      // scenarios retain their original source order and investigation rules.
      group.sort((a,b)=>(Number.isInteger(a.sequenceOrder)?a.sequenceOrder:9999)-
        (Number.isInteger(b.sequenceOrder)?b.sequenceOrder:9999));
    }
    return groups;
  }
  function sequenceAfter(cards,floors){
    const result={};
    for(const group of orderedGroups(cards,floors).values()){
      for(let i=1;i<group.length;i++)if(Number.isInteger(group[i].sequenceOrder)&&
          Number.isInteger(group[i-1].sequenceOrder)){
        result[group[i].id]=group[i-1].id;
      }
    }
    return result;
  }
  function labels(cards,characters,floors){
    const names=new Map((characters||[]).map(c=>[c.id,label(c.name)]));
    const result={};
    for(const [key,group] of orderedGroups(cards,floors)){
      for(const [i,card] of group.entries()){
        const name=key.startsWith('owner:')?
          (names.get(card.owner)||card.owner)+'의 소지품':locationName(card,floors);
        result[card.id]=name+' '+(i+1);
      }
    }
    return result;
  }

  // Author-only floor names and props are never sent to a player until
  // the door controlling that area has been unlocked at least once.
  function hiddenAreas(floor,doorStatus){
    return (floor?.areas||[]).filter(area=>{
      if(!area.revealDoor)return false;
      const door=(floor.doors||[]).find(d=>d.id===area.revealDoor);
      return !!door&&doorStatus(floor,door).locked;
    });
  }
  function inside(area,x,y){
    return x>=area.x&&y>=area.y&&x<area.x+area.width&&y<area.y+area.height;
  }
  function isConcealedCard(card,floors,doorStatus){
    if(!card?.location)return false;
    const floor=(floors||[]).find(f=>f.id===card.location.floor);
    return hiddenAreas(floor,doorStatus).some(a=>inside(a,card.location.x,card.location.y));
  }
  function playerFloor(floor,doorStatus){
    if(!floor)return null;
    const secrets=hiddenAreas(floor,doorStatus);
    if(!secrets.length)return floor;
    const secretAt=(x,y)=>secrets.find(a=>inside(a,x,y));
    return {...floor,legend:floor.hiddenLegend||floor.legend,
      areas:(floor.areas||[]).map(a=>secrets.includes(a)?
        {...a,name:a.hiddenName||'잠긴 구역',color:'#65666c',pattern:'plain'}:a),
      rooms:(floor.rooms||[]).map(r=>{
        const a=secretAt(r.x,r.y);
        return a?{...r,name:a.hiddenName||'잠긴 구역',icon:'🔒'}:r;
      }),
      objects:(floor.objects||[]).filter(o=>!secretAt(o.x,o.y)),
      doors:(floor.doors||[]).map(d=>{
        const a=secrets.find(a=>a.revealDoor===d.id);
        return a?{...d,name:a.hiddenDoorName||'잠긴 구역 출입문'}:d;
      })
    };
  }
  return {labels,locationName,sequenceAfter,groupKey,hiddenAreas,isConcealedCard,playerFloor};
});
