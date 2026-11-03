'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function area(open){
  return {
    me:'left',phase:'study',code:'ABC234',
    players:[
      {id:'left',position:{floor:'ground',x:2,y:2}},
      {id:'right',position:{floor:'ground',x:4,y:2}}
    ],
    map:{
      floorId:'ground',
      tiles:['#######','#..#..#','#.....#','#..#..#','#######'],
      doors:[{id:'pass',x:3,y:2,locked:false,open}]
    },
    whispers:{groups:[],proposals:[]}
  };
}
function acoustic(){
  const sandbox={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/acoustics.js'),'utf8'),sandbox);
  return sandbox.window.MysteryAcoustics;
}

test('closed doors and walls block voice; opening restores route-based attenuation',()=>{
  const audio=acoustic();
  const closed=area(false),open=area(true);
  assert.equal(audio.distance(closed,'left','right'),Infinity,'closed door seals corridor');
  assert.equal(audio.gain(audio.distance(closed,'left','right')),0,'closed door is silent');
  assert.equal(audio.distance(open,'left','right'),2,'sound crosses only via opened door');
  assert.ok(audio.gain(2)>audio.gain(10),'near voice is louder than distant voice');
  assert.equal(audio.gain(Infinity),0,'disconnected players are inaudible');
  const upper={...open,players:[open.players[0],{...open.players[1],position:{floor:'upper',x:4,y:2}}]};
  assert.equal(audio.distance(upper,'left','right'),Infinity,'different floors cannot hear');
  const walls={...open,map:{...open.map,doors:[],tiles:['#######','#..#..#','#..#..#','#..#..#','#######']}};
  assert.equal(audio.distance(walls,'left','right'),Infinity,'solid wall cannot leak audio');
});

test('independent microphone and speaker toggles, listen-only access and microphone routing through doors',async()=>{
  const instances=[],tracks=[],calls=[];
  let microphoneRequests=0,deliverOffer=true;
  class MockPeer{
    constructor(){this.signalingState='stable';this.connectionState='connected';this.remoteDescription=null;
      instances.push(this);}
    addTransceiver(){
      this.sender={track:null,replaceTrack:async track=>{this.sender.track=track;tracks.push(track)}};
      return {sender:this.sender};
    }
    async setRemoteDescription(desc){this.remoteDescription=desc}
    async createAnswer(){return {type:'answer',sdp:'demo'}}
    async createOffer(){return {type:'offer',sdp:'demo'}}
    async setLocalDescription(desc){this.localDescription={...desc,toJSON:()=>desc}}
    async addIceCandidate(){}
    close(){this.signalingState='closed';this.connectionState='closed'}
  }
  const sandbox={
    window:{MysteryAcoustics:acoustic(),RTCPeerConnection:MockPeer},
    RTCPeerConnection:MockPeer,
    RTCSessionDescription:class{constructor(x){Object.assign(this,x)}},
    RTCIceCandidate:class{constructor(x){Object.assign(this,x)}},
    navigator:{mediaDevices:{getUserMedia:async()=>{
      microphoneRequests++;
      const t={enabled:true,stop(){this.enabled=false}};
      return {getAudioTracks:()=>[t],getTracks:()=>[t]};
    }}},
    console:{warn:()=>{}},
    setInterval:()=>123,clearInterval:()=>{},
    document:{createElement:()=>({play:async()=>{},pause:()=>{},remove:()=>{},dataset:{}}),
      body:{appendChild:()=>{}}},
    MediaStream:class{constructor(tracks){this.tracks=tracks}},
    api:async(route,method,payload)=>{
      calls.push({route,method,payload});
      if(route.includes('/signals?')){
        const signals=deliverOffer?[{id:1,type:'offer',from:'right',to:'left',payload:{sdp:{type:'offer',sdp:'demo'}}}]:[];
        deliverOffer=false;
        return {signals,cursor:1};
      }
      return {ok:true};
    },
    btn:(action,label,cls,disabled,extra)=>'<button data-action="'+action+'" '+extra+'>'+label+'</button>'
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/voice.js'),'utf8'),sandbox);
  const voice=sandbox.window.MysteryVoice;
  voice.sync(area(false));
  assert.ok(voice.controls().includes('data-action="voice-mic"'));
  assert.ok(voice.controls().includes('data-action="voice-speaker"'));
  await voice.setSpeaker(true);
  await new Promise(r=>setTimeout(r,25));
  assert.equal(voice.speakerOn,true);
  assert.equal(voice.micOn,false);
  assert.equal(microphoneRequests,0,'listen-only must not request microphone permissions');
  assert.equal(instances.length,1,'incoming peer connection was initialized');
  await voice.setMicrophone(true);
  await new Promise(r=>setTimeout(r,10));
  assert.equal(voice.micOn,true);
  assert.equal(microphoneRequests,1);
  assert.equal(instances[0].sender.track,null,'mic track not transmitted across a closed door');
  voice.sync(area(true));
  await new Promise(r=>setTimeout(r,10));
  assert.ok(instances[0].sender.track,'opening the door allows microphone transmission');
  voice.sync(area(false));
  await new Promise(r=>setTimeout(r,10));
  assert.equal(instances[0].sender.track,null,'closing door immediately strips transmitted track');
  voice.sync(area(true));
  await new Promise(r=>setTimeout(r,10));
  await voice.setSpeaker(false);
  assert.equal(voice.speakerOn,false);
  assert.equal(voice.micOn,true,'turning speaker off never turns microphone off');
  assert.ok(instances[0].sender.track,'speaker off does not stop microphone transmission');
  await voice.setMicrophone(false);
  assert.equal(voice.micOn,false);
  assert.equal(voice.speakerOn,false);
  assert.equal(voice.enabled,false);
  await voice.setMicrophone(true);
  assert.equal(voice.micOn,true);
  assert.equal(voice.speakerOn,false,'microphone alone works without speaker');
  voice.disable();
  assert.equal(voice.micOn,false);
});
