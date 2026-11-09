'use strict';
// Two independent controls: mic sends audio; speaker plays incoming audio.
// Listener-only mode requires no microphone permission. Peer connections use STUN;
// a TURN relay is still necessary for reliable cross-NAT audio.
window.MysteryVoice=(function(){
  let stream=null,room=null,timer=null,cursor=0,active=false,micOn=false,speakerOn=false,busy=false;
  const peers=new Map(),audio=new Map();
  let audioContext=null,meterTimer=null;
  const meters=new Map(),talkUntil=new Map(),gains=new Map();
  function meter(id,stream){
    if(!audioContext||!stream)return;
    try{
      const source=audioContext.createMediaStreamSource(stream);
      const analyser=audioContext.createAnalyser();
      analyser.fftSize=512;
      source.connect(analyser);
      meters.get(id)?.source.disconnect();
      meters.set(id,{source,analyser,data:new Uint8Array(analyser.fftSize)});
    }catch(e){ /* Audio playback still works without a meter. */ }
  }
  async function enableMeters(){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return;
    try{
      audioContext=audioContext||new Context();
      await audioContext.resume();
      for(const [id,node] of audio)meter(id,node.srcObject);
      if(stream&&room?.me)meter(room.me,stream);
    }catch(e){ /* Audio playback still works without a meter. */ }
  }
  function status(id){
    if(!room)return {audible:false,label:'연결 대기'};
    if(id===room.me)return {audible:micOn,label:micOn?'내 마이크':'내 음소거'};
    if(room.players.find(p=>p.id===id)?.online===false)return {audible:false,label:'오프라인'};
    if(!allowedToHear(id,room.me))return {audible:false,label:'밀담 외부'};
    if(!speakerOn)return {audible:false,label:'듣기 꺼짐'};
    if(!gains.get(id))return {audible:false,label:'범위 밖'};
    const node=audio.get(id);
    if(!node||node.paused||peers.get(id)?.pc.connectionState!=='connected')return {audible:false,label:'연결 대기'};
    return {audible:true,label:'수신 가능'};
  }
  function paintMeters(){
    const now=Date.now();
    for(const [id,{analyser,data}] of meters){
      if(!status(id).audible){talkUntil.delete(id);continue;}
      analyser.getByteTimeDomainData(data);
      let sum=0;
      for(const value of data)sum+=((value-128)/128)**2;
      if(Math.sqrt(sum/data.length)>.025)talkUntil.set(id,now+240);
    }
    for(const chip of document.querySelectorAll?.('[data-voice-player]')||[]){
      const id=chip.dataset.voicePlayer,state=status(id);
      const speaking=state.audible&&(talkUntil.get(id)||0)>now;
      const text=speaking?'말하는 중':state.label;
      chip.classList.toggle('unavailable',!state.audible);
      chip.classList.toggle('speaking',speaking);
      chip.title=text;
      const label=chip.querySelector('.speaker-state');
      if(label&&label.textContent!==text)label.textContent=text;
    }
  }
  const valid=()=>!!(room?.me&&['study','investigation1','discussion1','investigation2','discussion2','action','ending'].includes(room.phase));
  async function send(to,type,payload={}){
    if(!room?.code)return;
    try{await api('/api/rooms/'+room.code+'/signal','POST',{to,type,payload})}
    catch(e){console.warn('Voice signaling',e.message)}
  }
  function closePeer(id){
    meters.get(id)?.source.disconnect();meters.delete(id);talkUntil.delete(id);
    const p=peers.get(id);
    if(p){p.pc.close();peers.delete(id)}
    const node=audio.get(id);
    if(node){node.pause();node.srcObject=null;node.remove();audio.delete(id)}
  }
  function allowedToHear(speaker,listener){
    const group=(room?.whispers?.groups||[]).find(g=>g.members.includes(speaker));
    const listenerGroup=(room?.whispers?.groups||[]).find(g=>g.members.includes(listener));
    return (!group||group.members.includes(listener))&&(!listenerGroup||listenerGroup.members.includes(speaker));
  }
  function updateGains(){
    gains.clear();
    const acoustics=window.MysteryAcoustics;
    if(!room?.me||!acoustics)return;
    for(const {id} of room.players)if(id!==room.me)gains.set(id,acoustics.gain(acoustics.distance(room,room.me,id)));
  }
  function routeOutgoing(){
    if(!room)return;
    const track=micOn?stream?.getAudioTracks()[0]||null:null;
    for(const [id,p] of peers){
      const target=track&&allowedToHear(room.me,id)&&gains.get(id)>0?track:null;
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
      const gain=speakerOn&&allowedToHear(id,room.me)?(gains.get(id)||0):0;
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
      meter(id,node.srcObject);volumes();
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
    meterTimer=setInterval(paintMeters,120);
    for(const p of room.players)if(p.id!==room.me)await send(p.id,'hello');
    tick();
  }
  async function setMicrophone(on){
    if(!on){
      micOn=false;routeOutgoing();
      meters.get(room?.me)?.source.disconnect();meters.delete(room?.me);talkUntil.delete(room?.me);
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
    for(const track of acquired.getAudioTracks())track.addEventListener?.('ended',()=>{
      if(stream!==acquired)return;
      setMicrophone(false);
      window.dispatchEvent?.(new Event('mystery-voice-change'));
    },{once:true});
    try{await start();await enableMeters();routeOutgoing()}
    catch(e){micOn=false;for(const t of acquired.getTracks())t.stop();stream=null;throw e}
  }
  async function setSpeaker(on){
    if(!on){speakerOn=false;volumes();if(!micOn)disable();return}
    if(speakerOn)return;
    speakerOn=true;
    try{await start()}catch(e){speakerOn=false;throw e}
    await enableMeters();volumes();
    for(const node of audio.values())node.play().catch(()=>{});
  }
  function disable(){
    if(active&&room)
      for(const p of room.players)if(p.id!==room.me)send(p.id,'bye');
    active=false;micOn=false;speakerOn=false;clearInterval(timer);timer=null;
    clearInterval(meterTimer);meterTimer=null;
    for(const id of [...peers.keys()])closePeer(id);
    for(const track of stream?.getTracks()||[])track.stop();
    stream=null;for(const m of meters.values())m.source.disconnect();meters.clear();talkUntil.clear();audioContext?.close();audioContext=null;
  }
  function sync(next){
    const prev=room?.code;
    if(prev&&prev!==next?.code)disable();
    room=next;updateGains();
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
    setMicrophone,setSpeaker,disable,sync,controls,status,
    get micOn(){return micOn},get speakerOn(){return speakerOn},get enabled(){return active}
  };
})();
