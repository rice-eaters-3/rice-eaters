'use strict';
(function(root,factory){
  const engine=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=engine;
  if(root)root.TraceEngine=engine;
})(typeof window!=='undefined'?window:null,function(){
  const mod=value=>(value%10+10)%10;
  const plain=[1,2,3,7,0,4,6,1],key=[7,3,1,8,4,6,2,5],hidden=[5,8,3,0,2,2,9,0];
  const cipher={
    known:plain,first:plain.map((n,i)=>mod(n+key[i])),second:hidden.map((n,i)=>mod(n+key[i])),
    dictionary:{12:'북쪽',37:'보관실','04':'자정',61:'이동',58:'남쪽',30:'승강장',22:'02시',90:'접선'}
  };
  const ledger={
    sessions:[
      {id:'S-01',user:'orbit',time:1266,seconds:6,billed:50},
      {id:'S-02',user:'guest',time:1269,seconds:12,billed:100},
      {id:'S-03',user:'nova',time:1271,seconds:3,billed:25},
      {id:'S-04',user:'guest',time:1274,seconds:9,billed:0},
      {id:'S-05',user:'orbit',time:1278,seconds:9,billed:75}
    ],
    jobs:[
      {id:'J-11',session:'S-01',terminal:'T-01',time:1269},
      {id:'J-62',session:'S-04',terminal:'T-08',time:1277},
      {id:'J-40',session:'S-03',terminal:'T-03',time:1274},
      {id:'J-28',session:'S-02',terminal:'T-02',time:1272}
    ],
    prints:[
      {id:'P-1',job:'J-28',terminal:'T-02',time:1267},
      {id:'P-2',job:'J-11',terminal:'T-01',time:1264},
      {id:'P-3',job:'J-62',terminal:'T-08',time:1272},
      {id:'P-4',job:'J-40',terminal:'T-03',time:1272}
    ]
  };
  const trust={
    nodes:[
      {id:'guest',label:'방문자',grant:'visit',x:8,y:50},
      {id:'mail',label:'우편실',grant:'relay',x:30,y:50},
      {id:'lab',label:'연구실',grant:'research',x:53,y:20},
      {id:'print',label:'인쇄실',grant:'print',x:53,y:80},
      {id:'backup',label:'백업실',grant:'operator',x:76,y:50},
      {id:'archive',label:'기록실',grant:null,x:95,y:50}
    ],
    stamps:{visit:'방문',relay:'중계',staff:'직원',research:'연구',print:'인쇄',operator:'운영'},
    edges:[
      {id:'g-m',from:'guest',to:'mail',requires:'visit',essential:true},
      {id:'g-l',from:'guest',to:'lab',requires:'staff'},
      {id:'m-l',from:'mail',to:'lab',requires:'relay'},
      {id:'m-p',from:'mail',to:'print',requires:'relay'},
      {id:'l-b',from:'lab',to:'backup',requires:'research',essential:true},
      {id:'p-b',from:'print',to:'backup',requires:'print'},
      {id:'b-a',from:'backup',to:'archive',requires:'operator',essential:true}
    ]
  };
  const memory=['C','A','T','|','4','7','2','9','|','A','R','C','H','I','V','E'];
  const packets=[
    {actual:3,claimed:3},{actual:4,claimed:2},{actual:0,claimed:0},
    {actual:3,claimed:8},{actual:1,claimed:2},{actual:2,claimed:2}
  ];
  const outbreak={
    budget:3,
    nodes:[
      {id:'intake',label:'입고 PC',x:9,y:50},
      {id:'desk',label:'접수실',x:34,y:20},
      {id:'lab',label:'검사실',x:34,y:80},
      {id:'hub',label:'파일 허브',x:59,y:50},
      {id:'ward',label:'병동',x:87,y:20,target:true},
      {id:'store',label:'보관소',x:87,y:80,target:true}
    ],
    edges:[
      {id:'i-d',from:'intake',to:'desk',essential:true},
      {id:'i-l',from:'intake',to:'lab',essential:true},
      {id:'d-h',from:'desk',to:'hub',essential:true},
      {id:'l-h',from:'lab',to:'hub'},
      {id:'h-w',from:'hub',to:'ward',essential:true},
      {id:'h-s',from:'hub',to:'store'},
      {id:'l-w',from:'lab',to:'ward'}
    ]
  };
  const clone=value=>JSON.parse(JSON.stringify(value));
  function initial(id){
    switch(id){
      case 'cipher':return {key:Array(8).fill(0)};
      case 'ledger':return {session:null,job:null,print:null,jobShift:0,printShift:0};
      case 'trust':return {stage:0,path:['guest'],cuts:[]};
      case 'heartbeat':return {stage:0,claimed:3,response:null,left:'claimed',operator:'=',right:'actual'};
      case 'outbreak':return {patched:[],cuts:[]};
      default:throw Error('알 수 없는 사건입니다.');
    }
  }
  function decipher(values,numbers){
    return numbers.map((n,i)=>mod(n-values[i]));
  }
  function stamps(path){
    return new Set(path.map(id=>trust.nodes.find(n=>n.id===id)?.grant).filter(Boolean));
  }
  function trustReach(cuts=[]){
    const reached=new Set(['guest']),held=stamps(['guest']);
    let changed=true;
    while(changed){
      changed=false;
      for(const edge of trust.edges){
        if(cuts.includes(edge.id)||!reached.has(edge.from)||!held.has(edge.requires)||reached.has(edge.to))continue;
        reached.add(edge.to);
        const grant=trust.nodes.find(n=>n.id===edge.to).grant;
        if(grant)held.add(grant);
        changed=true;
      }
    }
    return [...reached];
  }
  function canTravel(state,id){
    const current=state.path[state.path.length-1],held=stamps(state.path);
    return state.stage===0&&state.path.length<=4&&trust.edges.some(e=>
      e.from===current&&e.to===id&&held.has(e.requires));
  }
  function cost(state){return state.patched.length*2+state.cuts.length;}
  function spread(state){
    const frames=[['intake']];
    for(let i=0;i<outbreak.nodes.length;i++){
      const infected=new Set(frames[frames.length-1]);
      for(const edge of outbreak.edges){
        if(state.cuts.includes(edge.id)||state.patched.includes(edge.to))continue;
        if(frames[frames.length-1].includes(edge.from))infected.add(edge.to);
      }
      if(infected.size===frames[frames.length-1].length)break;
      frames.push([...infected]);
    }
    return frames;
  }
  function ruleAllows(state,packet){
    const a=packet[state.left],b=packet[state.right];
    switch(state.operator){
      case '<':return a<b;
      case '≤':return a<=b;
      case '=':return a===b;
      case '≥':return a>=b;
      case '>':return a>b;
      default:return false;
    }
  }
  const ok=message=>({ok:true,message});
  const no=message=>({ok:false,message});
  function evaluate(id,state){
    if(!valid(id,state))return no('퍼즐 상태를 읽을 수 없습니다. 사건을 다시 시작해 주세요.');
    if(id==='cipher'){
      const decoded=decipher(state.key,cipher.first);
      const matches=decoded.filter((n,i)=>n===cipher.known[i]).length;
      return matches===8?ok('두 전보를 복원했습니다.'):no('첫 전보의 '+matches+' / 8자리가 원문과 일치합니다. 두 전보에는 같은 키를 적용해야 합니다.');
    }
    if(id==='ledger'){
      const s=ledger.sessions.find(x=>x.id===state.session);
      const j=ledger.jobs.find(x=>x.id===state.job),p=ledger.prints.find(x=>x.id===state.print);
      if(!s||!j||!p)return no('세 장부에서 증거를 하나씩 선택해 주세요.');
      if(s.seconds/3*25-s.billed!==75)return no('선택한 사용 기록은 75센트 누락을 설명하지 못합니다. 3초마다 25센트로 계산해 보세요.');
      if(j.session!==s.id||p.job!==j.id||p.terminal!==j.terminal)return no('시각만 비슷한 다른 기록이 섞여 있습니다. 세션·작업·단말 번호를 따라 연결해 보세요.');
      if(j.time+state.jobShift!==s.time||p.time+state.printShift!==s.time)return no('번호는 연결됐지만 시각이 어긋납니다. 두 시계의 점검 기록을 확인해 보세요.');
      return ok('세 장부가 같은 방문을 가리킵니다.');
    }
    if(id==='trust'){
      if(state.stage===0)return state.path[state.path.length-1]==='archive'?
        ok('기록실에 도달했습니다. 이제 방어자의 자리로 이동합니다.'):no('기록실에 아직 도달하지 못했습니다. 인장이 허용하는 경로를 찾아보세요.');
      const reached=trustReach(state.cuts);
      return reached.includes('archive')?no('아직 기록실로 통하는 경로가 남아 있습니다. 공격자는 모든 열린 갈림길을 시도합니다.'):
        ok('필수 연결을 살리면서 기록실로 통하는 신뢰 경로를 차단했습니다.');
    }
    if(id==='heartbeat'){
      if(state.stage===0)return state.response?.join('').includes('4729')?
        ok('응답에서 보관번호를 읽었습니다. 이제 장치의 경계 검사를 고칩니다.'):no('마지막 응답에서 번호 네 자리를 모두 읽지 못했습니다. 요청 길이를 조절해 다시 받아 보세요.');
      const passed=packets.filter(p=>ruleAllows(state,p)===(p.claimed<=p.actual)).length;
      return passed===packets.length?ok('정상 요청은 통과하고, 범위를 넘는 요청은 모두 거부됩니다.'):
        no(passed+' / '+packets.length+'개 요청이 올바르게 처리됐습니다. 짧은 정상 요청도 통과해야 합니다.');
    }
    if(id==='outbreak'){
      const frames=spread(state),infected=frames[frames.length-1];
      const lost=outbreak.nodes.filter(n=>n.target&&infected.includes(n.id));
      return lost.length?no('감염이 '+lost.map(n=>n.label).join('·')+'에 도달했습니다. 예산 안에서 다른 조합을 시험해 보세요.'):
        ok('병동과 보관소를 보호했습니다. 필수 업무선도 모두 유지됩니다.');
    }
    return no('알 수 없는 사건입니다.');
  }
  function toggle(list,value){return list.includes(value)?list.filter(v=>v!==value):[...list,value];}
  function act(id,state,action){
    if(!valid(id,state))throw Error('잘못된 퍼즐 상태입니다.');
    const next=clone(state);
    if(id==='cipher'&&action.type==='dial'){
      if(!Number.isInteger(action.index)||action.index<0||action.index>=8||![-1,1].includes(action.delta))return next;
      next.key[action.index]=mod(next.key[action.index]+action.delta);
    }else if(id==='ledger'&&['session','job','print'].includes(action.type)){
      const rows={session:ledger.sessions,job:ledger.jobs,print:ledger.prints}[action.type];
      if(rows.some(r=>r.id===action.id))next[action.type]=action.id;
    }else if(id==='ledger'&&['jobShift','printShift'].includes(action.type)){
      if(Number.isInteger(action.value)&&Math.abs(action.value)<=5)next[action.type]=action.value;
    }else if(id==='trust'&&action.type==='travel'){
      if(!canTravel(state,action.id))throw Error('그 연결은 아직 이용할 수 없습니다. 필요한 인장과 남은 이동 수를 확인하세요.');
      next.path.push(action.id);
    }else if(id==='trust'&&action.type==='cut'){
      const edge=trust.edges.find(e=>e.id===action.id);
      if(!edge||edge.essential||state.stage!==1)return next;
      next.cuts=toggle(state.cuts,edge.id);
      if(next.cuts.length>2)throw Error('차단은 두 연결까지만 가능합니다. 선택한 연결을 먼저 해제하세요.');
    }else if(['trust','heartbeat'].includes(id)&&action.type==='switch'){
      if(state.stage!==0||!evaluate(id,state).ok)return next;
      next.stage=1;
    }else if(id==='heartbeat'&&action.type==='length'){
      if(Number.isInteger(action.value)&&action.value>=0&&action.value<=16)next.claimed=action.value;
    }else if(id==='heartbeat'&&action.type==='probe'){
      if(state.claimed>8)throw Error('이 통신선은 한 번에 8칸까지만 돌려줍니다. 요청 길이를 줄여 보세요.');
      next.response=memory.slice(0,state.claimed);
    }else if(id==='heartbeat'&&['left','right','operator'].includes(action.type)){
      const options=action.type==='operator'?['<','≤','=','≥','>']:['actual','claimed'];
      if(options.includes(action.value))next[action.type]=action.value;
    }else if(id==='outbreak'&&['patch','cut'].includes(action.type)){
      if(action.type==='patch'){
        if(action.id==='intake'||!outbreak.nodes.some(n=>n.id===action.id))return next;
        next.patched=toggle(state.patched,action.id);
      }else{
        const edge=outbreak.edges.find(e=>e.id===action.id);
        if(!edge||edge.essential)return next;
        next.cuts=toggle(state.cuts,action.id);
      }
      if(cost(next)>outbreak.budget)throw Error('대응 자원은 3점입니다. 기존 패치나 차단을 해제하고 다시 선택하세요.');
    }
    return next;
  }
  const intBetween=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
  const uniqueKnown=(list,known)=>Array.isArray(list)&&new Set(list).size===list.length&&list.every(id=>known.includes(id));
  function valid(id,state){
    if(!state||typeof state!=='object')return false;
    switch(id){
      case 'cipher':return Array.isArray(state.key)&&state.key.length===8&&state.key.every(n=>intBetween(n,0,9));
      case 'ledger':return [['session',ledger.sessions],['job',ledger.jobs],['print',ledger.prints]]
        .every(([k,rows])=>state[k]===null||rows.some(r=>r.id===state[k]))&&
        intBetween(state.jobShift,-5,5)&&intBetween(state.printShift,-5,5);
      case 'trust':{
        if(![0,1].includes(state.stage)||!Array.isArray(state.path)||state.path[0]!=='guest'||state.path.length>5||
          !uniqueKnown(state.cuts,trust.edges.filter(e=>!e.essential).map(e=>e.id))||state.cuts.length>2)return false;
        for(let i=1;i<state.path.length;i++){
          if(!canTravel({stage:0,path:state.path.slice(0,i)},state.path[i]))return false;
        }
        return state.stage===0||state.path[state.path.length-1]==='archive';
      }
      case 'heartbeat':return [0,1].includes(state.stage)&&intBetween(state.claimed,0,16)&&
        ['actual','claimed'].includes(state.left)&&['actual','claimed'].includes(state.right)&&
        ['<','≤','=','≥','>'].includes(state.operator)&&
        (state.response===null||(Array.isArray(state.response)&&state.response.length<=8&&
          state.response.every((v,i)=>v===memory[i])))&&(state.stage===0||state.response?.join('').includes('4729'));
      case 'outbreak':return uniqueKnown(state.patched,outbreak.nodes.filter(n=>n.id!=='intake').map(n=>n.id))&&
        uniqueKnown(state.cuts,outbreak.edges.filter(e=>!e.essential).map(e=>e.id))&&cost(state)<=outbreak.budget;
      default:return false;
    }
  }
  function restore(raw){
    const result={version:1,current:'cipher',completed:[],cases:{}};
    if(!raw||raw.version!==1)return result;
    const ids=['cipher','ledger','trust','heartbeat','outbreak'];
    if(ids.includes(raw.current))result.current=raw.current;
    for(const id of ids){
      const item=raw.cases?.[id];
      if(!item||!valid(id,item.board))continue;
      result.cases[id]={board:clone(item.board),hints:intBetween(item.hints,0,3)?item.hints:0};
      if(Array.isArray(raw.completed)&&raw.completed.includes(id)&&evaluate(id,item.board).ok&&
        (!['trust','heartbeat'].includes(id)||item.board.stage===1))result.completed.push(id);
    }
    return result;
  }
  return {cipher,ledger,trust,memory,packets,outbreak,initial,valid,restore,decipher,stamps,trustReach,
    canTravel,cost,spread,ruleAllows,act,evaluate};
});
