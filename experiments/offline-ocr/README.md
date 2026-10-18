# B1 PDF·OCR 최소 기능 실험

완전 가공 PDF만 사용한다. 법률·가족관계 확정, 상속 계산, 사건관리, 업무 배포 기능이 없는 기술 검증이다. 모든 후보는 NEEDS_REVIEW, 법률 상태는 PENDING이다.

## 실행

Node 24 이상. 이 폴더에서 실행한다.

```sh
npm ci --ignore-scripts
npm run prepare:assets
npm start
```

`http://127.0.0.1:4173`에서 `fixtures/synthetic-scan.pdf`를 선택한다. 각 페이지에서 **직접 추출 + 필요한 OCR**을 누른다. 원본 위에서 드래그하고 **선택 영역 재OCR**로 영역을 다시 읽는다. 오른쪽 텍스트는 수정·선택·복사할 수 있다. 자동 복사가 거부되면 텍스트 선택 후 키보드 복사를 안내한다. 실패 원인을 해결한 뒤 재시도할 수 있다.

`suite.pdf`로 정상 텍스트·혼합 페이지도 시험할 수 있다. PNG 입력은 지원하지 않는다. 보기 회전은 원본 파일을 수정하지 않고 렌더 좌표를 원본 PDF 좌표로 역변환한다. 인식 결과와 수정 이력은 탭 메모리에만 있으며, 탭 종료 후 복원되지 않는다. 재처리는 해당 페이지의 편집 텍스트를 새 후보로 바꾸지만 이전 편집 기록은 탭 메모리에 남는다.

`prepare:assets`만 개발용 네트워크가 필요하다. 모델/글꼴은 고정된 공식 Git 커밋에서 받고 기존 manifest SHA-256과 비교한다. PDF.js·worker·CMap·표준 글꼴·WASM, Tesseract·worker·core·언어 모델은 `public/`에 제공한다. 처음 실행할 때도 CDN이나 외부 OCR에 접속하지 않는다. Tesseract 언어 캐시는 비활성화했다. npm 설치는 postinstall 실행을 억제한다.

`file://`는 Chromium의 module/CORS 제한으로 이 구현의 초기화에 실패했다. 보안 해제 옵션을 사용하지 않는다. loopback 서버는 개발용이며 업무 PC 허용을 뜻하지 않는다.

## 재현 시험

```sh
npx playwright install chromium
npm run test:unit
npm test
```

테스트는 4173 포트를 사용하므로 먼저 별도 `npm start` 서버를 종료한다. 새 Chromium 컨텍스트·빈 앱 저장소에서 corpus를 처리하고 비-loopback 요청을 차단·기록한다. 사용자 브라우저 프로필이나 Mac 네트워크 설정은 변경하지 않는다. UI 파일 선택·페이지 이동·렌더링·OCR·영역 드래그·수정·복사를 시험하고, 모델 404를 한 번 주입한 뒤 복구/재시도한다. 클립보드 허용/거부는 테스트 컨텍스트의 권한/Permissions-Policy에서만 설정한다. 전체 실행 결과와 외부 요청 기록은 `results/evaluation.json`, `results/network.json`에 저장된다. 파일 URL의 사용자 홈 경로만 `<experiment>`로 가린다.

`results/assets-manifest.json`은 전이 패키지를 포함한 버전·출처·라이선스·설치 용량·npm archive integrity·라이선스 파일 SHA-256과 모든 브라우저 자원의 용량·SHA-256을 담는다. npm integrity는 SHA-512이고 package.json SHA-256은 전체 패키지 해시가 아니다. 모델과 vendor 파일은 Git에서 제외한다.

Python 가공 표본을 처음부터 재생성하려면 `requirements-fixtures.txt`의 패키지와 위 자원 준비가 필요하다. 본 실험은 Codex bundled Python을 사용했다. 일반 환경에서는 별도 가상환경에 이 요구사항을 설치할 수 있다.

```sh
python3 scripts/generate-fixtures.py
mkdir -p .cache/render
pdftoppm -scale-to 800 -png fixtures/suite.pdf .cache/render/page
python3 scripts/build-synthetic-pdf.py
```

보존된 `fixtures/source-png/`가 있으면 마지막 명령만으로 스캔 PDF를 재생성할 수 있다. 원본 PNG와 픽셀이 달라지면 덮어쓰기를 거부한다. 기존 표본 원문을 OCR 결과에 맞춰 수정하지 않는다.

## 측정 해석

정확도는 고정 원문과 원시/공백 제거 후 문자 편집거리(S/D/I), 핵심 필드 문자열 존재 여부로 측정한다. 필드 위치나 의미 해석의 성공을 뜻하지 않는다. 숫자/한자는 전체 페이지의 해당 문자열 편집거리다. 수동 수정 필요량은 최소 문자 편집거리이며 사람의 실제 수정 시간·클릭 수는 측정하지 않았다. 회전 페이지에서 읽기 순서가 틀려도 개별 필드 문자열이 존재할 수 있으므로 전체 문자 오류도 함께 본다.

이미지 영역 감지와 텍스트 면적 비율은 B1 휴리스틱이다. 장식 이미지·복잡한 중첩·불량 기존 OCR층의 완전성을 보장하지 않는다. 전체 OCR/영역 재OCR를 수동 선택할 수 있다. 텍스트 좌표는 PDF 글꼴 정보에 의한 근사 경계이고 OCR 좌표는 해당 인식 결과다. 큰 파일(50 MB/100쪽/페이지 1600만 렌더 화소)을 제한한다.

80쪽 본평가, PaddleOCR, Edge, 업무 PC, OCR 정확도 합격 판정, 법률 승인·엔진은 수행하지 않았다. 상세 결과는 [STAGE_B_REPORT.md](../../docs/inheritance/STAGE_B_REPORT.md)를 참조한다.
