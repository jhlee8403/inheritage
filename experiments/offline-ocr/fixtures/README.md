# B1 완전 가공 표본

실제 사건, 가명 처리 사건, 원본 주석서에서 가져온 정보가 없다. 성명·날짜·관계·숫자는 이 실험에서 만든 문자열이며 법률 사실이나 정답이 아니다. 법률 상태는 PENDING이다.

- `suite.pdf`: 10개 고유 표본. 정상 텍스트 2쪽, 제목 텍스트+본문 이미지 1쪽, 순수 이미지 7쪽. 회전·기울기·저해상도·흐림/선 겹침 포함.
- `text-only.pdf`, `scan-only.pdf`: suite의 1·2쪽을 각각 분리한 입력 시험용 파일. 독립 표본으로 더 세지 않는다.
- `truth.json`: OCR을 실행하기 전에 고정한 원문·핵심 필드. 앱은 이 파일을 읽지 않으며 측정 스크립트만 읽는다.
- `source-png/page-01.png` ~ `page-10.png`: 기존 suite PDF를 Poppler 26.05.0으로 렌더한 PNG 10장을 바이트 그대로 보존했다. 기존 `.cache/render/page-*.png`도 지우거나 수정하지 않았다.
- `synthetic-scan.pdf`: 위 PNG를 순서대로 한 장씩 넣은 10쪽 이미지 전용 PDF. 텍스트 연산자·숨은 텍스트층이 없고, 원본 RGB 픽셀과 PDF 내 이미지의 픽셀 SHA-256이 모두 일치한다. 회전·해상도·기울기·흐림을 보정하지 않는다.
- `synthetic-scan-map.json`: PNG 경로·파일 해시·크기·픽셀 해시와 PDF 페이지·크기·전체 파일 해시의 대응표.
- `invalid-pdf.bin`: 잘못된 입력 처리를 시험하는 무해한 텍스트 파일.

PNG는 기존 PDF 10쪽의 렌더 파생물이다. 스캔 PDF 시험 10쪽과 원래 PDF 시험 10쪽을 합쳐 20개의 독립 표본으로 보고하지 않는다. PNG 업로드 기능은 구현하지 않았다.

생성: `scripts/generate-fixtures.py`. 기존 PNG를 다시 묶기: `scripts/build-synthetic-pdf.py`. 후자는 보존된 source-png가 있으면 그 파일을 사용하며 리샘플링·회전·강조를 하지 않는다. PDF 내 크기만 96 DPI 기준 포인트 단위로 지정한다.

Noto Sans KR은 OFL-1.1이며 `OFL-NotoSansKR.txt`를 함께 보존한다. 폰트 원본은 Git 제외된 `.cache/fonts/`에 있고, 텍스트 PDF에는 서브셋이 포함된다. 렌더 표본의 얇은 기본 글꼴 특성도 그대로 평가했다. 가공 원문과 생성 스크립트가 같은 작성 과정에서 나왔으며 독립 평가자의 표본 검수는 미실시다.
