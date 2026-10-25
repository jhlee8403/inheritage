# 축소형 V1 Windows PDF 초기화 진단 및 방어 수정

기록일: 2026-10-25. 기준 `feat/lite-v1-integrated-workbench` / `ffb88aeac9582f700b1997fae40546c0becbd2b3`. 시작 시 로컬 HEAD가 기준 SHA와 일치하고 작업 트리는 clean이었다. 별도 `fix/lite-v1-windows-initialization` 브랜치를 생성했다. 기존 엔진·승인·truth·독립 시제품과 이전 완료 보고서는 보존했다.

**현재 결론: 조용히 멈추는 초기화 실패의 표시·격리 결함은 수정했다. 회사 Windows의 실제 근본 원인과 수정 후 PDF 정상화 여부는 아직 미확정이다.** 이 문서나 Mac 재현 시험을 Windows PASS로 해석하지 않는다.

## 사용자 관찰과 증거 수준

실제 회사 Windows Edge에서 기존 통합 HTML의 C1 계산은 정상 동작한다는 사용자 수동 보고가 있었다. PDF 선택 전부터 최초 진단은 완전히 비고, three-pages.pdf 선택 후에도 0/0·EMPTY·원문/후보 없음이 유지됐다. Edge를 명시해 재실행해도 같았다. Windows 콘솔 로그·브라우저 버전·회사에 전달한 실제 파일의 SHA-256은 수집되지 않았다. 버전은 사용자도 확인하지 못해 미확인으로 남겼다. 과거 C1 단독 HTML 성공과 이번 통합 C1 작동 보고는 PDF/OCR 합격의 증거가 아니다.

## 실제 소스와 실행 순서 조사

기준 생성물은 인라인 script **한 개** 안에 C1 IIFE를 먼저 실행하고, 다음 PDF/OCR IIFE에서 아래 순서로 실행한다.

1. PDF.js worker 번들을 메인 스레드에서 평가하여 pdfjsWorker를 준비한다.
2. PDF.js main 번들을 평가하고 pdfjs를 설정한다.
3. Tesseract client 번들을 평가한다.
4. WORKER_SOURCE/고정 자원 데이터를 설정한다.
5. PDF app.js가 파일 선택/페이지/OCR 리스너를 등록하고 마지막 controls()/diagnostics()를 호출한다.

HTML/CSS는 script 실행과 별개로 이미 파싱되므로 PDF/계산 화면의 정적 틀은 보일 수 있다. **C1 뒤쪽의 동기 실행 예외는 앞에서 완료한 C1을 남긴 채 PDF 앱에 도달하지 못하게 할 수 있다.** 반대로 같은 script 전체의 구문 오류나 전체 script CSP 차단이라면 그 script 안 C1도 실행되지 않는다. 따라서 회사 파일이 이 기준 생성물과 같다는 전제에서는 전역 구문 오류/전체 JavaScript 차단을 최우선 원인으로 단정할 수 없다. 실제 전달 파일 해시가 없으므로 이 추론의 전제도 분리한다.

기준 생성물과 새 생성물의 CSP/스크립트 실제 바이트를 검증했다. 기준 C1/PDF는 별도 스크립트 해시가 아니라 전체 script 하나의 해시였다. 새 파일은 아래 여섯 script 각각을 해시한다. SHA 일치가 확인됐다는 사실이 실제 회사 전달 파일의 변조·인코딩 문제나 정책까지 배제하는 것은 아니다.

C1/PDF의 $·상태 변수는 각각 IIFE 내부에 있고 PDF.js 번들도 내부 래퍼로 분리돼 있다. Tesseract 전역과 pdfjsWorker/pdfjsLib는 C1이 사용하지 않는다. 변수 충돌·ReferenceError·초기화 순서 오류가 회사 원인이라고 입증되지는 않았다. 이번에는 추측으로 vendor 이름/계산 코드를 바꾸지 않았다.

## 재현한 사실과 가설 구분

기준 HTML을 보존한 generated/baseline-ffb88ae.html에 Playwright addInitScript로 API를 한 개씩 제거한 11개 격리 컨텍스트를 실행했다. baseline-probe.json은 검사 결과 관찰 기록이며 11개 독립 합격 시험이라고 세지 않는다.

- TextDecoder 제거: **C1 폼은 생성되지만 PDF 진단은 빈 문자열·EMPTY**, `ReferenceError: TextDecoder is not defined` 재현. 해당 고정 PDF worker 번들의 qcms 바인딩에 최상위 `let cachedTextDecoder = new TextDecoder('utf-8', ...)`가 있고, 이 문장이 PDF app.js보다 먼저 실행된다. 여기서 ‘worker 코드’는 메인 스레드의 사전 평가이며 Blob worker 생성이나 WASM 컴파일을 뜻하지 않는다.
- Promise.withResolvers, Promise.try, Map.getOrInsertComputed, URL.parse, DOMMatrix, ImageData, Math.sumPrecise, Uint8Array.toHex, AbortController를 각각 제거한 관찰에서는 최초 PDF diagnostics가 여전히 실행됐다. 따라서 이런 API의 부재가 곧바로 빈 최초 진단의 원인이라고 단정할 수 없다. 일부는 PDF 선택 후 실제로 필요한 API이며, 새 시험에서 withResolvers 부재의 파일 처리 ERROR도 구분했다.
- 수정본의 가공 worker 생성 차단 + WebAssembly 전역 부재 조건에서도 최초 초기화 READY와 직접 텍스트 PDF 열람은 동작했다. OCR 실행 시에만 worker 차단 ERROR가 났다. 이는 실제 회사 정책을 시험한 것이 아니라 실행 단계 구분을 위한 주입 시험이다.

**TextDecoder 부재는 가능한 실패 경로의 재현이지 회사 원인 확정이 아니다.** MDN은 TextDecoder를 널리 지원되는 API로 설명한다. 회사 브라우저가 오래됐다고만 추측해 이 API가 없다고 결론 내리지 않는다. 정확한 사용자 오류/UA가 필요하다. PDF.js modern build가 최신 브라우저를 전제로 하고 getOrInsertComputed 같은 최신 API를 사용하는 것은 호환 위험이지만, 그 위험과 현재 초기화 실패 증거는 별개다.

공식 확인 자료: [PDF.js FAQ: modern/legacy 지원 경계](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#which-browsersenvironments-are-supported), [MDN TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder), [MDN Map.getOrInsertComputed](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/getOrInsertComputed). 정확한 최소 Windows Edge 버전을 이번 시험으로 확정하지 않는다. 구버전 브라우저 바이너리 실제 시험은 NOT_RUN이며 API 제거 시험으로 이를 대체하지 않는다.

## 최소 수정

- 작은 독립 initialization.js를 먼저 실행하고 C1/PDF 상태를 각각 NOT_STARTED/RUNNING/READY/FAILED/TIMEOUT으로 표시한다. 이는 초기 화면 준비 상태이며 계산/법률 승인 상태가 아니다.
- C1은 원래 스크립트 바이트 그대로 별도 script로 실행한다. 전후 표시만 붙이고 계산 API·화면 이벤트·스냅샷·결과를 바꾸지 않는다.
- PDF 전용 script는 PDF_WORKER_CODE → PDF_JS_CODE → TESSERACT_CODE → PDF_APP_LISTENERS → PDF_APP_DIAGNOSTICS_COMPLETE를 표시한다. PDF 앱의 실제 최초 diagnostics 이후에만 READY를 보낸다.
- 동기 예외는 try/catch, 나중 script 구문 오류는 먼저 등록된 error 핸들러, script CSP 차단은 securitypolicyviolation, 완료 신호 누락은 10초 watchdog으로 표시한다. 이벤트 루프/OS가 정지하면 타이머도 실행되지 않으므로 실제 벽시계 10초 보장을 주장하지 않는다.
- PDF 파일 선택은 READY 이전 비활성화한다. 실패하면 INIT_ERROR·단계·오류가 PDF 작업 진단과 새 초기화 진단에 표시된다. 전체 JavaScript가 실행되지 않아도 정적 미실행 안내가 남는다. 오류 정보가 없으면 원인 미확정으로 남긴다.
- UA·file 프로토콜·관련 API 존재 여부를 읽기 전용 진단으로 표시한다. API가 존재한다고 Blob/WASM 회사 정책이 허용된 것은 아니다. 약한 해시/온라인 자원/보안 완화/임의 폴리필·vendor 교체를 추가하지 않았다.

여섯 script 순서: 독립 감시 / C1 시작 / 원본 C1 / C1 완료 확인 / PDF 시작 / PDF payload. 각각의 바이트 수·CSP SHA-256은 results/build.json의 scripts에 기록한다. Node vm 구문 검사와 생성 검증은 유지한다.

## 실제 검증과 실패 기록

최종 생성물 Chromium 156.0.8078.4:

| 검사 | 통과 | 실패 | 미실시/skip |
| --- | ---: | ---: | ---: |
| 초기화 진단·격리 | 9 | 0 | 0 |
| 기존 통합 PDF/OCR/C1 | 25 | 0 | 0 |
| C1/M2 Node 전체 | 135 | 0 | 0 |
| 생성물/CSP/원본 C1 일치 | 4 | 0 | 0 |

명령:

```sh
node experiments/lite-v1-workbench/build.mjs
node --test experiments/lite-v1-workbench/build.test.mjs
node --test packages/inheritance-engine/test/*.test.mjs
INHERITAGE_LITE_INIT_PROBE=1 INHERITAGE_LITE_RESULTS=results/windows-initialization/ node experiments/lite-v1-workbench/test-browser.mjs chromium
INHERITAGE_LITE_RESULTS=results/windows-initialization/ node experiments/lite-v1-workbench/test-browser.mjs chromium
```

9개 진단 검사는 정상 최초 READY/진단, TextDecoder 부재, Tesseract 단계 예외, PDF만 구문 오류, PDF만 CSP 해시 불일치, 완료 누락 TIMEOUT, worker/WASM 부재와 최초 진단 분리, 지연 사용 최신 API 부재, 정상 컨텍스트 오류/외부 요청0을 검증했다. 실패 주입마다 기존 C1 표본의 REVIEW_READY도 확인했다. 정상 파일의 오류·외부 요청·CSP 위반은 0이며, 의도한 CSP/구문 오류 프로필의 오류 로그는 정상 컨텍스트와 분리해 보존했다. 테스트에서 오류가 나도록 만든 것을 실제 사용자 파일의 오류로 기록하지 않는다.

25개 통합 회귀에는 실제 파일 선택·직접 추출·한국어 후보·쪽 이동·교체·취소·TIMEOUT·늦은 결과 차단·크기/쪽/화소 한도·세 C1 계산·분수·BLOCKED·분모0 ERROR·STALE·복사 대안·worker/Blob 정리가 포함된다. 실행 결과는 새 windows-initialization/ 하위에 저장해 이전 완료 결과를 보존했다.

Mac Edge 156.0.4314.42의 새 진단 시험은 최초 시도에서 정상/누락 TextDecoder/Tesseract 예외/구문 오류까지 4개가 통과했으나 CSP 프로필 중 TIMEOUT으로 끝났다. 같은 때 Chromium 회귀도 첫 검사 도중 TIMEOUT이었다. 두 로그에서 15초/180초 제한 콜백이 벽시계상 늦게 처리됐다. 원인은 미확정이고 호스트 중단/스케줄링/자원 정지 같은 환경 가설을 앱 결함으로 단정하지 않는다.

로그를 보존하고 단독 실행으로 전환했다. Chromium은 최종 25개·9개가 정상 종료했지만 Edge는 단독 재시도에서도 **browser launch TIMEOUT(외부 제한25000ms)**으로 본 검사에 진입하지 못했다. 최종 Edge 진단9개와 통합25개는 **NOT_RUN**이며 Mac Edge PASS로 보고하지 않는다. Edge 시작 실패의 정확한 원인도 미확정이다. 보안 옵션/설정 변경·임의 브라우저 설치·반복 재시도를 하지 않았다. 마지막 ps 검사에서는 관련 잔여 프로세스가 없었다. 이번 수정본의 기존 별도 C1/M2 전체 브라우저 회귀는 NOT_RUN이며 과거 20/33/17/18 통과 기록을 새 시험으로 복사하지 않는다.

별도 초기 하네스 오류: 큰 vendor 문자열을 String.replace의 치환 문자열로 넣어 $&가 해석되는 바람에 오류 주입용 HTML에 중복 DOM이 생겼다. 콜백 치환으로 수정하고 initial-harness-failure.json을 보존했다. 이는 실제 생성기/회사 파일의 원인으로 확인된 문제가 아니다. 실패 기대값을 완화하지 않고 Chromium에서 재시험했다.

보존 로그: baseline-probe.json, initial-harness-failure.json, concurrent-timeout-*.json, initialization-*.json[l], chromium.json[l], build-tests.txt, node-regression.txt. 예상 실패와 미완료 시도는 성공 개수에 포함하지 않았다. 긴 대기의 실제 원인을 확정하거나 모든 환경에서 타이머가 절대 시간대로 보장된다고 기록하지 않는다.

## 생성물과 회사 재시험

재생성 명령은 위와 동일하다. 생성 경로 `experiments/lite-v1-workbench/generated/lite-v1.html`, 크기 **9,473,096 bytes**, SHA-256 **`23a1099a737ff7c8b91a6fcfe0f2f9c51551d419f98bc7ea4c4bc8698579fa1e`**. HTML과 NOTICE 및 새 Windows-시험안내.txt를 함께 전달한다. 대형 generated/는 Git 제외다. 실행 시 개발 도구·서버·인터넷 설치가 필요 없다.

회사는 수정본을 다른 파일 이름으로 구분해 Edge로 열고, PDF 선택 전 C1/PDF 초기화 상태를 먼저 확인한다. READY이면 가공 three-pages.pdf로 쪽 수/원문/후보를 재시험한다. FAILED/INIT_ERROR/TIMEOUT이면 새 PDF 초기화 진단의 단계·오류 첫 줄·API 목록·UA를 텍스트로 기록한다. 개인정보성 폴더 경로는 공유 전 가린다. 자세한 재시험은 WINDOWS_MANUAL_TEST.md에 별도 날짜 항목으로 추가했다. 콘솔 로그·개발 도구 설치·관리자 권한·IE 모드·보안 해제는 요구하지 않는다.

**수정본 Windows Edge·실제 회사 PC 실행은 NOT_RUN.** 이 수정은 필요한 후속 원인 정보를 안전하게 표시하고 PDF 실패를 C1과 격리한다. 회사에서 TextDecoder나 다른 API/정책 문제로 확인되면 그 근거를 토대로 별도 호환 수정 범위를 정해야 하며, 이번에 임의로 버전·법률 범위·모델을 바꾸지 않았다.

## 보호 범위

C1 원본 스크립트 바이트·출력·엔진·승인·truth, M2 코드, PDF/OCR 고정 vendor·WASM·모델·해시·정답, 이전 독립 실험은 변경하지 않았다. 기존 PDF app.js의 계산/문서/OCR 처리 코드도 그대로다. R04/R05 및 새 법률/날짜/truth는 PENDING이며 정상 계산을 활성화하지 않았다. OCR→법률 사실 자동 확정/입력 반영, 실제 사건자료, 새 기능, Windows 실행기, push/PR/main merge는 수행하지 않았다.
