# PDF/OCR file:// 실행 가능성 실험

기존 `spike/offline-ocr` / `513439d7b3d4eb901e4318737bfeef71c57b5177` 자원을 참조한다. 이 커밋은 작업 기준 `423735396b4c386f1268a37e3cae81fcdd7267d3`의 조상이고 해당 OCR 디렉터리는 기준에 동일하게 포함되어 있다. 원래 브랜치를 병합하거나 원본 OCR·정답·C1/M2 코드를 수정하지 않는다.

## 범위

기존 1쪽 `text-only.pdf`를 고정 내장한 직접 추출/표시 실험만 만든다. 모든 문구는 기존 완전 가공 표본이다. 인식/추출 결과는 NEEDS_REVIEW이며 사람·가족관계·법률 사실을 확정하지 않는다. 파일 업로드·OCR 실행·상속 계산·C1 화면 연결은 없다.

PDF.js의 기존 전역 WorkerMessageHandler 선로딩 경로로 메인 스레드에서 처리한다. 이는 실제 worker 성공이 아니며 `worker-src 'none'` 상태다. useWasm:false와 isEvalSupported:false를 사용하고 네트워크 연결을 금지한다. CMap/추가 표준 글꼴/codec 자원을 요구하는 일반 PDF를 지원한다고 주장하지 않는다.

기존 C1처럼 자원을 인라인화하되 PDF.js의 단일 export 구문을 classic wrapper로 옮기고 import.meta.url을 미사용 분기의 식별 문자열로 바꾼다. 원본 vendor는 수정하지 않는다. PDF 처리 알고리즘을 별도로 만들지 않는다. 순환/범용 모듈 변환기가 아니며 현 고정 버전만 검증했다.

## 재현 — 개발 Mac에서만

이미 준비된 기존 OCR node_modules/public 자원이 필요하다. 누락/해시 불일치 시 중단한다. 이 실험은 npm install·prepare:assets·모델 다운로드를 실행하지 않는다. 새 환경에서 자원이 없으면 원래 고정 출처/라이선스와 자원 준비 절차를 별도 확인해야 한다.

```sh
node experiments/pdf-ocr-file-feasibility/assets.mjs
node experiments/pdf-ocr-file-feasibility/build-direct.mjs
node --test experiments/pdf-ocr-file-feasibility/build.test.mjs
node experiments/pdf-ocr-file-feasibility/test-file.mjs
```

생성된 `generated/direct-text.html`을 Edge로 열고 **가공 PDF 시험**을 누른다. 실행 자체에는 개발 서버/Node가 필요 없다. generated/에는 약 3.1MB의 vendor 내장 HTML과 PDF.js/Noto 고지 파일이 생기며 Git에서 제외한다. 대용량 라이브러리/모델을 커밋하지 않는다. 결과의 크기/해시/출처와 변환은 results/direct-build.json 및 assets-audit.json에 보존한다. 재배포 고지 전체를 검토 완료한 최종 배포본이 아니다.

test-file.mjs는 기존 화면/ES Module/native worker/Tesseract worker/file fetch의 실패를 각각 실제 관측하고, 별도 main-thread 직접 PDF 실험을 확인한다. 페이지의 예상 CORS/SecurityError는 그대로 기록한다. 실행기 종료 0은 실패한 OCR 구성요소를 PASS로 바꾸는 것이 아니라 실험/assertion 완료를 뜻한다. 각 구성요소 상태는 results/file-results.json에서 본다. 브라우저는 새 비영구 컨텍스트와 emulated offline을 사용하며 물리적 망 단절은 아니다. 보안 해제 옵션은 사용하지 않는다.

스캔 recognize, WASM 실행, 언어 모델 초기화, 한자 인식, Windows PDF/OCR은 NOT_RUN이다. file 리소스 fetch의 FAIL과 이 미실시 상태를 구분한다. Blob worker/모델 바이트 내장 대안은 PROPOSED일 뿐 구현하지 않는다. B안 실행기도 만들지 않는다. 전체 판단과 회귀 결과는 `docs/inheritance/PDF_OCR_FILE_FEASIBILITY_REPORT.md`를 참조한다.
