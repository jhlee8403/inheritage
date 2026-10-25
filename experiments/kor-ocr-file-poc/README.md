# 한국어 file:// OCR 최소 실험

완전 가공 스캔 PDF 한 쪽에만 사용하는 기술 실험이다. 실제 문서 업로드, 상속인 자동 확정, 계산 엔진 연결 기능은 없다.

저장소 루트에서 개발용 Node 24와 이미 준비된 `experiments/offline-ocr/`의 고정 자원을 사용한다. 자원이 없거나 SHA-256이 다르면 생성기가 실패하며 다운로드하지 않는다.

```sh
node experiments/kor-ocr-file-poc/build.mjs
node experiments/kor-ocr-file-poc/test-browser.mjs chromium
# Chromium에서 실제 후보 생성이 확인된 뒤에만:
node experiments/kor-ocr-file-poc/test-browser.mjs edge
```

생성된 `generated/kor-ocr.html`을 Edge에서 파일로 연 뒤 ‘가공 스캔 OCR’을 누른다. 최종 사용자 실행에는 서버/Node/npm이 필요 없다. Windows에서는 아직 시험하지 않았다. 생성 HTML과 NOTICE는 대형 자원 때문에 Git에서 제외한다. 전달할 때 둘을 함께 제공해야 하며, 아직 제품 배포본이 아니다.

브라우저 시험은 기본 Chromium 한 개만 실행한다. 단계 시작/종료를 표준 출력과 `results/<browser>.jsonl`에 즉시 추가하고, 현재 결과를 `<browser>.json`에 저장한다. 재실행 시 JSONL은 누적되고 요약 JSON은 갱신된다. 기존 중단 전 `browser.json`, `prior-browser.json`, `prior-initial-failure.json`은 보존했다.

앱: SHA-256 5초, PDF 각 단계 15초, worker/core/WASM/model 초기화 전체 20초, 파라미터 5초, recognize 15초, 전체 작업 45초. worker 자원 메시지 10초, worker/PDF 종료 각각 2초. 초기화 내부 진행 메시지로 worker 생성·메시지 수신·core 진입·WASM 공급/런타임 준비·모델 공급/초기화를 구분한다. 제3자 초기화 내부의 각 연산은 공통 20초 제한 안에 포함된다.

시험: 브라우저 시작 20초(외부 제한 25초), 파일 로드 15초(외부 17초), 일반 API 10초, OCR 관찰 47초(외부 49초), 종료 각각 5초, 시험 프로세스 절대 제한 100초. 절대 제한 시 이 실행의 BrowserServer가 반환한 PID만 정리한다. 기존 다른 브라우저를 검색해서 종료하지 않는다. JavaScript Promise의 제한 시간 자체가 기저 연산을 취소하지 않으므로 앱은 worker 종료/PDF destroy를 수행하고, 하네스는 소유 브라우저 종료 후 독립 프로세스를 끝낸다.

출처·해시는 `results/build.json`과 기존 `../offline-ocr/results/assets-manifest.json` 참조. 인식 결과는 NEEDS_REVIEW 후보일 뿐이다. 이름 누락 등 정확도 한계와 Windows NOT_RUN은 `../../docs/inheritance/KOR_OCR_FILE_POC_REPORT.md`에 기록했다.
