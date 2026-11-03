'use strict';
// Shared, pure pathfinding for sound simulation. Opaque walls and CLOSED doors
// block the route. An alternative open corridor permits attenuated sound.
// The built-in maze is small (<=36x36); BFS is recomputed on map state updates.
window.MysteryAcoustics=(function(){
  function distance(room,fromId,toId){
    if(!room?.map)return Infinity;
    const players=room.players||[],a=players.find(p=>p.id===fromId)?.position,
      b=players.find(p=>p.id===toId)?.position;
    if(!a||!b||a.floor!==b.floor||room.map.floorId!==a.floor)return Infinity;
    const rows=room.map.tiles||[],h=rows.length,w=rows[0]?.length||0;
    if(!h||!w)return Infinity;
    const shut=new Set((room.map.doors||[]).filter(d=>!d.open).map(d=>d.x+','+d.y));
    const traversable=(x,y)=>x>=0&&x<w&&y>=0&&y<h&&rows[y]?.[x]==='.'&&!shut.has(x+','+y);
    if(!traversable(a.x,a.y)||!traversable(b.x,b.y))return Infinity;
    if(a.x===b.x&&a.y===b.y)return 0;
    const queue=[[a.x,a.y,0]],seen=new Set([a.x+','+a.y]);
    for(let i=0;i<queue.length;i++){
      const [x,y,steps]=queue[i];
      for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){
        const nx=x+dx,ny=y+dy,key=nx+','+ny;
        if(seen.has(key)||!traversable(nx,ny))continue;
        if(nx===b.x&&ny===b.y)return steps+1;
        seen.add(key);queue.push([nx,ny,steps+1]);
      }
    }
    return Infinity;
  }
  function gain(steps){
    if(!Number.isFinite(steps)||steps>24)return 0;
    if(steps<=0)return 1;
    return Math.max(0.025,Math.min(1,1/(1+steps*0.42)));
  }
  return {distance,gain};
})();
