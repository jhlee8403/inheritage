# 단계 B — B0 개발 환경 점검 결과

작성일: 2026-10-18 (Asia/Seoul). 결과: **B0 FAIL — B1 미착수**.

이번 사용자 지시는 단계 A 이후의 새 승인으로, B0와 B0 통과 시의 B1 기술 검증만 허용한다. 이번 결과는 법률 규칙·정답 후보 승인, 전체 제품 구현, 업무 PC 설치·배포 승인이 아니다. 법률 관련 상태는 모두 **PENDING 유지**다. 단계 A의 전달문·결정 문서·RUN_LOG 등 과거 기록은 수정하지 않았다.

## 1. 기준과 문서 확인

| 항목 | 확인 결과 |
|---|---|
| 대상 | `jhlee8403/inheritage` |
| 기준 브랜치 | `docs/inheritance-design` |
| 사용자 지정 기준 커밋 | `8776506daf2da153feb64084b420bc6ae84fee39` |
| 원격 기준 확인 | GitHub 연결 도구로 branches와 불변 커밋 트리를 재조회; 기준 브랜치가 지정 커밋을 가리킴 |
| 전달문 | `docs/CODEX_HANDOFF.md` v0.3, blob `e3ceea5d60ef4ec0347d79ac0e47b0269179a683` |
| 읽은 문서 | CODEX_HANDOFF, DECISIONS, ENVIRONMENT_PLAN, OCR_EVALUATION_PLAN, TEST_PLAN, RUN_LOG 전체를 지정 커밋에서 재조회 |
| 기존 규칙·파일 | 기준 트리에 전달문과 단계 A 문서10개 존재; AGENTS.md·README·별도 기여 규칙 없음 |
| 권장 실행 설정 | GPT-6.1 Sol / High (`high`) — 이번 사용자 권장값 |
| 실제 실행 설정 | **실제 모델 미확인 / 실제 추론 강도 미확인**. 자연어 지시로 변경했다고 주장하지 않으며 설정 변경 없음 |

연결 도구의 원격 읽기·쓰기와 터미널 Git·실행 환경 검증은 별개로 판정했다. 원격 문서 접근 성공으로 B0를 통과시키지 않았다.

## 2. B0 실제 개발 환경

| 점검 항목 | 실제 관찰 | 판정 |
|---|---|---|
| 관리형 환경 상태 | running / connected, observations_current=true; network restricted / enforced; failure=null | 제어 상태 조회 성공. 터미널 외부 접속 성공의 증거는 아님 |
| OS·아키텍처 | Linux 6.18.55, x86_64; Chromium 빌드는 Debian GNU/Linux13(trixie) 표기 | 확인 |
| 현재 작업 경로 | `/workspace`; `git rev-parse`는 대상 Git 저장소가 아니라는 오류 | 대상 체크아웃 아님 |
| 기존 Git 작업 사본 | `/workspace/demo`, origin `https://github.com/jhlee8403/demo.git`, branch `work`, HEAD `6b46de12a638aad66ec1336e631cf51268361598`, status 빈 출력 | 다른 저장소. 수정하지 않음 |
| 기존 임시 문서 폴더 | `/workspace/work/inheritage` 존재, `.git` 없음; `git rev-parse` 실패 | 정상 Git 체크아웃 아님 |
| 추가 작업 사본 탐색 | `/workspace`에서 `.git` 탐색: demo와 유효하지 않은 `/workspace/.git`만 발견 | 대상 작업 사본 미확보 |
| 새 대상 clone | `/workspace/work/inheritage-b0`로 기준 브랜치 clone 시도, exit128; 실패 후 폴더 없음 | **FAIL** |
| 대상 현재 브랜치·HEAD·변경 상태 | 유효한 대상 로컬 체크아웃이 없어 확인 불가 | 원격 브랜치·해시로 대신 보고하지 않음 |
| 쓰기 가능한 프로젝트 작업 경로 | `/workspace/work`에서 임시 파일 생성·읽기·삭제 성공; 기존 문서 작업 폴더도 쓰기 가능 | 확인. Git 상태와 무관 |
| 실행 도구 | Git2.52.0, Node24.19.0, npm11.9.0, Python3.12.14, curl 존재 | 버전/존재 확인; 설치·빌드 성공은 아님 |
| 브라우저 | `/usr/bin/chromium`, `Chromium 154.0.8037.57 built on Debian GNU/Linux 13 (trixie)` | `--version` 실행만. 앱 구동 시험 미실시 |
| 실제 Edge | microsoft-edge 실행 파일 미발견; 업무 PC 접근 없음 | 미확보·미검증 |
| 자동화·가공 PDF 도구 | Node Playwright 해석 가능; Python playwright/PIL/reportlab/pypdf 모듈 발견 | 발견만. 브라우저 자동화·표본 생성 실행 없음 |
| 패키지·모델 다운로드 경로 | 허용 호스트의 HEAD 요청도 상속 프록시 연결에서 실패 | **FAIL** |

**B0 판정:** 대상 Git 작업 사본과 승인된 터미널 다운로드 경로를 확보하지 못했으므로 FAIL이다. 이미 설치된 패키지·브라우저가 존재해도 사용자 지시의 B0 조건을 충족하지 않는다. B1용 `spike/offline-ocr` 브랜치·실험 코드·표본은 만들지 않았다.

## 3. 실패 명령과 네트워크 관찰

`/etc/codex/network-policy.json` version1을 읽었다. HTTP 정책은 restricted이고 github.com, raw.githubusercontent.com, registry.npmjs.org 등이 egress_rules에 포함되어 있다. vpn_configured=false다. HTTP_PROXY/HTTPS_PROXY 및 소문자 변수의 호스트·포트는 `proxy:8080`이며 URL에 자격증명은 없었다. 변수 전체나 인증정보를 출력하지 않았다. 프록시·TLS·인증·라우팅·정책은 변경하지 않았다.

| 실제 명령 | 종료·오류 | 의미 |
|---|---|---|
| `git -C /workspace rev-parse --show-toplevel` | fatal: not a git repository | `/workspace`가 대상 체크아웃이 아님 |
| `git -C /workspace/work/inheritage rev-parse --show-toplevel` | fatal: not a git repository | 문서 임시 폴더를 checkout으로 간주 불가 |
| `git clone --branch docs/inheritance-design --single-branch https://github.com/jhlee8403/inheritage.git /workspace/work/inheritage-b0` | exit128, `Failed to connect to proxy port 8080 after 0 ms: Could not connect to server` | 원격 Git 인증·저장소 내용 확인 단계에 도달하지 못함 |
| `curl --head --location --max-time 15 --silent --show-error https://registry.npmjs.org/pdfjs-dist` | curl(7), 동일 proxy 연결 실패 | 패키지 metadata endpoint 접근조차 실패; 설치 미시도 |
| `curl --head --location --max-time 15 --silent --show-error https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/kor.traineddata` | curl(7), 동일 proxy 연결 실패 | 시험 모델 출처 후보의 접속 확인 실패; 본문 다운로드 없음 |

위 clone은 이번에1회, 각 HEAD도1회만 시도했다. 같은 실패를 반복하지 않았다. 모델 URL은 접근 점검용 후보이며 선택·호환·배포 승인된 모델로 확정한 것이 아니다. 허용 목록에 있다는 사실과 실제 접속 성공을 구분한다. HTTP 응답을 받지 못했으므로 401/403·모델 파일404·라이선스 문제라고 단정하지 않는다.

환경 조회의 failure=null은 구체적 환경 실패 사유가 제공되지 않았다는 뜻이며, 관찰된 프록시 TCP 연결 실패의 내부 원인을 설명하지 않는다. GitHub 연결 도구는 별도로 작동했으나 이를 터미널 연결 성공으로 사용하지 않았다.

## 4. 이미 존재하는 패키지 목록 — 설치·채택 아님

Node의 현재 모듈 해석으로 `/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/` 아래 패키지가 발견되었다. 이번에 설치한 패키지는 없다. 출처는 해당 package.json의 repository 필드이며 원래 설치 공급망·압축 배포물의 진위까지 확인한 것은 아니다.

| 발견 패키지 | 버전·package.json 라이선스 | 표기된 저장소 | package.json bytes | package.json SHA-256 |
|---|---|---|---|---|
| pdfjs-dist | 5.6.205 / Apache-2.0 | https://github.com/mozilla/pdf.js.git | 778 | `c91f1f1071e5535e5161f2fff925917550f4f0d2463a52ec94be24bd00b55971` |
| tesseract.js | 7.0.0 / Apache-2.0 | https://github.com/naptha/tesseract.js.git | 2914 | `fa342f37afd665595eca66ee867197c47c9ac35a7967123d1132c39a40b3dfbd` |
| tesseract.js-core | 7.0.0 / Apache-2.0 | https://github.com/naptha/tesseract.js-core.git | 1784 | `554b867684677c81aa3ffab61f31e83618445fa09adee99e8fff3515cee6ca54` |
| playwright | 1.62.1 / Apache-2.0 | https://github.com/microsoft/playwright.git | 1416 | `ca170ec143a88ed3043ac953eb3b2377b2b97304104f4e1e23316684ce2c35af` |

각 package 디렉터리에서 LICENSE 또는 LICENSE.md 파일 존재도 확인했다. 위 용량·해시는 **package.json만의 값**이며 전체 라이브러리·WASM·전이 의존성·배포 번들의 값이 아니다. 전체 용량·전체 아카이브 해시·재배포 고지·취약점·버전별 호환성 검토는 미실시다. B1용 package-lock 및 모델 manifest는 생성하지 않았다. 다운로드 모델은0개이며 선택 버전·파일 용량·해시가 확보된 모델은 없다.

## 5. B1 기능·표본·측정 결과

| 항목 | 상태 |
|---|---|
| PDF 페이지 표시·정상 텍스트 직접 추출 | 미구현·미실행 |
| 스캔/불완전 영역 로컬 OCR | 미구현·미실행 |
| 원문/추출 텍스트·위치 대조 | 미구현·미실행 |
| 영역 재인식·수동 수정·선택/복사 | 미구현·미실행 |
| PDF.js+Tesseract.js 통합 | 미실시; 사전 설치 패키지 발견과 구별 |
| PaddleOCR.js 비교 | 미검증; 통합·다운로드 없음 |
| 텍스트 PDF·스캔 PDF·페이지 혼합 | 가공 표본 미준비 |
| 텍스트 제목+이미지 본문·한자 혼용·회전/저해상도 | 가공 표본 미준비 |
| 가공 원문·정답·생성 스크립트 | B0 실패로 생성하지 않음 |
| 이름·날짜·관계 누락/오인·정확도 | 측정 없음 |
| OCR 처리 시간·메모리·배포 용량 | 측정 없음 |

실제 사건·가명 처리 사건·원본 주석서를 시험 데이터로 사용하지 않았다. 숨은 정답 텍스트층을 가진 스캔이나 정답 반환으로 OCR 성공을 표시한 자료도 없다. 실행하지 않은 기능·정확도·성능에 추정 수치를 넣지 않는다.

## 6. 오프라인·file://·loopback 판정

| 시험 | 결과·한계 |
|---|---|
| 앱의 빈 캐시 첫 실행·로컬 자원 완비 | 미실시. 앱·배포 자원을 만들지 않음 |
| 앱 외부 네트워크 요청 시도 | 측정 불가/해당 앱 없음. ‘외부 요청0으로 통과’라고 해석 금지 |
| file:// 직접 실행 | 미실시. 브라우저 파일 보안 성공/실패 판정 없음 |
| 개발용 loopback 서버 비교 | 미실시. 서버를 시작하지 않음 |
| 개발 Chromium에서 PDF/OCR 실행 | 미실시. 버전 확인만 수행 |
| 실제 업무 Edge | 미검증 |

제어 연결·개발 네트워크를 끊거나 프록시를 제거하지 않았다. 브라우저 보안 옵션을 해제하지 않았으며 기능 삭제로 시험 통과를 만들지 않았다. 업무 PC 서버/실행기 설치·원격 서비스 배포·업무 배포도 없다.

## 7. 필요한 환경 조치와 다음 실험

환경 운영 측에서 현재 실행기와 상속된 `proxy:8080` 서비스의 연결 상태를 확인·복구할 필요가 있다. 같은 정책의 제어 조회는 running/connected이지만 터미널 프록시 연결은 실패한다는 관찰과 위 명령·오류를 전달하면 된다. 토큰·비밀번호를 제공할 필요는 없으며 이 실패를 자격증명 오류로 단정하지 않는다. 이 작업에서 프록시·정책·권한을 직접 바꾸지 않았다.

승인된 경로가 복구되면 다음 순서로 재개할 것을 권한다.

1. B0부터 다시 실행: 대상 정상 clone 또는 기존 checkout 확인, origin·기준 커밋 포함·변경 상태·작업 규칙 검증. 지정 커밋으로 reset --hard하지 않음.
2. 허용 호스트의 실제 터미널 접근 및 선택 패키지·모델 출처 확인. 이번에 발견한 전역 패키지는 자동 채택하지 말고 버전·라이선스·자원 해시를 고정.
3. B0 통과 후에만 별도 `spike/offline-ocr` 브랜치를 확인·생성하고 PDF.js+Tesseract.js로 8~12쪽의 처음부터 만든 가공 표본·정답·생성 스크립트를 기록.
4. 직접추출·실제 OCR·영역 대조/재인식·수정·복사를 분리 측정하고, 빈 앱 캐시·외부 요청 시도·file://·loopback 결과를 각각 기록. 첫 경로를 검증하기 전 Paddle 통합을 늘리지 않음.

현재의 B0·조건부 B1 승인 자체를 다시 요구하는 것이 아니다. 운영 측 환경 설정 변경이나 추가 권한이 필요한 조치가 생기면 그 항목만 별도 절차로 다룬다. 본평가·계산 엔진·단계 C·업무 배포는 이번 승인 범위 밖이다.

## 8. 파일·커밋·원격 반영의 구분

이번 산출물은 새 `docs/inheritance/STAGE_B_REPORT.md` 한 파일이다. 임시 작업 사본은 `/workspace/work/inheritage/docs/inheritance/STAGE_B_REPORT.md`이고 이 폴더는 Git checkout이 아니다. 대상 로컬 Git 실행·로컬 커밋·터미널 push는 수행하지 않았다.

B0가 실패했으므로 실험 코드·lockfile·모델 manifest·표본 생성 스크립트는 없다. B0 보고서만 기준 커밋에서 파생한 문서 브랜치 `docs/stage-b0-report-20261018`에 GitHub 연결 도구로 기록하는 방식을 사용한다. `main`·기준 설계 브랜치·과거 RUN_LOG는 변경하지 않는다. node_modules·모델·대용량 생성물·원본 첨부·비밀값을 커밋 입력에 포함하지 않는다.

이 보고서를 포함하는 커밋의 자신의 해시는 파일 내부에 순환 기재하지 않는다. 실제 브랜치·커밋·원격 ref 재조회 결과는 GitHub 커밋 기록과 이번 완료 보고에서 별도로 제공한다. 연결 도구로 보고서를 보존한 사실은 B0 통과·B1 실행의 증거가 아니다.
