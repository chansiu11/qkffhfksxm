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

## 2D 무기 / 조준 / 피격 화면
- **X**: 조준 가능한 무기에서 확대 조준(토글). 기존 마우스 오른쪽 버튼·모바일 ADS 버튼도 사용 가능.
- 우측에 보이는 무기는 3D 모델 대신 2D 이미지 스프라이트로 표시합니다. 달리기·발사·장전·조준·칼 휘두르기 시 이미지의 위치/원근이 달라집니다.
- AI와 온라인 상대에게 피격되면 화면 가장자리가 잠깐 붉게 변합니다.

## 2.5D 컷아웃 무기 시점 개선
- 총구가 화면 중앙 방향을 향하고 총몸이 오른쪽 아래에 놓이도록 2D 이미지를 CSS 3D 원근 변형해 표시합니다. 실제 3D 무기 메시를 만들지는 않습니다.
- 각 총과 칼은 사용자 제공 참고 이미지(254×787)에서 따로 분리해 만든 투명 WEBP 파일을 사용하며, 장갑/소매는 별도 SVG로 겹쳐집니다.
- 소총은 화면 중앙을 향하게 기울이고 권총·칼은 각기 다른 각도를 사용합니다. PC/모바일에 맞게 위치와 크기를 조정합니다.
- 사격 반동·달리기 흔들림·재장전·줌 애니메이션은 기존 구현과 연결되어 있습니다.
- 무기 그림은 사용자가 직접 이 대화에서 제공한 참고 이미지를 재가공한 것입니다. 다른 사이트에서 게임 리소스를 다운로드하거나 추가하지 않았습니다.
- 확인: `node --test tests/viewmodel.test.js` 및 `python tests/viewmodel_ui_test.py`.


## 산탄총 표현 · 장전 동기화 · 조준점 코드

- **Shorty(8), Bucky(10), Judge(8)**는 한 번의 게임 내 발사에 각각 여러 개의 보이는 탄 궤적을 그립니다. 발사당 온라인 메시지는 한 개만 보내 통신량 증가를 제한합니다.
- 장전 도중 무기 슬롯을 변경하면 이전 장전이 취소되며, 서버가 보내는 탄약 정보는 해당 무기에만 반영됩니다.
- 메인 화면의 **조준점 코드 설정** 또는 게임 HUD 상단의 **CROSSHAIR [P]** 버튼을 누르면 발로란트 공유 조준점 코드 `0;P;...`를 그대로 입력할 수 있습니다.
- 프로필 색상/커스텀 색상, 외곽선, 중앙점, 안쪽·바깥쪽 선, 간격과 투명도, ADS용 코드를 읽어 화면에 표시합니다. 이동·발사 오차 설정도 간단하게 표현합니다. 게임의 실제 명중 방향은 조준점 코드가 바뀌어도 화면 중앙으로 유지됩니다.
- 현재는 표준 코드의 **시각적 주요 항목**을 해석하며, 발로란트 내부 렌더러의 모든 특수 옵션과 픽셀 수준까지 동일하다고 보장하지 않습니다. 프로필 문자열은 현재 브라우저의 localStorage에 저장됩니다.
- 무기 이미지: `assets/weapons/*.webp` 18개. 현재 게임의 무기 중 16개(칼 포함)는 첨부 이미지에서 따로 추출한 스프라이트를 사용합니다. 참조 이미지에 없는 Outlaw는 기존 전용 SVG를 유지하며, 이미지에만 있는 Ares/Odin 파일은 향후 무기 슬롯을 위해 포함했습니다. 원본 이미지가 작아 확대 시 선명도가 제한될 수 있습니다.
- `node --test tests/*.test.js`로 네트워크, 산탄총 궤적, 장전 상태, 조준점 파서를 함께 검사합니다.
- Render 무료 서버 사용 중에는 실제 RTT를 **100ms 이하로 보장할 수 없습니다**. 동일 상태 이동 패킷을 생략하고, 상태 스냅샷을 방 단위 한 번만 직렬화합니다.

### 무기 이미지 출처와 사용 제한

참조 이미지 `1602.jpg`(사용자가 채팅으로 제공)를 개별 크롭, 배경 제거 후 WEBP로 변환했습니다. 이 그림은 사용자 제공 이미지에 기반하며 출처 게임의 원본 파일을 별도로 수집하지 않았습니다.

### 2026-11-23 Instant line tracer update

- All guns, shotguns (each pellet), AI, and online players use the same instant visual tracer.
- Tracers render as thin straight `THREE.Line` segments from shot origin to hit endpoint; there is no flying bullet geometry or travel-time animation.
- Lines fade over 0.13s. Real hit detection was already immediate and remains unchanged.
- Run `node --test tests/*.test.js` to verify effects and multiplayer regressions.

## 명중 판정·재장전 안정화 (2026-11-23)

- 온라인 상대의 머리/몸 판정은 화면에 보이는 Three.js 머리/몸 상자 모델의 크기 및 회전에 맞춰 처리합니다. 머리 상자의 가장자리와 몸통 하단도 서버에서 판정합니다.
- 서버는 최근 750ms의 플레이어 위치 기록을 유지하고, 발사 클라이언트가 실제로 보던 보간 스냅샷 시각으로 적 위치를 **최대 320ms**까지 되돌려 검사합니다. 벽/장애물 판정은 현재 서버 상태를 기준으로 유지합니다. 이 보정은 네트워크 지연에 따른 시각적 불일치를 줄이지만, 패킷 손실이나 무기별 피해량을 무시해 무조건 명중시키는 기능은 아닙니다.
- 클라이언트는 발사 시점의 좌표/조준 방향을 위치 패킷과 함께 서버에 전송합니다. 서버는 비정상적으로 멀리 떨어진 발사 원점은 인정하지 않습니다.
- 온라인 재장전은 `reload_started`, `reload_done`, `reload_cancelled`로 상태를 구분해 처리합니다. 단순 장비/탄약 패킷으로 장전 모션이 중간에 취소되지 않게 했고, 장전 완료 시 서버 탄약량을 해당 무기에 동기화합니다. 탄약이 0발인 상태에서 발사를 시도하면 장전을 시작합니다.
- 오퍼레이터는 몸통 150 기본 피해량을 유지하며 체력 100 + 방어구 50인 상대의 몸통 명중 시에도 한 발 처치가 되도록 서버 테스트를 추가했습니다. 일반 무기의 모든 머리 공격이 항상 한 발 처치인 것은 아니며 무기별 `headDmg`을 유지합니다.
- 검증: `node --test tests/*.test.js` (27 tests). 온라인 다중 기기의 실제 회선 RTT와 3D 렌더링 정확도는 별도 실측이 필요합니다.

## 온라인 장전 잠금 및 근거리 게임 액션 수정

- `R` 버튼 입력은 서버에 요청 ID와 함께 전송됩니다. 서버가 다른 무기를 장착한 상태로 요청을 거절한 경우에도 클라이언트의 잠금이 해제됩니다.
- `reload_started` / `reload_done` / `reload_cancelled`와 10Hz 서버 상태 스냅샷을 함께 이용해, 완료 이벤트가 사라진 경우에도 장전 잠금이 영구적으로 남지 않도록 했습니다.
- 총별 이미지 장전 모션은 `viewmodel.isReloading` 상태를 확인한 뒤 시작해 매 스냅샷마다 모션이 재시작되지 않도록 했습니다.
- 가상 게임 칼: 좌클릭(빠른 공격) 50, 우클릭(강공격) 75, 게임 속 후방 보너스 2배. 빠른 공격은 더 넓고 긴 판정, 강공격은 좁고 짧은 판정입니다. 게임 월드의 칼 판정은 총알 레이캐스트와 분리되었으며 가까운 시야 내 한 명에게만 적용되고 벽을 통과하지 않습니다.
- 모바일 칼 사용 시 오른쪽 발사 버튼은 강공격, 왼쪽은 빠른 공격으로 동작합니다. 다른 무기의 오른쪽 클릭은 종전처럼 줌 동작을 유지합니다.
- `node --test tests/*.test.js`를 실행해 장전 실패·복구 및 근접 게임 판정 통합 테스트를 확인할 수 있습니다.