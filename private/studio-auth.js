'use strict';
const crypto=require('node:crypto');
// No default credential, loopback bypass, player role or browser flag grants access.
const password=process.env.STUDIO_ADMIN_PASSWORD||'';
const configured=Buffer.byteLength(password,'utf8')>=24;
const digest=value=>crypto.createHash('sha256').update(value).digest();
const expected=digest('operator:'+password);
const attempts=new Map();
function requireOperator(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Vary','Authorization');
  if(!configured){
    const e=new Error('제작소가 잠겨 있습니다. 서버 운영자가 STUDIO_ADMIN_PASSWORD를 24바이트 이상으로 설정한 뒤 서버를 재시작해야 합니다.');e.status=503;throw e;
  }
  const authorization=String(req.headers.authorization||'');
  let supplied='';
  if(/^Basic [A-Za-z0-9+/]+=*$/i.test(authorization)&&authorization.length<8192)
    supplied=Buffer.from(authorization.slice(6),'base64').toString('utf8');
  if(crypto.timingSafeEqual(digest(supplied),expected))return;
  // Forwarded headers are never used as proof of identity or a rate-limit bypass.
  const key=req.socket.remoteAddress||'unknown',now=Date.now();
  for(const [ip,entry] of attempts)if(entry.until<=now)attempts.delete(ip);
  if(attempts.size>=4096&&!attempts.has(key))attempts.delete(attempts.keys().next().value);
  const entry=attempts.get(key)||{count:0,until:now+60000};
  if(authorization)entry.count++;
  attempts.set(key,entry);
  if(entry.count>10){res.setHeader('Retry-After',String(Math.max(1,Math.ceil((entry.until-now)/1000))));const e=new Error('인증 시도가 너무 많습니다. 잠시 후 다시 시도하세요.');e.status=429;throw e;}
  res.setHeader('WWW-Authenticate','Basic realm="Rice Eaters Operator", charset="UTF-8"');
  const e=new Error('서버 운영자 인증이 필요합니다.');e.status=401;throw e;
}
module.exports={requireOperator};
