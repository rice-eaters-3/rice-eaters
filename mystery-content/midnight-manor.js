'use strict';
// ORIGINAL demo mystery content. Never serve this module as a static asset.
// Role-specific booklets are selected on the server after session authorization.
// Add other stories by providing a matching story ID, optional floorplan, and booklet map.
const floorplan = {
  title:'까마귀 저택 · 1층 약도',
  legend:'벽은 통과할 수 없습니다. 복도와 문이 열린 곳으로 이동하세요.',
  tiles:[
    '#################',
    '#.....#.........#',
    '#.....#.........#',
    '#.....#.........#',
    '#.....#.........#',
    '#...............#',
    '###.#####.#######',
    '#.......#.......#',
    '#.......#.......#',
    '#.......#.......#',
    '#################'
  ],
  rooms:[
    {x:2,y:2,name:'도서관',icon:'📚'},
    {x:11,y:2,name:'서재',icon:'🕯'},
    {x:8,y:5,name:'중앙 복도',icon:'⌁'},
    {x:3,y:8,name:'식당',icon:'🍷'},
    {x:12,y:8,name:'응접실',icon:'🛋'}
  ],
  spawn:{
    elena:{x:2,y:3},
    victor:{x:13,y:3},
    iris:{x:2,y:9},
    noah:{x:13,y:9}
  }
};

const booklets = {
  elena:{
    background:[
      '당신은 에드워드 블랙우드의 조카입니다. 어린 시절부터 이 집에서 자랐지만, 6년 전 실종된 어머니의 행방을 묻다가 쫓겨났습니다. 친절하고 우아한 태도를 유지하지만, 가족의 대화를 믿지 않습니다.',
      '어머니의 실종 이후 당신은 작은 소리와 출입문의 위치를 유난히 잘 기억하게 되었습니다. 이번 초대장을 받은 이유는 상속 때문이 아니라 그날 밤의 기록을 찾기 위해서입니다.',
      '누군가 어머니가 남긴 푸른 봉투를 갖고 있다는 사실을 숨기고 있습니다. 자신의 비밀을 밝히더라도 그 봉투는 되찾고 싶습니다.'
    ],
    timeline:[
      {time:'22:20',title:'저택 도착',detail:'로비에서 관리인 노아를 만났습니다. 노아는 서재 쪽 복도로 가지 말라고 경고했습니다.'},
      {time:'22:45',title:'도서관의 책장',detail:'낡은 책의 안쪽에서 어머니의 필체로 쓰인 쪽지를 발견했습니다. 뒤에서 인기척이 나자 급히 주머니에 넣었습니다.'},
      {time:'23:15',title:'빅터와 언쟁',detail:'주치의 빅터에게 6년 전 병원 기록을 물었지만 그는 답을 피했습니다. 시계가 23시 15분을 가리키던 것을 기억합니다.'},
      {time:'23:47',title:'정전과 비명',detail:'도서관 문 앞에 있었습니다. 정전 직후 서재 쪽에서 유리 깨지는 소리가 들렸습니다. 당신은 누군가의 발소리를 따라 중앙 복도로 나갔습니다.'}
    ],
    inventory:[
      {id:'letter',name:'낡은 가족 편지',description:'어머니가 마지막으로 쓴 편지의 앞부분입니다. 뒷장이 누군가에게 찢겨 나갔습니다.'},
      {id:'key',name:'은색 작은 열쇠',description:'도서관 서랍에서 발견했습니다. 어느 문에 맞는지 아직 확인하지 못했습니다.'}
    ],
    culprit:false,
    objectives:'최종 범인 투표에 참여하고, 어머니의 실종과 관련된 푸른 봉투를 찾으세요. 편지의 뒷장에 관한 증언을 확보했다면 추가 목표를 달성했다고 간주합니다. 실제 점수는 플레이어끼리 수동 판정합니다.',
    notes:'실종 사건을 아는 사람이 있다면 조심스럽게 질문하세요. 당신이 가진 편지의 존재를 처음부터 공개할 필요는 없습니다.'
  },
  victor:{
    background:[
      '당신은 에드워드의 오랜 주치의입니다. 이 저택의 비밀을 담은 진료 기록을 보관해 왔고, 빚 때문에 기록 일부를 숨겼습니다. 병원에서의 실패 이후 언제나 증거를 먼저 찾는 성격이 되었습니다.',
      '사건 당일 에드워드는 당신에게 독성 물질의 복용 흔적을 검사해달라고 부탁했습니다. 하지만 검사 결과를 공개하면 과거의 의료 사고까지 드러날 수 있습니다.',
      '당신은 에드워드가 그날 밤 죽을 것이라고는 생각하지 못했습니다. 다만 한 사람의 동기가 누구보다 의심스럽습니다.'
    ],
    timeline:[
      {time:'22:25',title:'진료 방문',detail:'서재에서 에드워드의 맥박을 확인하고 진정제를 처방했습니다. 약병은 본인이 직접 챙겼습니다.'},
      {time:'22:55',title:'응접실의 대화',detail:'아이리스 기자가 오래된 병원 기록에 대해 질문했습니다. 당신은 화제를 돌리며 식당 쪽으로 걸어갔습니다.'},
      {time:'23:18',title:'수상한 약병',detail:'식당 쟁반 위에 당신이 준 병과 비슷한 유리병이 있었습니다. 라벨은 절반쯤 떨어져 있었습니다.'},
      {time:'23:47',title:'서재 문 앞',detail:'소리를 듣고 서재 앞으로 달려갔습니다. 노아가 이미 도착해 있었고 문이 안에서 잠겨 있다는 말을 했습니다.'}
    ],
    inventory:[
      {id:'stethoscope',name:'낡은 청진기',description:'낡았지만 아직 쓸 수 있습니다. 가죽 케이스 안쪽에 오래된 병원 표식이 있습니다.'},
      {id:'medicine',name:'처방 약병',description:'에드워드에게 준 진정제입니다. 뚜껑에 작은 긁힘이 있지만 양은 정확히 확인하지 않았습니다.'}
    ],
    culprit:false,
    objectives:'범인을 찾아내고, 과거 병원 기록이 대중에게 공개되지 않도록 하세요. 약병을 둘러싼 오해를 해소하면 추가 목표에 성공합니다. 점수 계산은 수동입니다.',
    notes:'의학적 지식을 독점하고 있어도 모든 사실을 진실로 단정할 수는 없습니다.'
  },
  iris:{
    background:[
      '당신은 실종 사건을 추적하는 기자입니다. 몇 년 전 기사 하나가 무고한 사람을 해쳤고, 그 뒤로는 공개되지 않은 문서가 나오기 전까지 어떤 주장도 믿지 않습니다.',
      '에드워드가 가족의 어두운 과거를 밝히려 한다는 익명의 편지를 받고 저택에 왔습니다. 초대 명단에는 당신의 이름이 없었습니다.',
      '당신의 진짜 목적은 단순한 살인 기사보다 오래된 조작 사건의 증거를 확보하는 것입니다. 그 증거가 없다면 편집장은 이번 취재를 폐기할 것입니다.'
    ],
    timeline:[
      {time:'22:10',title:'뒷문으로 입장',detail:'비를 피해 저택의 뒷문으로 들어왔습니다. 식당에서 혼자 무언가를 정리하는 사람의 그림자를 보았습니다.'},
      {time:'22:55',title:'주치의 인터뷰',detail:'응접실에서 빅터에게 6년 전 병원 기록을 물었습니다. 그는 얼굴이 굳더니 서둘러 자리를 떠났습니다.'},
      {time:'23:30',title:'숨겨진 필름',detail:'응접실 액자 뒤에서 작은 사진 필름통을 발견했습니다. 내용은 아직 현상하지 못했습니다.'},
      {time:'23:47',title:'정전 중의 이동',detail:'정전 직후 중앙 복도를 향해 걸어갔습니다. 계단 부근에서 낮게 속삭이는 목소리를 들었지만 말을 알아듣지 못했습니다.'}
    ],
    inventory:[
      {id:'notebook',name:'취재 수첩',description:'방문자의 말과 행동이 시간순으로 기록되어 있습니다. 일부 페이지에는 약어가 많습니다.'},
      {id:'film',name:'사진 필름통',description:'액자 뒤에서 찾았습니다. 가장자리에는 ‘B-6’이라는 글자가 적혀 있습니다.'}
    ],
    culprit:false,
    objectives:'범인을 밝혀내고, 실종 사건과 연결되는 문서를 최소 하나 확보하세요. 다른 인물에게서 중요한 증언을 얻어 기사 초안을 완성하면 추가 성공으로 간주합니다. 점수는 수동 판정합니다.',
    notes:'수첩 내용은 잘못 기록되었을 가능성이 있습니다. 상대방의 진술과 시간대를 대조하세요.'
  },
  noah:{
    background:[
      '당신은 20년 동안 까마귀 저택을 지킨 관리인입니다. 과거 화재 당시 한 사람을 구하지 못한 뒤로 문과 창문을 반복해서 점검하는 습관이 생겼습니다.',
      '저택의 문 구조와 서재의 비밀 통로를 아는 유일한 사람이라는 사실이 당신을 불리하게 만듭니다. 에드워드는 당신에게 오래된 문서를 불태우라고 명령했지만 당신은 거절했습니다.',
      '당신은 이번 사건의 범인입니다. 에드워드가 과거의 화재 책임을 어린 하인에게 뒤집어씌운 사실을 공개하려 했기 때문입니다. 당신은 가족에게 복수하려는 마음으로 서재에 몰래 들어갔습니다. **이 문장은 본인의 책자에서만 공개되어야 합니다.**'
    ],
    timeline:[
      {time:'22:05',title:'출입문 점검',detail:'현관과 서재 열쇠를 확인했습니다. 서재 문은 평소처럼 밖에서도 잠글 수 있었습니다.'},
      {time:'22:20',title:'엘레나와 대화',detail:'로비에서 엘레나를 만났고 서재 쪽 접근을 피하라고 말했습니다. 당신은 이미 서재에 들어갈 계획을 세운 상태였습니다.'},
      {time:'23:28',title:'서재로 잠입',detail:'관리인용 통로로 서재에 들어갔습니다. 에드워드와 언쟁 끝에 무거운 촛대로 그를 가격했습니다. 촛대는 커튼 뒤에 숨겼습니다.'},
      {time:'23:47',title:'정전 조작',detail:'배전반을 내려 소등한 다음 서재 앞으로 돌아왔습니다. 다른 사람들에게는 소리만 듣고 달려온 것처럼 행동했습니다.'}
    ],
    inventory:[
      {id:'masterkey',name:'관리인 열쇠 꾸러미',description:'여러 문을 열 수 있지만 서재 열쇠는 뭉치에서 분리되어 있습니다.'},
      {id:'glove',name:'낡은 가죽 장갑',description:'오래 사용한 장갑입니다. 손바닥에 오래된 긁힌 자국이 있습니다.'}
    ],
    culprit:true,
    objectives:'당신이 범인으로 지목되지 않도록 하세요. 비밀 통로가 실제로 쓰였다는 증거를 최대한 숨기고, 가능하다면 다른 인물을 의심하도록 유도하세요. 승패 및 추가 점수는 수동 판정합니다.',
    notes:'다른 참가자에게 범인임을 알려서는 안 됩니다. 전부 거짓말을 하기보다 확인 가능한 사실과 거짓을 섞는 편이 자연스럽습니다.'
  }
};

// Engine configuration: each scenario may define its own phase durations,
// movement occupancy cap, multiple floors, stairs, and card unlock policies.
const phaseMinutes={
  synopsis:5,characters:5,study:20,investigation1:20,discussion1:15,
  investigation2:20,discussion2:20,action:10,ending:15
};
const upperFloor={
  id:'upper',title:'까마귀 저택 · 2층',legend:'중앙 계단에서 1층으로 이동할 수 있습니다.',
  tiles:[
    '#################',
    '#.......#.......#',
    '#.......#.......#',
    '#.......#.......#',
    '#...............#',
    '###.#####.#######',
    '#...............#',
    '#.......#.......#',
    '#.......#.......#',
    '#################'
  ],
  rooms:[
    {x:3,y:2,name:'침실',icon:'🛏'},
    {x:12,y:2,name:'기록실',icon:'🗂'},
    {x:8,y:6,name:'2층 복도',icon:'⌁'}
  ]
};
// Stairs are triggered by stepping on a portal cell. Their destinations are
// walkable cells on the other floor, not necessarily the same coordinates.
const floors=[
  {...floorplan,id:'ground',portals:[
    {x:9,y:5,toFloor:'upper',toX:9,toY:6,label:'2층 계단 ↑'}
  ]},
  {...upperFloor,portals:[
    {x:9,y:6,toFloor:'ground',toX:9,toY:5,label:'1층 계단 ↓'}
  ]}
];
// Card backs are private and must never appear in static HTML/JS or generic
// room JSON for another user. The public list contains only fronts/status.
const investigation={
  tokensPerPlayer:4,
  tokensPerSecondInvestigation:4,
  maxTileOccupants:3,
  cards:[
    {id:'desk',title:'서재의 책상',subtitle:'서재 · 사건 현장',type:'place',location:{floor:'ground',x:11,y:2},
      back:'책상 아래에 검은 잉크가 묻은 봉투가 있다. 봉투 안에는 에드워드가 미처 끝내지 못한 증언서가 들어 있다.',grant:{id:'sealed-envelope',name:'검은 봉투',description:'에드워드의 마지막 증언이 담긴 봉투'},repeatable:false},
    {id:'desk_corner',title:'책상 속 비밀 서랍',subtitle:'서재 · 숨겨진 수납 공간',type:'place',location:{floor:'ground',x:11,y:2},
      requires:['desk'],visibility:'hidden',
      back:'서랍 안쪽에는 6년 전 화재 보고서와 관리인의 지문이 남은 촛대 사진이 있다.',repeatable:false},
    {id:'library',title:'도서관 서가',subtitle:'도서관 · 낡은 장부',type:'place',location:{floor:'ground',x:2,y:2},
      back:'사라진 어머니의 이름이 기록된 도서 대출 기록이다. 그날 이후 기록이 누군가에 의해 찢겼다.',repeatable:false},
    {id:'elena_belongings',title:'엘레나의 소지품',subtitle:'등장인물 · 소지품',type:'belonging',owner:'elena',
      back:'엘레나는 오래된 가족 편지와 은색 열쇠를 가지고 있다. 편지에는 서재로 향하는 비밀 통로에 대한 단서가 있다.',repeatable:false},
    {id:'victor_belongings',title:'빅터의 소지품',subtitle:'등장인물 · 소지품',type:'belonging',owner:'victor',
      back:'빅터의 가방에는 긁힌 약병과 낡은 진료 기록이 있다. 약병의 성분은 아직 확실하지 않다.',repeatable:false},
    {id:'iris_belongings',title:'아이리스의 소지품',subtitle:'등장인물 · 소지품',type:'belonging',owner:'iris',
      back:'취재 수첩에는 실종 사건과 이 집에 연결되는 이름이 적혀 있다. 사진 필름통에는 B-6 표식이 있다.',repeatable:false},
    {id:'noah_belongings',title:'노아의 소지품',subtitle:'등장인물 · 소지품',type:'belonging',owner:'noah',
      back:'관리인의 열쇠 꾸러미에는 서재 열쇠가 빠져 있다. 낡은 가죽 장갑에는 검은 그을음이 남아 있다.',repeatable:false},
    {id:'medical',title:'주치의의 기록',subtitle:'인물 관련 문서',type:'information',owner:'victor',
      back:'진료 기록에는 환자의 사망 당시 맥박과 예상 독성 반응이 기록되어 있다. 처방 시각이 단서다.',repeatable:false},
    {id:'photo',title:'응접실의 액자',subtitle:'응접실 · 오래된 가족사진',type:'place',location:{floor:'ground',x:12,y:8},
      back:'액자 뒷면에는 오래된 필름을 끼워두었던 흔적이 남았다. 먼지는 최근에 닦아낸 듯하다.',repeatable:false,transferable:false},
    {id:'dining',title:'식당의 쟁반',subtitle:'식당 · 흔적',type:'place',location:{floor:'ground',x:3,y:8},
      back:'쟁반에 남은 유리 가루와 희미한 약품 냄새가 범행 시각을 좁히는 데 도움이 된다.',repeatable:false},
    {id:'bedroom',title:'2층 침실',subtitle:'2층 · 뒤집힌 서랍',type:'place',location:{floor:'upper',x:3,y:2},
      back:'침실 서랍에서 찢긴 청구서가 발견된다. 에드워드가 화재 직전 거액을 지불한 기록이 있다.',repeatable:false},
    {id:'archives',title:'2층 기록실',subtitle:'2층 · 잠긴 기록장',type:'place',location:{floor:'upper',x:12,y:2},
      requires:['library'],visibility:'locked',
      back:'사라진 가족의 기록과 비밀 통로의 배치도가 함께 보관되어 있다.',repeatable:false}
  ]
};

// Regions are designer-owned, visible on every floor as backgrounds and borders.
floors[0].areas=[
  {id:'library',name:'도서관',x:1,y:1,width:5,height:5,color:'#657b8b',pattern:'wood'},
  {id:'study',name:'서재',x:7,y:1,width:9,height:5,color:'#90766a',pattern:'carpet'},
  {id:'hall',name:'중앙 복도',x:1,y:5,width:15,height:2,color:'#847b65',pattern:'stone'},
  {id:'dining',name:'식당',x:1,y:7,width:7,height:3,color:'#82865f',pattern:'tile'},
  {id:'lounge',name:'응접실',x:9,y:7,width:7,height:3,color:'#80708f',pattern:'carpet'}
];
floors[0].doors=[
  {id:'library-door',x:6,y:5,name:'서재 쪽 잠긴 문',requiresItem:'key',locked:true,closed:true},
  {id:'dining-door',x:3,y:6,name:'식당 문',locked:false,closed:true}
];
floors[1].areas=[
  {id:'bedrooms',name:'2층 침실',x:1,y:1,width:7,height:4,color:'#947d7c',pattern:'wood'},
  {id:'archives',name:'기록실',x:9,y:1,width:7,height:4,color:'#718790',pattern:'tile'},
  {id:'up-hall',name:'2층 복도',x:1,y:6,width:15,height:3,color:'#847b65',pattern:'stone'}
];
floors[1].doors=[
  {id:'archive-door',x:8,y:4,name:'기록실 비밀문',requiresItem:'sealed-envelope',locked:true,closed:true}
];
const ending={
  "common": {
    "captured": {
      "title": "까마귀 저택의 마지막 유언 — 관리인의 구속",
      "paragraphs": [
        "폭풍우가 창문을 두드리는 새벽, 서재의 문과 열쇠, 비밀 통로의 기록이 마침내 하나의 이야기로 이어졌다. 정전은 살인이 일어난 순간이 아니라 이미 실행된 범행을 감추기 위한 연출이었다. 젖은 발자국보다 더 중요한 것은 복도를 누구보다 잘 알던 사람의 동선이었다.",
        "관리인 노아가 구속되자 오래된 화재와 사라진 하인의 이름도 다시 기록되었다. 그는 에드워드가 저지른 과거의 잘못을 알고 있었지만 자신이 선택한 살인을 그 잘못으로 정당화할 수는 없었다. 엘레나는 푸른 봉투를 손에 쥐고 어머니의 이름을 다시 불렀다.",
        "아침이 되어 다리의 복구 소식이 들리자 저택은 더 이상 누군가의 비밀을 가두는 성이 아니었다. 각자 숨긴 것은 남아 있었지만 적어도 주인의 마지막 밤이 어떤 선택으로 끝났는지는 밝혀졌다."
      ]
    },
    "missed": {
      "title": "폭풍우가 지운 발자국 — 끝내 놓친 살인범",
      "paragraphs": [
        "서재에서 들린 소리와 정전의 시간을 혼동한 사람들은 오래된 가족사진과 약병을 먼저 의심했다. 누구도 관리인이 서재의 비밀 통로를 먼저 지나갔다는 가능성을 끝까지 붙들지 못했다.",
        "노아의 복수심은 오랜 집사의 충성심 뒤에 숨었고, 다른 사람이 구속되거나 아무도 지목되지 않았다. 에드워드의 과거 잘못이 진실을 가릴 명분이 되어서는 안 되었지만 그날 밤은 그렇게 끝났다.",
        "아침이 되어 구조대가 저택에 도착하자 모두가 밖으로 나왔다. 창문 아래의 발자국은 비에 씻겼고, 관리인의 낡은 장갑만이 서랍 안에 남아 끝내 말하지 못한 이야기를 품었다."
      ]
    }
  },
  "characters": {
    "elena": {
      "intro": "엘레나는 상속 후보라는 이름보다 사라진 어머니의 딸이라는 이름을 다시 찾고 싶었다.",
      "goalAchieved": "푸른 봉투와 편지의 뒷장을 찾았을 때 그녀는 오래된 실종의 시간을 처음으로 이어 붙일 수 있었다.",
      "goalFailed": "어머니의 필체는 편지 조각에 남아 있었지만 돌아오지 못한 날의 이유는 여전히 비어 있었다.",
      "alive": "엘레나는 도서관 책장 옆에 서서 어린 시절의 자신을 조용히 떠올렸다.",
      "dead": "어머니를 찾으려던 이야기마저 저택의 그림자 속에 멈추었다.",
      "arrested": "구속된 엘레나는 가족의 비밀을 숨겼다는 이유만으로 살인범이 될 수는 없다고 말했다.",
      "restrained": "움직이지 못하는 동안 그녀는 손안의 편지를 놓지 않았다.",
      "escaped": "저택 밖의 차가운 공기를 마시며 엘레나는 처음으로 그 집을 등졌다.",
      "closing": "무엇을 물려받느냐보다 어떤 기억을 되찾느냐가 그녀의 마지막 유언이 되었다."
    },
    "victor": {
      "intro": "빅터는 사람의 생명을 다루는 직업이 때때로 가장 많은 비밀을 숨기는 일임을 알고 있었다.",
      "goalAchieved": "약병의 의혹을 풀어낸 그는 과거의 실패를 숨기더라도 현재의 진실은 분명히 말해야 한다는 것을 배웠다.",
      "goalFailed": "오래된 진료 기록과 새로 발견된 약병 사이에서 빅터의 말은 끝내 믿음을 얻지 못했다.",
      "alive": "그는 진료 가방을 다시 닫고 가장 먼저 창문을 열었다.",
      "dead": "의사의 마지막 기록에는 환자가 아니라 빅터 자신의 이름이 남았다.",
      "arrested": "구속된 빅터는 의료 과실을 저질렀다는 의심과 살인을 저질렀다는 의심이 다르다고 말했다.",
      "restrained": "그는 묶인 손으로 청진기를 쥐지 못했다.",
      "escaped": "저택을 나온 빅터는 과거 환자 기록을 다시 열어 보기로 했다.",
      "closing": "자기 죄를 인정하는 일은 다른 사람의 죄까지 짊어지는 일과 달랐다."
    },
    "iris": {
      "intro": "아이리스는 기사 한 줄로 누군가의 삶이 바뀐다는 것을 누구보다 가까이서 보았다.",
      "goalAchieved": "사진 필름과 실종 사건의 증언을 손에 넣자 그녀는 이번에는 진실을 먼저 확인한 뒤 기사를 쓰기로 했다.",
      "goalFailed": "입증하지 못한 이야기는 또 하나의 무고한 사람을 상처 입힐 수 있기에 그녀는 끝내 원고를 완성하지 못했다.",
      "alive": "아이리스는 펜 끝을 바라보다 첫 문장을 쓰기 시작했다.",
      "dead": "그녀가 찾던 진실은 누군가의 수첩에 옮겨 적혔지만 그녀의 기사는 완성되지 못했다.",
      "arrested": "구속된 아이리스는 취재가 불법 침입이 될 수 있어도 살인의 증거가 되지는 않는다고 주장했다.",
      "restrained": "움직일 수 없던 그녀는 들은 말을 머릿속에 반복해 기록했다.",
      "escaped": "새벽의 길 위에서 아이리스는 누군가를 해치지 않을 제목을 고민했다.",
      "closing": "더 중요한 기사는 범인의 이름이 아니라 비밀이 사람을 어떻게 바꾸는지에 대한 이야기였다."
    },
    "noah": {
      "intro": "노아는 저택의 문마다 열쇠를 가지고 있었지만 스스로의 복수심을 잠글 수는 없었다.",
      "goalAchieved": "비밀 통로의 흔적을 숨겼더라도 노아는 자신이 저지른 살인을 가장 정확히 기억하는 사람이었다.",
      "goalFailed": "낡은 장갑과 정전 기록이 연결되는 순간 복수의 명분으로 쌓은 모든 변명은 무너졌다.",
      "alive": "노아는 서재 문 앞에서 마지막으로 열쇠 꾸러미를 만져 보았다.",
      "dead": "그가 지키던 저택은 관리인을 잃었지만 그의 죄까지 잊지는 않았다.",
      "arrested": "구속된 노아는 오래된 화재의 억울함과 자기 손으로 저지른 살인을 따로 설명해야 했다.",
      "restrained": "제압당한 그는 처음으로 자기 뜻대로 문을 열 수 없었다.",
      "escaped": "저택을 떠난 노아에게도 과거 화재와 오늘의 살인이 남았다.",
      "closing": "누군가를 지키기 위해 살아온 사람이 스스로 또 다른 피해자를 만든 밤이었다."
    }
  }
};
module.exports={floorplan,booklets,floors,phaseMinutes,investigation,ending};
