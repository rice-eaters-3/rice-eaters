'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let ready;
function loadCore(sourcePath=path.join(__dirname,'../../apps/live2d-studio/vendor/purismcore.js')){
 const ctx={console:{log(){},warn(){},error(){}},WebAssembly,TextDecoder,TextEncoder,Buffer,setTimeout,clearTimeout,atob,btoa};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(sourcePath,'utf8'),ctx,{timeout:10000});
 return new Promise((resolve,reject)=>{const start=Date.now();function check(){const core=ctx.PurismCore||ctx.Live2DCubismCore;try{if(core?.Version.csmGetVersion()){resolve(core);return;}}catch{}if(Date.now()-start>10000){reject(Error('모델 런타임 초기화에 실패했습니다.'));return;}setTimeout(check,10);}check();});
}
function runtime(){return ready??=loadCore();}
function open(core,bytes){const ab=Uint8Array.from(bytes).buffer,moc=core.Moc.fromArrayBuffer(ab,true);if(!moc)throw Error('MOC3 런타임 무결성 검사에 실패했습니다.');const model=core.Model.fromMoc(moc);if(!model){moc._release();throw Error('모델 초기화에 실패했습니다.');}return {moc,model,release(){model.release();moc._release();}};}
async function validate(bytes,sourcePath){const core=sourcePath?await loadCore(sourcePath):await runtime(),handle=open(core,bytes),{model}=handle;try{
 model.update();const before=model.drawables.vertexPositions.map(v=>Float32Array.from(v)),baseOpacity=Float32Array.from(model.drawables.opacities),effects={};
 for(let i=0;i<model.parameters.count;i++){
  model.parameters.values.set(model.parameters.defaultValues);model.parameters.values[i]=model.parameters.defaultValues[i]===model.parameters.maximumValues[i]?model.parameters.minimumValues[i]:model.parameters.maximumValues[i];model.update();
  let moved=0;for(let j=0;j<before.length;j++)if(model.drawables.vertexPositions[j].some((v,k)=>Math.abs(v-before[j][k])>1e-7)||Math.abs(model.drawables.opacities[j]-baseOpacity[j])>1e-7)moved++;
  // Mouth openness also drives authored drawable opacity.
  let finite=true;for(const v of model.drawables.vertexPositions)for(const x of v)if(!Number.isFinite(x))finite=false;
  if(!finite)throw Error('유효하지 않은 변형 좌표가 있습니다.');effects[model.parameters.ids[i]]=moved;
 }
 if(Object.values(effects).some(n=>n===0))throw Error('움직임이 연결되지 않은 파라미터: '+Object.keys(effects).filter(k=>effects[k]===0).join(', '));
 return {runtime:sourcePath?'Live2D Cubism Core':'Purism Core 1.1.0',coreVersion:core.Version.csmGetVersion(),mocVersion:3,drawables:model.drawables.count,parameters:model.parameters.count,effects,validatedAt:new Date().toISOString(),steamVTubeStudioVerified:false};
 }finally{handle.release();}}
module.exports={loadCore,runtime,open,validate};
