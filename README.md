# qkffhfksxm — 브라우저 3D FPS + Render 실시간 멀티플레이

첨부된 Three.js 기반 3D FPS 코드를 바탕으로 만든 온라인 플레이 베이스입니다.

- **클라이언트**: GitHub Pages, `https://chansiu11.github.io/qkffhfksxm/`
- **실시간 서버**: Render Node Web Service, `qkffhfksxm-realtime`
- **온라인**: 2자리 사설방 코드, 최대 10명/방, 공격/수비, 실시간 위치·시선·HP·무기·사망·라운드 동기화, 서버 판정 사격, 스파이크
- **오프라인**: 기존 QUICK START AI 게임 그대로 유지
- **기본 보안**: 서버가 처치/점수/라운드/구매를 승인, 사거리·발사 주기·위치 변화 제한, 맵 장애물을 통한 시선 판정, 웹 Origin 제한

## 배포

1. GitHub 저장소 `chansiu11/qkffhfksxm`의 **Settings → Pages → Build and deployment**에서 `Deploy from a branch`, `main` / `(root)`를 선택합니다.
2. Render에서 이 저장소를 연결한 **Web Service**를 생성합니다. `render.yaml`을 이용한 Blueprint 배포도 가능합니다. `Node`, 리전 `Singapore`, 실행 명령 `node server/server.js`를 설정합니다.
3. Render에서 부여된 실제 서비스 URL이 `config.js`의 `window.GAME_SERVER_URL` 값과 다르면 그 값을 수정합니다. URL에는 `/ws`를 추가하지 않습니다.
4. 서로 다른 기기에서 GitHub Pages 게임에 접속해, 한 명이 **CREATE ROOM**, 다른 한 명이 같은 2자리 코드로 **JOIN ROOM**을 누릅니다. 방장만 온라인 경기를 시작할 수 있습니다.

### 로컬 실행

```bash
node server/server.js
# another terminal: python -m http.server 8080
```

로컬에서 플레이하려면 `config.js` URL을 `http://localhost:10000`으로 바꾸고 브라우저 `http://localhost:8080`으로 접속합니다. `GET /health`는 서버의 온라인 상태를 반환합니다. Node.js 20+ 권장.

## 현재 범위와 후속 작업

이 버전은 **실시간 멀티플레이를 처음 연결하는 기본 단계**입니다. 기존의 화면·조작과 오프라인 AI는 유지하지만 온라인에서는 AI를 생성하지 않습니다. 온라인은 단일 Render 인스턴스의 메모리에 방을 저장하므로 서버가 재시작하면 진행 중인 방이 초기화됩니다. 경쟁전 수준의 보안/렉 보정/지속 저장은 별도 작업입니다. 원작 게임 에셋을 배포하지 않고, 첨부된 코드 기반 자체 기하 모델을 사용합니다.