# 조사 카드 이미지 검수

카드 제목과 뒷면 설명을 확인한 뒤, 실제로 표시되는 원본 아틀라스 컷의 피사체와 대조한다. 독립 일러스트는 시리즈와 카드 ID로 연결한다. 소지품 책자와 획득 카드도 같은 ID를 사용하며, 획득 카드에서는 소유 기록 ID 대신 원본 카드 ID로 조회한다.

## D1 사옥 · 1차 배치

신규 파일 경로의 공통 앞부분은 `apps/murder-mystery/assets/clues/d1-crown-of-ashes/`이다.

| 카드 ID | 기존 표시와 문제 | 신규 파일 |
| --- | --- | --- |
| `jobi_threat_phone` | D1 노트가 표시되어 협박 메시지가 있는 휴대전화가 보이지 않음 | `jobi_threat_phone.webp` |
| `jobi_stage_mouse` | D1 노트가 표시되어 연습 서버 인증 라벨이 붙은 마우스가 보이지 않음 | `jobi_stage_mouse.webp` |
| `jobi_qualifier_card` | D1 노트가 표시되어 데뷔 선발전 탈락 결과지가 보이지 않음 | `jobi_qualifier_card.webp` |
| `jobi_stopwatch` | D1 노트가 표시되어 독립형 기계식 타이머가 보이지 않음 | `jobi_stopwatch.webp` |
| `mayushi_oracle_cards` | D1 노트가 표시되어 시계와 낙하 조형물이 그려진 신탁 카드가 보이지 않음 | `mayushi_oracle_cards.webp` |
| `mayushi_spirit_bell` | D1 노트가 표시되어 은색 방울이 보이지 않음 | `mayushi_spirit_bell.webp` |
| `mayushi_fractured_talisman` | D1 노트가 표시되어 금이 간 부적이 보이지 않음 | `mayushi_fractured_talisman.webp` |
| `mayushi_private_stream` | D1 노트가 표시되어 왕관을 언급하는 미공개 영상임을 알 수 없음 | `mayushi_private_stream.webp` |
| `chajiwoo_mini_gargoyle` | 가고일 미니어처는 일치함. 원본 시트 컷을 사용하던 소지품을 독립 일러스트로 교체 | `chajiwoo_mini_gargoyle.webp` |
| `chajiwoo_donation_ledger` | D1 노트가 표시되어 후원 거래 내역과 메모가 보이지 않음 | `chajiwoo_donation_ledger.webp` |

신규 컷은 내장 이미지 생성으로 각각 제작했다. D1 컨셉의 짙은 보라, 황동 조명, e스포츠 사옥을 공통 배경으로 사용하고, 표에 적힌 증거물을 중앙에 단독 배치했다. 휴대전화 메시지는 흐리게 처리해 카드 원문과 다른 대사가 화면에 나타나지 않도록 했다.

정확한 시각, 대사, 문구의 원문은 카드 뒷면에 있다. 일러스트는 카드 전면에서 증거물의 형태와 성격을 보여준다.

## D1 사옥 · 2차 배치

신규 파일 경로의 공통 앞부분은 1차 배치와 같다.

| 카드 ID | 기존 표시와 문제 | 신규 파일 |
| --- | --- | --- |
| `chajiwoo_cult_invitation` | 가고일 교리서가 표시되어 예배 초대장을 구분할 수 없음 | `chajiwoo_cult_invitation.webp` |
| `chajiwoo_unmailed_letter` | D1 노트가 표시되어 편지와 손으로 그린 전시실 배치도가 보이지 않음 | `chajiwoo_unmailed_letter.webp` |
| `cloud_tainted_cleaver` | 대형 식칼은 일치함. 얼룩을 비트·고추 소스 등 식재료로 묘사한 독립 컷으로 교체 | `cloud_tainted_cleaver.webp` |
| `cloud_huoguo_ladle` | D1 노트가 표시되어 손잡이에 각인이 있는 훠궈 국자가 보이지 않음 | `cloud_huoguo_ladle.webp` |
| `cloud_elephant_eggplant` | D1 노트가 표시되어 가지와 비트 소스 레시피를 구분할 수 없음 | `cloud_elephant_eggplant.webp` |
| `cloud_oven_receipt` | D1 노트가 표시되어 오븐 타이머 출력지가 보이지 않음 | `cloud_oven_receipt.webp` |
| `karl_alpaca_notebook` | 털뭉치 노트는 일치함. 알파카 그림과 구조소 기록이 담긴 독립 컷으로 교체 | `karl_alpaca_notebook.webp` |
| `karl_manager_badge` | 출입 태그는 일치함. 카알의 소지품을 독립 컷으로 교체 | `karl_manager_badge.webp` |
| `karl_alpaca_receipts` | 털뭉치 노트가 표시되어 구조소 송금 영수증을 구분할 수 없음 | `karl_alpaca_receipts.webp` |
| `karl_unbroken_promise` | D1 노트가 표시되어 약속을 기념하는 배지가 보이지 않음 | `karl_unbroken_promise.webp` |

## 시리즈 배경

신규 배경은 `apps/murder-mystery/assets/backgrounds/`에 있으며, 게임과 테스트 모드의 시놉시스·결말 및 제작소의 시나리오·결말 탭에서 공통으로 불러온다.

| 시리즈 | 신규 파일 | 제작 방향 |
| --- | --- | --- |
| D1 사옥 | `d1-background.webp` | 비 내리는 자정의 e스포츠 사옥, 자줏빛과 황동 조명, 가고일 실루엣 |
| 마지막 하트 | `island-background.webp` | 분홍빛 노을과 폭풍이 겹치는 섬의 촬영 빌라 및 선착장 |
| 네온 검역국 | `neon-background.webp` | 청록과 자홍색 네온이 번지는 미래 도시의 기억 검역 시설 |
| 성하 영재관 | `academy-background.webp` | 한밤의 별자리와 금빛 창문이 보이는 천문대와 교정 |

## 재개 지점

D1 사옥의 21번째 카드 `hasu_cult_notebook`부터 다음 10장을 대조한다. D1 51장, 마지막 하트 56장, 네온 검역국 54장, 성하 영재관 48장이 남아 있다.
