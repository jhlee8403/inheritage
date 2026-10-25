# 축소형 V1 통합 시제품 보고서

기록: 2026-10-25 (Asia/Seoul). 기준 브랜치 feat/scoped-product-ocr-offline / `fc7b470afc3cc4a18129603a0c5d21ed959f2aeb`. 시작 시 실제 origin 브랜치 SHA와 로컬 HEAD가 일치했고 작업 트리는 clean이었다. 별도 브랜치 `feat/lite-v1-integrated-workbench`에서 신규 디렉터리만 작성했다. 기존 변경 삭제/reset/clean/강제 전환/main merge/push/PR을 수행하지 않았다.

최상위 범위는 PRODUCT_SCOPE_LITE_V1.md이며 이번 사용자 지시로 첫 통합 화면만 승인됐다. 법률 승인·날짜·truth·M2 지원 확대를 의미하지 않는다. 과거 독립 실험 기록은 수정하지 않는다.

## 구현과 보호

사용자 선택 PDF(File API), 페이지 수/이전·다음 이동, canvas 원문, 직접 추출, 명시적 한국어 OCR, 독립된 원문 후보와 수정 후보, 별도의 C1 수동 입력·계산·복사를 한 HTML에 제공한다. NEEDS_REVIEW는 원문 확인이 필요한 후보이며 법률 사실 승인이 아니다. 텍스트 없는 페이지는 상속인 부존재로 변환하지 않는다. 후보를 계산 입력에 자동 반영하는 코드는 없다.

C1은 기존 검증된 단일 HTML에서 스크립트 전체를 바이트 그대로 재사용한다. 생성 전 원본 C1 출력 및 소스 manifest SHA를 검증하고 단위 시험으로 스크립트 일치를 확인한다. 새 화면의 제목/안내/주변 CSS만 통합용으로 조합했다. 계산식·승인 레지스트리·truth·C1 API·스냅샷·세션 코드·기존 출력 파일은 변경하지 않았다. 기존 PDF/OCR 실험도 그대로 보존했다.

PDF.js 6.4.299의 기존 main-thread classic 패키징, Tesseract.js/core7.0.0 및 kor 모델의 검증된 Blob worker/wasmBinary/메모리 모델 Response 경로를 재사용한다. worker-adapter.js는 원본을 읽고 core factory 연결 부분도 기존 POC 생성기에서 읽어 검증한다. runtime HTTP/file 자원 fetch, CDN, 클라우드 OCR, 서버, 모델 다운로드는 없다. 생성 단계에서만 Node와 준비된 로컬 자원이 필요하다. 브라우저 보안/CORS 완화 옵션은 추가하지 않았다.

PDF는 페이지별로 직접 추출/OCR/수정 후보를 구분하고 문서 교체 시 Map을 새로 만든다. 문서 교체·페이지 이동·취소·수정 시 revision을 증가시키며 await 뒤에 현재 revision을 확인한다. 이전 작업의 늦은 성공·오류는 현재 후보를 덮어쓸 수 없다. 종료 오류의 늦은 게시도 현재 revision에 한정한다. worker 종료/Blob URL 회수/render 취소/PDF destroy를 제한 시간 내 수행하고 결과를 진단에 남긴다. 입력 텍스트는 value/textContent로만 표시한다.

문서·후보는 기본 메모리 보관이고 자동 영구 저장 기능은 없다. OS swap/브라우저 복구·클립보드 내용의 안전 삭제를 보장하지 않는다. 이미 외부에 복사한 결과를 회수하지 않는다.

## 자원·처리 제한

PDF 8 MiB, 10쪽, 렌더 canvas 4,000,000화소(올림한 실제 치수로 검사), 페이지별 텍스트100,000자. 한 번에 현재 페이지 canvas 하나와 OCR worker 하나만 사용한다. 파일 크기/페이지 수/후보 캐시/화소 제한으로 보수적으로 제한하지만 PDF 압축 해제·WASM heap을 포함한 브라우저 전체 메모리 상한이나 악성 PDF 내성을 보장하지 않는다. 복잡한 대형 문서/외부 폰트·CMap/암호 PDF/모든 PDF 기능 지원은 검증 범위 밖이다.

File API10초, PDF open/page/render 각15초, 직접추출10초, SHA5초, OCR 초기화20초, 파라미터5초, recognize15초, 전체작업45초, 자원 종료각2초. 브라우저 하네스 전체180초/종료각5초, 회귀명령각60초. 단계 로그를 JSONL에 즉시 기록한다. 타이머만으로 제3자 연산이 취소된다고 가정하지 않고 실제 worker/PDF 및 브라우저 종료를 병행한다.

## 실제 시험

완전 가공 기존 text-only.pdf/scan-only.pdf, 새 three-pages.pdf(기존 가공 텍스트+스캔+HTML처럼 보이는 일반 텍스트), 11쪽/과대 페이지/메모리 내 손상·과대 바이트 입력만 사용했다. fixtures.py와 fixtures.json으로 생성·해시·쪽 수를 기록했다. 기존 OCR 고정 정답/fixture를 수정하지 않았다. 정상 페이지 렌더링·문자 표시와 전체 화면 캡처도 확인했다.

| 시험 | Mac Chromium 156.0.8078.4 | Mac Edge 156.0.4314.42 |
| --- | --- | --- |
| 새 통합 file:// 화면 | 25 PASS / 0 FAIL / 0 NOT_RUN | 25 PASS / 0 FAIL / 0 NOT_RUN |
| 기존 C1 엔진 (loopback) | 20 PASS / 0 FAIL / 0 skip | 20 PASS / 0 FAIL / 0 skip |
| 기존 M2 S0/S1/검토 (loopback) | 33 PASS / 0 FAIL / 0 skip | 33 PASS / 0 FAIL / 0 skip |
| 기존 C1 단일 HTML (file://) | 17 PASS / 0 FAIL / 0 skip | 17 PASS / 0 FAIL / 0 skip |
| 기존 계산 화면 (loopback) | 18 PASS / 0 FAIL / 0 skip | 18 PASS / 0 FAIL / 0 skip |

Node C1+M2 전체: **135 PASS / 0 FAIL / 0 취소 / 0 skip**. 신규 생성 검증: **4 PASS / 0 FAIL / 0 skip**. 명령/종료코드·브라우저 버전·검사별 결과는 results/의 node-regression.txt, build-tests.txt, regressions.json 및 원본 결과 JSON에 보존했다. 모든 완료 명령 종료코드0. Node 24.22.0 개발 환경을 사용했다.

새 통합 25개 검사는 실제 파일 선택·직접 추출/한국어 OCR·수정 후보·C1 자동 반영 없음·3쪽 이동/페이지별 수정·문서 교체·HTML 비실행·실제 worker 부팅 후 취소·오래된 OCR 비동기 게시 차단·해시 거절 오류·해시 대기5초 TIMEOUT·손상 PDF·8MiB 초과·11쪽·화소 초과·C1 세 유형/정확 Q·UNKNOWN BLOCKED·분모0 ERROR·즉시 STALE/복사 차단·늦은 계산 차단·복사/선택 대안·자원 회수를 포함한다.

초기 두 브라우저 실행도 각각25개 통과했으며 결과는 initial-*.json으로 보존했다. 이후 실제 올림 화소 검사와 오래된 문서 종료 오류의 게시 제한과 오류 페이지의 OCR·편집 비활성화를 보완했고, 하네스의 URL 경로를 OS 파일 경로로 바꾸어 스크린샷 저장 위치를 수정했다. 이 시험이 잘못 저장한 두 캡처만 올바른 generated/ 경로로 옮기고 시험이 만든 빈 디렉터리만 정리했다. 최종 HTML SHA로 두 브라우저를 다시 시험했으며 위 표는 **최종 재실행 결과**다. 수정 전·후 수를 합쳐 통과 개수를 부풀리지 않았다.

통합 시험은 fresh 비영구 컨텍스트, 빈 캐시, service worker 차단, browser offline 설정에서 시작했다. 두 브라우저 모두 외부 HTTP 요청/콘솔 오류/페이지 오류/미처리 Promise 거절/CSP 위반 각각0건. 관찰된 초기 요청은 로컬 HTML 하나다. 과거 loopback 성공을 file 실행 성공의 증거로 대체하지 않았고, browser offline 에뮬레이션과 물리적 인터넷 단절은 구분한다.

복사: Mac Edge 기본 clipboard write 성공 메시지를 확인했고 Chromium 기본 쓰기는 거부되어 수동 전체 선택 대안이 동작했다. 강제 거절 시에도 양쪽 선택 대안을 시험했다. 통합 자동시험에서 OS 클립보드 실제 읽기/메모장 붙여넣기는 NOT_RUN이다. 기존 C1 회귀의 관찰과 Windows 사용자 수용시험도 이 결과와 별개다.

worker/Blob URL 개수는 취소·닫기 뒤0으로 확인했고 정상 OCR의 worker/PDF 작업 정리 상태와 브라우저 종료도 PASS다. PDF parser/WASM 내부 전체 메모리 프로파일링·GC 완료/완전 삭제 증명은 NOT_RUN이다. TIMEOUT은 실제 해시 완료를 붙잡은 OCR 파이프라인에서 재현했다. recognize 연산 자체 무응답 및 하네스 비상 kill 분기의 강제 실행은 NOT_RUN이다. 늦은 결과 시험은 실제 SHA 결과를 지연 후 해제하며, OCR 정답이나 계산 결과를 주입하지 않는다.

## OCR 품질과 업무 제한

실제로 한국어 후보가 생성됐지만 양 브라우저 모두 기존 표본의 가공 이름 ‘누리솔’ 줄을 누락하고 영문 제목을 오인했다. 기존 고정 truth 기준 CER32.84% 한계를 화면에 표시했다. 이번 통합의 후보도 같은 오류를 보이며 별도의 폭넓은 정확도 평가를 한 것은 아니다. confidence를 정확도로 취급하지 않는다. 한자/세로쓰기/복잡한 제적등본 품질 합격 또는 가족관계 사실 추출 성공을 주장하지 않는다.

C1 정상 계산 범위는 기존 승인 개시일2017-01-10 / 기준일2017-01-11 / BL1-LAW-2016-14409와 생존 성년 친생자녀/친생부모 및 법률혼 배우자의 세 유형뿐이다. 다른 날짜·대습·연속·구법·포기·입양·미확인 사실을 정상 계산으로 확대하지 않는다. R04/R05 및 새 truth·날짜·의존 승인은 PENDING이다. M2 실제 배분·OCR→계산 연결·실제 사건 적용은 하지 않았다.

## 생성물·전달

`experiments/lite-v1-workbench/generated/lite-v1.html`: **9,466,825 bytes** (약9.03MiB), SHA-256 **`412b514ac49907de994e17c99ccd52217c9ddfc02982714f67c7d774c4dfac99`**. NOTICE44,247 bytes. generated/는 Git에서 제외한다. 생성 검증에서 C1 스크립트 바이트 일치, 전체 HTML/CSP 해시, 재생성 바이트 동일성, 안내/NOTICE 해시를 확인했다.

개발 재현: `node experiments/lite-v1-workbench/build.mjs`. 가공 시험 PDF는 기존 Python/reportlab/pypdf 환경에서 fixtures.py로 재생성한다. 시험/생성 명령은 README에 있다. 자원이 없거나 기존 manifest 해시가 다르면 생성은 중단하며 다운로드·무단 교체하지 않는다. 사용자 PC에는 개발 도구 설치가 필요 없다.

Mac에서 직접 확인하려면 generated/lite-v1.html을 Edge 창으로 끌어 놓거나 연결 프로그램으로 Edge를 선택한다. 다른 PC에는 이 HTML, NOTICE.txt, Windows-시험안내.txt와 원하는 완전 가공 PDF만 승인된 매체로 전달한다. 폴더 이름/위치는 바꿔도 되며 Mac 서버·절대 경로·개발 폴더·캐시가 필요 없다. GitHub clone에는 대형 생성물이 없으므로 개발 Mac에서 생성한 HTML을 별도로 전달해야 한다. 설치 프로그램/독립 실행기는 만들지 않았다.

## 출처·버전·해시

| 자원 | bytes | SHA-256 |
| --- | ---: | --- |
| pdfjs | 860,818 | `dd13af821c9c3e1778653340d6539a1ba07bc56cba40073a4c727864cf0c232a` |
| pdfWorker | 2,229,713 | `07ceb740d746e5d9012fcf9f27d5c7dea09f7d2f5e74f5c8109e5787551a2333` |
| tesseract | 62,961 | `000c27d9cd0def655f77b36c72a389c0ab13793aa31cb4d7aab56d09c0afbc7e` |
| worker | 111,307 | `576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d` |
| core | 89,271 | `e48e2f02ddae3716c8dd24bf41cd290d4efa96892d689cdc4013c2545d63f469` |
| wasm | 2,857,601 | `34e8d50cac216427d86bf397d610fdd9f49492539bbcdfbfccc4eda20c810bea` |
| model | 1,677,415 | `6b85e11d9bbf07863b97b3523b1b112844c43e713df8b66418a081fd1060b3b2` |

원본 PDF.js/Tesseract.js/core는 기존 offline-ocr manifest의 고정 npm 배포 기록과 라이선스를 유지한다. 한국어 모델은 tessdata_fast 커밋 `87416418657359cb625c412a48b6e1d6d41c29bd`, 공식 출처 `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd/kor.traineddata`, Apache-2.0이다. PDF.js/Tesseract/model 및 core의 동봉 라이선스를 NOTICE에 포함했다. 전체 재배포 법률 감사 완료를 주장하지 않는다. results/build.json에 C1 원본 출력·소스, 새 소스·안내·NOTICE·모델 출처를 연결했다.

## Windows 및 남은 과제

**이번 통합 HTML의 Windows Edge / 실제 회사 PC / 실제 물리적 오프라인 시험은 전부 NOT_RUN**이다. WINDOWS_MANUAL_TEST.md의 체크리스트로 첫 실행·가공 PDF·페이지 이동/OCR·수정·취소·세 계산 유형·Q·UNKNOWN·분모0·STALE·메모장 붙여넣기를 확인해야 한다. 브라우저 버전/HTML 해시/실행일/오류를 함께 기록한다. 회사 file/Blob/WASM 정책이 막으면 중단하며 보안을 완화하지 않는다.

남은 축소형 제품 과제: 실제 Windows 환경·정책/오프라인 수용시험, 인명·한자·세로쓰기·다양한 가공 제적 서식의 품질 평가/개선, 사용자 원문 확인 흐름과 업무 안전성 검토, 메모리/복잡한 PDF 내구성·접근성·재배포 검토. 이번에 이 항목을 완료했다고 기록하지 않는다. 법률 기능 확대/M2 정상 배분/자동 사실 확정은 후속 과제로 자동 시작하지 않는다.
