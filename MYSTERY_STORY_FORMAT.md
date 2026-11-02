# 머더 미스터리 스토리 / 책자 / 약도 데이터 모델

현재 데모는 「자정의 저택」입니다. 서술 내용은 독자적으로 작성한 더미 텍스트입니다.

## 공개 설정: server.js의 STORIES

공개 속성: id, title, subtitle, genre, players, teaser, synopsis, characters. 
캐릭터 공개 프로필: id, name, role, hint, symbol, accent.

## 비공개 설정: private/mystery-data.js

서버에서만 로드하며 /private 폴더의 HTTP 접근을 차단합니다.
각 캐릭터 ID마다 booklets 객체를 정의합니다.

| 필드 | 타입 | 책자 |
|---|---|---|
| 공개 characters[id] | 이름/역할/소개 | 1. 기본 정보 |
| background | 문자열 배열 | 2. 중요 정보 및 비밀 |
| timeline | time/title/detail 객체 배열 | 3. 시간대별 행적 |
| inventory | id/name/description 객체 배열 | 4. 소지품 |
| culprit | boolean | 5. 범인 여부 |
| objectives | 문자열 | 6. 승리 목표 (수동 판정) |
| notes | 문자열 | 개인 참고 정보 |
| synopsis, characters, floorplan | 공개 | 7. 기타 정보 |

서버의 GET /api/rooms/:code 응답에는 **해당 세션이 맡은 캐릭터의 책자만** 포함됩니다. 다른 플레이어의 개인 서사는 제공되지 않습니다. 캐릭터 선택 4명이 모두 완료되면 study 단계로 이동하고 캐릭터 변경은 잠깁니다.

숙지 완료 버튼은 각 플레이어의 studyReady를 저장합니다. 1차 조사 단계가 아직 미구현이라 4명 모두 완료해도 study 단계에 남습니다.

## 건물 약도

시나리오에 floorplan이 있으면 공용 지도와 이동 버튼이 나타납니다. 없으면 지도 영역에는 안내 문구만 표시됩니다.

- title, legend
- tiles: 같은 길이의 문자열 배열, '#' = 벽, '.' = 이동 가능한 땅
- rooms: x, y, name, icon 좌표별 장소 라벨
- spawn: 캐릭터 ID별 시작 위치 (x, y)
- 좌표는 좌상단 (0,0), x 오른쪽, y 아래쪽으로 증가
- 이동 API: POST /api/rooms/:code/move, JSON 본문 direction = up / down / left / right
- 서버가 세션별 이동, 벽/맵 영역 검증, 이동 간격 제한을 처리합니다.
- 다른 참가자의 위치는 모두에게 공유되며 같은 타일에 여러 명이 위치해도 됩니다.
- 일반 환경은 SSE, Cloudflare Quick Tunnel은 약 0.85초 HTTP 폴링으로 동기화됩니다.
- 지도 이동은 숙지 단계에만 활성화합니다.

## 향후 확장

조사 토큰 및 타인의 소지품 조사, 밀담, 투표는 미구현입니다. 자신의 소지품만 숙지 단계에서 무료로 볼 수 있습니다. 승리 점수는 수동 판정입니다.

비밀 콘텐츠를 클라이언트 JavaScript에 복사하거나 static 경로로 옮기지 마세요. 실제 시나리오 배포 전 계정 인증 및 재접속 관리도 필요합니다.

## 1차 조사 / 시간 / 밀담 규칙 (새 설정)

스토리 내부 공개 메타데이터는 `server.js`의 STORIES, 비밀 본문과 조사 카드 뒷면은 `private/mystery-data.js`에 정의합니다.

### 단계별 권장 시간

시나리오의 `phaseMinutes`는 다음 순서로 분 단위로 설정합니다. `synopsis: 5`, `characters: 5`, `study: 20`, `investigation1: 20`, `discussion1: 15`, `investigation2: 20`, `discussion2: 20`, `action: 10`, `ending: 15`.

서버가 게임 시작/단계 시작 시각을 기록합니다. 권장 시간이 끝나도 단계는 자동 종료되지 않습니다. 현재 구현된 단계는 1차 조사까지입니다.

### 맵과 최대 인원

`floors` 배열의 각 맵은 `id,title,tiles,rooms,portals`를 가지며, `portals` 항목은 `{x,y,toFloor,toX,toY,label}`입니다. 캐릭터마다 이동 상태는 `{floor,x,y}`로 저장됩니다. 타일별 인원 제한은 `investigation.maxTileOccupants`로 설정(데모: 3). 다른 층의 캐릭터는 지도에 나타나지 않습니다.

### 조사 카드

`investigation.tokensPerPlayer`는 개인 초기 조사 토큰 수(데모 4)입니다. `investigation.cards`는 개별 카드 배열로, 각 카드가 다음 필드를 사용할 수 있습니다:

- `id,title,subtitle,type`: 카드 ID, 앞면에 표시할 제목/요약/유형
- `back`: 조사 토큰을 사용한 플레이어에게만 제공할 뒷면의 상세 정보
- `location: {floor,x,y}`: 맵에서 해당 칸에 도착했을 때 바로 조사 선택 버튼을 보여주는 선택적 위치. 리스트에서의 직접 조사는 위치 제한 없이 가능
- `owner`: 자기 소지품·자기 정보인 경우, 해당 캐릭터 ID는 조사 불가
- `blockedFor`: 조사할 수 없는 캐릭터 ID 목록
- `requires`: 선행 조사 완료가 필요한 카드 ID 배열 (기본은 모두 필요)
- `visibility`: `hidden`이면 해금 전 리스트에서 미표시, `locked`이면 제목/앞면 공개 후 잠금 표시
- `repeatable`: true이면 다른 플레이어도 별도 토큰을 소모하여 조사 가능, false는 1명 조사 후 회색/불가
- `grant: {id,name,description}`: 조사 확정 시 플레이어에게 지급되는 선택적 소지품

카드를 `POST /api/rooms/:code/reserve`로 **90초간 선점**한 뒤 `POST .../investigate`로 토큰 1개를 소비하며 뒷면을 볼 수 있습니다. `POST .../release`는 선점 해제입니다. 동시 사용의 충돌을 피하려고 서버에서 원자적으로 판정합니다.

### 밀담과 음성

`whisper-request` → 투표자의 `whisper-vote`(전원 동의) → 밀담 시작 또는 그룹 합류. 기존 그룹으로 들어가려면 현재 멤버 모두 찬성해야 합니다. `whisper-leave` 또는 밀담 타일 이탈 시 그룹에서 나갑니다. 지도에 정한 `maxTileOccupants` 이하만 가능합니다.

근접 음성은 사용자가 마이크를 허용한 경우에만 WebRTC를 사용합니다. 거리 감쇠와 별개로 밀담 참여자는 해당 밀담 외 사용자에게 오디오 트랙을 전송하지 않도록 설계했습니다. **공용 STUN만 사용하며 TURN 서버는 아직 없으므로** 외부 네트워크 간 마이크 연결은 제한적일 수 있습니다. 음성 프로토타입은 보안 감사 또는 상용 음성 품질을 거친 상태가 아닙니다.
