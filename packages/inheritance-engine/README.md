# M0+M1 inheritance engine (C1)

가공 자료를 위한 단일 사건 법정 지분 기초계산 모듈이다. 사용자 승인 기록은 `docs/inheritance/LEGAL_APPROVAL_M0_M1.md`의 `C1-approval-v1`이다. 기존 기준선의 정답 수치는 바꾸지 않았다.

지원 범위는 실제 사망 개시일 **2017-01-10**, 결과 기준일 **2017-01-11**, `BL1-LAW-2016-14409`로 고정한다. 법률혼 배우자+생존 성년 친생자녀, 배우자+최근친 생존 성년 친생부모, 배우자 없는 생존 성년 친생자녀만 계산한다. 다른 일자·법령·관계로 자동 확대하지 않는다.

이번 기술 수정의 엔진 버전은 **0.2.0**이다. 법률 rule/truth 버전과 승인 범위는 v1 그대로다. Node의 기존 동기 스냅샷 API는 유지하며, 브라우저용 공개 진입점과 명시적 비동기 스냅샷 API를 추가했다.

## 실행

Node.js 24 이상, ESM JavaScript. 검증 런타임은 Node.js 24.22.0이다. 외부 패키지·설치·빌드·네트워크가 필요 없다.

```sh
cd packages/inheritance-engine
npm test
```

저장소 루트에서도 다음으로 실행할 수 있다.

```sh
node --test packages/inheritance-engine/test/*.test.mjs
```

가공 입력으로 API를 확인하는 예:

```sh
node --input-type=module <<'JS'
import { calculate, createSnapshot, refreshSnapshot } from './packages/inheritance-engine/src/index.mjs';
import { t01 } from './packages/inheritance-engine/test/fixtures.mjs';
const facts = t01();
console.log(JSON.stringify(calculate(facts), null, 2));
const snapshot = createSnapshot(facts);
facts.family.spouse.existence = 'UNKNOWN';
console.log(refreshSnapshot(snapshot, facts).result.status); // STALE
JS
```

## 구조

|파일|역할|
|---|---|
|`src/fraction.mjs`|십진 정수 문자열 경계, BigInt 유리수, 기약화, Q 검증. 모든 지분 연산은 정수로 수행|
|`src/approval.mjs`|여섯 규칙·열한 truth v1의 제한 승인, 법령 스냅샷 및 승인 차단. R04/R05는 PENDING|
|`src/engine.mjs`|G00 확인 게이트와 R01/R02/R03 단일 사건 배분, R06/R07의 배율·미해결 원장, provenance|
|`src/arithmetic.mjs`|T07의 순수 경로 곱셈·합산. 법률 엔진의 입력 경로와 분리|
|`src/validation.mjs`|합계 보존과 사람/경로 구조 검증을 서로 분리|
|`src/snapshot.mjs`|Node 동기 SHA-256 어댑터. 기존 createSnapshot/refreshSnapshot 반환 형식 유지|
|`src/browser.mjs`, `src/snapshot-browser.mjs`|공개 브라우저 진입점·Web Crypto SHA-256 비동기 스냅샷. Node 내장 모듈 의존 없음|
|`src/snapshot-common.mjs`, `src/version.mjs`|공유 결정적 직렬화·입력/승인 사본·STALE 복사·엔진 버전|
|`src/index.mjs`|공개 API|
|`test/fixtures.mjs`|완전 가공 사실과 구현 전 문서에서 옮긴 고정 기대값. 엔진 import·출력 역산 없음|
|`test/truth.test.mjs`|필수 11개 truth. 사람·지분·경로·규칙·상태·경고·미해결·provenance 비교|
|`test/guards.test.mjs`|기존 22개 경계/무결성/미지원/버전/STALE 시험|
|`test/defects.test.mjs`, `test/review-regressions.test.mjs`, `test/snapshot-browser.test.mjs`|세 결함과 검토 때만 실행했던 변형의 지속 회귀 테스트|
|`test/browser/`|loopback 실제 브라우저 검사만 수행하는 최소 하네스. 제품 UI 아님|

## 입력 계약

JSON 형태의 검토 완료 사실을 받는다. OCR이나 원문에서 사실을 판정하는 API가 아니다. 실제 사건자료·개인정보를 넣지 않는다.

|필드|계약|
|---|---|
|`schemaVersion`, `material`|`c1-v1`, `SYNTHETIC`|
|`caseId`, `inputRevision`|명시적 가공 식별자·revision. ID는 영문/숫자/밑줄/하이픈, 1~100자|
|`asset`|가공 물건 ID, `review: CONFIRMED`, `share: {numerator: "1", denominator: "3"}` 등. Q는 0 초과1 이하이며 기본값 없음|
|`event`|사건 ID·피상속인 ID, `kind: SINGLE`, `deathOrder: CONFIRMED`, `openingDate: {value: "2017-01-10", precision: "DAY", review: "CONFIRMED"}`|
|`referenceDate`, `lawSnapshotId`|확인된 `2017-01-11` 및 승인된 스냅샷 ID|
|`truthReference`|선택적 시험 추적용 `{id, version: "v1"}`. 있으면 승인 목록·버전 확인. 숫자 정답을 자동 선택하거나 사실의 진실성을 보증하지 않음. 일반 가공 호출에서 생략하면 truthVersion은 null|
|`family`|`review`와 `complete`를 각각 CONFIRMED로 명시. `spouse`, `children`, `parents`, `remoteRelatives` 네 집합 모두 명시|
|각 집합|`existence: PRESENT / ABSENT_CONFIRMED / UNKNOWN`, `review`, `complete`, `members`. 누락·빈 목록으로 ABSENT_CONFIRMED를 만들지 않음|
|각 사람|가공 `id`, 확인된 관계·성년·생존 상태. `relation: SPOUSE / CHILD / PARENT / GRANDCHILD / GRANDPARENT`, `kind: LEGAL_MARRIAGE / BIOLOGICAL`, `adult`, `review`, `relationshipReview`는 CONFIRMED. `life: ALIVE / PREDECEASED / UNKNOWN`|
|먼 혈족|손자녀/조부모는 `viaId`로 자녀/부모를 연결. 생존 자녀 또는 생존 최근친 부모가 있는 제한된 비선택 사례만 지원. 대습으로 확장하지 않음|
|`scopeFacts`|아래 쟁점 모두 ABSENT_CONFIRMED가 필요. PRESENT는 미지원 차단, UNKNOWN/누락은 사실 미확인 차단|

`scopeFacts`의 필수 키는 `predeceasedChildBranches`, `fetus`, `adoption`, `relationshipDispute`, `renunciation`, `disqualification`, `lossOfInheritance`, `limitedAcceptance`, `specialBenefit`, `contribution`, `bequest`, `partition`, `specialAsset`, `internationalLaw`, `simultaneousDeath`, `missingPerson`, `multipleCapacity`, `successiveSuccession`, `historicalLaw`, `specialKinship`이다. 이 표시는 검토자가 확인한 가공 사실을 전달하는 계약이다. 엔진이 관계 기록만 보고 이 사실들을 확인했다고 추정하지 않는다.

부모 선사망은 R02의 최근친 선택용이다. 선사망 자녀는 지원하지 않는다. 자녀 전원 부존재와 자녀 전원 포기를 혼동하지 않는다. 배우자 단독·조부모만의 상속·셋 이상 부모·복수 배우자도 차단한다. 상위 구조/집합/인물의 추가 법률 필드는 무시하지 않고 미지원으로 차단한다. 생략된 관계 참조·중복 인물·모순 집합은 InputError다.

## 결과·검증

- 정상 상태 `REVIEW_READY`는 승인 범위의 가공 검토 결과이며 실제 권리 확정이 아니다. `relativeShare`는 최초 피상속인 지분 대비 비율, `wholeShare`는 물건 전체 대비 Q×상대분이다.
- `allocations`는 취득자별 합, `paths`는 직접 경로다. 각 경로에 사건·출발/도착 인물·rule ID/version·법령·truth 참조를 남긴다. `nonSelected`는 알려진 비선택자와 사유이며 취득 경로를 만들지 않는다.
- 법률/사실/범위 문제는 `BLOCKED`, `allocations`와 `paths`는 빈 목록, 미해결 묶음 하나의 `wholeShare=Q`다. ‘기장0’은 그 사람의 법률상 지분0이 아니다. 차단 사유와 경고를 보존하며 다른 사람에게 재분배하지 않는다.
- 손상 분수·분모0·음수·Q범위 오류·중복 ID 등은 `InputError(code, field)`로 중단한다. 잘못된 Q를0으로 바꾸어 가짜 보존식을 만들지 않는다.
- `provenance.appliedRules`와 `attemptedRules`를 분리한다. 미승인 R01은 시도 규칙에만 남긴다. 승인 컨텍스트 주입은 검토·철회 시험용이며 지원 규칙/날짜/법령을 넓힐 수 없다.
- `checks.conservation`은 배분+미해결=Q만 검사한다. `checks.identityPaths`는 중복·참조·수령자·경로별 합의 구조를 검사한다. 일관되게 잘못 지정한 수령자를 알아내는 법률 추론은 하지 않으므로 **별도 truth 테스트에서 고정한 사람/경로/규칙을 비교**한다. 합계가 맞아도 이 비교가 실패하면 오답이다.
- 결과와 스냅샷은 입력과 분리해 복제·동결한다. `refreshSnapshot`은 revision을 올리지 않은 사실 변경도 감지한다. STALE 결과는 재계산 전 사용하지 않는다. 되돌리기만으로 예전 STALE 결과를 되살리지 않는다. 호출자는 변경 시 이 API를 사용해야 하며 아직 UI 자동 연결은 없다.

분수의 입력 정수 문자열은 각 1,024자 이하다. 부동소수점 값·소수 문자열을 받지 않는다. 분모는 양수, 결과0은0/1로 정규화한다. 외부 객체의 파싱에는 1,024자 제한을 그대로 적용한다. 검증된 연산이 만든 불변 분수만 모듈 내부의 비공개 WeakSet으로 식별하여, 중간 분수가 더 길어져도 정확히 연산·검증한다. 임의 객체나 JSON 사본은 이 식별을 위조할 수 없다. JSON 출력은 긴 정수 문자열도 정확히 보존하지만, JSON/structuredClone 후 객체를 자동으로 내부 값으로 신뢰하지는 않는다. 1,024자를 넘는 출력 사본을 외부 Q로 재입력하면 거부하며, 스냅샷/결과를 재계산할 때는 원래 유효한 입력을 사용한다. 날짜 검증과 배열 인덱스 외에 지분을 Number로 변환하지 않는다.

T07은 `ARITHMETIC_ONLY`이며 `lawSnapshotId`와 `eventId`는 null이다. 법률 사건을 만든 것처럼 기록하지 않는다. `truthVersion: v1` 및 R06/R07 계약 경로만 추적한다. X의 두 경로 합산은 수학적 가정이며 법률상 복수 자격 병존을 허용하는 API가 아니다.

## 남은 제한

UI·PDF·OCR 연결, 법률 관계/원자료 확정, 일반 날짜의 자동 법령 선택, 실제 사건 검증·배포는 이번 구현에 없다. R04/R05와 기타 미승인 쟁점은 계속 PENDING이다. 코드·테스트 통과는 승인 범위를 확대하지 않는다.

## 브라우저 공개 API와 스냅샷 호환성

Node에서 패키지 기본 진입점(`src/index.mjs`)의 `createSnapshot`, `refreshSnapshot`은 계속 **동기**다. 브라우저에서는 `@inheritage/inheritance-engine/browser` 또는 정적 모듈 URL `src/browser.mjs`를 사용한다. browser 조건을 지원하는 도구에는 기본 export의 browser 매핑도 제공한다. 이 공개 진입점의 전체 import 연결에는 Node 전용 모듈이 없다.

```js
import { calculate, createSnapshotAsync, refreshSnapshotAsync } from './src/browser.mjs';
const result = calculate(facts); // 동기
const snapshot = await createSnapshotAsync(facts, approvals);
const current = await refreshSnapshotAsync(snapshot, changedFacts, approvals);
```

비동기 두 API는 Promise를 반환한다. Web Crypto가 가능한 secure context(개발 시험은 `http://127.0.0.1`)가 필요하다. `HASH_UNAVAILABLE`/`HASH_FAILED`는 명시적 오류이며 약한 해시·상수·원격 서비스로 대체하지 않는다. 입력/승인 객체를 첫 await 전에 복제하고 같은 사본으로 직렬화·해시·계산하여 호출 중 외부 수정이 결과와 해시를 갈라놓지 않는다.

Node와 브라우저는 키를 정렬하는 동일한 JSON 직렬화와 SHA-256을 사용한다. 의존성에는 엔진 버전도 들어가므로 0.1.0 스냅샷은 0.2.0에서 refresh하면 STALE이 된다. 법률 승인 범위 변경을 뜻하지 않는다. 동결된 결과·STALE 경고·되돌려도 STALE 부활 금지 계약을 유지한다. UI 자동 연결은 아직 없다.

## 실제 브라우저 시험

```sh
npm run test:browser
```

기존 `experiments/offline-ocr/node_modules/playwright` 개발 도구와 설치된 Chromium을 읽어 사용한다. OCR 코드는 수정하지 않는다. 다른 설치된 Playwright를 사용할 때는 `INHERITAGE_PLAYWRIGHT_MODULE`에 그 `index.mjs` 절대 경로를 지정할 수 있다. 이 하네스는 패키지/브라우저 설치를 수행하지 않으며 엔진 런타임 의존성을 추가하지 않는다.

127.0.0.1의 임시 포트로만 서버를 열고 공개 브라우저 모듈·필수 truth 11개·회귀 사례·비동기 변경·STALE·Node/브라우저 해시를 시험한다. 콘솔 오류·미처리 Promise 거절·외부 요청·계산 중 요청이 있으면 실패한다. Chromium sandbox를 활성화하며 보안 옵션을 완화하지 않는다. 서버와 브라우저는 종료 시 닫는다.

표준 `/Applications` 또는 사용자 `Applications` 경로의 기존 Edge가 있으면 같은 검사를 실제 Edge에서도 실행하고 버전을 출력한다. 다른 위치는 `INHERITAGE_EDGE_EXECUTABLE`로 지정할 수 있다. Edge가 없으면 설치하지 않고 미실시로 표시한다. Chromium 결과는 Edge 또는 실제 오프라인 업무 PC의 통과를 뜻하지 않는다. file://·제품 실행기·업무 UI는 이번 범위가 아니다.

## M2 S1 기술 스냅샷과 세션

M2는 별도 `@inheritage/inheritance-engine/m2` 또는 `src/m2.mjs`로 사용한다. R04/R05는 계속 PENDING이다. 정상 지분 계산 없이 S0의 BLOCKED 결과와 전체 미해결 Q를 스냅샷으로 보관한다.

```js
import { createM2SnapshotAsync, refreshM2SnapshotAsync, createM2Session } from './src/m2.mjs';
const snapshot = await createM2SnapshotAsync(m2Facts);
const checked = await refreshM2SnapshotAsync(snapshot, changedM2Facts);
const session = createM2Session();
session.setInput(m2Facts); // 복제·검증, 이전 게시 결과 즉시 제거
await session.run();
const state = session.getState(); // 현재 결과는 state.snapshot, 과거 것은 previousSnapshot
session.cancel();
```

두 비동기 함수는 Node와 브라우저 모두 Web Crypto SHA-256을 사용한다. secure context가 필요하며 `SnapshotError`의 `HASH_UNAVAILABLE`/`HASH_FAILED`로 명시 중단한다. 약한 해시나 네트워크 대체는 없다. 입력과 엔진 소유 의존성을 첫 await 전에 캡처해 같은 사본으로 계산·해시한다. 일반 사건 JSON이나 추가 인자로 승인 레지스트리를 선택할 수 없다.

스냅샷은 `m2-snapshot-draft-v1`이며 불변 객체다. `validity`는 CURRENT/STALE, 결과 상태는 현재 BLOCKED 또는 STALE이다. 전체 입력·배열 순서·법령 참조와 엔진/스키마/계약/승인 의존성을 해시한다. 객체 키 순서는 정규화한다. STALE 이후 원본 입력이나 원래 스냅샷 참조를 다시 넘겨도 부활하지 않는다. 새로운 계산은 새 스냅샷을 생성해야 한다.

S1 스냅샷은 생성한 모듈 인스턴스 안에서만 refresh할 수 있다. C1 객체·위조 객체·JSON/structuredClone 사본·다른 인스턴스의 객체는 `M2_SNAPSHOT_REQUIRED`로 거부한다. 직렬화해 저장하는 것은 가능하지만 복원/마이그레이션 API는 없다. Node/브라우저의 동일 해시는 검증하며 인스턴스 간 객체 복원 지원을 뜻하지 않는다. 기존 C1 refresh의 계약을 변경하지 않았으며 M2 객체는 M2 API에만 전달해야 한다.

통합 검토 수정의 기술 버전은 `m2-validation-0.1.1`, `m2-snapshot-safety-v1.0.1`이다. 법률/규칙/승인 버전 변경이 아니다. 객체 경계에서는 배열도 일반 Array.prototype만 허용하며 사용자 정의 배열 subclass/prototype은 NON_JSON_INPUT으로 거부한다. 다른 realm의 객체를 넘기는 API가 아니라 일반 JSON 데이터를 받는 경계이며, 원시 JSON은 문자열 파싱 API를 이용한다.

발급된 현재 스냅샷의 refresh 중 입력 검사 또는 해시 검사가 실패하면 원래 스냅샷을 내부적으로 STALE 처리한 뒤 원래 InputError/SnapshotError를 그대로 throw한다. 검증 실패를 이전 결과의 유효성 증거로 취급하지 않는다. 입력을 원상 복원하고 원래 참조로 재시도해도 STALE이며, 새 결과에는 create가 필요하다. 외부 위조/복제 객체는 속성에 접근하기 전에 소유권 검사로 거부한다.

직접 refresh를 사용하는 호출자는 요청 시작 전에 기존 최신 출력 사용을 중지하고 실패 시 계속 비워 두어야 한다. 과거 불변 객체의 CURRENT 속성 자체나 이미 저장한 state 사본이 소급 변경되는 것은 아니다. refresh 반환값과 현재 세션 getState를 사용해야 하며, null 결과/STALE 과거 자료를 최신 결과로 표시하지 않는다. 잘못된 인자 수나 소유권 실패는 유효한 대상에 대한 재검증이 아니므로 다른 스냅샷을 무효화하지 않는다.

세션은 입력을 불변 사본으로 소유한다. 외부 원본의 변경은 자동 편집으로 취급하지 않으므로 편집마다 `setInput`을 호출한다. 이 호출은 동기적으로 기존 결과를 제거한다. run 중에도 게시 스냅샷은 null이며 요청 epoch가 맞는 최신 완료만 게시한다. 실패/취소/의존성 무효화도 이전 결과를 되살리지 않는다. `invalidateDependencies()`는 컨텍스트 변경 알림용이며 승인 객체를 받지 않는다. `getState()`도 게시 결과의 현재 의존성을 재확인한다. 일반 코드에서 보관한 과거 state 객체가 자동 변형되는 것은 아니므로 소비자는 현재 getState를 확인해야 한다.

`previousSnapshot`은 STALE 과거 자료이고 최신 출력으로 사용하지 않는다. 이번에는 UI·클립보드·역사 취득 원장을 연결하지 않았다. 내부 시험용 의존성 공급자는 해시/무효화만 검증하며 실제 calculateM2 승인 정책을 바꾸지 않는다. 자세한 범위와 미실시는 `docs/inheritance/M2_S1_REPORT.md`에 기록했다.

```sh
npm test --prefix packages/inheritance-engine
npm run test:browser:m2 --prefix packages/inheritance-engine
```
