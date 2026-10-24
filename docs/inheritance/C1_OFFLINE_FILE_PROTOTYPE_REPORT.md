# C1 A안 — 로컬 파일 실행 시제품 검증

검증일: 2026-10-24. 기준 `review/m2-s0-s1-hardening` / `3b94f4c52af7f98d4da38debbc9ef28edababb5a`. 시작 시 로컬과 실제 git ls-remote 원격 HEAD가 일치했고 작업 트리는 clean이었다. 별도 `feat/c1-offline-file-prototype` 브랜치에서 작업했다. 최종 로컬 SHA와 작업 트리는 완료 채팅/git log로 확인한다. 터미널 push·PR·merge는 하지 않는다.

## 결론과 실행 파일

**C1에 한정한 A안은 이번 Mac Chromium·실제 Mac Edge에서 성립했다. Windows Edge/업무 PC에서는 아직 NOT_RUN이다.** 원본 개발용 HTML의 직접 실행은 실패하지만, 원본 엔진/화면 소스를 정적으로 연결하고 CSS/JS를 내장한 단일 HTML 시제품은 서버 없이 동작한다. 최종 제품이나 PDF/OCR 전체의 A안 성립을 뜻하지 않는다.

실행 파일: `experiments/c1-offline-file-prototype/output/c1-calculator.html`.
Finder 또는 Windows 파일의 연결 프로그램에서 Microsoft Edge로 연다. Edge 창에 HTML을 끌어 놓아도 된다. 사용자는 Node.js·Python·npm·Git·Codex·GitHub Desktop을 설치하거나 터미널/서버를 실행할 필요가 없다. 파일 한 장을 다른 위치로 복사해 실행할 수 있다. `manifest.json`과 `사용방법.txt`는 추적/안내용으로 함께 전달할 수 있지만 실행 의존성은 아니다.

가공 표본 불러오기 → 현재 입력 계산 → 결과 텍스트 선택/복사 순서다. 자동 복사가 막히면 Edge 복사 메뉴 또는 Ctrl+C(Mac: Command+C)를 사용한다. 파일/JavaScript/Web Crypto가 정책상 차단되면 사용을 중단하고 관리자에게 문의한다. 보안 설정을 바꾸는 실행 방법은 제공하지 않는다.

## 원본 file:// 실패 조사

`test/probe-file.mjs`로 원본 `experiments/inheritance-calculator/index.html`을 새 비영구 브라우저 컨텍스트에서 file://로 열었다. Chromium 156.0.8078.4와 Mac Edge 155.0.4283.62 모두 다음을 관측했다.

- 로컬 CSS는 로드됐다. isSecureContext=true, crypto.subtle.digest 사용 가능, SHA-256('abc')는 표준 값과 일치했다. clipboard.writeText 함수도 존재했다. 함수 존재가 복사 권한을 보장하지는 않는다.
- 외부 ES Module `app.mjs` 요청이 file origin 'null'의 CORS 제한으로 실패했다. 정적 import 의존성의 평가 이전에 최상위 모듈부터 막혔다. 화면 입력 필드는 0개, 앱의 status dataset은 생성되지 않았다.
- 오류 원문 핵심은 `from origin 'null' has been blocked by CORS policy: Cross origin requests are only supported for protocol schemes:` 및 `Failed to load resource: net::ERR_FAILED`였다. 허용 scheme 목록은 브라우저별로 다르다. 원문 전체와 실패한 file URL은 `/private/tmp/inheritage-c1-original-file.txt`에 있다.

이 실패를 계산 로직 또는 SHA-256의 실패로 오인하지 않았다. 기존 127.0.0.1 성공을 file:// 성공으로 기록하지 않았다. --disable-web-security·--allow-file-access-from-files 등의 보안 완화 옵션은 사용하지 않았다.

## 시제품 생성과 소스 대응

개발 단계의 `scripts/build.mjs`는 Node 표준 모듈만 사용한다. 패키지 설치/다운로드·새 프레임워크·외부 번들러 의존성은 없다. 현재 정적 소스가 사용하는 제한된 import/export 문법만 지원하고 알 수 없는 문법·순환 모듈·동적 import·외부/Node import는 중단하는 연결기다. 범용 JavaScript 변환기로 주장하지 않는다.

기존 C1 공개 브라우저 진입점과 화면의 14개 모듈을 private classic-script 모듈로 연결한다. 엔진 계산식·분수·스냅샷·세션은 원본을 사용하며 새로 재작성하지 않는다. 모든 CSS/JS는 인라인이다. 원본 화면의 복사 안내를 Windows에도 맞는 문구로 바꾸고 제목/하단에 시제품·미검증 범위를 표시했다. 기존 개발 화면 파일은 수정하지 않았다.

HTML의 CSP는 정확한 SHA-256의 인라인 script/style만 허용하고 connect-src 'none'을 적용한다. ES Module fetch, CDN, 외부 폰트/스크립트, worker/WASM/모델, 런타임 다운로드가 없다. M2·PDF/OCR은 포함하지 않는다. 상대/절대 개발 경로를 실행 시 참조하지 않는다.

`output/manifest.json`에 원본 16개 소스(모듈14+HTML/CSS)의 SHA-256, 모듈 목록, 생성기 해시, 생성 HTML/안내문 해시와 변환 내역을 기록했다. 두 번 생성한 결과가 byte 단위로 같음을 시험했다. 원본 C1 계산/승인 소스·truth·화면·OCR·M2는 기준 대비 변경이 없다.

HTML 크기: **49,050 bytes**. HTML SHA-256:
`5a1ed623e662b3a06313245c49632f3b2fe94ff8cf3e49b28b6b0b37a477ecf8`.

## 실제 file:// 시험

HTML 한 장만 한글·공백·#이 있는 새 임시 디렉터리의 다른 이름으로 복사했다. 원래 CSS/JS/개발 폴더가 없는 위치다. 각 브라우저는 새 임시 프로필/비영구 컨텍스트, 빈 캐시, 서비스 워커 차단, 브라우저 네트워크 offline 모드에서 시험했다. Chromium sandbox를 유지했고 브라우저 보안 정책이나 시스템 프록시/TLS 설정을 변경하지 않았다. 이는 물리적 인터넷 케이블/망 단절 시험은 아니다.

17개 실제 화면 시험은 다음을 포함한다: 세 정상 유형의 고정 인물/분수/경로/규칙, Q=1/3의 정확한 분수, 원본 의존성을 Node SHA-256으로 해시한 값과 파일 결과 해시 일치, UNKNOWN/불완전 집합 BLOCKED와 미해결 Q, 손상 Q ERROR, 입력 직후 동기적 STALE/출력 제거/복사 차단, 늦은 성공/오류·취소·해시 실패, 복사 실패의 선택 대안·늦은 clipboard 완료 차단, HTML 입력 비실행, 날짜/법령 고정, Web Crypto 부재 시 HASH_UNAVAILABLE와 빈 결과다.

| 환경/실행 방식 | 통과 | 실패 | 건너뜀 |
|---|---:|---:|---:|
| Mac Chromium 156.0.8078.4 / 단일 file:// | 17 | 0 | 0 |
| Mac Edge 155.0.4283.62 / 단일 file:// | 17 | 0 | 0 |
| Node v24.22.0 / 생성·해시·소스 대응·재현성 | 5 | 0 | 0 |

파일 시험의 콘솔 오류·페이지 오류·미처리 Promise 거절·외부 HTTP(S) 요청·다른 자원 요청·CSP 위반은 두 브라우저 모두 0건이었다. 문서 file 요청만 관측했다. Web Crypto 부재 전용 컨텍스트도 진단에 포함했다. OS 전체나 브라우저 자체 telemetry의 모든 통신을 측정한 것은 아니다.

클립보드 권한은 처음에 임의 부여하지 않았다. Chromium은 기본 자동 쓰기가 거절되어 텍스트 전체 선택 대안이 작동했다. Edge는 기본 쓰기 Promise가 성공하여 복사 성공 안내를 표시했다. 두 환경 모두 강제 쓰기 거절/지연 상황의 선택·무효화 계약이 통과했다. **실제 OS clipboard 내용 읽기/붙여넣기는 NOT_RUN**이며 자동 복사 완전 검증으로 주장하지 않는다. 실제 Ctrl+C/붙여넣기는 Windows 수용 시험에서 확인해야 한다.

첫 시제품 실행에서 Chromium 17개는 통과했지만 Edge 자동 시작은 `browserType.launch: Timeout 180000ms exceeded`로 실패했다(제품 시험 미도달). 해당 시험 프로세스가 남지 않았고 설치 Edge 버전이 정상임을 읽기 전용으로 확인했다. 원인은 확정하지 못했다. 보안 옵션 변경 없이 Edge 단독 재실행 17개가 통과했고 이후 최종 두 브라우저 시험도 통과했다. 실행기 시작 제한만 30초로 줄였으며 첫 실패 기록을 삭제하지 않았다. 초기 실패와 최종 성공을 합산하지 않는다.

## 기존 회귀 — loopback과 분리

| 환경/기존 시험 | 통과 | 실패 | 건너뜀 |
|---|---:|---:|---:|
| Node C1+M2 전체 | 135 | 0 | 0 |
| Chromium / M2 loopback | 33 | 0 | 0 |
| Mac Edge / M2 loopback | 33 | 0 | 0 |
| Chromium / C1 엔진 loopback | 20 | 0 | 0 |
| Mac Edge / C1 엔진 loopback | 20 | 0 | 0 |
| Chromium / 기존 개발 화면 loopback | 18 | 0 | 0 |
| Mac Edge / 기존 개발 화면 loopback | 18 | 0 | 0 |

회귀 브라우저에서도 콘솔/페이지 오류·미처리 Promise 거절·외부 요청은 0건이다. 원본 C1 엔진/승인/truth와 수동 화면·M2·OCR에 git diff가 없음을 확인했다. 법률 수치 기대값을 구현 출력에 맞춰 바꾸지 않았다.

실제 명령(최종 실행 모두 종료 0):

```sh
node experiments/c1-offline-file-prototype/scripts/build.mjs
node --test experiments/c1-offline-file-prototype/test/build.test.mjs
node experiments/c1-offline-file-prototype/test/probe-file.mjs
node experiments/c1-offline-file-prototype/test/browser-file.mjs
npm test --prefix packages/inheritance-engine
npm run test:browser:m2 --prefix packages/inheritance-engine
npm run test:browser --prefix packages/inheritance-engine
npm test --prefix experiments/inheritance-calculator
```

실제 로그는 `/private/tmp/`의 `inheritage-c1-original-file.txt`, `inheritage-c1-file-prototype.txt`(첫 Edge 시작 실패), `inheritage-c1-file-edge.txt`, `inheritage-c1-file-final-observed.txt`, `inheritage-c1-file-build.txt`, `inheritage-c1-file-node-regression.txt`, `inheritage-c1-file-m2-regression.txt`, `inheritage-c1-file-c1-regression.txt`, `inheritage-c1-file-ui-loopback.txt`에 보존했다. 임시 로그의 영구 보존을 보장하지 않으며 재현 가능한 시험과 결과 요약을 커밋한다.

## Windows 수용과 B안의 경계

Windows 버전/CPU/RAM·Edge 버전/정책, 파일 반입·실행·스크립트·Web Crypto·클립보드 정책, 원래 인터넷 없는 업무 PC 접근은 미확인이다. **Windows Edge·실제 업무 PC·물리적 망 단절은 모두 NOT_RUN**이다. Mac 성공은 Windows 합격이 아니다.

Windows 수용 때는 개발 도구가 없는 PC에 HTML을 복사하고 새 프로필/빈 캐시·실제 망 단절에서 실행, 한글/공백 경로 이동, 세 유형/분수/게이트/STALE/경합, 선택 후 Ctrl+C/붙여넣기, 외부 요청·오류를 확인해야 한다. Web Crypto가 차단되면 안전하게 ERROR이며 정상 계산이나 약한 해시로 대체하지 않는다.

| 경로 | 이번 확인 | 관리자/소유자 확인 항목 |
|---|---|---|
| A: 단일 로컬 HTML | Mac C1 범위에서 서버/개발 도구 없이 작동 | HTML/JavaScript 반입·실행, file origin/Web Crypto·클립보드 정책, Edge 버전, 실제 오프라인 시험 |
| B: 독립 실행기+loopback | 비교만 수행, 실행 파일/설치 프로그램 미제작 | 실행물/포함 런타임·서명·반입/설치 허용, localhost/포트·보안 제품 정책, 권한·종료/충돌 처리, 독립 PC 실행 |

A가 업무 정책·Web Crypto/file 실행 제약으로 성립하지 않거나 향후 별도 승인한 자원이 file origin에서 불가능할 때 B안을 다시 검토한다. 클립보드 자동 쓰기 거절만으로 B가 필수인 것은 아니며 선택 대안의 수용 여부를 확인한다. B는 사용자에게 Node/Python 설치를 요구하는 개발 서버 방식으로 목표를 대체할 수 없다. loopback 허용·실행기 승인을 추정하지 않으며 이번에는 제작하지 않았다.

## 범위와 변경 파일

R04/R05·새 truth·날짜·의존 승인은 계속 PENDING이다. C1 승인된 가공 범위만 사용했다. 실제 사건정보·비밀정보·원자료를 출력물에 넣지 않았다. M2 UI·PDF/OCR·Windows 실행기·설치 프로그램·관리자 정책 변경은 없다. 본 작업 후 자동 후속 개발을 시작하지 않는다.

새 파일: `experiments/c1-offline-file-prototype/README.md`, `scripts/build.mjs`, `test/build.test.mjs`, `test/probe-file.mjs`, `test/browser-file.mjs`, `output/c1-calculator.html`, `output/manifest.json`, `output/사용방법.txt` 및 이 보고서. 기존 소스는 모두 보존했다.
