'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {parseEnv}=require('node:util');

// Resolve beside server.js, regardless of the shell's working directory.
// Shell/hosting configuration wins, including intentionally empty values.
function loadEnv(directory=path.resolve(__dirname,'..'),environment=process.env){
  let source;
  try{source=fs.readFileSync(path.join(directory,'.env'),'utf8');}
  catch(error){if(error.code==='ENOENT')return;throw error;}
  if(typeof parseEnv!=='function')throw new Error('.env 자동 로딩에는 Node.js 20.12 이상이 필요합니다.');
  const values=parseEnv(source.replace(/^\uFEFF/,''));
  for(const [key,value] of Object.entries(values)){
    if(!Object.hasOwn(environment,key))environment[key]=value;
  }
}
module.exports={loadEnv};
