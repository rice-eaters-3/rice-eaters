# 머더 미스터리 JSON 제작 형식 (rice-mystery-v1)

## 편집기

게임 서버를 실행한 뒤 [로컬 편집기](http://localhost:3000/mystery-editor)에 접속하세요.
**① 시나리오 → ② 캐릭터 책자 → ③ 조사 카드 → ④ 지도·기믹 → ⑤ 원고 확인**의 탭을 따라 편집합니다.

- **JSON 저장:** 브라우저로 `.mystery.json` 파일 내보내기
- **JSON 불러오기:** 같은 형식의 파일을 편집기에 다시 불러오기
- **서버에 등록하고 플레이:** 제작자 PC의 `localhost`에서만 허용됩니다. 등록 후 게임 홈 화면의 시나리오 목록에서 선택 가능합니다.
- 저장된 커스텀 시나리오는 `data/state.json`에 영구 보존됩니다. 삭제/이동 전에 백업하세요.
- **주의:** JSON 원고에는 범인·캐릭터 개인 사연·카드 뒷면이 모두 들어 있습니다. 플레이어에게 파일을 직접 보내지 마세요.

## 파일 구조

```json
{
  "format": "rice-mystery-v1",
  "story": {
    "title": "사건 이름",
    "subtitle": "부제",
    "genre": "미스터리",
    "teaser": "앞면 소개",
    "minutes": 90,
    "players": 2,
    "synopsis": ["공동 시놉시스"],
    "characters": [
      {"id":"alpha","name":"등장인물 A","role":"역할","hint":"공개 특징","symbol":"♟","accent":"#7aaabb"},
      {"id":"beta","name":"등장인물 B","role":"역할","hint":"공개 특징","symbol":"♜","accent":"#cc9a88"}
    ]
  },
  "spawn": {
    "alpha":{"floor":"ground","x":1,"y":1},
    "beta":{"floor":"ground","x":3,"y":1}
  },
  "game": {
    "booklets": {
      "alpha": {"background":["중요 정보"],"timeline":[{"time":"22:30","title":"도착","detail":"행동"}],
        "inventory":[{"id":"small_key","name":"작은 열쇠","description":"문을 열 수 있다"}],
        "culprit":false,"objectives":"승리 목표","notes":"연기 힌트"},
      "beta": {"background":["비밀"],"timeline":[],"inventory":[],"culprit":true,"objectives":"승리 목표","notes":""}
    },
    "phaseMinutes":{"synopsis":5,"characters":5,"study":20,"investigation1":20},
    "investigation":{"tokensPerPlayer":4,"maxTileOccupants":3,"cards":[]},
    "floors":[{
      "id":"ground","title":"1층","legend":"안내","tiles":["#####","#...#","#...#","#...#","#####"],
      "rooms":[],"areas":[],"doors":[],"portals":[]
    }]
  }
}
```

## 지도와 구역

- `floors[].tiles`는 같은 너비의 문자열 배열입니다. `#`은 벽, `.`은 통행 가능 칸입니다.
- `rooms: [{x,y,name,icon}]`은 안내 라벨의 위치입니다.
- **구역 `areas`:** `{id,name,x,y,width,height,color,pattern}` 형태의 직사각형입니다. 배경색과 `wood/carpet/stone/tile/plain` 패턴, 각 구역의 강조 경계선으로 서재·식당 등을 분리합니다.
- **문 `doors`:** `{id,name,x,y,locked,requiresItem}`. 잠긴 문은 통과할 수 없습니다. **옆 칸에서 문 열기 액션**을 수행하고 해당 `requiresItem` ID의 개인/획득 소지품이 있어야 열립니다. 빈 값이면 열쇠 없는 잠금입니다.
- **이동 타일 `portals`:** `{x,y,toFloor,toX,toY,label}`. 들어간 것만으로 이동하지 않고, **그 타일 위에서 액션을 선택**합니다. 한 칸에 여러 포털을 배치하면 '위층/아래층' 버튼을 동시에 보여줄 수 있습니다.
- **배역 시작점 `spawn`:** `{[characterId]:{floor,x,y}}`. 각 캐릭터에 이동 가능한 시작 칸을 지정합니다.
- 한 타일 수용 인원은 `investigation.maxTileOccupants`로 지정합니다. 데모 3명, 최소 2~최대 10명.

## 조사 카드 구성

`game.investigation.cards`의 각 카드는 다음 속성을 지원합니다.

| 속성 | 의미 |
|---|---|
| `id,title,subtitle,type` | 앞면 ID·이름·요약·유형(place/information/belonging) |
| `back` | 토큰 소모 후 조사한 본인에게만 공개할 자세한 뒷면 |
| `owner`, `blockedFor` | 소유자 본인 또는 지정한 역할의 조사 금지 |
| `requires` | 선행 조사 완료 카드 ID 배열 |
| `visibility` | hidden은 해금 전 감추기, locked는 앞면 공개/잠금 |
| `repeatable` | 카드별 중복 조사 허용 on/off |
| `grant` | 획득 아이템 `{id,name,description}` (선택적) |
| `location` | 선택적 맵 위치 `{floor,x,y}` (리스트에서 조사하는 것은 가능) |

카드는 먼저 선점(90초) 후 토큰을 소비해 조사합니다. 기본 1차 조사 토큰은 4개입니다. 타인의 조사 결과는 카드 목록에 반영되지만 **뒷면 내용은 본인에게만** 전달됩니다.

## 런타임과 보안

- 게임 UI: `apps/murder-mystery/`
- 기본 시나리오: `mystery-content/stories.js`, `mystery-content/midnight-manor.js`
- JSON 검증: `mystery-content/validate.js`
- 게임 서버/역할별 접근 제한: `server.js`
- 사용자 제작 시나리오 저장: `data/state.json` (`.gitignore` 처리)

시나리오는 2~10인, 지도 최대 8층, 카드 최대 200개, JSON 업로드 2MB로 제한합니다.
현재 게임 흐름은 1차 조사까지 구현되었습니다. 이후 토론·결말은 아직 개발되지 않았습니다.
WebRTC 근접 음성은 TURN 서버 없이 NAT 환경에서 실패할 수 있으며, 보안 감사된 통화 솔루션은 아닙니다.

## 수동 단계 진행 / 문 개폐 / 음향 차폐

- 서버에서 단계별 모든 참가자의 준비를 확인한 후 **방장만** 다음 단계로 진행할 수 있습니다. `/api/rooms/:code/advance` (POST)는 시놉시스 → 캐릭터 선택 → 캐릭터 숙지 → 1차 조사를 지원하며, 전원 준비가 아니거나 방장이 아니면 거절됩니다.
- `doors` 항목에 `locked`와 **`open`**을 각각 설정합니다. `locked=true`라면 초기 `open=true`라도 잠긴 닫힌 문으로 처리됩니다. 문 옆의 액션 버튼을 통해 문을 열거나 닫습니다. 열려야만 통과할 수 있습니다.
- `POST /api/rooms/:code/interact` `{kind:"door",doorId:"...",mode:"open"}` 및 `mode:"close"`는 서버가 거리·열쇠·문 점유 상태를 확인합니다. 잠긴 문을 열면 해제되고, 이후 문을 닫더라도 다시 잠기지는 않습니다.
- 닫힌 문과 벽은 실시간 음성에서 **불투과 타일**로 취급합니다. 소리 감쇠는 같은 층에서 열린 통로를 잇는 최단 거리로 계산하며, 연결된 경로가 없으면 음성 수신 음량을 0으로 하고 해당 상대에게 내 마이크 트랙도 전송하지 않습니다.
- 캐릭터 숙지 화면의 **책자 확인**과 1차 조사 화면의 **조사 가능 정보 확인**은 모두 전체 화면 토글입니다. 조사 카드 상태는 조회할 때마다 갱신되며, 지도에서 조사 위치를 찾아 바로 선택하는 기능도 유지됩니다.
- 클라우드 환경 음성은 TURN 서버 없이 연결이 불안정할 수 있고 WebRTC 네트워크 품질은 실기기에서 별도로 확인해야 합니다.
