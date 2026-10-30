# Railway 무료 플랜 배포 가이드

현재 앱은 **단일 Node.js 서버**다. Terraforming Mars와 Murder Mystery를 각각 따로 배포하지 않는다. 저장소 루트의 `Dockerfile`이 Node.js 22 이미지를 만들고 `node server.js`를 실행한다. `npm install`이나 외부 데이터베이스는 필요하지 않다.

## 1. Railway에서 GitHub 레포 연결

1. [Railway 대시보드](https://railway.com/new) → **New Project → Deploy from GitHub repo**.
2. GitHub 연결 권한에서 `rice-eaters-3/rice-eaters` 저장소 접근을 허용한다.
3. `rice-eaters-3/rice-eaters`를 선택한다.
4. **Source branch: main**, **Root Directory: /** (저장소 루트)로 둔다.
5. 새 서비스라면 **Deploy Now**, 기존 서비스가 있다면 해당 서비스의 **Settings → Source**에서 GitHub 레포/브랜치를 확인한 뒤 Redeploy 한다.
6. 빌드 로그에 **Using detected Dockerfile** 메시지가 보여야 한다. 배포 로그에는 `Rice Eaters: http://localhost:3000 (host 0.0.0.0)` 같은 로그가 나타난다. Railway의 PORT 환경변수가 지정돼 있으면 로그의 포트는 달라질 수 있다.

## 2. 저장 데이터 보존 (친구들과 플레이하기 전에 필수)

방/참가자/화성 기록은 파일로 저장되므로 저장 볼륨을 추가한다.

1. 프로젝트 Canvas에서 **Add Volume**을 선택해 위 Node 서비스에 연결한다.
2. **Mount Path: `/data`**로 지정한다.
3. 별도 환경변수를 추가하지 않아도 서버는 Railway에서 제공하는 `RAILWAY_VOLUME_MOUNT_PATH`를 자동으로 사용한다. 수동 설정이 필요하다면 서비스 **Variables**에 `DATA_DIR=/data`를 넣는다.
4. 볼륨이 붙은 상태에서 한 번 재배포한다. 파일은 `/data/state.json`과 `/data/activity.jsonl`로 저장된다.

Railway Free 플랜의 볼륨은 기본 0.5GB, 프로젝트당 1개까지 사용할 수 있다. 볼륨이 없는 상태에서 생긴 방/게임 기록은 새 배포 때 소실될 수 있다.

## 3. 공개 HTTPS 주소 발급

1. 서비스 **Settings → Networking → Public Networking → Generate Domain** 클릭.
2. 발급된 `https://....up.railway.app` 주소로 접속한다.
3. `/healthz`는 `{"ok":true}`, `/mystery`는 머더 미스터리, `/mars`는 화성 게임이어야 한다.
4. 서비스 **Settings → Healthcheck Path**를 **`/healthz`**로 설정하면 배포 시작 시 정상 응답을 점검할 수 있다.
5. 4명의 친구에게 `https://...up.railway.app/mystery` 주소를 공유한다. 방장은 방 생성 후 6자리 코드를 보내면 된다.

## 배포 실패 시 확인

| 증상 | 확인 사항 |
| --- | --- |
| `Cannot find module '/app/server.js'` | Root Directory가 앱 하위 폴더가 아닌 **저장소 루트**인지 확인 |
| Node 서버가 바로 종료됨 | Deploy 로그 확인, Start Command에 `node server.js`가 지정됐는지 확인 |
| 502 / Application failed to respond | `PORT`를 임의로 고정하지 않았는지, **Public Domain target port**가 서버의 실제 리스닝 포트와 일치하는지 확인 |
| 저장 내용이 재배포 후 초기화됨 | Volume이 정확히 같은 서비스의 `/data`에 붙어 있는지 확인 |
| GitHub 저장소가 Railway에 보이지 않음 | GitHub → Settings → Applications → Railway의 저장소 접근 권한 확인 |
| Free 플랜 배포가 중단됨 | Workspace의 Usage 및 크레딧 한도 확인 |

**운영 범위:** 10명 이내 테스트를 위한 프로토타입. 공개 주소는 누구나 열 수 있으므로 개인 식별 정보나 실제 비밀 자료를 올리지 않는 것이 좋다. 현재는 게임 방 코드만 있으며 사이트 전체 인증, 요청 제한, 다중 서버 간 파일 동기화는 아직 없다. 운영 시 서버 인스턴스는 **1개**로 유지한다.

공식 문서: [Dockerfile 빌드](https://docs.railway.com/builds/dockerfiles) · [볼륨](https://docs.railway.com/volumes) · [공개 도메인](https://docs.railway.com/networking/public-networking) · [Healthchecks](https://docs.railway.com/deployments/healthchecks).
