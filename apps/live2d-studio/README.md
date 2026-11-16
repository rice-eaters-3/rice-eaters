# 모션 아틀리에

기존 Node 서버에서 `/live2d`를 엽니다. 별도 npm 의존성은 없습니다.

## 생성과 연결

웹 화면의 **AI API 연결**에서 OpenAI 이미지 API 키와 모델 ID를 입력합니다. 기본 모델은 `gpt-image-2.5-flare`이며, 운영자가 `.env`의 `LIVE2D_IMAGE_MODEL`로 변경할 수 있습니다. 연결 시 `/models/{id}`로 접근 권한을 검사합니다. 생성 시 `/images/generations`를 한 번 호출해 **16파츠 투명 PNG 아틀라스**를 받습니다. `background: transparent`, `output_format: png`, `b64_json` 응답이 필요합니다. 권한·잔액·투명 PNG 지원 여부는 실제 사용 계정과 모델에 따라 달라집니다.

호환 API를 운영하는 경우 `.env`에 `LIVE2D_AI_BASE_URL=https://example.com/v1`을 설정합니다. 브라우저에서 임의 서버 주소를 받지 않습니다. 실제 연결 주소는 키 입력 화면에 표시합니다. 키는 서버 메모리에서 세션별로 1시간 보관하고, 연결 해제·서버 재시작 시 삭제합니다. 진행 중인 호출은 연결 해제로 취소되지 않습니다. 브라우저 저장소·프로젝트·ZIP에는 키를 넣지 않습니다. 외부 접속 시 HTTPS가 필요합니다.

작업은 세션 쿠키로 분리하며 `DATA_DIR/live2d/<session-hash>/<job-id>`에 저장합니다. 같은 브라우저 세션에서 새로고침해도 작업 결과를 불러옵니다. 쿠키를 삭제하면 기존 결과에 접근할 수 없습니다. 생성은 세션당 1개, 서버 전체 2개 동시 실행, 세션당 20개 저장으로 제한합니다. 프롬프트와 생성 결과는 서버에 저장되며, 서버 운영자는 이 파일에 접근할 수 있습니다.

## 실제 생성 범위

아틀라스의 각 셀에서 알파 영역을 분석하고 16개 독립 메시를 조립합니다. JS 바이너리 작성기가 실제 Cubism 4.0 호환 `.moc3`를 생성합니다. 파라미터 키폼에 정점 변형·불투명도를 기록하며, 고개 XYZ·눈 깜빡임·눈썹·입 벌리기·입 모양·몸 회전·호흡·머리카락의 **13개 파라미터**를 제공합니다. PNG를 `.moc3`로 이름만 바꾸지 않습니다.

브라우저는 Purism Core에서 모델을 평가한 좌표를 WebGL로 그립니다. 모델·물리 파일은 ZIP 안에 포함됩니다. 브라우저의 자동 움직임은 미리보기용 파라미터 드라이버이며 VTube Studio의 카메라 추적과 동일한 알고리즘은 아닙니다. VTube Studio에서는 자체 추적·물리 런타임을 사용합니다.

자동 리깅 **초안**으로, 파츠의 비율·경계·눈 감김 모양 등은 수작업 수준에 미치지 못할 수 있습니다. 파츠 배치를 수정하고 MOC3를 다시 생성할 수 있습니다. 독립 눈동자, 깊은 3D 회전, 손·전신 리깅, 클리핑 마스크, PSD·Cubism Editor `.cmo3`는 포함하지 않습니다. AI가 4×4 파츠 배치를 지키지 못하면 실패 또는 조립 오류가 발생할 수 있습니다. 투명 배경·빈 파츠·런타임 검증 실패는 성공으로 표시하지 않습니다.

## 내보내기와 검증

ZIP에는 `.moc3`, `.model3.json`, `.physics3.json`, `.cdi3.json`, 표정, 텍스처, `project.json`, 런타임 검증 결과가 포함됩니다. 압축을 풀어 모델 폴더 전체를 VTube Studio의 `Live2DModels`에 복사하고 자동 설정을 실행합니다. `.vtube.json`은 VTube Studio가 직접 만듭니다.

샘플 **Lumi / 루미**는 이 앱을 위해 생성한 오리지널 캐릭터입니다. 16파츠 중 중복 리본을 숨겨 15메시를 표시합니다. Purism Core와 공식 Cubism Core 5.1에서 `.moc3`를 읽고 모든 파라미터의 정점·불투명도 반응을 확인했습니다. 공식 Core는 검증 환경에서만 사용하며 재배포하지 않습니다. **Steam VTube Studio 실행 테스트는 미실시**입니다. 사용자 API 키를 사용한 유료 이미지 호출도 자동 테스트에 포함하지 않습니다. 테스트는 이미지 API 응답을 모의하고 그 이후 실제 컴파일·런타임·ZIP·세션 분리를 검증합니다.

`node --test tests/live2d.test.cjs` / CI Chrome: `node tests/live2d-browser.cjs`

## 출처 및 라이선스

- 바이너리 작성기: [henceketh/live2d-autorig-claude](https://github.com/henceketh/live2d-autorig-claude), commit `9c21423559cd4dafebf4c4304f1b2dacdd9f7d31`, MIT. 레이아웃 테이블과 작성기 설계를 JS로 옮겼습니다. `private/live2d/MOC_WRITER_LICENSE.txt`를 참조하세요.
- 웹 런타임: [SakuraMotion/PurismCore](https://github.com/SakuraMotion/PurismCore), v1.1.0, MIT. `vendor/PURISM_LICENSE.txt`를 참조하세요. Live2D사의 공식 SDK가 아닙니다.
- Lumi 아틀라스: 이 프로젝트용 AI 생성. BOOTH·크몽 판매자의 이미지나 모델을 복제하지 않았습니다.
- [VTube Studio 공식 모델 불러오기 안내](https://github.com/DenchiSoft/VTubeStudio/wiki/Loading-your-own-Models).


## 시즈쿠·하루토 Live2D 리워크

`/live2d?sample=shizuku`, `/live2d?sample=haruto`에서 두 캐릭터를 바로 엽니다. 샘플 선택 메뉴에서도 전환할 수 있고, API 연결 없이 모델을 조작·다운로드할 수 있습니다. 시즈쿠는 긴 헝클어진 머리·안경·회색 트레이닝복의 성인 여성, 하루토는 올린 머리·탄탄한 체격·단정한 교복의 성인 남성 디자인입니다.

원화를 참조해 새 투명 파츠 아틀라스를 제작했습니다. 얼굴·귀·코·머리카락을 하나의 일관된 원화 메시로 유지하고, 눈을 뜬 파츠와 감은 파츠·눈썹·입을 분리했습니다. 전체 머리 변형을 공유하므로 얼굴 파츠를 서로 다른 방식으로 움직이지 않습니다. 머리카락 변형은 얼굴 영역 밖에 적용하며, 몸은 목 아래에 움직임을 배치합니다. 남자 캐릭터의 목 중복을 줄이기 위해 머리 메시의 아래 경계를 턱 윤곽에 맞춥니다. 여자 캐릭터는 긴 머리 안의 얼굴·목 비율을 맞추는 세로 좌표 매핑을 사용합니다.

각 모델은 12개 원화 셀 중 10개 메시를 사용하며, 실제 MOC3에 13개 파라미터를 기록합니다. 프로젝트 형식은 `rice-live2d-portrait-v2`입니다. 이 두 샘플의 배치는 읽기 전용이고 기존 16파츠 AI 생성기의 배치 편집 경로를 바꾸지 않습니다. 깊은 3D 회전·독립 눈동자·손 리깅은 포함하지 않습니다. 작은 고개 움직임과 깜빡임·말하기·호흡용 모델입니다.

`node scripts/build-live2d-samples.cjs <ZIP출력폴더>`로 아틀라스에서 모델을 다시 생성합니다. 검증용 공식 Core가 로컬에 있는 경우에만 `LIVE2D_QA_CORE_PATH`를 설정해 추가 검증할 수 있습니다. 공식 Core 파일 자체는 저장소나 ZIP에 재배포하지 않습니다. 현재 모델 2종 모두 공식 Cubism Core 5.1에서 파일 로딩과 13개 파라미터 반응을 검증했습니다. **Steam VTube Studio 직접 실행·카메라 추적 테스트는 미실시**입니다.
