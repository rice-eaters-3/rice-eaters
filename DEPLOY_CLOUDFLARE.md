# Cloudflare 무료 공개 접속 (10명 이내 테스트)

이 앱은 Node.js HTTP 서버와 `data/state.json`을 사용하므로 **Cloudflare Pages에 HTML 파일만 올리면 게임이 작동하지 않습니다.** 가장 간단한 무료 방법은 **Cloudflare Quick Tunnel**입니다.

Cloudflare Quick Tunnel의 특징:
- Cloudflare 계정, 유료 플랜, 별도 도메인, 공유기 포트포워딩 불필요
- 자동으로 임시 `https://....trycloudflare.com` 주소 발급
- PC에서 실행 중인 Node.js 앱과 `cloudflared`를 외부로 연결
- **PC를 끄면 사이트가 접속되지 않음**, 터널을 다시 실행하면 주소가 변경됨
- Quick Tunnel은 **SSE를 지원하지 않기 때문에** 머더 미스터리는 이 주소에서 약 2.5초 간격의 HTTP 폴링으로 동기화
- 클라우드 서버를 24시간 호스팅하는 것과는 다름

## Windows에서 실행하기

1. [cloudflared 공식 다운로드](https://developers.cloudflare.com/tunnel/downloads/)에서 Windows 64-bit MSI를 설치합니다. 설치한 PowerShell/터미널을 다시 열고 `cloudflared --version`으로 확인합니다.
2. 첫 번째 PowerShell 창에서 프로젝트 경로로 이동하고 최신 코드를 받아 서버를 실행합니다:

   ```powershell
   git pull
   node server.js
   ```

   `Rice Eaters: http://localhost:3000` 로그가 나타나면 성공입니다.
3. **두 번째** PowerShell 창에서 다음을 실행합니다:

   ```powershell
   cloudflared tunnel --url http://localhost:3000
   ```

4. 로그에 표시되는 **`https://....trycloudflare.com`** URL을 복사해 다른 사람에게 공유합니다.
5. 메인 URL에 `/mystery`를 붙여 접속한 뒤 4명이 한 방에서 테스트합니다. 화성은 `/mars` 입니다.
6. 게임을 하는 동안 **두 터미널과 PC를 켜두세요.** 접속 주소가 바뀌면 새 링크를 보내면 됩니다.

`npm` 설치는 필요하지 않습니다. `node server.js`로 실행 가능합니다.

**주의:** Quick Tunnel은 시험용으로 가용성 보장이 없습니다. 한 번에 처리하는 요청 200개 제한이 있고 SSE가 지원되지 않습니다. 머더 미스터리에서는 자동 폴링을 쓰도록 변경해 이 제약을 피하지만 실제 외부 환경의 성능은 직접 확인해야 합니다.

## 공유하기 전 체크

- 먼저 `http://localhost:3000/healthz`에서 `{"ok":true}`인지 확인하세요.
- 발급된 HTTPS 주소에서 `/healthz`가 동일한 응답인지 확인하세요.
- 방장이 방을 만들고, 다른 브라우저 프로필 또는 친구 기기에서 각각 참가해 보세요.
- 마지막 참가자가 접속하고 약 2.5초 뒤 방장의 게임 시작 버튼이 활성화되는지 확인하세요.
- 4명이 모두 시놉시스 확인을 누르면 캐릭터 선택 단계로 넘어가는지 확인하세요.

## 보안: 친구들만 접속시키기

무료 Quick Tunnel의 공개 주소는 **링크를 아는 누구나 접근할 수 있습니다.** 개인 정보/진짜 비밀 문서/민감한 데이터는 넣지 마세요. Cloudflare 문서에 따르면 `--allowed-mail` 옵션으로 이메일 OTP 인증을 요구할 수 있습니다.

```powershell
cloudflared tunnel --url http://localhost:3000 --allowed-mail 'friend1@example.com,friend2@example.com'
```

예시 주소를 실제 허용할 친구 이메일 주소로 변경하세요. 해당 옵션이 자신의 `cloudflared` 버전에서 지원되는지 확인하세요. 앱의 6자리 방 코드는 사이트 접근 인증을 대체하지 않습니다.

## 안정적인 고정 도메인이 필요하다면

Cloudflare 계정과 **Cloudflare DNS에 등록된 도메인**이 있다면, [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/)에서 이름을 지정한 터널을 만들고 `https://mystery.example.com` 같은 공개 호스트명을 연결할 수 있습니다. 여기서도 현재 앱의 서버는 로컬 PC이므로 PC를 켜두어야 합니다.

**PC를 꺼도 24시간 열려 있는 사이트**를 원하는 경우 Cloudflare Tunnel이 아니라 Cloudflare Workers + Durable Objects 등으로 서버 구조를 다시 개발해야 합니다. 현재 Node.js 파일 저장 서버를 Cloudflare Workers에 그대로 올릴 수는 없습니다.

공식 문서: [Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) · [Cloudflare Tunnel 설정](https://developers.cloudflare.com/tunnel/get-started/) · [Windows 설치](https://developers.cloudflare.com/tunnel/downloads/)
