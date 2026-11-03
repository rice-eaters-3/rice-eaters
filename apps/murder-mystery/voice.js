'use strict';
// Opt-in browser-to-browser microphone communication. Cloudflare Tunnel supplies
// HTTPS/signaling, not an SFU or TURN relay. Public STUN can fail on restrictive NAT.
window.MysteryVoice=(function(){
  let stream=null,room=null,timer=null,cursor=0,enabled=false,muted=false,speakerMuted=false,busy=false;
  const peers=new Map(),audio=new Map();
  // Walls and closed doors are acoustic barriers; Manhattan/BFS path length
  // rather than straight-line distance controls whether sound can travel.
  function acousticDistance(map,from,to){
    if(!map||!from||!to||from.floor!==to.floor||map.floorId!==from.floor)
      return Infinity;
    const rows=map.tiles||[];
    const blocked=new Set((map.doors||[]).filter(d=>!d.open).map(d=>d.x+','+d.y));
    const valid=(x,y)=>rows[y]?.[x]==='.'&&!blocked.has(x+','+y);
    if(!valid(from.x,from.y)||!valid(to.x,to.y))return Infinity;
    const start=from.x+','+from.y,visited=new Set([start]);
    const pending=[{x:from.x,y:from.y,d:0}];
    for(let i=0;i<pending.length;i++){
      const p=pending[i];
      if(p.x===to.x&&p.y===to.y)return p.d;
      if(p.d>=12)continue; // Beyond the audible range.
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const x=p.x+dx,y=p.y+dy,key=x+','+y;
        if(valid(x,y)&&!visited.has(key)){visited.add(key);pending.push({x,y,d:p.d+1});}
      }
    }
    return Infinity;
  }
  function playerPosition(id){return room?.players.find(p=>p.id===id)?.position||null}
  function soundDistance(from,to){return acousticDistance(room?.map,playerPosition(from),playerPosition(to))}
  function canTransmit(from,to){return allowedToHear(from,to)&&Number.isFinite(soundDistance(from,to))}

  const valid=()=>!!(room?.me&&['study','investigation1'].includes(room.phase));
  async function send(to,type,payload={}){
    if(!room?.code)return;
    try{await api('/api/rooms/'+room.code+'/signal','POST',{to,type,payload});}
    catch(e){console.warn('Voice signaling',e.message);}
  }
  function closePeer(id){
    peers.get(id)?.pc.close();peers.delete(id);
    const sound=audio.get(id);
    if(sound){sound.pause();sound.srcObject=null;sound.remove();audio.delete(id)}
  }
  function getPeer(id){
    if(peers.has(id))return peers.get(id);
    const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    const peer={pc,pending:[]};peers.set(id,peer);
    for(const track of stream?.getTracks()||[])peer.audioSender=pc.addTrack(track,stream);
    if(peer.audioSender&&room&&!canTransmit(room.me,id))
      peer.audioSender.replaceTrack(null).catch(()=>{});
    pc.onicecandidate=e=>{if(e.candidate)send(id,'ice',{candidate:e.candidate.toJSON()})};
    pc.ontrack=e=>{
      let node=audio.get(id);
      if(!node){node=document.createElement('audio');node.autoplay=true;node.playsInline=true;node.dataset.peer=id;
        document.body.appendChild(node);audio.set(id,node);}
      node.srcObject=e.streams[0]||new MediaStream([e.track]);
      node.play().catch(()=>{});
      enforceOutgoingPrivacy();volumes();
    };
    pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(pc.connectionState))closePeer(id)};
    return peer;
  }
  async function offer(id){
    const p=getPeer(id);
    if(p.pc.signalingState!=='stable')return;
    try{const desc=await p.pc.createOffer();await p.pc.setLocalDescription(desc);
      await send(id,'offer',{sdp:p.pc.localDescription.toJSON()});}
    catch(e){console.warn('offer',e);}
  }
  async function receive(msg){
    if(!enabled||!room?.players.some(p=>p.id===msg.from))return;
    const id=msg.from;
    try{
      if(msg.type==='bye'){closePeer(id);return}
      if(msg.type==='hello'){
        // The smaller player ID always offers, preventing offer glare.
        if(room.me<id)await offer(id);
        return;
      }
      const p=getPeer(id);
      if(msg.type==='offer'){
        await p.pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
        const desc=await p.pc.createAnswer();await p.pc.setLocalDescription(desc);
        await send(id,'answer',{sdp:p.pc.localDescription.toJSON()});
      }else if(msg.type==='answer'){
        if(p.pc.signalingState==='have-local-offer')await p.pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
      }else if(msg.type==='ice'&&msg.payload.candidate){
        if(p.pc.remoteDescription)await p.pc.addIceCandidate(new RTCIceCandidate(msg.payload.candidate));
        else p.pending.push(msg.payload.candidate);
      }
      if(p.pc.remoteDescription)for(const c of p.pending.splice(0))await p.pc.addIceCandidate(new RTCIceCandidate(c));
    }catch(e){console.warn('Peer signal failed',e);}
  }
  async function tick(){
    if(!enabled||busy||!valid())return;
    busy=true;
    try{
      const packet=await api('/api/rooms/'+room.code+'/signals?after='+cursor);
      for(const msg of packet.signals||[])await receive(msg);
      cursor=packet.cursor;
      volumes();
    }catch(e){console.warn('voice poll',e.message)}
    finally{busy=false}
  }
  function allowedToHear(speaker,listener){
    const groups=room?.whispers?.groups||[];
    const g=groups.find(v=>v.members.includes(speaker));
    // If the sender is whispering, their voice is private to that group.
    return !g||g.members.includes(listener);
  }
  function enforceOutgoingPrivacy(){
    if(!enabled||!room)return;
    const audioTrack=stream?.getAudioTracks()[0];
    if(!audioTrack)return;
    for(const [peerId,p] of peers){
      const target=canTransmit(room.me,peerId)?audioTrack:null;
      if(p.audioSender&&p.audioSender.track!==target)
        p.audioSender.replaceTrack(target).catch(e=>console.warn('Private voice routing',e));
    }
  }
  function volumes(){
    if(!room?.me)return;
    for(const [id,node] of audio){
      node.muted=speakerMuted;
      const distance=soundDistance(id,room.me);
      if(!enabled||speakerMuted||!Number.isFinite(distance)||!allowedToHear(id,room.me)){
        node.volume=0;continue;
      }
      node.volume=Math.max(0.035,Math.min(1,1/(1+distance*0.38)));
    }
  }
  async function enable(){
    if(enabled)return;
    if(!valid())throw Error('캐릭터 숙지 또는 조사 단계에서 음성을 사용할 수 있습니다.');
    if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)
      throw Error('브라우저에서 WebRTC 마이크를 지원하지 않습니다. HTTPS로 접속해 주세요.');
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    enabled=true;muted=false;cursor=0;
    timer=setInterval(tick,900);
    for(const p of room.players)if(p.id!==room.me)await send(p.id,'hello');
    tick();
  }
  function disable(){
    if(enabled&&room)for(const p of room.players)if(p.id!==room.me)send(p.id,'bye');
    enabled=false;clearInterval(timer);timer=null;
    for(const id of [...peers.keys()])closePeer(id);
    for(const track of stream?.getTracks()||[])track.stop();
    stream=null;
  }
  function toggleMute(){
    if(!enabled)return;
    muted=!muted;
    for(const track of stream?.getAudioTracks()||[])track.enabled=!muted;
  }
  function toggleSpeaker(){
    speakerMuted=!speakerMuted;
    volumes();
  }
  function sync(r){
    const previous=room?.code;
    if(previous&&previous!==r?.code)disable();
    room=r;
    if(!valid()){if(enabled)disable();return}
    enforceOutgoingPrivacy();volumes();
  }
  function controls(){
    return '<div class="eyebrow">PROXIMITY VOICE · WEBRTC</div><h3>근접 음성</h3>'+
      '<p class="muted small">같은 층에서 가까울수록 크게 들립니다. 마이크 사용은 직접 허용해야 합니다.</p>'+
      (enabled?'<span class="voice-status">● 통화 연결 중</span>':'<span class="voice-status">○ 연결되지 않음</span>')+
      '<div class="voice-switches">'+
      (enabled?btn('voice-mute',muted?'🎙 마이크 OFF · 켜기':'🎙 마이크 ON · 끄기','btn btn-outline btn-sm'):
        btn('voice-on','🎙 마이크 연결하기','btn btn-primary btn-sm'))+
      btn('speaker-mute',speakerMuted?'🔇 스피커 OFF · 켜기':'🔊 스피커 ON · 끄기',
        'btn btn-outline btn-sm')+
      (enabled?btn('voice-off','통화 연결 종료','btn btn-quiet btn-sm'):'')+'</div>'+
      '<p class="muted small">마이크 OFF여도 다른 사람의 음성은 들을 수 있고, 스피커 OFF여도 내 마이크는 독립적으로 동작합니다.</p>'+
      '<p class="muted small">서로 다른 네트워크에서는 TURN 서버가 없어 연결되지 않을 수 있습니다.</p>';
  }
  return {enable,disable,toggleMute,toggleSpeaker,sync,controls,acousticDistance,
    get enabled(){return enabled},get micMuted(){return muted},get speakerMuted(){return speakerMuted}};
})();
