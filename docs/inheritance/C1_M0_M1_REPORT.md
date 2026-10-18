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
