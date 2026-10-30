'use strict';
// One server for the app library, solo Mars saves, and realtime mystery rooms.
// Node.js 20+; no npm packages or external services required.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
// Railway volumes expose this automatically; DATA_DIR can override for other hosts.
const DATA_DIR = path.resolve(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(ROOT, 'data'));
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const LOG_FILE = path.join(DATA_DIR, 'activity.jsonl');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
fs.mkdirSync(DATA_DIR, {recursive: true});

const STORIES = [
  {
    id: 'midnight-manor', title: '자정의 저택', subtitle: '폭풍우가 잠든 밤, 닫힌 문 뒤의 진실',
    genre: '고딕 미스터리', minutes: 90, players: 4,
    teaser: '유산 공개를 앞둔 저택의 주인이 서재에서 숨진 채 발견되었다. 폭풍우 속에 머물던 네 명의 손님 모두에게는 감추고 싶은 비밀이 있다.',
    synopsis: [
      '1928년 10월 31일. 외딴 언덕의 「까마귀 저택」에는 폭풍우가 몰아치고 있습니다. 저택의 주인 에드워드 블랙우드는 네 사람에게 한 통의 편지를 보냈습니다. “오늘 밤, 내 유언과 오래된 사건의 진실을 공개하겠소.”',
      '밤 11시 47분, 정전과 함께 서재에서 둔탁한 소리가 울렸습니다. 문을 부수고 들어간 사람들은 책상 옆에 쓰러진 에드워드를 발견합니다. 문은 안쪽에서 잠겨 있었고, 열린 창문 밖으로는 빗물에 젖은 발자국이 보입니다.',
      '전화선은 끊겼고 다리마저 무너졌습니다. 구조대가 아침에 도착하기 전까지 여러분은 이곳을 떠날 수 없습니다. 서로의 이야기를 듣고, 증거를 모으고, 진실을 찾아내십시오. 누군가는 정답을 알고 있을지도 모릅니다.'
    ],
    characters: [
      {id:'elena',name:'엘레나 블랙우드',role:'저택 주인의 조카',hint:'오래된 가족사진을 품은 상속 후보.',symbol:'♜',accent:'#b48bd8'},
      {id:'victor',name:'빅터 헤일',role:'저택의 주치의',hint:'사망 시각에 대해 남다른 지식을 가진 의사.',symbol:'⚕',accent:'#82b8b4'},
      {id:'iris',name:'아이리스 모건',role:'취재 기자',hint:'초대받지 않았지만 누구보다 많은 질문을 가진 손님.',symbol:'✒',accent:'#dca772'},
      {id:'noah',name:'노아 그레이',role:'저택 관리인',hint:'복도와 열쇠에 관해서는 누구보다 잘 아는 인물.',symbol:'⚿',accent:'#98a8ce'}
    ]
  }
];
const storyById = (id) => STORIES.find(s => s.id === id);
const cleanName = (name) => typeof name === 'string' ? name.trim().replace(/\s+/g,' ').slice(0,18) : '';
const randomId = (n=20) => crypto.randomBytes(n).toString('hex');
const readState = () => {
  try {
    const parsed=JSON.parse(fs.readFileSync(STATE_FILE,'utf8'));
    return {rooms:parsed.rooms||{},sessions:parsed.sessions||{},mars:parsed.mars||{}};
  } catch(e) {
    if(e.code==='ENOENT') return {rooms:{},sessions:{},mars:{}};
    throw e; // never silently overwrite a corrupted save
  }
};
const db=readState();
const streams=new Map();
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
function online(room,p){return !!streams.get(room.id)?.get(p.sid)?.size;}
function publicStory(story){
  return {id:story.id,title:story.title,subtitle:story.subtitle,teaser:story.teaser,genre:story.genre,minutes:story.minutes,players:story.players};
}
function roomView(room,sid){
  const story=storyById(room.storyId);
  const isMember=room.players.some(p=>p.sid===sid);
  return {
    code:room.id, phase:room.phase, story:publicStory(story),
    hostId:room.players.find(p=>p.sid===room.host)?.id||null,
    me:room.players.find(p=>p.sid===sid)?.id||null,
    players:room.players.map(p=>({id:p.id,name:p.name,read:!!p.read,
      characterId:room.phase==='characters'?p.characterId:null,online:online(room,p)})),
    synopsis:isMember&&room.phase!=='lobby'?story.synopsis:null,
    characters:isMember&&room.phase==='characters'?story.characters:null
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
  own.add(res);sendState(room);
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
function validateOrigin(req){
  const origin=req.headers.origin;
  if(origin && origin!==('http://'+req.headers.host) && origin!==('https://'+req.headers.host)) fail(403,'다른 출처의 요청은 허용되지 않습니다.');
}
async function api(req,res,url,sid){
  const pathname=url.pathname;
  if(req.method==='GET'&&pathname==='/api/stories')return json(res,200,{stories:STORIES.map(publicStory)});
  if(req.method==='GET'&&pathname==='/api/mars/data'){
    return json(res,200,db.mars[sid]||{progress:null,records:[]});
  }
  if(req.method==='GET'&&pathname==='/api/events'){
    const room=roomOrFail(String(url.searchParams.get('room')||'').toUpperCase());
    ownedPlayer(room,sid);
    return subscribe(req,res,room,sid);
  }
  const match=pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|start|read|character|leave))?$/);
  if(req.method==='GET'&&match&&!match[2])return json(res,200,roomView(roomOrFail(match[1]),sid));
  if(!['POST','DELETE'].includes(req.method))fail(404,'API를 찾을 수 없습니다.');
  validateOrigin(req);
  const body=req.method==='POST'?await requestBody(req,6*1024*1024):{};
  if(pathname==='/api/rooms'&&req.method==='POST'){
    const story=storyById(body.storyId),name=cleanName(body.name);
    if(!story||!name)fail(400,'스토리와 표시 이름을 확인해주세요.');
    if(Object.keys(db.rooms).length>=200)fail(503,'현재 생성 가능한 방 수를 초과했습니다.');
    const code=roomCode(),player={id:randomId(8),sid,name,read:false,characterId:null};
    const room={id:code,storyId:story.id,host:sid,phase:'lobby',players:[player],createdAt:now()};
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
    if(!room.players.length)delete db.rooms[room.id];
    persist();logActivity('room_left',sid,{room:room.id});
    if(room.players.length)sendState(room);
    return json(res,200,{ok:true});
  }
  if(action==='start'){
    if(room.host!==sid)fail(403,'방장만 게임을 시작할 수 있습니다.');
    if(room.phase!=='lobby')fail(409,'이미 게임이 시작되었습니다.');
    if(room.players.length!==storyById(room.storyId).players)fail(409,'정원이 모두 모여야 시작할 수 있습니다.');
    if(!room.players.every(p=>online(room,p)))fail(409,'모든 참가자가 온라인이어야 시작할 수 있습니다.');
    room.phase='synopsis';
    room.players.forEach(p=>{p.read=false;p.characterId=null});
    logActivity('game_started',sid,{room:room.id});persist();sendState(room);
    return json(res,200,roomView(room,sid));
  }
  if(action==='read'){
    if(room.phase!=='synopsis')fail(409,'현재 시놉시스 확인 단계가 아닙니다.');
    player.read=true;
    if(room.players.every(p=>p.read)){room.phase='characters';logActivity('phase_characters',sid,{room:room.id})}
    logActivity('synopsis_read',sid,{room:room.id});persist();sendState(room);
    return json(res,200,roomView(room,sid));
  }
  if(action==='character'){
    if(room.phase!=='characters')fail(409,'현재 캐릭터 선택 단계가 아닙니다.');
    const char=storyById(room.storyId).characters.find(c=>c.id===body.characterId);
    if(!char)fail(400,'존재하지 않는 캐릭터입니다.');
    if(room.players.some(p=>p!==player&&p.characterId===char.id))fail(409,'다른 참가자가 이미 선택한 캐릭터입니다.');
    player.characterId=char.id;
    logActivity('character_selected',sid,{room:room.id,character:char.id});
    persist();sendState(room);return json(res,200,roomView(room,sid));
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
  if(name.endsWith('/'))name+='index.html';
  const resolved=path.resolve(ROOT,'.'+name);
  if(!resolved.startsWith(ROOT+path.sep)||name.split('/').some(p=>['data','.git','node_modules','tests','.github'].includes(p))||['/server.js','/package.json','/Dockerfile','/.dockerignore','/.gitignore'].includes(name))fail(403,'접근할 수 없는 경로입니다.');
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
