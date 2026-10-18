# 단계 B — 로컬 B1 PDF·OCR 최소 기능 검증

작성일: 2026-10-18 (Asia/Seoul). **B0 통과 / B1 최소 기능 구현·시험·기록 완료. OCR 정확도 합격·업무 배포 승인은 아님.** 법률 규칙·정답 후보는 전부 PENDING 유지.

## 1. 작업 기준·범위·Git

- 대상: `jhlee8403/inheritage`, origin `https://github.com/jhlee8403/inheritage.git`.
- 실제 작업 폴더: Mac 로컬 `~/Desktop/상속분프로그램`. Cloud가 아니다.
- 기준: `docs/inheritance-design` / `8776506daf2da153feb64084b420bc6ae84fee39`.
- 실제 브랜치: `spike/offline-ocr`. 이 보고서 생성 시 HEAD: `d50416d2563979a4142ab4ef418807c45ce89e86`.
- 가공 표본 커밋: `4669a38`. 구현 커밋: `d50416d`. 보고서 자신을 포함하는 최종 커밋 해시는 순환 기재하지 않고 Git 로그·최종 답변으로 식별한다.
- 필수 단계 A 문서 10개(CODEX_HANDOFF, DECISIONS, DATA_MODEL, ENGINE_DESIGN, OCR_EVALUATION_PLAN, ENVIRONMENT_PLAN, TEST_PLAN, RULES_DRAFT, LEGAL_REVIEW_QUEUE, RUN_LOG)를 다시 읽었다. 단계 A 원문은 수정하지 않았다.
- 실험은 `experiments/offline-ocr/` 아래에 분리했다. main·기준 브랜치 변경, force push, history 재작성, PR·merge 없음.
- 로컬 Git 작성자 설정이 없어 자동화 작성자 `Codex <codex@localhost>`를 커밋 명령별로만 지정했다. 개인 이메일·전역 설정은 추가하지 않았다.

## 2. 로컬 B0 환경과 승인

macOS 26.5.1, Apple Silicon arm64, Git 2.50.1 (Apple Git-155), Command Line Tools 설치 확인. Node v24.22.0, npm 11.19.1. Node는 공식 tarball의 SHA-256 검증 후 사용자 폴더 `~/.local/share/node-v24.22.0-darwin-arm64`에 설치됐다. 새 zsh 로그인 셸 PATH는 `~/.local/bin`을 포함한다.

대상 저장소 clone·원격 기준 브랜치 조회, npm registry ping, 공식 OCR 모델 주소 HEAD가 실제 성공했다. 제한된 명령 실행 환경의 DNS 실패는 표준 `require_escalated` 요청 후 해결됐다. 과거 Cloud proxy:8080 실패를 현재 제약으로 적용하지 않았다. 프록시 제거·TLS 검증 해제·네트워크 정책 변경·sudo·브라우저 보안 해제는 수행하지 않았다.

개발 브라우저는 Chromium 156.0.8078.4, Playwright의 별도 임시 headless 컨텍스트다. Safari 존재도 B0에서 확인했으나 본시험에 사용하지 않았다. 로컬 Microsoft Edge 미설치, Edge·업무 PC 시험 **미실시**. 실제 모델/추론 강도 설정은 이 작업에서 조회·변경하지 않았다.

## 3. 구현된 최소 기능

PDF 파일 선택, 페이지 선택/렌더링, 정상 텍스트층 직접 추출, 텍스트 없는 페이지와 텍스트 면적이 적은 이미지 영역 OCR, 원문/후보 대조, 페이지·좌표 연결, 영역 드래그 재OCR, 수동 수정, 선택/복사, 실패 페이지 재시도와 오류 표시를 구현했다. 렌더 회전과 PDF 좌표를 분리하며, 수정값·인식 원문·출처·시도를 메모리에 남긴다.

후보는 NEEDS_REVIEW이며 사실 확정이 아니다. 혼합 영역 검출은 이미지 연산자·텍스트 면적 기반 휴리스틱이다. 일반 PDF의 완전성 보증이 아니고, 깨진 기존 OCR층·복잡한 중첩·장식 이미지 등은 추가 검증이 필요하다. 사용자가 전체/영역 OCR을 선택할 수 있다. PNG 업로드, 계산 엔진, 법률 규칙 적용, 동일인 병합, 가족관계 확정, 사건관리, 클라우드 OCR, 생성형 AI 판정은 구현하지 않았다.

## 4. 패키지·자원·모델

|패키지|버전|라이선스|설치 파일 합계 bytes|
|---|---|---|---:|
|pdfjs-dist|6.4.299|Apache-2.0|34913648|
|playwright|1.64.1|Apache-2.0|5033957|
|playwright-core|1.64.1|Apache-2.0|13656167|
|tesseract.js|7.0.0|Apache-2.0|1411341|
|tesseract.js-core|7.0.0|Apache-2.0|45262431|

설치 경로는 실험 폴더의 `node_modules/`. PDF.js 공식 저장소는 https://github.com/mozilla/pdf.js, Tesseract는 https://github.com/naptha/tesseract.js 및 https://github.com/naptha/tesseract.js-core, Playwright는 https://github.com/microsoft/playwright 이다. 정확한 archive URL·npm SHA-512 integrity·package.json SHA-256·전이 패키지·라이선스 파일·크기는 `results/assets-manifest.json`에 기록했다. npm install --ignore-scripts 결과 audit 0 vulnerabilities는 당시 npm 보고이며 포괄적 보안 검증이 아니다.

모델은 tessdata_fast의 고정 커밋 `87416418657359cb625c412a48b6e1d6d41c29bd`, LSTM-only, `kor+eng+chi_tra`, PSM 3으로 사용했다. 한자 지원은 이 조합에 대한 시험이며 한국어 인명 일반 성능 보장이 아니다.

|모델|bytes|SHA-256|로컬 경로|
|---|---:|---|---|
|tessdata_fast/kor|1677415|6b85e11d9bbf07863b97b3523b1b112844c43e713df8b66418a081fd1060b3b2|public/models/kor.traineddata|
|tessdata_fast/eng|4113088|7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2|public/models/eng.traineddata|
|tessdata_fast/chi_tra|2366642|529c5b5797d64b126065cd55f2bb4c7fd7b15790798091b1ff259941a829330b|public/models/chi_tra.traineddata|

공식 모델 URL은 manifest에 고정했다. 모델 라이선스 Apache-2.0 원문도 로컬에 포함했다. 언어 모델 자체는 커밋하지 않았다. PDF.js build·module worker·CMap·standard_fonts·WASM과 Tesseract script·worker·core 변형·WASM 모두 `public/vendor/`에 복사했다. 자원 228개, 전체 60220200 bytes (57.43 MiB), 각 파일 SHA-256 기록. 사용하지 않는 core 변형도 현재 포함되어 용량 최적화는 미실시다.

Noto Sans KR은 Google Fonts 고정 커밋 `47d54ca1ebb14fd864695f1d39dc734f39017c33`, OFL-1.1, 글꼴 파일 10414588 bytes. 원본은 `.cache/fonts/`, PDF에는 서브셋, 라이선스는 fixtures에 보존했다. ReportLab 4.4.9, Pillow 12.3.0, pypdf 6.10.0은 Codex bundled Python 26.1017.11052에서 사용했으며 출처·라이선스·크기·metadata 해시는 `results/fixture-tools.json`에 기록했다. Poppler 26.05.0은 bundled pdftoppm을 렌더 검수에만 사용했다(공식 https://poppler.freedesktop.org/, GPL 계열, 앱 배포 자원에 포함하지 않음).

재배포 전 PDF.js/표준 글꼴·Tesseract core 전이 자원·모델·OFL의 실제 LICENSE/NOTICE를 배포본과 함께 다시 확인해야 한다. 저장소 패키지 라이선스만으로 전체 배포 고지 완료를 선언하지 않는다. 개발용 Python·Poppler·Playwright·브라우저를 업무 PC 필수 설치물로 지정하지 않았다.

## 5. 완전 가공 표본과 PNG→PDF

10개 고유 표본을 새로 작성했다. 정상 텍스트(1·3쪽), 순수 스캔(2·5~10쪽), 제목 텍스트+본문 이미지(4쪽), 한글 이름·날짜·관계·숫자·한자, 90도 회전(7), 3도 기울기(8), 저해상도(9), 흐림/선/도장 형태 원 겹침(10)을 포함한다. 표본 글꼴은 얇은 기본 굵기여서 실제 문서 분포를 대표하지 않는다.

원문 `fixtures/truth.json`을 인식 전에 고정했고 OCR 결과에 맞춰 고치지 않았다. 앱은 정답 파일을 읽지 않는다. `scripts/generate-fixtures.py`로 suite.pdf를 생성하고 pypdf로 7개 순수 이미지 페이지의 직접 추출이 비어 있음, 혼합 페이지는 제목만 추출됨을 검증했다. Poppler로 10쪽을 렌더하고 전체 contact sheet 및 작업대 화면을 시각 검수했다. 원본 U1/U2·실제 사건·가명 처리 자료는 사용하지 않았다.

사용자 추가 요청에 따라 이미 존재하던 PNG 10장을 `fixtures/source-png/page-01.png`~`page-10.png`에 바이트 그대로 보존했다. `scripts/build-synthetic-pdf.py`가 이를 순서대로 `fixtures/synthetic-scan.pdf`에 묶는다. 각 이미지가 한 페이지이며 회전·기울기·화질을 보정하지 않았다. 파일 283919 bytes, SHA-256 `4bc8e1f3c95383195331e29d07aa2e7b99ddf56d600d5a77e716a10c63ebedba`.

PDF 10쪽, 페이지당 이미지 1개, 텍스트 출력 연산자 없음, 추출 텍스트 0, PDF에서 해독한 RGB 픽셀 SHA-256과 PNG RGB 픽셀 SHA-256 **10/10 일치**. 대응표는 `fixtures/synthetic-scan-map.json`. 원래 .cache PNG도 변경하지 않았다. PNG는 동일 10개 표본의 파생물이며 20개의 독립 표본으로 확대하지 않는다.

## 6. 실제 추출·OCR 결과

최종 측정 시작(UTC): 2026-10-18T10:48:07.103Z; 종료(UTC): 2026-10-18T10:48:18.404Z. 각 시각에 9시간을 더하면 Asia/Seoul이다. 서로 다른 구현 디버깅 실행을 평균내지 않았고 마지막 완주 실행만 표에 기록한다. 정확도 개선을 위한 모델/표본 정답 튜닝은 하지 않았다.

필드 ‘일치’는 NFC·공백 제거 후 원문 필드 문자열이 후보에 존재한다는 뜻이다. 의미/관계 확정이나 필드 위치 정확도는 측정하지 않았다. S/D/I는 공백 제거 후 전체 문자 정렬의 오인/누락/추가 수다. 숫자·한자 편집은 페이지 전체의 해당 문자열을 비교한 수치다. 읽기 순서가 틀린 회전 페이지는 필드 문자열이 남아 있어도 전체 오류가 클 수 있다. 원시 문자 기준 값도 evaluation.json에 따로 저장했다.

### 원래 suite.pdf

|쪽|직접 항목|렌더 ms|추출/OCR ms|이름|날짜|관계|번호 필드|한자 필드|오인 S|누락 D|추가 I|숫자 편집|한자 편집|
|---|---:|---:|---:|---|---|---|---|---|---:|---:|---:|---:|---:|
|1|6|28.6|1.6|일치|일치|일치|일치|해당 없음|0|0|0|0|0|
|2|0|28.5|411.3|불일치|일치|일치|일치|해당 없음|2|6|0|1|0|
|3|7|6.7|0|일치|일치|일치|일치|일치|0|0|0|0|0|
|4|1|27.2|233.8|일치|일치|일치|일치|해당 없음|1|0|1|0|0|
|5|0|11.2|290.2|일치|일치|일치|일치|해당 없음|1|0|3|0|0|
|6|0|9.1|299.9|불일치|일치|일치|일치|일치|4|6|0|1|0|
|7|0|15.4|259.6|일치|일치|불일치|일치|해당 없음|51|1|0|14|0|
|8|0|13.2|189.2|불일치|불일치|불일치|일치|해당 없음|2|26|0|8|0|
|9|0|8.5|239.3|불일치|일치|일치|일치|해당 없음|1|0|0|0|0|
|10|0|25.3|310.5|불일치|일치|일치|일치|일치|7|0|0|0|0|

직접 추출 전용 2쪽은 원문 일치. 실제 OCR을 실행한 8쪽의 필드 존재 일치는 name 3/8, date 7/8, relationship 6/8, number 8/8, hanja 2/2. OCR 대상의 최소 문자 수정량 합계는 112회다. 이는 사람의 실제 클릭·수정 시간 측정이 아니라 편집거리 하한이다.

### PNG로 묶은 synthetic-scan.pdf

|쪽|직접 항목|렌더 ms|추출/OCR ms|이름|날짜|관계|번호 필드|한자 필드|오인 S|누락 D|추가 I|숫자 편집|한자 편집|
|---|---:|---:|---:|---|---|---|---|---|---:|---:|---:|---:|---:|
|1|0|26.1|398.6|불일치|일치|일치|일치|해당 없음|3|6|0|0|0|
|2|0|10.5|297.8|불일치|일치|일치|일치|해당 없음|1|0|1|0|0|
|3|0|12.6|311.6|일치|일치|불일치|일치|일치|2|5|2|0|0|
|4|0|11.5|297.8|불일치|일치|불일치|일치|해당 없음|6|0|3|0|0|
|5|0|11|335.8|일치|일치|일치|일치|해당 없음|2|0|1|0|0|
|6|0|8.7|238|일치|일치|일치|일치|불일치|11|0|3|0|6|
|7|0|10.1|189.1|일치|일치|일치|일치|해당 없음|46|5|5|14|0|
|8|0|7.4|239|일치|일치|일치|일치|해당 없음|2|0|0|0|0|
|9|0|7.3|163.2|일치|일치|일치|일치|해당 없음|0|0|0|0|0|
|10|0|7|196.9|불일치|일치|일치|일치|불일치|5|0|2|0|3|

작업대 파일 선택으로 10쪽 인식, **10/10 렌더링, 10/10 직접 텍스트 0항목, 10/10 실제 OCR 실행·비어 있지 않은 후보 생성**. 필드 존재 일치: name 6/10, date 10/10, relationship 8/10, number 10/10, hanja 1/3. 최소 문자 수정량 합계 111회. 후보가 생성됐다는 사실과 정확하다는 사실을 구분한다. 특히 이름·한자·회전 읽기 순서에 오류가 남았다.

## 7. 시간·자원·재OCR·수정·복사

- 최초 OCR 초기화(로컬 자원 점검+worker/core/모델 시작): 125.8 ms. 최초 suite 스캔 처리 전체: 411.3 ms. 위 페이지 시간에는 렌더 시간과 OCR 시간을 분리했다.
- 새 컨텍스트 synthetic-scan 최초 초기화: 122.8 ms. 빈 앱 캐시여도 OS 파일 캐시까지 비웠다는 뜻은 아니다.
- 같은 worker로 suite 2쪽 반복 처리: 239.7 ms. 영역 드래그 재OCR: 26.8 ms. 각 한 번 측정이며 p50/p95 벤치마크가 아니다.
- main frame JS heap 표본 범위 4110080~5872896 bytes. CDP JSHeapUsedSize이며 worker/WASM/native/브라우저 전체 메모리와 최대 사용량은 미측정이다.
- 영역 드래그 → 영역 재OCR 성공, 후보/좌표 연결 유지. PDF→viewport 좌표 왕복의 최대 오차 0 px. 이 수치가 인식한 글자의 실제 위치 정확도까지 보증하지 않는다.
- 90도 PDF 페이지를 보기 회전 3회 후 다시 인식하는 경로도 시험. 수동 회전 후에도 이름/번호 오류가 남아 회전만으로 해결된다고 결론내리지 않았다. 원본 PDF/PNG 회전은 변경하지 않았다.
- 원문 기준으로 후보 수동 수정, 텍스트 전체 선택, 페이지 이동 후 수정 유지 확인. 자동 복사 내용의 후보 경고 포함 여부 확인. 실제 브라우저 Permissions-Policy로 복사를 거부한 새 컨텍스트에서도 선택/키보드 복사 대안 확인. 인간 사용자의 실제 수정 시간은 미측정이다.

## 8. 실패·재시도·실제 stack trace

1. 개발 중 이미지 렌더: PDF.js 6의 Util.applyTransform이 점 배열을 제자리 수정하고 void를 반환하는데 반환값을 좌표로 사용해 오류가 났다. 변환 후 원래 점을 반환하도록 수정. 최초 실제 trace는 `results/render-error-reproduction.json`에 보존했다.

```text
TypeError: Cannot read properties of undefined (reading '0')
    at http://127.0.0.1:4173/src/engine.mjs:7:56
    at Array.map (<anonymous>)
    at bounds (http://127.0.0.1:4173/src/engine.mjs:7:46)
    at PdfOcrSession.render (http://127.0.0.1:4173/src/engine.mjs:53:19)
```

2. PDF 교체: this.pdf.destroy is not a function 오류를 발견했다. PDFDocumentLoadingTask.destroy로 자원을 해제하도록 수정했다. 최종 잘못된 입력은 `Invalid PDF structure.`로 정상 거부됐고 **동일 화면에서** 정상 PDF 재선택·추출이 성공했다.
3. 초기 복사 거부 시험은 CDP 권한 설정 대상이 실제 테스트 컨텍스트와 달라 30초 대기 실패가 났다. 테스트 컨텍스트 응답의 Permissions-Policy로 실제 거부 조건을 만들도록 시험을 수정했다. 제품 보안을 낮춘 것이 아니다.
4. 초기 모델 404 시험에서 worker 초기화가 45초 타임아웃까지 기다렸다. 로컬 필수 자원 사전 확인을 추가해 실제 경로/HTTP 코드를 즉시 표시하도록 개선했다. 최종 404 주입 오류는 아래와 같다. 주입을 제거하고 ‘실패 페이지 재시도’를 눌러 412 ms에 후보 생성으로 복구했다.

```text
Error: 로컬 OCR 자원 확인 실패: ../public/models/kor.traineddata (HTTP 404)
    at PdfOcrSession.getWorker (http://127.0.0.1:4173/src/engine.mjs:79:31)
    at async PdfOcrSession.recognize (http://127.0.0.1:4173/src/engine.mjs:105:35)
    at async PdfOcrSession.process (http://127.0.0.1:4173/src/engine.mjs:138:24)
    at async run (http://127.0.0.1:4173/src/app.mjs:30:9)
```

최종 corpus의 자연 발생 처리 실패는 0쪽이다. 인식 오류는 여러 쪽에 남아 있다. 의도적으로 주입한 모델 누락과 잘못된 PDF는 음성 시험이며 전체 정확도 실패와 별도다. 최종 npm test 종료 코드 0, metrics 단위시험 2개 통과. 오류 원문·시도별 결과는 evaluation.json/network.json에 남겼다.

## 9. 오프라인 자원·외부 요청

새 임시 Chromium 컨텍스트, 초기 localStorage/sessionStorage 0, IndexedDB 빈 목록, service worker 0. cold corpus에서 브라우저 HTTP cache 비활성화, Tesseract cacheMethod none. 끝에도 앱 storage가 비어 있음을 확인했다. OS 네트워크 설정은 변경하지 않고 브라우저 테스트에서 loopback 외 HTTP(S) 요청을 차단·기록했다. CSP도 self-only다.

기록된 전체 요청 71건 중 **앱의 외부 HTTP(S) 요청 시도 0건**. 모델 HEAD/GET 요청 19건은 모두 127.0.0.1의 미리 준비한 파일이다. 첫 OCR에 모델을 로컬 서버에서 읽지만 인터넷에서 다운로드하지 않는다. 외부 CDN·telemetry·인증·클라우드 OCR 미사용. 개발 설치/모델 준비 시의 승인된 외부 다운로드는 런타임 요청과 구분한다.

PDF CMap/표준 글꼴/PDF WASM은 실제 파일·해시를 로컬에 갖췄다. 이번 embedded-font/단순 이미지 PDF에서 모든 CMap·폰트·JPEG2000 등의 자원 분기까지 실행한 것은 아니다. 요청 로그는 앱 컨텍스트 범위이며 OS 전체 패킷 캡처 결과가 아니다.

## 10. file:// 와 loopback

|경로|실제 결과|실패 지점·한계|
|---|---|---|
|file://|FAIL|src/app.mjs ES module 로드가 origin null CORS에 차단되어 앱 초기화 이전 실패. PDF worker/WASM/model 기능은 이 경로에서 도달하지 못해 미판정|
|http://127.0.0.1:4173|B1 최소 기능 동작|10쪽 직접/혼합 및 10쪽 파생 스캔 시험. 개발용 loopback 허용은 업무 PC 서버 승인과 다름|

실제 브라우저 오류(로컬 홈 경로만 가림):

```text
Access to script at 'file:///<experiment>/src/app.mjs' from origin 'null' has been blocked by CORS policy: Cross origin requests are only supported for protocol schemes: chrome, chrome-untrusted, data, http, https.
Failed to load resource: net::ERR_FAILED
```

브라우저 web security/file access 옵션을 해제하지 않았다. Microsoft Edge **미실시**, Chromium 통과를 Edge 통과로 보고하지 않는다.

## 11. 미실시·제한·다음 권고

80쪽 이상 본평가, 독립 평가자의 정답 검수, 손글씨/세로쓰기/업무 서식 대표성, 복잡한 PDF 이미지 반복/클리핑, 전체 프로세스 메모리·p95·100쪽 스트레스, 모델 조합 비교/정확도 최적화, PaddleOCR, 실제 사건, 법률 엔진·단계 C·업무 배포는 미실시다. 10개 가공 표본으로 일반 OCR 성능 합격을 선언하지 않는다.

다음에는 업무 PC/Edge/loopback 허용 여부를 먼저 확인하고, 별도 승인된 범위에서 표본 대표성과 이름·한자 오류를 평가하는 것이 필요하다. 확대 본평가·Paddle 통합·단계 C·법률 활성화·실제 사건·업무 설치는 추가 승인 대상이며 자동 시작하지 않았다.

## 12. 저장·push

node_modules, vendor/model 본체, 브라우저 캐시, .cache, 스크린샷 출력은 Git 제외. 원본 가공 PNG와 소형 PDF·정답·스크립트·manifest·측정 JSON만 보존한다. 작업 중 별도로 추가된 루트 PNG는 작업 범위 밖으로 취급하여 수정·커밋하지 않았다.

실행: `GIT_TERMINAL_PROMPT=0 git push --dry-run origin HEAD:refs/heads/spike/offline-ocr`. 종료 코드 128:

```text
fatal: could not read Username for 'https://github.com': terminal prompts disabled
```

터미널 push 인증이 준비되지 않아 실제 push **미실시**. 사용자 지시대로 로컬 커밋까지 완료하는 경로를 택했다. 토큰 탐색·채팅 비밀번호 요청·새 인증 권한 부여를 수행하지 않았다. PR·merge 없음.

## 부록: 과거 Cloud B0 실패 보고 원문

아래는 `docs/stage-b0-report-20261018` / `0f41299c637b93d4bc5e1651f33195af591a8621`의 과거 보고서다. 현재 로컬 결과와 별개이며 원문을 삭제하거나 성공으로 바꾸지 않았다.

<details>
<summary>과거 Cloud B0 FAIL 보고서 펼치기</summary>

# 단계 B — B0 개발 환경 점검 결과

작성일: 2026-10-18 (Asia/Seoul). 결과: **B0 FAIL — B1 미착수**.

이번 사용자 지시는 단계 A 이후의 새 승인으로, B0와 B0 통과 시의 B1 기술 검증만 허용한다. 이번 결과는 법률 규칙·정답 후보 승인, 전체 제품 구현, 업무 PC 설치·배포 승인이 아니다. 법률 관련 상태는 모두 **PENDING 유지**다. 단계 A의 전달문·결정 문서·RUN_LOG 등 과거 기록은 수정하지 않았다.

## 1. 기준과 문서 확인

| 항목 | 확인 결과 |
|---|---|
| 대상 | `jhlee8403/inheritage` |
| 기준 브랜치 | `docs/inheritance-design` |
| 사용자 지정 기준 커밋 | `8776506daf2da153feb64084b420bc6ae84fee39` |
| 원격 기준 확인 | GitHub 연결 도구로 branches와 불변 커밋 트리를 재조회; 기준 브랜치가 지정 커밋을 가리킴 |
| 전달문 | `docs/CODEX_HANDOFF.md` v0.3, blob `e3ceea5d60ef4ec0347d79ac0e47b0269179a683` |
| 읽은 문서 | CODEX_HANDOFF, DECISIONS, ENVIRONMENT_PLAN, OCR_EVALUATION_PLAN, TEST_PLAN, RUN_LOG 전체를 지정 커밋에서 재조회 |
| 기존 규칙·파일 | 기준 트리에 전달문과 단계 A 문서10개 존재; AGENTS.md·README·별도 기여 규칙 없음 |
| 권장 실행 설정 | GPT-6.1 Sol / High (`high`) — 이번 사용자 권장값 |
| 실제 실행 설정 | **실제 모델 미확인 / 실제 추론 강도 미확인**. 자연어 지시로 변경했다고 주장하지 않으며 설정 변경 없음 |

연결 도구의 원격 읽기·쓰기와 터미널 Git·실행 환경 검증은 별개로 판정했다. 원격 문서 접근 성공으로 B0를 통과시키지 않았다.

## 2. B0 실제 개발 환경

| 점검 항목 | 실제 관찰 | 판정 |
|---|---|---|
| 관리형 환경 상태 | running / connected, observations_current=true; network restricted / enforced; failure=null | 제어 상태 조회 성공. 터미널 외부 접속 성공의 증거는 아님 |
| OS·아키텍처 | Linux 6.18.55, x86_64; Chromium 빌드는 Debian GNU/Linux13(trixie) 표기 | 확인 |
| 현재 작업 경로 | `/workspace`; `git rev-parse`는 대상 Git 저장소가 아니라는 오류 | 대상 체크아웃 아님 |
| 기존 Git 작업 사본 | `/workspace/demo`, origin `https://github.com/jhlee8403/demo.git`, branch `work`, HEAD `6b46de12a638aad66ec1336e631cf51268361598`, status 빈 출력 | 다른 저장소. 수정하지 않음 |
| 기존 임시 문서 폴더 | `/workspace/work/inheritage` 존재, `.git` 없음; `git rev-parse` 실패 | 정상 Git 체크아웃 아님 |
| 추가 작업 사본 탐색 | `/workspace`에서 `.git` 탐색: demo와 유효하지 않은 `/workspace/.git`만 발견 | 대상 작업 사본 미확보 |
| 새 대상 clone | `/workspace/work/inheritage-b0`로 기준 브랜치 clone 시도, exit128; 실패 후 폴더 없음 | **FAIL** |
| 대상 현재 브랜치·HEAD·변경 상태 | 유효한 대상 로컬 체크아웃이 없어 확인 불가 | 원격 브랜치·해시로 대신 보고하지 않음 |
| 쓰기 가능한 프로젝트 작업 경로 | `/workspace/work`에서 임시 파일 생성·읽기·삭제 성공; 기존 문서 작업 폴더도 쓰기 가능 | 확인. Git 상태와 무관 |
| 실행 도구 | Git2.52.0, Node24.19.0, npm11.9.0, Python3.12.14, curl 존재 | 버전/존재 확인; 설치·빌드 성공은 아님 |
| 브라우저 | `/usr/bin/chromium`, `Chromium 154.0.8037.57 built on Debian GNU/Linux 13 (trixie)` | `--version` 실행만. 앱 구동 시험 미실시 |
| 실제 Edge | microsoft-edge 실행 파일 미발견; 업무 PC 접근 없음 | 미확보·미검증 |
| 자동화·가공 PDF 도구 | Node Playwright 해석 가능; Python playwright/PIL/reportlab/pypdf 모듈 발견 | 발견만. 브라우저 자동화·표본 생성 실행 없음 |
| 패키지·모델 다운로드 경로 | 허용 호스트의 HEAD 요청도 상속 프록시 연결에서 실패 | **FAIL** |

**B0 판정:** 대상 Git 작업 사본과 승인된 터미널 다운로드 경로를 확보하지 못했으므로 FAIL이다. 이미 설치된 패키지·브라우저가 존재해도 사용자 지시의 B0 조건을 충족하지 않는다. B1용 `spike/offline-ocr` 브랜치·실험 코드·표본은 만들지 않았다.

## 3. 실패 명령과 네트워크 관찰

`/etc/codex/network-policy.json` version1을 읽었다. HTTP 정책은 restricted이고 github.com, raw.githubusercontent.com, registry.npmjs.org 등이 egress_rules에 포함되어 있다. vpn_configured=false다. HTTP_PROXY/HTTPS_PROXY 및 소문자 변수의 호스트·포트는 `proxy:8080`이며 URL에 자격증명은 없었다. 변수 전체나 인증정보를 출력하지 않았다. 프록시·TLS·인증·라우팅·정책은 변경하지 않았다.

| 실제 명령 | 종료·오류 | 의미 |
|---|---|---|
| `git -C /workspace rev-parse --show-toplevel` | fatal: not a git repository | `/workspace`가 대상 체크아웃이 아님 |
| `git -C /workspace/work/inheritage rev-parse --show-toplevel` | fatal: not a git repository | 문서 임시 폴더를 checkout으로 간주 불가 |
| `git clone --branch docs/inheritance-design --single-branch https://github.com/jhlee8403/inheritage.git /workspace/work/inheritage-b0` | exit128, `Failed to connect to proxy port 8080 after 0 ms: Could not connect to server` | 원격 Git 인증·저장소 내용 확인 단계에 도달하지 못함 |
| `curl --head --location --max-time 15 --silent --show-error https://registry.npmjs.org/pdfjs-dist` | curl(7), 동일 proxy 연결 실패 | 패키지 metadata endpoint 접근조차 실패; 설치 미시도 |
| `curl --head --location --max-time 15 --silent --show-error https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/kor.traineddata` | curl(7), 동일 proxy 연결 실패 | 시험 모델 출처 후보의 접속 확인 실패; 본문 다운로드 없음 |

위 clone은 이번에1회, 각 HEAD도1회만 시도했다. 같은 실패를 반복하지 않았다. 모델 URL은 접근 점검용 후보이며 선택·호환·배포 승인된 모델로 확정한 것이 아니다. 허용 목록에 있다는 사실과 실제 접속 성공을 구분한다. HTTP 응답을 받지 못했으므로 401/403·모델 파일404·라이선스 문제라고 단정하지 않는다.

환경 조회의 failure=null은 구체적 환경 실패 사유가 제공되지 않았다는 뜻이며, 관찰된 프록시 TCP 연결 실패의 내부 원인을 설명하지 않는다. GitHub 연결 도구는 별도로 작동했으나 이를 터미널 연결 성공으로 사용하지 않았다.

## 4. 이미 존재하는 패키지 목록 — 설치·채택 아님

Node의 현재 모듈 해석으로 `/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/` 아래 패키지가 발견되었다. 이번에 설치한 패키지는 없다. 출처는 해당 package.json의 repository 필드이며 원래 설치 공급망·압축 배포물의 진위까지 확인한 것은 아니다.

| 발견 패키지 | 버전·package.json 라이선스 | 표기된 저장소 | package.json bytes | package.json SHA-256 |
|---|---|---|---|---|
| pdfjs-dist | 5.6.205 / Apache-2.0 | https://github.com/mozilla/pdf.js.git | 778 | `c91f1f1071e5535e5161f2fff925917550f4f0d2463a52ec94be24bd00b55971` |
| tesseract.js | 7.0.0 / Apache-2.0 | https://github.com/naptha/tesseract.js.git | 2914 | `fa342f37afd665595eca66ee867197c47c9ac35a7967123d1132c39a40b3dfbd` |
| tesseract.js-core | 7.0.0 / Apache-2.0 | https://github.com/naptha/tesseract.js-core.git | 1784 | `554b867684677c81aa3ffab61f31e83618445fa09adee99e8fff3515cee6ca54` |
| playwright | 1.62.1 / Apache-2.0 | https://github.com/microsoft/playwright.git | 1416 | `ca170ec143a88ed3043ac953eb3b2377b2b97304104f4e1e23316684ce2c35af` |

각 package 디렉터리에서 LICENSE 또는 LICENSE.md 파일 존재도 확인했다. 위 용량·해시는 **package.json만의 값**이며 전체 라이브러리·WASM·전이 의존성·배포 번들의 값이 아니다. 전체 용량·전체 아카이브 해시·재배포 고지·취약점·버전별 호환성 검토는 미실시다. B1용 package-lock 및 모델 manifest는 생성하지 않았다. 다운로드 모델은0개이며 선택 버전·파일 용량·해시가 확보된 모델은 없다.

## 5. B1 기능·표본·측정 결과

| 항목 | 상태 |
|---|---|
| PDF 페이지 표시·정상 텍스트 직접 추출 | 미구현·미실행 |
| 스캔/불완전 영역 로컬 OCR | 미구현·미실행 |
| 원문/추출 텍스트·위치 대조 | 미구현·미실행 |
| 영역 재인식·수동 수정·선택/복사 | 미구현·미실행 |
| PDF.js+Tesseract.js 통합 | 미실시; 사전 설치 패키지 발견과 구별 |
| PaddleOCR.js 비교 | 미검증; 통합·다운로드 없음 |
| 텍스트 PDF·스캔 PDF·페이지 혼합 | 가공 표본 미준비 |
| 텍스트 제목+이미지 본문·한자 혼용·회전/저해상도 | 가공 표본 미준비 |
| 가공 원문·정답·생성 스크립트 | B0 실패로 생성하지 않음 |
| 이름·날짜·관계 누락/오인·정확도 | 측정 없음 |
| OCR 처리 시간·메모리·배포 용량 | 측정 없음 |

실제 사건·가명 처리 사건·원본 주석서를 시험 데이터로 사용하지 않았다. 숨은 정답 텍스트층을 가진 스캔이나 정답 반환으로 OCR 성공을 표시한 자료도 없다. 실행하지 않은 기능·정확도·성능에 추정 수치를 넣지 않는다.

## 6. 오프라인·file://·loopback 판정

| 시험 | 결과·한계 |
|---|---|
| 앱의 빈 캐시 첫 실행·로컬 자원 완비 | 미실시. 앱·배포 자원을 만들지 않음 |
| 앱 외부 네트워크 요청 시도 | 측정 불가/해당 앱 없음. ‘외부 요청0으로 통과’라고 해석 금지 |
| file:// 직접 실행 | 미실시. 브라우저 파일 보안 성공/실패 판정 없음 |
| 개발용 loopback 서버 비교 | 미실시. 서버를 시작하지 않음 |
| 개발 Chromium에서 PDF/OCR 실행 | 미실시. 버전 확인만 수행 |
| 실제 업무 Edge | 미검증 |

제어 연결·개발 네트워크를 끊거나 프록시를 제거하지 않았다. 브라우저 보안 옵션을 해제하지 않았으며 기능 삭제로 시험 통과를 만들지 않았다. 업무 PC 서버/실행기 설치·원격 서비스 배포·업무 배포도 없다.

## 7. 필요한 환경 조치와 다음 실험

환경 운영 측에서 현재 실행기와 상속된 `proxy:8080` 서비스의 연결 상태를 확인·복구할 필요가 있다. 같은 정책의 제어 조회는 running/connected이지만 터미널 프록시 연결은 실패한다는 관찰과 위 명령·오류를 전달하면 된다. 토큰·비밀번호를 제공할 필요는 없으며 이 실패를 자격증명 오류로 단정하지 않는다. 이 작업에서 프록시·정책·권한을 직접 바꾸지 않았다.

승인된 경로가 복구되면 다음 순서로 재개할 것을 권한다.

1. B0부터 다시 실행: 대상 정상 clone 또는 기존 checkout 확인, origin·기준 커밋 포함·변경 상태·작업 규칙 검증. 지정 커밋으로 reset --hard하지 않음.
2. 허용 호스트의 실제 터미널 접근 및 선택 패키지·모델 출처 확인. 이번에 발견한 전역 패키지는 자동 채택하지 말고 버전·라이선스·자원 해시를 고정.
3. B0 통과 후에만 별도 `spike/offline-ocr` 브랜치를 확인·생성하고 PDF.js+Tesseract.js로 8~12쪽의 처음부터 만든 가공 표본·정답·생성 스크립트를 기록.
4. 직접추출·실제 OCR·영역 대조/재인식·수정·복사를 분리 측정하고, 빈 앱 캐시·외부 요청 시도·file://·loopback 결과를 각각 기록. 첫 경로를 검증하기 전 Paddle 통합을 늘리지 않음.

현재의 B0·조건부 B1 승인 자체를 다시 요구하는 것이 아니다. 운영 측 환경 설정 변경이나 추가 권한이 필요한 조치가 생기면 그 항목만 별도 절차로 다룬다. 본평가·계산 엔진·단계 C·업무 배포는 이번 승인 범위 밖이다.

## 8. 파일·커밋·원격 반영의 구분

이번 산출물은 새 `docs/inheritance/STAGE_B_REPORT.md` 한 파일이다. 임시 작업 사본은 `/workspace/work/inheritage/docs/inheritance/STAGE_B_REPORT.md`이고 이 폴더는 Git checkout이 아니다. 대상 로컬 Git 실행·로컬 커밋·터미널 push는 수행하지 않았다.

B0가 실패했으므로 실험 코드·lockfile·모델 manifest·표본 생성 스크립트는 없다. B0 보고서만 기준 커밋에서 파생한 문서 브랜치 `docs/stage-b0-report-20261018`에 GitHub 연결 도구로 기록하는 방식을 사용한다. `main`·기준 설계 브랜치·과거 RUN_LOG는 변경하지 않는다. node_modules·모델·대용량 생성물·원본 첨부·비밀값을 커밋 입력에 포함하지 않는다.

이 보고서를 포함하는 커밋의 자신의 해시는 파일 내부에 순환 기재하지 않는다. 실제 브랜치·커밋·원격 ref 재조회 결과는 GitHub 커밋 기록과 이번 완료 보고에서 별도로 제공한다. 연결 도구로 보고서를 보존한 사실은 B0 통과·B1 실행의 증거가 아니다.

</details>
