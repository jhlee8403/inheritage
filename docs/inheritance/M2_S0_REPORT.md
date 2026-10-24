# M2 공통 안전 기반 구현 보고서

작성일: 2026-10-24. 기준: `9af4e67400d86de4e58a16f04f75d7e2505eaa46`.
작업 브랜치: `feat/m2-validation-foundation`.

## 1. 중단 상태와 이번 마무리

재개 시 HEAD는 기준 커밋이었고, 구현·시험·package 설정 10개 파일이 미커밋 상태로 보존되어 있었다. 보고서는 없었다. 기존 소스와 실제 시험 로그를 검토했으며 이번 재개에서는 구현을 다시 작성하거나 시험을 중복 실행하지 않았다. 최종 Node/M2 브라우저 로그의 수정 시각은 마지막 소스·시험 수정 시각 이후다. 기존 C1 브라우저·화면 시험 이후의 변경은 M2 전용 코드와 시험이며 C1 코드·화면은 변경하지 않았다.

이 보고서를 추가하고 관련 파일만 로컬 커밋한다. 최종 커밋 SHA와 커밋 후 작업 트리 상태는 최종 채팅과 `git log`에서 확인한다. 터미널 push·PR·merge는 수행하지 않는다.

## 2. 신규 API와 호환성

별도 공개 진입점은 `@inheritage/inheritance-engine/m2` (`src/m2.mjs`)다.

| API/상수 | 역할 |
|---|---|
| `calculateM2(input)` | 객체 경계·스키마·참조·사실 검사 후 미승인 계산 전체 BLOCKED |
| `calculateM2Json(text)` | 원시 JSON 중복 키 검사와 M2 검사 결합 |
| `parseM2InputJson(text)` | JSON 문자열의 문법·중복 키·자원 경계 검사. 전체 M2 스키마 검사는 별도 |
| `validateM2TechnicalLedger(input)` | 명시적으로 주어진 가공 기술 원장의 참조·소비·분수 보존 검사 |
| `InputError`, `M2_LIMITS`, `M2_POLICY`, `M2_VERSION` | 오류 계약·기술 상한·변경 불가 안전 정책·버전 |

입력 `m2-input-draft-v1`, 결과 `m2-result-draft-v1`, 기술 원장 `m2-technical-ledger-v1`을 구분한다. 구현 버전은 `m2-validation-0.1.0`, 안전 정책은 `M2-safety-policy-v1`이다. 기존 C1 기본/브라우저 export와 calculate·snapshot·분수·truth·승인 기록·수동 화면은 변경하지 않았다. package에는 M2 하위 export와 M2 브라우저 시험 명령만 추가했다. 새 의존성을 설치하지 않았다.

공용 M2 모듈에는 Node 전용 모듈·DOM·네트워크 의존성이 없다. 브라우저 시험 실행기의 Node/Playwright/loopback 서버는 개발 도구다. 기존 설치된 Playwright를 재사용하며 OCR 소스는 변경하지 않았다.

## 3. 실제 구현한 검사

- 원시 JSON을 덮어쓰기 전에 중복 키를 거부한다. 이스케이프 해제 후 동일한 키도 거부한다. 이미 파싱된 객체에서 원문 중복 키를 복원했다고 주장하지 않는다. 입력은 JavaScript 문자열이며 별도의 원시 바이트 UTF-8 디코더 API는 제공하지 않는다.
- 객체 입력은 일반 JSON 값으로 제한한다. 접근자를 호출하지 않고 거부하며 사용자 정의 prototype·순환 객체·배열 구멍·추가 배열 속성 등을 거부한다.
- 알려진 필드·타입·스키마만 허용한다. 사람·관계·사망 사실·사건·사실 레코드 ID와 명시 참조, 중복 관계, 자기 참조, 관계/사건 DAG, 같은 실질 유입의 중복 소비를 검사한다.
- 유효한 사실 레코드의 미완료·UNKNOWN은 BLOCKED 진단이다. 명시적으로 참조한 레코드가 없으면 `BROKEN_REFERENCE` InputError다. UNKNOWN을 ABSENT_CONFIRMED로 변환하지 않는다. 확인 날짜와 생존 상태의 충돌도 진단한다. 이는 전체 법률 자격 판정이 아니다.
- Q는 기존 정확한 BigInt 분수 계약을 사용한다. 손상된 Q는 code/field를 가진 InputError이며 가짜 미해결 원장을 만들지 않는다. 유효한 Q의 미승인 요청은 빈 allocations/paths 및 미해결 묶음 하나에 Q 전체를 보존한다. 이는 각 사람의 실제 법률상 지분이 0이라는 뜻이 아니다.
- 일반 입력의 approved/status/approvalOverride/proof 등 미지원 필드와 추가 승인 인자를 거부한다. truthReference는 추적용이며 생략·변경·위조로 승인 상태가 바뀌지 않는다. 승인 정책은 고정 PENDING·빈 바인딩이며 일반 JSON에서 교체하지 못한다. C1 입력/결과를 M2 입력으로 재사용하거나 C1 결과를 주입하는 경로도 거부한다.
- 결과에 버전·요청 규칙·법령·truth 참조·차단 사유를 남긴다. 실제 적용 규칙과 승인 바인딩은 비어 있다. `facts: COMPLETE`는 기본 사실 진단을 통과했다는 뜻이며 법률 승인이나 배분 정확성 인증이 아니다. 법률 배분·사건별 배분 보존·경로 결과 검사는 `NOT_RUN`이다.

기술 원장은 호출자가 제공한 가공 금액만 검사한다. 물건·소유자·원천 취득 참조, 동일 유입 재소비, 가정 지분의 실제 취득 혼입, 소비된 역사 취득의 말단 중복 합산, 말단 누락, 사건/전체 분수 보존을 검사한다. `TECHNICAL_VALIDATED / legalDetermination: NOT_PERFORMED`는 법률 정답이나 실제 상속 경로를 생성한 결과가 아니다. 기술 원장 결과를 M2 법률 결과로 승격하는 진입점도 없다.

### 기술 상한

| 항목 | 적용 상한 |
|---|---:|
| JSON UTF-8 크기 | 1,048,576 bytes |
| 사람 / 관계 / 사건 | 256 / 512 / 32 |
| 사망 사실 / 사건 사실 / 역사 가족 사실 | 256 / 32 / 256 |
| JSON 노드 / 깊이 | 20,000 / 32 |
| 일반 문자열 | 4,096 UTF-8 bytes |
| ID | ASCII 1~100자 |
| 외부 분수의 정수 문자열 | 기존 1,024자 제한 유지 |

상한은 초기 기술 제한이며 성능 측정값이나 법률 지원 범위가 아니다. 중복 ID·깨진 참조·구조 순환·실질 이중 소비는 단일 InputError 기대값으로 시험했다. 기존 M2-X10의 BLOCKED 후보와 달리 기술 오류로 분류한 것이며 법률 승인을 뜻하지 않는다. 시험에서 BLOCKED/ERROR 중 아무 상태나 허용하지 않는다.

## 4. 실제 시험 결과

중단 전에 생성된 2026-10-23 로컬 로그를 2026-10-24 재개 시 직접 확인했다. 아래 수치는 과거 예상값이 아닌 해당 로그의 실제 결과다. 로그는 `/private/tmp/`의 임시 파일이므로 영구 보존을 보장하지 않는다. 재실행 가능한 시험 코드는 커밋 대상이다.

Node `v24.22.0`, Chromium `156.0.8078.4`, 실제 Mac Microsoft Edge `155.0.4283.62`를 사용했다. Edge 실행 파일은 `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`다.

| 시험 | 통과 | 실패 | 건너뜀 | 로그 |
|---|---:|---:|---:|---|
| Node 전체: C1 57 + M2 53 | 110 | 0 | 0 | `inheritage-m2-node-final.txt` |
| Chromium M2 | 9 | 0 | 0 | `inheritage-m2-browser-final.txt` |
| Mac Edge M2 | 9 | 0 | 0 | 위와 같음 |
| Chromium 기존 C1 엔진 | 20 | 0 | 0 | `inheritage-m2-c1-browser.txt` |
| Mac Edge 기존 C1 엔진 | 20 | 0 | 0 | 위와 같음 |
| Chromium 기존 수동 화면 | 18 | 0 | 0 | `inheritage-m2-c1-ui.txt` |
| Mac Edge 기존 수동 화면 | 18 | 0 | 0 | 위와 같음 |

실제 실행 명령(각 종료 코드 0):

```sh
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm test --prefix packages/inheritance-engine
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm run test:browser:m2 --prefix packages/inheritance-engine
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm run test:browser --prefix packages/inheritance-engine
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm test --prefix experiments/inheritance-calculator
```

위 표의 Chromium과 Mac Edge 각 시험에서 콘솔 오류·페이지 오류·미처리 Promise 거절·외부 요청은 모두 0건이었다. M2 계산 중 추가 요청과 C1 엔진 요청도 각각 0건이었다.

M2 시험은 완전한 가공 입력이 사실 검사 이후 RULE_PENDING에 도달하는지, 전체 Q/빈 배분, 위조 승인 거부, 원시 중복 키, 오류 code/field, 구조/DAG, 기술 원장 이중 소비 등을 확인한다. Node에서는 인물 255/256/257·관계 511/512/513·사건 31/32/33, JSON bytes·노드·깊이·멀티바이트 문자열·분수 길이 경계를 검사했다. 부가 사실 테이블 개수는 상한 초과를 검사했으며 모든 상한의 -1/동일/+1 조합을 전부 검사한 것은 아니다.

초기 개발 로그의 이중 소비 시험 1건은 E3의 factsRef가 E2 사실을 잘못 가리켜 FACT_EVENT_MISMATCH에서 먼저 중단되었다. 시험 입력을 독립 F3/E3로 고친 후 원하는 중복 소비 단계에 도달해 단일 기대 오류를 확인했다. 최종 결과는 위 표이며 이전 실패 로그도 삭제하지 않았다.

## 5. 기존 51개 설계 시험과의 관계

자동시험 53개를 설계 시험 51개 전체 완료로 간주하지 않는다. 설계 ID는 기존 문서에 그대로 보존한다.

| 설계 묶음 | 이번에 확인한 부분 | 미실시/남은 부분 |
|---|---|---|
| P01~P08 | R04/R05 가공 사실 입력의 PENDING 차단 | 정상 수치·취득·경로 출력 전부 미실시 |
| L01~L12 | 기술 원장의 L04~L09 관련 역할·참조·중복 소비·말단/보존 검사 일부 | 법률 경로 생성/비교, 동일 최종 숫자의 T04/T05 경로 구별, ID 일괄 치환, L11 법률 provenance 오염, L12 상대분 단위는 미실시 |
| G01~G15 | 미확인 사실/날짜·규칙/의존 PENDING, 위조 필드, C1 결과 주입, 지원 밖 구조 등의 기술 차단 일부 | G08 가정 승인 의존성 해결기 통합, G13 미래 사건 제외 정상 출력은 미실시. 모든 세부 변형을 구현한 것은 아님 |
| E01~E07 | 손상 Q·구조·자원 제한·스키마 혼용·기술 원장 오류 일부 | E04 법률 결과 오염 전부, E05 M2 snapshot/hash, E06 실제 전달 중 내부 분수 성장, E07 snapshot 혼용은 미실시 |
| S01~S09 | 이번 M2 구현 대상 없음 | M2 STALE·snapshot·비동기 최신성·복사 시험 전부 미실시 |

기존 C1 snapshot·비동기·STALE 및 화면 복사 차단 회귀는 위 표의 C1/화면 시험으로 구분한다. 이를 M2 기능 완료로 기록하지 않는다. Windows Edge·실제 오프라인 업무 PC·배포·성능 부하 시험은 미실시다. 시험 중 외부 요청 0건은 물리적 인터넷 단절 시험이나 배포 검증을 뜻하지 않는다.

## 6. PENDING 및 남은 제한

BL1-R04·BL1-R05와 새 truth·날짜·법령/규칙 의존 바인딩은 계속 PENDING이다. 법률 승인·사용자 개발 착수 승인·기술 구현 상태는 구분한다. 기존 M0+M1 승인 기록을 변경하지 않았다.

정상 상속분 배분, 가정 가지 산정, E1→E2 실제 유입 전달, REVIEW_READY, 부분 가지 계산은 없다. 미래 E2 정책도 승인하지 않았다. 기준일 이후 E2에는 FUTURE_EVENT_POLICY_PENDING을 남기고 모든 사건을 NOT_EVALUATED로 유지하며 Q 전체를 미해결로 둔다. E1만 정상 계산하거나 NOT_YET_OPENED 정책을 활성화하지 않는다.

M2 snapshot·UI·복사, OCR 연결, Windows 실행기/설치·배포도 미구현이다. 기존 C1 규칙 반복 호출로 R05를 공개하는 API가 없다. 향후 정상 실행에는 별도 법률/truth/날짜·의존 승인과 기술 설계 확정 및 개발 착수 승인이 필요하다. 이 구현 완료로 다음 단계를 자동 시작하지 않는다.

## 7. 변경 파일

- `packages/inheritance-engine/package.json`
- `packages/inheritance-engine/src/m2.mjs`
- `packages/inheritance-engine/src/m2/boundary.mjs`
- `packages/inheritance-engine/src/m2/structure.mjs`
- `packages/inheritance-engine/src/m2/gate.mjs`
- `packages/inheritance-engine/src/m2/ledger.mjs`
- `packages/inheritance-engine/test/m2.test.mjs`
- `packages/inheritance-engine/test/m2/fixtures.mjs`
- `packages/inheritance-engine/test/browser/m2-suite.mjs`
- `packages/inheritance-engine/test/browser/run-m2.mjs`
- `docs/inheritance/M2_S0_REPORT.md` (이번 재개에서 추가한 보고서)
