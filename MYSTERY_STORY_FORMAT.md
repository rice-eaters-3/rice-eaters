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
- **문 `doors`:** `{id,name,x,y,locked,closed,requiresItem}`. `locked`는 잠금/열쇠 필요, `closed`는 초기 닫힘 여부입니다(생략하면 닫힘). 닫힌 문은 잠금 여부와 무관하게 이동과 음성 경로를 차단합니다. 옆 칸에서 문 열기/닫기 액션을 사용하고, 잠긴 문은 첫 개방 시 해당 `requiresItem`을 소지해야 합니다. 한 번 해제된 잠금은 문을 다시 닫아도 해제 상태를 유지합니다. 문 위에 플레이어가 있을 때는 닫을 수 없습니다.
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

## 방장 단계 진행 및 화면 전환

- 전원이 시놉시스 확인/캐릭터 선택/캐릭터 숙지를 마친 뒤 **방장만 다음 단계** 버튼으로 전환합니다. 완료해도 자동 진행되지 않습니다.
- 미완료 단계나 아직 구현되지 않은 단계로 건너뛰는 요청은 서버가 거부합니다.
- I 키는 개인 책자, R 키는 조사 카드 목록입니다. 지도와 별도의 조사 카드 화면을 전환합니다.
- 음성 연결 후 마이크와 스피커는 각각 독립된 ON/OFF 스위치로 제어합니다. 같은 층의 경로 거리는 벽과 닫힌 문을 우회하는 통행 가능한 타일을 기준으로 계산합니다. 닫힌 문은 그 경로를 막습니다.

## 카드 공유/양도, 1차·2차 조사 및 단계 동의

편집기의 카드별 **양도 가능 여부** 속성은 `game.investigation.cards[].transferable`에 대응합니다.
값이 `false`면 해당 카드는 어떠한 플레이어도 양도할 수 없고, 생략 또는 `true`면 양도할 수 있습니다.
(전체 공개와 선택 공개는 `transferable`과 관계없이 카드 소유자의 권한입니다.)

`game.investigation`의 **`tokensPerSecondInvestigation`**으로 2차 조사 시작 시 각자
추가 지급되는 토큰 수를 0~20개 사이에서 설정합니다(기본 4개). 1차의
`tokensPerPlayer`는 기존대로 유지됩니다. 미사용 토큰은 2차 조사로 이월됩니다.

각 카드가 조사되면 서버가 원래 발견 기록과 분리된 카드 보유권 ID를 생성합니다.
2명이 같은 카드를 독립 조사할 수 있는 `repeatable` 카드에는 여러 보유권이 생길 수 있습니다.
- **전체 공개**: 개인 소지 카드의 전체 공개 기록 `publicCards`는 되돌릴 수 없으며 카드 ID 기준입니다. 반복 조사 카드의 동일한 뒷면도 모두에게 공개됩니다.
- **선택 공개**: 지정한 수신자와 현재 소유자가 같은 층과 타일을 공유할 때에만 접근이 가능합니다. 이동하면 선택 공개 관계는 파기됩니다.
- **양도**: 최초 제안이 발신자의 동의 역할을 하고, 수령자가 승인해야 소유권 또는 토큰 잔량이 변경됩니다. 어느 한 명이 이동하거나 90초가 지나면 제안은 만료되며 다른 사람이 수락할 수 없습니다.
- **조사 보상 아이템**: 조사 카드로 획득한 별도 `grant` 아이템은 카드 보유권과 별개로 유지됩니다. 현재 카드 양도는 카드 자체의 열람권만 이전하고 이미 획득한 다른 아이템까지 자동으로 이전하지는 않습니다.

1차 조사부터 각 단계의 `advanceVotes`는 전원이 동의 버튼을 누른 경우에만
`POST /api/rooms/:code/advance` 호출을 허용합니다. 방장 외 참가자에게는 권한이 없으며
이동 시마다 이전 단계의 동의 기록이 초기화됩니다.

활성 조사 단계는 `investigation1` 및 `investigation2`입니다. 지도·음성·책자 접근은
1차 토론, 2차 토론, 행동, 결말 단계에도 유지합니다. 카드 소유·전체 공개 상태는 이후
단계에서도 조회되지만 조사 실행 및 거래는 조사 단계에서만 허용합니다.

## 7인 D1 시나리오에서 추가한 확장 필드

`mystery-content/d1-gaming.case.json`은 일반 편집기와 동일한 **`rice-mystery-v1`** 형식이며 다음 선택적 필드를 활용합니다.

- `story.characters[].startLine`: 캐릭터 선택 카드에 표시할 한 줄 시작 대사
- `game.investigation.cards[].clueKind`: `cult`(교단), `timeline`(당일 행적), `trick`(살인 증거·도구) 중 한 분류. 조사 카드 제목과는 별도로 제작자가 유형을 관리합니다.
- `game.investigation.cards[].availableFromPhase`: `investigation1`(기본) 또는 `investigation2`. 2차 전용은 첫 조사 단계에서 선점·조사할 수 없습니다.
- `game.investigation.cards[].visibility`: 2차 조사까지 존재 자체를 숨기려면 `hidden`, 제목을 남겨두려면 `locked`
- `game.investigation.cards[].requiresPresence`: true이면 카드에 설정된 `location`과 플레이어의 실제 층·타일이 일치해야 카드 선점·조사할 수 있습니다. 기본은 false(카드 리스트에서 원격 조사 가능).
- `game.investigation.cards[].insights`: `{ "mayushi": "마유시만 볼 수 있는 사이코메트리 감응" }`처럼 역할 ID별 비공개 추가 서술을 지정합니다. **해당 역할이 카드를 보유하거나 선택 공개받거나 전체 공개되어 뒷면을 읽을 수 있을 때만** 해당 역할에게 감응이 제공됩니다. 다른 역할에는 이 텍스트를 전송하지 않습니다.
- `creatorGuide`: 제작자만 볼 해설·진범·전체 시간표·해답·오답 엔딩을 담는 최상위 필드. 게임 서버의 공개 API에서는 사용하지 않습니다. 일반 에디터에서 JSON으로 불러오면 원본 필드가 유지됩니다.

이 기능으로 3층 복도에서 2차 조사 전용 `trick_spare_override`를 직접 조사해 **`vault_override`** 키를 획득해야 비로소 4층 봉인 보관실의 문을 열고 특정 단서를 조사할 수 있습니다.

**주의:** 모든 커밋된 원고와 제작자 해설은 저장소 접근 권한이 있는 사람이 읽을 수 있습니다. HTTP 정적 파일 접근을 막아도 GitHub 공개 저장소의 스포일러 노출까지 막지는 못합니다.

## 2026년 추가: 역할별 순서가 있는 행동 단계

필요한 경우 시나리오의 `game` 안에 `action`을 정의합니다. 기존 시나리오는 없어도 정상 작동하며, 있을 경우 서버가 순서대로 각자 한 번씩 역할 행동을 처리합니다.

```json
{
  "game": {
    "booklets": {
      "alpha": {
        "actionNotes": "두 번째 행동 순서입니다. 누구를 지킬지 신중히 결정하세요."
      }
    },
    "action": {
      "intro": "정해진 순서대로 각자 한 번 행동합니다.",
      "order": ["beta", "alpha"],
      "endingNotes": "최종 결과 및 개인 승점은 수동 판정합니다.",
      "roles": {
        "alpha": [
          {
            "id": "shield",
            "title": "비상 방어",
            "description": "한 사람의 다음 위협을 막습니다.",
            "kind": "guard",
            "targetMode": "any",
            "requiresItem": "small_key",
            "requiresCard": null,
            "consumesItem": true,
            "publicText": "방어 준비를 마쳤습니다."
          }
        ],
        "beta": []
      }
    }
  }
}
```

- `order`: 캐릭터 ID를 **중복 없이 전원 한 번씩** 나열합니다. 개인 책자에 순서 번호가 비공개로 제시됩니다.
- `roles.<캐릭터ID>[]`: 역할 고유 능력 목록. 자신의 책자에서만 볼 수 있고 자기 차례에만 사용 버튼이 활성화됩니다.
- `kind`: `guard`(보호), `attack`(게임 내 추가 사망), `restrain`(제압·차례 건너뛰기), `reveal`(정보 공개), `escape`(개별/공동 탈출 기록) 중 하나.
- `targetMode`: `none`, `self`, `other`, `any` 중 하나. `range: "tile"` 옵션이 있으면 같은 층·타일의 대상만 유효합니다.
- `requiresItem`: **개인 초기 소지품 ID 또는 조사 카드 `grant.id`**가 일치할 때만 실행 가능. 아이템 소비 여부는 `consumesItem`으로 제어합니다.
- `requiresCard`: 현재 자신이 보유한 조사 카드 ID가 있어야 실행 가능한 능력. 카드를 다른 사람에게 양도하면 사용 권한도 달라집니다.
- 모든 역할이 행동하지 않는 선택(`pass`)을 기본으로 가집니다.
- 서버는 행동을 즉시 순서대로 기록하고, 후순위 플레이어가 탈락/제압된 경우 자동 건너뛰며, `guard`는 위협을 1회 막습니다.
- 행동을 모두 실행해야 다음 단계가 활성화되고, **전원 진행 동의 + 방장의 클릭**이 필요합니다.
- `/mystery-editor`에서 시나리오 JSON을 불러온 후 **사건 개요 → 행동 순서**, **캐릭터 책자 → 고유 능력 JSON**으로 편집할 수 있습니다.

### 창작 시나리오 원본 파일

- `mystery-content/cruel-heart-island.case.json`: 8명(남4·여4), 연애 프로그램 섬 살인
- `mystery-content/neon-memory-quarantine.case.json`: 7명, SF 기억 복제·EMP 고립
- `mystery-content/stellar-academy-first-case.case.json`: 6명, 별개 범인/학교 탈출 목표
- `mystery-content/THREE_NEW_CASES_AUTHOR_GUIDE.md`: **제작자 전용 전체 스포일러**

새 원고는 기존 `rice-mystery-v1` 형식으로 작성되었으며, 시나리오별 정답·엔딩·검토용 주석은 최상위 `creatorGuide`에 포함됩니다. 원본 GitHub 공개 범위에 각별히 주의하세요.

## 2026-11 · 전지적 원고 → 개인 시점 책자 서술 규약

전체 사건을 먼저 제작자 전용 JSON에 저장하고 이를 바탕으로 개별 캐릭터 책자를 작성합니다.

```json
{
  "creatorGuide": {
    "omniscientStory": [
      {
        "title": "00:26 — 실제 일어난 사건",
        "paragraphs": [
          "범인과 피해자에 대한 정보까지 포함하는 전지적 원고.",
          "개별 참가자가 모르는 진실과 사건의 정확한 원인을 서술."
        ]
      }
    ],
    "narrativeMethod": "서술 작법과 시점 제한 방법",
    "continuityChecklist": ["물증과 시간 순서의 일치 조건"]
  },
  "game": {
    "booklets": {
      "role_id": {
        "timeline": [
          {
            "time": "00:26",
            "title": "당시 인물이 경험한 장면",
            "detail": "그 사람의 실제 행동과 보았던 것.\n\n숨긴 감정·당시 생각과 오해.\n\n원고 속 사건과 연결되는 결과."
          }
        ]
      }
    }
  }
}
```

- **제작자 전지적 원고**는 플레이어 API에서 제공하지 않고 원본 시나리오의 `creatorGuide`에 보관합니다. 참가자가 모르는 범인의 동기, 실제 사망 시각, NPC의 입장, 정답을 포함해도 됩니다.
- **인물별 시간 기록**은 자기 경험과 안다고 설정된 비밀을 넘어서면 안 됩니다. 인물의 행동·감정·감각·상호작용을 묘사하되 모든 사실을 미리 알려 주지 않습니다.
- `timeline[].detail`은 장면의 문단 사이를 `\n\n`으로 구분합니다. 책자 UI가 HTML 안전 처리 후 **개별 문단**으로 표시하며, 기존의 책자 페이지 탐색 구조를 유지합니다.
- 조사 카드의 뒷면과 시간표는 `continuityChecklist`와 대조해 확인합니다. 기존 카드의 시각과 맵 동선, 각자의 승점 목표는 변경하지 않습니다.

작품별 원고는 `mystery-content/manuscripts/` 아래에 있습니다. 이 Markdown들은 **읽기 편한 검토본**이며 실제 게임 데이터의 원본은 각 `.case.json` 파일입니다.
