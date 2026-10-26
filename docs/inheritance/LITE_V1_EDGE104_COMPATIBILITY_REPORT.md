# Lite V1 — Edge 104 호환성 수정 (2026-10-26)

## 기준과 증거 수준

대상은 jhlee8403/inheritage다. 시작 시 로컬 브랜치 `fix/lite-v1-windows-initialization`, HEAD `8d33fb1d7fa5c2a7218ca848cdfe66e43cbe8df6`, clean을 확인했다. `git ls-remote origin refs/heads/fix/lite-v1-windows-initialization`도 같은 SHA였다. 이를 보존하고 `fix/lite-v1-edge104-compatibility`를 생성했다. push/PR/merge는 수행하지 않는다.

회사 Windows Edge **104.0.1293.47**에서 C1은 정상, PDF는 `INIT_ERROR / PDF_WORKER_CODE / ReferenceError: Iterator is not defined`였다는 것은 사용자 수동 보고다. 회사 콘솔 전체 스택은 없다. 수정본의 회사 Windows 실행은 **NOT_RUN**이다. 과거 Windows 성공/실패 기록을 수정하지 않는다.

## 확인된 원인과 대안 비교

기존 공식 PDF.js 6.4.299 modern worker의 784행 부근은 `typeof Iterator.prototype.join`을 검사한다. 이때 `Iterator` 전역 자체가 없으면 ReferenceError가 발생한다. PDF 파일 선택이나 OCR 모델 로딩 이전의 worker 코드 평가 단계다. C1은 별도 script에서 먼저 실행되므로 C1 정상과 PDF 초기 진단 실패가 동시에 가능하다.

실제 Chromium 104에서 원본 manifest로 검증한 modern main/worker를 함께 넣은 별도 재현 HTML을 실행했다. 같은 Iterator 오류와 PDF 초기화 실패, C1의 정확한 3/7·2/7·2/7 계산 지속을 확인했다. 기대 실패 확인 3개는 PDF 기능 성공으로 집계하지 않는다. 재현물은 `generated/edge104-dev/modern-probe.html`이며 사용자 배포물이 아니다.

| 후보 | 실제 조사·실행 결과 | 결정 |
|---|---|---|
| A: 공식 6.4.299 legacy main+worker | Iterator 초기화는 해결. 실제104에서 Promise.withResolvers 부재로 파일 처리 실패 | 이름만으로104 지원을 인정하지 않음 |
| C: 위 후보 + 공식 core-js 3.50 Promise 보완 | 다음으로 ReadableStream 비동기 iterator 부재로 텍스트 추출 실패 | 추가 경계 확인 |
| C: 공식 web-streams-polyfill 4.2 ponyfill까지 PDF 범위에 공급 | 직접 추출은 진행. 스캔 렌더는 1190×1684 백지(어두운 화소0), OCR 초기화·recognize 후 EMPTY_OCR_CANDIDATE | 렌더 원인은 미확정. 추가 renderer 옵션도 개선 없음. 채택하지 않음 |
| B: 공식 **4.2.67 legacy main+worker** | 실제104에서 텍스트 추출·스캔 렌더·한국어 후보·통합25개 통과 | 이번 호환 시제품에 고정 |

최종본에는 시험한 추가 Promise/streams shim, renderer 옵션 변경을 넣지 않았다. `Iterator`를 빈 함수로 만드는 코드는 없다. PDF 파서·렌더링 알고리즘을 수정하지 않았다. 폐기 후보 출처는 `compat/candidate-6.4.299.json`, 실패 로그는 `results/edge104/`에 별도 보존한다.

## 공식 버전 선택 근거와 보안 한계

[공식 v4.2.67 gulpfile](https://raw.githubusercontent.com/mozilla/pdf.js/v4.2.67/gulpfile.mjs)의 Chrome >=98 변환 대상과 core-js 3.37.0 사용을 확인했다. [공식 릴리스](https://github.com/mozilla/pdf.js/releases/tag/v4.2.67)와 실제 Chromium104 처리 결과를 함께 근거로 선택했다. 현재 [공식 지원 FAQ](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions)의 modern/legacy 설명을 과거104 지원의 단독 증거로 사용하지 않는다.

[CVE-2024-4367 공식 권고](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq)는 4.2.67을 수정 버전으로 명시한다. 기존 `isEvalSupported:false`, strict CSP 및 PDF viewer scripting 미사용을 유지한다. [2026년 별도 권고 GHSA-hq66-cqwq-w95j](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j)의 명시 범위는 >=5.6.83이고 수정은6.2.108이다. 이 사실은 4.2.67 전체의 취약점 부재를 보증하지 않는다.

4.2.67은 최신 유지보수 버전이 아니다. 이번 결과는 제한된 가공 PDF의 호환성 검증이며, 모든 PDF·전체 보안 감사·업무 배포 승인으로 확대하지 않는다. 구형 회사 브라우저와 라이브러리의 유지보수/취약점 검토는 남은 제약이다.

## 구현과 자원 무결성

`compat/manifest.json`으로 공식 npm archive SHA-512와 main/worker/LICENSE SHA-256을 고정한다. `prepare.mjs`는 필요한 정확한 파일만 추출하며 불일치 시 중단한다. 빌더는 누락 자원을 자동 다운로드하지 않는다.

| 자원 | 바이트 | SHA-256 |
|---|---:|---|
| 4.2.67 legacy pdf.mjs | 800420 | `07be4253f45a55454e8f463c6ee82c7e1addb27c8a25eaaa1d2b1d880d6f49cc` |
| 같은 버전 pdf.worker.mjs | 2294364 | `03f4de3e477f4e19a39a2a85c226c32510c2b6c37f2b71ec5f446e4b4b07baeb` |
| PDF.js Apache-2.0 LICENSE | 10174 | `0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594` |
| 포함 core-js3.37.0 MIT LICENSE | 1064 | `51aff0fa92ac49e01ce6ba0fed992b0a34f8afe15203dd5f38c43f9e88b0167b` |

npm 출처는 `https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-4.2.67.tgz`다. core-js 표준 구현은 공식 legacy 배포본에 포함된 그대로다. 추가 런타임 shim이 없다. `compat/pdf-assets.mjs`는 고정 module footer/export alias만 classic IIFE로 연결한다. main의 webpack top-level await를 async IIFE/await로 보존한다. 초기 제한 변환기가 이를 보존하지 못해 발생한 `await is not defined` 실패도 보존했고, alias/비동기 준비/동일버전 packaging 시험을 추가했다. 범용 module transpiler라고 주장하지 않으며 구조가 다르면 중단한다. Node 전용 비실행 분기의 import.meta.url만 고정 라벨로 대체한다. 사전 로드한 PDF fake worker 경로와 실제 OCR Blob worker 경로를 구별한다.

C1 script 바이트 SHA는 `226853231e3ce48b28675efe8cd07d70ee994c49135d9f76aaf52643d9aa9180`으로 보존했다. PDF 초기화는 독립적 async 영역이다. READY에도 진단을 새로 그려 초기 RUNNING이 남지 않게 했다. 전후 API 존재, 선택 PDF 버전, stage·상태·예외를 표시한다. CSP는 각 최종 script 바이트에서 다시 계산하며 완화하지 않는다.

Tesseract.js/core **7.0.0**, WASM과 고정 tessdata_fast 한국어 모델은 변경하지 않았다. 모델 SHA는 `6b85e11d9bbf07863b97b3523b1b112844c43e713df8b66418a081fd1060b3b2`다. 전체 자원·출처·라이선스·C1 소스 대응은 `results/build.json`, 사용자용 NOTICE에 있다.

## 실제104 환경과 시험 도구

정확한 Edge104 설치물 대신 **Mac arm64 Chromium104.0.5112.48**을 격리 실행했다. [공식 Playwright v1.24.2 목록](https://raw.githubusercontent.com/microsoft/playwright/v1.24.2/packages/playwright-core/browsers.json)의 revision1015를 [공식 registry가 열거한 미러](https://raw.githubusercontent.com/microsoft/playwright/v1.24.2/packages/playwright-core/src/server/registry/index.ts)에서 받았다. AzureEdge/dbazure 두 주소는 HTTP400/curl22였고 Akamai 주소는 성공했다. 관찰 SHA는 `8b62b3aff2a65134f8cea33f1830e0c7f5436928c4525d91a087011bc84ef3a4`, archive121299680바이트다. 출처와 대응 playwright-core1.24.2 integrity는 `results/edge104/environment.json`에 있다.

기존 Mac Edge/Chrome을 교체하지 않았다. 구형 브라우저/driver는 ignored generated 아래 개발 시험용이다. 최신 driver의 checkVisibility 부재와 구형 driver waitForFunction의 CSP eval 거부는 제품 오류와 구분했다. 104에서만 동일 판정식을 Node 측 bounded DOM polling으로 실행한다. CORS/security/eval 허용 옵션, 회사 정책 변경은 없다.

Promise/Map/Iterator 추가 API를 무조건 native 전제로 사용하지 않는다. 실제104에서 Web Crypto SHA-256, File API, canvas, PDF 연결 코드, WebAssembly SIMD, Blob worker, worker 메시지, 한국어 모델 공급·recognize를 실행했다. API 제거 시험은 최신 브라우저의 별도 보조 증거다. 배열·Promise 등 존재 검사만으로 실제 PDF 처리를 대체하지 않았다.

## 최종 시험 결과

최종 HTML SHA `2963016205768fdca0e6bdbf5b2711f3a32218edf4202b42349f158ad844581c`를 시험 전 확인했다. 실패한 build 뒤 예전 산출물을 시험한 중간 기록은 `stale-artifact-after-build-failure-excluded.json`으로 제외하고, 이후 runner에 build/manifest 버전·해시 사전검사를 추가했다.

| 실제 환경/시험 | PASS | FAIL | SKIP/NOT_RUN |
|---|---:|---:|---:|
| 격리 Mac Chromium104.0.5112.48 file:// 통합 | 25 | 0 | 0 |
| Mac Chromium156.0.8078.4 file:// 통합 | 25 | 0 | 0 |
| 실제 Mac Edge156.0.4314.42 file:// 통합 | 25 | 0 | 0 |
| 최신 Chromium의 API 제거 보조 시험 | 25 | 0 | 0 |
| 원본6.4.299 modern/실제104 기대 실패 재현 assertion | 3 | 0 | 0 |
| 기존 C1+M2 Node 전체 | 135 | 0 | 0 |
| build/packaging Node 시험 | 7 | 0 | 0 |
| 최신 Chromium 기존 C1 browser/M2 browser/C1 file/계산 화면 | 20+33+17+18 | 0 | 0 |
| 실제 Mac Edge 동일 기존 회귀 | 20+33+17+18 | 0 | 0 |
| 정확한 Edge104.0.1293.47 수정본 | — | — | NOT_RUN |
| 회사 Windows 업무 PC 수정본 | — | — | NOT_RUN |

통합25개는 초기READY, 선택 텍스트PDF 추출·실제 렌더, 스캔의 어두운 화소 존재와 실제 한국어 후보, 후보 수정, 3쪽 이동, 문서교체 시 제거, OCR 취소/held 늦은 결과/오류/의도적 TIMEOUT, 손상PDF·바이트/페이지/화소 한도, HTML 비실행, C1세유형·정확Q·UNKNOWN BLOCKED·분모0 ERROR·즉시STALE·복사차단·늦은계산차단·문서/worker해제를 포함한다. 지연/오류 주입 시험과 실제 recognize 성공을 구분한다. 단계별 timeout/종료 기록을 유지한다.

네 가지 최종 통합 실행 모두 콘솔 오류·page error·미처리 Promise·CSP 위반·외부 HTTP 요청 **0건**, 경고0건이었다. 새 context/빈 캐시/browser offline=true 조건이다. 물리적 인터넷 단절 시험은 NOT_RUN이다. 구형104와 최신Chromium의 자동 클립보드는 거부되어 수동 선택 대안을 확인했고 MacEdge는 write 성공 안내를 확인했다. OS 클립보드 재읽기·회사 메모장 붙여넣기는 이번에 NOT_RUN이다.

한국어 후보는 실제 생성됐지만 인명 누리솔 누락과 기존 문자오류율32.84%의 품질 제한을 해소한 것이 아니다. 한자/세로쓰기/실제 제적등본 정확도는 합격으로 판단하지 않는다. 원문 대조·수정, NEEDS_REVIEW, C1자동반영 금지를 유지한다.

실패 후보 JSON과 각 실행 JSON/JSONL을 `results/edge104/`에 보존했다. 최종 json과 과거 실패를 혼합하지 않는다. 기존 loopback 회귀는 file://104 증거와 별도다. 시험 명령은 `compat/README.md`에 있으며 핵심 명령은 다음과 같다.

```sh
node --test packages/inheritance-engine/test/*.test.mjs
node --test experiments/lite-v1-workbench/build.test.mjs experiments/lite-v1-workbench/compat/packaging.test.mjs
INHERITAGE_PLAYWRIGHT_MODULE="$PWD/experiments/lite-v1-workbench/generated/edge104-dev/playwright124/package/index.js" INHERITAGE_LITE_RESULTS=results/edge104/ node experiments/lite-v1-workbench/test-browser.mjs chromium104
INHERITAGE_LITE_RESULTS=results/edge104/ node experiments/lite-v1-workbench/test-browser.mjs chromium
INHERITAGE_LITE_RESULTS=results/edge104/ node experiments/lite-v1-workbench/test-browser.mjs edge
INHERITAGE_LITE_REMOVE_APIS=1 INHERITAGE_LITE_RESULTS=results/edge104/ node experiments/lite-v1-workbench/test-browser.mjs chromium
INHERITAGE_LITE_RESULTS=results/edge104/ node experiments/lite-v1-workbench/regressions.mjs
```

## 생성·전달 및 회사 재시험

개발 Mac에서 `compat/README.md`의 명시적 자원준비 후 `node experiments/lite-v1-workbench/build.mjs`를 실행한다. 생성물/vendor/모델/개발브라우저의 Git 제외를 유지한다. 실행 시 다운로드·서버·사용자 개발도구 설치는 없다.

- HTML: `experiments/lite-v1-workbench/generated/lite-v1.html`
- 크기: **9477720바이트**
- SHA-256: **`2963016205768fdca0e6bdbf5b2711f3a32218edf4202b42349f158ad844581c`**
- 함께 전달: `generated/NOTICE.txt`(55485바이트), `generated/Windows-시험안내.txt`
- NOTICE SHA: `9c62f532ebb5cbc02c00426d1145a7a798a7fe1abb111c7f35bee6f281e23e68`

세 파일을 회사가 허용한 방식으로 다른 PC에 복사하고 HTML을 Edge로 직접 연다. generated 전체(구형 개발브라우저·실패 재현물 포함)를 전달하지 않는다. 시험용 완전 가공 PDF는 별도로 전달할 수 있다.

1. 초기 PDF와 C1이 모두 READY인지, 진단에4.2.67이 표시되는지 확인한다. Iterator native 부재만으로 실패라고 판단하지 않는다.
2. 가공 three-pages.pdf 선택 →3쪽 인식·이동·원문·직접추출 확인. 스캔 표본에서 한국어OCR을 명시 실행해 후보·품질경고·수정 확인.
3. PDF교체/취소 후 옛 후보 제거, C1표본 계산·수정 시STALE·분모0ERROR·복사 후 메모장 붙여넣기를 확인한다.
4. 실패하면 PDF/C1각상태, stage, error명/메시지, 버전, 진단내용을 전달한다. 실제 문서·개인정보는 보내지 않는다. 설치·업데이트·관리자·보안해제를 요구하지 않는다.

## 보호 범위와 남은 제한

기존 C1/M2 엔진·계산 화면·승인/truth·OCR 원본/정답은 변경하지 않았다. C1고정2017-01-10/2017-01-11/BL1-LAW-2016-14409를 확대하지 않았다. R04/R05 PENDING, M2정상배분 비활성을 유지한다. 새 기능·법률추론·OCR자동사실확정·Windows실행기 제작은 없다.

남은 것은 회사 Windows104 수정본 수동 재시험, 구형 라이브러리 유지보수 판단, 더 넓은 PDF·언어 품질 검증이다. 실제104엔진에서의 제한된 성공을 모든 Edge104 정책/Windows 구현의 보장으로 표현하지 않는다. 다음 개발은 자동 시작하지 않는다.

## 2026-10-26 후속 사용자 확인 및 V1 개발 마감

이 문서 본문은 개발자가 자동시험을 마친 당시의 기록으로 유지한다. 이후 사용자는 회사 Windows PC의 Microsoft Edge104.0.1293.47에서 새 수정본을 실행하고 **“이제 잘 된다”**고 보고했다. 이를 **USER_REPORTED_SUCCESS (사용자 수동 실행 성공)**로 추가한다. 개발자가 회사 PC를 직접 시험한 것은 아니다.

사용자는 PDF 페이지 이동·OCR 인식률·복사 등 개별 시험의 PASS를 명시하지 않았다. 따라서 이 보고로 개별 Windows 항목, 전체 자동시험, 네트워크 로그0건, 보안/정확도/법률 업무 사용을 승인된 것으로 바꾸지 않는다. 해당 세부 검증은 미확인/NOT_RUN으로 남긴다. 기존 본문의 Windows NOT_RUN은 당시 개발자 시험의 상태이며 삭제하지 않는다.

최종 기능 코드는 `4adfb11caef0eaf621e1a409e0d460264c6e9030`으로 보존한다. 현재 정상 HTML은 `generated/lite-v1-3.html`이라는 이름이며 기존 `lite-v1.html` 시험본과 같은9,477,720바이트/SHA-256임을 마감 때 확인했다. 파일을 수정·재생성하지 않았다. 최종 제출 구성·범위·보안/OCR 한계·증거 수준은 `LITE_V1_FINAL_HANDOVER.md`와 루트 README에 정리했다. 이번 마감은 문서만 변경하며 개발을 종료한다. R04/R05 PENDING과 실제 사건 사용 금지를 유지한다.
