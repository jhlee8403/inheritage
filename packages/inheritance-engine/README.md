# M0+M1 inheritance engine (C1)

가공 자료를 위한 단일 사건 법정 지분 기초계산 모듈이다. 사용자 승인 기록은 `docs/inheritance/LEGAL_APPROVAL_M0_M1.md`의 `C1-approval-v1`이다. 기존 기준선의 정답 수치는 바꾸지 않았다.

지원 범위는 실제 사망 개시일 **2017-01-10**, 결과 기준일 **2017-01-11**, `BL1-LAW-2016-14409`로 고정한다. 법률혼 배우자+생존 성년 친생자녀, 배우자+최근친 생존 성년 친생부모, 배우자 없는 생존 성년 친생자녀만 계산한다. 다른 일자·법령·관계로 자동 확대하지 않는다.

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
|`src/snapshot.mjs`|입력·관계·법령·Q·승인 버전 전체의 SHA-256 의존성 해시, 변경 시 STALE|
|`src/index.mjs`|공개 API|
|`test/fixtures.mjs`|완전 가공 사실과 구현 전 문서에서 옮긴 고정 기대값. 엔진 import·출력 역산 없음|
|`test/truth.test.mjs`|필수 11개 truth. 사람·지분·경로·규칙·상태·경고·미해결·provenance 비교|
|`test/guards.test.mjs`|22개 경계/무결성/미지원/버전/STALE 시험|

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

분수의 입력 정수 문자열은 각 1,024자 이하다. 부동소수점 값·소수 문자열을 받지 않는다. 분모는 양수, 결과0은0/1로 정규화한다. 날짜 검증과 배열 인덱스 외에 지분을 Number로 변환하지 않는다.

T07은 `ARITHMETIC_ONLY`이며 `lawSnapshotId`와 `eventId`는 null이다. 법률 사건을 만든 것처럼 기록하지 않는다. `truthVersion: v1` 및 R06/R07 계약 경로만 추적한다. X의 두 경로 합산은 수학적 가정이며 법률상 복수 자격 병존을 허용하는 API가 아니다.

## 남은 제한

UI·PDF·OCR 연결, 법률 관계/원자료 확정, 일반 날짜의 자동 법령 선택, 실제 사건 검증·배포는 이번 구현에 없다. R04/R05와 기타 미승인 쟁점은 계속 PENDING이다. 코드·테스트 통과는 승인 범위를 확대하지 않는다.
