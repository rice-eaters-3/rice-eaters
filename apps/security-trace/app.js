'use strict';
(function(){
  const E=window.TraceEngine,cases=window.TraceCases,root=document.getElementById('app');
  const storageKey='rice_trace_v1';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let progress=E.restore(null),storageIssue='',screen='archive',feedback=null,historyOpen=false,frames=null,frame=0;
  const undoStacks={};
  try{progress=E.restore(JSON.parse(localStorage.getItem(storageKey)));}
  catch(error){storageIssue='기존 기록을 읽지 못했습니다. 새 사건 기록으로 시작합니다.';}
  const current=()=>cases.find(c=>c.id===progress.current)||cases[0];
  function session(){
    const id=current().id;
    progress.cases[id]||={board:E.initial(id),hints:0};
    return progress.cases[id];
  }
  function save(){
    try{localStorage.setItem(storageKey,JSON.stringify(progress));}
    catch(error){storageIssue='이 브라우저에서는 진행을 저장할 수 없습니다. 창을 닫으면 이번 진행이 사라질 수 있습니다.';}
  }
  function button(action,label,extra='',classes='button',disabled=false){
    return '<button type="button" class="'+classes+'" data-action="'+action+'" '+extra+(disabled?' disabled':'')+'>'+label+'</button>';
  }
  const time=value=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
  function announce(message){document.getElementById('announcer').textContent=message;}
  function openCase(id){
    if(!cases.some(c=>c.id===id))return;
    progress.current=id;screen='case';feedback=null;historyOpen=false;frames=null;frame=0;
    session();save();render();
    root.querySelector('h1')?.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  }
  function archive(){
    const next=cases.find(c=>!progress.completed.includes(c.id))||cases[0];
    const resume=progress.cases[progress.current]&&!progress.completed.includes(progress.current)?current():next;
    return '<section class="hero"><div><span class="eyebrow">A FIELD GUIDE TO THE UNSEEN</span>'+
      '<h1 tabindex="-1">누군가 지나갔다.<br><em>흔적은 남았다.</em></h1>'+
      '<p class="hero-copy">암호문 속의 반복, 장부의 작은 오차, 너무 친절한 답신.<br>'+
      '공격자의 눈으로 틈을 찾고, 방어자의 손으로 경계를 세우세요. 다섯 개의 사건을 풀다 보면 보안의 역사가 당신의 추리가 됩니다.</p>'+
      '<div class="hero-actions">'+button('open','사건 기록 열기 <span aria-hidden="true">↗</span>','data-case="'+resume.id+'"')+
      '<span class="micro">1인 플레이 · 약 30–45분<br>전문 지식 없이 시작 · 자동 저장</span></div></div>'+
      '<div class="hero-art" aria-hidden="true"><div class="file-preview"><div class="preview-top"><span>ARCHIVE / EVIDENCE</span><span>NO. 001—005</span></div>'+
      '<div class="preview-title">Nothing<br>is invisible.<span>EVERY SYSTEM LEAVES A TRACE.</span></div>'+
      '<div class="tape">83 45 <strong>40</strong> 86<br>28 48 <strong>68</strong> 15</div>'+
      '<span class="red-stamp">OPEN CASE</span><span class="preview-note">해답은 바깥에 있지 않다.<br>기록을 다시 읽을 것.</span></div></div></section>'+
      '<section aria-labelledby="archiveTitle"><div class="archive-heading"><div><div class="eyebrow">THE FIRST COLLECTION</div><h2 id="archiveTitle">미해결 기록 보관함</h2></div>'+
      '<div class="archive-progress"><span class="progress-track"><span style="width:'+progress.completed.length/5*100+'%"></span></span><span>'+
      progress.completed.length+' / 5 해결</span></div></div><div class="case-grid">'+
      cases.map(c=>{
        const cleared=progress.completed.includes(c.id),featured=c.id===resume.id&&!cleared;
        return '<button type="button" class="case-card'+(featured?' featured':'')+'" data-action="open" data-case="'+c.id+'">'+
          '<div class="card-top"><span class="eyebrow">CASE '+c.number+'</span>'+(cleared?'<span class="completed-tag">해결 완료 ✓</span>':'')+'</div>'+
          '<div class="card-year">'+c.year+'</div><h3>'+esc(c.title)+'</h3><p>'+esc(c.subtitle)+'</p>'+
          '<div class="card-bottom"><span>'+esc(c.category)+' · '+c.time+'</span><span class="file-arrow" aria-hidden="true">↗</span></div></button>';
      }).join('')+
      '<aside class="archive-note"><span class="eyebrow">NO GUESSWORK. ONLY CLUES.</span><h3>외운 답보다,<br>발견한 원리.</h3>'+
      '<p>각 사건은 다른 규칙으로 움직입니다. 실패에는 벌점이 없습니다. 되돌리기와 세 단계의 힌트를 이용해 가설을 실험하세요.</p>'+
      '<p>실제 역사를 바탕으로 만든 창작 이야기입니다. 모든 사건은 원하는 순서로 열 수 있습니다.</p></aside></div></section>';
  }
  function stageRole(c,b){
    if(['trust','heartbeat'].includes(c.id))return b.stage===0?'공격자 · 틈을 찾는 사람':'방어자 · 경계를 세우는 사람';
    return c.role;
  }
  function sidebar(c,item){
    return '<aside class="sidebar"><section class="story-note"><div class="eyebrow">FIELD NOTE / '+c.year+'</div>'+
      '<blockquote>'+esc(c.quote)+'</blockquote><p>'+esc(c.brief)+'</p></section>'+
      '<details class="rules" open><summary>이 사건의 규칙</summary><ol>'+c.rules.map(r=>'<li>'+esc(r)+'</li>').join('')+'</ol></details>'+
      '<section class="hint-box"><h3>막힌 지점이 있나요?</h3>'+
      (item.hints?c.hints.slice(0,item.hints).map((h,i)=>'<p><b>힌트 '+(i+1)+'.</b> '+esc(h)+'</p>').join(''):
        '<p>작은 단서부터, 원하면 구체적인 해법까지. 힌트를 써도 기록은 똑같이 남습니다.</p>')+
      button('hint',item.hints===3?'모든 힌트를 확인했어요':'힌트 한 장 열기 · '+item.hints+'/3','','button secondary',item.hints===3)+'</section>'+
      '<p class="historical-note">실제 역사와 창작 퍼즐은 어떻게 연결될까요? '+
      '<button type="button" data-action="history">'+(historyOpen?'실화 기록 접기':'실화 기록 보기')+'</button></p></aside>';
  }
  function history(c){
    return '<section class="history-file" id="historyFile"><div class="eyebrow">BEHIND THE CASE / '+c.year+'</div>'+
      '<h2>퍼즐 밖에 남은 기록</h2><div class="history-columns"><div><h3>실제로 있었던 일</h3><p>'+esc(c.history)+'</p></div>'+
      '<div><h3>이 사건에서 바꾼 것</h3><p>'+esc(c.model)+'</p></div></div>'+
      '<div class="source-list">'+c.sources.map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.label)+' ↗</a>').join('')+'</div></section>';
  }
  function words(numbers){
    const groups=[];
    for(let i=0;i<numbers.length;i+=2){
      const code=numbers.slice(i,i+2).join('');
      groups.push('<span class="word-token">'+esc(E.cipher.dictionary[code]||'미확인 '+code)+'</span>');
    }
    return '<div class="translation">'+groups.join('')+'</div>';
  }
  function digits(values,known){
    return '<div class="digit-row">'+values.map((n,i)=>'<span class="digit'+(known?(n===known[i]?' match':' wrong'):'')+'">'+n+'</span>').join('')+'</div>';
  }
  function cipherBoard(b){
    const decoded=E.decipher(b.key,E.cipher.first),second=E.decipher(b.key,E.cipher.second);
    return '<p class="puzzle-note"><strong>알려진 첫 원문</strong> 12 · 37 · 04 · 61 = 북쪽 / 보관실 / 자정 / 이동</p>'+
      '<span class="row-label">전보 A / 수신한 암호문</span>'+digits(E.cipher.first)+
      '<span class="row-label">공유된 키 / 각 다이얼을 조정하세요</span><div class="digit-row">'+b.key.map((n,i)=>
        '<div class="dial">'+button('dial','+','id="key-up-'+i+'" data-index="'+i+'" data-delta="1" aria-label="'+(i+1)+'번 키 증가"','')+
        '<output aria-label="'+(i+1)+'번 키 값">'+n+'</output>'+button('dial','−','id="key-down-'+i+'" data-index="'+i+'" data-delta="-1" aria-label="'+(i+1)+'번 키 감소"','')+'</div>').join('')+'</div>'+
      '<span class="row-label">전보 A / 복원 결과 · 초록은 알려진 원문과 일치</span>'+digits(decoded,E.cipher.known)+
      '<span class="row-label">전보 B / 수신한 암호문</span>'+digits(E.cipher.second)+
      '<span class="row-label">전보 B / 같은 키로 복원한 접선 정보</span>'+digits(second)+words(second)+
      '<div class="subhead"><h3>통신소 코드 사전</h3><small>두 자리씩 묶어 읽습니다</small></div>'+
      '<div class="codebook">'+Object.entries(E.cipher.dictionary).sort(([a],[b])=>a.localeCompare(b)).map(([code,word])=>
        '<span><b>'+code+'</b>'+esc(word)+'</span>').join('')+'</div>';
  }
  function shifts(kind,value){
    return '<label class="shift-line">기록에 더할 시간 <select id="'+kind+'" data-control="'+kind+'" aria-label="'+
      (kind==='jobShift'?'작업':'프린터')+' 시계 보정">'+
      Array.from({length:11},(_,i)=>i-5).map(n=>'<option value="'+n+'"'+(n===value?' selected':'')+'>'+(n>0?'+':'')+n+'분</option>').join('')+'</select></label>';
  }
  function recordButton(type,record,selected,html){
    return button(type,html,'id="'+type+'-'+record.id+'" data-id="'+record.id+'" aria-pressed="'+(record.id===selected)+'"','record-row');
  }
  function ledgerBoard(b){
    return '<p class="puzzle-note">청구 규칙 <strong>3초마다 25¢</strong> · 세 장부는 같은 작업의 시작을 기록합니다.</p>'+
      '<div class="ledgers"><section class="ledger-session"><div class="record-head"><b>01 / 사용 장부</b><span>표준시</span></div><div class="records">'+
      E.ledger.sessions.map(s=>recordButton('session',s,b.session,'<div class="record-cells"><strong>'+s.id+'</strong><span>'+time(s.time)+'</span></div>'+
        '<div class="record-cells"><span>'+s.seconds+'초 사용</span><span>청구 '+s.billed+'¢</span></div><small>계정 '+s.user+'</small>')).join('')+'</div></section>'+
      '<section><div class="record-head"><b>02 / 작업 장부</b></div><p class="sync-note">시계 점검 · 표준 20:00일 때 이 장부는 20:03</p>'+
      '<div class="records">'+E.ledger.jobs.map(j=>recordButton('job',j,b.job,'<div class="record-cells"><strong>'+j.id+'</strong><span>'+time(j.time+b.jobShift)+'</span></div>'+
        '<small>'+j.session+' → '+j.terminal+' · 원기록 '+time(j.time)+'</small>')).join('')+'</div>'+shifts('jobShift',b.jobShift)+'</section>'+
      '<section><div class="record-head"><b>03 / 프린터 보관지</b></div><p class="sync-note">시계 점검 · 표준 20:00일 때 이 장부는 19:58</p>'+
      '<div class="records">'+E.ledger.prints.map(p=>recordButton('print',p,b.print,'<div class="record-cells"><strong>'+p.terminal+'</strong><span>'+time(p.time+b.printShift)+'</span></div>'+
        '<small>작업 '+p.job+' · 원기록 '+time(p.time)+'</small>')).join('')+'</div>'+shifts('printShift',b.printShift)+'</section></div>';
  }
  function graph(spec,nodes,edgeClass){
    const position=id=>spec.nodes.find(n=>n.id===id);
    return '<div class="graph-scroller" tabindex="0" aria-label="연결 지도, 좁은 화면에서는 가로로 스크롤"><div class="graph">'+
      '<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="#78916c"/></marker></defs>'+
      spec.edges.map(e=>{
        const a=position(e.from),z=position(e.to);
        return '<line x1="'+a.x*10+'" y1="'+a.y*10+'" x2="'+z.x*10+'" y2="'+z.y*10+'" vector-effect="non-scaling-stroke" marker-end="url(#arrow)" class="'+
          (e.essential?'':'optional ')+edgeClass(e)+'"/>';
      }).join('')+'</svg>'+nodes+'</div></div>';
  }
  function pathNames(path){
    return '<div class="path-list" aria-label="지나온 경로">'+path.map((id,i)=>(i?'<i aria-hidden="true">→</i>':'')+
      '<span>'+E.trust.nodes.find(n=>n.id===id).label+'</span>').join('')+'</div>';
  }
  function trustBoard(b){
    const spec=E.trust,at=b.path[b.path.length-1],defending=b.stage===1,held=E.stamps(b.path);
    const reached=defending?E.trustReach(b.cuts):[];
    const nodes=spec.nodes.map(n=>{
      const allowed=E.canTravel(b,n.id);
      const status=defending?(reached.includes(n.id)?'도달 가능':'경로 차단'):
        n.id===at?'현재 위치':allowed?'이동 가능':b.path.includes(n.id)?'방문함':'연결 조건 필요';
      return button('travel','<strong>'+n.label+'</strong><small>'+status+'</small>',
        'id="node-'+n.id+'" data-id="'+n.id+'" style="left:'+n.x+'%;top:'+n.y+'%"',
        'graph-node'+(n.id===at&&!defending?' current':'')+(allowed?' available':'')+
        (defending&&reached.includes(n.id)?' infected':''),defending||!allowed);
    }).join('');
    return '<div class="budget"><span>'+(defending?'차단한 연결':'기록실까지의 이동')+'</span><strong>'+
      (defending?b.cuts.length+' / 2':(b.path.length-1)+' / 4')+'</strong></div>'+
      (defending?'<p class="puzzle-note">아래 연결을 눌러 신뢰를 철회하세요. 주황 노드는 현재 공격자가 도달할 수 있는 곳입니다.</p>':
        '<div class="stamp-list" aria-label="보유 인장">'+[...held].map(g=>'<span>'+spec.stamps[g]+' 인장</span>').join('')+'</div>')+
      graph(spec,nodes,e=>b.cuts.includes(e.id)?'cut':b.path.some((id,i)=>i>0&&b.path[i-1]===e.from&&id===e.to)?'path':'')+
      '<div class="graph-legend"><span>→ 연결의 방향</span><span>실선 · 필수 업무</span><span>점선 · 철회 가능한 신뢰</span><span class="graph-scroll-note">↔ 지도를 좌우로 스크롤할 수 있습니다</span></div>'+
      (!defending?pathNames(b.path):'')+
      '<div class="edge-list">'+spec.edges.map(e=>{
        const from=spec.nodes.find(n=>n.id===e.from),to=spec.nodes.find(n=>n.id===e.to);
        if(defending)return button('cut',esc(from.label)+' → '+esc(to.label)+'<small>'+
          (e.essential?'필수 · 유지':b.cuts.includes(e.id)?'차단됨 · 다시 연결':'연결됨 · 차단하기')+'</small>',
          'id="edge-'+e.id+'" data-id="'+e.id+'" aria-pressed="'+b.cuts.includes(e.id)+'"','edge-row',!!e.essential);
        return '<div class="edge-row"><span>'+from.label+' → '+to.label+'</span><small>'+spec.stamps[e.requires]+' 인장 필요</small></div>';
      }).join('')+'</div>';
  }
  function heartbeatBoard(b){
    if(b.stage===0){
      return '<p class="puzzle-note">보낸 신호 <strong>CAT</strong> · 실제 길이 <strong>3</strong> · 응답 한도 <strong>8칸</strong></p>'+
        '<span class="row-label">통신 장치의 메모리 / 알려진 영역 밖은 아직 미확인</span>'+
        '<div class="memory-strip">'+E.memory.map((value,i)=>{
          const read=!!b.response&&i<b.response.length;
          return '<div class="memory-cell'+(i>2?' outside':'')+(read?' read':'')+'"><small>'+String(i).padStart(2,'0')+'</small>'+
            (i<3||read?esc(value):'·')+'</div>';
        }).join('')+'</div><div class="length-controls"><label for="claimed">요청 길이</label>'+
        '<input id="claimed" type="range" min="0" max="16" value="'+b.claimed+'" data-control="length">'+
        '<output id="lengthValue" for="claimed">'+b.claimed+'</output>'+button('probe','응답 받기','id="probe"','button secondary')+'</div>'+
        '<span class="row-label">마지막으로 수신한 응답 / 요청 길이를 바꾼 뒤 다시 받아보세요</span>'+
        '<div class="terminal packet-response" aria-live="polite">'+(b.response?b.response.length?esc(b.response.join(' ')):'(빈 응답)':'<span class="dim">응답 대기 중_</span>')+'</div>';
    }
    const operand=(field,label)=>'<select id="'+field+'" data-control="'+field+'" aria-label="'+label+'">'+
      [['claimed','요청 길이'],['actual','실제 길이']].map(([v,t])=>'<option value="'+v+'"'+(b[field]===v?' selected':'')+'>'+t+'</option>').join('')+'</select>';
    return '<p class="puzzle-note">이 조건이 참이면 복사를 허용합니다. 정상 요청을 막는 검사도 정답이 아닙니다.</p>'+
      '<div class="rule-builder">'+operand('left','비교식 왼쪽')+
      '<select id="operator" data-control="operator" aria-label="비교 연산">'+['<','≤','=','≥','>'].map(op=>'<option'+(op===b.operator?' selected':'')+'>'+esc(op)+'</option>').join('')+'</select>'+
      operand('right','비교식 오른쪽')+'<b>이면 허용</b></div>'+
      '<div class="subhead"><h3>장치에 도착한 요청들</h3><small>“경계 검사”를 눌러 검증합니다</small></div>'+
      '<div class="packet-tests">'+E.packets.map(p=>{
        const allowed=E.ruleAllows(b,p),correct=allowed===(p.claimed<=p.actual),tested=feedback?.tested;
        return '<div class="packet-test'+(tested?(correct?' pass':' fail'):'')+'"><span>실제 '+p.actual+' / 요청 '+p.claimed+'</span>'+
          '<strong>'+(tested?(allowed?'허용':'거부')+' · '+(correct?'정상 처리 ✓':'처리 오류 !'):(p.claimed<=p.actual?'정상 요청':'초과 요청'))+'</strong></div>';
      }).join('')+'</div>';
  }
  function outbreakBoard(b){
    const spec=E.outbreak,infected=frames?frames[frame]:['intake'];
    const nodes=spec.nodes.map(n=>{
      const patched=b.patched.includes(n.id),sick=infected.includes(n.id);
      return button('patch','<strong>'+n.label+'</strong><small>'+
        (sick?'감염됨':patched?'패치됨':n.target?'보호 목표':'패치 2점')+'</small>',
        'id="node-'+n.id+'" data-id="'+n.id+'" aria-pressed="'+patched+'" style="left:'+n.x+'%;top:'+n.y+'%"',
        'graph-node'+(patched?' patched':'')+(sick?' infected':'')+(n.target?' target':''),n.id==='intake');
    }).join('');
    return '<div class="budget"><span>대응 자원 <small>패치 2점 / 연결 차단 1점</small></span><strong>'+E.cost(b)+' / 3</strong></div>'+
      '<p class="puzzle-note">기계를 눌러 패치를 준비하고, 아래 점선 연결을 골라 차단하세요. 선택을 다시 누르면 해제됩니다.</p>'+
      graph(spec,nodes,e=>b.cuts.includes(e.id)?'cut':'')+
      '<div class="graph-legend"><span>주황 · 감염</span><span>초록 · 패치</span><span>바깥 테두리 · 보호 목표</span><span class="graph-scroll-note">↔ 지도를 좌우로 스크롤할 수 있습니다</span></div>'+
      '<div class="edge-list">'+spec.edges.map(e=>button('cut',
        spec.nodes.find(n=>n.id===e.from).label+' → '+spec.nodes.find(n=>n.id===e.to).label+
        '<small>'+(e.essential?'필수 업무선':b.cuts.includes(e.id)?'차단됨 · 1점':'연결됨 · 차단 1점')+'</small>',
        'id="edge-'+e.id+'" data-id="'+e.id+'" aria-pressed="'+b.cuts.includes(e.id)+'"','edge-row',!!e.essential)).join('')+'</div>'+
      '<section class="simulation">'+button('simulate','확산 시험하기','id="simulate"','button secondary')+
      (frames?'<div class="simulation-controls">'+button('frame','← 이전','data-delta="-1"','button quiet',frame===0)+
        '<span>확산 단계 '+frame+' / '+(frames.length-1)+'</span>'+
        button('frame','다음 →','data-delta="1"','button quiet',frame===frames.length-1)+'</div>'+
        '<p class="puzzle-note" style="margin-top:12px">현재 감염 '+infected.length+'대 · 계획을 바꾸면 시험을 처음부터 다시 합니다.</p>':'')+'</section>';
  }
  function solved(c){
    const next=cases[cases.findIndex(x=>x.id===c.id)+1];
    return '<div class="solved-banner"><div class="eyebrow">CASE CLOSED / '+c.number+'</div><h2>흔적이 하나의 이야기가 됐다.</h2>'+
      '<p>'+esc(c.ending)+'</p><div class="solved-actions">'+
      (next?button('open','다음 사건 · '+esc(next.title),'data-case="'+next.id+'"'):button('archive','사건집 돌아보기'))+
      button('reset','이 사건 다시 풀기','','button secondary')+'</div></div>'+history(c);
  }
  function caseView(){
    const c=current(),item=session(),b=item.board,cleared=progress.completed.includes(c.id);
    const role=stageRole(c,b),attack=role.startsWith('공격자'),twoStage=['trust','heartbeat'].includes(c.id);
    const readyToSwitch=twoStage&&b.stage===0&&E.evaluate(c.id,b).ok;
    const stageText=twoStage?(b.stage===0?'01 / 틈을 찾기':'02 / 경계를 세우기'):'EVIDENCE DESK';
    const titles={cipher:'공유 키 복원기',ledger:'세 장부의 교차점',trust:b.stage===1?'신뢰 철회 계획':'방문자의 이동 경로',
      heartbeat:b.stage===1?'응답 장치의 경계 검사':'통신 장치 응답 실험',outbreak:'병원망 대응 계획'};
    const renderers={cipher:cipherBoard,ledger:ledgerBoard,trust:trustBoard,heartbeat:heartbeatBoard,outbreak:outbreakBoard};
    const submitTitle={cipher:'전보 해독 확인',ledger:'증거 연결 확인',trust:b.stage===1?'차단 계획 확인':'경로 확인',
      heartbeat:b.stage===1?'경계 검사':'응답 분석 확인',outbreak:'대응 계획 확정'};
    return '<nav class="case-strip" aria-label="사건 선택">'+button('archive','← 목록','','strip-button')+
      cases.map(x=>button('open',x.number+' / '+x.year+(progress.completed.includes(x.id)?' ✓':''),
        'data-case="'+x.id+'" aria-current="'+(c.id===x.id)+'" aria-label="'+esc(x.title)+'"','strip-button')).join('')+'</nav>'+
      '<header class="case-heading"><div><span class="role-pill'+(attack?' attack':'')+'"><span class="role-dot"></span>'+esc(role)+'</span>'+
      '<div class="eyebrow">CASE '+c.number+' / '+esc(c.category)+' / '+esc(c.concept)+'</div><h1 tabindex="-1">'+esc(c.title)+'</h1><p>'+esc(c.subtitle)+'</p></div>'+
      '<div class="year-badge" aria-hidden="true">'+c.year+'</div></header>'+
      (cleared?'<section class="workbench">'+solved(c)+'</section>':
      '<div class="case-layout"><section class="workbench" aria-label="사건 퍼즐"><div class="bench-head"><h2>'+titles[c.id]+'</h2><span>'+stageText+'</span></div>'+
      '<div class="bench-content"><div class="objective"><small>YOUR OBJECTIVE</small><p>'+esc(c.objective)+'</p></div>'+
      renderers[c.id](b)+'</div>'+
      (feedback?'<p id="feedback" class="feedback '+(feedback.ok?'success':'error')+'" role="status">'+esc(feedback.message)+'</p>':'')+
      '<div class="bench-footer">'+button('undo','↶ 되돌리기','','button quiet',!undoStacks[c.id]?.length)+
      button('reset','처음부터','','button quiet')+
      (readyToSwitch?button('switch','방어자의 자리로 →','','button submit'):button('submit',submitTitle[c.id],'id="submit"','button submit'))+
      '</div></section>'+sidebar(c,item)+'</div>'+(historyOpen?history(c):''));
  }
  function render(){
    const focused=document.activeElement?.id;
    root.innerHTML=(storageIssue?'<p class="storage-warning" role="status">'+esc(storageIssue)+'</p>':'')+
      (screen==='archive'?archive():caseView());
    if(focused)document.getElementById(focused)?.focus({preventScroll:true});
  }
  function update(action){
    const c=current(),item=session(),old=item.board;
    const next=E.act(c.id,old,action);
    if(JSON.stringify(next)===JSON.stringify(old))return;
    undoStacks[c.id]||=[];undoStacks[c.id].push(old);
    if(undoStacks[c.id].length>80)undoStacks[c.id].shift();
    item.board=next;feedback=null;frames=null;frame=0;save();render();
  }
  root.addEventListener('click',event=>{
    const target=event.target.closest('button[data-action]');
    if(!target||target.disabled)return;
    const action=target.dataset.action;
    try{
      if(action==='open'){openCase(target.dataset.case);return;}
      if(action==='archive'){screen='archive';render();window.scrollTo({top:0,behavior:'instant'});return;}
      const c=current(),item=session();
      if(action==='dial'){update({type:'dial',index:Number(target.dataset.index),delta:Number(target.dataset.delta)});return;}
      if(['session','job','print','travel','cut','patch'].includes(action)){update({type:action,id:target.dataset.id});return;}
      if(action==='probe'||action==='switch'){update({type:action});if(action==='switch')announce('시점 전환. 방어자의 자리입니다.');return;}
      if(action==='hint'){
        item.hints=Math.min(3,item.hints+1);save();render();announce(c.hints[item.hints-1]);return;
      }
      if(action==='history'){historyOpen=!historyOpen;render();return;}
      if(action==='reset'){
        if(!window.confirm('이 사건의 퍼즐을 처음부터 다시 시작할까요?'))return;
        progress.cases[c.id]={board:E.initial(c.id),hints:item.hints};
        progress.completed=progress.completed.filter(id=>id!==c.id);
        undoStacks[c.id]=[];feedback=null;frames=null;save();render();return;
      }
      if(action==='undo'){
        const previous=undoStacks[c.id]?.pop();
        if(previous){item.board=previous;feedback=null;frames=null;save();render();}return;
      }
      if(action==='frame'){
        frame=Math.max(0,Math.min(frames.length-1,frame+Number(target.dataset.delta)));render();return;
      }
      if(action==='simulate'){
        frames=E.spread(item.board);frame=frames.length-1;
        feedback=E.evaluate(c.id,item.board);render();announce(feedback.message);return;
      }
      if(action==='submit'){
        feedback={...E.evaluate(c.id,item.board),tested:true};
        const isFinal=!['trust','heartbeat'].includes(c.id)||item.board.stage===1;
        if(feedback.ok&&isFinal){
          if(!progress.completed.includes(c.id))progress.completed.push(c.id);
          save();
        }
        render();announce(feedback.message);
        if(feedback.ok&&isFinal)root.querySelector('.solved-banner').scrollIntoView({block:'start'});
      }
    }catch(error){feedback={ok:false,message:error.message};render();announce(error.message);}
  });
  root.addEventListener('input',event=>{
    if(event.target.id==='claimed')document.getElementById('lengthValue').textContent=event.target.value;
  });
  root.addEventListener('change',event=>{
    const type=event.target.dataset.control;
    if(!type)return;
    const numeric=['length','jobShift','printShift'].includes(type);
    try{update({type,value:numeric?Number(event.target.value):event.target.value});}
    catch(error){feedback={ok:false,message:error.message};render();announce(error.message);}
  });
  window.addEventListener('storage',event=>{
    if(event.key!==storageKey||!event.newValue)return;
    try{
      const saved=E.restore(JSON.parse(event.newValue));
      // Keep another tab's board out of an active puzzle; merge completed files only.
      for(const id of saved.completed){
        if(id===progress.current&&screen==='case')continue;
        if(!progress.completed.includes(id)){progress.completed.push(id);progress.cases[id]=saved.cases[id];}
      }
      if(screen==='archive')render();
    }catch(error){/* A malformed save in another tab leaves this tab's puzzle intact. */}
  });
  render();
})();
