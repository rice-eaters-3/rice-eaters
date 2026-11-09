'use strict';
// Public metadata for the built-in story. Role secrets live in midnight-manor.js.
module.exports=[
  {
    id: 'midnight-manor', title: '자정의 저택', subtitle: '폭풍우가 잠든 밤, 닫힌 문 뒤의 진실',
    genre: '고딕 미스터리', minutes: 90, players: 4,
    teaser: '유산 공개를 앞둔 저택의 주인이 서재에서 숨진 채 발견되었다. 폭풍우 속에 머물던 네 명의 손님 모두에게는 감추고 싶은 비밀이 있다.',
    synopsis: [
      '1928년 10월 31일. 외딴 언덕의 「까마귀 저택」에는 폭풍우가 몰아치고 있습니다. 저택의 주인 에드워드 블랙우드는 네 사람에게 한 통의 편지를 보냈습니다. “오늘 밤, 내 유언과 오래된 사건의 진실을 공개하겠소.”',
      '밤 11시 47분, 정전과 함께 서재에서 둔탁한 소리가 울렸습니다. 문을 부수고 들어간 사람들은 책상 옆에 쓰러진 에드워드를 발견합니다. 문은 안쪽에서 잠겨 있었고, 열린 창문 밖으로는 빗물에 젖은 발자국이 보입니다.',
      '전화선은 끊겼고 다리마저 무너졌습니다. 구조대가 아침에 도착하기 전까지 여러분은 이곳을 떠날 수 없습니다. 서로의 이야기를 듣고, 증거를 모으고, 진실을 찾아내십시오. 누군가는 정답을 알고 있을지도 모릅니다.'
    ],
    characters: [
      {id:'elena',name:'엘레나 블랙우드',role:'저택 주인의 조카',hint:'오래된 가족사진을 품은 상속 후보.',symbol:'♜',accent:'#b48bd8'},
      {id:'victor',name:'빅터 헤일',role:'저택의 주치의',hint:'사망 시각에 대해 남다른 지식을 가진 의사.',symbol:'⚕',accent:'#82b8b4'},
      {id:'iris',name:'아이리스 모건',role:'취재 기자',hint:'초대받지 않았지만 누구보다 많은 질문을 가진 손님.',symbol:'✒',accent:'#dca772'},
      {id:'noah',name:'노아 그레이',role:'저택 관리인',hint:'복도와 열쇠에 관해서는 누구보다 잘 아는 인물.',symbol:'⚿',accent:'#98a8ce'}
    ]
  }
  ,require('./d1-gaming.case.json').story
  ,require('./cruel-heart-island.case.json').story
  ,require('./neon-memory-quarantine.case.json').story
  ,require('./stellar-academy-first-case.case.json').story
  ,require('./jeju-lab-conference.case.json').story
];
