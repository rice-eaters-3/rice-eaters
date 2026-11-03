'use strict';
// Two independent controls: mic sends audio; speaker plays incoming audio.
// Listener-only mode requires no microphone permission. Peer connections use STUN;
// a TURN relay is still necessary for reliable cross-NAT audio.
window.MysteryVoice=(function(){
  let stream=null,room=null,timer=null,cursor=0,active=false,micOn=false,speakerOn=false,busy=false;
  const peers=new Map(),audio=new Map();
  const valid=()=>!!(room?.me&&['study','investigation1'].includes(room.phase));
  async function send(to,type,payload={}){
    if(!room?.code)return;
    try{await api('/api/rooms/'+room.code+'/signal','POST',{to,type,payload})}
    catch(e){console.warn('Voice signaling',e.message)}
  }
  function closePeer(id){
    const p=peers.get(id);
    if(p){p.pc.close();peers.delete(id)}
    const node=audio.get(id);
    if(node){node.pause();node.srcObject=null;node.remove();audio.delete(id)}
  }
  function allowedToHear(speaker,listener){
    const group=(room?.whispers?.groups||[]).find(g=>g.members.includes(speaker));
    return !group||group.members.includes(listener);
  }
  function acousticDistance(from,to){
    return window.MysteryAcoustics?.distance(room,from,to)??Infinity;
  }
  function routeOutgoing(){
    if(!room)return;
    const track=micOn?stream?.getAudioTracks()[0]||null:null;
    for(const [id,p] of peers){
      const d=acousticDistance(room.me,id);
      const target=track&&allowedToHear(room.me,id)&&Number.isFinite(d)&&
        window.MysteryAcoustics.gain(d)>0?track:null;
      p.targetTrack=target;
      // Queue replacements; rapid movement/door transitions must not restore
      // a previously permitted microphone track after a later block.
      p.replaceQueue=(p.replaceQueue||Promise.resolve()).then(async()=>{
        if(p.pc.signalingState!=='closed'&&p.audioSender.track!==p.targetTrack)
          await p.audioSender.replaceTrack(p.targetTrack);
      }).catch(err=>console.warn('Voice privacy update',err));
    }
  }
  function volumes(){
    if(!room?.me)return;
    for(const [id,node] of audio){
      const d=acousticDistance(id,room.me);
      const gain=speakerOn&&allowedToHear(id,room.me)?
        (window.MysteryAcoustics?.gain(d)||0):0;
      node.muted=!speakerOn||gain===0;
      node.volume=gain;
    }
  }
  function getPeer(id){
    if(peers.has(id))return peers.get(id);
    const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    // Negotiate sendrecv once. Adding a microphone later only replaces this
    // sender's track, avoiding repeated renegotiation and listen-only failures.
    const transceiver=pc.addTransceiver('audio',{direction:'sendrecv'});
    const p={pc,audioSender:transceiver.sender,targetTrack:null,replaceQueue:Promise.resolve(),pending:[]};
    peers.set(id,p);
    pc.onicecandidate=e=>{if(e.candidate)send(id,'ice',{candidate:e.candidate.toJSON()})};
    pc.ontrack=e=>{
      let node=audio.get(id);
      if(!node){
        node=document.createElement('audio');node.autoplay=true;node.playsInline=true;
        node.dataset.peer=id;node.muted=true;
        document.body.appendChild(node);audio.set(id,node);
      }
      node.srcObject=e.streams[0]||new MediaStream([e.track]);
      volumes();
      if(speakerOn)node.play().catch(()=>{});
    };
    pc.onconnectionstatechange=()=>{
      if(['failed','closed'].includes(pc.connectionState))closePeer(id);
    };
    routeOutgoing();
    return p;
  }
  async function offer(id){
    const p=getPeer(id);
    if(p.pc.signalingState!=='stable')return;
    try{
      const description=await p.pc.createOffer();await p.pc.setLocalDescription(description);
      await send(id,'offer',{sdp:p.pc.localDescription.toJSON()});
    }catch(e){console.warn('WebRTC offer',e)}
  }
  async function receive(msg){
    if(!active||!room?.players.some(p=>p.id===msg.from))return;
    const id=msg.from;
    try{
      if(msg.type==='bye'){closePeer(id);return}
      if(msg.type==='hello'){
        if(room.me<id)await offer(id);
        return;
      }
      const p=getPeer(id);
      if(msg.type==='offer'){
        await p.pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
        const desc=await p.pc.createAnswer();await p.pc.setLocalDescription(desc);
        await send(id,'answer',{sdp:p.pc.localDescription.toJSON()});
      }else if(msg.type==='answer'){
        if(p.pc.signalingState==='have-local-offer')
          await p.pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
      }else if(msg.type==='ice'&&msg.payload.candidate){
        if(p.pc.remoteDescription)await p.pc.addIceCandidate(new RTCIceCandidate(msg.payload.candidate));
        else p.pending.push(msg.payload.candidate);
      }
      if(p.pc.remoteDescription)
        for(const candidate of p.pending.splice(0))
          await p.pc.addIceCandidate(new RTCIceCandidate(candidate));
      routeOutgoing();volumes();
    }catch(e){console.warn('WebRTC signal',e)}
  }
  async function tick(){
    if(!active||busy||!valid())return;
    busy=true;
    try{
      const packet=await api('/api/rooms/'+room.code+'/signals?after='+cursor);
      for(const msg of packet.signals||[])await receive(msg);
      cursor=packet.cursor;volumes();
    }catch(e){console.warn('Voice signal polling',e.message)}
    finally{busy=false}
  }
  async function start(){
    if(active)return;
    if(!valid())throw Error('음성은 캐릭터 숙지 또는 조사 단계에서 사용할 수 있습니다.');
    if(!window.RTCPeerConnection)throw Error('이 브라우저에서 WebRTC를 지원하지 않습니다.');
    active=true;cursor=0;
    timer=setInterval(tick,900);
    for(const p of room.players)if(p.id!==room.me)await send(p.id,'hello');
    tick();
  }
  async function setMicrophone(on){
    if(!on){
      micOn=false;routeOutgoing();
      for(const track of stream?.getTracks()||[])track.stop();
      stream=null;
      if(!speakerOn)disable();
      return;
    }
    if(micOn)return;
    if(!navigator.mediaDevices?.getUserMedia)
      throw Error('마이크는 HTTPS 또는 localhost의 지원 브라우저에서만 켤 수 있습니다.');
    const acquired=await navigator.mediaDevices.getUserMedia({
      audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false
    });
    stream=acquired;micOn=true;
    try{await start();routeOutgoing()}
    catch(e){micOn=false;for(const t of acquired.getTracks())t.stop();stream=null;throw e}
  }
  async function setSpeaker(on){
    if(!on){speakerOn=false;volumes();if(!micOn)disable();return}
    if(speakerOn)return;
    speakerOn=true;
    try{await start()}catch(e){speakerOn=false;throw e}
    volumes();
    for(const node of audio.values())node.play().catch(()=>{});
  }
  function disable(){
    if(active&&room)
      for(const p of room.players)if(p.id!==room.me)send(p.id,'bye');
    active=false;micOn=false;speakerOn=false;clearInterval(timer);timer=null;
    for(const id of [...peers.keys()])closePeer(id);
    for(const track of stream?.getTracks()||[])track.stop();
    stream=null;
  }
  function sync(next){
    const prev=room?.code;
    if(prev&&prev!==next?.code)disable();
    room=next;
    if(!valid()){if(active)disable();return}
    routeOutgoing();volumes();
  }
  function controls(){
    return '<div class="voice-controls"><div class="eyebrow">PROXIMITY VOICE · WEBRTC</div><h3>근접 음성</h3>'+
      '<p class="muted small">마이크와 스피커를 각각 제어할 수 있습니다. 닫힌 문과 벽은 소리를 차단합니다.</p>'+
      '<div class="voice-toggle-grid">'+
      btn('voice-mic',micOn?'🎙 마이크 끄기':'🎙 마이크 켜기',
        'btn btn-sm '+(micOn?'btn-primary':'btn-outline'),false,
        'aria-pressed="'+micOn+'"')+
      btn('voice-speaker',speakerOn?'🔊 스피커 끄기':'🔇 스피커 켜기',
        'btn btn-sm '+(speakerOn?'btn-primary':'btn-outline'),false,
        'aria-pressed="'+speakerOn+'"')+'</div>'+
      '<p class="voice-status">'+(micOn?'● 마이크 전송 중':'○ 마이크 전송 안 함')+
        ' · '+(speakerOn?'상대 음성 듣는 중':'상대 음성 음소거')+'</p>'+
      '<p class="muted small">네트워크에 따라 TURN 중계 서버 없이는 통화 연결이 실패할 수 있습니다.</p></div>';
  }
  return {
    setMicrophone,setSpeaker,disable,sync,controls,
    get micOn(){return micOn},get speakerOn(){return speakerOn},get enabled(){return active}
  };
})();
