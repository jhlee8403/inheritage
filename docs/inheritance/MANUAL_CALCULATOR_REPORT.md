# 수동 입력 계산 검증 화면 — 착수 전 확인 기록

확인일: 2026-10-20 (Asia/Seoul). **상태: Mac Edge 미발견으로 Edge 검증 미실시 / 화면 구현 보류.** 이 문서는 화면 구현 완료 보고가 아니다.

## 작업 기준과 원격 보존

- 저장소: `jhlee8403/inheritage`, 현재 브랜치 `feat/inheritance-engine-m0-m1`.
- 착수 시 로컬 HEAD: `b1e8822b252a29be1f4b0851ecdabed903f6a425`, 작업 트리 clean.
- 실제 원격 확인 명령: `git ls-remote --heads origin refs/heads/feat/inheritance-engine-m0-m1`.
- 반환된 실제 원격 HEAD도 `b1e8822b252a29be1f4b0851ecdabed903f6a425`로 일치했다. 오래된 origin 추적 정보로 판단하지 않았다.
- 세 결함 수정 코드 `29921483cee1e60e55d302056456288ec301618c`, 검증 문서 `d1fb3617128c8ba49c16344e8ce130cc2b9362a3`, 실행 요구 문서 `b1e8822…`가 보존되어 있다. 수정 코드가 현재 HEAD의 조상임도 확인했다. 이전 커밋으로 reset·이력 재작성·중복 구현하지 않았다.

## 읽은 기준과 승인 경계

엔진 README, C1_M0_M1_REPORT, LEGAL_APPROVAL_M0_M1, LEGAL_BASELINE_V1, DATA_MODEL, DECISIONS, ENVIRONMENT_PLAN 및 공개 브라우저 진입점·스냅샷 API·시험 하네스를 확인했다. 엔진 0.2.0, M0+M1의 여섯 규칙과 열한 truth v1, 개시일2017-01-10·기준일2017-01-11·BL1-LAW-2016-14409 제한을 유지한다.

DECISIONS H-08~H-14와 ENVIRONMENT_PLAN의2026-10-20 추가 절에 Mac 로컬 개발·Mac Edge 시험·최종 오프라인 Windows Edge·다른 PC의 독립 실행·배포 사용자의 개발 도구/터미널 불필요 목표·자원 동봉·미정 환경/정책이 이미 기록되어 있다. 두 문서에 같은 내용을 다시 추가하지 않았다.

사용자는 실제 Mac Edge의 기존 엔진 검증이 통과한 경우에 한해 독립된 가공 사례용 수동 계산 검증 화면을 허용했다. 기존 UI 보류 제한의 확장은 그 조건부 범위에만 적용된다. 이번에는 선행 조건이 충족되지 않아 `feat/manual-calculation-workbench` 브랜치와 `experiments/inheritance-calculator/`를 생성하지 않았다. OCR 연결·법률 확대·R04/R05·Windows 실행기/설치 프로그램·실제 사건·main·PR·merge는 시작하지 않았다.

## 실제 Mac Edge 탐색 결과

실행 파일 탐색 대상:

- `/Applications`, `~/Applications`의 `*Edge*.app`.
- `/Applications`, `/System/Applications`, `~/Applications`의 앱 폴더를 깊이3까지 추가 확인.
- Spotlight: `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.edgemac'"` 및 접두사 검색 `com.microsoft.edgemac*`.

탐색 결과에 Edge 앱·실행 파일이 없었고 Spotlight도 출력 없이 종료0이었다. 실제 Edge 프로세스 실행은 수행하지 않았으며, **Edge 실행 파일·버전 미확인 / Edge 시험 미실시**다. 존재하지 않는 앱을 실행했다고 하거나 Chromium 성공을 Edge 통과로 표시하지 않는다. 설치·보안 옵션 변경은 수행하지 않았다. 비표준/비색인 경로의 앱 존재까지 전수 부정하는 결과는 아니다.

필요한 사용자 조치: Mac Edge를 사용자가 설치한 뒤 알려 주거나, 이미 비표준 위치에 설치되어 있다면 해당 `.app` 또는 실행 파일의 실제 경로를 제공해야 한다. 이후 기존 하네스의 `INHERITAGE_EDGE_EXECUTABLE`에 경로를 지정하여 실제 Edge 검증을 수행할 수 있다. Edge 검증 통과 전 화면 구현은 계속 보류한다.

## 이번에 새로 실행한 시험

과거 수치를 그대로 재사용하지 않고 이번 요청에서 아래 명령을 재실행했다. 과거 실패 회귀 작성·수정 이력은 C1 보고서의 기존 기록으로 구분한다.

```sh
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm test --prefix packages/inheritance-engine
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm run test:browser --prefix packages/inheritance-engine
```

|환경|이번 실제 실행 결과|
|---|---|
|Node.js 24.22.0|57 PASS / 0 FAIL / 0 SKIP, 종료0|
|Chromium 156.0.8078.4 (Mac)|20 PASS / 0 FAIL / 0 SKIP, 종료0|
|Mac Microsoft Edge|미실시.실행 파일/버전 미확인|
|Windows Edge / 실제 오프라인 업무 PC|미실시|

기존 브라우저 하네스는 `NOT_RUN_NOT_INSTALLED_IN_STANDARD_PATHS`로 Edge를 별도 표시했다. Chromium에서는 브라우저 공개 API, 필수 truth11개, 세 결함 회귀, createSnapshotAsync/refreshSnapshotAsync, 비동기 중 입력·승인 객체 변경, STALE·긴 분수·Node/브라우저 SHA-256 일치를 검사했다. 콘솔 오류0·page error0·미처리 Promise 거절0·외부 요청0·모듈 로딩 후 계산 중 요청0이었다. 시험 개수 조정을 위한 추가/삭제/skip은 없고 테스트·엔진 코드를 수정하지 않았다.

## 화면 기능·비동기·복사 검증 상태

**화면 미구현 / 화면 자동시험 미실시**다. 세 표본·수동 인물/가족/Q/확인 상태 편집·결과 표시·텍스트 복사 기능은 아직 없다. 화면의 즉시 결과 무효화·복사 차단·요청 번호/revision 경쟁 처리·늦은 결과 무시·오류/BLOCKED/취소 후 과거 성공 결과 제거·복사 실패 시 선택 대안·표시 문자열 비실행은 모두 이번에 통과한 항목이 아니다.

엔진 스냅샷/STALE 시험의 성공을 화면 상태 전이·클립보드 안전성 검증으로 대체하지 않는다. 기존 엔진이 새 빈 필드를 CONFIRMED/ABSENT_CONFIRMED로 보정하지 않는 게이트도 화면에서 우회해서는 안 된다. 외부로 이미 복사한 클립보드를 회수한다고 약속하지 않는다.

## 직접 확인하는 방법과 다음 조건

현재는 계산 화면 URL·화면 실행 명령을 제공할 수 없다. 생성하지 않은 서버/화면을 열 수 있다고 안내하지 않는다. 위 명령은 **Mac 개발용 기존 엔진 시험**을 실행하는 정확한 방법이며, 브라우저 하네스는 loopback 임시 포트에서 자동 시험 후 종료된다. Windows 배포 사용자의 실행 절차가 아니다.

실제 Edge 경로를 확보한 후 공개 API·truth·회귀·스냅샷/STALE·해시·오류/외부 요청 검증을 먼저 통과해야 한다. 그 후 현재 수정 커밋을 포함하는 별도 화면 브랜치에서 사용자 지시의 최소 화면과 자동시험을 구현한다. Mac Edge 통과도 Windows Edge·오프라인 업무 PC 합격이나 실행기/loopback 사용 승인을 뜻하지 않는다.

이번 변경은 이 보고서와 C1 보고서의 Edge 미실시 기록뿐이다. 현재 구현 브랜치에 로컬 커밋하며, 사용자 지시에 따라 자동 push는 시도하지 않는다. 이번 보고서 커밋은 GitHub Desktop으로 별도 push해야 한다.

## 2026-10-22 — Edge 설치 후 재개·중단 변경 보존·화면 검증 완료

위의 미설치/보류 기록은 당시 사실로 보존한다. 아래는 사용자가 Edge 설치 및 연결 중단 후 재개를 지시한 작업의 추가 기록이다. 중단 전에 완료된 엔진 시험과 이번에 새로 실행한 화면 시험을 구분한다.

### 시작 상태와 보존

- 저장소 `jhlee8403/inheritage`, origin `https://github.com/jhlee8403/inheritage.git`.
- 재개 시 브랜치 `feat/manual-calculation-workbench`, HEAD `044550fb97bd169ae0443c1fa545302ca881bdc5`.
- `git status --short`: `?? experiments/inheritance-calculator/` 하나. 추적 파일의 `git diff --stat`는 비어 있었다. 미추적 파일이 없다는 의미가 아니다.
- 중단된 8개 파일: app.mjs, session.mjs, engine-adapter.mjs, fixtures.mjs, index.html, style.css, package.json, scripts/server.mjs. 모두 읽고 보존했다. 기존 기능을 새로 복제하거나 reset/revert/clean/강제 전환하지 않았다.
- 프로세스 읽기 확인 시 관련 개발 서버·브라우저 시험은 실행 중이지 않았다. 이전 시험을 중복 실행 중인 상태에서 다시 시작하지 않았다.
- 실제 `git ls-remote --heads origin refs/heads/feat/inheritance-engine-m0-m1 refs/heads/feat/manual-calculation-workbench`: 기준 구현 브랜치는 `044550fb97bd169ae0443c1fa545302ca881bdc5`, 화면 브랜치는 원격에 없음. push는 실행하지 않았다.

### 기존 엔진의 실제 Mac Edge 선행 시험

실제 실행 파일 `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`, 앱 plist 및 실제 하네스 버전 **155.0.4283.62**. 사용자가 설치한 앱을 사용했으며 임의 설치·보안 완화는 없었다.

중단 전 이 작업에서 실제 실행된 아래 로그를 재개 시 다시 읽었다. 이번 재개에서 아래 브라우저 하네스를 또 실행했다고 기록하지 않는다.

```sh
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm test --prefix packages/inheritance-engine
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm run test:browser --prefix packages/inheritance-engine
```

|시험 환경|중단 전 같은 작업의 실제 결과|이번 재개 후 추가 실행|
|---|---|---|
|Node.js 24.22.0|57 PASS / 0 FAIL / 0 SKIP|동일 명령 재실행: 57 PASS / 0 FAIL / 0 SKIP, 종료0|
|Chromium 156.0.8078.4 엔진 하네스|20 PASS / 0 FAIL / 0 SKIP|엔진 하네스 반복 실행 안 함|
|Mac Edge 155.0.4283.62 엔진 하네스|20 PASS / 0 FAIL / 0 SKIP|엔진 하네스 반복 실행 안 함|

엔진 로그의 공개 API·필수 truth11·세 결함 회귀·비동기 생성/갱신 중 입력/승인 변경·STALE·10개 입력의 Node/브라우저 SHA-256 일치·해시 오류 검증은 Edge와 Chromium에서 통과했다. 각 브라우저 콘솔 오류0·page error0·미처리 거절0·외부 요청0·모듈 로딩 이후 계산 중 요청0이었다. 확인 로그는 `/private/tmp/inheritage-edge-resume.txt`, `/private/tmp/inheritage-node-resume.txt`이며 임시 파일은 영구 보존을 보장하지 않으므로 결과를 여기에 기록한다.

### 구현 완료 범위와 수정

기존 엔진 공개 진입점에서 createSnapshotAsync/refreshSnapshotAsync를 호출한다. 법률 계산식이나 정답 조회표를 화면에 넣지 않았다. 세 유형의 입력 fixture에는 사실·확인 상태만 있다. 별도 truth ID로 수동 편집 결과가 원래 truth라고 주장하지 않는다.

가족 구성·가공 ID·생존·성년/관계/사실 확인·집합 존재/완전성·미지원 쟁점·Q를 편집한다. 새 입력/새 사람은 UNKNOWN과 빈 값이며 추가/삭제 시 해당 집합 완전성을 UNKNOWN으로 만든다. 배우자 부존재를 빈 목록에서 추정하지 않는다. 날짜·법령은 고정 표시한다.

상대분·물건 전체분·인물·취득 경로·규칙/버전·법령·검산·경고·provenance를 텍스트와 JSON으로 표시한다. BLOCKED는 배분을 확정하지 않고 이유와 미해결 Q를 표시한다. 손상 입력과 해시 실패는 ERROR이며 직전 성공 출력이 남지 않는다.

입력 event 처리 안에서 결과를 즉시 비우고 숨기며 선택/복사를 비활성화한다. hash 완료를 기다리지 않는다. 요청 번호와 입력 revision이 모두 맞을 때만 완료 결과를 게시한다. 취소·옛 Promise 완료·복사 Promise 완료가 뒤늦게 상태를 복구하지 못한다. 이미 외부에 복사한 클립보드를 회수한다고 약속하지 않는다. 자동 복사 실패 시 선택 후 ⌘C 안내가 나온다.

재개 후 서버 루트 `/` 접근의 상대 모듈 경로 문제를 피하도록 정확한 화면 URL로 redirect를 추가했다. 시각 확인에서는 이전 텍스트 선택/스크롤 위치가 새 결과에 남는 현상을 발견해 새 출력 게시 시 선택과 scrollTop을 초기화했다. 계산/법률 결과는 변경하지 않았다.

### 이번 실제 화면 자동시험

명령:

```sh
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm test --prefix experiments/inheritance-calculator
```

기존 Playwright 1.64.1과 이미 설치된 브라우저를 사용했다. 새 프레임워크/런타임 의존성/다운로드 없음. 임시 loopback 서버, headless 실제 브라우저, sandbox 활성, 표준 브라우저 시험용 clipboard 권한으로 실행했다. 시스템 보안 정책·TLS·프록시를 변경하지 않았다.

|환경|최종 화면 시험|콘솔/page 오류|미처리 Promise|외부 요청|
|---|---|---|---|---|
|Chromium 156.0.8078.4 (Mac)|18 PASS / 0 FAIL / 0 SKIP, 종료0|0 / 0|0|0|
|Mac Edge 155.0.4283.62|18 PASS / 0 FAIL / 0 SKIP, 종료0|0 / 0|0|0|
|Windows Edge / 실제 오프라인 업무 PC|미실시|미측정|미측정|미측정|

18개 검사: 빈 수동 입력 UNKNOWN 유지1, 정상 세 유형3, Q 변경 즉시 STALE/출력·복사 차단 및 재계산1, 인물 추가/삭제·명시적 재확인·새 ID/Q1, 배우자 UNKNOWN과 BLOCKED 텍스트 실제 복사1, 불완전 집합과 Q 보존1, 손상/0분모/음수 Q 오류1, 계산 중 입력 변경1, 이전 결과가 늦게 완료되는 연속 계산1, 취소1, 해시 실패1, 실제 최신 클립보드 복사/선택/거부 대안1, HTML payload 비실행1, 복사 지연 중 편집1, 날짜 고정/새 입력 초기화1, 재계산 결과 선택·스크롤 초기화1이다.

정상 검사에서는 독립된 고정 기대값으로 사람 ID·기약분수·경로·규칙을 비교하며 엔진 함수로 기대값을 만들지 않는다. async 검사는 실제 digest의 완료 순서만 보류한다. 늦은 첫 계산 뒤 최신 결과 텍스트가 바뀌지 않음을 실제 화면에서 확인했다. HTML payload는 input value에만 남고 INVALID_ID로 거부되며 DOM 이미지/스크립트나 외부 요청을 만들지 않았다. 정상 결과의 실제 clipboard readText는 현재 출력과 일치했다. 실패 대안 시험은 clipboard 쓰기만 의도적으로 거부한다.

첫 화면 실행은 각 브라우저 15 PASS / 1 FAIL이었다. 실패는 분모0/음수의 공개 오류 필드가 `fraction.denominator`/`fraction.numerator`인데 시험이 `asset.share`로만 기대한 assertion 오류였다. 엔진을 변경하지 않고 실제 공개 계약에 맞춰 code/field별 기대값을 작성했다. 다음 실행은 17/17, 시각 확인 후 스크롤 회귀를 추가한 최종 실행은 18/18이다. 실패를 삭제/skip하거나 truth를 수정하지 않았다. 최종 로그 `/private/tmp/inheritage-manual-ui-final.txt`, Node 재실행 로그 `/private/tmp/inheritage-node-manual-final.txt`, 실제 Edge 전체 화면 캡처 `/private/tmp/inheritage-manual-edge.png`. 캡처도 검토했다.

### 변경 파일·직접 실행·남은 제한

신규 `experiments/inheritance-calculator/`의 기존8개+README.md+test/browser.mjs, 그리고 이 보고서와 C1 보고서만 변경했다. 엔진 소스·기존 truth/테스트·법률 승인·DECISIONS/ENVIRONMENT_PLAN·OCR은 변경하지 않았다. 후자의 확정/미정 요구는 이미 기록되어 있어 중복 추가하지 않았다.

저장소 루트 터미널에서 `PATH="$HOME/.local/bin:$PATH" node experiments/inheritance-calculator/scripts/server.mjs` 실행 후 Mac Edge에서 **http://127.0.0.1:4174/experiments/inheritance-calculator/index.html**을 연다. 종료는 Ctrl+C. npm install/빌드는 불필요하다. 이 절차는 현재 Mac 개발용이며 배포받는 Windows 사용자의 절차가 아니다. 상세 조작은 화면 README에 기록했다.

최종 화면 시험 실패0, 알려진 미해결 기술 오류 없음. 실행 후 서버·시험 브라우저는 닫힌다. file://·Windows Edge·실제 오프라인 업무 PC·전달 패키지·PDF/OCR 통합·실제 클립보드 관리 정책별 시험은 미실시다. 브라우저 요청 계측 결과는 시험 origin의 앱 요청만을 측정하며, Mac 전체의 네트워크/물리 단절을 검증한 것은 아니다. 일반 날짜·R04/R05·실제 사건·Windows 실행기/설치 프로그램·PR/merge는 진행하지 않았다. 법률 승인 확대 없음.

완료 코드는 `feat/manual-calculation-workbench`에 로컬 커밋한다. 터미널 push를 시도하지 않으며 새 브랜치는 현재 원격 미반영이다. 최종 SHA는 자체 문서에 순환 기록하지 않고 완료 채팅 및 Git 로그로 제공한다. GitHub Desktop에서 이 브랜치를 push해야 한다.
