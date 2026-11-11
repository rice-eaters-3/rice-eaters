# 제주 학회 MT — 적용된 일러스트

표지 1장, 플레이어 7명과 피해자 NPC 1명의 초상화, 조사 카드 64장의 개별 원화를 적용했습니다. 파일은 WebP이며 `apps/murder-mystery/illustrations.js`를 통해 실제 플레이, 제작소 미리보기, 제작소 테스트 화면에서 공통으로 사용합니다.

- 표지: `apps/murder-mystery/assets/backgrounds/jeju-lab-conference-background.webp`
- 초상화: `apps/murder-mystery/assets/portraits/jeju-lab-conference/<캐릭터 ID>.webp`
- 조사 카드: `apps/murder-mystery/assets/clues/jeju-lab-conference/<카드 ID>.webp`
- 생성 프롬프트와 매칭 기록: `mystery-content/JEJU_ART_REVIEW.json`

카드 앞면은 기존 장소/소지품의 중립 이름을 유지합니다. 실제 제목과 그림은 뒷면 조회 권한을 얻은 뒤 노출합니다. 조사 카드는 개별 원화 전체를 `meet`으로 표시하며 다른 카드에서 잘라 쓰지 않습니다. 게임의 관찰 사실과 수치에 대한 기준은 시나리오 JSON의 카드 본문입니다.

지도 장식 오브젝트 12개와 문·계단은 기존 기본 표시를 유지합니다. 새로운 지도 스프라이트가 필요하면 별도 작업으로 추가할 수 있습니다. 게임 규칙과 지도 배치는 바꾸지 않았습니다.
