'use strict';
(function(){
  const E=window.TraceEngine,G=window.TraceArchive,cases=window.TraceCases,root=document.getElementById('app');
  const storageKey='rice_trace_v1';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let progress=E.restore(null),storageIssue='',screen='archive',feedback=null,historyOpen=false,frames=null,frame=0;
  const undoStacks={};
  const archiveUI={tab:'records',doc:'members',record:'cipher',query:'',message:null};
  progress.archive=G.initial();
  try{
    const raw=JSON.parse(localStorage.getItem(storageKey));
    progress=E.restore(raw);progress.archive=G.restore(raw?.archive);
  }
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
    if(!canOpen(id)){
      screen='archive';archiveUI.tab='registry';archiveUI.record=id;
      archiveUI.message={ok:false,message:'먼저 기록을 대조해 담당자·소속·결과의 가설과 근거를 연결하세요.'};
      render();return;
    }
    progress.current=id;screen='case';feedback=null;historyOpen=false;frames=null;frame=0;
    session();save();render();
    root.querySelector('h1')?.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  }
  function canOpen(id){return !!progress.cases[id]||G.assess(id,progress.archive).ok;}
  function archive(){
    const state=progress.archive,available=G.available(state);
    const doc=available.find(d=>d.id===archiveUI.doc)||available[0];
    if(!state.read.includes(doc.id)){state.read.push(doc.id);save();}
    const tabs=[['records','기록 검색'],['people','인명 대장'],['registry','복원 등록부']];
    const secretary=state.sealed.length===7?'등록부가 돌아왔어요. 이제 마지막 장을 읽을 수 있어요.':
      state.sealed.length<2?'서기 아리 — 먼저 입국 대장과 청사 안내도를 읽어 보세요. 기록 A와 B의 단서는 같은 상자에 있어요.':
      state.sealed.length<4?'서기 아리 — 두 번째 상자를 열었어요. 앞선 직원의 편지가 다른 직원의 신원을 말해 줄지도 몰라요.':
      state.sealed.length<6?'서기 아리 — 세 번째 상자가 열렸어요. 성공한 것뿐 아니라 무엇을 살렸는지도 기록해 주세요.':
      '서기 아리 — 마지막 봉투예요. 병동의 불이 꺼지지 않았는지 확인해 주세요.';
    return '<section class="restoration-intro"><div><div class="eyebrow">BUREAU OF LOST RECORDS / CHAPTER '+(Math.min(4,Math.floor(state.sealed.length/2)+1))+'</div>'+
      '<h1 tabindex="-1">사라진 등록부를<br>다시 써 주세요.</h1><p>복원국의 일곱 직원이 남긴 현장 보고서와 편지. 이름과 소속, 마지막 결과가 뒤섞였습니다. '+
      '기록을 검색하고 두 근거를 비교해 등록부를 복원하세요. 추론한 보안 원리는 현장 퍼즐에서 직접 검증합니다.</p></div>'+
      '<aside class="secretary-note"><span class="eyebrow">ARCHIVIST / ARI</span><p>'+esc(secretary)+'</p><div class="archive-progress">'+
      '<span class="progress-track"><span style="width:'+state.sealed.length/7*100+'%"></span></span><b>'+state.sealed.length+' / 7 복원</b></div>'+
      '<small>현장 검증 '+progress.completed.length+' / 7 · 읽은 기록 '+state.read.length+' / '+G.documents.length+'</small></aside></section>'+
      '<nav class="archive-tabs" aria-label="복원국 작업">'+tabs.map(([id,label])=>button('archive-tab',label,
        'data-tab="'+id+'" aria-current="'+(archiveUI.tab===id)+'"','strip-button')).join('')+'</nav>'+
      (archiveUI.message?'<p class="feedback '+(archiveUI.message.ok?'success':'error')+'" role="status">'+esc(archiveUI.message.message)+'</p>':'')+
      (archiveUI.tab==='records'?documentDesk(available,doc):archiveUI.tab==='people'?peopleDesk():registryDesk())+
      (state.pins.length?comparisonDesk():'')+(state.sealed.length===7?epilogue():'');
  }
  function documentDesk(available,doc){
    const state=progress.archive,q=archiveUI.query.trim().toLocaleLowerCase();
    const found=available.filter(d=>(d.title+' '+d.kind+' '+d.text.join(' ')).toLocaleLowerCase().includes(q));
    const tags=['손수건','회중시계','솔잎','장갑','붉은 실','작은 종','도면'].filter(t=>doc.text.join(' ').includes(t));
    return '<div class="document-desk"><aside class="document-index"><form id="record-search"><label for="recordSearch">기록 속 단어 찾기</label>'+
      '<div class="search-line"><input id="recordSearch" name="query" type="search" maxlength="100" value="'+esc(archiveUI.query)+'" placeholder="예: 시계, 장갑, ROOT-D">'+
      '<button class="button" type="submit">검색</button></div></form><p class="micro">'+found.length+'건 / 공개 '+available.length+'건 · '+(G.documents.length-available.length)+'건 봉인</p>'+
      '<nav aria-label="공개된 기록">'+found.map(d=>button('read-doc','<b>'+esc(d.title)+'</b><small>'+esc(d.kind)+' · '+(state.read.includes(d.id)?'읽음':'새 기록')+'</small>',
        'data-doc="'+d.id+'" aria-current="'+(d.id===doc.id)+'"','doc-entry')).join('')+
      (!found.length?'<p class="puzzle-note">검색 결과가 없습니다. 다른 단어를 쓰거나 복원 등록부에서 후속 상자를 열어 보세요.</p>':'')+'</nav>'+
      button('clear-search','검색 지우기','','button quiet')+'</aside><article class="document-reader" aria-labelledby="documentTitle">'+
      '<div class="eyebrow">'+esc(doc.kind)+' / '+doc.id.toUpperCase()+'</div><h2 id="documentTitle">'+esc(doc.title)+'</h2>'+
      doc.text.map(p=>'<p>'+esc(p)+'</p>').join('')+'<div class="word-links">'+tags.map(t=>button('search-word',esc(t),'data-term="'+esc(t)+'"','word-link')).join('')+'</div>'+
      button('pin-doc',state.pins.includes(doc.id)?'비교대에서 내리기':'비교대에 올리기','data-doc="'+doc.id+'"','button secondary')+
      '<label class="note-label" for="docNote">이 기록에 메모 남기기 <small>자동 저장 · 2,000자</small></label>'+
      '<textarea id="docNote" data-doc="'+doc.id+'" maxlength="2000" rows="3" placeholder="아직 확정하지 못한 가설도 적어 두세요.">'+esc(state.notes[doc.id]||'')+'</textarea></article></div>';
  }
  function peopleDesk(){
    return '<section class="people-desk" aria-label="직원 인명 대장">'+G.people.map(p=>{
      const record=G.records.find(r=>r.person===p.id),sealed=progress.archive.sealed.includes(record.id);
      return '<article class="person-file"><span class="person-initial" aria-hidden="true">'+esc(p.name[0])+'</span><h2>'+esc(p.name)+'</h2><p>'+esc(p.note)+'</p>'+
        (sealed?'<p class="recovered">'+G.teams.find(t=>t.id===record.team).name+' · 기록 '+record.label+'<br>'+G.outcomes.find(o=>o.id===record.outcome).name+'</p>':
          '<p class="micro">소속 · 담당 기록 · 결과 미확인</p>')+button('search-word','이 이름으로 기록 찾기','data-term="'+esc(p.name)+'"','button quiet')+'</article>';
    }).join('')+'</section>';
  }
  function draftSelect(id,field,label,options,draft,sealed){
    return '<label>'+label+'<select id="draft-'+field+'" data-draft="'+field+'" data-case="'+id+'"'+(sealed?' disabled':'')+'><option value="">아직 모름</option>'+
      options.map(option=>'<option value="'+option.id+'"'+(draft[field]===option.id?' selected':'')+'>'+esc(option.name)+'</option>').join('')+'</select></label>';
  }
  function registryDesk(){
    const state=progress.archive,r=G.records.find(r=>r.id===archiveUI.record)||G.records[0];
    const c=cases.find(c=>c.id===r.id),draft=state.drafts[r.id]||G.blankDraft(),sealed=state.sealed.includes(r.id);
    const available=G.available(state),discovered=r.evidence.every(id=>available.some(d=>d.id===id)),hints=state.hints[r.id]||0;
    return '<div class="registry-desk"><nav class="registry-index" aria-label="복원 대상">'+G.records.map(record=>button('select-record',
      '<b>기록 '+record.label+'</b><small>'+cases.find(c=>c.id===record.id).year+' · '+(state.sealed.includes(record.id)?'복원 완료':record.evidence.every(id=>available.some(d=>d.id===id))?'추론 가능':'후속 상자')+'</small>',
      'data-case="'+record.id+'" aria-current="'+(record.id===r.id)+'"','doc-entry')).join('')+'</nav>'+
      '<section class="registry-form"><div class="eyebrow">RECOVERY FILE / '+r.label+'</div><h2>'+esc(c.title)+'</h2>'+
      '<p>현장에 남은 개인 소지품으로 담당자를, 보고서의 방 이름으로 소속을, 동료의 확인서로 결과를 복원하세요.</p>'+
      (!discovered?'<p class="feedback">이 기록의 근거는 아직 봉인된 상자에 있습니다. 앞선 상자의 두 기록을 복원하세요.</p>':'')+
      '<div class="deduction-fields">'+draftSelect(r.id,'person','담당자',G.people,draft,sealed)+draftSelect(r.id,'team','소속',G.teams,draft,sealed)+
      draftSelect(r.id,'outcome','마지막 결과',G.outcomes,draft,sealed)+'</div>'+
      '<h3>첨부한 근거 두 장</h3><div class="attached-evidence">'+(draft.evidence.length?draft.evidence.map(id=>'<span>'+esc(G.documents.find(d=>d.id===id).title)+'</span>').join(''):'<p class="micro">기록 검색에서 근거 두 장을 비교대에 올린 뒤 첨부하세요.</p>')+'</div>'+
      '<div class="registry-actions">'+button('attach-evidence','비교대의 두 기록 첨부','data-case="'+r.id+'"','button quiet',sealed||state.pins.length!==2)+
      button('check-record',sealed?'복원 확정 ✓':'추론 대조','data-case="'+r.id+'"','button',sealed||!discovered)+
      button('open',progress.completed.includes(r.id)?'현장 검증 다시 보기':'현장 퍼즐로 검증','data-case="'+r.id+'"','button secondary',!canOpen(r.id))+'</div>'+
      '<p class="micro">세 항목과 근거를 한 묶음으로 대조합니다. 맞은 칸만 따로 알려주지는 않습니다.</p>'+
      (sealed?'<p class="recovered">직원의 기록이 등록부로 돌아왔습니다. 후속 기록이 있는지 기록 검색을 확인하세요.</p>':'')+
      '<div class="record-hints">'+button('record-hint','등록부 추리 도움말 · '+hints+'/3','data-case="'+r.id+'"','button quiet',hints===3||!discovered)+
      Array.from({length:hints},(_,i)=>'<p>'+esc(G.hint(r.id,i+1))+'</p>').join('')+'</div></section></div>';
  }
  function comparisonDesk(){
    const state=progress.archive;
    return '<section class="comparison-desk"><div class="archive-heading"><h2>두 기록의 비교대</h2><small>'+state.pins.length+' / 2</small></div><div class="comparison-grid">'+
      state.pins.map(id=>{const d=G.documents.find(d=>d.id===id);return '<article><h3>'+esc(d.title)+'</h3>'+d.text.map(p=>'<p>'+esc(p)+'</p>').join('')+
        button('pin-doc','비교대에서 내리기','data-doc="'+id+'"','button quiet')+'</article>';}).join('')+'</div></section>';
  }
  function epilogue(){
    return '<section class="history-file guild-ending"><div class="eyebrow">THE LAST PAGE / 7 RECORDS RESTORED</div><h2>이름이 돌아온 자리</h2>'+
      '<p>서기 아리는 마지막 빈칸을 채운 뒤에도 서랍을 닫지 않았다. 회중시계를 고쳐 준 손, 붉은 실로 묶은 검증표, 답변을 기다리던 작은 종. 따로 놓으면 잡음이던 기록들이 이제 서로의 증인이 됐다.</p>'+
      '<p>일곱 직원은 서로 다른 시대의 실패를 다시 걸었다. 어떤 이는 틈을 찾았고, 어떤 이는 문을 지켰다. 모두가 지키려 했던 것은 같은 것이었다. 믿을 수 있는 상대와, 멈추지 않아야 할 일.</p>'+
      '<p class="recovered">복원국 등록부 전권 복원 완료 · 이제 각 사건의 실제 역사와 기록을 자유롭게 다시 살펴볼 수 있습니다.</p></section>';
  }
  function stageRole(c,b){
    if(['trust','heartbeat','mitm'].includes(c.id))return b.stage===0?'공격자 · 틈을 찾는 사람':'방어자 · 경계를 세우는 사람';
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
  function mitmBoard(b){
    if(b.stage===0)return '<p class="puzzle-note">요청한 상대 records.lab · 실제 서버 키 K-41 · 중계자가 가진 개인키 K-99</p>'+
      '<div class="relay-route"><span>발신자</span><b>암호 통로 ①</b><span class="middle-node">중계자</span><b>암호 통로 ②</b><span>기록실</span></div>'+
      '<div class="certificate-columns">'+['front','back'].map((side,i)=>'<section><h3>통로 '+(i+1)+' · '+(i===0?'발신자에게 보여줄 인증서':'기록실에서 받을 인증서')+'</h3>'+
        E.certificates.map(cert=>button(side,'<b>'+esc(cert.name)+'</b><span>'+esc(cert.host)+'</span><small>열쇠 '+cert.key+' / 발급자 '+cert.issuer+'</small>',
          'id="'+side+'-'+cert.id+'" data-id="'+cert.id+'" aria-pressed="'+(b[side]===cert.id)+'"','record-row')).join('')+'</section>').join('')+'</div>'+
      button('relay','중계 시험','id="relay"','button secondary')+
      '<div class="terminal packet-response" style="margin-top:16px">'+(b.observed?'통로 ① 발신자 ↔ 중계자 / K-99<br>중계자가 읽은 가상 서신: 전보상자 7<br>통로 ② 중계자 ↔ 기록실 / K-41':'두 인증서를 고르고 중계 시험을 실행하세요.')+'</div>';
    return '<p class="puzzle-note">이름 검사를 켜고, 신뢰할 인증서 발급자를 선택하세요. 실제 상대의 이름은 records.lab입니다.</p>'+
      '<div class="edge-list">'+button('hostname','상대 이름 확인 <small>'+(b.verifyHost?'사용 중':'꺼짐')+'</small>',
        'id="verify-host" aria-pressed="'+b.verifyHost+'"','edge-row')+
      ['ROOT-G','ROOT-D','ROOT-X'].map(id=>button('root','발급자 '+id+'<small>'+(b.roots.includes(id)?'신뢰함':'신뢰하지 않음')+'</small>',
        'id="root-'+id+'" data-id="'+id+'" aria-pressed="'+b.roots.includes(id)+'"','edge-row')).join('')+'</div>'+
      '<div class="subhead"><h3>연결 검증표</h3><small>정상 기록실만 허용해야 합니다</small></div><div class="packet-tests">'+
      E.certificates.map(cert=>{
        const allowed=E.certificateAllowed(b,cert),correct=allowed===(cert.id==='real'),tested=feedback?.tested;
        return '<div class="packet-test'+(tested?(correct?' pass':' fail'):'')+'"><span>'+esc(cert.name)+'<br><small>'+cert.host+' / '+cert.issuer+'</small></span><strong>'+
          (tested?(allowed?'허용':'거부')+' · '+(correct?'정상 처리':'오류'):'검증 대기')+'</strong></div>';
      }).join('')+'</div>';
  }
  function ddosBoard(b){
    const rounds=E.trafficRounds(b),tested=feedback?.tested;
    return '<div class="budget"><span>관문 대응 자원 <small>원본 처리 한도 5 / 차례</small></span><strong>'+E.defenseCost(b)+' / 4</strong></div>'+
      '<div class="edge-list">'+E.defenses.map(d=>button('defense','<span><b>'+esc(d.name)+'</b><br><small>'+esc(d.detail)+'</small></span><strong>'+
        (b.enabled.includes(d.id)?'선택됨':'미선택')+' · '+d.cost+'점</strong>',
        'id="defense-'+d.id+'" data-id="'+d.id+'" aria-pressed="'+b.enabled.includes(d.id)+'"','edge-row')).join('')+'</div>'+
      '<div class="subhead"><h3>관문에 도착한 요청</h3><small>네 차례의 실제 요청 수</small></div><div class="traffic-sources">'+
      E.traffic.map(group=>'<article><b>'+esc(group.name)+'</b><span>'+group.rates.join(' / ')+'</span><small>'+
        (group.challenge?'확인 화면 가능':group.ticket?'확인 화면 불가 · 검증된 서명표':'확인 화면 불가 · 서명표 없음')+
        (group.cached.some(n=>n)?'<br>재사용 가능한 정적 응답 '+group.cached.join(' / '):'')+'</small></article>').join('')+'</div>'+
      '<div class="subhead"><h3>부하 시험 결과</h3><small>차단된 정상 요청도 실패로 봅니다</small></div>'+
      '<div class="traffic-rounds">'+rounds.map((round,i)=>'<article class="'+(tested?(round.load<=5&&round.served===round.expected?'safe':'overloaded'):'')+'">'+
        '<b>'+(i+1)+'차례</b><div class="load-meter"><span style="width:'+Math.min(100,round.load/5*100)+'%"></span></div>'+
        '<p>원본 부하 <strong>'+(tested?round.load:'—')+' / 5</strong></p><p>정상 처리 '+(tested?round.served+' / '+round.expected:'검증 대기')+'</p></article>').join('')+'</div>'+
      button('traffic-test','네 차례 부하 시험','id="traffic-test"','button secondary');
  }
  function solved(c){
    return '<div class="solved-banner"><div class="eyebrow">CASE CLOSED / '+c.number+'</div><h2>흔적이 하나의 이야기가 됐다.</h2>'+
      '<p>'+esc(c.ending)+'</p><div class="solved-actions">'+
      button('record-return','등록부에 검증 결과 남기기','data-case="'+c.id+'"')+
      button('reset','이 사건 다시 풀기','','button secondary')+'</div></div>'+history(c);
  }
  function caseView(){
    const c=current(),item=session(),b=item.board,cleared=progress.completed.includes(c.id);
    const role=stageRole(c,b),attack=role.startsWith('공격자'),twoStage=['trust','heartbeat','mitm'].includes(c.id);
    const readyToSwitch=twoStage&&b.stage===0&&E.evaluate(c.id,b).ok;
    const stageText=twoStage?(b.stage===0?'01 / 틈을 찾기':'02 / 경계를 세우기'):'EVIDENCE DESK';
    const titles={cipher:'공유 키 복원기',ledger:'세 장부의 교차점',trust:b.stage===1?'신뢰 철회 계획':'방문자의 이동 경로',
      heartbeat:b.stage===1?'응답 장치의 경계 검사':'통신 장치 응답 실험',outbreak:'병원망 대응 계획',
      mitm:b.stage===1?'인증 신뢰 정책':'중계소의 두 봉인',ddos:'분산 요청과 관문 처리'};
    const renderers={cipher:cipherBoard,ledger:ledgerBoard,trust:trustBoard,heartbeat:heartbeatBoard,outbreak:outbreakBoard,mitm:mitmBoard,ddos:ddosBoard};
    const submitTitle={cipher:'전보 해독 확인',ledger:'증거 연결 확인',trust:b.stage===1?'차단 계획 확인':'경로 확인',
      heartbeat:b.stage===1?'경계 검사':'응답 분석 확인',outbreak:'대응 계획 확정',mitm:b.stage===1?'인증 정책 검증':'중계 결과 확인',ddos:'관문 계획 확정'};
    return '<nav class="case-strip" aria-label="사건 선택">'+button('archive','← 기록실','','strip-button')+
      cases.map(x=>button('open',x.number+' / '+x.year+(progress.completed.includes(x.id)?' ✓':''),
        'data-case="'+x.id+'" aria-current="'+(c.id===x.id)+'" aria-label="'+esc(x.title)+'"','strip-button',!canOpen(x.id))).join('')+'</nav>'+
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
      if(action==='archive-tab'){
        archiveUI.tab=target.dataset.tab;archiveUI.message=null;render();return;
      }
      if(action==='read-doc'){
        if(!G.available(progress.archive).some(d=>d.id===target.dataset.doc))return;
        archiveUI.doc=target.dataset.doc;archiveUI.message=null;render();
        root.querySelector('.document-reader')?.scrollIntoView({block:'nearest'});return;
      }
      if(action==='clear-search'||action==='search-word'){
        archiveUI.query=action==='clear-search'?'':target.dataset.term;
        archiveUI.tab='records';render();return;
      }
      if(action==='pin-doc'){
        const state=progress.archive,id=target.dataset.doc;
        if(!state.read.includes(id)||!G.available(state).some(d=>d.id===id))return;
        if(state.pins.includes(id))state.pins=state.pins.filter(d=>d!==id);
        else if(state.pins.length===2){
          archiveUI.message={ok:false,message:'비교대에는 두 장을 올릴 수 있습니다. 기존 기록을 한 장 내린 뒤 추가하세요.'};render();return;
        }else state.pins.push(id);
        archiveUI.message=null;save();render();return;
      }
      if(action==='select-record'||action==='record-return'){
        screen='archive';archiveUI.tab='registry';archiveUI.record=target.dataset.case;archiveUI.message=null;
        if(action==='record-return')G.seal(target.dataset.case,progress.archive,progress.completed);
        save();render();window.scrollTo({top:0,behavior:'instant'});return;
      }
      if(['attach-evidence','check-record','record-hint'].includes(action)){
        const id=target.dataset.case,state=progress.archive;
        if(!G.records.some(r=>r.id===id)||state.sealed.includes(id))return;
        state.drafts[id]||=G.blankDraft();
        if(action==='attach-evidence'&&state.pins.length===2)state.drafts[id].evidence=[...state.pins];
        if(action==='check-record'){
          archiveUI.message=G.assess(id,state);
          if(G.seal(id,state,progress.completed))archiveUI.message={ok:true,message:'기록이 복원됐습니다. 후속 상자의 봉인을 확인하세요.'};
        }
        if(action==='record-hint')state.hints[id]=Math.min(3,(state.hints[id]||0)+1);
        save();render();return;
      }
      const c=current(),item=session();
      if(action==='dial'){update({type:'dial',index:Number(target.dataset.index),delta:Number(target.dataset.delta)});return;}
      if(['session','job','print','travel','cut','patch','front','back','root','defense'].includes(action)){update({type:action,id:target.dataset.id});return;}
      if(['probe','switch','relay','hostname'].includes(action)){update({type:action});if(action==='switch')announce('시점 전환. 방어자의 자리입니다.');return;}
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
      if(action==='traffic-test'){
        feedback={...E.evaluate(c.id,item.board),tested:true};render();announce(feedback.message);return;
      }
      if(action==='submit'){
        feedback={...E.evaluate(c.id,item.board),tested:true};
        const isFinal=!['trust','heartbeat','mitm'].includes(c.id)||item.board.stage===1;
        if(feedback.ok&&isFinal){
          if(!progress.completed.includes(c.id))progress.completed.push(c.id);
          G.seal(c.id,progress.archive,progress.completed);
          save();
        }
        render();announce(feedback.message);
        if(feedback.ok&&isFinal)root.querySelector('.solved-banner').scrollIntoView({block:'start'});
      }
    }catch(error){feedback={ok:false,message:error.message};render();announce(error.message);}
  });
  root.addEventListener('input',event=>{
    if(event.target.id==='claimed')document.getElementById('lengthValue').textContent=event.target.value;
    if(event.target.id==='docNote'){
      progress.archive.notes[event.target.dataset.doc]=event.target.value.slice(0,2000);save();
    }
  });
  root.addEventListener('submit',event=>{
    if(event.target.id!=='record-search')return;
    event.preventDefault();
    archiveUI.query=new FormData(event.target).get('query').toString().slice(0,100);render();
  });
  root.addEventListener('change',event=>{
    const field=event.target.dataset.draft,id=event.target.dataset.case;
    if(['person','team','outcome'].includes(field)&&G.records.some(r=>r.id===id)&&!progress.archive.sealed.includes(id)){
      progress.archive.drafts[id]||=G.blankDraft();
      progress.archive.drafts[id][field]=event.target.value;
      archiveUI.message=null;save();render();return;
    }
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
