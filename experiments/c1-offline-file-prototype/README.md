# C1 로컬 파일 실행 시제품

가공 사례 검증용이다. 실제 사건자료를 입력하지 않는다. Mac Chromium/Edge의 file:// 실행을 검증했으며 **Windows Edge·업무 PC는 NOT_RUN**이다. 최종 제품이나 PDF/OCR 배포본이 아니다.

## 실행하는 사람

`output/c1-calculator.html`을 **Microsoft Edge로 열기**만 하면 된다. Windows에서는 파일의 연결 프로그램에서 Microsoft Edge를 선택하거나 Edge 창에 HTML 파일을 끌어 놓는다. Mac에서는 Finder의 연결 프로그램에서 Microsoft Edge를 선택한다. 기본 연결 브라우저가 Edge인지 확인한다.

사용자에게 Node.js·Python·npm·Git·Codex·GitHub Desktop·개발 서버나 터미널 명령이 필요하지 않다. 이 파일 한 장을 다른 폴더/PC로 복사할 수 있으며 실행 시 원격 다운로드나 개발 맥북 접속을 하지 않는다. `manifest.json`과 `사용방법.txt`는 검증/안내용으로 함께 전달할 수 있지만 실행 의존성이 아니다.

세 표본 중 하나를 불러와 계산한다. 입력을 바꾸면 옛 결과와 복사가 즉시 무효화된다. UNKNOWN은 부존재 확인과 다르다. 자동 복사가 거절되면 **결과 텍스트 선택 → Edge의 복사 메뉴 또는 Ctrl+C**를 사용한다(Mac: Command+C). 과거에 외부로 복사한 내용은 회수하지 않는다.

파일 실행·JavaScript·Web Crypto가 정책상 차단되면 사용을 중단하고 관리자에게 문의한다. Edge 보안이나 CORS 설정을 완화하지 않는다. 승인 범위는 개시 2017-01-10 / 기준 2017-01-11 / BL1-LAW-2016-14409의 C1 세 유형뿐이다. R04/R05는 계속 PENDING이다.

## 개발 단계에서만 생성/시험

저장소 루트에서 Node.js 24 이상으로 실행한다. 추가 npm 패키지·빌드 도구 설치나 온라인 접근은 없다.

```sh
node experiments/c1-offline-file-prototype/scripts/build.mjs
node --test experiments/c1-offline-file-prototype/test/build.test.mjs
node experiments/c1-offline-file-prototype/test/probe-file.mjs
node experiments/c1-offline-file-prototype/test/browser-file.mjs
```

`probe-file.mjs`는 원본 개발 화면을 file://로 열어 예상되는 모듈 CORS 실패와 Web Crypto/CSS 관측을 출력하는 조사 도구다. 종료 0은 원본 화면의 성공을 뜻하지 않는다. `browser-file.mjs`는 생성 HTML 한 장만 한글·공백·#이 있는 새 임시 폴더로 옮겨 시험한다. 기존 설치된 Playwright/Chromium/Edge를 사용하며 새 브라우저를 설치하지 않는다. 서비스 워커 차단·빈 비영구 컨텍스트·브라우저 네트워크 offline 모드에서 실행하며 물리적 망 단절 시험은 아니다. 한 환경만 진단할 때 `INHERITAGE_FILE_BROWSER=edge` 또는 `chromium`을 지정한다. Edge 자동 시작 시간 제한은 30초다. 시스템/브라우저 보안 설정을 바꾸지 않는다.

## 생성 방식과 추적

원본 `experiments/inheritance-calculator/`와 C1 공개 브라우저 진입점은 수정하지 않는다. 개발용 Node 표준 모듈만으로 현재 프로젝트의 14개 정적 모듈 의존성을 묶고 CSS/JS를 인라인화한다. 계산식·스냅샷·세션을 따로 재작성하지 않는다. private 함수/모듈 공간을 유지하며 원본 엔진 소스는 import/export 연결부 외에 변경하지 않는다. app의 복사 안내와 HTML의 제목/하단 안내만 시제품용 문구로 바꾼다.

이 연결기는 현재 소스가 사용하는 명명된 import/export·namespace import·정적 재수출·선언만 지원하는 제한된 도구다. 일반 ESM 번들러가 아니며 순환 모듈·동적 import·Node/외부 모듈·알 수 없는 모듈 문법은 중단한다. 향후 소스 형태가 바뀌면 도구 검토와 재시험이 필요하다. 현재 원본에 대한 소스 해시와 14개 모듈, 생성기 해시, HTML/안내문 해시는 `output/manifest.json`에 기록한다. 생성물을 직접 고치지 않고 재생성한다. 두 번 생성한 결과의 byte 일치를 시험했다.

출력은 classic inline script와 inline CSS만 사용하므로 file origin에서 외부 ES Module을 fetch하지 않는다. CSP의 SHA-256 hash로 해당 인라인 코드/스타일만 허용하고 connect-src 'none'으로 연결을 금지한다. CSP를 완화하거나 실행 권한 옵션을 추가하지 않는다. 출력에는 절대 개발 경로·개발 서버 주소·M2·PDF/OCR 자원·실제 개인정보가 없다.

현재 시험 결과와 Windows 확인 항목은 `docs/inheritance/C1_OFFLINE_FILE_PROTOTYPE_REPORT.md`를 참조한다. 자동 복사 허용 여부는 file origin/브라우저 정책에 달려 있으며 실제 시스템 클립보드 내용의 읽기 검증은 이번에 하지 않았다. 선택 대안은 실제 화면에서 확인했다. B안 실행기/설치 프로그램은 만들지 않았다.
