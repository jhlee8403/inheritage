# M2 계산 엔진 데이터·검증 계약 설계안

작성일2026-10-23 (Asia/Seoul). 버전 `M2-contract-draft-v1`. **기술 설계 확정 PENDING / R04·R05 법률 승인 PENDING / 계산 구현 착수 승인 없음.** 이번 사용자 승인은 문서 설계 작업이다. 예시·필드·API·reason 이름은 미구현 제안이며 새 법률 정답이 아니다. 기존 M0+M1 승인과 코드·화면·truth를 변경하지 않는다.

## 1. 기준·열람·호환성

저장소 `jhlee8403/inheritage`, 기준 `docs/m2-r04-r05-legal-review` / `a5548fc6c60978f232148be1f18b4cc9d4869788`. 로컬과 `git ls-remote --heads origin`의 실제 기준 HEAD가 일치했고 clean이었다. 동명 로컬/원격 설계 브랜치가 없음을 확인한 뒤 `docs/m2-engine-contract`를 생성했다. reset·이력 변경·push 없음.

검토 근거: [법률 검토](M2_R04_R05_LEGAL_REVIEW.md), [문서형 truth](M2_R04_R05_TRUTH_CANDIDATES.md), LEGAL_REVIEW_QUEUE(Q-09), LEGAL_APPROVAL_M0_M1, LEGAL_BASELINE_V1, DATA_MODEL, ENGINE_DESIGN, C1_M0_M1_REPORT. 이번에는 새 법률 조사를 하지 않고 위의 법률 명제·제외·수치 후보를 유지한다.

실제 `packages/inheritance-engine/src/`의 전 모듈과 기존 truth/guard/회귀/스냅샷·브라우저 시험, `experiments/inheritance-calculator/`의 입력 builder·session·출력·복사 및 브라우저 시험을 읽었다. 현재 엔진0.2.0의 계약과 제안의 차이는 다음과 같다.

|항목|현 C1 실제 계약|M2 제안|
|---|---|---|
|입력/API|c1-v1, calculate(input,approvals), event 하나|별도 m2-input-draft-v1 및 별도 진입점. 기존 calculate에 M2 자동 위임 금지|
|결과|c1-result-v1, eventId 하나, DIRECT paths, allocations/nonSelected/unresolved|별도 m2-result-draft-v1. 사건별 결과·가지 기준·실제 취득/소비·말단 구별|
|날짜|개시01-10,기준01-11 고정|후보에 명시한 사건/기준일 쌍만 별도 승인 필요|
|승인|RULE_IDS 여섯 개 고정, R04/R05 PENDING 및 allowlist 밖|기존 allowlist를 입력 플래그로 넓히지 않음. 별도 모듈/의존/날짜 바인딩 필요|
|분수|BigInt, 십진 문자열, 외부 각1024자, 비공개 WeakSet 내부 값|같은 정확 산술 계약 유지. JSON의 긴 결과 사본을 신뢰된 내부 값으로 간주하지 않음|
|snapshot|Node 동기 create/refresh, 브라우저 Async, 첫 await 전 복제·동일 사본 해시/계산|기존 API 유지. 별도 M2 snapshot 형식과 의존성·최신성 검사|
|무결성|validateConservation와 validateIdentityPaths 분리, 오류 시 InputError(RESULT_INTEGRITY_ERROR)|사건 유입 보존·원장 소비·말단 보존·사람/경로를 추가 분리. 기존 검사 함수를 다중 사건에 그대로 쓰지 않음|
|화면|c1 입력/결과를 session의 revision/request로 관리|현재 화면 그대로. 향후 별도 M2 연결 승인 전 변경 금지|

새 함수명 후보는 `calculateM2`, `createM2SnapshotAsync/refreshM2SnapshotAsync`와 Node 동기 쌍이다. 이름/패키지 export/버전은 PENDING. 기존 엔트리에 합치는 대안은 호출이 간단하지만 조용한 의미 변경 위험이 있어 **분리 진입점**을 우선 제안한다. C1→M2 변환은 사용자가 명시적으로 요청하는 향후 migration만 허용하고 원본을 보존한다. M2 필드를 기존 입력에 덧붙여 C1 게이트를 우회하지 않는다. 순수 산술 evaluateArithmeticPaths도 M2 법률 진입점이 아니다.

## 2. 상태·승인·단위

법률 승인, 사용자 개발 착수 승인, 기술 설계 확정은 별도 기록/상태다. 사실 CONFIRMED·문서 작성·산술 통과가 이 셋을 대신하지 않는다. 승인 컨텍스트는 엔진/호출 환경이 선택하는 검토된 레지스트리로 공급하고 일반 사건 JSON에 status/approved/approvalOverride를 받지 않는다. 로컬에서 코드를 고친 악의적 호출까지 방지하는 보안 경계라고 주장하지 않는다.

|분수 필드|의미|T05-B G1 / T04 G1|
|---|---|---|
|initialShare Q|최초 물건 전체 대비 A 시작 지분|T05-B1/3, T04 1/1|
|inputWholeShare|해당 사건으로 들어오는 이 물건의 유입|E2는1/6 / E1은1/1|
|eventRelativeShare|그 사건 유입 전체 대비 해당 취득분|1/2 / 1/4|
|rootRelativeShare|최초Q 대비 누적 취득분|1/4 / 1/4|
|wholeShare|물건 전체 대비 취득분|1/12 / 1/4|
|branchRelativeShare·withinBranchShare|R04의 가정 가지 비율·가지 내부 비율|해당 없음 /1/2·1/2|

R04 G1의 eventRelativeShare는1/4이며 가지 내부1/2와 다르다. R05에서는 eventRelativeShare와 rootRelativeShare가 달라진다. C1의 relativeShare를 새 의미로 덮어쓰지 않는다. 모든 분수는 `{numerator:"1",denominator:"3"}` 형식으로 입출력, 내부 BigInt 기약분수·양수 분모 사용. 소수/Number 경유 금지, 내부0은0/1. Q는0<Q≤1, 사건 유입은0초과Q이하. 기본Q·미상값0 보정 없음.

## 3. 입력 구조

일반 사실만 입력받고 취득액·가지 몫·경로 산술·소비잔액은 받지 않는다. root 외부 확정 중간 지분 입력·여러 물건·여러 유입·병존 복수 자격은 초기 M2 제외다.

|객체|필드·검증|
|---|---|
|Envelope|schemaVersion,material=SYNTHETIC,caseId,inputRevision,requestedModule,root,referenceDate,persons,relations,deathFacts,events,eventFacts,historicalFamilyFacts(R04 조건부 필수),truthReference(시험 추적 선택)|
|root|assetId,decedentId,initialShare,review. root는 사건열 전체에서 하나이며 E2에서 새Q를 받지 않음|
|Person|personId만 전역 정체성. 전역 ALIVE/제외자 속성 금지|
|Relation|relationId,parentId,childId,kind=BIOLOGICAL,review. 사건별 children.memberRelationIds로 그 시점 효력/전원 여부 확인. 중복 간선·자기 관계·순환 금지|
|DeathFact|deathFactId,personId,date{value,precision,review}. 실제 사망만, 신고일/실종/추정 제외|
|Event|eventId,decedentId,deathFactId,lawRef{id,version},factsRef,incomingRequest. eventId/deathFact/피상속인 일치|
|incomingRequest|ROOT_ASSET 또는 FROM_EVENT(sourceEventId,recipientId). 사용자가 전송 금액·derived acquisitionId를 지정하지 않음. engine이 검증된 선행 취득을 찾고 1개인지 확인|
|EventFacts|factsId,eventId,review,complete,lifeStates,adultStates,families,scopeFacts. 시점마다 별도 레코드, E1 확인을 E2 확인으로 복사하지 않음|
|families|subjectId별 spouse/children 집합. existence·review·complete·members/memberRelationIds를 별도로 보유. R04는 같은 E1에 A와 B 가족 필요|
|lifeStates|사건 시점 ALIVE/PREDECEASED/DEAD_AT_OPEN/UNKNOWN, 각 review. decedent만DEAD_AT_OPEN. deathFacts와 모순이면 차단/오류 분류표 적용|

존재는 PRESENT/ABSENT_CONFIRMED/UNKNOWN, review는 CONFIRMED/UNKNOWN/NEEDS_REVIEW/CONFLICTED의 제안 enum. 값 누락은 미확인으로 BLOCKED하고 부존재로 채우지 않는다. 인물·사건·관계 ID의 길이/문자 허용은 C1의1~100 ASCII 식별자 범위를 우선 유지한다. path ID는 파생/별도 namespace로 관리해 C1 ID 정규식을 그대로 적용하지 않는다.

`scopeFacts`의 필수 목록은 현 engine.mjs SCOPE_FACTS의20개를 보존하되 **새 스키마의 승인된 모듈만** predeceasedChildBranches=PRESENT(R04), successiveSuccession=PRESENT(R05)를 허용하는 후보다. 나머지18개는 모두 ABSENT_CONFIRMED. R04는 successiveSuccession 부존재, R05는 predeceasedChildBranches 부존재를 확인한다. C1의 같은 키 값 의미/게이트는 바꾸지 않는다. PRESENT를 모듈 선택으로만 합법화하지 않고 실제 사실·한 단계/한 가지/두 사건 제한과 승인 바인딩을 모두 대조한다.

### JSON 입력 예시 — T05-B의 골격

아래는 JSON으로 파싱 가능한 **구조 예시**다. 생략된 eventFacts가 있기 때문에 현재/향후에도 이 예시 그대로는 정상 계산 입력이 아니며 FACTS_INCOMPLETE로 차단해야 한다. 승인된 fixture/원자료가 아니다. 뒤의 EventFacts 예시로 채워도 R05·E2 범위 승인은 여전히 PENDING이다.

```json
{
  "schemaVersion": "m2-input-draft-v1",
  "material": "SYNTHETIC",
  "caseId": "M2Synthetic",
  "inputRevision": "1",
  "requestedModule": "M2_SUCCESSIVE",
  "root": {"assetId":"SYN-ASSET-01","decedentId":"A","initialShare":{"numerator":"1","denominator":"3"},"review":"CONFIRMED"},
  "referenceDate": {"value":"2017-01-21","precision":"DAY","review":"CONFIRMED"},
  "persons": [{"personId":"A"},{"personId":"B"},{"personId":"C"},{"personId":"G1"},{"personId":"G2"}],
  "relations": [
    {"relationId":"AB","parentId":"A","childId":"B","kind":"BIOLOGICAL","review":"CONFIRMED"},
    {"relationId":"AC","parentId":"A","childId":"C","kind":"BIOLOGICAL","review":"CONFIRMED"},
    {"relationId":"BG1","parentId":"B","childId":"G1","kind":"BIOLOGICAL","review":"CONFIRMED"},
    {"relationId":"BG2","parentId":"B","childId":"G2","kind":"BIOLOGICAL","review":"CONFIRMED"}
  ],
  "deathFacts": [
    {"deathFactId":"DA","personId":"A","date":{"value":"2017-01-10","precision":"DAY","review":"CONFIRMED"}},
    {"deathFactId":"DB","personId":"B","date":{"value":"2017-01-20","precision":"DAY","review":"CONFIRMED"}}
  ],
  "events": [
    {"eventId":"E1","decedentId":"A","deathFactId":"DA","lawRef":{"id":"BL1-LAW-2016-14409","version":"v1"},"factsRef":"F1","incomingRequest":{"kind":"ROOT_ASSET"}},
    {"eventId":"E2","decedentId":"B","deathFactId":"DB","lawRef":{"id":"BL1-LAW-2016-14409","version":"v1"},"factsRef":"F2","incomingRequest":{"kind":"FROM_EVENT","sourceEventId":"E1","recipientId":"B"}}
  ],
  "eventFacts": [],
  "truthReference": {"id":"BL1-T05-B","version":"v1"}
}
```

lawRef.version은 새 법률 버전의 창설이 아니라 향후 대조용 레지스트리 버전 필드 제안이다. 기존 C1에 law.version 필드가 있다고 해석하지 않는다.

### EventFacts 예시 — E2의 명시적 사실

독립 JSON 조각이다. F1은 별도로 A의 자녀 AB/AC와 E1의 B/C 생존·성년·사실 완전성을 확인해야 한다. F2만으로 F1을 보충하지 않는다. scopeFacts 목록의 모든 부정 사실은 가공 예시의 명시값이며 입력 기본값이 아니다.

```json
{
  "factsId":"F2","eventId":"E2","review":"CONFIRMED","complete":"CONFIRMED",
  "lifeStates":[{"personId":"B","value":"DEAD_AT_OPEN","review":"CONFIRMED"},{"personId":"G1","value":"ALIVE","review":"CONFIRMED"},{"personId":"G2","value":"ALIVE","review":"CONFIRMED"}],
  "adultStates":[{"personId":"G1","value":"CONFIRMED"},{"personId":"G2","value":"CONFIRMED"}],
  "families":[{"subjectId":"B","review":"CONFIRMED","complete":"CONFIRMED",
    "spouse":{"existence":"ABSENT_CONFIRMED","review":"CONFIRMED","complete":"CONFIRMED","members":[]},
    "children":{"existence":"PRESENT","review":"CONFIRMED","complete":"CONFIRMED","memberRelationIds":["BG1","BG2"]}}],
  "scopeFacts":{
    "predeceasedChildBranches":"ABSENT_CONFIRMED","successiveSuccession":"PRESENT",
    "fetus":"ABSENT_CONFIRMED","adoption":"ABSENT_CONFIRMED","relationshipDispute":"ABSENT_CONFIRMED",
    "renunciation":"ABSENT_CONFIRMED","disqualification":"ABSENT_CONFIRMED","lossOfInheritance":"ABSENT_CONFIRMED",
    "limitedAcceptance":"ABSENT_CONFIRMED","specialBenefit":"ABSENT_CONFIRMED","contribution":"ABSENT_CONFIRMED",
    "bequest":"ABSENT_CONFIRMED","partition":"ABSENT_CONFIRMED","specialAsset":"ABSENT_CONFIRMED",
    "internationalLaw":"ABSENT_CONFIRMED","simultaneousDeath":"ABSENT_CONFIRMED","missingPerson":"ABSENT_CONFIRMED",
    "multipleCapacity":"ABSENT_CONFIRMED","historicalLaw":"ABSENT_CONFIRMED","specialKinship":"ABSENT_CONFIRMED"
  }
}
```

R04 입력은 동일한 별도 스키마의 requestedModule=M2_REPRESENTATION, DB=01-01, events=[E1]이고 E1 안의 families에 A/B를 각각 확인한다. E1 lifeStates에서 B=PREDECEASED, C/G1/G2=ALIVE, 필요한 성년·관계 확인을 명시한다. scope의 선사망 가지PRESENT/연속ABSENT를 반대로 배치한다. B의 사망 사실은 존재하지만 B를 피상속인으로 하는 최초 물건 이벤트를 생성하지 않는다. B 배우자는 B 사망 시 및 E1 부존재 확인도 필요하며 E1 families만으로 전자의 확인을 추정하지 않는다.

별도 `historicalFamilyFacts` 배열과 E1의 B 가족에 `historicalSpouseFactRef`를 두는 방식을 우선 제안한다. 아래는 B 사망 시 확인만의 JSON 조각이며 E1 배우자 확인은 별도 필요하다. eventFamilyReferenceExample은 연결 위치를 보여주는 설명용 포장으로 실제 Envelope 필드가 아니다. 일반 사실 assertion으로 통합하는 대안과 최종 필드명은 미정이다. JSON 골격을 완전한 정상 fixture로 승격시키는 작업은 아직 하지 않는다.

```json
{
  "historicalFamilyFacts":[{
    "factId":"B-SPOUSE-AT-DEATH","subjectId":"B","atDeathFactId":"DB",
    "spouse":{"existence":"ABSENT_CONFIRMED","review":"CONFIRMED","complete":"CONFIRMED","members":[]}
  }],
  "eventFamilyReferenceExample":{"eventId":"E1","subjectId":"B","historicalSpouseFactRef":"B-SPOUSE-AT-DEATH"}
}
```

## 4. 승인·날짜 의존성과 처리 순서

승인 바인딩의 논리 키는 `(module, ruleId, ruleVersion, lawId/lawVersion, eventOpeningDate, referenceDate, supportedFactProfile, contractVersion, approvalRecordVersion)`를 포함한다. 기록에 정확한 범위/제외가 있어야 하며 임의 날짜 구간이나 사실 집합을 호출자가 승인 레코드로 위장할 수 없다. truthReference는 결과 선택 키가 아니며 있으면 별도 truth 승인/버전도 확인한다.

|요청|필수 승인 의존 후보|
|---|---|
|R04/T04|R04 + E1 복합 가지 선택의 G00/R03/R06/R07 범위 + E1일자/01-11기준 + law·truth·계약. 기존R03만으로 가지 분모 승인 안 됨|
|R05/T05/T05-B|R05 조정 계약 + E1/E2 각각 G00/R03/R06/R07 + 01-10/01-20 개시·01-21 기준 + law·truth·계약|
|R05 MID|R05 요청 조정/기준일 제외 정책 + E1의 의존 범위 + 01-15기준 승인. 확실히 미래인 E2의 실체 배분 승인은 현재 계산에 사용하지 않되 R05 자체는 필요|

현재 승인 레지스트리에 위 M2 바인딩은 없다. 법률 문서 존재만으로 생성/활성화하지 않는다. R05는 E1이 기존M1과 같아도 조정 게이트를 먼저 통과해야 한다. 공개 calculate를 두 번 호출한 수치를 M2의 승인 결과로 합성하는 설계는 금지한다. 재사용 가능한 것은 승인된 내부 산술/검증 부품이며 매 호출에 별도 전체 승인 proof를 확인한다.

검증 순서 후보:

1. JSON 크기/객체 수/ID/분수 길이/형식·root Q 검사. 자원 한계의 정확한 수치는 미정이며 무제한 처리는 허용하지 않는다.
2. ID 유일성·참조·관계/사건 DAG·유입 출처·동일 실질 참조 검증. 사실 누락과 깨진 참조를 구별한다.
3. 실제 사망일/정밀도/선후·기준일 검토. 같은 날·겹친 범위는 임의 순서 금지. 초기 후보의 개시/기준일 조합만 허용.
4. 요청 모듈·활성 사건·의존 closure를 정하고 승인 proof 검사. 미래 E2는 날짜·미래 여부·출처 일관성이 확인돼야 NOT_YET_OPENED. 과거 시점 판정에 필요한 사실이 불명확하면 미래로 추정하지 않음.
5. 필요한 각 사건/가지의 가족·관계·생존·부정 사실·제외 조건 확인. 하나라도 필요한 게이트 실패 시 정상 계산/게시 안 함.
6. 아래 모듈별 순서로 내부 원장 후보를 만들되 외부 확정 결과로 게시하지 않는다. 실제 취득·소비·말단·분수를 각각 검증한다.
7. 최종 불변식 및 승인 proof/hash 일치까지 성공한 경우에만 불변 결과를 게시한다. 미래 사건의 불완전 가족은 필요한 사실이 아닐 때만 비평가 상태로 격리한다. 구조 순환/깨진 참조까지 무시하는 예외는 아님.

R04 순서: E1 자녀 단위·한 선사망 가지 적격 확인 → C 직접 몫과 B 가정상 가지 기준 분리 → B가지 내부 G1/G2 적격/비율 → 같은 E1에 G1/G2 실제 취득 → B 실제 취득/전달 기록 부재 검증. 재귀 확장을 일반화하지 않으며 미지원 배우자/재대습/결격/전원 선사망 등은 BLOCKED다.

R05 순서: E1 독립 사실·법령으로 B/C 실제 취득 → B 유입과 asset/root 연결 고정 → 기준일이 E2 전이면 B/C를 말단으로 종료 → E2가 활성이고 승인/사실이 완전하면 B 유입 한 묶음을 정확히 한 번 소비 → E2 G1/G2 실제 취득 → 소비된 B를 최종 말단에서 제외하되 역사 기록 유지. B 고유재산·외부 입력Q·세 번째 사건·복수 유입 병합은 미지원이다.

## 5. 출력·원장 구조와 예시

|출력 객체|의미·필수 식별|
|---|---|
|eventResults|eventId,openingDate,lawRef,factsRef,approvalProofRef,status. ACTIVE_VERIFIED/NOT_YET_OPENED/NOT_EVALUATED 등의 내부 처리 상태는 결과 REVIEW_READY/BLOCKED와 별개|
|branchBases|basisId,eventId,mediatorId,branchRelativeShare,wholeShare,law/rule/proof. isActualAcquisition=false 필수. 가정 기준이며 실제 원장/말단 합계에 포함 금지|
|eventInputs|inputId,eventId,assetId,sourceKind,sourceAcquisitionId(또는root),ownerId,inputWholeShare,inputRootRelativeShare. 파생값이며 사용자 입력 아님|
|acquisitions|acquisitionId,eventId,personId,inputId,kind(DIRECT/REPRESENTATION),매개/가지 참조,eventRelativeShare,rootRelativeShare,wholeShare,provenanceRef. 실제 취득만 수록|
|consumptions|sourceAcquisitionId,targetEventInputId,wholeShare. 각 실제 유입을 정확히 한 번 후속 사건에 전달, 부분 소비/여러 자격 재사용은 초기 제외|
|paths|최종 말단의 pathId,pathKind(DIRECT/REPRESENTATION/SUCCESSIVE),terminalAcquisitionId,rootAssetId,orderedStepRefs,mediatorIds,rootRelativeShare,wholeShare,provenanceRefs. R05는 두 사건, R04는 같은 사건 내 가지|
|allocations|사람별 말단 path 합계,personId,pathIds,rootRelativeShare,wholeShare. 사건 내 상대분은 각 step에 남기고 집계값으로 오인하지 않음|
|auditHistory|BLOCKED에서도 독립 검증된 과거 기록을 보관할 선택 영역. 최종 배분 아님/합계 포함 불가, 자체 snapshot·승인 proof·기준일·validity 표시|
|unresolved|원자적 전체 BLOCKED면 root별 한 묶음 Q,rootRelativeShare=1/1,사유 목록. 부분 가지 미해결과 중복 기장 안 함|

T04의 가정 가지와 T05의 역사 취득을 별도 배열로 두는 것이 우선안이다. 통합 원장+type 방식은 조회가 간단하지만 합계에 가정/역사를 섞기 쉬워 후순위다. 초기 하나의 원장에 여러 의도된 병존 자격을 합산하는 기능은 제안하지 않는다.

R05에서 각 사건의 실제 취득 kind는 DIRECT이고, E1→E2를 잇는 최종 pathKind가 SUCCESSIVE다. 같은 필드에 사건 내 자격과 전체 경로 유형을 섞지 않는다. R04의 두 가지 step은 같은 E1에서 이루어지므로 eventIds 개수만으로 적격을 판정하지 않고 매개/가지 참조도 검사한다.

### 현재 PENDING 요청의 JSON 출력 형식 예시

유효 Q=1/3의 구조/사실이 충분한 T05-B를 향후 M2 게이트에 입력한 경우의 **차단 형식**이다. 현 엔진이 이 스키마를 지원한다는 뜻은 아니다. 예시 reason 목록은 PENDING 의존성을 한 행으로 축약했으며 실제 필드별 진단에는 각 미승인 의존 ID도 남겨야 한다.

```json
{
  "schemaVersion":"m2-result-draft-v1","contractVersion":"M2-contract-draft-v1",
  "caseId":"M2Synthetic","inputRevision":"1","status":"BLOCKED",
  "rootAssetId":"SYN-ASSET-01","initialShare":{"numerator":"1","denominator":"3"},
  "referenceDate":"2017-01-21","eventResults":[],"branchBases":[],
  "eventInputs":[],"acquisitions":[],"consumptions":[],"paths":[],"allocations":[],"auditHistory":[],
  "unresolved":[{"id":"ROOT-UNRESOLVED","rootAssetId":"SYN-ASSET-01","rootRelativeShare":{"numerator":"1","denominator":"1"},"wholeShare":{"numerator":"1","denominator":"3"}}],
  "blockedReasons":[{"code":"RULE_PENDING","ruleId":"BL1-R05","field":"requestedModule"}],
  "warnings":["SYNTHETIC_ONLY","STATUTORY_SHARE_ONLY","NOT_A_RIGHTS_DETERMINATION"],
  "provenance":{"engineVersion":"M2-NOT-IMPLEMENTED","schemaVersion":"m2-result-draft-v1","lawSnapshotIds":["BL1-LAW-2016-14409"],"requestedRules":[{"id":"BL1-R05","version":"v1"}],"appliedRules":[],"approvalRecordVersion":"C1-approval-v1","truthReference":{"id":"BL1-T05-B","version":"v1"}},
  "checks":{"rootConservation":{"ok":true,"allocated":{"numerator":"0","denominator":"1"},"unresolved":{"numerator":"1","denominator":"3"}},"eventConservation":{"status":"NOT_RUN"},"pathIdentity":{"status":"NOT_RUN"}}
}
```

engineVersion의 M2-NOT-IMPLEMENTED는 미구현 예시 표지이며 실제 런타임 버전이 아니다. 현재 승인 기록 참조도 M2 승인 선언이 아니다. 향후 구현 버전은 별도 결정하고0.2.0을 M2 지원 버전으로 재해석하지 않는다.

### 조건부 원장 투영 — 런타임 출력 아님

아래는 기존 truth의 구조를 표현한 JSON 조각이다. conditionalOnly=true는 설명용 바깥 표지이며 제품 입력의 우회 플래그가 아니다. 필요한 법률·의존·기술 계약이 승인된 후 비교할 계획으로, 현재 PENDING 상태에서 이 수치를 REVIEW_READY로 게시하면 안 된다.

```json
{
  "conditionalOnly":true,"truthId":"BL1-T04",
  "basis":{"basisId":"BASIS-B","eventId":"E1","mediatorId":"B","isActualAcquisition":false,"branchRelativeShare":{"numerator":"1","denominator":"2"},"wholeShare":{"numerator":"1","denominator":"2"}},
  "terminalProjection":[
    {"pathId":"D:E1:A:C","personId":"C","kind":"DIRECT","eventIds":["E1"],"mediatorIds":[],"wholeShare":{"numerator":"1","denominator":"2"}},
    {"pathId":"D:E1:A:B:G1","personId":"G1","kind":"REPRESENTATION","eventIds":["E1"],"mediatorIds":["B"],"wholeShare":{"numerator":"1","denominator":"4"}},
    {"pathId":"D:E1:A:B:G2","personId":"G2","kind":"REPRESENTATION","eventIds":["E1"],"mediatorIds":["B"],"wholeShare":{"numerator":"1","denominator":"4"}}
  ],"actualAcquisitionRecipients":["C","G1","G2"]
}
```

```json
{
  "conditionalOnly":true,"truthId":"BL1-T05-B",
  "historicalAcquisition":{"acquisitionId":"ACQ-E1-B","eventId":"E1","personId":"B","wholeShare":{"numerator":"1","denominator":"6"}},
  "eventInput":{"inputId":"IN-E2","eventId":"E2","sourceAcquisitionId":"ACQ-E1-B","ownerId":"B","inputWholeShare":{"numerator":"1","denominator":"6"}},
  "consumption":{"sourceAcquisitionId":"ACQ-E1-B","targetEventInputId":"IN-E2","wholeShare":{"numerator":"1","denominator":"6"}},
  "terminalProjection":[
    {"pathId":"S:E1:A:C","personId":"C","eventIds":["E1"],"wholeShare":{"numerator":"1","denominator":"6"}},
    {"pathId":"S:E1:A:B:E2:G1","personId":"G1","eventIds":["E1","E2"],"wholeShare":{"numerator":"1","denominator":"12"}},
    {"pathId":"S:E1:A:B:E2:G2","personId":"G2","eventIds":["E1","E2"],"wholeShare":{"numerator":"1","denominator":"12"}}
  ]
}
```

완전한 성공 출력은 위 표의 필수 필드/참조를 모두 충족해야 한다. 조각을 그대로 성공 fixture로 쓰지 않는다. MID에서는 E2 input/consumption/취득을 만들지 않고 E1의 B/C 각Q/2를 말단으로 둔다. E2 eventResults는 NOT_YET_OPENED, appliedRules에 E2 계산을 싣지 않으며 미래의 미확인 가족을 확인 완료로 표시하지 않는다.

## 6. 보존·경로 불변식

1. 각 활성 eventInput i에서 **실제 취득 wholeShare 합=inputWholeShare(i)**. R04 branchBases는 이 합계의 취득자가 아니다. 같은 사건 취득들의 eventRelativeShare 합1.
2. R05 후속 사건의 입력 wholeShare/rootRelativeShare는 참조한 선행 실제 취득값과 동일, 취득자=후속 피상속인. 동일 asset/root이고 source event<target event, 기준일 안. 입력으로 전달액을 덮어쓸 수 없다.
3. 각 실제 취득은 후속 사건에 전량 한 번 소비되거나 미소비 말단이다. 소비된 취득은 allocations 합계에서 제외. history를 합계에 더하지 않는다.
4. 정상 말단 rootRelativeShare 합1, wholeShare 합Q. BLOCKED 말단 배분0+미해결Q=Q. branchBases·auditHistory·consumptions는 최종 합계에서 제외한다.
5. R04 G1/G2 경로에 E1·매개B·가지 참조, B 실제 취득 없음. R05 경로에는 E1 B 실제 취득→E2 input→G1/G2 실제 취득이 연결되고 B를매개인으로 대체하지 않는다.
6. path ID 중복뿐 아니라 `(root asset,source acquisition,event,capacity,recipient,mediator chain)`의 실질 키를 검사한다. capacity/매개를 바꾸어 다른 자격으로 재포장한 경우도 초기지원 밖으로 차단한다. 서로 다른 별칭 person ID가 실제 같은 사람인지 법률적으로 자동 병합하지 않으며 관계 미확인/중복 의심이면 보류한다.
7. 무결성 합계가 맞아도 사람/자격/사건/경로/법령·rule·승인 proof 오류는 독립 실패다. 구조 검사가 일관되게 잘못 지정한 사람을 법적으로 알아내는 것은 아니므로 독립 truth가 별도로 필요하다.

E1→E2의 중간 분수는 검증된 내부 불변 분수로만 전달한다. 내부 연산으로1024자를 넘은 분모를 외부 initialShare 파서로 다시 넣어 거부하거나 반올림하는 방식은 금지한다. 직렬화/structuredClone된 결과 사본은 내부 WeakSet 신뢰 표지를 잃으므로 재입력으로 신뢰하지 않는다. 캐시 복원 시 유효한 원래 입력으로 재계산하며 외부 입력 길이 제한은 늘리지 않는다. 원장 저장값 검증·기약성 검사와 내부 운반 방식을 분리한다.

## 7. BLOCKED·InputError 분류 제안

**전체 BLOCKED/Q 미해결은 이번 설계의 고정 기본 방향**이다. 오류 code·분류는 제안이며 최종 기술 승인 아니다. 부분 가지 계산·PROVISIONAL 말단은 도입하지 않는다. 적법한 과거 사건의 auditHistory를 보관해도 해당 최종 결과는BLOCKED/복사시 차단문만 허용한다.

|원인|M2 권고 분류|현 C1와 차이/보존|
|---|---|---|
|사실 누락/UNKNOWN·집합 불완전·충돌·사망 선후 불명|BLOCKED, 유효Q 전체 미해결|현 C1의 FAMILY_INCOMPLETE/FACT_UNCONFIRMED 등과 같은 의미. 미확인을 없다고 보정 금지|
|법령/규칙/의존/날짜 미승인·미지원|BLOCKED, 원인+필드+event/rule ID|현 C1의 승인/날짜 차단 확장. R05 승인 하나로E2 의존 승인 대체 금지|
|Q 손상·분모0·음수·0/1초과·과도한 정수 문자열|InputError, 결과 객체 없음|fraction.mjs의 실제 코드/field 계약 유지. Q가 무효이면 unresolved를 만들지 않음|
|중복 person/event/relation/path ID, 존재한다고 참조했지만 없는 ID|InputError|C1 DUPLICATE_PERSON·MISSING_RELATIONSHIP_REFERENCE·산술 DUPLICATE_PATH와 일관성 우선. 집합 자체 미확인은 별도BLOCKED|
|다른ID의 동일 유입 이중소비·순환·asset 불일치·생성된 결과 보존/참조 위반|InputError(RESULT_INTEGRITY_ERROR 또는 세부코드)|M2 truth X10의 BLOCKED안과 다른 권고. 유효Q여도 신뢰 불가능한 원장을 억지 unresolved로 만들지 않음. 별도 확정 필요|
|날짜/관계 사실의 해석 충돌|BLOCKED|명백한 자기 참조/파손 구조와 구별. 같은 날짜는 동시사망 확정이 아님|
|Web Crypto 없음/실패·JSON 아닌 의존성|SnapshotError, 게시/복사 없음|HASH_UNAVAILABLE/HASH_FAILED/NON_JSON_DEPENDENCY 유지. 약한 해시나 원격 대체 금지|

InputError는 정상 법률 결과가 아니다. 이전 성공 출력은 오류 전에 이미 무효화돼야 한다. BLOCKED에는 유효Q·사유가 있고 InputError에는 신뢰 가능한 결과 원장이 없다는 차이를 유지한다. 복수 오류는 구조 안전성 우선으로 중단하고 도달하지 않은 게이트는 NOT_RUN으로 표시한다. 게이트가 계산을 막았다고 무결성 검사를 통과했다고 표시하지 않는다.

## 8. STALE·비동기·브라우저 경계

snapshot 의존 JSON은 engine/schema/contract 버전, 전체 사실·관계·deathFacts·사건열/유입 요구·referenceDate·Q/asset, law/rule/truth·승인 레지스트리 및 적용 범위 버전을 포함한다. first await 전에 입력과 승인 컨텍스트를 함께 복제하고 같은 사본으로 해시/계산/검증한다. ID별 의미를 가진 입력 배열도 초기에는 원래 순서를 해시에 포함해 순서 변경을 보수적으로 STALE 처리한다. 정렬 동치 최적화는 후속 미정이다.

auditHistory 역시 자신을 검증한 사실·승인 dependency hash에 묶인다. 입력 변경 후 과거 기록을 보관하더라도 현재 VERIFIED라고 재표시하지 않으며, 새 사본으로 다시 검증하거나 STALE_HISTORY로 분리한다. 보류 시 역사를 보존하는 기능이 이전 성공 결과를 최신으로 게시하는 통로가 되면 안 된다.

현재 canonical은 객체 키 정렬/배열 순서 유지 SHA-256이다. JSON-compatible 값만 허용하며 Node와 Web Crypto 해시를 일치시킨다. M2 snapshot은 별도 schema로 구분해 C1 refresh에 잘못 전달하면 명시적으로 거부한다. 오래된 결과를 새 스키마로 강제 복원하지 않는다. 전체 case STALE를 우선하며 사건별 부분 캐시 재활성화는 후속 설계다. STALE는 사실을 되돌려도 자동 부활하지 않는다.

snapshot 포장 제안은 schemaVersion=m2-snapshot-draft-v1,dependencyHash,inputRevision,approvalContextRevision,result다. STALE로 만든 과거 결과는 과거 입력/승인 hash와 provenance를 유지하며 현재 입력의 계산 결과로 다시 표기하지 않는다. 현재 revision과의 불일치 원인은 별도 staleReasons에 기록한다. 정확한 필드명과 refresh의 반환 형식은 별도 기술 확정 대상이다.

브라우저 세션은 **입력/승인/법령 컨텍스트 변경 즉시** 기존 결과 텍스트를 비우고 선택/복사를 차단한다. 요청마다 requestId,입력 revision,승인-context revision을 캡처하고 완료 시 셋이 현재와 같을 때만 게시한다. 해시 검사를 기다리는 동안 옛 출력은 최신 영역에 남기지 않는다. 늦은 성공/오류/clipboard 완료·취소 후 완료가 현재 상태를 덮어쓰면 안 된다. 필요 시 승인 컨텍스트 fingerprint까지 완료 직전 비교하며 컨텍스트 변경 알림 API와 불변 소유권을 명시해야 한다. 단순 inputRevision만으로는 외부 승인 객체의 변이를 감지할 수 없다.

copy는 최신REVIEW_READY 또는 명시적BLOCKED 차단문만 허용한다. auditHistory를 확정 최종 배분처럼 복사하지 않는다. clipboard 거부는 선택·수동복사 안내로 처리하고 이미 외부에 복사한 내용을 회수한다고 약속하지 않는다. DOM/OCR/네트워크·Mac 절대 경로는 공통 계산 모듈에서 분리한다. 현재 개발용 loopback 성공은 Windows/업무PC 실행 승인과 별개다.

## 9. 미정 선택·승인 전 구현 금지·단계 분리

|미정 항목|우선 제안·장단점|확인 주체|
|---|---|---|
|새 API/스키마 버전/마이그레이션|분리API, 기존C1 그대로. 중복 관리 부담은 있으나 회귀 경계 명확|기술 설계 검토자|
|R04 B의 선사망 시 배우자 확인 모델|E1 가족과 별도 historicalFamilyFacts 또는 시점 assertion 참조. 필수 사실을 줄이거나 자동 추정하지 않음|법률·데이터 검토자|
|필요 사건 closure·미래E2 불완전 사실|미래임이 확실하고 E1에 영향 없으면 배분 게이트에서 제외. 구조/선후/요청 승인 검사까지 제외하지 않음|법률·설계 검토자(Q-09)|
|중복/순환/실질 이중소비 분류|InputError 우선, 기존 X10 BLOCKED 후보와의 차이를 검토 후 고정|기술·법률 검토자|
|자원 한계/이름/경로ID/승인proof 형식|현1024자 제한 유지, 건수/byte 한계와 ID 파생 규약의 수치는 별도 결정|기술 설계자|

구현 단계 후보는 (1) 문서 기술 검토·고정 (2) 독립 법률/truth/새 날짜/의존 승인 및 별도 개발 착수 지시 (3) 별도 브랜치의 순수 구조·게이트·무결성 부품과 회귀 (4) R04와 R05를 분리해 각각 승인 범위만 구현 (5) Node/브라우저 검증 (6) 별도 UI 연결 승인이다. 순서 (3)도 이번에 허용된 코딩이 아니며 일반 DAG 도구를 만들면서 사실상 R04/R05를 구현하지 않는다.

법률 검토자는 R04 매개/가지 한도·B 배우자 확인 시점, R05 실제 취득/유입 한정·사건별 G00/R03·01-20개시 및01-15/21기준일, 미래 사건 제외·전체BLOCKED 및 Q-09를 확인해야 한다. 이 문서가 법률 PENDING이나 개발 착수/설계 확정을 해제하지 않는다. 계산 코드·기존 truth·화면·OCR·배포·PR/merge는 변경하지 않으며 자동 구현을 시작하지 않는다.

## 10. 2026-10-23 기술 권고 보완 — 구현·법률 승인 아님

보완 기준은 `docs/m2-engine-contract` / `1b7d451ca9ba58e77f599cd03a7f7b5b2dc5d238`이다. 재개 시 로컬과 실제 원격 기준 HEAD가 일치하고 작업 트리는 clean이었다. 이미 생성된 `docs/m2-contract-finalization`을 그대로 사용하며 새 문서를 중복 생성하지 않는다. 앞선 요청에서 생성만 했던 안전 기반 브랜치도 삭제하지 않는다. 이번 작업은 이 문서와 시험 설계 보완으로 한정하며 법률 승인·새 truth 승인·개발 착수 상태를 변경하지 않는다.

아래는 앞선 초안의 미정 항목을 구체화한 **기술적 우선 권고**다. 상위 절과 차이가 있으면 아래의 분류/설명을 현재 권고로 읽되, 법률 검토나 계약 전체가 최종 승인됐다고 해석하지 않는다. 기존 C1 API 분리·가정 기준/실제 취득 분리·역사/소비/말단 분리·전체 BLOCKED/Q 보존 방향은 유지한다.

### 10.1 truthReference와 승인 레지스트리의 독립

- truthReference는 추적·시험 참조만 한다. 참조로 사람·법률 모듈·분모·결과를 선택하거나 승인 레코드를 생성하지 않는다. 법률/법령/날짜/의존 바인딩은 항상 별도 검토 레지스트리로 판정한다.
- 일반 가공 요청에서 참조 생략을 허용하는 기술안을 우선한다. 생략해도 같은 모듈·사실·날짜에 대한 법률 승인 요구는 그대로다. 참조가 없다는 이유로 T04/T05를 기본 선택하지 않는다. 이 선택은 일반 사건의 법률 승인 범위를 확대하는 결정이 아니다.
- 형식이 유효한 참조의 ID/버전을 바꾸거나 위조해도 법률 판정은 같아야 한다. 모르는 참조 또는 미승인 시험 참조는 추가 추적 게이트로 BLOCKED할 수 있지만, 이를 생략해 법률 PENDING을 통과할 수는 없다. 참조 형식 파손은 InputError 권고다.
- 일반 입력의 approved/status/approvalOverride/approvalRecord/임의 proof 및 계산 결과·전달 금액은 허용하지 않는다. root뿐 아니라 각 중첩 객체도 허용 필드 목록으로 검사해 InputError(UNSUPPORTED_INPUT_FIELD)로 거부하는 안을 우선한다. 입력의 CONFIRMED review와 법률 승인 status는 서로 다르다.
- 조건부 정답 시험은 문서형 원 후보를 옮긴 **독립 검토용 fixture**를 사용한다. 참조값만으로 기대값을 반환하는 함수나 승인 토글을 만들지 않는다. 현재 레지스트리의 R04/R05 PENDING은 그대로며, 정상 수치 실행에는 별도 범위·truth 승인과 개발 지시가 필요하다.
- 승인 레지스트리 버전/범위는 엔진이 캡처하는 의존성이다. 사용자 입력이 원하는 레지스트리를 선택하거나 대체할 수 없다. 참조 생략/위조의 거부 여부와 별개로 승인 컨텍스트의 법률 상태·해시는 바뀌지 않아야 한다.

### 10.2 단일 오류 분류의 기술 우선안

|원인|우선 분류|출력 및 경계|
|---|---|---|
|미확인 가족·생존·혼인·집합 완전성·사망 선후, 미승인 규칙/법령/날짜/의존|BLOCKED|유효 Q 전체를 한 미해결 묶음으로 보존, allocations/paths 빈 목록. 사람별 법률 지분0으로 표시하지 않음|
|손상 Q·정수 길이 초과·분모0·음수·Q범위 오류|InputError|결과/미해결 원장 없음. C1의 실제 분수 code/field를 보존하며 가짜 Q=0을 만들지 않음|
|중복 ID·명시적 참조의 대상 부재·자기/구조 순환·동일 실질 유입의 이중 소비|InputError|거짓 원장을 복구·중복 삭제·임의 합산하지 않음. 법률 미확인과 달리 구조적 입력 오류로 구분|
|미지원 필드·schema 버전 불일치·중복 JSON 키·초기 자원 한계 초과|InputError|법률 배분 게이트 전에 거부. 기존 C1의 일부 추가 필드 BLOCKED와 다른 **M2 전용** 기술안이며 C1은 바꾸지 않음|
|새 날짜·다른 law/rule 버전이 형식상 유효하지만 승인 바인딩 없음|BLOCKED|문법 오류와 승인 범위 부재를 구분. 입력 형식 파손은 InputError|

M2-X10의 원 문서는 전체 BLOCKED 후보와 ERROR 대안을 열어 두었다. 여기서는 무결성 오류를 InputError로 구분하는 기술안을 우선하며, 원 truth 문서의 수치·법률 상태를 수정하지 않는다. 향후 이 기술안을 확정한 시험은 정확한 InputError code/field 하나를 기대해야 한다. BLOCKED/ERROR 중 아무거나 허용하는 assertion을 금지한다. 기존 C1의 DUPLICATE_PERSON·명시 참조 오류·산술 DUPLICATE_PATH와의 일관성이 근거이며, 법률 승인으로 주장하지 않는다.

사실 미확인과 깨진 참조의 판별 예:

- F1 레코드는 존재하나 가족 집합의 review/complete/member 목록이 없거나 UNKNOWN이면 FACTS_INCOMPLETE 등으로 BLOCKED한다. 검토가 미완료된 관계 레코드도 존재한다면 그 사실을 임의 확정하지 않는다.
- members가 명시적으로 AB를 참조하지만 relations에 AB가 없거나, 이벤트가 존재하지 않는 sourceEventId를 참조하면 BROKEN_REFERENCE 계열 InputError다. 잘못된 식별자를 미상 사실로 바꾸지 않는다.
- §3 입력 골격은 eventFacts=[]인데 factsRef=F1/F2가 명시돼 있다. 초기 초안의 FACTS_INCOMPLETE 설명을 구체화하면 **이 정확한 골격은 BROKEN_REFERENCE InputError 대상**이라는 기술 권고다. 이를 실행 가능한 완전 fixture로 분류하지 않는다. 사실 미완료 BLOCKED 시험은 실제 F1/F2 레코드를 둔 채 확인 상태/내용만 미완료로 만들어 따로 작성해야 한다.
- 속성 형식이 틀린 ID/참조와, 정확한 날짜를 알지 못하는 YEAR/UNKNOWN 사실을 구별한다. 확정 DAY 날짜의 불가능한 날짜 문자열은 InputError, 선후 증거 부족은 BLOCKED를 우선한다.

### 10.3 미래 E2의 필요 사실 범위

NOT_YET_OPENED는 승인 후 사용할 **후보 처리 상태**다. 현재 이를 정상 수치 출력 허가로 사용하지 않는다. 다음 조건이 모두 확인된 경우에만 미래 사건 분류 후보로 둘 수 있다.

1. 실제 사망일 E1과 E2 및 결과 기준일이 DAY 정밀도·CONFIRMED이고, 정확히 E1≤기준일<E2임이 확인된다. 같은 날짜·겹친 범위·신고일·실종 추정·선후 UNKNOWN은 미래로 보완하지 않는다.
2. 사건/물건/인물/상위 유입 요구의 참조가 일관되고 순환이 없다. 미래라는 이유로 파손 구조까지 무시하지 않는다.
3. E1의 상속인·관계·생존·부정 사실·완전성과 기준일까지의 관련 변동이 확인돼 있고, 미래 E2의 미확인 가족 내용이 E1의 분모·자격·관계 효력·유입 원인에 영향을 주지 않는다. 공유 관계 기록에 충돌이 있거나 미확인 사실이 E1에도 필요한 경우 전체 BLOCKED다.
4. R05 요청 조정·E1의 법률/날짜/의존 규칙·새 기준일 및 미래 제외 정책 자체가 별도 승인돼 있어야 한다. 현 C1의01-11 기준일 승인을01-15/21로 확장하지 않는다. R05와 E2용 G00/R03·01-20 개시/01-21 기준 바인딩도 계속 PENDING이다.

따라서 미래 E2에만 필요한 배우자/자녀 집합의 미확인은 승인 후 E1 시점 결과와 분리할 수 있다는 제안이다. E2의 실제 배분·전달·취득·검토 완료를 생성하지 않는다. 정확한 미래 판정이나 영향 독립성을 증명하지 못하면 Q 전체 BLOCKED다. 필수 사실 closure와 제외 정책의 법률·설계 검토는 여전히 남아 있다.

### 10.4 초기 자원 상한 후보와 입력 경계

아래 수치는 작은 가공 사례 개발을 위한 **방어적 초기 후보**이며 측정된 처리 능력·지원 인원·업무 성능·법률 범위가 아니다. 미래 구현 전에 기술 검토로 고정하고 실제 측정 결과에 따라 이유/버전을 남겨 조정한다. 상한 안에 있다는 사실은 입력의 법률상 지원이나 승인 판정을 대신하지 않는다.

|대상|초기 후보|근거·단위|
|---|---|---|
|원시 입력 JSON|1,048,576 UTF-8 bytes(1MiB)|다섯 가공 인물·두 사건보다 충분한 여유를 두면서 무제한 파일 로딩을 방지. PDF/OCR/원자료 본문은 이 API 입력이 아님|
|인물|256개|최소 가공 사례보다 큰 구조 검토 여유. 법률 지원을256명으로 승인한다는 뜻 아님|
|관계|512개|인물당 소수 관계를 표현할 구조 여유, 조밀한 임의 그래프를 무제한 허용하지 않음|
|사건|32개|거부/순환/참조 검사에 필요한 기술 상한. R04 한 사건·R05 두 사건이라는 법률 후보 제한은 별도이며32사건 배분 지원 아님|
|deathFacts/eventFacts/historicalFamilyFacts|각256/32/256개|관련 인물/사건 상한과 연결. 중복/충돌을 허용하는 근거 아님|
|전체 JSON 값 노드·최대 중첩|20,000개·32단계|작은 입력에도 생길 수 있는 과도한 구조/재귀 방어. 노드는 root를 포함한 객체/배열/각 스칼라 값을 각각1개로 셈|
|일반 문자열|UTF-8 4,096bytes|식별자 외 설명 필드의 보수적 상한. 허용되지 않은 새 필드를 자동 허용하지 않음|
|사용자 식별자|기존1~100 ASCII 문자|C1의 인물/사건/관계 ID 경계 우선 유지. 파생 path는 별도 규약|
|외부 분수의 각 정수 문자열|현재1024자 이하|C1 검사 그대로 유지. 음수 부호도 현 길이 검사에 포함. 계산 내부의 긴 불변 분수와 구분|

모든 한계를 동시에 적용한다. 첫 초과는 InputError(INPUT_LIMIT_EXCEEDED, 해당 field)를 우선 제안하며 부분 파싱 결과나 Q를 정상 결과로 내지 않는다. 일반 문자열 제한으로1024자 분수 제한을 대체/완화하지 않는다. 상한±1·정확한 한계의 기계 검사는 향후 시험이며 이번 수치에 대해 성능/메모리 측정을 했다고 보고하지 않는다.

파일/문자열 입력 경계는 UTF-8 크기 제한을 먼저 검사하고, JSON 객체별 **중복 키를 덮어쓰기 전에** 검출한 뒤 허용 스키마를 검사하는 strict parser를 권고한다. 중복은 중첩 객체에서도 InputError(DUPLICATE_JSON_KEY), 잘못된 JSON/UTF-8은 명시적 입력 오류다. 기본 JSON.parse만 호출한 뒤에는 소실된 중복을 알아낼 수 없다.

이미 파싱된 객체 API에서는 원래 텍스트의 중복 키 부재를 보증하지 않는다. 일반 객체/배열/JSON 스칼라만 허용하고 자체 객체 순환·접근자·비JSON 값은 입력 오류로 거부하는 안을 우선한다. 파일 import는 strict 경계를 통과하도록 하고, 사용자가 duplicateKeysChecked=true 같은 표지를 넣어 검증을 생략하게 하지 않는다. 원시 parser/객체 API의 최종 이름과 검증 출처 메타데이터는 기술 확정 대기다. 미지원 schema는 자동 migration하지 않는다.

### 10.5 아직 바뀌지 않은 승인 경계

이번에 정리한 것은 기술 권고와 오류/시험의 구체적 비교 기준이다. 별도 M2 API·스키마 버전명은 초안 그대로 제안 상태이며, 자원 상한·strict parser·오류 code/field·미래 사건 closure의 최종 기술 확정은 남아 있다. R04/R05 법률·새 truth·날짜/법령/의존 승인과 개발 착수는 변경하지 않는다. 정상 수치·원장 전달·부분 가지·M2 snapshot/브라우저 코딩을 이번 문서 작업으로 시작하지 않는다.
