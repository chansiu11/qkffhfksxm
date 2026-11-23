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

## 모바일 조작 및 사격 (2026-11-17)

- 왼쪽 화면 절반 어디든 터치하면 해당 위치에 이동 조이스틱이 나타납니다. 손을 떼면 조이스틱이 사라집니다.
- 오른쪽 화면 절반은 손가락을 드래그하여 시점을 회전합니다.
- 오른쪽 FIRE 버튼을 누른 상태에서 드래그하면 조준할 수 있습니다. 단발 무기는 손을 떼는 순간 한 발 발사하고, 자동 무기는 누르고 있는 동안 연사합니다. 왼쪽 L-FIRE도 단발은 손을 뗄 때 발사합니다. PC 마우스 왼쪽 버튼도 같은 방식입니다.
- 무기 사거리를 확장하고, 충돌물 앞까지 보이는 이동형 탄도 이펙트를 추가했습니다. 서버가 다른 참가자에게 발사 정보를 전달합니다.
- 적 캐릭터에 노란색 외곽선을 추가하되 벽 뒤에서는 보이지 않도록 깊이 테스트를 유지합니다. 이동 시 탄퍼짐이 완화됩니다.

검증: `node --test tests/smoke.test.js` (서버에서 발사 경로가 다른 참가자에게 전달되는지 포함). 선택적 UI 검증: Playwright 설치 후 `python tests/gesture_smoke.py`.

### Weapon viewmodels, reload animations and Spike fix

- `weapon-viewmodels.js` generates **17 distinct procedurally modeled** first-person
  weapon/knife meshes with unique silhouettes, accents and animated moving parts.
  All assets are made in code and require no external asset file downloads.
- Each firearm has its own reload motion for its moving magazine, slide, bolt,
  revolver cylinder, break-open breech or shotgun pump. The knife has an actual
  separate blade and a short swiping animation with **no gunshot, muzzle flash or tracer**.
- Attackers can plant at **A site, B PIT or elevated B MAIN**. Use **4 / F** or
  the on-screen SPIKE button, hold for 4 seconds. Defenders hold for 7 seconds;
  after 3.5 seconds, interruption preserves a halfway checkpoint.
- The online HUD displays server-confirmed plant/defuse progress. Reload completion
  still uses the existing 1.1-second inventory authority on Render.
- Test with `node --test tests/*.test.js`.

## Network stability and performance (2026-11-23)

- WebSocket ping/pong measures actual browser-to-server round-trip latency every 2.5 seconds; the in-game status shows **measured** PING (ms) and FPS, not a fixed target value.
- After a temporary disconnection the client retries automatically and can resume the same player identity, team, health and inventory in the existing room for **45 seconds**, as long as the server process is still running. Choosing to leave deliberately removes the player immediately.
- Player position updates are rate-limited and rounded; the server drops **outdated snapshots** for slow receivers instead of allowing an indefinitely growing TCP backlog. TCP keep-alives remain enabled.
- Browser rendering uses reduced shadow-map resolution, lower initial render pixel ratio on touchscreen devices, adaptive resolution, less frequent radar redraws, and fewer unnecessary DOM and geometry allocations. The game still uses the display's refresh rate via requestAnimationFrame.
- **Neither under-100 ms latency nor over-120 FPS can be guaranteed**: latency depends on the player's route to Render's Singapore region, and FPS depends on the device, refresh rate, graphics driver, load and browser. A 60-Hz screen generally cannot display 120 distinct frames per second. On Render Free, idle spin-downs and service restarts can interrupt matches; these erase memory-only rooms. A true always-on service and persistent room storage would be required to eliminate those cases.
- Validation: `node --test tests/*.test.js`, `python tests/keyboard_smoke.py`, `python tests/gesture_smoke.py`.