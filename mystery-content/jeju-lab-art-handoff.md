# 제주 학회 MT — 일러스트 제작 인계 목록

이 문서는 **이미지를 생성하거나 포함하지 않습니다.** 시나리오의 현재 모든 표지·인물·조사 카드에는 `illustrations.js`의 자산 없는 SVG 더미 표시만 적용되어 있습니다. 새 아트 에이전트는 아래 고정 ID에 맞춰 별도의 원화를 만들어 연결하면 됩니다.

## 운영 원칙

- **총 참가자 7명과 피해자 NPC 1명, 조사 카드 64장**. 등장인물 실명과 카드 뒷면 정보는 시나리오 JSON을 참조합니다.
- 조사 카드 **앞면은 중립 명칭**(예: ‘윤서하의 소지품 1’, ‘공동 세미나실 1’)만 표시합니다. 이미지와 실제 제목은 *뒷면 조회 권한이 생긴 후* 노출합니다.
- `creatorGuide`에는 진범/동기/트릭/결말 스포일러가 포함되어 있습니다. 공개 썸네일·표지·캐릭터 소개에 쓰지 마세요.
- 권장 산출물: 인물 초상화 432×576px, 조사 카드 512×512px, 시나리오 표지 1024×440px WebP. 지도는 기존 타일 기반이므로 이미지 없이는 정상 작동합니다.
- 단순히 파일을 업로드하는 것만으로 UI가 바뀌지는 않습니다. 파일이 생기면 `apps/murder-mystery/illustrations.js`의 `jejuDummy` 분기를 실제 에셋 경로를 불러오는 방식으로 교체해야 합니다. 파일 누락 시에는 계속 더미 이미지가 나와야 합니다.
- 지금은 어떤 유료 이미지 생성이나 자동 업로드도 실행하지 않았습니다.

## 시나리오 표지

`apps/murder-mystery/assets/backgrounds/jeju-lab-conference-background.webp`

제주 펜션과 학회라는 분위기만 표현하고, 범인 신원이나 살인 수단은 노출하지 않습니다.

## 캐릭터 초상화 (8개: 플레이어 7 + 피해자 1)

| ID | 캐릭터 | 권장 경로 |
|---|---|---|
| `seoha` | 윤서하 | `apps/murder-mystery/assets/portraits/jeju-lab-conference/seoha.webp` |
| `doyun` | 강도윤 | `apps/murder-mystery/assets/portraits/jeju-lab-conference/doyun.webp` |
| `minji` | 오민지 | `apps/murder-mystery/assets/portraits/jeju-lab-conference/minji.webp` |
| `sion` | 박시온 | `apps/murder-mystery/assets/portraits/jeju-lab-conference/sion.webp` |
| `yuna` | 최유나 | `apps/murder-mystery/assets/portraits/jeju-lab-conference/yuna.webp` |
| `jiwoo` | 한지우 | `apps/murder-mystery/assets/portraits/jeju-lab-conference/jiwoo.webp` |
| `haerim` | 정해림 | `apps/murder-mystery/assets/portraits/jeju-lab-conference/haerim.webp` |
| `prof_jeong` | 정윤석 | `apps/murder-mystery/assets/portraits/jeju-lab-conference/prof_jeong.webp` |

## 조사 카드 삽화 (64개: 소지품 28 + 장소 36)

원본 카드 제목과 관찰 가능한 물건의 형태에 맞춰 *개별 일러스트*를 제작하십시오. 장소 카드 하나를 다른 물체의 이미지로 대체하면 안 됩니다.

| 카드 ID | 분류 | 뒷면 실제 대상 | 권장 경로 |
|---|---|---|---|
| `seoha_commit_print` | 소지품 1 | 윤서하의 평가 코드 커밋 출력물 | `apps/murder-mystery/assets/clues/jeju-lab-conference/seoha_commit_print.webp` |
| `seoha_defense_email` | 소지품 2 | 윤서하의 심사 일정 변경 통지 | `apps/murder-mystery/assets/clues/jeju-lab-conference/seoha_defense_email.webp` |
| `seoha_phone_log` | 소지품 3 | 윤서하의 오민지와의 통화 기록 | `apps/murder-mystery/assets/clues/jeju-lab-conference/seoha_phone_log.webp` |
| `seoha_review_letter` | 소지품 4 | 윤서하의 미발송 이의 제기서 | `apps/murder-mystery/assets/clues/jeju-lab-conference/seoha_review_letter.webp` |
| `doyun_poster_tube` | 소지품 1 | 강도윤의 파란 줄무늬 포스터 통 | `apps/murder-mystery/assets/clues/jeju-lab-conference/doyun_poster_tube.webp` |
| `doyun_qa_screenshot` | 소지품 2 | 강도윤의 23:18 영상 게시 화면 | `apps/murder-mystery/assets/clues/jeju-lab-conference/doyun_qa_screenshot.webp` |
| `doyun_consulting_agreement` | 소지품 3 | 강도윤의 비공개 기술 검증 약정서 | `apps/murder-mystery/assets/clues/jeju-lab-conference/doyun_consulting_agreement.webp` |
| `doyun_redacted_metrics` | 소지품 4 | 강도윤의 일부 행이 지워진 지표표 | `apps/murder-mystery/assets/clues/jeju-lab-conference/doyun_redacted_metrics.webp` |
| `minji_complaint_receipt` | 소지품 1 | 오민지의 인권센터 상담 접수증 | `apps/murder-mystery/assets/clues/jeju-lab-conference/minji_complaint_receipt.webp` |
| `minji_slide_revision` | 소지품 2 | 오민지의 가명처리 슬라이드 비교본 | `apps/murder-mystery/assets/clues/jeju-lab-conference/minji_slide_revision.webp` |
| `minji_call_log` | 소지품 3 | 오민지의 23시 통화 목록 | `apps/murder-mystery/assets/clues/jeju-lab-conference/minji_call_log.webp` |
| `minji_unsent_speech` | 소지품 4 | 오민지의 미발송 면담 요청문 | `apps/murder-mystery/assets/clues/jeju-lab-conference/minji_unsent_speech.webp` |
| `sion_resume_draft` | 소지품 1 | 박시온의 붉은 수정이 많은 이력서 | `apps/murder-mystery/assets/clues/jeju-lab-conference/sion_resume_draft.webp` |
| `sion_recruiter_card` | 소지품 2 | 박시온의 산업체 채용 담당자 명함 | `apps/murder-mystery/assets/clues/jeju-lab-conference/sion_recruiter_card.webp` |
| `sion_family_call` | 소지품 3 | 박시온의 가족과의 통화 기록 | `apps/murder-mystery/assets/clues/jeju-lab-conference/sion_family_call.webp` |
| `sion_poster_loan` | 소지품 4 | 박시온의 장비 대여 쪽지 | `apps/murder-mystery/assets/clues/jeju-lab-conference/sion_poster_loan.webp` |
| `yuna_video_edit_sheet` | 소지품 1 | 최유나의 18:42 편집 작업 목록 | `apps/murder-mystery/assets/clues/jeju-lab-conference/yuna_video_edit_sheet.webp` |
| `yuna_slide_markups` | 소지품 2 | 최유나의 교수의 붉은 도표 수정 지시 | `apps/murder-mystery/assets/clues/jeju-lab-conference/yuna_slide_markups.webp` |
| `yuna_reimbursement_slip` | 소지품 3 | 최유나의 지급 보류 통지 | `apps/murder-mystery/assets/clues/jeju-lab-conference/yuna_reimbursement_slip.webp` |
| `yuna_sketchbook` | 소지품 4 | 최유나의 학부연구생 이름 누락 초안 | `apps/murder-mystery/assets/clues/jeju-lab-conference/yuna_sketchbook.webp` |
| `jiwoo_overseas_plan` | 소지품 1 | 한지우의 해외 박사 지원 일정표 | `apps/murder-mystery/assets/clues/jeju-lab-conference/jiwoo_overseas_plan.webp` |
| `jiwoo_model_notebook` | 소지품 2 | 한지우의 원본 평가 실험 노트 | `apps/murder-mystery/assets/clues/jeju-lab-conference/jiwoo_model_notebook.webp` |
| `jiwoo_alumni_contact` | 소지품 3 | 한지우의 선배 연구자 연락처 | `apps/murder-mystery/assets/clues/jeju-lab-conference/jiwoo_alumni_contact.webp` |
| `jiwoo_hallway_sketch` | 소지품 4 | 한지우의 복도 목격 스케치 | `apps/murder-mystery/assets/clues/jeju-lab-conference/jiwoo_hallway_sketch.webp` |
| `haerim_expense_ledger` | 소지품 1 | 정해림의 학회 경비 대조표 | `apps/murder-mystery/assets/clues/jeju-lab-conference/haerim_expense_ledger.webp` |
| `haerim_m02_return` | 소지품 2 | 정해림의 M02 반납 기록표 | `apps/murder-mystery/assets/clues/jeju-lab-conference/haerim_m02_return.webp` |
| `haerim_personal_receipt` | 소지품 3 | 정해림의 교수 개인 카드 결제 영수증 | `apps/murder-mystery/assets/clues/jeju-lab-conference/haerim_personal_receipt.webp` |
| `haerim_audit_draft` | 소지품 4 | 정해림의 미제출 비용 부정 의혹 보고 | `apps/murder-mystery/assets/clues/jeju-lab-conference/haerim_audit_draft.webp` |
| `lobby_checkin` | 현장 1 | 펜션 객실 배정과 입실 대장 | `apps/murder-mystery/assets/clues/jeju-lab-conference/lobby_checkin.webp` |
| `lobby_safety_envelope` | 현장 2 | 객실 봉인·현장 보존용 키 봉투 | `apps/murder-mystery/assets/clues/jeju-lab-conference/lobby_safety_envelope.webp` |
| `lobby_private_expense` | 현장 3 | 교수 개인 선지출 내역 | `apps/murder-mystery/assets/clues/jeju-lab-conference/lobby_private_expense.webp` |
| `dinner_placecard` | 현장 1 | 둘째 날 저녁 식사 명단 | `apps/murder-mystery/assets/clues/jeju-lab-conference/dinner_placecard.webp` |
| `dinner_award_photo` | 현장 2 | 현무암 학회 기념 상패 사진 | `apps/murder-mystery/assets/clues/jeju-lab-conference/dinner_award_photo.webp` |
| `dinner_empty_shelf` | 현장 3 | 상패가 사라진 진열대 | `apps/murder-mystery/assets/clues/jeju-lab-conference/dinner_empty_shelf.webp` |
| `kitchen_clock` | 현장 1 | 주방 조리 기기의 시각 기록 | `apps/murder-mystery/assets/clues/jeju-lab-conference/kitchen_clock.webp` |
| `kitchen_washcloth` | 현장 2 | 세탁함의 검은 점이 묻은 수건 | `apps/murder-mystery/assets/clues/jeju-lab-conference/kitchen_washcloth.webp` |
| `lounge_group_post` | 현장 1 | 단체 채팅방 23:18 동영상 게시 | `apps/murder-mystery/assets/clues/jeju-lab-conference/lounge_group_post.webp` |
| `lounge_conference_program` | 현장 2 | 학회 공식 프로그램과 참가자 공지 | `apps/murder-mystery/assets/clues/jeju-lab-conference/lounge_conference_program.webp` |
| `lounge_scheduled_message` | 현장 3 | 공용 세미나실 게시 예약 화면 | `apps/murder-mystery/assets/clues/jeju-lab-conference/lounge_scheduled_message.webp` |
| `prof_scene_sketch` | 현장 1 | 교수 객실 초기 현장 사진 | `apps/murder-mystery/assets/clues/jeju-lab-conference/prof_scene_sketch.webp` |
| `prof_watch_reading` | 현장 2 | 교수의 손목 시계 활동 기록 | `apps/murder-mystery/assets/clues/jeju-lab-conference/prof_watch_reading.webp` |
| `prof_protection_memo` | 현장 3 | 교수의 비공개 학생별 지원 메모 | `apps/murder-mystery/assets/clues/jeju-lab-conference/prof_protection_memo.webp` |
| `prof_corrected_draft` | 현장 4 | 제출 전 연구 성과 정정 초안 | `apps/murder-mystery/assets/clues/jeju-lab-conference/prof_corrected_draft.webp` |
| `bedroom_names` | 현장 1 | 학생 객실 배치표 | `apps/murder-mystery/assets/clues/jeju-lab-conference/bedroom_names.webp` |
| `bedroom_phone_history` | 현장 2 | 학생 객실 통화 내역 화면 | `apps/murder-mystery/assets/clues/jeju-lab-conference/bedroom_phone_history.webp` |
| `bedroom_alumni_email` | 현장 3 | 해외 박사 선배의 답신 출력물 | `apps/murder-mystery/assets/clues/jeju-lab-conference/bedroom_alumni_email.webp` |
| `terrace_rain_gauge` | 현장 1 | 테라스 빗물 측정 용기 | `apps/murder-mystery/assets/clues/jeju-lab-conference/terrace_rain_gauge.webp` |
| `terrace_sliding_door` | 현장 2 | 테라스 미닫이문의 걸쇠 사진 | `apps/murder-mystery/assets/clues/jeju-lab-conference/terrace_sliding_door.webp` |
| `terrace_lights` | 현장 3 | 복도 조명 감지 기록 | `apps/murder-mystery/assets/clues/jeju-lab-conference/terrace_lights.webp` |
| `utility_m02_register` | 현장 1 | 관리용 카드 M02 보관표 | `apps/murder-mystery/assets/clues/jeju-lab-conference/utility_m02_register.webp` |
| `utility_suitelog` | 현장 2 | 교수 객실 전자잠금 장치 기록 | `apps/murder-mystery/assets/clues/jeju-lab-conference/utility_suitelog.webp` |
| `utility_keyloop` | 현장 3 | M02 카드 보관 사진 | `apps/murder-mystery/assets/clues/jeju-lab-conference/utility_keyloop.webp` |
| `print_job_log` | 현장 1 | 정윤석 계정의 출력 대기표 | `apps/murder-mystery/assets/clues/jeju-lab-conference/print_job_log.webp` |
| `print_credit_plan` | 현장 2 | 연구실 공저자·취업 추천 명단 초안 | `apps/murder-mystery/assets/clues/jeju-lab-conference/print_credit_plan.webp` |
| `print_margin_note` | 현장 3 | 인쇄 문서 귀퉁이 필기 | `apps/murder-mystery/assets/clues/jeju-lab-conference/print_margin_note.webp` |
| `annex_runner_history` | 현장 1 | 공용 평가 프로그램 실행 이력 | `apps/murder-mystery/assets/clues/jeju-lab-conference/annex_runner_history.webp` |
| `annex_qa_original` | 현장 2 | Q&A 영상 원본 파일 속성 | `apps/murder-mystery/assets/clues/jeju-lab-conference/annex_qa_original.webp` |
| `annex_eval_manifest` | 현장 3 | 평가 원본·발표본 해시 대조표 | `apps/murder-mystery/assets/clues/jeju-lab-conference/annex_eval_manifest.webp` |
| `store_props` | 현장 1 | 장비 반입·반출 기록 사진 | `apps/murder-mystery/assets/clues/jeju-lab-conference/store_props.webp` |
| `store_stone_chip` | 현장 2 | 현무암 상패 파편 보관 봉투 | `apps/murder-mystery/assets/clues/jeju-lab-conference/store_stone_chip.webp` |
| `store_poster_fiber` | 현장 3 | 포스터 통 보관칸 사진 | `apps/murder-mystery/assets/clues/jeju-lab-conference/store_poster_fiber.webp` |
| `parking_shuttle` | 현장 1 | 학회 셔틀 시간표 | `apps/murder-mystery/assets/clues/jeju-lab-conference/parking_shuttle.webp` |
| `parking_entry_image` | 현장 2 | 23시 주차장 카메라 정지 화면 | `apps/murder-mystery/assets/clues/jeju-lab-conference/parking_entry_image.webp` |
| `parking_wifi_record` | 현장 3 | 별관 무선 접속 기록 | `apps/murder-mystery/assets/clues/jeju-lab-conference/parking_wifi_record.webp` |

## 지도 장식 오브젝트 (총 12개, 추가 제작은 선택)

현재 이 항목들은 `icon`과 `kind`의 기본 이모지로 표시되고 있어서 게임 플레이에는 영향이 없습니다.

| 층/오브젝트 ID | 오브젝트 | 종류 |
|---|---|---|
| `ground/ground_lobby_desk` | 체크인 서류가 놓인 프런트 | desk |
| `ground/ground_award` | 작은 현무암 상패 진열대 | statue |
| `ground/ground_table` | 세미나실 공동 테이블 | table |
| `ground/ground_kitchen` | 식기 건조대 | sink |
| `upper/upper_prof_table` | 교수 객실 원목 책상 | desk |
| `upper/upper_suitcase` | 학생 공용 가방 보관함 | cabinet |
| `upper/upper_weather` | 테라스 강우량 용기 | plant |
| `upper/upper_keycabinet` | M02 관리용 카드 보관함 | cabinet |
| `annex/annex_printer` | 공용 흑백 복합기 | printer |
| `annex/annex_laptop` | Q&A 영상 전송 노트북 | pc |
| `annex/annex_storage` | 도구 점검 선반 | shelf |
| `annex/annex_parking` | 출입구 방향 차량 카메라 | camera |

## 지도와 사건 연출

- 본관 1층 `ground`: 로비/식당/주방/공동 세미나실
- 본관 2층 `upper`: 봉인된 교수 객실/학생 객실/테라스/관리실
- 부속 관리동 `annex`: 문서실/공용 연구 장비실/도구 보관실/주차장 기록실
- 봉인 객실은 출입 카드 해금 전 내부 방 이름과 장식물이 숨겨집니다. **아트와 맵 라벨도 이 비밀 공개 규칙을 지켜야 합니다.**
