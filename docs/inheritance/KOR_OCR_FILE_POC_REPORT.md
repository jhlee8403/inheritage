# 한국어 file:// OCR 최소 실험 및 장시간 대기 진단

기록일: 2026-10-25 (Asia/Seoul). 브랜치 `feat/scoped-product-ocr-offline`, 기준 `6fa6027922046a9015f5c366eb7c83e8edf90669`. 제품 범위는 PRODUCT_SCOPE_LITE_V1.md에 별도 기록했다. 이 결과는 고정 가공 스캔 한 쪽의 기술 검증이며 법률 승인이나 제적등본 제품 완성 선언이 아니다.

## 중단 전 보존 상태와 진단

사용자는 시험 명령이 1시간 이상 종료되지 않았고 응답 연결도 중단됐다고 보고했다. 재개 시 HEAD는 기준 커밋, 제품 범위 문서와 실험 디렉터리는 미추적이었다. 기존 추적 파일의 diff는 없었다. 기존 생성물·소스·로그를 사용해 이어갔으며 reset/revert/clean/브랜치 전환을 하지 않았다.

재개 시 ps에서 해당 시험 Node/Playwright headless 브라우저의 잔여 프로세스는 없었다. 다른 작업 프로세스를 종료하지 않았고 이전 프로세스 중 강제 종료한 것도 없다.

기존 `/private/tmp/inheritage-kor-poc-first.txt`, `-final.txt`, `-node.txt`, `-initial-result.json`을 보존했다. 저장소의 기존 `results/browser.json`도 그대로 남겼으며 `prior-browser.json`으로 복사했다. 초기 실패 요약은 `prior-initial-failure.json`에 보존했다. 기존 browser.json에는 Chromium 후보 생성 및 5개 검사 통과, Edge `browserType.launch: Timeout 30000ms exceeded`가 실제로 기록돼 있다. 따라서 Edge 초기화/OCR 실패로 해석하면 안 된다. **1시간 정지의 정확한 단계와 근본 원인은 미확정**이다. 기존 하네스는 마지막에만 보고서를 쓰고 browser.close를 무제한 기다렸으며, 앱에는 초기화 전체 타이머 외에 개별 대기/종료 제한이 부족했다. 이는 확인된 진단·종료 취약점이지 장시간 정지의 입증된 단일 원인은 아니다.

초기 별도 실패의 `UNEXPECTED_CORE_FILE: tesseract-core-simd-lstm.wasm`는 이미 있던 어댑터의 locateFile 거부에서 발생했다. 바이트 공급 시에도 core가 파일 이름을 조회하는 고정 버전 동작에 맞춰 허용된 이름을 비네트워크 식별자로만 반환하는 기존 수정을 유지했다. worker 문자열 직렬화 검증도 유지했다. 실패 로그나 고정 자원 해시·OCR 정답을 바꾸지 않았다.

## 이번 보완

앱의 SHA 검증, PDF 로딩/페이지/렌더링/직접 추출, 초기화, 파라미터, recognize 및 종료에 제한 시간을 적용했다. worker 자원 메시지 수신도 제한한다. 초기화의 worker 부팅·메시지 수신·core 진입·WASM 공급/런타임 준비·모델 공급/초기화는 진행 이벤트로 분리한다. 제3자 core 컴파일 자체의 독립 소요 시간은 측정하지 않고 런타임 준비 완료로 성공을 확인한다. 시간 초과는 TIMEOUT, 일반 오류는 FAIL, 후보는 NEEDS_REVIEW로 구분하며 오류/취소 시 후보를 제거한다. worker/PDF 종료 오류도 별도 기록한다.

하네스는 브라우저 한 개를 인자로 선택하고 단계 시작/종료를 즉시 JSONL에 추가하며 부분 결과를 기록한다. 각 API 대기 및 브라우저 연결/시작/종료를 제한하고 100초 절대 제한도 둔다. 종료 실패 시 자신의 BrowserServer PID에만 비상 종료를 적용한다. 이번 재시험에서는 비상 종료를 사용하지 않고 정상 종료했다. Promise race만으로 기저 작업이 취소된다고 가정하지 않고 worker/PDF 자원 정리와 소유 브라우저 종료를 함께 수행한다. 자세한 제한 값과 명령은 실험 README에 있다.

## 고정 API·자원 경로

PDF.js 6.4.299, Tesseract.js 7.0.0, tesseract.js-core 7.0.0 및 기존 tessdata_fast kor 모델을 그대로 사용했다. 실제 고정 로컬 소스의 createWorker/getCore/loadLanguage/initialize와 core의 wasmBinary 사용 지점을 확인했다. Tesseract 언어 객체 전달은 loadLanguage와 initialize의 처리 차이가 있어 사용하지 않았다. 이 판단은 해당 고정 소스 검토이며 다른 버전의 API 지원을 주장하지 않는다.

단일 HTML 안의 worker 문자열을 Blob worker로 실행한다. core JS를 worker에 미리 포함하고 검증된 WASM 바이트를 wasmBinary로 공급한다. private worker의 in-memory 공급기가 정확히 `memory-model:/kor/kor.traineddata` 요청에만 모델 바이트 Response를 반환하며 다른 요청은 거부한다. 원격 proxy나 file/CORS 우회가 아니다. PDF는 기존 main-thread 방식으로 렌더링하므로 PDF native worker의 file URL 성공으로 기록하지 않는다.

HTML CSP는 고정 스크립트 SHA-256, blob worker, WASM 실행만 허용하고 connect-src는 none이다. 브라우저 보안 완화/ignore-certificate/CORS 무시 옵션을 추가하지 않았다. 실행 경로에 CDN·클라우드 OCR·모델 다운로드·개발 서버가 없다.

## 실제 재시험 결과

Chromium 단독 실행에서 후보 생성 확인 후에만 Edge를 실행했다. 모두 fresh context / service worker 차단 / 빈 캐시 / browser offline 설정이었다. 이는 물리적 인터넷 단절 증명과 다르다.

| 단계 | Mac Chromium 156.0.8078.4 | Mac Edge 156.0.4314.42 |
| --- | --- | --- |
| 브라우저 시작, file HTML 로드 | PASS | PASS |
| SHA-256 및 스캔 PDF 렌더링 | PASS | PASS |
| 직접 추출 빈 문자열 확인 | PASS | PASS |
| Blob worker 부팅·자원 메시지 수신 | PASS | PASS |
| core 진입·WASM 공급·런타임 준비 | PASS | PASS |
| 한국어 모델 공급·초기화 | PASS | PASS |
| recognize 실제 후보 반환 | PASS | PASS |
| worker/PDF 및 브라우저 종료 | PASS | PASS |
| 취소 후 늦은 후보 게시 차단 | PASS | PASS |
| 합성 해시 거절 시 후보 게시 차단 | PASS | PASS |
| 자동 검사 합계 | 5 PASS / 0 FAIL / 0 건너뜀 | 5 PASS / 0 FAIL / 0 건너뜀 |
| 콘솔/페이지/미처리 Promise/CSP/외부 HTTP 요청 | 각각 0 | 각각 0 |

명령: `node experiments/kor-ocr-file-poc/test-browser.mjs chromium`, 통과 후 `node experiments/kor-ocr-file-poc/test-browser.mjs edge`. 둘 다 종료 코드 0. 상세 단계와 UTC 타임스탬프는 results/chromium.json[l], edge.json[l] 참조. Chromium 시험 전체 약 2.34초, Edge 약 5.56초. 관찰된 요청은 해당 로컬 HTML 하나이며 모델/WASM file fetch는 없다.

정상 OCR 작업: Chromium PDF 렌더 217ms / worker 초기화 74ms / recognize 241ms / 전체 533ms. Edge 265ms / 100ms / 365ms / 732ms. 단회 측정이며 성능 보장 수치가 아니다. 마지막 성공 단계는 두 브라우저 모두 실제 OCR 반환 및 자원 종료다. 이번 정상 실행에서 TIMEOUT은 0건이다. 강제로 무응답을 유발하는 timeout 분기 및 비상 kill 분기의 동적 시험은 NOT_RUN이다. 과거 Edge launch TIMEOUT 기록은 별도로 유지한다.

Windows OCR / 회사 업무 PC OCR / 물리적 네트워크 단절 시험 / 한자·세로쓰기·복잡한 제적등본·여러 쪽·모델 확대는 모두 NOT_RUN이다. 과거 Windows C1 성공을 OCR 성공으로 대체하지 않는다.

## 정확도와 실제 후보

기존 고정 scan-only.pdf (원래 OCR 표본 2쪽)를 그대로 사용했다. PDF 직접 추출은 비어 있고, 두 브라우저의 실제 OCR 후보는 동일했다. 날짜 `2002-03-04`, 관계 `배우자`, 번호 `23456 789`는 정규화 후 부분 문자열 기준으로 맞았지만 이름 `누리솔` 줄은 누락됐고 영문 제목도 잘못 인식했다.

고정 truth와 기존 metrics 함수를 그대로 사용한 NFC/공백 제거 CER은 22/67 = **32.84%** (치환 13, 삭제 9, 삽입 0)다. confidence 68은 정확도 68%를 뜻하지 않는다. 문자 오류의 자동 계산 하한과 사람이 실제 수정하는 비용을 구분한다. 후보 생성에는 성공했지만 성명/가족관계 사실 자동 확정에는 사용할 수 없다. 한자 기대 문자가 없는 이 표본으로 한자 성능을 평가할 수 없다.

## 생성물·해시·출처

`node experiments/kor-ocr-file-poc/build.mjs`는 기존 manifest/fixture lock의 SHA-256을 확인하고 생성한다. 누락/불일치 시 다운로드·교체 없이 실패한다. 생성 HTML은 **9,476,603 bytes**, SHA-256 `db5f35aee58da2ee6007e5d82e761c53f8b26026bed60f9b89169ce0873292f6`이다. 경로는 `experiments/kor-ocr-file-poc/generated/kor-ocr.html`; 실행에 필요한 고정 PDF/worker/core/WASM/kor가 모두 포함된다. 사용자 실행에는 Node/npm/서버 설치가 필요 없다. 개발용 재생성은 준비된 자원과 Node가 필요하다. 생성 HTML과 NOTICE는 gitignore하며 GitHub 저장소만 복사하면 대형 생성물이 자동 포함되는 것은 아니다.

| 자원 | 바이트 | SHA-256 |
| --- | ---: | --- |
| pdfjs | 860,818 | `dd13af821c9c3e1778653340d6539a1ba07bc56cba40073a4c727864cf0c232a` |
| pdfWorker | 2,229,713 | `07ceb740d746e5d9012fcf9f27d5c7dea09f7d2f5e74f5c8109e5787551a2333` |
| tesseract | 62,961 | `000c27d9cd0def655f77b36c72a389c0ab13793aa31cb4d7aab56d09c0afbc7e` |
| worker | 111,307 | `576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d` |
| core | 89,271 | `e48e2f02ddae3716c8dd24bf41cd290d4efa96892d689cdc4013c2545d63f469` |
| wasm | 2,857,601 | `34e8d50cac216427d86bf397d610fdd9f49492539bbcdfbfccc4eda20c810bea` |
| model | 1,677,415 | `6b85e11d9bbf07863b97b3523b1b112844c43e713df8b66418a081fd1060b3b2` |

고정 가공 PDF: 47,203 bytes, SHA-256 `2b1ddcf045a45a53dc73c543c5d815ea2f0ce46698290a44ee43df3614d4e372`. kor 출처는 `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd/kor.traineddata`, Apache-2.0이다. PDF.js는 mozilla/pdf.js, Tesseract.js는 naptha/tesseract.js, core는 naptha/tesseract.js-core의 기존 manifest에 기록된 고정 npm 배포 자원이다. PDF/Tesseract/model Apache-2.0 및 core의 동봉 LICENSE를 NOTICE에 포함한다. 기존 manifest의 라이선스/출처 기록을 유지하며 완전한 재배포 법률 감사가 완료됐다는 뜻은 아니다. 전체 경로·해시·원본 소스 대응은 results/build.json 및 기존 offline-ocr/results/assets-manifest.json 참조.

## 보호·회귀 및 판단

`node --test packages/inheritance-engine/test/*.test.mjs`: **135 PASS / 0 FAIL / 0 취소 / 0 건너뜀**, 종료 코드 0. 이번 재실행 기록은 results/node-regression.txt에 있다. 기존 C1/M2 브라우저·계산 화면 전체 회귀는 이번에 재실행하지 않았으므로 NOT_RUN이다. OCR 기존 평가 정답/manifest, C1/M2 엔진과 승인·truth·기존 C1 HTML은 수정하지 않았다. R04/R05 및 새 truth·날짜/의존 승인은 PENDING이며 M2 정상 배분은 활성화하지 않았다.

**A안은 Mac의 고정 한 쪽 한국어 OCR에 한해 기술 후보로 유지 가능**하다. Windows 회사 PC에서 동일 바이트의 HTML, Blob worker/WASM 정책, 메모리/크기/초기화, 물리적 오프라인 실행과 문서별 정확도를 별도 확인해야 한다. 완제품이나 제적등본 OCR 지원 완료로 포장하지 않는다. Windows 정책상 Blob/WASM/file 실행이 허용되지 않거나 규모 확장이 어려우면 B안 독립 실행기+loopback을 비교할 수 있다. 실행기 반입·서명·포트·loopback·보관 정책 승인과 유지보수 부담 확인이 선행돼야 하며 이번에 제작하거나 회사 설정을 변경하지 않았다.

이번에는 시험의 제한 시간·진단·종료 보완과 문서 보존까지만 마친다. OCR 통합, 모델 확대, 법률 확대, Windows 실행기 및 후속 개발을 자동 시작하지 않는다. 터미널 push/PR/main merge는 수행하지 않는다.
