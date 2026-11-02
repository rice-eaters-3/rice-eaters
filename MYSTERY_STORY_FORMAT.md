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
