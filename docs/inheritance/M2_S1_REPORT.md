# M2 S1 스냅샷·STALE·비동기 최신성 구현 보고서

작성일: 2026-10-24. 기준 브랜치 `feat/m2-validation-foundation`, 기준 SHA `775b2aff43fa292c75197398f69c55f77f519789`. 실제 `git ls-remote`로 기준 원격 HEAD 일치를 확인했다. 일반 sandbox 조회의 DNS 실패 후 표준 권한 요청으로 읽기 전용 조회가 성공했으며 프록시/TLS 정책을 변경하지 않았다.

구현 브랜치: `feat/m2-snapshot-safety`. 통신 중단 후 이 브랜치의 기존 미커밋 구현과 Node 로그를 먼저 확인하고 보존했다. 기존 코드를 중복 작성하지 않고 원래 참조 재사용/refresh 경합의 STALE 부활 방지 등을 보완했다. 터미널 push·PR·merge는 하지 않는다. 최종 로컬 SHA와 작업 트리는 커밋 후 채팅과 git log로 확인한다.

## 1. 구현 범위와 신규 API

기존 M2 공개 모듈 `@inheritage/inheritance-engine/m2`에 다음을 추가했다.

| API | 계약 |
|---|---|
| `createM2SnapshotAsync(input)` | 입력을 검증·복제하고 엔진 소유 의존성과 함께 SHA-256 스냅샷 생성 |
| `refreshM2SnapshotAsync(snapshot, input)` | 의존성 변경 시 STALE 반환. 이미 STALE인 결과와 원래 참조도 부활 금지 |
| `createM2Session()` | UI 독립 최신성 부품. setInput/run/getState/cancel/invalidateDependencies |
| `SnapshotError` | 해시 불가·실패, M2 스냅샷 형식/소유권 불일치, 승인 인자 주입 거부 |

기존 calculateM2, Q/InputError 계약, S0 입력 검사, PENDING 정책은 그대로다. 스냅샷에는 현재 BLOCKED 결과만 생성되며 정상 법률 배분 결과는 생성하지 않는다. STALE은 과거 BLOCKED 결과를 무효화한 상태다. 유효 Q는 미해결 묶음 하나에 보존되며 allocations/paths는 비어 있다.

스냅샷 스키마는 `m2-snapshot-draft-v1`, 기술 버전은 `m2-snapshot-safety-v1`이다. `dependencyHash`, `inputRevision`, `approvalContextRevision`, `dependencies`, `validity`, `result`를 보관한다. 승인 revision은 캡처한 의존성의 결정적 직렬화 값으로 수치 카운터가 아니다. 해시는 인증 서명이나 법률 승인 증명이 아니다.

## 2. 캡처·의존성·해시

첫 await 전에 입력 경계 복제, S0 검증/계산, 승인 컨텍스트 복제, 결정적 직렬화를 완료한다. 계산과 해시는 동일한 입력 사본에 묶인다. 호출 후 원본을 변경해도 캡처 결과와 해시가 갈라지지 않는다.

전체 입력의 사실·사람·관계·사망 사실·사건열·유입 요구·물건/Q·기준일·법령/truth 참조와 엔진·입력/결과 스키마·계약·snapshot 버전, M2 PENDING 정책/바인딩, 기존 C1 승인 레코드 전체가 해시 의존성이다. 객체 키는 정렬하며 배열 순서는 유지한다. revision만 비교하지 않는다.

승인 의존성은 엔진 소유의 고정 컨텍스트다. 공개 API에는 승인 인자가 없고 일반 입력의 승인 위조 필드는 계속 S0에서 거부한다. 내부 구성 함수의 의존성 공급자는 기술 무효화 시험에만 사용한다. 이 공급자를 바꿔도 calculateM2는 고정 PENDING 정책만 사용한다. 시험에서는 버전 변경·승인 철회/PENDING·UNKNOWN을 사용하며 임시 법률 승인이나 정상 배분 스위치를 만들지 않았다. 실제 레지스트리는 변경하지 않았다.

Node와 브라우저 모두 Web Crypto SHA-256을 사용한다. crypto 부재는 HASH_UNAVAILABLE, 연산 실패/잘못된 길이의 해시 출력은 HASH_FAILED SnapshotError다. 약한 해시·상수·원격 계산 대체는 없다. Node createHash로 별도 SHA-256을 계산해 브라우저 해시와 비교했다.

## 3. 스냅샷 소유권과 최신성

현재 구현은 같은 모듈 인스턴스가 발급한 불변 객체만 refresh한다. WeakSet 소유권으로 C1 스냅샷·위조/복제 객체·JSON 복원 객체를 거부한다. 인스턴스/프로세스 간 복원·마이그레이션 API는 없다. 기존 C1 API를 수정하지 않았으며, C1 refresh에 M2 객체를 전달하는 사용을 새로 지원하지 않는다. M2 refresh에서 실제 C1 스냅샷을 거부하는 것을 시험했다.

STALE 사본을 WeakMap에 기록해 과거 원래 참조나 늦은 refresh 성공이 다시 CURRENT로 되돌리지 못하게 한다. 과거 hash와 provenance는 유지한다. 새로운 스냅샷 생성은 별도 계산이다. 과거 객체 자체의 속성을 바꾸지는 않으므로 호출자는 refresh 반환값과 현재 세션 상태를 사용해야 한다.

세션 setInput은 입력을 복제하고 동기적으로 게시 결과를 제거한다. 손상 입력도 옛 결과를 남기지 않는다. run 시작 시 이전 스냅샷을 STALE 과거 자료로 분리하고 게시 스냅샷을 null로 둔다. 단조 증가 epoch로 입력 편집·다중 요청·취소·의존 변경 알림을 구별하며, 오래된 성공/오류는 published:false로 종료한다. 최신 hash 실패는 ERROR로 게시하고 결과는 null이다. 완료 시점과 getState 시점에 신뢰된 의존성을 다시 비교한다.

세션이 복제한 입력을 외부 원본 변경만으로 바꾸지는 않는다. 편집마다 setInput, 컨텍스트 변경 알림에는 invalidateDependencies를 사용한다. 과거 getState 사본을 최신으로 계속 사용하는 것은 계약 밖이다. 실제 UI/복사 기능은 연결하지 않았다.

## 4. 실제 시험 결과

최종 명령은 모두 종료 0이었다. 로그는 로컬 임시 파일이며 재실행 가능한 시험 소스는 커밋한다.

```sh
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm test --prefix packages/inheritance-engine
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm run test:browser:m2 --prefix packages/inheritance-engine
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm run test:browser --prefix packages/inheritance-engine
```

| 환경/시험 | 통과 | 실패 | 건너뜀 |
|---|---:|---:|---:|
| Node v24.22.0: C1 57 + S0 53 + S1 17 | 127 | 0 | 0 |
| Chromium 156.0.8078.4: M2 S0 9 + S1 16 | 25 | 0 | 0 |
| Mac Edge 155.0.4283.62: M2 S0 9 + S1 16 | 25 | 0 | 0 |
| Chromium: 기존 C1 엔진 브라우저 회귀 | 20 | 0 | 0 |
| Mac Edge: 기존 C1 엔진 브라우저 회귀 | 20 | 0 | 0 |

실제 Edge 경로: `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`. Chromium sandbox를 유지한 실제 headless 시험이다. 각 브라우저 하네스에서 콘솔/페이지 오류·미처리 Promise 거절·외부 요청·계산 중 추가 요청은 모두 0건이었다. 브라우저와 loopback 서버는 종료됐다. 외부 요청 0건은 물리적 네트워크 단절 또는 Windows 배포 검증을 뜻하지 않는다.

로그: `/private/tmp/inheritage-m2-s1-node-final.txt`, `/private/tmp/inheritage-m2-s1-browser-final.txt`, `/private/tmp/inheritage-m2-s1-c1-browser.txt`. 초기 Node 124/브라우저 M2 22 통과 이후 원래 스냅샷 참조와 refresh 경합의 회귀시험 등을 추가하여 위 최종 시험을 다시 실행했다. 초기 수치와 합산하지 않는다.

## 5. 설계 S01~S09의 실행 범위

기존 51개 설계 항목을 변경하지 않는다. 자동시험 수와 설계 항목 수는 다르다.

| 항목 | 실제 확인 | 남은 부분 |
|---|---|---|
| S01 | revision 변경 없이 사실·관계 검토·사건 순서/삭제·사망일·인물 추가 변경의 hash/STALE | 모든 가능한 구조 편집 조합, 정상 법률 경로 변화 미실시 |
| S02 | Q·물건·기준일·법령/truth 참조, 내부 버전/규칙/승인/바인딩 의존성 변화 | 실제 새 승인 레지스트리 배포/활성화 없음 |
| S03 | 객체 키 순서 동일 해시, 배열 순서 변경 STALE | 정상 법률 배분의 의미 동치 비교 없음 |
| S04 | 첫 await 직후 원본 입력·내부 컨텍스트 변경, 캡처/계산/hash 일치 | 외부에 승인 컨텍스트를 주입하는 API 없음 |
| S05 | refresh 직후 입력 원상 복원, STALE 사본/원래 참조 부활 금지, refresh 경합 | 프로세스 간 snapshot 복원 없음 |
| S06 | Node createHash와 Web Crypto, Chromium/실제 Mac Edge hash 일치 | Windows Edge 미실시 |
| S07 | 구 성공/구 오류의 늦은 완료, 새 결과 우선, 컨텍스트 변화·취소 | 정상 법률 성공 결과·실제 승인 배포 경합 없음 |
| S08 | 입력 변경/실패/취소 즉시 게시 결과 null, hash 오류 명시, 세션 경합 | 실제 UI 선택·클립보드·복사 기능/시험 없음 |
| S09 | 현재 S0 결과의 auditHistory가 빈 배열임을 확인 | E1 역사 취득 보관·STALE_HISTORY·감사 기록별 proof/hash 전체 미구현/미실시 |

P01~P08 정상 수치, R04/R05의 실제 취득/소비/경로 생성은 여전히 미실시다. 기존 수동 화면은 수정하지 않았으며 이번에 화면 자동시험은 재실행하지 않았다. 이전 화면 통과 결과를 이번 시험으로 재기록하지 않는다.

## 6. 변경 파일과 남은 제한

- `packages/inheritance-engine/src/m2.mjs`: 별도 M2 스냅샷/세션 export.
- `packages/inheritance-engine/src/m2/snapshot.mjs`: 엔진 소유 컨텍스트와 공개 API.
- `packages/inheritance-engine/src/m2/snapshot-internal.mjs`: 캡처·hash·STALE·세션 기술 부품.
- `packages/inheritance-engine/test/m2-snapshot.test.mjs`: Node 시험/독립 SHA-256/실제 C1 혼용 거부.
- `packages/inheritance-engine/test/browser/m2-snapshot-suite.mjs`: 공통 기술 회귀·경합 시험.
- `packages/inheritance-engine/test/browser/run-m2.mjs`: S0/S1 분리 집계와 Node 비교 해시 전달.
- `packages/inheritance-engine/README.md`: API·소유권·사용 제한.
- `docs/inheritance/M2_S1_REPORT.md`: 이 보고서.

R04/R05, 새 truth·날짜·의존 승인은 계속 PENDING이다. 법률 승인 문서·기존 truth·C1 결과 형식/소스·수동 화면·OCR은 변경하지 않는다. R04/R05 법률 지분 계산·REVIEW_READY·부분 배분·역사 취득 생성·UI·복사·OCR·Windows 배포는 없다. 성공 법률 결과를 만들어 시험하지 않았다. 이번 기술 기반 완료 후에도 법률 계산을 자동 시작하지 않는다.
