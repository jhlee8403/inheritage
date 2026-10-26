# 축소형 V1 통합 시제품

제품 범위: `docs/inheritance/PRODUCT_SCOPE_LITE_V1.md` 및 이번 통합 화면 승인. 가공 사례 전용. PDF/OCR 후보는 C1 입력과 독립이며 자동 사실 확정·자동 반영·자동 영구 저장을 하지 않는다.

## 사용자 실행

이미 생성된 `generated/lite-v1.html`을 Microsoft Edge로 연다. file:// 주소로 실행되며 서버·Node·npm·Python·Git 설치가 필요 없다. PDF 선택 → 원문/직접 추출 확인 → 필요한 페이지에서 한국어 OCR → 후보 수정. C1 영역에는 필요한 사실을 별도로 직접 입력한다.

Mac에서도 같은 HTML을 Edge 창에 끌어 놓거나 파일의 연결 프로그램을 Edge로 선택하면 된다. 계산 입력·결과 복사 방법은 기존 C1과 같다. 자동 복사가 거부되면 결과 텍스트 선택 후 Edge 복사 메뉴 또는 Ctrl+C (Mac Command+C)를 사용한다.

Windows 통합 시험은 NOT_RUN이다. `WINDOWS_MANUAL_TEST.md`의 전달 파일·수동 시험 절차를 따른다. 기존 C1 단독 Windows 시험을 통합 PDF/OCR 합격으로 해석하지 않는다. HTML과 NOTICE 및 안내를 함께 전달한다. 생성 HTML은 Git 제외이므로 GitHub clone만으로 사용자용 파일이 준비되는 것은 아니다.

## 개발용 재현

Node 24 및 기존 `offline-ocr/`의 고정 vendor·모델 자원이 필요하다. 생성기는 manifest SHA-256을 검사하며 다운로드하지 않는다. 기존 C1 출력 manifest와 소스 SHA가 다르면 중단한다. 기존 C1/OCR/법률 파일을 수정하지 않는다.

```sh
node experiments/lite-v1-workbench/build.mjs
# 기존 Python/reportlab/pypdf 개발 환경에서만: 가공 시험 PDF 생성
python3 experiments/lite-v1-workbench/fixtures.py
node --test experiments/lite-v1-workbench/build.test.mjs
node experiments/lite-v1-workbench/test-browser.mjs chromium
# Chromium 실제 OCR 통과 뒤:
node experiments/lite-v1-workbench/test-browser.mjs edge
node --test packages/inheritance-engine/test/*.test.mjs
node experiments/lite-v1-workbench/regressions.mjs
```

개발 환경의 Python 의존성과 사용자 실행 요구를 혼동하지 않는다. 시험 PDF는 기존 고정 가공 1쪽 텍스트/스캔과 새 3쪽 합성 PDF, 11쪽 제한 초과, 과대 페이지 및 메모리 생성 손상/과대 바이트 입력만 사용한다. 기존 OCR truth는 수정하지 않는다.

브라우저 하네스는 각 검사 15초(실제 OCR 45초), 각 Playwright API 기본 10초, 시작 20초(외부25초), 파일 로드15초(외부17초), 종료 각각5초, 전체180초로 제한한다. 각 단계 시작·종료는 JSONL에 즉시 추가하고 결과 JSON을 갱신한다. 기존 회귀 명령은 각각60초 제한이다. 실패 시 미실행 검사를 PASS로 기록하지 않는다.

## 구현 경계와 한도

- C1 스크립트: 검증된 `c1-offline-file-prototype/output/c1-calculator.html`에서 그대로 삽입한다. 계산식·공개 API·확인 상태·스냅샷·세션·정답을 복제하거나 변경하지 않는다. 생성 단위 시험에서 원본과 바이트 일치를 확인한다.
- PDF.js 메인 스레드 렌더링과 Tesseract Blob worker/core/WASM/kor 메모리 공급은 기존 file POC 경로를 사용한다. native PDF worker file fetch 성공을 주장하지 않는다.
- PDF 8 MiB, 최대10쪽, canvas 400만 화소, 페이지별 후보10만 자. 한 번에 한 OCR worker, 현재 페이지 canvas 하나만 유지한다. 파일/페이지/캐시/시간으로 자원 사용을 제한하지만 WebAssembly/PDF 디코더의 실제 전체 프로세스 메모리 상한은 보장하지 않는다.
- File API 10초, PDF 각 단계15초(직접추출10초), SHA-256 5초, OCR 초기화20초, 파라미터5초, recognize15초, 작업 전체45초. worker/PDF 종료 각각2초. 외부 입력의 동기 디코딩으로 브라우저 자체가 응답하지 않는 위험까지 제거됐다는 뜻은 아니다.
- 문서 교체·페이지 이동·취소·후보 수정은 작업 revision을 증가시킨다. await 이후 현재 revision을 확인하고 오래된 결과를 게시하지 않는다. worker terminate/URL revoke/render cancel/PDF destroy를 수행한다. 실패하면 오류와 정리 상태를 기록한다.
- 문서·직접 추출·OCR 원문·수정 후보는 메모리에만 유지한다. OS swap/브라우저 복구·클립보드의 안전 삭제를 보장하지 않는다.
- 개시일2017-01-10 / 기준일2017-01-11 / BL1-LAW-2016-14409. R04/R05 PENDING. 새 날짜·법률·truth·M2 배분 미지원.
- 기존 kor 가공 표본 CER32.84%, 이름 누락. 한자·세로쓰기·복잡한 제적등본 품질 미검증. 실제 사건 사용 불가.

소스·버전·SHA·모델 출처는 `results/build.json`, 라이선스는 생성 NOTICE, 실제 시험은 `results/`와 `docs/inheritance/LITE_V1_INTEGRATED_WORKBENCH_REPORT.md` 참조. 생성물과 가공 PDF/스크린샷은 generated/에 두고 Git에서 제외한다.

## 2026-10-25 초기화 진단 보완

이후 회사 Windows 사용자 보고에서 C1은 동작하고 PDF 최초 진단부터 비어 있는 문제가 확인됐다. 실제 회사 원인은 미확정이며 수정본 Windows 검증도 NOT_RUN이다. 기존 완료 기록을 소급 변경하지 않는다.

생성 HTML은 독립 초기화 감시 → C1 시작 표시 → 원본 C1 스크립트 → C1 완료 확인 → PDF 시작 표시 → PDF 전용 스크립트의 여섯 인라인 스크립트로 분리한다. 각각의 CSP SHA-256을 기록한다. C1 스크립트 자체는 동일 바이트다. PDF worker 코드 평가/PDF.js/Tesseract/PDF 앱 리스너/최초 diagnostics 완료를 표시하고, 실행 예외·뒤쪽 구문 오류·CSP 차단·완료 신호 누락을 화면에서 구분한다. 파일 선택은 PDF 초기화 READY 이후에만 허용한다. 전체 JavaScript가 막혔을 때는 정적 미실행 안내가 남는다. 10초 감시는 이벤트 루프가 실행될 때 동작하며 OS 중단·동기 무한 루프까지 해결하는 것은 아니다.

```sh
node experiments/lite-v1-workbench/build.mjs
node --test experiments/lite-v1-workbench/build.test.mjs
INHERITAGE_LITE_INIT_PROBE=1 INHERITAGE_LITE_RESULTS=results/windows-initialization/ node experiments/lite-v1-workbench/test-browser.mjs chromium
INHERITAGE_LITE_RESULTS=results/windows-initialization/ node experiments/lite-v1-workbench/test-browser.mjs chromium
# 실제 Mac Edge 실행 가능 시, 별도 단독 실행:
INHERITAGE_LITE_INIT_PROBE=1 INHERITAGE_LITE_RESULTS=results/windows-initialization/ node experiments/lite-v1-workbench/test-browser.mjs edge
```

새 시험 결과는 windows-initialization/에 따로 저장한다. CSP/구문 실패용 HTML은 하네스가 generated/init-*.html로 만들며 사용자에게 전달하지 않는다. 과거 browser JSON과 실험 결과를 덮어쓰지 않는다. 시험은 API 부재·초기화 실패를 가공해서 확인하는 것이며 특정 구버전 Windows Edge를 실제 실행한 검증이 아니다.

## 2026-10-26 Edge 104 호환판

회사 사용자에게서 Edge104.0.1293.47 / PDF_WORKER_CODE / `Iterator is not defined`가 확인됐다. 최종 호환판은 **공식 PDF.js4.2.67 legacy main/worker**를 함께 사용한다. 6.4.299 modern 및 같은 버전 legacy의 시험을 새 버전 성공으로 옮기지 않았다. 실제 Mac Chromium104·최신 Chromium·Mac Edge에서 각각25개를 다시 검증했다. 회사 Windows 수정본은 NOT_RUN이다.

개발 재생성 전 `compat/README.md`대로 고정 자원을 준비해야 한다. vendor와 생성 HTML은 Git 제외이며 GitHub clone만으로 배포 파일이 생기는 것은 아니다. 사용자에게는 `generated/lite-v1.html`, NOTICE, 최신 Windows 안내만 전달한다. `edge104-dev/`는 개발 시험 전용으로 전달하지 않는다. C1 원본·법률·truth·OCR 모델/정답은 유지한다. 구버전 PDF.js의 유지보수/보안 한계와 선택 근거는 `docs/inheritance/LITE_V1_EDGE104_COMPATIBILITY_REPORT.md`에 기록했다.
