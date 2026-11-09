'use strict';
(function(root){
  const directions={up:[0,-1,'↑','위쪽'],down:[0,1,'↓','아래쪽'],left:[-1,0,'←','왼쪽'],right:[1,0,'→','오른쪽']};
  const valid=value=>typeof value==='string'&&Object.hasOwn(directions,value);
  const facing=value=>valid(value)?value:'down';
  function isAhead(position,target,direction){
    const [dx,dy]=directions[facing(direction)];
    return target.x===position.x+dx&&target.y===position.y+dy;
  }
  const api={directions,valid,facing,isAhead};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.MysteryDirection=api;
})(typeof window!=='undefined'?window:null);
