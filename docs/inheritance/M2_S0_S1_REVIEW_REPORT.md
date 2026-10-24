# M2 S0·S1 통합 검토 및 결함 보완

검토일: 2026-10-24. 저장소 `jhlee8403/inheritage`. 시작 시 로컬과 실제 `git ls-remote` 원격 `feat/m2-snapshot-safety` HEAD가 모두 `0249b7bff82850263ba6f3d82f4fe4ec873fe385`였고 작업 트리는 clean이었다. 별도 브랜치 `review/m2-s0-s1-hardening`에서 검토했다. 기존 변경·커밋을 삭제하거나 되돌리지 않았다. 최종 로컬 커밋 SHA와 작업 트리 상태는 완료 채팅과 git log로 확인한다. push·PR·merge는 수행하지 않는다.

## 재현 후 수정한 사항

| 위치(수정본) | 재현 및 영향 | 최소 수정 |
|---|---|---|
| `src/m2/snapshot-internal.mjs:70` | 발급 스냅샷의 refresh에 손상 Q/참조를 넣거나 digest를 실패시키면 오류는 발생하지만 이전 토큰이 유효하게 남았다. 세션 getState에도 옛 결과가 남고, 원래 참조의 재시도 및 앞선 pending refresh가 CURRENT를 반환했다 | 검증/해시 실패 시 해당 토큰을 STALE로 등록하고 원래 InputError/SnapshotError를 그대로 재전파. 기존 세션·경합의 STALE 검사와 연결 |
| `src/m2/snapshot-internal.mjs:34` | 외부 위조 객체의 schemaVersion getter를 소유권 검사 전에 실행했다. getter의 예외가 M2_SNAPSHOT_REQUIRED를 대체하고 사용자 코드 실행 부작용이 발생했다 | WeakSet 소유권을 먼저 검사해 위조/복제 객체 속성을 읽지 않고 거부 |
| `src/m2/boundary.mjs:25` | 인물 배열을 Array subclass로 바꾸어도 NON_JSON_INPUT 없이 수용했다. 기존 일반 JSON/prototype 경계 설명과 불일치했다 | 배열도 일반 Array.prototype만 허용. 이 재현에서 승인 우회나 정상 법률 배분이 발생한 것은 아님 |

수정 전 신규 시험 8개만 실행해 **3 통과·5 실패·0 건너뜀**, 종료 1을 확인했다. 실패 5개는 위 결함 3종의 재현이다. 원문 stack trace는 `/private/tmp/inheritage-m2-review-before.txt`에 보존했다. 시험을 삭제하거나 기대 상태를 완화해 통과시키지 않았다.

기존 S1 변경 감지 시험은 같은 스냅샷으로 11개 변형을 반복해 첫 STALE 이후 나머지가 조기 반환했다. 각 변형마다 새 스냅샷을 생성하도록 바꿔 사실·관계·사건·날짜·Q·법령 등의 캡처/hash 단계에 각각 도달시켰다. 기존 assertion과 시험 이름은 보존했다. 이는 추가 최상위 시험 개수에 포함하지 않는다.

기술 버전은 `m2-validation-0.1.1`, `m2-snapshot-safety-v1.0.1`로 구분했다. 스키마·법률/규칙/승인 버전을 바꾸지 않았다. 새로운 공개 API는 없다.

## 검토 범위와 안전 계약

S0/S1 소스·자동시험·기존 보고서, C1의 분수·승인·snapshot 계약을 대조했다. 원시 JSON의 이스케이프 중복 키/프로토타입 키, 객체 접근자·symbol·비정상 타입, 경계 제한, ID/참조/DAG, UNKNOWN/불완전 사실, 위조 승인/truth, 기술 원장의 동일 유입 중복 소비를 검토했다. 기존 한계/차단 시험 전체와 추가 검토 시험을 실행했다. 원시 프로토타입 키가 Object.prototype을 오염시키거나 승인 필드를 통과하는 현상은 재현되지 않았다.

입력·의존성의 첫 await 전 캡처, Node/브라우저 SHA-256 일치, 원래 참조/복제 객체, STALE 비가역성, 취소·의존 변경·늦은 성공/오류는 기존 시험과 신규 실패 경합 시험으로 확인했다. 내부 의존 공급자는 무효화만 시험하며 calculateM2의 PENDING 정책을 바꾸지 않는다.

직접 refresh 호출자는 요청 시작 전에 기존 최신 출력 사용을 중지하고, 오류 뒤에도 비워 두어야 한다. 오류 처리에서 예전 결과를 대신 반환하면 안 된다. 수정 후 실패한 토큰의 원래 참조 재시도는 STALE이며 새 계산에는 create가 필요하다. 과거 불변 객체의 CURRENT 속성이나 보관된 state 사본이 소급 변형되는 것은 아니다. 현재 refresh 반환값과 session.getState를 확인해야 한다. 잘못된 인자 수/외부 객체의 소유권 실패는 특정 발급 토큰의 재검증이 아니므로 다른 토큰을 무효화하지 않는다. 이 계약을 README에도 추가했다.

## 실제 실행 결과

Node `v24.22.0`. Chromium `156.0.8078.4`. 실제 Mac Edge `155.0.4283.62`, 실행 파일 `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`. 기존 Chromium sandbox를 유지한 headless 시험이며 설치·보안 정책 변경은 없다.

```sh
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm test --prefix packages/inheritance-engine
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm run test:browser:m2 --prefix packages/inheritance-engine
PATH="/Users/leejeonghyeon/.local/bin:$PATH" npm run test:browser --prefix packages/inheritance-engine
```

| 시험 | 통과 | 실패 | 건너뜀 |
|---|---:|---:|---:|
| Node C1 57 + M2 기존 70 + 신규 검토 8 | 135 | 0 | 0 |
| Chromium M2 S0 9 + S1 16 + 신규 검토 8 | 33 | 0 | 0 |
| 실제 Mac Edge M2: 위와 동일 | 33 | 0 | 0 |
| Chromium C1 브라우저 회귀 | 20 | 0 | 0 |
| 실제 Mac Edge C1 브라우저 회귀 | 20 | 0 | 0 |

최종 명령은 모두 종료 0이다. 새 독립 회귀시험은 **8개**이며 동일한 8개를 Node·Chromium·Edge에서 실행했다. 환경별 실행을 서로 다른 24개 시험 설계로 세지 않는다. M2/C1 브라우저 모두 콘솔 오류·페이지 오류·미처리 Promise 거절·외부 요청·계산/엔진 중 추가 요청은 0건이었다. 실행기는 finally에서 서버/브라우저를 닫았다.

로그: `/private/tmp/inheritage-m2-review-node-final.txt`, `/private/tmp/inheritage-m2-review-browser-final.txt`, `/private/tmp/inheritage-m2-review-c1-browser.txt`. 로컬 임시 로그의 영구 보존은 보장하지 않으며 재현 시험은 커밋한다. 버전 메타데이터 반영 후 Node/M2 최종 시험을 다시 실행했다. 중간 통과 건수를 합산하지 않았다.

## 호환성과 남은 한계

C1 공개 API·결과·법률 승인·truth·분수·snapshot 소스와 수동 화면/OCR이 기준 대비 변경되지 않았음을 git diff로 확인했다. M2 공용 소스의 import 연결에 Node 전용 모듈·DOM·네트워크 호출을 추가하지 않았다. 기존 C1 Node/브라우저 회귀가 통과했다. M2와 연결하지 않는 수동 화면 자동시험은 이번에 재실행하지 않았으며 과거 결과를 새 통과로 기록하지 않는다.

이 검토는 완전한 보안 감사나 성능/메모리 한계 측정이 아니다. 전체 수치 상한의 모든 조합을 새로 측정하지 않았고 이전 경계 시험을 재실행했다. 임의의 실행 가능한 JavaScript/Proxy나 변조된 전역 런타임을 격리하는 샌드박스를 제공하지 않는다. 이 영역의 추가 공격 가능성은 이번에 재현된 결함으로 단정하지 않는다.

스냅샷은 같은 모듈 인스턴스 발급 객체만 수용하며 JSON 복원/이관은 미지원이다. 배열은 일반 현재 realm의 Array.prototype을 요구한다. 호출자는 세션에 편집/취소/의존 변경을 알려야 하고 과거 state 사본을 최신으로 사용해서는 안 된다. 실제 UI/복사·S09 역사 취득/STALE_HISTORY·정상 법률 경로/수치·Windows/업무 PC·물리적 오프라인 배포 시험은 미실시다. 기존 51개 설계 전체가 통과했다고 주장하지 않는다.

R04/R05·새 truth·날짜·의존 승인은 계속 **PENDING**이다. 전체 BLOCKED/Q 미해결·빈 allocations/paths와 InputError 구분을 유지한다. 법률 배분·승인·미승인 날짜의 정상 결과·UI·OCR·Windows 기능을 추가하지 않았다. 검토 후 후속 개발을 자동 시작하지 않는다.

## 변경 파일

`packages/inheritance-engine/` 아래 README.md, src/m2/boundary.mjs, src/m2/gate.mjs(기술 버전만), src/m2/snapshot-internal.mjs, src/m2/snapshot.mjs(기술 버전만), test/browser/m2-snapshot-suite.mjs, test/browser/run-m2.mjs, 신규 test/browser/m2-hardening-suite.mjs 및 test/m2-hardening.test.mjs. 여기에 이 보고서 `docs/inheritance/M2_S0_S1_REVIEW_REPORT.md`를 포함해 총 10개다.
