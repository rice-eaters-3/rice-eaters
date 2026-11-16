'use strict';
// One isolated channel at a time; no idle, physics or camera-tracking claims.
(function(root){
 const duration=6;
 function values(mode,seconds){
  const t=((seconds%duration)+duration)%duration,u=t/duration;
  if(mode==='head')return {ParamAngleX:30*Math.sin(u*Math.PI*2)};
  if(mode==='expression')return {ParamMouthForm:u<.2?0:u<.4?(u-.2)/.2:u<.7?1:Math.max(0,1-(u-.7)/.2)};
  if(mode==='blink'){let open=1;for(const center of [1.5,4]){const d=Math.abs(t-center);if(d<.22)open=Math.min(open,d/.22);}return {ParamEyeLOpen:open,ParamEyeROpen:open};}
  if(mode==='speech'){const envelope=t<.6||t>5.4?0:Math.max(0,Math.sin((t-.6)*9))*(.55+.35*Math.sin(t*2.7)**2);return {ParamMouthOpenY:envelope};}
  throw Error('Unknown motion review');
 }
 const api={duration,values};if(typeof module!=='undefined')module.exports=api;else root.LiveMotionReview=api;
})(typeof window==='undefined'?globalThis:window);
