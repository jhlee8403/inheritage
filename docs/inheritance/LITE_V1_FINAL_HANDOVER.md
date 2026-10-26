# 축소형 V1 최종 제출 안내·프로젝트 완료 기록

마감일: **2026-10-26 (Asia/Seoul)**. 저장소: `jhlee8403/inheritage`.
최종 기능 개발 브랜치: `fix/lite-v1-edge104-compatibility`.
검증된 기능 코드 커밋: `4adfb11caef0eaf621e1a409e0d460264c6e9030`.
이번 마감은 위 커밋에서 clean을 확인하고 문서만 변경한다. HTML/엔진/라이브러리/모델은 변경하거나 다시 생성하지 않는다. 문서 마감 커밋 SHA는 Git 이력과 완료 보고로 확인한다.

## 프로젝트 소개

서버 없는 단일 HTML에서 제한된 C1 기본 상속분 계산, PDF 원문 열람·직접 추출, 한국어 OCR 후보 생성·수정을 제공하는 가공 사례용 통합 시제품이다. 사용자 PC에 개발 도구 설치나 인터넷 연결을 요구하지 않는다. OCR 후보와 계산 사실 입력을 분리하고 사용자가 원문을 확인한 뒤 필요한 사실을 별도로 직접 입력한다. 자동 상속인 결정·OCR 사실 확정 기능은 없다.

축소형 V1의 개발을 여기서 마감한다. 이는 실제 사건/업무 사용 승인이나 모든 제품 위험 해소 선언이 아니다. 대습·연속상속·과거법 확대·M2 정상 배분·Windows 실행기 제작은 완료 범위 밖이다.

## 제출 파일 목록과 무결성

현재 개발 폴더의 상대 경로는 다음과 같다. 다른 PC에는 HTML·고지·안내만 독립된 폴더로 복사하면 되고, 개발 폴더의 절대 경로나 서버는 필요하지 않다.

| 구분 | 경로/파일 | 제출 여부 |
|---|---|---|
| 실행 HTML | `experiments/lite-v1-workbench/generated/lite-v1-3.html` | 필수, 현재 실제 보존 파일명 |
| 라이선스 | 같은 폴더 `NOTICE.txt` | 필수, 원문 그대로 동봉 |
| 최종 소개·한계·검증 | 이 문서의 사본 | 필수 안내 |
| 상세 수동 시험 | 같은 폴더 `Windows-시험안내.txt` | 동봉; 당시 NOT_RUN은 이력이며 아래 후속 기록 참조 |
| 1쪽 가공 표본 | `experiments/offline-ocr/fixtures/text-only.pdf`, `scan-only.pdf` | 시험 시 선택 |
| 3쪽 가공 표본 | `experiments/lite-v1-workbench/generated/fixtures/three-pages.pdf` | 시험 시 선택; generated/three-pages.pdf 사본도 존재 |
| 표본 글꼴 고지 | `experiments/offline-ocr/fixtures/OFL-NotoSansKR.txt` | 가공 PDF 동봉 시 함께 보존 |
| 개발 소스/검증 기록 | Git 저장소 및 `results/edge104/`, `results/build.json` | 제출 근거; 사용자 실행에 불필요 |

개발용 `generated/edge104-dev/` 브라우저·패키지·실패 재현 HTML, vendor 원본과 모델 폴더를 통째로 전달하지 않는다. 정상 HTML 내부에 실행 자원이 이미 포함돼 있다. 실제 사건/개인정보는 제출하지 않는다. 대형 HTML/vendor/모델은 Git 제외를 유지한다.

- HTML: **9,477,720바이트**
- HTML SHA-256: `2963016205768fdca0e6bdbf5b2711f3a32218edf4202b42349f158ad844581c`
- NOTICE: 55,485바이트; SHA-256 `9c62f532ebb5cbc02c00426d1145a7a798a7fe1abb111c7f35bee6f281e23e68`
- 기존 Windows 안내: 8,864바이트; SHA-256 `091dbe7f4de7e90e0e556e3b258428662c7592bc1957054704bab36c1f4b62f9`

이번 마감에서 실제 파일을 읽어 크기·SHA와 기존 build 기록의 일치를 확인했다. 기본 빌드 출력명 `lite-v1.html`은 현재 없고, `lite-v1-3.html`이 같은 시험본 바이트로 보존돼 있다. 사용자가 바꾼 파일명을 되돌리거나 파일을 덮어쓰지 않았다.

## 실행·가공 시험 방법

1. HTML·NOTICE·안내를 허용된 방식으로 PC에 복사하고 HTML을 Microsoft Edge로 연다. `file://` 주소로 실행한다. Node/npm/Python/Git/서버·관리자·보안 완화가 필요하지 않다. 회사 정책이 차단하면 우회하지 않는다.
2. PDF·C1 초기화 READY를 확인한다. `text-only.pdf`를 선택해 원문과 직접 추출 NEEDS_REVIEW 후보를 확인한다.
3. `scan-only.pdf`에서 한국어 OCR을 명시 실행한다. 원문과 비교해 누락/오인식을 수정한다. 후보는 계산 입력으로 자동 반영되지 않는다.
4. `three-pages.pdf`로 페이지 이동·PDF 교체 시 후보 제거를 확인한다. C1 가공 표본을 계산하고 입력 수정 시 기존 결과 제거·STALE 및 복사 차단을 확인한다.
5. 최신 결과는 복사 버튼, 또는 결과 선택 → Edge 복사 메뉴/Ctrl+C로 복사한다. 회사 Windows에서 위 각 항목을 실제 실행한 경우에만 후속 기록을 남긴다. 이 안내의 체크 항목을 이미 수행한 것으로 간주하지 않는다.

## 최종 검증 현황과 사용자 확인

### Windows 사용자 후속 확인 — 2026-10-26

사용자가 회사 Windows PC의 **Microsoft Edge104.0.1293.47**에서 새 호환성 수정본을 실행하고 **“이제 잘 된다”**고 보고했다. 증거 수준은 사용자 수동 실행 성공 보고다. 개발자가 해당 PC를 직접 실행하거나 콘솔·전체 스택·네트워크 로그를 수집한 것은 아니다. 실행 파일의 회사 PC 측 해시 재측정도 미확인이다.

- 전체적 실행 성공: **USER_REPORTED_SUCCESS**.
- PDF 페이지 이동·직접 추출·한국어 OCR 후보·OCR 인식률·후보 수정·취소/TIMEOUT·복사·C1 세 유형/ERROR/STALE 등 **개별 항목: 이번 사용자 보고에서 확인되지 않음**. 개별 Windows PASS로 표기하지 않는다.
- Windows 자동시험, 정확한 회사 네트워크 요청 수, 물리적 인터넷 차단 상태의 이번 재측정, 세부 정책/보안 감사: **NOT_RUN 또는 미확인**.
- 과거 C1 단독의 오프라인/복사 사용자 시험과 이번 통합 HTML 보고를 혼합하지 않는다. 기존 보고서의 당시 NOT_RUN은 소급 삭제하지 않는다.

### 기존 자동시험 — 기능 코드 커밋의 보존된 기록

| 환경/범위 | 통과 | 실패 | 건너뜀/미실시 |
|---|---:|---:|---|
| Mac 격리 Chromium104.0.5112.48 / 통합 file:// | 25 | 0 | 0 |
| Mac Chromium156.0.8078.4 / 통합 file:// | 25 | 0 | 0 |
| 실제 Mac Edge156.0.4314.42 / 통합 file:// | 25 | 0 | 0 |
| 최신 Chromium API 제거 보조 시험 | 25 | 0 | 0 |
| 원본modern6.4.299의 실제104 Iterator 오류 재현 assertion | 3 | 0 | 0; PDF 기능 성공을 뜻하지 않음 |
| C1+M2 Node | 135 | 0 | 0 |
| build/packaging Node | 7 | 0 | 0 |
| Mac Chromium 기존 C1/M2/C1 file/계산 화면 | 20+33+17+18 | 0 | 0 |
| Mac Edge 동일 기존 회귀 | 20+33+17+18 | 0 | 0 |
| 개발자 직접 회사 Windows Edge104 실행/자동시험 | — | — | NOT_RUN |

통합 시험은 실제 PDF 추출·렌더·한국어 후보, 문서교체·취소·늦은 결과 차단·한도/오류, C1정확분수·BLOCKED/ERROR/STALE·복사 대안을 검증했다. 각 환경의 최종 외부 요청·콘솔/page 오류·미처리 Promise·CSP 위반은0건이다. 빈 context/캐시와 browser offline 조건이며 물리적 단절을 측정한 것이 아니다. 실제 Chromium104 시험과 API제거 시험, 정확한 Windows Edge104 사용자 보고는 서로 다른 증거다.

이번 문서 마감에서는 자동시험을 중복 실행하지 않았다. 기존 로그의 버전·개수·최종 HTML 해시와 문서 연결을 점검했다. 사용자 보고 때문에 자동시험 수치나 개별 Windows 결과를 새로 만들지 않았다.

## 호환성 수정과 고지 점검

6.4.299 modern worker가 없는 `Iterator` 전역을 초기화 중 참조한 오류를 실제104에서 재현했다. 같은 버전 legacy와 제한 보완의 실패도 보존한 후 공식 **PDF.js4.2.67 legacy main/worker 동일 버전**을 선택했다. 공식 포함 core-js3.37.0 구현을 유지하고 추가 dummy Iterator는 없다. Tesseract.js/core7.0.0, 고정 한국어 모델·truth·SHA는 유지했다. C1 script 바이트도 동일하다.

재배포 고지 파일을 읽어 기존 PDF.js/Tesseract/core/모델 LICENSE 및 선택4.2.67 Apache-2.0 LICENSE, core-js MIT LICENSE 원문이 NOTICE에 포함됨을 바이트로 확인했다. 모델·라이브러리별 출처/버전/해시는 `results/build.json`, `compat/manifest.json`에 있다. 제한된 module→classic 연결과 인라인 포장은 기술 보고서에 변경 내역을 명시했다. NOTICE와 이 변경 기록을 HTML과 함께 전달한다. 가공 PDF의 Noto 글꼴 OFL 고지도 보존한다.

저장소 루트에 프로젝트 전체의 LICENSE는 없다. 타사 고지 보존 점검은 프로젝트 전체 공개 배포권·모든 전이 의존성의 법률 감사·회사 반입/실행 정책 승인과 다르다. 이를 완료됐다고 선언하지 않는다.

## 재생성 경로 (개발자 전용)

고정 자원 준비는 `experiments/lite-v1-workbench/compat/README.md`를 따른다. 기존 OCR vendor/모델 및 C1 출력이 준비된 개발 환경에서 다음을 실행한다.

```sh
node experiments/lite-v1-workbench/compat/prepare.mjs
node experiments/lite-v1-workbench/build.mjs
# 가공 시험 PDF를 새로 준비해야 할 때만, 기존 Python/reportlab/pypdf 개발 환경에서:
python3 experiments/lite-v1-workbench/fixtures.py
```

기본 출력은 `experiments/lite-v1-workbench/generated/lite-v1.html`이다. 빌더는 manifest 무결성을 확인하며 누락 자원을 자동 다운로드/교체하지 않는다. 재생성본의 SHA/크기를 `results/build.json`과 대조한다. 개발 도구는 생성자만 필요하고 사용자는 이미 생성된 HTML을 받는다. 이번 마감에서는 정상 HTML/안내/NOTICE를 재생성하지 않았다.

## 완료 범위와 업무 사용 금지 조건

- C1은 **승인된 가공 표본 및 명시된 제한 조건 내 입력만** 계산한다. 승인된 개시일2017-01-10·기준일2017-01-11·BL1-LAW-2016-14409 밖을 지원하지 않는다. 법률혼 배우자+생존 성년 친생자녀, 배우자+생존 성년 최근친 친생부모, 배우자 없는 생존 성년 친생자녀만 대상이다. 미확인 사실·집합 불완전·미지원 관계는 차단한다.
- R04/R05·새 날짜/truth/의존 승인은 **PENDING**이다. M2는 기술 안전 기반을 보존할 뿐 정상 지분 계산은 비활성이다. 대습·연속·구법·입양·포기·복수 사건을 자동 계산하지 않는다.
- PDF.js4.2.67은 최신 유지보수 버전이 아니다. 특정 취약점 패치 확인은 전체 보안성 보증이 아니다. 구형 Edge/라이브러리의 보안·유지보수 및 신뢰하지 않는 PDF 위험을 해소했다고 선언하지 않는다.
- 한국어 OCR의 기존 가공 표본 **CER32.84%·인명 누락**이 남는다. 한자·세로쓰기·복잡한 제적등본의 정확도를 보증하지 않는다. 인식/사용자 수정 후보도 법적 사실·상속인 확정이 아니며 C1으로 자동 반영하지 않는다.
- 실제 개인정보·사건자료·실제 제적등본을 개발/시험/이 시제품에 입력하거나 업로드하지 않는다. 실제 사건 처리, 재산 귀속 확정, 법률 의견/업무 판단의 근거로 사용하지 않는다. 사용자 실행 성공은 이를 허용하는 승인이 아니다.
- 메모리 내 처리를 기본으로 해도 OS swap·복구·클립보드의 삭제나 전체 메모리 안전을 보증하지 않는다. 보안/정확도/개인정보 정책 검증이 완료되지 않은 상태로 실제 업무에 전환하지 않는다.

마감은 가공 사례용 축소형 V1의 개발 종료다. 남은 제한은 미해결로 보존하며 기능 확대·의존성 갱신·법률 승인·다음 개발을 자동 시작하지 않는다. 문서 변경만 로컬 커밋하고 터미널 push/PR/main merge는 하지 않는다. GitHub Desktop에서 `fix/lite-v1-edge104-compatibility`의 새 문서 커밋을 Push/Publish한다.
