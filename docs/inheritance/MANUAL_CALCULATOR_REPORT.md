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
