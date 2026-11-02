'use strict';
// Opt-in browser-to-browser microphone communication. Cloudflare Tunnel supplies
// HTTPS/signaling, not an SFU or TURN relay. Public STUN can fail on restrictive NAT.
window.MysteryVoice=(function(){
  let stream=null,room=null,timer=null,cursor=0,enabled=false,muted=false,busy=false;
  const peers=new Map(),audio=new Map();
  const escape=v=>escapeHtml(v);
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
    if(peer.audioSender&&room&&!allowedToHear(room.me,id))
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
      const target=allowedToHear(room.me,peerId)?audioTrack:null;
      if(p.audioSender&&p.audioSender.track!==target)
        p.audioSender.replaceTrack(target).catch(e=>console.warn('Private voice routing',e));
    }
  }
  function volumes(){
    if(!room?.me)return;
    const self=room.players.find(p=>p.id===room.me),a=self?.position;
    for(const [id,node] of audio){
      const p=room.players.find(p=>p.id===id),b=p?.position;
      if(!enabled||!a||!b||a.floor!==b.floor||!allowedToHear(id,room.me)){node.volume=0;continue}
      const distance=Math.hypot(a.x-b.x,a.y-b.y);
      node.volume=distance>12?0:Math.max(0.035,Math.min(1,1/(1+distance*0.38)));
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
    muted=!muted;for(const track of stream?.getAudioTracks()||[])track.enabled=!muted;
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
      (enabled?'<span class="voice-status">● 음성 연결 활성</span>'+btn('voice-mute',muted?'마이크 켜기':'마이크 음소거','btn btn-outline btn-sm')+
        btn('voice-off','음성 종료','btn btn-outline btn-sm'):
        btn('voice-on','🎙 마이크 켜기','btn btn-primary btn-sm'))+
      '<p class="muted small">서로 다른 네트워크에서는 TURN 서버가 없어 연결되지 않을 수 있습니다.</p>';
  }
  return {enable,disable,toggleMute,sync,controls,get enabled(){return enabled}};
})();
