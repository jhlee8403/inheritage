# Edge 104 PDF 호환 자원 (개발용)

선택: 공식 `pdfjs-dist@4.2.67`의 **legacy main + legacy worker**. 같은 버전으로 고정한다. 공식 v4.2.67 gulpfile의 Babel 대상은 Chrome >=98이며, 실제 격리 Chromium 104.0.5112.48에서 통합 25개를 검증했다. 정확한 회사 Windows Edge 104.0.1293.47은 NOT_RUN이다. 현재 최신 PDF.js가 아니므로 업무용 보안·유지보수 승인을 뜻하지 않는다.

원본 6.4.299 modern/legacy 비교·추가 표준 보완 실패는 결과 폴더와 기술 보고서에 보존했다. `candidate-6.4.299.json`은 실패 후보의 출처/해시 기록이며 제품이 읽는 manifest가 아니다. 제품은 `manifest.json`만 읽는다. 추가 Promise/stream shim 및 시험한 renderer 옵션은 제품에서 제외했다. Iterator를 빈 함수로 만드는 코드는 없다.

## 준비·생성

저장소 루트, 기존 Mac 개발 환경에서만 실행한다. 필요한 자원을 명시적으로 받아 기존 SHA-512/SHA-256과 확인한다. 누락·불일치 시 빌더는 실패하며 자동 다운로드/교체하지 않는다.

```sh
mkdir -p experiments/lite-v1-workbench/generated/edge104-dev
curl --fail --location --max-time 90 --output experiments/lite-v1-workbench/generated/edge104-dev/pdfjs-dist-4.2.67.tgz https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-4.2.67.tgz
curl --fail --location --max-time 30 --output experiments/lite-v1-workbench/generated/edge104-dev/core-js-3.37-LICENSE https://raw.githubusercontent.com/zloirock/core-js/v3.37.0/LICENSE
node experiments/lite-v1-workbench/compat/prepare.mjs
node experiments/lite-v1-workbench/build.mjs
```

`prepare.mjs`는 npm archive integrity를 먼저 확인한 뒤 정확히 지정한 main/worker/LICENSE만 추출하고, core-js MIT 라이선스도 고정 SHA로 확인한다. `compat/vendor/`는 Git 제외. 필요한 공식 core-js 3.37.0 구현은 legacy 배포본 안에 이미 포함돼 있으며 별도의 런타임 패키지 설치가 없다. Node의 canvas/fs/http/https/url 경로는 브라우저에서 실행되지 않는다. PDF fake worker를 미리 로드하므로 worker 동적 import 경로도 실행하지 않는다. 실제 시험에서 외부 요청/CSP 위반을 따로 확인했다.

`classicLegacy`는 고정 소스의 export alias를 명시적 객체 바인딩으로 옮기고, 지정된 webpack footer만 허용한다. 4.2.67 main의 top-level await를 **async IIFE와 await**로 유지한다. Node 전용 import.meta.url은 비실행 경로의 고정 라벨로 대체한다. parser/rendering 알고리즘은 수정하지 않는다. 일반적인 임의 ES module transpiler가 아니며 모양이 다르면 실패한다. `packaging.test.mjs`가 alias·비동기 준비·main/worker 동일 버전을 검사한다.

## 실제 Chromium 104 개발 시험 (사용자 배포물 아님)

공식 Playwright v1.24.2 browsers.json의 revision1015는 104.0.5112.48이다. 공식 목록에 명시된 Akamai 미러에서 Mac arm64 zip을 받았다. 관찰 해시와 도구 integrity는 `results/edge104/environment.json`에 있다. 기존 Mac Edge/Chrome 설치를 변경하지 않았다.

- 브라우저 URL: `https://playwright-akamai.azureedge.net/builds/chromium/1015/chromium-mac-arm64.zip`
- 대응 driver: `https://registry.npmjs.org/playwright-core/-/playwright-core-1.24.2.tgz`
- 브라우저 위치: `generated/edge104-dev/chromium104/chrome-mac/Chromium.app/Contents/MacOS/Chromium`
- driver 위치: `generated/edge104-dev/playwright124/package/index.js`

zip을 생성물 폴더에만 풀고 임시 시험 프로필로 실행했다. Gatekeeper/서명/보안 정책이 실행을 거부하면 NOT_RUN으로 남기며 xattr·보안 설정을 우회하지 않는다. 개발 폴더의 구형 브라우저/패키지는 회사 PC에 전달하지 않는다.

```sh
INHERITAGE_PLAYWRIGHT_MODULE="$PWD/experiments/lite-v1-workbench/generated/edge104-dev/playwright124/package/index.js" INHERITAGE_LITE_RESULTS=results/edge104/ node experiments/lite-v1-workbench/test-browser.mjs chromium104
INHERITAGE_LITE_RESULTS=results/edge104/ node experiments/lite-v1-workbench/test-browser.mjs chromium
INHERITAGE_LITE_RESULTS=results/edge104/ node experiments/lite-v1-workbench/test-browser.mjs edge
INHERITAGE_LITE_REMOVE_APIS=1 INHERITAGE_LITE_RESULTS=results/edge104/ node experiments/lite-v1-workbench/test-browser.mjs chromium
node --test experiments/lite-v1-workbench/build.test.mjs experiments/lite-v1-workbench/compat/packaging.test.mjs
```

최신 Playwright는 104에 없는 checkVisibility를 사용했고, 구형 Playwright의 waitForFunction은 엄격한 CSP 아래 eval 오류를 냈다. 제품 보안을 바꾸는 대신 104용 driver와 Node 측 DOM polling(`poll-page.mjs`)을 사용했다. 판정식·정답은 유지하며 CSP 우회 옵션/unsafe-eval을 추가하지 않는다.

## Modern 실패 재현

```sh
node experiments/lite-v1-workbench/compat/build-modern-probe.mjs
INHERITAGE_LITE_MODERN_PROBE=1 INHERITAGE_PLAYWRIGHT_MODULE="$PWD/experiments/lite-v1-workbench/generated/edge104-dev/playwright124/package/index.js" INHERITAGE_LITE_RESULTS=results/edge104/ node experiments/lite-v1-workbench/test-browser.mjs chromium104
```

원본 manifest로 검증한 6.4.299 modern main/worker를 함께 넣고 CSP 해시를 다시 계산한 **비배포 재현 파일**이다. 실제104의 Iterator 오류와 C1 계산 지속을 확인한다. 이 기대 실패의 재현 통과를 제품 PDF 성공으로 세지 않는다.
