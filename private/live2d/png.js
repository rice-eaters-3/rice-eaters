'use strict';
const zlib=require('node:zlib');
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
let crcTable;
function crc32(data){if(!crcTable)crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});let crc=0xffffffff;for(const b of data)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function decode(buffer){
 if(buffer.length>25*1024*1024||!buffer.subarray(0,8).equals(signature))throw Error('PNG 형식의 이미지가 필요합니다.');
 let width,height,type,depth,interlace,palette,transparency;const chunks=[];
 for(let off=8;off+12<=buffer.length;){const len=buffer.readUInt32BE(off),name=buffer.toString('ascii',off+4,off+8),data=buffer.subarray(off+8,off+8+len);if(off+12+len>buffer.length)throw Error('잘린 PNG 파일입니다.');
  if(crc32(buffer.subarray(off+4,off+8+len))!==buffer.readUInt32BE(off+8+len))throw Error('PNG 무결성 검사에 실패했습니다.');
  if(name==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);depth=data[8];type=data[9];interlace=data[12];}
  if(name==='IDAT')chunks.push(data);if(name==='PLTE')palette=data;if(name==='tRNS')transparency=data;
  off+=12+len;if(name==='IEND')break;
 }
 if(!width||!height||width>4096||height>4096||depth!==8||interlace!==0||![0,2,3,4,6].includes(type))throw Error('8비트 PNG(최대 4096px, 비인터레이스)가 필요합니다.');
 const channels={0:1,2:3,3:1,4:2,6:4}[type],stride=width*channels;
 const raw=zlib.inflateSync(Buffer.concat(chunks),{maxOutputLength:(stride+1)*height});if(raw.length!==(stride+1)*height)throw Error('PNG 데이터 길이가 올바르지 않습니다.');
 const pixels=Buffer.alloc(stride*height),rgba=Buffer.alloc(width*height*4);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];if(filter>4)throw Error('지원하지 않는 PNG 필터입니다.');for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=channels?pixels[i-channels]:0,b=y?pixels[i-stride]:0,c=y&&x>=channels?pixels[i-stride-channels]:0;pixels[i]=(raw[y*(stride+1)+x+1]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}}
 for(let i=0;i<width*height;i++){const p=i*channels,o=i*4;
  if(type===6){pixels.copy(rgba,o,p,p+4);}
  else if(type===2){pixels.copy(rgba,o,p,p+3);rgba[o+3]=255;}
  else if(type===0||type===4){rgba[o]=rgba[o+1]=rgba[o+2]=pixels[p];rgba[o+3]=type===4?pixels[p+1]:255;}
  else{const index=pixels[p];if(!palette||index*3+2>=palette.length)throw Error('PNG 팔레트가 올바르지 않습니다.');palette.copy(rgba,o,index*3,index*3+3);rgba[o+3]=transparency?.[index]??255;}
 }
 return {width,height,rgba};
}
module.exports={decode,crc32};
