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
  function labels(cards,characters,floors){
    const names=new Map((characters||[]).map(c=>[c.id,label(c.name)]));
    const counters=new Map(),result={};
    for(const card of cards||[]){
      const owned=card.type==='belonging'&&names.has(card.owner);
      const name=owned?names.get(card.owner)+'의 소지품':locationName(card,floors);
      const group=owned?'owner:'+card.owner:'place:'+name;
      const number=(counters.get(group)||0)+1;counters.set(group,number);
      result[card.id]=name+' '+number;
    }
    return result;
  }
  return {labels,locationName};
});
