'use strict';
// One server for the app library, solo Mars saves, and realtime mystery rooms.
// Node.js 20+; no npm packages or external services required.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const privateMysteries = {'midnight-manor':require('./mystery-content/midnight-manor.js')};

const ROOT = __dirname;
// Railway volumes expose this automatically; DATA_DIR can override for other hosts.
const DATA_DIR = path.resolve(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(ROOT, 'data'));
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const LOG_FILE = path.join(DATA_DIR, 'activity.jsonl');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
fs.mkdirSync(DATA_DIR, {recursive: true});

const STORIES = require('./mystery-content/stories.js');
const validateMystery = require('./mystery-content/validate.js').validate;
function storyById(id){return STORIES.find(s=>s.id===id)||db.customStories?.[id]?.story||null;}
const cleanName = (name) => typeof name === 'string' ? name.trim().replace(/\s+/g,' ').slice(0,18) : '';
const randomId = (n=20) => crypto.randomBytes(n).toString('hex');
const readState = () => {
  try {
    const parsed=JSON.parse(fs.readFileSync(STATE_FILE,'utf8'));
    return {rooms:parsed.rooms||{},sessions:parsed.sessions||{},mars:parsed.mars||{},customStories:parsed.customStories||{}};
  } catch(e) {
    if(e.code==='ENOENT') return {rooms:{},sessions:{},mars:{},customStories:{}};
    throw e; // never silently overwrite a corrupted save
  }
};
const db=readState();
const streams=new Map();
// Polling presence is required for Cloudflare Quick Tunnels, which do not support SSE.
// This map is intentionally ephemeral; an online player must have a live connection
// or have fetched their room recently.
const recentPresence=new Map();
const lastMoves=new Map(); // per-session movement cooldown; never persisted
const signals=new Map(); // ephemeral targeted WebRTC signaling; never persisted
const reservationTtl=90000;
const phaseDefault={synopsis:5,characters:5,study:20,investigation1:20,discussion1:15,
  investigation2:20,discussion2:20,action:10,ending:15};
function gameFor(room){return privateMysteries[room.storyId]||db.customStories?.[room.storyId]?.game||{}}
function floorsFor(room){const g=gameFor(room);return g.floors|| (g.floorplan?[{...g.floorplan,id:'ground',portals:[]}]:[])}
function floorFor(room,id){return floorsFor(room).find(f=>f.id===id)}
function positionFor(room,p){const pos=room.mapPositions?.[p.id];return pos?{floor:pos.floor||'ground',x:pos.x,y:pos.y}:null}
function occupantCount(room,pos,exceptId){
  return room.players.filter(p=>p.id!==exceptId&&positionFor(room,p)?.floor===pos.floor
    &&positionFor(room,p)?.x===pos.x&&positionFor(room,p)?.y===pos.y).length;
}
function tilePlayers(room,pos){return room.players.filter(p=>{const q=positionFor(room,p);
  return q?.floor===pos.floor&&q.x===pos.x&&q.y===pos.y;})}
function activeReservation(room,id){
  const r=room.investigation?.reserved?.[id];
  if(r&&r.expiresAt>Date.now())return r;
  if(r)delete room.investigation.reserved[id];
  return null;
}
function cardUnlocked(card,room){
  return (card.requires||[]).every(id=>room.investigation?.discovered?.[id]?.length);
}
function investigationView(room,member){
  if(!member||room.phase!=='investigation1')return null;
  const data=gameFor(room).investigation;
  if(!data)return null;
  const discovered=room.investigation?.discovered||{};
  return {
    tokens:room.investigation.tokens[member.id]??0,
    totalTokens:data.tokensPerPlayer,
    cards:data.cards.flatMap(card=>{
      const unlocked=cardUnlocked(card,room);
      if(!unlocked&&card.visibility==='hidden')return [];
      const found=discovered[card.id]||[], reservation=activeReservation(room,card.id);
      const taken=found.length>0&&!card.repeatable;
      const excluded=card.owner===member.characterId||(card.blockedFor||[]).includes(member.characterId);
      return [{
        id:card.id,title:card.title,subtitle:card.subtitle,type:card.type,
        location:card.location||null,locked:!unlocked,excluded,
        taken,repeatable:!!card.repeatable,
        reservedBy:reservation?.playerId||null,
        acquiredBy:found.map(f=>f.playerId),
        revealed:found.filter(f=>f.playerId===member.id).map(f=>({at:f.at,back:card.back,grant:card.grant||null}))
      }];
    }),
    collected:room.investigation?.collected?.[member.id]||[]
  };
}
function whisperState(room){
  room.whispers ||= {groups:[],proposals:[]};
  return room.whispers;
}
function pruneWhispers(room){
  const ws=whisperState(room);
  for(const g of ws.groups){
    g.members=g.members.filter(id=>{
      const p=room.players.find(v=>v.id===id);
      const pos=p&&positionFor(room,p);
      return pos&&pos.floor===g.floor&&pos.x===g.x&&pos.y===g.y;
    });
  }
  ws.groups=ws.groups.filter(g=>g.members.length>=2);
  ws.proposals=ws.proposals.filter(v=>v.expiresAt>Date.now()&&
    [...new Set([...v.voters,v.candidate])].every(id=>{
      const p=room.players.find(z=>z.id===id),pos=p&&positionFor(room,p);
      return pos&&pos.floor===v.floor&&pos.x===v.x&&pos.y===v.y;
    }));
}
function publicWhispers(room,member){
  pruneWhispers(room);
  const ws=whisperState(room);
  return {
    groups:ws.groups.map(g=>({id:g.id,members:g.members,floor:g.floor,x:g.x,y:g.y})),
    proposals:ws.proposals.filter(p=>member&&[...p.voters,p.candidate].includes(member.id))
      .map(p=>({id:p.id,kind:p.kind,candidate:p.candidate,voters:p.voters,yes:p.yes,
        floor:p.floor,x:p.x,y:p.y,expiresAt:p.expiresAt}))
  };
}
function phaseChange(room,phase,sid){
  room.phase=phase;room.phaseStartedAt=Date.now();
  logActivity('phase_'+phase,sid,{room:room.id});
}
const PRESENCE_TTL_MS=30000;
function touchPresence(room, sid){
  let members=recentPresence.get(room.id);
  if(!members){members=new Map();recentPresence.set(room.id,members)}
  members.set(sid,Date.now());
}
const now=()=>new Date().toISOString();
function persist(){
  const tmp=STATE_FILE+'.'+process.pid+'.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db,null,2),{mode:0o600});
  fs.renameSync(tmp,STATE_FILE);
}
function logActivity(action, sessionId, detail={}){
  const entry={at:now(),action,user:sessionId.slice(0,12),...detail};
  fs.appendFileSync(LOG_FILE,JSON.stringify(entry)+'\n',{mode:0o600});
  console.log('[activity]',JSON.stringify(entry));
}
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
function sessionFor(req,res){
  const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('rice_session='));
  const token=cookie && cookie.slice('rice_session='.length);
  if(token && /^[a-f0-9]{40}$/.test(token) && db.sessions[token]) return token;
  const id=randomId();
  db.sessions[id]={createdAt:now()};
  persist();
  const secure = req.socket.encrypted || req.headers['x-forwarded-proto']==='https';
  res.setHeader('Set-Cookie','rice_session='+id+'; Path=/; HttpOnly; SameSite=Lax'+(secure?'; Secure':''));
  logActivity('session_created',id);
  return id;
}
function json(res,status,data){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(data));
}
function requestBody(req,maxBytes=1024*1024){
  if(!String(req.headers['content-type']||'').startsWith('application/json')) fail(415,'JSON 요청만 지원합니다.');
  return new Promise((resolve,reject)=>{
    let size=0;const parts=[];
    req.on('data',chunk=>{
      size+=chunk.length;
      if(size>maxBytes){reject(Object.assign(new Error('요청 크기 제한을 초과했습니다.'),{status:413}));req.resume();return;}
      parts.push(chunk);
    });
    req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')))}catch(e){reject(Object.assign(new Error('잘못된 JSON입니다.'),{status:400}))}});
    req.on('error',reject);
  });
}
function ownedPlayer(room,sid){
  const player=room.players.find(p=>p.sid===sid);
  if(!player)fail(403,'먼저 이 방에 참가해주세요.');
  return player;
}
function roomOrFail(id){
  const room=db.rooms[id];
  if(!room) fail(404,'방을 찾을 수 없습니다.');
  return room;
}
function online(room,p){
  return !!streams.get(room.id)?.get(p.sid)?.size ||
    Date.now()-(recentPresence.get(room.id)?.get(p.sid)||0)<PRESENCE_TTL_MS;
}
function publicStory(story){
  return {id:story.id,title:story.title,subtitle:story.subtitle,teaser:story.teaser,genre:story.genre,minutes:story.minutes,players:story.players};
}
function roomView(room,sid){
  const story=storyById(room.storyId),game=gameFor(room);
  const member=room.players.find(p=>p.sid===sid),isMember=!!member;
  const char=member&&story.characters.find(c=>c.id===member.characterId);
  const notes=isMember&&['study','investigation1'].includes(room.phase)&&char?game.booklets?.[char.id]:null;
  const booklet=notes?{
    basic:{name:char.name,role:char.role,hint:char.hint,symbol:char.symbol,accent:char.accent},
    background:notes.background,timeline:notes.timeline,inventory:notes.inventory,
    culprit:notes.culprit,objectives:notes.objectives,notes:notes.notes,
    shared:{synopsis:story.synopsis,characters:story.characters}
  }:null;
  const myPos=member&&positionFor(room,member);
  const floor=myPos&&floorFor(room,myPos.floor);
  const map=floor&&['study','investigation1'].includes(room.phase)?{
    title:floor.title,legend:floor.legend,tiles:floor.tiles,rooms:floor.rooms,
    floorId:floor.id,floors:floorsFor(room).map(f=>({id:f.id,title:f.title})),
    portals:floor.portals||[],areas:floor.areas||[],
    doors:(floor.doors||[]).map(d=>({
      id:d.id,name:d.name,x:d.x,y:d.y,
      locked:!!d.locked&&!room.openDoors?.[floor.id+':'+d.id],
      requiresItem:d.requiresItem||null
    })),
    capacity:game.investigation?.maxTileOccupants||3,
    avatars:room.players.filter(p=>p.characterId&&positionFor(room,p)?.floor===floor.id).map(p=>{
      const c=story.characters.find(ch=>ch.id===p.characterId);
      return {id:p.id,name:p.name,characterId:p.characterId,characterName:c.name,
        symbol:c.symbol,accent:c.accent,...positionFor(room,p)};
    })
  }:null;
  return {
    code:room.id,phase:room.phase,story:publicStory(story),
    clock:room.gameStartedAt?{gameStartedAt:room.gameStartedAt,
      phaseStartedAt:room.phaseStartedAt||room.gameStartedAt,
      phaseMinutes:{...phaseDefault,...(game.phaseMinutes||{})},
      serverNow:Date.now()}:null,
    hostId:room.players.find(p=>p.sid===room.host)?.id||null,
    me:member?.id||null,
    players:room.players.map(p=>({id:p.id,name:p.name,read:!!p.read,
      studyReady:!!p.studyReady,characterId:!['lobby','synopsis'].includes(room.phase)?p.characterId:null,
      online:online(room,p),position:isMember?positionFor(room,p):null})),
    synopsis:isMember&&room.phase!=='lobby'?story.synopsis:null,
    characters:isMember&&!['lobby','synopsis'].includes(room.phase)?story.characters:null,
    booklet,map,investigation:investigationView(room,member),
    whispers:isMember&&['study','investigation1'].includes(room.phase)?publicWhispers(room,member):null
  };
}

function sendState(room){
  const peers=streams.get(room.id);
  if(!peers)return;
  for(const [sid,connections] of peers){
    const payload='event: state\ndata: '+JSON.stringify(roomView(room,sid))+'\n\n';
    for(const res of connections){try{res.write(payload)}catch(e){/* closed */}}
  }
}
function subscribe(req,res,room,sid){
  res.writeHead(200,{
    'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform',
    'Connection':'keep-alive','X-Accel-Buffering':'no'
  });
  res.write('retry: 2000\n\n');
  let peers=streams.get(room.id);
  if(!peers){peers=new Map();streams.set(room.id,peers)}
  let own=peers.get(sid);
  if(!own){own=new Set();peers.set(sid,own)}
  own.add(res);
  touchPresence(room,sid);
  sendState(room);
  const ping=setInterval(()=>{try{res.write(': heartbeat\n\n')}catch(e){}},20000);
  res.on('close',()=>{
    clearInterval(ping);
    own.delete(res);
    if(!own.size)peers.delete(sid);
    if(!peers.size)streams.delete(room.id);
    sendState(room);
  });
}
function roomCode(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do{id=Array.from(crypto.randomBytes(6),b=>alphabet[b%alphabet.length]).join('')}while(db.rooms[id]);
  return id;
}
function localAuthorRequest(req){
  const host=String(req.headers.host||'');
  const remote=req.socket.remoteAddress||'';
  return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)&&
    /^(localhost|127\.0\.0\.1|\[::1\]):[0-9]{1,5}$/.test(host)&&
    !req.headers['x-forwarded-for']&&!req.headers['cf-connecting-ip']&&
    !req.headers['x-forwarded-proto'];
}
function validateOrigin(req){
  const origin=req.headers.origin;
  if(origin && origin!==('http://'+req.headers.host) && origin!==('https://'+req.headers.host)) fail(403,'다른 출처의 요청은 허용되지 않습니다.');
}
async function api(req,res,url,sid){
  const pathname=url.pathname;
  if(req.method==='GET'&&pathname==='/api/stories')
    return json(res,200,{stories:[...STORIES,...Object.values(db.customStories).map(v=>v.story)].map(publicStory)});
  if(req.method==='POST'&&pathname==='/api/editor/publish'){
    validateOrigin(req);
    // User-authored secrets must not be writable by anonymous internet visitors.
    if(!localAuthorRequest(req))fail(403,'시나리오 발행은 로컬 PC의 localhost 주소에서만 허용됩니다.');
    const body=await requestBody(req,2*1024*1024);
    if(Object.values(db.customStories).filter(v=>v.owner===sid).length>=20)fail(429,'계정당 시나리오 최대 20편');
    if(Object.keys(db.customStories).length>=80)fail(503,'서버 저장 가능 시나리오가 가득 찼습니다.');
    const parsed=(()=>{try{return validateMystery(body.package)}catch(e){fail(400,e.message)}})();
    const id='custom-'+randomId(5),entry={owner:sid,story:{...parsed.story,id},game:{...parsed.game,spawn:parsed.spawn}};
    db.customStories[id]=entry;persist();logActivity('scenario_published',sid,{story:id});
    return json(res,201,{story:publicStory(entry.story),id});
  }
  if(req.method==='GET'&&pathname==='/api/editor/own'){
    if(!localAuthorRequest(req))fail(403,'localhost 제작자만 원고를 열 수 있습니다.');
    return json(res,200,{stories:Object.entries(db.customStories).filter(([id,v])=>v.owner===sid).map(([id,v])=>({id,title:v.story.title}))});
  }
  const editorId=pathname.match(/^\/api\/editor\/own\/([a-z0-9-]+)$/);
  if(req.method==='GET'&&editorId){
    if(!localAuthorRequest(req))fail(403,'localhost 제작자만 원고를 열 수 있습니다.');
    const entry=db.customStories[editorId[1]];
    if(!entry||entry.owner!==sid)fail(403,'제작자만 비공개 원고를 열람할 수 있습니다.');
    return json(res,200,{format:'rice-mystery-v1',story:entry.story,game:entry.game,spawn:entry.game.spawn});
  }
  if(req.method==='GET'&&pathname==='/api/mars/data'){
    return json(res,200,db.mars[sid]||{progress:null,records:[]});
  }
  if(req.method==='GET'&&pathname==='/api/events'){
    const room=roomOrFail(String(url.searchParams.get('room')||'').toUpperCase());
    ownedPlayer(room,sid);
    return subscribe(req,res,room,sid);
  }
  const match=pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|start|read|character|leave|study-ready|move|interact|reserve|release|investigate|whisper-request|whisper-vote|whisper-leave|signal|signals))?$/);
  if(req.method==='GET'&&match&&match[2]==='signals'){
    const room=roomOrFail(match[1]),me=ownedPlayer(room,sid);
    const after=Math.max(0,Number(url.searchParams.get('after'))||0);
    const queue=signals.get(room.id)||[];
    return json(res,200,{signals:queue.filter(v=>v.id>after&&v.to===me.id).slice(-60),
      cursor:queue.length?queue[queue.length-1].id:after});
  }
  if(req.method==='GET'&&match&&!match[2]){
    const room=roomOrFail(match[1]);
    // A member polling this endpoint also keeps their 'online' presence alive.
    // Visitors who merely preview an invitation never count as players.
    if(room.players.some(p=>p.sid===sid)){
      const player=room.players.find(p=>p.sid===sid);
      const wasOnline=online(room,player);
      touchPresence(room,sid);
      if(!wasOnline)sendState(room);
    }
    return json(res,200,roomView(room,sid));
  }
  if(!['POST','DELETE'].includes(req.method))fail(404,'API를 찾을 수 없습니다.');
  validateOrigin(req);
  const body=req.method==='POST'?await requestBody(req,6*1024*1024):{};
  if(pathname==='/api/rooms'&&req.method==='POST'){
    const story=storyById(body.storyId),name=cleanName(body.name);
    if(!story||!name)fail(400,'스토리와 표시 이름을 확인해주세요.');
    if(Object.keys(db.rooms).length>=200)fail(503,'현재 생성 가능한 방 수를 초과했습니다.');
    const code=roomCode(),player={id:randomId(8),sid,name,read:false,characterId:null};
    const room={id:code,storyId:story.id,host:sid,phase:'lobby',players:[player],createdAt:now(),whispers:{groups:[],proposals:[]}};
    db.rooms[code]=room;persist();logActivity('room_created',sid,{room:code,story:story.id});
    return json(res,201,roomView(room,sid));
  }
  if(pathname==='/api/mars/progress'&&req.method==='POST'){
    if(typeof body.progress!=='object'||!body.progress||body.progress.version!==3)fail(400,'저장할 게임 데이터가 잘못되었습니다.');
    db.mars[sid] ||= {progress:null,records:[]};
    db.mars[sid].progress=body.progress;persist();
    return json(res,200,{ok:true});
  }
  if(pathname==='/api/mars/progress'&&req.method==='DELETE'){
    db.mars[sid] ||= {progress:null,records:[]};
    db.mars[sid].progress=null;persist();logActivity('mars_progress_cleared',sid);
    return json(res,200,{ok:true});
  }
  if(pathname==='/api/mars/records'&&req.method==='POST'){
    if(!Array.isArray(body.records)||body.records.length>3000)fail(400,'게임 기록 형식이 잘못되었습니다.');
    db.mars[sid] ||= {progress:null,records:[]};
    db.mars[sid].records=body.records;persist();logActivity('mars_records_saved',sid,{count:body.records.length});
    return json(res,200,{ok:true});
  }
  if(!match||!match[2]||req.method!=='POST')fail(404,'API를 찾을 수 없습니다.');
  const room=roomOrFail(match[1]),action=match[2];
  if(action==='join'){
    const name=cleanName(body.name);
    if(!name)fail(400,'표시 이름을 입력해주세요.');
    if(room.phase!=='lobby')fail(409,'이미 시작한 방입니다.');
    if(room.players.some(p=>p.sid===sid))return json(res,200,roomView(room,sid));
    if(room.players.length>=storyById(room.storyId).players)fail(409,'방이 가득 찼습니다.');
    if(room.players.some(p=>p.name===name))fail(409,'이미 사용 중인 이름입니다.');
    room.players.push({id:randomId(8),sid,name,read:false,characterId:null});
    persist();logActivity('room_joined',sid,{room:room.id});
    sendState(room);return json(res,200,roomView(room,sid));
  }
  const player=ownedPlayer(room,sid);
  if(action==='leave'){
    if(room.phase!=='lobby')fail(409,'게임 시작 후에는 퇴장할 수 없습니다.');
    room.players=room.players.filter(p=>p.sid!==sid);
    if(room.host===sid)room.host=room.players[0]?.sid||null;
    recentPresence.get(room.id)?.delete(sid);
    lastMoves.delete(room.id+':'+sid);
    if(!room.players.length){
      delete db.rooms[room.id];
      recentPresence.delete(room.id);
    }
    persist();logActivity('room_left',sid,{room:room.id});
    if(room.players.length)sendState(room);
    return json(res,200,{ok:true});
  }
  if(action==='start'){
    if(room.host!==sid)fail(403,'방장만 게임을 시작할 수 있습니다.');
    if(room.phase!=='lobby')fail(409,'이미 게임이 시작되었습니다.');
    if(room.players.length!==storyById(room.storyId).players)fail(409,'정원이 모두 모여야 시작할 수 있습니다.');
    if(!room.players.every(p=>online(room,p)))fail(409,'모든 참가자가 온라인이어야 시작할 수 있습니다.');
    room.gameStartedAt=Date.now();phaseChange(room,'synopsis',sid);
    room.players.forEach(p=>{p.read=false;p.characterId=null});
    logActivity('game_started',sid,{room:room.id});persist();sendState(room);
    return json(res,200,roomView(room,sid));
  }
  if(action==='read'){
    if(room.phase!=='synopsis')fail(409,'현재 시놉시스 확인 단계가 아닙니다.');
    player.read=true;
    if(room.players.every(p=>p.read))phaseChange(room,'characters',sid)
    logActivity('synopsis_read',sid,{room:room.id});persist();sendState(room);
    return json(res,200,roomView(room,sid));
  }
  if(action==='character'){
    if(room.phase!=='characters')fail(409,'현재 캐릭터 선택 단계가 아닙니다.');
    const char=storyById(room.storyId).characters.find(c=>c.id===body.characterId);
    if(!char)fail(400,'존재하지 않는 캐릭터입니다.');
    if(room.players.some(p=>p!==player&&p.characterId===char.id))fail(409,'다른 참가자가 이미 선택한 캐릭터입니다.');
    player.characterId=char.id;
    if(room.players.every(p=>p.characterId)){
      phaseChange(room,'study',sid);
      room.players.forEach(p=>p.studyReady=false);
      const game=gameFor(room);
      room.mapPositions={};
      if(game?.floorplan||game?.floors?.length){
        for(const p of room.players){
          const spawn=game.spawn?.[p.characterId]||game.floorplan?.spawn?.[p.characterId];
          if(spawn)room.mapPositions[p.id]={floor:spawn.floor||'ground',x:spawn.x,y:spawn.y};
        }
      }
      // phaseChange has already recorded the transition.
    }
    logActivity('character_selected',sid,{room:room.id,character:char.id});
    persist();sendState(room);return json(res,200,roomView(room,sid));
  }
  if(action==='study-ready'){
    if(room.phase!=='study')fail(409,'캐릭터 숙지 단계가 아닙니다.');
    if(!player.characterId)fail(403,'캐릭터가 배정되지 않았습니다.');
    player.studyReady=true;
    logActivity('study_ready',sid,{room:room.id});
    if(room.players.every(p=>p.studyReady)){
      const info=gameFor(room).investigation;
      room.investigation={tokens:Object.fromEntries(room.players.map(p=>[p.id,info?.tokensPerPlayer||4])),
        reserved:{},discovered:{},collected:{}};
      phaseChange(room,'investigation1',sid);
    }
    persist();sendState(room);
    return json(res,200,roomView(room,sid));
  }
  if(action==='move'){
    if(!['study','investigation1'].includes(room.phase))fail(409,'현재 지도 이동 단계가 아닙니다.');
    if(!player.characterId)fail(403,'캐릭터가 배정되지 않았습니다.');
    const current=positionFor(room,player);
    const floorplan=current&&floorFor(room,current.floor);
    if(!floorplan||!current)fail(409,'이 시나리오에는 이동 가능한 지도가 없습니다.');
    const steps={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
    if(typeof body.direction!=='string'||!Object.hasOwn(steps,body.direction))fail(400,'잘못된 이동 방향입니다.');
    const lastKey=room.id+':'+sid;
    if(Date.now()-(lastMoves.get(lastKey)||0)<120)fail(429,'이동 요청이 너무 빠릅니다.');
    const previous=current;
    const [dx,dy]=steps[body.direction];
    const x=previous.x+dx,y=previous.y+dy;
    if(y<0||y>=floorplan.tiles.length||x<0||x>=floorplan.tiles[y].length||
      floorplan.tiles[y][x]!=='.')fail(409,'벽이나 지도 밖으로 이동할 수 없습니다.');
    const next={floor:current.floor,x,y};
    const door=(floorplan.doors||[]).find(d=>d.x===x&&d.y===y);
    if(door&&door.locked&&!room.openDoors?.[floorplan.id+':'+door.id])
      fail(409,'잠긴 문입니다. 근처에서 문 열기 액션을 사용하세요.');
    if(occupantCount(room,next,player.id)>=(gameFor(room).investigation?.maxTileOccupants||3))
      fail(409,'해당 타일의 최대 인원을 초과했습니다.');
    room.mapPositions[player.id]=next;
    pruneWhispers(room); // leaving the tile also leaves its private voice group
    lastMoves.set(lastKey,Date.now());
    persist();sendState(room);
    return json(res,200,roomView(room,sid));
  }
  if(action==='interact'){
    if(!['study','investigation1'].includes(room.phase))fail(409,'현재 상호작용 가능한 단계가 아닙니다.');
    const pos=positionFor(room,player),floor=pos&&floorFor(room,pos.floor);
    if(!floor)fail(409,'플레이어의 지도 위치를 찾을 수 없습니다.');
    if(body.kind==='portal'){
      const index=body.portalIndex;
      if(!Number.isInteger(index)||index<0||index>=(floor.portals||[]).length)
        fail(400,'유효하지 않은 이동 액션입니다.');
      const portal=floor.portals[index];
      if(portal.x!==pos.x||portal.y!==pos.y)
        fail(409,'이동 타일 위에서만 이 액션을 사용할 수 있습니다.');
      const dest=floorFor(room,portal.toFloor);
      const next={floor:portal.toFloor,x:portal.toX,y:portal.toY};
      if(!dest||dest.tiles[portal.toY]?.[portal.toX]!=='.')
        fail(409,'목적지 타일로 이동할 수 없습니다.');
      const door=(dest.doors||[]).find(d=>d.x===next.x&&d.y===next.y);
      if(door&&door.locked&&!room.openDoors?.[dest.id+':'+door.id])
        fail(409,'목적지에 잠긴 문이 있습니다.');
      if(occupantCount(room,next,player.id)>=(gameFor(room).investigation?.maxTileOccupants||3))
        fail(409,'목적지 타일 정원이 가득 찼습니다.');
      room.mapPositions[player.id]=next;
      pruneWhispers(room);persist();sendState(room);
      logActivity('portal_used',sid,{room:room.id,to:next.floor});
      return json(res,200,roomView(room,sid));
    }
    if(body.kind==='door'){
      const door=(floor.doors||[]).find(d=>d.id===body.doorId);
      if(!door)fail(404,'문을 찾을 수 없습니다.');
      if(Math.abs(door.x-pos.x)+Math.abs(door.y-pos.y)>1)fail(409,'문 옆에서 열기를 시도하세요.');
      if(!door.locked||room.openDoors?.[floor.id+':'+door.id])
        return json(res,200,roomView(room,sid));
      const initial=gameFor(room).booklets?.[player.characterId]?.inventory||[];
      const collected=room.investigation?.collected?.[player.id]||[];
      if(door.requiresItem&&![...initial,...collected].some(i=>i.id===door.requiresItem))
        fail(403,'이 문을 열 열쇠나 필수 아이템이 없습니다.');
      room.openDoors||={};
      room.openDoors[floor.id+':'+door.id]=true;
      persist();sendState(room);logActivity('door_unlocked',sid,{room:room.id,door:door.id});
      return json(res,200,roomView(room,sid));
    }
    fail(400,'지원하지 않는 지도 상호작용입니다.');
  }
  if(action==='reserve'||action==='release'||action==='investigate'){
    if(room.phase!=='investigation1')fail(409,'1차 조사 단계가 아닙니다.');
    const spec=gameFor(room).investigation;
    const card=spec?.cards.find(c=>c.id===body.cardId);
    if(!card)fail(404,'조사 카드를 찾을 수 없습니다.');
    const data=room.investigation;
    const held=activeReservation(room,card.id),mine=held?.playerId===player.id;
    if(action==='release'){
      if(mine){delete data.reserved[card.id];persist();sendState(room)}
      return json(res,200,roomView(room,sid));
    }
    if(!cardUnlocked(card,room))fail(409,'해금 조건을 충족하지 않았습니다.');
    if(card.owner===player.characterId||(card.blockedFor||[]).includes(player.characterId))
      fail(403,'이 캐릭터는 해당 카드를 조사할 수 없습니다.');
    if((data.discovered[card.id]||[]).length&&!card.repeatable)
      fail(409,'이미 다른 플레이어가 조사한 카드입니다.');
    if((data.tokens[player.id]||0)<1)fail(409,'조사 토큰이 부족합니다.');
    if(held&&!mine)fail(409,'다른 플레이어가 먼저 선점한 카드입니다.');
    if(action==='reserve'){
      for(const [otherId,r] of Object.entries(data.reserved))if(r.playerId===player.id)delete data.reserved[otherId];
      data.reserved[card.id]={playerId:player.id,expiresAt:Date.now()+reservationTtl};
      persist();sendState(room);
      return json(res,200,roomView(room,sid));
    }
    if(!mine)fail(409,'먼저 카드를 선택해 선점해야 합니다.');
    // Consume the sole reservation and token synchronously before returning.
    // Node's event loop executes these mutations atomically between awaits.
    delete data.reserved[card.id];
    data.tokens[player.id]--;
    data.discovered[card.id] ||= [];
    data.discovered[card.id].push({playerId:player.id,at:Date.now()});
    if(card.grant){
      data.collected[player.id] ||= [];
      data.collected[player.id].push(card.grant);
    }
    logActivity('card_investigated',sid,{room:room.id,card:card.id});
    persist();sendState(room);
    return json(res,200,roomView(room,sid));
  }
  if(action==='signal'){
    if(!['study','investigation1'].includes(room.phase))fail(409,'현재 음성 통화 단계가 아닙니다.');
    const target=room.players.find(p=>p.id===body.to);
    if(!target||target.id===player.id)fail(400,'유효하지 않은 수신자입니다.');
    if(!['offer','answer','ice','hello','bye'].includes(body.type))fail(400,'유효하지 않은 신호 형식입니다.');
    if(!body.payload||typeof body.payload!=='object'||JSON.stringify(body.payload).length>16000)
      fail(400,'신호 데이터가 잘못되었습니다.');
    const history=signals.get(room.id)||[];
    const seq=(history[history.length-1]?.id||0)+1;
    history.push({id:seq,from:player.id,to:target.id,type:body.type,payload:body.payload});
    if(history.length>300)history.splice(0,history.length-300);
    signals.set(room.id,history);
    return json(res,200,{ok:true});
  }
  if(['whisper-request','whisper-vote','whisper-leave'].includes(action)){
    if(!['study','investigation1'].includes(room.phase))fail(409,'현재 밀담을 사용할 수 없습니다.');
    const ws=whisperState(room);pruneWhispers(room);
    const pos=positionFor(room,player);
    if(!pos)fail(409,'지도 위치가 없습니다.');
    const here=g=>g.floor===pos.floor&&g.x===pos.x&&g.y===pos.y;
    const group=ws.groups.find(g=>g.members.includes(player.id));
    if(action==='whisper-leave'){
      if(group)group.members=group.members.filter(id=>id!==player.id);
      ws.groups=ws.groups.filter(g=>g.members.length>=2);
      ws.proposals=ws.proposals.filter(p=>p.candidate!==player.id&&!p.voters.includes(player.id));
      persist();sendState(room);return json(res,200,roomView(room,sid));
    }
    if(action==='whisper-request'){
      if(group)fail(409,'이미 밀담 중입니다.');
      const active=ws.groups.find(here),playersHere=tilePlayers(room,pos);
      if(active){
        if(active.members.length>=(gameFor(room).investigation?.maxTileOccupants||3))
          fail(409,'밀담 최대 인원에 도달했습니다.');
        if(ws.proposals.some(p=>p.groupId===active.id))fail(409,'이미 진행 중인 밀담 승인 요청이 있습니다.');
        ws.proposals.push({id:randomId(5),kind:'join',groupId:active.id,candidate:player.id,
          floor:pos.floor,x:pos.x,y:pos.y,voters:[...active.members],yes:[],expiresAt:Date.now()+60000});
      }else{
        if(playersHere.length<2)fail(409,'같은 타일에 다른 사람이 있어야 밀담을 시작할 수 있습니다.');
        if(ws.proposals.some(p=>p.kind==='create'&&here(p)))fail(409,'이 타일에는 이미 밀담 요청이 있습니다.');
        const voters=playersHere.filter(p=>!ws.groups.some(g=>g.members.includes(p.id))).map(p=>p.id);
        ws.proposals.push({id:randomId(5),kind:'create',candidate:player.id,
          floor:pos.floor,x:pos.x,y:pos.y,voters,yes:[player.id],expiresAt:Date.now()+60000});
      }
    }else{
      const proposal=ws.proposals.find(p=>p.id===body.proposalId);
      if(!proposal||!proposal.voters.includes(player.id))fail(403,'밀담 승인 권한이 없습니다.');
      if(!here(proposal))fail(409,'밀담 타일 밖에서는 승인할 수 없습니다.');
      if(body.accept!==true){
        ws.proposals=ws.proposals.filter(p=>p!==proposal);
      }else{
        if(!proposal.yes.includes(player.id))proposal.yes.push(player.id);
        if(proposal.voters.every(id=>proposal.yes.includes(id))){
          if(proposal.kind==='create'){
            const members=proposal.voters.filter(id=>tilePlayers(room,pos).some(p=>p.id===id));
            if(members.length>=2&&members.length<=(gameFor(room).investigation?.maxTileOccupants||3)){
              ws.groups.push({id:randomId(6),members,floor:pos.floor,x:pos.x,y:pos.y});
            }
          }else{
            const current=ws.groups.find(g=>g.id===proposal.groupId);
            const candidate=room.players.find(p=>p.id===proposal.candidate);
            const candidatePos=candidate&&positionFor(room,candidate);
            if(current&&candidatePos&&here(candidatePos)&&
                current.members.length<(gameFor(room).investigation?.maxTileOccupants||3))
              current.members.push(candidate.id);
          }
          ws.proposals=ws.proposals.filter(p=>p!==proposal);
        }
      }
    }
    logActivity('whisper_'+action,sid,{room:room.id});
    persist();sendState(room);
    return json(res,200,roomView(room,sid));
  }
  fail(404,'지원하지 않는 동작입니다.');
}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.webp':'image/webp','.woff2':'font/woff2'};
function staticFile(req,res,url,sid){
  let name;
  try{name=decodeURIComponent(url.pathname)}catch(e){fail(400,'잘못된 경로입니다.')}
  if(name==='/'||name==='/index.html')name='/index.html';
  if(name==='/mars')name='/apps/terraforming-mars/index.html';
  if(name==='/mystery'||name==='/mystery/')name='/apps/murder-mystery/index.html';
  if(name==='/mystery-editor'||name==='/mystery-editor/')name='/apps/murder-mystery/editor.html';
  if(name.endsWith('/'))name+='index.html';
  const resolved=path.resolve(ROOT,'.'+name);
  if(!resolved.startsWith(ROOT+path.sep)||name.split('/').some(p=>['data','.git','node_modules','tests','.github','private','mystery-content'].includes(p))||['/server.js','/package.json','/Dockerfile','/.dockerignore','/.gitignore'].includes(name))fail(403,'접근할 수 없는 경로입니다.');
  const ext=path.extname(resolved).toLowerCase();
  if(!MIME[ext])fail(404,'지원하지 않는 파일입니다.');
  let stat;
  try{stat=fs.statSync(resolved)}catch(e){fail(404,'파일을 찾을 수 없습니다.')}
  if(!stat.isFile())fail(404,'파일을 찾을 수 없습니다.');
  if(ext==='.html')logActivity('page_view',sid,{page:name});
  res.writeHead(200,{'Content-Type':MIME[ext],'Content-Length':stat.size,'X-Content-Type-Options':'nosniff','Cache-Control':ext==='.html'?'no-store':'public, max-age=120'});
  if(req.method==='HEAD'){res.end();return;}
  fs.createReadStream(resolved).pipe(res);
}
const handler=(req,res)=>{
  Promise.resolve().then(async()=>{
    const url=new URL(req.url,'http://localhost');
    // Healthcheck must not create sessions, mutate storage, or fill activity logs.
    if(url.pathname==='/healthz'&&req.method==='GET')return json(res,200,{ok:true});
    const sid=sessionFor(req,res);
    if(url.pathname.startsWith('/api/'))return api(req,res,url,sid);
    if(req.method!=='GET'&&req.method!=='HEAD')fail(405,'지원하지 않는 HTTP 메서드입니다.');
    staticFile(req,res,url,sid);
  }).catch(e=>{
    if(res.headersSent){res.end();return;}
    const status=e.status||500;
    if(status===500)console.error(e);
    json(res,status,{error:status===500?'서버 오류가 발생했습니다.':e.message});
  });
};
if(require.main===module)http.createServer(handler).listen(PORT,HOST,()=>console.log('Rice Eaters: http://localhost:'+PORT+' (host '+HOST+')'));
module.exports={handler,STORIES};
