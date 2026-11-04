'use strict';
const el=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const newid=prefix=>prefix+'_'+Math.random().toString(36).slice(2,8);
const phases={synopsis:5,characters:5,study:20,investigation1:20,discussion1:15,investigation2:20,discussion2:20,action:10,ending:15};
const emptyMap=(id,title)=>({id,title,legend:'방을 돌아다니며 다른 사람과 대화하세요.',
  tiles:['#############',...Array.from({length:9},()=> '#...........#'),'#############'],
  rooms:[],areas:[],doors:[],portals:[],objects:[]});
function template(){
  const characters=Array.from({length:4},(_,i)=>({id:'role'+(i+1),name:'인물 '+(i+1),role:'비밀을 가진 방문객',hint:'사건과 관련 있는 등장인물',symbol:'♟',accent:['#ae87c6','#7db9bc','#cfa071','#93a6cd'][i]}));
  const booklets=Object.fromEntries(characters.map((c,i)=>[c.id,{
    background:['이 인물이 가진 과거의 비밀과 동기를 적으세요.'],
    timeline:[{time:'23:00',title:'사건 직전',detail:'그 시각 행동을 기록하세요.'}],
    inventory:[{id:'item'+(i+1),name:'개인 소지품',description:'나만 아는 설명'}],
    culprit:i===3,objectives:'승리 조건을 서술하세요.',notes:'연기 지침을 적으세요.',
    actionNotes:'행동 단계에서 어떤 선택을 할지 비밀 지침을 적으세요.'
  }]));
  return {format:'rice-mystery-v1',story:{title:'새로운 사건',subtitle:'미스터리 부제',genre:'추리',teaser:'사건을 간략하게 소개하세요.',
    minutes:90,players:4,synopsis:['누군가 살해되었습니다. 이 집에 모인 참가자 중 범인이 있습니다.'],characters},
    game:{booklets,phaseMinutes:{...phases},investigation:{tokensPerPlayer:4,tokensPerSecondInvestigation:4,maxTileOccupants:3,cards:[]},
      floors:[emptyMap('ground','1층')],
      action:{order:characters.map(c=>c.id),roles:Object.fromEntries(characters.map(c=>[c.id,[]])),
        intro:'정해진 순서로 각자 한 번 행동합니다.',endingNotes:'행동 결과와 승점은 수동 판정합니다.'}},
    spawn:Object.fromEntries(characters.map((c,i)=>[c.id,{floor:'ground',x:2+i*2,y:2}]))};
}
let doc=template(),tab='story',selectedChar=0,selectedCard=0,selectedFloor=0,brush='floor',selectedArea=null,regionStart=null;
const getFloors=()=>doc.game.floors;
const currentFloor=()=>getFloors()[selectedFloor];
const save=()=>{try{localStorage.setItem('rice_mystery_editor_v1',JSON.stringify(doc));}catch(e){}};
const status=(message,error=false)=>{el('editorStatus').textContent=message;el('editorStatus').classList.toggle('error',error)};
const field=(label,path,value,type='text',extra='')=>'<label class="editor-field"><span>'+esc(label)+'</span>'+
  (type==='textarea'?'<textarea data-path="'+esc(path)+'" rows="4" '+extra+'>'+esc(value)+'</textarea>':
    type==='checkbox'?'<input type="checkbox" data-path="'+esc(path)+'" '+(value?'checked':'')+'>':
    '<input data-path="'+esc(path)+'" type="'+type+'" value="'+esc(value)+'" '+extra+'>')+'</label>';
const selectField=(label,path,items,value)=>'<label class="editor-field"><span>'+esc(label)+'</span><select data-path="'+esc(path)+'">'+
  items.map(([key,name])=>'<option value="'+esc(key)+'" '+(key===value?'selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label>';
const fromPath=p=>p.split('.').reduce((v,k)=>v?.[k],doc);
function setPath(p,v){const tokens=p.split('.'),last=tokens.pop();let obj=doc;
  for(const part of tokens){if(!obj[part])obj[part]={};obj=obj[part];}
  obj[last]=v;save();
}
const splitLines=s=>String(s).split('\n').map(v=>v.trim()).filter(Boolean);
function storyPanel(){
  const a=doc.story;
  return '<h2>사건 개요</h2><div class="editor-fields">'+
    field('시나리오 이름','story.title',a.title)+field('부제','story.subtitle',a.subtitle)+
    field('장르','story.genre',a.genre)+field('예상 플레이 시간 (분)','story.minutes',a.minutes,'number','min="1" max="600"')+
    field('소개 문구','story.teaser',a.teaser,'textarea')+
    field('공용 시놉시스 (문단별 한 줄)','story.synopsis',a.synopsis.join('\n'),'textarea')+
    '</div><h3>페이즈별 권장 시간 (분)</h3><div class="editor-fields">'+
    Object.entries(doc.game.phaseMinutes).map(([key,value])=>field(key,'game.phaseMinutes.'+key,value,'number','min="1" max="240"')).join('')+
    '</div><h3>행동 단계 · 비밀 순서 및 공통 규칙</h3>'+
    '<div class="editor-fields">'+
      field('행동 순서 (캐릭터 ID JSON 배열)','action.order',JSON.stringify(doc.game.action?.order||doc.story.characters.map(c=>c.id),null,2),'textarea')+
      field('행동 시작 안내','game.action.intro',doc.game.action?.intro||'','textarea')+
      field('행동 종료·결말 참고','game.action.endingNotes',doc.game.action?.endingNotes||'','textarea')+
    '</div><p class="muted small">각 캐릭터의 비밀 행동 능력은 캐릭터 책자에서 JSON으로 편집할 수 있습니다. 행동 종류: guard / attack / restrain / reveal / escape.</p>'+
    '<p class="muted small">게임 시작부터의 공용 진행 시간 및 권장 타이머는 서버에서 관리합니다.</p>';
}
function charactersPanel(){
  const c=doc.story.characters[selectedChar],b=doc.game.booklets[c.id];
  return '<div class="editor-subhead"><h2>캐릭터 카드와 개인 책자</h2><button data-do="add-char" class="btn btn-outline btn-sm">+ 인물 추가</button></div>'+
    '<div class="entity-tabs">'+doc.story.characters.map((v,i)=>'<button data-do="pick-char" data-i="'+i+'" class="'+(i===selectedChar?'active':'')+'">'+esc(v.name)+'</button>').join('')+'</div>'+
    '<div class="editor-fields">'+field('캐릭터 ID (저장 후 변경 비권장)','story.characters.'+selectedChar+'.id',c.id)+
    field('공개 이름','story.characters.'+selectedChar+'.name',c.name)+field('공개 역할','story.characters.'+selectedChar+'.role',c.role)+
    field('공개 한 줄 설명','story.characters.'+selectedChar+'.hint',c.hint,'textarea')+
    field('캐릭터 시작 대사','story.characters.'+selectedChar+'.startLine',c.startLine||'','textarea')+
    field('맵 표시 기호','story.characters.'+selectedChar+'.symbol',c.symbol)+
    field('표시 색상','story.characters.'+selectedChar+'.accent',c.accent,'color')+
    '</div><h3>비공개 책자 · 7개 항목</h3>'+
    '<div class="editor-fields">'+field('중요 정보 (문단별 한 줄)','role.background',b.background.join('\n'),'textarea')+
    field('사건 시간대별 행적 (JSON 배열: time / title / detail)','role.timeline',JSON.stringify(b.timeline,null,2),'textarea')+
    field('자신의 소지품 (JSON 배열: id / name / description)','role.inventory',JSON.stringify(b.inventory,null,2),'textarea')+
    field('범인 여부','role.culprit',b.culprit,'checkbox')+
    field('개인 승리 목표','role.objectives',b.objectives,'textarea')+
    field('역할 연기 및 기타 메모','role.notes',b.notes,'textarea')+
    field('개인 행동 순서 해설','role.actionNotes',b.actionNotes||'','textarea')+
    field('행동 능력 (JSON 배열, id/title/kind/targetMode/description/requiresItem/requiredCard)','role.abilities',
      JSON.stringify(doc.game.action?.roles?.[c.id]||[],null,2),'textarea')+'</div>'+
    '<h3>캐릭터 시작 위치</h3><p class="muted small">지도 탭에서 「시작 위치」 브러시로 직접 배치할 수도 있습니다.</p>'+
    '<div class="editor-fields">'+
    selectField('시작 층','spawn.'+c.id+'.floor',getFloors().map(f=>[f.id,f.title]),doc.spawn[c.id]?.floor||'ground')+
    field('시작 X','spawn.'+c.id+'.x',doc.spawn[c.id]?.x??1,'number')+
    field('시작 Y','spawn.'+c.id+'.y',doc.spawn[c.id]?.y??1,'number')+'</div>'+
    '<button data-do="remove-char" class="btn btn-quiet btn-sm">현재 캐릭터 삭제</button>';
}
function cardsPanel(){
  const cards=doc.game.investigation.cards,c=cards[selectedCard];
  return '<div class="editor-subhead"><h2>조사 카드</h2><button data-do="add-card" class="btn btn-primary btn-sm">+ 조사 카드</button></div>'+
    '<div class="editor-fields">'+field('1차 조사 토큰','game.investigation.tokensPerPlayer',doc.game.investigation.tokensPerPlayer,'number')+
    field('2차 조사 추가 토큰','game.investigation.tokensPerSecondInvestigation',doc.game.investigation.tokensPerSecondInvestigation??4,'number')+
    field('타일당 최대 인원','game.investigation.maxTileOccupants',doc.game.investigation.maxTileOccupants,'number')+'</div>'+
    (cards.length?'<div class="entity-tabs">'+cards.map((v,i)=>'<button data-do="pick-card" data-i="'+i+'" class="'+(i===selectedCard?'active':'')+'">'+esc(v.title)+'</button>').join('')+'</div>':
      '<p class="muted">아직 카드가 없습니다. 위 버튼으로 추가해 보세요.</p>')+
    (!c?'':'<div class="editor-fields">'+field('카드 ID','game.investigation.cards.'+selectedCard+'.id',c.id)+
      field('앞면 제목','game.investigation.cards.'+selectedCard+'.title',c.title)+
      field('앞면 한 줄 정보','game.investigation.cards.'+selectedCard+'.subtitle',c.subtitle)+
      selectField('유형','game.investigation.cards.'+selectedCard+'.type',[['place','장소'],['belonging','소지품'],['information','정보']],c.type)+
      field('뒷면 상세 정보 (조사한 플레이어에게만 공개)','game.investigation.cards.'+selectedCard+'.back',c.back,'textarea')+
      selectField('소유 캐릭터: 본인은 조사 불가','game.investigation.cards.'+selectedCard+'.owner',[['','없음'],...doc.story.characters.map(x=>[x.id,x.name])],c.owner||'')+
      field('선행 조사 카드 ID (쉼표 구분)','card.requires',(c.requires||[]).join(', '))+
      selectField('해금 전 표시','game.investigation.cards.'+selectedCard+'.visibility',[['locked','잠금 표시'],['hidden','존재 숨기기']],c.visibility||'locked')+
      selectField('조사 카드 분류','game.investigation.cards.'+selectedCard+'.clueKind',
        [['','기본 분류'],['cult','교단 관련'],['timeline','사건 당일 행적'],['trick','범행 도구·증거']],c.clueKind||'')+
      selectField('조사 가능 단계','game.investigation.cards.'+selectedCard+'.availableFromPhase',
        [['investigation1','1차 조사부터'],['investigation2','2차 조사부터']],c.availableFromPhase||'investigation1')+
      field('현장 타일에 있어야만 조사 가능','game.investigation.cards.'+selectedCard+'.requiresPresence',c.requiresPresence===true,'checkbox')+
      field('인물별 비공개 추가 감응 (JSON 객체)','card.insights',JSON.stringify(c.insights||{},null,2),'textarea')+
      field('중복 조사 허용','game.investigation.cards.'+selectedCard+'.repeatable',!!c.repeatable,'checkbox')+
      field('카드 양도 허용','game.investigation.cards.'+selectedCard+'.transferable',c.transferable!==false,'checkbox')+
      field('조사 불가 캐릭터 ID (쉼표 구분)','card.blockedFor',(c.blockedFor||[]).join(', '))+
      selectField('맵 조사 위치 층 (빈칸은 위치 없음)','card.locationFloor',[['','위치 연결 없음'],...getFloors().map(x=>[x.id,x.title])],c.location?.floor||'')+
      field('맵 조사 X','card.locationX',c.location?.x??0,'number')+
      field('맵 조사 Y','card.locationY',c.location?.y??0,'number')+
      field('획득 아이템 ID (비우면 없음)','card.grantId',c.grant?.id||'')+
      field('획득 아이템 이름','card.grantName',c.grant?.name||'')+
      field('획득 아이템 설명','card.grantDescription',c.grant?.description||'','textarea')+
      '</div><button data-do="remove-card" class="btn btn-quiet btn-sm">현재 카드 삭제</button>')+
    '<p class="muted small">앞면은 전체 공개, 뒷면은 본인 조사 확정 후만 공개합니다. 맵에서 현재 타일을 선택해 조사 카드 위치를 지정할 수도 있습니다.</p>';
}
const brushOptions=[['floor','통로'],['wall','벽'],['door','문'],['portal','계단'],['region','방 구역 (두 점)'],['spawn','배역 시작점'],['card','카드 조사점'],['object','가구·장식 오브젝트']];
const objectTypes=[['sink','싱크대'],['fridge','냉장고'],['pc','컴퓨터'],['gargoyle','가고일 석상'],
 ['throne','왕좌'],['bed','침대'],['shelf','책장'],['sofa','소파'],['camera','카메라'],['terminal','터미널'],
 ['server','서버 랙'],['stove','조리대'],['table','책상'],['telescope','망원경'],['projector','투영기'],
 ['generator','발전기'],['cabinet','수납장'],['medical','의료 침대'],['pod','메모리 포드'],['boat','보트'],
 ['plant','화분'],['wardrobe','화장대'],['fireplace','모닥불'],['other','기타']];
const objectGlyph={sink:'🚰',fridge:'🧊',pc:'🖥️',gargoyle:'🗿',throne:'👑',bed:'🛏️',
 shelf:'📚',sofa:'🛋️',camera:'📷',terminal:'🖥️',server:'🖧',stove:'🍳',table:'🪑',
 telescope:'🔭',projector:'🌌',generator:'⚡',cabinet:'🗄️',medical:'🩺',
 pod:'⚗️',boat:'⛵',plant:'🪴',wardrobe:'🪞',fireplace:'🔥',other:'✧'};
function areaEditor(f){
  return '<div class="editor-subhead"><h3>방 구역 디자인</h3><button data-do="add-area" class="btn btn-outline btn-sm">+ 구역 추가</button></div>'+
    '<p class="muted small">구역은 직사각형으로 경계를 지정합니다. 맵에서 「방 구역」 브러시로 시작점·끝점을 차례로 눌러도 됩니다.</p>'+
    (f.areas||[]).map((a,i)=>'<div class="region-row"><button data-do="select-area" data-i="'+i+'" class="btn btn-outline btn-sm '+(selectedArea===i?'active':'')+'">'+esc(a.name)+'</button>'+
      field('구역 이름','floor.areas.'+i+'.name',a.name)+
      field('배경색','floor.areas.'+i+'.color',a.color,'color')+
      selectField('패턴','floor.areas.'+i+'.pattern',[['wood','나무'],['stone','돌'],['carpet','카펫'],['tile','타일'],['plain','단색']],a.pattern)+
      '<button class="btn btn-quiet btn-sm" data-do="remove-area" data-i="'+i+'">삭제</button></div>').join('');
}
function mapsPanel(){
  const f=currentFloor(),width=f.tiles[0].length;
  const areasAt=(x,y)=>(f.areas||[]).findLast(a=>x>=a.x&&x<a.x+a.width&&y>=a.y&&y<a.y+a.height);
  return '<div class="editor-subhead"><h2>지도 · 기믹 제작</h2><button data-do="add-floor" class="btn btn-outline btn-sm">+ 층 추가</button></div>'+
    '<div class="entity-tabs">'+getFloors().map((v,i)=>'<button data-do="pick-floor" data-i="'+i+'" class="'+(i===selectedFloor?'active':'')+'">'+esc(v.title)+'</button>').join('')+'</div>'+
    '<div class="editor-fields">'+field('층 ID','game.floors.'+selectedFloor+'.id',f.id)+field('층 이름','game.floors.'+selectedFloor+'.title',f.title)+
    field('지도 안내','game.floors.'+selectedFloor+'.legend',f.legend,'textarea')+'</div>'+
    '<div class="map-editor-toolbar"><span>브러시:</span>'+brushOptions.map(([id,name])=>'<button data-do="brush" data-brush="'+id+'" class="btn btn-sm '+(brush===id?'btn-primary':'btn-outline')+'">'+name+'</button>').join('')+'</div>'+
    '<p class="muted small">도구를 선택한 뒤 아래 격자 칸을 클릭하세요. 「방 구역」은 구역을 선택하고 두 모서리를 클릭합니다.</p>'+
    '<div class="editor-map-wrap"><div class="editor-map" style="--columns:'+width+'">'+f.tiles.flatMap((row,y)=>Array.from(row,(c,x)=>{
      const region=areasAt(x,y),door=(f.doors||[]).find(d=>d.x===x&&d.y===y),portals=(f.portals||[]).filter(p=>p.x===x&&p.y===y),furniture=(f.objects||[]).find(o=>o.x===x&&o.y===y);
      const spawn=Object.entries(doc.spawn).filter(([id,p])=>p.floor===f.id&&p.x===x&&p.y===y).map(([id])=>id);
      return '<button type="button" class="editor-cell '+(c==='#'?'wall':'walk')+'" data-x="'+x+'" data-y="'+y+'" title="('+x+','+y+') '+esc(region?.name||'')+'" '+
        'style="'+(region?'--region-color:'+esc(region.color)+';':'')+'">'+
        (door?'🚪':portals.length?'⇅':spawn.length?'♟':furniture?esc(furniture.icon||objectGlyph[furniture.kind]||'✧'):region?esc(region.name[0]||''):'')+'</button>';
    })).join('')+'</div></div>'+
    '<div class="editor-fields">'+
      selectField('시작점 설정 캐릭터','editor.spawnChar',doc.story.characters.map(c=>[c.id,c.name]),window.editorSpawnChar||doc.story.characters[0].id)+
      selectField('카드 조사점 설정','editor.mapCard',[['','선택 안 함'],...doc.game.investigation.cards.map(c=>[c.id,c.title])],window.editorMapCard||'')+selectField('배치할 가구 종류','editor.objectKind',objectTypes,window.editorObjectKind||'pc')+
    '</div><div class="editor-map-details"><h3>문 기믹</h3>'+
    (f.doors||[]).map((d,i)=>'<div class="editor-detail-line"><b>'+esc(d.name)+' ('+d.x+','+d.y+')</b>'+
       field('이름','floor.doors.'+i+'.name',d.name)+
       field('잠금 여부 (열쇠 필요)','floor.doors.'+i+'.locked',d.locked,'checkbox')+
       field('초기 상태: 닫힘','floor.doors.'+i+'.closed',d.closed!==false,'checkbox')+
       field('필요한 열쇠/아이템 ID','floor.doors.'+i+'.requiresItem',d.requiresItem||'')+
       '<button class="btn btn-quiet btn-sm" data-do="remove-door" data-i="'+i+'">삭제</button></div>').join('')+
    '<h3>계단 / 이동 액션</h3>'+
    (f.portals||[]).map((p,i)=>'<div class="editor-detail-line"><b>('+p.x+','+p.y+')</b>'+
      field('버튼 문구','floor.portals.'+i+'.label',p.label)+
      selectField('이동할 층','floor.portals.'+i+'.toFloor',getFloors().map(v=>[v.id,v.title]),p.toFloor)+
      field('도착 X','floor.portals.'+i+'.toX',p.toX,'number')+
      field('도착 Y','floor.portals.'+i+'.toY',p.toY,'number')+
      '<button class="btn btn-quiet btn-sm" data-do="remove-portal" data-i="'+i+'">삭제</button></div>').join('')+
    '<h3>가구·장식 오브젝트</h3><p class="muted small">가구 브러시로 배치하고 이름이나 통과 여부를 수정하세요.</p>'+ (f.objects||[]).map((o,i)=>'<div class="editor-detail-line"><b>('+o.x+','+o.y+')</b>'+field('이름','floor.objects.'+i+'.name',o.name)+selectField('종류','floor.objects.'+i+'.kind',objectTypes,o.kind)+field('아이콘(선택)','floor.objects.'+i+'.icon',o.icon||'')+field('통과 불가','floor.objects.'+i+'.solid',o.solid===true,'checkbox')+'<button data-do="remove-object" data-i="'+i+'" class="btn btn-quiet btn-sm">삭제</button></div>').join('')+areaEditor(f)+'</div>';
}
function jsonPanel(){
  return '<h2>게임 파일 구성 확인</h2><p class="muted small">이 JSON에는 카드 뒷면과 캐릭터 비밀이 모두 포함됩니다. 제작자만 보관하세요.</p>'+
    '<pre class="json-preview">'+esc(JSON.stringify(doc,null,2))+'</pre>';
}
function render(){el('editorPanel').innerHTML=tab==='story'?storyPanel():tab==='characters'?charactersPanel():tab==='cards'?cardsPanel():tab==='maps'?mapsPanel():jsonPanel();
  for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===tab);}
function valueChange(path,value){
  const c=doc.story.characters[selectedChar],b=doc.game.booklets[c.id],card=doc.game.investigation.cards[selectedCard];
  const oldCharacterId=c.id;
  if(path==='story.synopsis')doc.story.synopsis=splitLines(value);
  else if(path==='role.background')b.background=splitLines(value);
  else if(path==='action.order'){
    try{const arr=JSON.parse(value);if(!Array.isArray(arr))throw Error('JSON 배열이 필요합니다.');
      doc.game.action||={order:[],roles:{},intro:'',endingNotes:''};
      doc.game.action.order=arr;status('행동 순서를 갱신했습니다.');
    }catch(e){status('행동 순서 JSON 오류: '+e.message,true);return}
  }
  else if(path==='role.abilities'){
    try{const arr=JSON.parse(value);if(!Array.isArray(arr))throw Error('JSON 배열이 필요합니다.');
      doc.game.action||={order:doc.story.characters.map(c=>c.id),roles:{},intro:'',endingNotes:''};
      doc.game.action.roles||={};doc.game.action.roles[c.id]=arr;
      status('캐릭터 고유 행동을 반영했습니다.');
    }catch(e){status('행동 능력 JSON 오류: '+e.message,true);return}
  }
  else if(['role.timeline','role.inventory'].includes(path)){
    try{const arr=JSON.parse(value);if(!Array.isArray(arr))throw Error('배열이 아닙니다.');b[path.split('.')[1]]=arr;status('JSON 항목이 반영되었습니다.');}
    catch(e){status('이 항목은 JSON 배열이어야 합니다: '+e.message,true);return;}
  }else if(path.startsWith('role.'))b[path.slice(5)]=value;
  else if(path==='card.requires')card.requires=value.split(',').map(x=>x.trim()).filter(Boolean);
  else if(path==='card.insights'){
    try{
      const parsed=JSON.parse(value||'{}');
      if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')
        throw Error('캐릭터 ID: 감응 텍스트 형태의 JSON 객체여야 합니다.');
      card.insights=parsed;status('개인 감응 문구를 저장했습니다.');
    }catch(e){status('감응 JSON 형식 오류: '+e.message,true);return}
  }
  else if(path==='card.blockedFor')card.blockedFor=value.split(',').map(x=>x.trim()).filter(Boolean);
  else if(path.startsWith('card.')){
    const key=path.slice(5);
    if(key==='locationFloor')card.location=value?{floor:value,x:card.location?.x||1,y:card.location?.y||1}:null;
    if(key==='locationX'&&card.location)card.location.x=Number(value);
    if(key==='locationY'&&card.location)card.location.y=Number(value);
    if(key.startsWith('grant')){card.grant ||= {id:'',name:'',description:''};card.grant[key.slice(5,6).toLowerCase()+key.slice(6)]=value;if(!card.grant.id)card.grant=null;}
  }else if(path==='editor.spawnChar')window.editorSpawnChar=value;
  else if(path==='editor.mapCard')window.editorMapCard=value;
  else if(path==='editor.objectKind')window.editorObjectKind=value;
  else if(path.startsWith('floor.'))setPath('game.floors.'+selectedFloor+'.'+path.slice(6),value);
  else setPath(path,value);
  if(path.startsWith('story.characters.')&&path.endsWith('.id')){const newId=doc.story.characters[selectedChar].id;
    if(newId!==oldCharacterId){
      doc.game.booklets[newId]=b;delete doc.game.booklets[oldCharacterId];
      doc.spawn[newId]=doc.spawn[oldCharacterId];delete doc.spawn[oldCharacterId];
      if(doc.game.action){
        doc.game.action.order=(doc.game.action.order||[]).map(id=>id===oldCharacterId?newId:id);
        doc.game.action.roles||={};doc.game.action.roles[newId]=doc.game.action.roles[oldCharacterId]||[];
        delete doc.game.action.roles[oldCharacterId];
      }
    }}
  save();
}
function clickCell(x,y){
  const f=currentFloor(),rows=f.tiles.map(r=>Array.from(r));const loc={x,y};
  if(brush==='floor'||brush==='wall'){
    rows[y][x]=brush==='wall'?'#':'.';f.tiles=rows.map(r=>r.join(''));
  }else if(f.tiles[y][x]!=='#'){
    if(brush==='door')f.doors.push({id:newid('door'),name:'새 문',x,y,locked:false,closed:true,requiresItem:''});
    else if(brush==='portal'){
      const dest=getFloors().find(v=>v.id!==f.id)||f;
      f.portals.push({x,y,toFloor:dest.id,toX:1,toY:1,label:'다른 층으로 이동'});
    }else if(brush==='spawn'){
      const id=window.editorSpawnChar||doc.story.characters[0].id;doc.spawn[id]={floor:f.id,x,y};
    }else if(brush==='card'){
      const card=doc.game.investigation.cards.find(v=>v.id===window.editorMapCard);if(card)card.location={floor:f.id,x,y};
      else status('먼저 카드 탭에서 조사를 만들고, 카드 조사점 선택에서 카드를 선택하세요.',true);
    }else if(brush==='object'){
      f.objects||=[];const kind=window.editorObjectKind||'pc',name=objectTypes.find(v=>v[0]===kind)?.[1]||'장식';
      const previous=f.objects.find(o=>o.x===x&&o.y===y);
      if(previous){previous.kind=kind;previous.name=name;}
      else f.objects.push({id:newid('prop'),kind,x,y,name,icon:'',solid:false});
    }else if(brush==='region'){
      if(selectedArea===null||!f.areas[selectedArea]){status('먼저 구역 추가 후 구역을 선택하세요.',true);return;}
      if(!regionStart){regionStart=loc;status('반대쪽 모서리를 클릭하세요.');return;}
      Object.assign(f.areas[selectedArea],{x:Math.min(regionStart.x,x),y:Math.min(regionStart.y,y),
        width:Math.abs(regionStart.x-x)+1,height:Math.abs(regionStart.y-y)+1});regionStart=null;
    }
  }
  save();render();
}
function handleAction(target){
  const action=target.dataset.do,i=Number(target.dataset.i),f=currentFloor();
  if(action==='pick-char'){selectedChar=i;render();return}
  if(action==='pick-card'){selectedCard=i;render();return}
  if(action==='pick-floor'){selectedFloor=i;selectedArea=null;regionStart=null;render();return}
  if(action==='brush'){brush=target.dataset.brush;regionStart=null;render();return}
  if(action==='select-area'){selectedArea=i;render();return}
  if(action==='add-char'){
    if(doc.story.characters.length>=10)return status('인물은 최대 10명입니다.',true);
    const id=newid('role');doc.story.characters.push({id,name:'새 캐릭터',role:'역할',hint:'공개 설명',symbol:'♟',accent:'#9aafc5'});
    doc.game.booklets[id]={background:['비밀 서술'],timeline:[],inventory:[],culprit:false,objectives:'승리 목표',notes:''};
    doc.spawn[id]={floor:getFloors()[0].id,x:1,y:1};
    if(doc.game.action){doc.game.action.order.push(id);doc.game.action.roles[id]=[];}
    doc.story.players=doc.story.characters.length;selectedChar=doc.story.players-1;
  }else if(action==='remove-char'){
    if(doc.story.characters.length<=2)return status('인물은 최소 2명입니다.',true);
    const id=doc.story.characters[selectedChar].id;doc.story.characters.splice(selectedChar,1);
    delete doc.game.booklets[id];delete doc.spawn[id];
    if(doc.game.action){doc.game.action.order=doc.game.action.order.filter(x=>x!==id);delete doc.game.action.roles[id];}
    doc.story.players=doc.story.characters.length;selectedChar=0;
  }else if(action==='add-card'){
    doc.game.investigation.cards.push({id:newid('card'),title:'새 조사 카드',subtitle:'간단한 앞면 정보',type:'place',back:'조사 뒷면에 적을 비밀',
      owner:null,blockedFor:[],requires:[],visibility:'locked',repeatable:false,transferable:true,
      availableFromPhase:'investigation1',requiresPresence:false,clueKind:null,insights:{},grant:null,location:null});
    selectedCard=doc.game.investigation.cards.length-1;
  }else if(action==='remove-card'){doc.game.investigation.cards.splice(selectedCard,1);selectedCard=0;}
  else if(action==='add-floor'){if(getFloors().length>=8)return status('층은 최대 8개입니다.',true);
    getFloors().push(emptyMap(newid('floor'),'새로운 층'));selectedFloor=getFloors().length-1;selectedArea=null;
  }else if(action==='add-area'){f.areas.push({id:newid('area'),name:'새로운 방',x:1,y:1,width:3,height:3,color:'#71869e',pattern:'wood'});selectedArea=f.areas.length-1;}
  else if(action==='remove-area'){f.areas.splice(i,1);selectedArea=null;}
  else if(action==='remove-door'){f.doors.splice(i,1);}
  else if(action==='remove-portal'){f.portals.splice(i,1);}
  else if(action==='remove-object'){(f.objects||[]).splice(i,1);}
  save();render();
}
function download(){
  const blob=new Blob([JSON.stringify(doc,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=(doc.story.title||'mystery').replace(/[^가-힣a-zA-Z0-9_-]/g,'_')+'.mystery.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status('미스터리 시나리오 JSON을 저장했습니다. 비공개 원고이므로 다른 참가자에게 보내지 마세요.');
}
async function publish(){
  try{
    status('서버에서 데이터 구조를 검증하고 등록하고 있습니다…');
    const r=await fetch('/api/editor/publish',{method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({package:doc})});
    const data=await r.json();if(!r.ok)throw Error(data.error||'등록 실패');
    status('등록 완료! '+data.story.title+' — 게임의 시나리오 선택 목록에서 사용할 수 있습니다.');
    window.location.href='/mystery?story='+encodeURIComponent(data.id);
  }catch(e){status('등록 실패: '+e.message,true)}
}
document.querySelector('.editor-tabs').addEventListener('click',e=>{const t=e.target.closest('[data-tab]');if(t){tab=t.dataset.tab;render()}});
el('editorPanel').addEventListener('click',e=>{
  const cell=e.target.closest('[data-x][data-y]');if(cell){clickCell(Number(cell.dataset.x),Number(cell.dataset.y));return;}
  const action=e.target.closest('[data-do]');if(action)handleAction(action);
});
el('editorPanel').addEventListener('change',e=>{
  const target=e.target,path=target.dataset.path;if(!path)return;
  const value=target.type==='checkbox'?target.checked:target.type==='number'?Number(target.value):target.value;
  valueChange(path,value);
});
el('newStory').addEventListener('click',()=>{if(!confirm('현재 편집 내용을 초기화할까요? 저장하지 않은 내용은 사라집니다.'))return;doc=template();selectedChar=selectedCard=selectedFloor=0;tab='story';save();render()});
el('exportFile').addEventListener('click',download);
el('publishStory').addEventListener('click',publish);
el('importFile').addEventListener('click',()=>el('storyFile').click());
el('storyFile').addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{
    if(f.size>2*1024*1024)throw Error('파일은 2MB 이하로 제한됩니다.');
    const parsed=JSON.parse(await f.text());
    if(parsed.format!=='rice-mystery-v1'||!parsed.story?.characters||!parsed.game?.floors)
      throw Error('지원되지 않는 파일 형식입니다.');
    doc=parsed;doc.spawn ||=doc.game.spawn||{};doc.game.investigation ||= {tokensPerPlayer:4,maxTileOccupants:3,cards:[]};
    selectedChar=selectedCard=selectedFloor=0;selectedArea=null;tab='story';save();render();
    status(f.name+' 불러오기 완료 · 서버에 등록하려면 「서버에 등록하고 플레이」를 누르세요.');
  }catch(err){status('파일 불러오기 실패: '+err.message,true)}
  e.target.value='';
});
try{
  const saved=localStorage.getItem('rice_mystery_editor_v1');
  if(saved){const parsed=JSON.parse(saved);if(parsed.format==='rice-mystery-v1'&&parsed.story&&parsed.game)doc=parsed;}
}catch(e){status('임시 저장을 읽지 못했습니다.',true)}
render();
