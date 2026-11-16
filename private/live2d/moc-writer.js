'use strict';
// Adapted from henceketh/live2d-autorig-claude (MIT), commit 9c21423559cd.
// See MOC_WRITER_LICENSE.txt. The generated section table is kept separate.
const layout=require('./moc-layout.json');
const {Buffer}=require('node:buffer');
const types={I32:[4,'writeInt32LE'],F32:[4,'writeFloatLE'],U16:[2,'writeUInt16LE'],U8:[1,'writeUInt8'],STR64:[64],RUNTIME_PTR:[8]};
function writeMoc({width,height,parameters,meshes}){
 const counts=Object.fromEntries(layout.countFields.map(k=>[k,0])),s={};
 const put=(group,fields)=>{for(const [key,value] of Object.entries(fields))s[group+'.'+key]=value;};
 const keys=[],off=[],length=[];
 for(const p of parameters){off.push(keys.length);length.push(p.keys.length);keys.push(...p.keys);}
 const np=parameters.length,nm=meshes.length;
 put('param_src',{id:parameters.map(p=>p.id),maximum_value:parameters.map(p=>p.max),minimum_value:parameters.map(p=>p.min),default_value:parameters.map(p=>p.default),repeat:Array(np).fill(0),decimal_places:Array(np).fill(2),key_table_off:parameters.map((_,i)=>i),key_table_len:Array(np).fill(1)});
 put('key_table_src',{keys_off:off,keys_len:length});put('keys_src',{key:keys});
 const bo=[0],bl=[0],bki=[],bindings=new Map([['',0]]);
 const uv=[],indices=[],positions=[],positionOff=[],opacity=[],drawOrder=[];
 const fields={binding_idx:[],keyform_off:[],key_len:[],vertex_count:[],uv_off:[],idx_off:[],idx_len:[]};
 for(const mesh of meshes){
  const n=mesh.vertices.length/2;fields.uv_off.push(uv.length);uv.push(...mesh.uvs);
  fields.idx_off.push(indices.length);indices.push(...mesh.indices);fields.idx_len.push(mesh.indices.length);fields.vertex_count.push(n);
  const bound=mesh.bound,signature=bound.join(',');let binding=bindings.get(signature);
  if(binding===undefined){binding=bo.length;bindings.set(signature,binding);bo.push(bki.length);bl.push(bound.length);bki.push(...bound);}
  fields.binding_idx.push(binding);fields.keyform_off.push(positionOff.length);
  const grid=bound.map(pi=>parameters[pi].keys.length),cells=grid.reduce((a,b)=>a*b,1);fields.key_len.push(cells);
  for(let cell=0;cell<cells;cell++){
   let r=cell;const values={};for(let i=0;i<bound.length;i++){const p=parameters[bound[i]];values[p.id]=p.keys[r%grid[i]];r=Math.floor(r/grid[i]);}
   positionOff.push(positions.length);const v=mesh.deform(values);
   if(v.length!==n*2||v.some(x=>!Number.isFinite(x)))throw Error('Invalid keyform geometry');
   for(const x of v)positions.push(x);while(positions.length%16)positions.push(0);
   opacity.push(mesh.opacity(values));drawOrder.push(mesh.order);
  }
 }
 put('art_mesh_src',{...fields,id:meshes.map(m=>m.id),visible:Array(nm).fill(1),enable:Array(nm).fill(1),parent_part_idx:meshes.map((_,i)=>i+1),parent_deformer_idx:Array(nm).fill(-1),texture_no:Array(nm).fill(0),drawable_flag:Array(nm).fill(4),mask_off:Array(nm).fill(-1),mask_len:Array(nm).fill(0)});
 put('art_mesh_key_src',{opacity,draw_order:drawOrder,key_pos_off:positionOff});put('key_pos_src',{xy:positions});put('uv_src',{xy:uv});put('idx_src',{idx:indices});
 const partNames=['Root',...meshes.map(m=>'Part_'+m.id)],nparts=partNames.length;
 put('part_src',{id:partNames,binding_idx:Array(nparts).fill(0),keyform_off:partNames.map((_,i)=>i),key_len:Array(nparts).fill(1),visible:Array(nparts).fill(1),enable:Array(nparts).fill(1),parent_part_idx:[-1,...Array(nm).fill(0)]});put('part_key_src',{draw_order:Array(nparts).fill(500)});
 put('binding_src',{key_table_idx_off:bo,key_table_idx_len:bl});put('key_table_idx_src',{idx:bki});
 put('draw_group_src',{obj_off:[0],obj_len:[nm],obj_total_count:[nm],max_order:[500+nm],min_order:[500]});
 put('draw_group_obj_src',{type:Array(nm).fill(0),idx:meshes.map((_,i)=>i),self_group_idx:Array(nm).fill(-1)});
 Object.assign(counts,{parts:nparts,art_meshes:nm,parameters:np,part_keyforms:nparts,art_mesh_keyforms:positionOff.length,keyform_pos:positions.length,key_table_idx:bki.length,bindings:bo.length,key_tables:np,keys:keys.length,uvs:uv.length,idx:indices.length,draw_groups:1,draw_items:nm});
 const header=Buffer.alloc(0x7c0);header.write('MOC3');header[4]=3;
 const pieces=[];let size=0,previousRuntime=false,slot=0;
 for(const [name,type,countField,version] of layout.sections.filter(x=>x[3]<=3)){
  if(!(previousRuntime&&type!=='RUNTIME_PTR')){const pad=(64-size%64)%64;if(pad){pieces.push(Buffer.alloc(pad));size+=pad;}}
  previousRuntime=type==='RUNTIME_PTR';header.writeUInt32LE(0x7c0+size,0x40+4*slot++);
  let bytes;
  if(name==='count_info'){bytes=Buffer.alloc(128);layout.countFields.slice(0,32).forEach((k,i)=>bytes.writeInt32LE(counts[k],4*i));}
  else if(name==='canvas_info'){bytes=Buffer.alloc(21);[1000,width/2000,height/2000,width/1000,height/1000].forEach((v,i)=>bytes.writeFloatLE(v,4*i));bytes[20]=1;}
  else{
   const count=counts[countField],values=s[name]||[],[stride,method]=types[type];bytes=Buffer.alloc(count*stride);
   if(type==='STR64')for(let i=0;i<count;i++)Buffer.from(values[i]||'').copy(bytes,64*i,0,63);
   else if(type!=='RUNTIME_PTR')for(let i=0;i<count;i++)bytes[method](values[i]??0,i*stride);
  }
  pieces.push(bytes);size+=bytes.length;
 }
 pieces.push(Buffer.alloc((64-size%64)%64));
 return {buffer:Buffer.concat([header,...pieces]),counts};
}
module.exports={writeMoc};
