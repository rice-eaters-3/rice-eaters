'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('separate microphone and speaker controls plus sound blocking at closed doors/walls',async()=>{
  const js=fs.readFileSync(path.join(__dirname,'../apps/murder-mystery/voice.js'),'utf8');
  const track={enabled:true,stopped:false,stop(){this.stopped=true}};
  const stream={getTracks(){return [track]},getAudioTracks(){return [track]}};
  const sandbox={
    window:{RTCPeerConnection:function(){}},
    navigator:{mediaDevices:{getUserMedia:async()=>stream}},
    escapeHtml:v=>String(v),
    btn:(a,label)=>'<button data-action="'+a+'">'+label+'</button>',
    api:async route=>route.includes('/signals?')?{signals:[],cursor:0}:{ok:true},
    setInterval:()=>1,clearInterval:()=>{},console
  };
  vm.runInNewContext(js,sandbox);
  const voice=sandbox.window.MysteryVoice;
  const map={
    floorId:'ground',tiles:['#######','#.....#','#######'],
    doors:[{id:'entry',x:3,y:1,locked:false,open:false}]
  };
  const left={floor:'ground',x:1,y:1},right={floor:'ground',x:5,y:1};
  assert.equal(voice.acousticDistance(map,left,right),Infinity,'closed door blocks all sound');
  const open={...map,doors:[{...map.doors[0],open:true}]};
  assert.equal(voice.acousticDistance(open,left,right),4,'open door permits path-based distance');
  const wall={...open,tiles:['#######','#..#..#','#######']};
  assert.equal(voice.acousticDistance(wall,left,right),Infinity,'wall blocks sound even when door is open');
  assert.equal(voice.acousticDistance(open,left,{...right,floor:'upper'}),Infinity,'floors are acoustically separated');
  const room={code:'ABCDEF',phase:'study',me:'a',players:[
    {id:'a',position:left},{id:'b',position:right}
  ],map:open,whispers:{groups:[],proposals:[]}};
  voice.sync(room);
  assert.ok(voice.controls().includes('data-action="voice-on"'));
  assert.ok(voice.controls().includes('data-action="speaker-mute"'),'speaker switch exists independently');
  voice.toggleSpeaker();
  assert.equal(voice.speakerMuted,true);
  assert.equal(voice.micMuted,false);
  await voice.enable();
  assert.equal(voice.enabled,true);
  assert.equal(track.enabled,true,'microphone starts enabled after consent');
  assert.equal(voice.speakerMuted,true,'speaker preference remains independently off');
  assert.ok(voice.controls().includes('data-action="voice-mute"'));
  voice.toggleMute();
  assert.equal(track.enabled,false,'microphone off actually disables microphone track');
  assert.equal(voice.speakerMuted,true);
  voice.toggleSpeaker();
  assert.equal(voice.speakerMuted,false,'speaker on has no effect on mic state');
  assert.equal(track.enabled,false);
  voice.toggleMute();
  assert.equal(track.enabled,true,'microphone can be turned on without touching speaker state');
  voice.disable();
  assert.equal(track.stopped,true,'disconnect stops microphone capture');
});
