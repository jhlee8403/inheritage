# 가공 사례 수동 계산 검증 화면

M0+M1의 독립된 개발 검증 화면이다. 실제 사건·개인정보를 입력하지 않는다. 개시일 **2017-01-10**, 기준일 **2017-01-11**, **BL1-LAW-2016-14409**로 고정하며, 법률 승인·truth는 변경하지 않았다. OCR과 분리되어 있고 R04/R05를 구현하지 않는다.

## Mac에서 직접 열기

현재 저장소의 터미널에서 다음을 실행한다. 기존 Node.js 24 이상을 사용하며 npm install이나 빌드는 필요 없다.

```sh
PATH="$HOME/.local/bin:$PATH" node experiments/inheritance-calculator/scripts/server.mjs
```

Microsoft Edge 주소창에서 다음 주소를 연다.

<http://127.0.0.1:4174/experiments/inheritance-calculator/index.html>

서버는 127.0.0.1에만 바인딩한다. 터미널을 유지하고 종료할 때 Ctrl+C를 누른다. 포트 충돌 시 기존 프로세스를 임의 종료하지 말고 그 서버의 실행 터미널을 확인한다. HTML 파일을 직접 더블 클릭하는 file:// 실행은 검증하지 않았다.

1. 배우자+자녀, 배우자+부모, 자녀 균분 중 가공 표본을 불러온다.
2. 가족 구성·가공 인물 ID·생존/확인/집합 완전성 상태와 Q의 정수 분자·분모를 편집한다.
3. 아래의 **현재 입력 계산**을 누른다. `REVIEW_READY`는 가공 검토 결과이며 실제 권리 확정이 아니다.
4. `BLOCKED`는 사유·전제·미해결 Q를 표시한다. 배분 목록이 비었다고 각 사람의 법률상 지분 0을 뜻하지 않는다. 손상된 Q 등은 `ERROR`로 표시된다.
5. **최신 결과 복사** 또는 **결과 텍스트 선택**을 사용한다. 자동 복사가 제한되면 선택 후 ⌘C로 복사한다.

표본의 확인 상태는 가공 fixture의 일부다. 새 수동 입력은 UNKNOWN·빈 Q에서 시작하며 새 사람도 빈 ID·UNKNOWN 상태다. 인물 추가·삭제 후 해당 집합 완전성을 다시 명시적으로 확인해야 한다. 부모·자녀가 없다는 확인은 빈 목록으로 자동 추정하지 않는다. 미지원 쟁점 확인 항목은 접힌 영역에서 개별 변경할 수 있다. 임의의 관계·개시일·입양 등으로 지원 범위를 확장하는 화면이 아니다.

입력 변경은 결과 텍스트와 복사 권한을 즉시 제거한다. STALE·계산 중·취소·오류 상태의 결과는 복사할 수 없다. 비동기 요청 번호와 revision이 일치하는 최신 완료만 표시한다. BLOCKED 텍스트는 차단 결과임을 명시한 상태로 복사할 수 있다. 이미 외부에 복사한 클립보드를 삭제하거나 회수하지 않는다.

## 구조와 실행 경계

- `app.mjs`, `index.html`, `style.css`: DOM 입력·결과·복사. 사용자 문자열은 value/textContent로만 표시한다.
- `fixtures.mjs`: 완전 가공 입력만 작성한다. 기대 지분이나 계산 결과 표를 보관하지 않는다.
- `engine-adapter.mjs`: 기존 `packages/inheritance-engine/src/browser.mjs` 공개 API import. 계산식 복제 없음.
- `session.mjs`: 즉시 무효화, 비동기 요청/revision, 스냅샷·오류·취소 처리.
- `scripts/server.mjs`: Node 표준 모듈만 사용하는 개발용 정적 서버. 브라우저 공통 코드에 Mac 절대 경로나 Node 의존성을 넣지 않는다.
- `test/browser.mjs`: 기존 설치된 Playwright 개발 도구를 재사용한다. OCR 소스는 변경하지 않는다. 엔진 런타임 의존성이나 새 프레임워크는 추가하지 않았다.

이 서버는 Windows용 실행기가 아니다. 최종 Windows 오프라인 배포의 독립 실행·개발 도구 불필요·자원 동봉 목표와 미정 정책은 기존 DECISIONS/ENVIRONMENT_PLAN을 따른다. Windows 버전·CPU·메모리·Edge 정책·실행기/loopback 허용·설치 방식은 미정이다.

## 실제 화면 자동시험

```sh
PATH="$HOME/.local/bin:$PATH" npm test --prefix experiments/inheritance-calculator
```

설치된 Chromium 및 Mac Edge를 headless, sandbox 활성 상태로 실제 실행한다. 패키지·브라우저를 설치하지 않는다. 시험용 임시 loopback 서버와 브라우저는 finally에서 닫는다. 다른 경로의 Edge는 `INHERITAGE_EDGE_EXECUTABLE`, 다른 기존 Playwright는 `INHERITAGE_PLAYWRIGHT_MODULE`로 명시할 수 있다. 브라우저·화면의 버전/통과/실패/skip/진단을 JSON으로 출력한다. 최신 실제 결과는 MANUAL_CALCULATOR_REPORT를 참조한다.

정상 결과는 독립된 고정 기대값과 사람·상대분·전체분·경로·규칙을 비교한다. 비동기 경쟁은 시험 초기화 코드가 **실제 Web Crypto 해시 완료만 보류**하여 순서를 제어한다. 엔진 계산 결과를 대체하지 않고 제품 코드에 지연용 hook을 넣지 않는다. 실제 클립보드 쓰기/읽기는 가공 결과만 대상으로 하며, 거부·지연 시험에서는 clipboard API만 주입한다. DOM/입력/버튼과 상태 전이를 실제 브라우저에서 확인한다.
