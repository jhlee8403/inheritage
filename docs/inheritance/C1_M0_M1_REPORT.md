# C1 M0+M1 구현·검증 기록

실행일: 2026-10-18 (Asia/Seoul). 저장소 `jhlee8403/inheritage`, 구현 브랜치 `feat/inheritance-engine-m0-m1`.

## 승인과 변경 경계

사용자는 여섯 규칙 BL1-G00/R01/R02/R03/R06/R07, 열한 truth v1 및 기존 적용 조건·법령 스냅샷·제외 조건·BLOCKED/Q/분수/미해결 계약의 C1 구현을 명시적으로 승인했다. 먼저 `docs/legal-baseline-v1`에서 `LEGAL_APPROVAL_M0_M1.md`에 APPROVED_FOR_C1, 승인자 사용자, 승인일 2026-10-18과 남은 제한을 기록해 별도 커밋했다. 승인 기록 커밋은 `eaed69d533edc904aff8623416d875d0738e1fbd`이다. 이후 구현 브랜치를 생성했다.

기준선 문서와 승인 truth의 수치·사람·경로는 바꾸지 않았다. 단계 A의 과거 PENDING 표기를 일괄 해제하지 않았다. R04/R05와 다른 미승인 쟁점은 계속 PENDING이다. 실제 사건·개인정보를 쓰지 않았다. OCR 코드·main은 변경하지 않았고 PR·merge는 수행하지 않았다.

## 구현 구조·환경

`packages/inheritance-engine/`에 독립 Node.js ESM 패키지를 추가했다. JavaScript, Node.js **24.22.0**, 외부 의존성 **0개**다. BigInt 정수로 분수를 계산하고 JSON 경계에서는 분자/분모 십진 문자열을 사용한다. 표준 `node:test`, `node:assert/strict`, `node:crypto`를 사용했다. 설치·모델 다운로드 없이 시험했다.

`fraction` / `approval` / `engine` / `arithmetic` / `validation` / `snapshot` 모듈과 공개 `index`로 분리했다. 법률 엔진은 2017-01-10 개시, 2017-01-11 기준일, BL1-LAW-2016-14409 및 승인된 관계 조건으로 제한한다. 순수 산술 T07은 별도 API이며 대습·연속 사건을 만들지 않는다.

상대 지분/물건 전체분, 직접 취득 경로, 비선택 사유, rule ID/version, law snapshot, truth/version, event ID, 차단 사유를 결과에 남긴다. 합계 보존과 사람/경로 무결성은 별도 검증한다. 입력·관계·Q·법령·승인 컨텍스트 변경은 스냅샷 해시로 감지해 STALE로 만들 수 있다.

## 실행한 시험

명령(저장소 루트):

```sh
node --test packages/inheritance-engine/test/*.test.mjs
```

실행 파일: `/Users/leejeonghyeon/.local/bin/node` (v24.22.0). **33개 통과 / 0개 실패 / 0개 건너뜀**. 필수 truth 11개와 추가 경계 테스트 22개다. 표의 분수는 구현 결과에서 새로 정한 값이 아니라 승인 문서의 고정 기대값이다.

|truth|상태·핵심 기대|시험 결과|
|---|---|---|
|BL1-T01|REVIEW_READY, W3/7·C1/C2 각2/7, 직접 경로·R01|PASS|
|BL1-T02-A|REVIEW_READY, W3/7·F/M 각2/7, G비선택·R02|PASS|
|BL1-T02-B|REVIEW_READY, W3/5·M2/5, F선사망·G비선택·R02|PASS|
|BL1-T03|REVIEW_READY, C1/C2/C3 각1/3, G비선택·R03|PASS|
|BL1-T06-A|REVIEW_READY, 상대3/7·2/7·2/7 유지, 전체1/7·2/21·2/21, 합Q=1/3|PASS|
|BL1-T06-B|REVIEW_READY, 상대각1/3, 전체각2/15, 합Q=2/5|PASS|
|BL1-T07|ARITHMETIC_ONLY, X경로각1/15·합2/15, Y4/15, 큰 정수/약분/오류/중복|PASS|
|BL1-T08|BLOCKED: SPOUSE_UNKNOWN, 취득 경로 없음, 미해결1/3|PASS|
|BL1-T09|BLOCKED: 날짜·선후·B생존 상태 미확정, 취득 경로 없음, 미해결1/3|PASS|
|BL1-T10|BLOCKED: 미지원 쟁점 변형, 취득 경로 없음, 미해결1/3|PASS|
|BL1-T11|BLOCKED: RULE_PENDING(R01), R01시도만 기록, 미해결1/1|PASS|

정상 사례에서는 취득자 ID, 상대분/전체분, path ID·사건·출발/도착, 규칙·버전·법령·truth, 비선택자, REVIEW_READY, 전체 경고, 미해결 빈 목록을 고정 기대값과 비교했다. 차단 사례에서는 빈 취득자/경로, 정확한 reason, 경고, provenance, Q 전체 미해결과 보존식을 비교했다. T07은 사람·경로·분수·계약 ID·truth version·ARITHMETIC_ONLY·경고·차단/미해결 빈 목록을 비교하되 법률 적용을 주장하지 않아 law/event ID를 null로 남겼다.

추가 22개 테스트에서 집합 완전성, 누락/UNKNOWN, 관계 미검토, 모든 제외 플래그, 선사망 자녀·다중 사건·추가 법률 필드 차단, 날짜·법령·규칙·truth 버전, R04/R05 PENDING, 미성년/입양/배우자 단독/조부모만의 사례, Q/분수 오류, 중복/참조/모순 입력, 복수 배우자·부모, 큰 정수, 합계와 경로 결함의 분리, 독립 truth 수령자 비교, STALE와 입력 복제·동결을 검증했다.

## BLOCKED·STALE 검증 해석

UNKNOWN은 ABSENT_CONFIRMED로 변환되지 않았다. 사실 집합 완전성이 없거나 지원 범위 밖이면 다른 사람에게 재분배하지 않고 Q를 한 번만 미해결에 기장했다. 정상 합계만으로 사람·경로 정답을 인정하지 않았다. 잘못된 수령자를 일관되게 바꾸면 구조 검사는 통과할 수 있어도 독립 truth 비교는 실패함을 시험했다.

사실·관계·법령·Q·기준일·revision·규칙/승인/truth 버전이 바뀌면 기존 스냅샷을 STALE로 만들 수 있다. 호출자가 refreshSnapshot을 호출하는 API이며 UI 변경 이벤트와 자동 연결한 상태는 아니다.

## 남은 제한

가공 사실·법정 지분 기초계산에 한정한다. 입력된 확인 사실의 진실성이나 관계의 법적 효력을 엔진이 스스로 판정하지 않는다. 사용자 승인을 외부 법률 전문가 서명·독립 검산자 서명으로 표시하지 않는다. 실제 사건·업무 PC·브라우저 UI 통합 검증·배포는 미실시다.

R04 대습, R05 연속상속, 포기·배우자/형제자매 대습·재대습·동시사망·복수 자격·상실·구법/구관습·특수 친족관계는 미구현/PENDING이다. 같은 날짜의 다른 복잡 사건도 차단한다. 기본 BigInt 산술은 임의 정밀도이나 입력 정수 문자열은 각1,024자로 제한한다. 별도 승인 없이 범위를 확장하지 않는다.

## 2026-10-20 — 세 기술 결함 수정과 회귀·브라우저 재검증

기준은 원격 보존된 `fe9d11869c347062a641cb52bf6f463c8ed7bcd7`이며, 기존 `feat/inheritance-engine-m0-m1`에서 작업했다. 시작 시 working tree clean과 기존 33개 테스트의 33 PASS / 0 FAIL / 0 SKIP을 확인했다. 위 2026-10-18 기록은 최초 구현의 역사로 보존한다.

사용자는 세 결함 수정·회귀 테스트·최소 브라우저 하네스만 승인했다. 이번에 법률 승인 문서·날짜·범위·기존 정답 수치를 바꾸지 않았다. R04/R05 등 미승인 규칙, OCR/B1 결과, main, 실제 사건자료·개인정보는 변경/사용하지 않았다. 제품 UI 연결·PR·merge는 없다.

### 수정 전 재현과 수정 후 결과

|결함|수정 전 실제 확인|수정 및 결과|
|---|---|---|
|집합/관계 참조|children 누락·null·members 누락/null에서는 `MISSING_RELATIONSHIP_REFERENCE`, members 객체에서는 raw TypeError. parents 누락 및 집합 미검토 상태의 참조도 잘못 진행됨을 회귀로 확인|먼저 집합 모양·검토·완전성과 사람 검토 상태를 점검한 뒤, 참조 가능한 집합에 대해서만 viaId 조회. 불완전 집합은 BLOCKED·빈 allocations/paths·미해결 Q. 유효/완전 집합의 잘못된 viaId·중복/모순/Q 오류는 기존 InputError 유지. 예외 일괄 catch 없음|
|공개 브라우저 진입점|기존 공개 export 그래프 검사에서 `node:crypto` 의존 때문에 실패|브라우저 공개 `src/browser.mjs`와 Node 동기 어댑터 분리. 실제 Chromium에서 공개 모듈 import·calculate·비동기 snapshot·STALE 성공|
|내부 분수 길이|입력 분모 `8` 뒤 0을1023개 붙인 유효 Q가 배분 후1025자리 분모를 만들면 합계 검증에서 `INVALID_INTEGER_STRING`|외부 1024자리 파싱과 내부 연산 구분. 내부에서 검증·생성한 동결 분수만 비공개 WeakSet으로 식별. 긴 결과의 합계·경로·동등성·JSON 문자열 출력·스냅샷 성공. 외부1025자리·긴 객체 사본·긴 결과를 외부 Q로 재입력하는 우회는 거부|

수정 전에 집합 관련7개, 공개 그래프1개, 1024자리 Q1개 테스트가 각 원인으로 실패하는 것을 확인했다. 1023자리와 외부1025자리 거부 검사는 원래부터 통과했다. 회귀 작성 중 파일 URL 경로 처리 오류는 시험 자체를 수정한 뒤 공개 그래프를 다시 단독 실행하여 실제 `node:crypto` 원인 실패를 확인했다. 실제 브라우저 하네스의 최초 서버 경로 오류도 수정했으며, 그 오류를 엔진 결함 재현이나 브라우저 통과로 집계하지 않았다.

긴 수치의 고정 기대는 독립 수식 `D=8×10^k`, 배우자 `3/(56×10^k)`, 각 자녀 `1/(28×10^k)`를 십진 문자열로 직접 작성했다. 엔진 함수로 기대값을 만들지 않았다. 1023/1024/1025자리 경계, 큰 공약수 기약화, 분모0·음수·형식·Q 범위와 브랜드 위조 거부를 검증했다.

### 실제 시험 명령과 결과

Node.js **24.22.0**:

```sh
npm test --prefix packages/inheritance-engine
```

**57 PASS / 0 FAIL / 0 SKIP**, 종료0. 기존33개(필수truth11+경계22)를 유지하고 새24개(결함12+검토 변형7+Web Crypto/스냅샷5)를 추가했다. 기존 truth 테스트는 엔진 버전 메타데이터0.2.0과 T11 격리 확인을 갱신/강화했으며, 법률 정답·분수·사람·경로는 변경하지 않았다. 실패 테스트 삭제·skip은 없다.

검토 때만 실행했던12건 중 자녀1/4명·배우자 부존재의 유일 자녀, 부모1명과 부모 배열 역순, 정상ID/사건/관계 참조 변경, 자녀 순서, 실제 인물·관계 변경 STALE를7개 새 시험으로 묶었다. 중복 거부는 기존 시험을 재사용하고, 입력 approved 플래그 거부와 T11 이후 기본 승인·정상 계산 유지 확인은 기존 시험에 추가했다.

실제 브라우저:

```sh
npm run test:browser --prefix packages/inheritance-engine
```

기존 개발 도구 **Playwright 1.64.1**, 설치된 **Chromium 156.0.8078.4**를 보안 옵션 완화 없이 sandbox 활성 상태로 실행했다. 임시 포트의 `http://127.0.0.1`에서 공개 브라우저 진입점을 import하고 **20 PASS / 0 FAIL / 0 SKIP**, 종료0을 확인했다. 제품 UI는 만들지 않았다.

20개 검사는 공개API1, 필수truth11, 불완전 집합1, InputError 계약1, 긴Q1, Node/브라우저해시1, 변경/STALE1, async생성1, async갱신1, 해시불가/실패1로 구성된다. 법률 truth에서는 상태·사람·상대분/전체분·경로·규칙·법령/truth 버전·미해결·경고를 비교했다. 순수 산술 T07의 law/event null 계약도 유지한다.

브라우저 console error **0**, page error **0**, 미처리 Promise 거절 **0**, 외부 네트워크 요청 **0**, 모듈 로딩 후 엔진 검증 중 네트워크 요청 **0**이다. 표준 경로 `/Applications`, `~/Applications` 및 Spotlight 번들 검색에서 Microsoft Edge를 찾지 못했다. **Edge 미실시(미설치), Edge 버전 미확인**이다. 임의 설치하지 않았다. Node/Chromium 성공을 Edge·실제 오프라인 업무 PC 성공으로 표시하지 않는다.

### 스냅샷·API·호환 영향

엔진/패키지 버전은 **0.1.0 → 0.2.0**. 법률 승인 ID·rule/truth v1·날짜는 그대로다. Node 기본 진입점의 `createSnapshot`/`refreshSnapshot`은 동기 반환을 유지한다. 브라우저는 공개 subpath `/browser` 또는 `src/browser.mjs`의 `createSnapshotAsync`/`refreshSnapshotAsync`를 await한다. calculate는 양쪽 모두 동기다.

Node `node:crypto`와 브라우저 Web Crypto는 같은 결정적 JSON 직렬화와 SHA-256을 사용한다. 정상6+차단4의 동일한10개 입력·승인·엔진 버전에 대해 dependencyHash가 일치했다. T07은 법률 스냅샷 사례로 꾸며 넣지 않았다. 복제는 첫 await 전에 이루어지며, async 생성/갱신 중 호출자가 입력이나 승인 객체를 변경/되돌려도 해시와 결과는 같은 사본에 대응한다. 동결된 결과, STALE 경고, 원상 복구만으로 STALE 부활 금지를 검증했다. 해시 미지원/실패는 HASH_UNAVAILABLE/HASH_FAILED로 명시적으로 거부했다.

버전도 해시에 포함되므로 기존0.1.0 스냅샷을0.2.0에서 refresh하면 STALE이다. 내부 긴 분수의 JSON 출력은 정확하지만 JSON/structuredClone 사본을 자동으로 신뢰된 내부 값으로 복원하는 API는 없다. 긴 출력 사본을 외부 Q로 통과시키지 않으며, 재계산은 원래의 유효 입력에서 시작한다. 외부 입력 제한을 늘리거나 임의 객체를 내부 값으로 신뢰하지 않았다.

### 남은 조건

Edge 자체와 실제 오프라인 업무 PC는 미검증이다. 기본 계산 화면 연결 전에는 대상 Edge에서 동일 공개API 하네스를 실행하고, 동기 calculate/비동기 snapshot 경계, 입력 변경 시 refresh 호출, STALE 출력 차단, InputError와 BLOCKED 표시, 유효 입력 기반 재계산을 연결 계약으로 확인해야 한다. 이는 이번에 UI를 구현하거나 법률 범위를 확대했다는 뜻이 아니다. file://·업무 실행기·실제 사건 적용은 미실시다.

수정 코드·회귀/브라우저 테스트 커밋: `29921483cee1e60e55d302056456288ec301618c`. 원격 반영 여부는 실제 push/원격 조회 결과로 별도 보고한다.


## 2026-10-20 — 수동 계산 화면 착수 전 Mac Edge 점검

사용자는 실제 Mac Edge의 기존 엔진 검증 통과를 수동 계산 검증 화면 구현의 선행 조건으로 지정했다. 이번 요청에서 표준 앱 경로(`/Applications`, `~/Applications`), `/System/Applications`를 포함한 앱 폴더 추가 탐색 및 Spotlight의 `com.microsoft.edgemac`/접두사 검색을 수행했으나 Edge 앱/실행 파일을 찾지 못했다. Spotlight 명령은 출력 없이 종료0이었다.

**실제 Edge 실행·버전 조회·엔진 시험은 미실시**다. 실행 중 오류를 관측한 것이 아니라 실행 대상을 확보하지 못한 상태이며, 다른 브라우저 결과로 통과를 대신하지 않는다. Edge 설치나 보안 옵션 변경은 하지 않았다. 사용자가 설치하거나 기존 비표준 경로를 제공한 뒤 기존 하네스로 실제 Edge 검증이 필요하다. 조건 미충족으로 화면 구현은 보류했다. 이번 착수 전 확인의 상세 결과는 `MANUAL_CALCULATOR_REPORT.md`에 기록했다. 이전 Chromium 시험·과거 Edge 미실시 기록을 소급 수정하지 않는다.
