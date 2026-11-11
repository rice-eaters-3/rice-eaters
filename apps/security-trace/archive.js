'use strict';
(function(root,factory){
  const archive=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=archive;
  if(root)root.TraceArchive=archive;
})(typeof window!=='undefined'?window:null,function(){
  const people=[
    {id:'han',name:'한서윤',note:'고장 난 시계를 고쳐 주는 사람. 별무늬 손수건을 작업대에 깐다.'},
    {id:'yoon',name:'윤도현',note:'할아버지에게 받은 회중시계를 찬다. 손목시계는 쓰지 않는다.'},
    {id:'choi',name:'최민하',note:'서류에 말린 솔잎을 책갈피로 끼운다. 커피를 마시지 않는다.'},
    {id:'jung',name:'정이안',note:'오래된 봉투를 만질 때만 흰 면장갑을 낀다.'},
    {id:'park',name:'박해린',note:'낱장을 잃어버리지 않도록 보고서를 붉은 실로 묶는다.'},
    {id:'kang',name:'강도윤',note:'답변을 받으면 작은 종을 한 번 울린다. 공동 단말의 이용자들을 맡는다.'},
    {id:'oh',name:'오나래',note:'접은 종이 대신 말아 둔 도면을 들고 다닌다. 병원망의 업무선을 연구한다.'}
  ];
  const teams=[{id:'signals',name:'통신분석실'},{id:'audit',name:'기록감사실'},{id:'response',name:'침해대응실'}];
  const outcomes=[
    {id:'reuse',name:'중복 키의 전보 복원'},{id:'audit',name:'미납 세션의 단말 특정'},
    {id:'isolate',name:'신뢰 연결 철회'},{id:'authenticate',name:'위조 발급자 신뢰 철회'},
    {id:'bounds',name:'길이 경계 검사 복구'},{id:'absorb',name:'정상 서비스 유지'},
    {id:'contain',name:'필수 업무선 보존'}
  ];
  const records=[
    {id:'cipher',label:'A',person:'han',team:'signals',outcome:'reuse',evidence:['a-field','a-letter'],phase:0},
    {id:'ledger',label:'B',person:'yoon',team:'audit',outcome:'audit',evidence:['b-field','b-letter'],phase:0},
    {id:'trust',label:'C',person:'choi',team:'response',outcome:'isolate',evidence:['c-field','c-letter'],phase:1},
    {id:'mitm',label:'D',person:'jung',team:'signals',outcome:'authenticate',evidence:['d-field','d-letter'],phase:1},
    {id:'heartbeat',label:'E',person:'park',team:'audit',outcome:'bounds',evidence:['e-field','e-letter'],phase:2},
    {id:'ddos',label:'F',person:'kang',team:'response',outcome:'absorb',evidence:['f-field','f-letter'],phase:2},
    {id:'outbreak',label:'G',person:'oh',team:'response',outcome:'contain',evidence:['g-field','g-letter'],phase:3}
  ];
  const documents=[
    {id:'members',phase:0,title:'입국 대장 · 일곱 명의 직원',kind:'명부',text:[
      '이 문서는 역사 재현실에서 일한 복원국 직원들의 명부다. 각 방은 실제 보안 역사를 본뜬 훈련 공간이며, 직원들이 그 시대의 실존 인물인 것은 아니다.',
      ...people.map(p=>p.name+' — '+p.note),
      '소속과 담당 사건 칸은 물에 번져 읽을 수 없다. 개인 소지품은 서로 빌려주지 않았다는 서기의 확인이 남아 있다.'
    ]},
    {id:'rooms',phase:0,title:'청사 안내도 · 방 이름과 소속',kind:'안내',text:[
      '해시실에는 통신분석실 직원들이 상주한다. 원장실은 기록감사실, 경계실은 침해대응실의 작업 공간이다.',
      '현장 보고서 맨 위의 방 이름은 보고서를 쓴 직원의 소속을 뜻한다. 방문 장소와 혼동하지 말 것.',
      '기록 A·B를 복원하면 두 번째 상자가 열린다. C·D 뒤에는 세 번째 상자, E·F 뒤에는 마지막 봉투가 열린다.'
    ]},
    {id:'a-field',phase:0,title:'전보실의 작업지',kind:'현장',text:[
      '기록 A / 해시실에서 작성. 작업대 한편에는 별무늬 손수건과 분해된 시계가 있었다.',
      '전보 두 장의 가장자리에 같은 난수표 번호가 찍혀 있었다. 첫 전보는 정기 보고라 원문이 남아 있다. 직원은 두 번째 전보가 가리키는 장소를 빈칸으로 남겼다.',
      '“처음부터 모든 암호를 의심할 필요는 없어. 같은 열쇠를 두 번 썼는지부터 보자.”'
    ]},
    {id:'a-letter',phase:0,title:'시계를 돌려받은 동료의 편지',kind:'서신',text:[
      '회중시계를 돌려받은 동료가, 시계를 고쳐 준 사람에게 쓴 편지. 봉투에는 기록 A의 확인 도장이 찍혔다.',
      '“덕분에 정각에 돌아갑니다. 전보도 읽었다면서요. 원문을 아는 한 통이 다른 통의 열쇠가 됐다니. 중복된 암호키로 두 전보를 복원한 결과를 등록부에 남겨 주세요.”',
      '추신. 내일부터는 내가 장부를 맡겠습니다. 작은 오차라도 그냥 넘기지 않을게요.'
    ]},
    {id:'b-field',phase:0,title:'청구서 뒷면의 메모',kind:'현장',text:[
      '기록 B / 원장실에서 작성. 보고자는 손목시계 대신 회중시계로 각 장부의 시각을 맞췄다.',
      '컴퓨터 사용료 합계가 75센트 모자란다. 계정 이름이 겹치는 두 손님이 있어 이름만으로는 방문을 연결할 수 없다.',
      '사용 기록, 작업 번호, 프린터 단말. 세 장의 시계까지 대조해야 같은 방문인지 알 수 있다.'
    ]},
    {id:'b-letter',phase:0,title:'별무늬 손수건 주인의 답장',kind:'서신',text:[
      '“시계가 멎지 않았다니 다행이에요. 기록 B에서는 돈을 되찾은 것보다 누락된 사용 세션을 실제 단말까지 연결한 것이 중요합니다.”',
      '미납 세션의 단말을 특정했다는 결과를 확인한다. 특정 계정 이름을 범인 이름으로 적지 말 것.',
      '두 기록이 돌아오면 다음 상자의 봉인을 풀겠다. 그 안에는 솔잎이 낀 보고서와 흰 장갑의 편지가 함께 들어 있다.'
    ]},
    {id:'c-field',phase:1,title:'커피 자국 없는 연결도',kind:'현장',text:[
      '기록 C / 경계실에서 작성. 펼친 연결도 사이에 말린 솔잎이 끼어 있었다. 커피잔은 없었다.',
      '방문자가 우편실의 소개로 다른 기계에 도달했다. 보고자는 직접 방문자 경로를 걸어 본 뒤, 소개가 퍼지는 두 갈림길에 표시를 남겼다.',
      '기계의 전원을 끄자는 제안은 거절했다. 우편과 백업 업무가 계속되어야 했기 때문이다.'
    ]},
    {id:'c-letter',phase:1,title:'중계소에 남긴 답신',kind:'서신',text:[
      '흰 장갑을 낀 직원이 기록 C의 보고자에게 썼다.',
      '“봉투를 검증하는 나와 달리, 당신은 기계가 건네는 소개장을 검증했군요. 모든 문을 잠근 것이 아니라 신뢰 연결을 철회했다는 결과를 남깁니다.”',
      '“내가 맡은 기록 D는 겉면의 봉인이 멀쩡해서 더 위험했어요. 잠겨 있는 것과 상대가 맞는 것은 다르더군요.”'
    ]},
    {id:'d-field',phase:1,title:'같은 이름의 두 인증서',kind:'현장',text:[
      '기록 D / 해시실에서 작성. 보고자는 봉투에 손을 대기 전에만 흰 면장갑을 꼈다.',
      '두 인증서 모두 records.lab라는 이름이지만 열쇠 지문은 K-41과 K-99로 다르다. 낡은 발급자 ROOT-D는 아직 신뢰 목록에 있었다.',
      '발신자는 한 통로라고 생각했지만 중계자는 두 통로를 만들었다. 중계소에는 K-99의 개인키만 있었다.'
    ]},
    {id:'d-letter',phase:1,title:'솔잎 책갈피 아래의 확인서',kind:'서신',text:[
      '“기록 D에서는 암호화를 해제한 것이 아니라, 손상된 발급자를 믿지 않도록 고쳤다. 정상 발급자는 남겨 정상 서신이 도착하는 것도 확인했다.”',
      '등록부의 결과는 위조 발급자의 신뢰 철회로 적는다. 서버의 이름을 비교하는 절차도 함께 복구했다.',
      '다음 상자는 붉은 실로 묶여 있다. 그 옆에 작은 종을 놓았으니, 열리면 공동 단말 담당자에게 알려 주자.'
    ]},
    {id:'e-field',phase:2,title:'붉은 실로 묶인 응답 기록',kind:'현장',text:[
      '기록 E / 원장실에서 작성. 낱장이 흩어지지 않도록 붉은 실로 묶었다.',
      'CAT 세 글자를 보냈는데 장치가 기억하던 다른 내용까지 돌아왔다. 요청자가 적어 보낸 길이를 장치가 그대로 믿었다.',
      '보고자는 “정상 요청도 전부 거부한다면 고친 것이 아니다”라는 주석을 달았다.'
    ]},
    {id:'e-letter',phase:2,title:'종소리 뒤의 검증표',kind:'서신',text:[
      '작은 종을 울리는 동료가 기록 E의 결과를 확인했다.',
      '“더 짧은 정상 요청은 통과했고 실제 데이터 끝을 넘는 요청은 거부됐습니다. 비밀번호 교체가 아니라 길이 경계 검사의 복구로 기록할게요.”',
      '“내 관문은 너무 많은 정상 이용자를 막아서 실패했어요. 서명을 확인한 점검기는 예외로 남겨야 했죠.”'
    ]},
    {id:'f-field',phase:2,title:'네 차례의 관문 부하',kind:'현장',text:[
      '기록 F / 경계실에서 작성. 공동 단말 담당자가 응답을 받을 때마다 작은 종을 한 번씩 울렸다.',
      '카메라와 공유기에서 온 요청이 번갈아 몰린다. 공동 단말의 정상 이용자는 한 출처로 보이지만 사람이 여러 명이다.',
      '점검기는 확인 화면을 풀지 못한다. 대신 검증 가능한 서명표를 갖고 있다. 정적인 응답은 같은 것을 다시 보내도 된다.'
    ]},
    {id:'f-letter',phase:2,title:'붉은 실의 담당자가 쓴 영수증',kind:'서신',text:[
      '“기록 F는 방문자가 줄었다는 이유만으로 성공이 아닙니다. 정상 이용자와 점검기의 요청이 모두 살아야 합니다.”',
      '네 차례 모두 원본 부하가 한도 안이면서 정상 서비스가 유지됐다는 결과를 확인한다.',
      '마지막 봉투에 말아 둔 병원 도면이 남았다. 도면의 주인은 노크가 잦아들어도 병동의 불은 꺼지면 안 된다고 했다.'
    ]},
    {id:'g-field',phase:3,title:'말아 둔 병원 도면',kind:'현장',text:[
      '기록 G / 경계실에서 작성. 접지 않은 도면을 늘 들고 다니던 직원의 보고서다.',
      '입고 PC의 감염이 업무선을 따라 번졌다. 직원을 보호하려면 모든 선을 끊으라는 지시가 왔지만, 보고자는 필수 업무가 멈추는 문제를 지적했다.',
      '수정 계획에는 연결이 모이는 기계의 패치와 하나의 우회 연결 차단이 함께 적혀 있다.'
    ]},
    {id:'g-letter',phase:3,title:'복원국장이 남긴 마지막 봉투',kind:'서신',text:[
      '“기록 G의 결과를 확인한다. 병동과 보관소는 안전하고 필수 업무선은 모두 보존됐다.”',
      '“너희가 복원한 것은 성공한 기술의 목록만이 아니다. 시계를 고쳐 준 사람, 서류를 묶은 사람, 답을 기다린 사람의 흔적이다. 누구를 믿고 무엇을 지켜야 하는지, 그 선택도 함께 남겨라.”',
      '일곱 기록의 담당자·소속·결과와 현장 검증이 모두 돌아오면 등록부의 마지막 장을 열 수 있다.'
    ]}
  ];
  const groups=[['cipher','ledger'],['trust','mitm'],['heartbeat','ddos']];
  const blankDraft=()=>({person:'',team:'',outcome:'',evidence:[]});
  const initial=()=>({drafts:{},sealed:[],read:[],pins:[],notes:{},hints:{}});
  function available(state){
    let phase=0;
    while(phase<groups.length&&groups[phase].every(id=>state.sealed.includes(id)))phase++;
    return documents.filter(d=>d.phase<=phase);
  }
  function matches(id,draft){
    const record=records.find(r=>r.id===id);
    return !!record&&['person','team','outcome'].every(field=>draft?.[field]===record[field])&&
      record.evidence.every(source=>draft?.evidence?.includes(source));
  }
  function assess(id,state){
    const draft=state.drafts[id]||blankDraft();
    if(!['person','team','outcome'].every(k=>draft[k]))return {ok:false,message:'담당자·소속·결과를 모두 가설로 입력하세요.'};
    if(draft.evidence.length<2)return {ok:false,message:'비교대에 근거 기록 두 장을 올린 뒤 등록부에 첨부하세요.'};
    if(!matches(id,draft))return {ok:false,message:'이 조합을 뒷받침하는 기록이 부족합니다. 인물의 소지품, 보고서의 방 이름, 동료의 확인서를 함께 대조해 보세요.'};
    if(!['members','rooms',...draft.evidence].every(doc=>state.read.includes(doc)))return {ok:false,message:'입국 대장·청사 안내도와 첨부한 근거를 직접 읽어 보세요.'};
    return {ok:true,message:'담당자·소속·결과를 뒷받침하는 근거가 연결됐습니다. 현장 퍼즐 검증까지 마치면 기록이 확정됩니다.'};
  }
  function seal(id,state,completed){
    if(!completed.includes(id)||!assess(id,state).ok)return false;
    if(!state.sealed.includes(id))state.sealed.push(id);
    return true;
  }
  function restore(raw){
    const state=initial();
    if(!raw||typeof raw!=='object')return state;
    for(const record of records){
      const draft=raw.drafts?.[record.id];
      if(!draft)continue;
      state.drafts[record.id]={
        person:people.some(p=>p.id===draft.person)?draft.person:'',
        team:teams.some(t=>t.id===draft.team)?draft.team:'',
        outcome:outcomes.some(o=>o.id===draft.outcome)?draft.outcome:'',
        evidence:Array.isArray(draft.evidence)?[...new Set(draft.evidence.filter(d=>documents.some(doc=>doc.id===d)))].slice(0,2):[]
      };
    }
    // Rebuild in unlock order so a damaged save cannot mark unread future documents.
    for(let phase=0;phase<=3;phase++){
      for(const doc of available(state)){
        if(Array.isArray(raw.read)&&raw.read.includes(doc.id)&&!state.read.includes(doc.id))state.read.push(doc.id);
      }
      for(const record of records.filter(r=>r.phase===phase)){
        if(Array.isArray(raw.sealed)&&raw.sealed.includes(record.id)&&assess(record.id,state).ok)state.sealed.push(record.id);
      }
    }
    state.pins=Array.isArray(raw.pins)?[...new Set(raw.pins.filter(id=>state.read.includes(id)))].slice(0,2):[];
    for(const doc of documents){
      if(typeof raw.notes?.[doc.id]==='string')state.notes[doc.id]=raw.notes[doc.id].slice(0,2000);
    }
    for(const r of records)state.hints[r.id]=Number.isInteger(raw.hints?.[r.id])?Math.max(0,Math.min(3,raw.hints[r.id])):0;
    return state;
  }
  function hint(id,count){
    const r=records.find(r=>r.id===id);
    if(count===1)return '근거를 찾을 기록은 「'+r.evidence.map(id=>documents.find(d=>d.id===id).title).join('」와 「')+'」입니다.';
    if(count===2)return '입국 대장의 소지품과 현장 보고서의 흔적을 맞추세요. 소속은 방 이름을 청사 안내도와 대조하고, 결과는 동료의 확인서에서 찾습니다.';
    return '담당자 '+people.find(p=>p.id===r.person).name+' / '+teams.find(t=>t.id===r.team).name+' / '+outcomes.find(o=>o.id===r.outcome).name+'. 두 근거를 첨부한 뒤 현장을 검증하세요.';
  }
  return {people,teams,outcomes,records,documents,groups,initial,blankDraft,available,matches,assess,seal,restore,hint};
});
