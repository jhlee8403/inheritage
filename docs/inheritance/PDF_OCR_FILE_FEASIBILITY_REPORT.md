# Windows C1 후속 기록과 PDF/OCR A안 기술 검증

기록일: 2026-10-25 (Asia/Seoul). 기준 저장소 `jhlee8403/inheritage`, 브랜치 `feat/c1-offline-file-prototype`, 커밋 `423735396b4c386f1268a37e3cae81fcdd7267d3`. 시작 시 로컬·실제 git ls-remote 원격 HEAD 일치와 clean 작업 트리를 확인했다. 새 작업 브랜치는 `spike/pdf-ocr-file-feasibility`다. 기존 브랜치/변경을 삭제하거나 되돌리지 않았다. 최종 로컬 SHA와 작업 트리는 완료 채팅/git log로 확인한다. push·PR·merge는 하지 않는다.

## 1. Windows C1 사용자 시험 보존

별도 `C1_WINDOWS_MANUAL_ACCEPTANCE_01.md`에 회사 Windows Edge의 **사용자 구두 확인에 근거한 1차 수동 수용시험**을 기록했다. HTML 실행, 기본 가공 계산, 복사/메모장 붙여넣기, 배우자+부모, 자녀 균분, 입력 변경 후 이전 결과 제거, 실제 오프라인 실행은 각각 사용자 확인 PASS다. **분모 0 Windows ERROR 시험은 NOT_RUN**이다.

실제 시험 일시·Windows/Edge 버전·실행 파일 해시·전체 자동시험·정확한 외부 요청 로그·클립보드 정책 상세·보안 감사는 확인되지 않았다. 이를 이전 Mac 자동시험으로 채우지 않는다. 기존 `C1_OFFLINE_FILE_PROTOTYPE_REPORT.md`의 당시 Windows NOT_RUN 기록은 보존했다. C1의 사용자 시험 성공을 이번 Windows PDF/OCR 성공으로 취급하지 않는다.

## 2. 원래 OCR 자료의 위치와 이력

원래 `spike/offline-ocr`의 로컬·실제 원격 HEAD는 `513439d7b3d4eb901e4318737bfeef71c57b5177`이다. git merge-base --is-ancestor가 종료 0으로 이 커밋이 현재 기준의 조상임을 확인했다. 기준의 experiments/offline-ocr 파일과 STAGE_B_REPORT는 해당 커밋과 diff가 없다. 전체 브랜치를 병합하거나 OCR 코드를 다른 위치에 무분별하게 복사하지 않았다.

STAGE_B_REPORT, OCR_EVALUATION_PLAN, ENVIRONMENT_PLAN, DECISIONS, OCR README·engine/app·자원 준비 코드/manifest, 기존 C1 생성기와 보고서를 대조했다. 기존의 첫 실행 loopback OCR 성공은 과거 Chromium 측정이며 이번 file 성공이나 회사 Windows OCR 성공이 아니다. 원본 OCR 정답·평가 결과는 수정하지 않았다.

## 3. 실제 구성요소 관측

Mac Chromium **156.0.8078.4**, 실제 Mac Microsoft Edge **156.0.4314.42**를 사용했다. Edge 실행 경로는 `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`다. 이전 C1 검증의 Edge 155 결과를 복사하지 않았다. 브라우저의 새 비영구 컨텍스트·빈 캐시·emulated offline으로 시험했으며 물리적 망 단절 시험은 아니다. Chromium sandbox를 유지했다. CORS 무시·allow-file-access·보안 정책/프록시/TLS 변경·다운로드는 없다.

| 구성요소/정확한 시험 범위 | Mac Chromium | Mac Edge | Windows PDF/OCR |
|---|---|---|---|
| 기존 OCR 화면을 file://로 열기 | FAIL | FAIL | NOT_RUN |
| PDF.js 외부 ES Module file import | FAIL | FAIL | NOT_RUN |
| PDF.js 실제 module worker의 file URL 생성 | FAIL | FAIL | NOT_RUN |
| Tesseract classic script 자체의 file 로드 | PASS | PASS | NOT_RUN |
| Tesseract createWorker(기존 workerBlobURL:false) 초기화 | FAIL | FAIL | NOT_RUN |
| Tesseract SIMD LSTM .wasm의 file fetch | FAIL | FAIL | NOT_RUN |
| kor / eng / chi_tra 각 traineddata의 file fetch | 각각 FAIL | 각각 FAIL | NOT_RUN |
| 고정 텍스트 PDF 직접 추출: 메인 스레드 내장 경로 | PASS | PASS | NOT_RUN |
| 동일 고정 PDF 첫 페이지 canvas 렌더 | PASS | PASS | NOT_RUN |
| 스캔 PDF recognize / OCR 정확도 | NOT_RUN | NOT_RUN | NOT_RUN |
| WASM 실제 실행·언어 모델 초기화·한자 인식 | NOT_RUN | NOT_RUN | NOT_RUN |
| PDF.js 추가 CMap/표준 글꼴/codec WASM 로딩 | NOT_RUN | NOT_RUN | NOT_RUN |

현재 원래 파일 경로 구성은 ES Module, worker, 모델 fetch에서 file origin 제약과 양립하지 않는다. 그러나 **모든 A안이 원천 불가능하다고 확정하지 않는다.** 이번에 실험하지 않은 Blob worker·자원 바이트 내장/공급·core의 wasmBinary 경로 검토는 **PROPOSED**다. 이를 실제 PASS 또는 현재 지원 기능으로 기재하지 않는다.

실패 원문은 results/file-results.json에 단계/stack별로 보존했다. 주요 오류는 다음과 같다.

- PDF import: `TypeError: Failed to fetch dynamically imported module`.
- PDF worker: `SecurityError: Failed to construct 'Worker': Script at '<ocr>/public/vendor/pdfjs/pdf.worker.mjs' cannot be accessed from origin 'null'.`
- Tesseract: 같은 SecurityError가 worker.min.js의 createWorker/spawnWorker에서 발생했다. 인식 함수에는 도달하지 않았다.
- WASM/모델: `TypeError: Failed to fetch`, 콘솔에는 `from origin 'null' has been blocked by CORS policy`와 `net::ERR_FAILED`가 기록됐다. 파일은 모두 존재하며 해시도 일치했으므로 모델 누락으로 오인하지 않는다. fetch 실패가 WASM 엔진 자체의 미지원이나 각 언어의 인식 실패를 뜻하지 않는다.

구성요소 관측은 브라우저당 **PASS 3 / FAIL 8 / NOT_RUN 2**의 13개 원시 행이다. 표의 마지막 추가 자원 로딩·PROPOSED 대안은 별도 미실시/검토 항목이며 원시 행 개수에 넣지 않았다. 실패를 시험기 종료 0이라는 이유로 PASS로 바꾸지 않는다.

## 4. 제한된 직접 PDF 실험

`experiments/pdf-ocr-file-feasibility/`에 분리했다. 기존 소형 `fixtures/text-only.pdf` 13,602 bytes, SHA-256 `236cdab97cb7f40ee3a546671920ff70215612cd572f65bc03b6ab96d20ccb04`를 고정 내장한다. 실제 사건자료·파일 업로드·OCR·상속 계산 연결은 없다. 원래 1쪽 가공 PDF이며 pypdf로 페이지 수/텍스트를 독립 확인했다. 한자 PDF·임의 PDF의 일반 지원은 검증하지 않았다.

C1 생성기의 인라인화 개념은 적용 가능했지만 C1의 제한된 모듈 연결기를 그대로 PDF.js에 적용하지는 않았다. PDF.js 고정 export를 classic wrapper로 옮기고 import.meta.url을 미사용 Node/자원 분기의 비활성 식별 문자열로 바꾼다. 기존 vendor 파일은 변경하지 않는다. 먼저 PDF.js WorkerMessageHandler 코드를 같은 문서에 내장해 라이브러리의 기존 main-thread 경로로 처리한다. 실제 worker 생성 성공이 아니며 worker-src 'none', connect-src 'none', useWasm:false, isEvalSupported:false다. 메인 스레드 처리의 성능·취소·대용량 문서 지원을 검증한 것은 아니다.

한쪽 833×1179 canvas, 어두운 픽셀 5,669개를 확인하고 두 브라우저의 PNG도 시각 검수했다. 후보 텍스트는 기존 truth 첫 표본의 전체 문구와 NFC/공백 제거 비교에서 일치했다. 결과는 NEEDS_REVIEW로만 표시한다. 성명/날짜/관계를 사실 또는 상속인으로 확정하지 않는다.

직접 실험은 브라우저당 검증 assertion **4 통과 / 0 실패 / 0 건너뜀**이다. 고정 원문 일치, 비어 있지 않은 렌더, 1쪽/후보 상태, 오류·추가 요청 부재를 확인했다. 최초 실행의 시험기에는 PDF를 2쪽으로 가정한 오류가 있어 각 브라우저 3 통과/1 실패가 있었다. 원본을 pypdf로 독립 확인한 뒤 시험의 페이지 수만 1로 수정했다. 원본 PDF·고정 truth를 출력에 맞춰 바꾸지 않았다. 초기 기록은 `/private/tmp/inheritage-pdf-file-initial-result.json`에 보존했고 최종 결과를 별도 기록했다.

직접 실험 문서의 콘솔/페이지 오류·미처리 Promise 거절·CSP 위반·외부 HTTP(S) 요청은 0건이며 HTML 문서 외 자원 요청도 없다. 원래 경로와 원시 자원 probe에는 예상된 CORS 오류가 있으므로 실험 전체의 콘솔 오류가 0이라고 주장하지 않는다. 예상 밖 page/Promise 오류는 없었다. 소스의 로컬 절대 경로는 결과 JSON에서 <ocr>/<generated>/<repo>로 가렸다.

생성 파일은 `generated/direct-text.html`, **3,111,400 bytes**, SHA-256 `65ca1e1ee1a94653804b0c032f8a746c4dd958aaf5b4240fcde63444a9923978`이다. Edge로 열고 가공 PDF 시험 버튼을 누르면 된다. 이 파일 자체의 실행에는 Node/서버가 필요 없다. 다만 최종 배포본이 아니라 고정 표본 기술 실험이며 vendor 내장 파일·NOTICE는 Git에서 제외했다. 생성기·앱·출처/해시·시험 기록만 커밋한다.

## 5. 자원 검증·출처·재배포 한계

기존 자원 **228개 / 60,220,200 bytes**를 읽기 전용으로 검사해 잠금 manifest의 크기/SHA-256과 모두 일치했다. 모델 합계는 **8,157,145 bytes**다. 누락/불일치 때 중단하며 재다운로드·해시 갱신으로 숨기지 않는다. 개별 목록/공식 고정 출처/라이선스/크기/해시는 results/assets-audit.json과 원래 assets-manifest.json에 있다. 이번에는 공식 사이트를 재다운로드하여 새 진위 인증을 한 것이 아니라 기존 출처 기록·로컬 파일/라이선스를 확인했다.

| 주요 자원 | bytes | SHA-256 | 출처/라이선스 기록 |
|---|---:|---|---|
| PDF.js pdf.mjs | 860818 | dd13af821c9c3e1778653340d6539a1ba07bc56cba40073a4c727864cf0c232a | pdfjs-dist 6.4.299 / mozilla/pdf.js / Apache-2.0 |
| PDF.js pdf.worker.mjs | 2229713 | 07ceb740d746e5d9012fcf9f27d5c7dea09f7d2f5e74f5c8109e5787551a2333 | 위와 같음 |
| Tesseract worker.min.js | 111307 | 576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d | tesseract.js 7.0.0 / naptha/tesseract.js / Apache-2.0 |
| SIMD LSTM WASM | 2857601 | 34e8d50cac216427d86bf397d610fdd9f49492539bbcdfbfccc4eda20c810bea | tesseract.js-core 7.0.0 / Apache-2.0 |
| kor.traineddata | 1677415 | 6b85e11d9bbf07863b97b3523b1b112844c43e713df8b66418a081fd1060b3b2 | tessdata_fast 고정 revision / Apache-2.0 |
| eng.traineddata | 4113088 | 7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2 | 위와 같음 |
| chi_tra.traineddata | 2366642 | 529c5b5797d64b126065cd55f2bb4c7fd7b15790798091b1ff259941a829330b | 위와 같음 |

모델 고정 revision은 `87416418657359cb625c412a48b6e1d6d41c29bd`이며 원래 출처는 `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/<revision>/<lang>.traineddata`다. 기존 자원 준비 스크립트/잠금 npm integrity와 fixture 생성 이력을 보존했다. 직접 실험의 generated/NOTICE.txt에는 PDF.js Apache 원문과 기존 Noto Sans KR OFL 고지를 넣었다. 이것이 전체 codec/전이 자원/제품 재배포 고지를 모두 검토 완료했다는 뜻은 아니다. 광범위한 재배포·용량 최적화·장기 메모리/성능은 별도 검토가 필요하다.

## 6. 실행과 회귀

Node v24.22.0. 실제 명령은 다음과 같으며 최종 종료 코드는 모두 0이다. file 시험기 종료 0과 구성요소 FAIL/NOT_RUN의 구분은 위 표를 따른다.

```sh
node experiments/pdf-ocr-file-feasibility/assets.mjs
node experiments/pdf-ocr-file-feasibility/build-direct.mjs
node --test experiments/pdf-ocr-file-feasibility/build.test.mjs
node experiments/pdf-ocr-file-feasibility/test-file.mjs
npm test --prefix packages/inheritance-engine
npm run test:browser:m2 --prefix packages/inheritance-engine
node experiments/c1-offline-file-prototype/test/browser-file.mjs
npm run test:unit --prefix experiments/offline-ocr
```

| 시험 | 통과 | 실패 | 건너뜀 |
|---|---:|---:|---:|
| 새 자원 무결성/생성 재현성 Node 시험 | 2 | 0 | 0 |
| 새 PDF file 검증 assertion — Chromium / Edge | 각각 4 | 0 | 0 |
| 기존 C1+M2 Node 전체 | 135 | 0 | 0 |
| 기존 M2 브라우저 — Chromium / Edge | 각각 33 | 0 | 0 |
| 보호한 C1 단일 HTML file 회귀 — Chromium / Edge | 각각 17 | 0 | 0 |
| 기존 OCR 문자 평가 지표 단위 시험 | 2 | 0 | 0 |

기존 회귀의 브라우저 오류·미처리 Promise 거절·외부 요청은 0건이었다. 이전 C1 단일 HTML/생성기·C1/M2 엔진·OCR 원본/정답/평가 결과·승인 문서에 git diff가 없음을 확인했다. 기존 OCR 전체 정확도/시간 평가 및 Windows OCR, 원본 C1 loopback 20개·수동 화면 loopback 18개는 이번에 재실행하지 않았다. 옛 통과 건수를 이번 실행으로 표시하지 않는다.

신규 영구 기록은 results/assets-audit.json, direct-build.json, file-results.json이다. 기존 회귀의 임시 로그는 `/private/tmp/inheritage-pdf-file-node.txt`, `inheritage-pdf-file-m2.txt`, `inheritage-pdf-file-c1-regression.txt`, `inheritage-pdf-file-ocr-unit.txt`, `inheritage-pdf-file-build.txt`에 있다. 임시 로그의 영구 보존을 보장하지 않으며 재현 코드를 커밋한다.

## 7. 다음 판단 기준과 범위

- 최소 다음 단계 후보: 이번 **고정 1쪽 텍스트 PDF** 직접 추출/표시만 Windows Edge에서 수동 확인하고 버전/파일 해시/실제 오프라인 상태를 기록한다. 통과해도 OCR·임의 PDF 지원 승인이 아니다. 이후 별도 범위에서 내장 글꼴/CMap 등이 다른 가공 PDF를 소수 추가할 수 있다.
- OCR A안은 기존 file worker/model URL 구성으로 성립하지 않았다. 표준 Blob worker와 내장 자원 바이트 공급은 PROPOSED이며 이번에 구현하지 않았다. Windows 정책·CSP·메모리·시작 시간·모델 초기화·후보 품질·외부 요청을 실제로 확인하기 전에는 가능하다고 약속하지 않는다. 메인 스레드 PDF PASS가 OCR PASS를 대신하지 않는다.
- A의 승인된 안전 경로가 실제 업무 PC에서 성립하지 않으면 B(독립 실행기+loopback)를 검토한다. 관리자는 실행물 반입/서명/포함 런타임·보안 제품·localhost/포트·종료/충돌 정책을 확인해야 한다. 사용자에게 Node/Python 설치를 요구하는 개발 서버로 목표를 대체하지 않는다. 실행기·설치 프로그램·포트 허용/보안 정책 변경은 이번에 하지 않았다.

R04/R05·새 truth·날짜·의존 승인은 계속 PENDING이다. 인식 텍스트를 CONFIRMED 사실로 바꾸거나 계산 엔진에 연결하지 않았다. 실제 사건자료/개인정보는 사용하지 않았다. 후속 PDF/OCR 통합·법률 확대·Windows 실행기 제작은 자동 시작하지 않는다.

변경은 독립 Windows 사용자 시험 기록, 이 보고서, `experiments/pdf-ocr-file-feasibility/`의 소형 생성/시험 코드·README·잠금 비교 결과뿐이다. generated/와 기존 vendor/model은 Git에 넣지 않는다.
