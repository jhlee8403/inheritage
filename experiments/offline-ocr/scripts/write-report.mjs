import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const read=async file=>JSON.parse(await readFile(root+file,'utf8'));
const r=await read('results/evaluation.json'), a=await read('results/assets-manifest.json');
const sourceMap=await read('fixtures/synthetic-scan-map.json');
const network=await read('results/network.json');
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
const codeHead=git('rev-parse','HEAD');
const cloud=execFileSync('git',['show','origin/docs/stage-b0-report-20261018:docs/inheritance/STAGE_B_REPORT.md'],{cwd:repo,encoding:'utf8'});
const esc=s=>String(s).replaceAll('|','\\|').replaceAll('\n',' ');
const rowsTable=rows=>[
  '|쪽|직접 항목|렌더 ms|추출/OCR ms|이름|날짜|관계|번호 필드|한자 필드|오인 S|누락 D|추가 I|숫자 편집|한자 편집|',
  '|---|---:|---:|---:|---|---|---|---|---|---:|---:|---:|---:|---:|',
  ...rows.map(p=>`|${p.page}|${p.record.direct.length}|${p.record.renderMs}|${p.record.attempts[0].totalMs}|${['name','date','relationship','number','hanja'].map(k=>p.metrics.fields[k]?(p.metrics.fields[k].exactSubstring?'일치':'불일치'):'해당 없음').join('|')}|${p.metrics.normalized.substitutions}|${p.metrics.normalized.deletions}|${p.metrics.normalized.insertions}|${p.metrics.numbers.editDistance}|${p.metrics.hanja.editDistance}|`),
].join('\n');
const aggregate=rows=>Object.fromEntries(['name','date','relationship','number','hanja'].map(k=>{const eligible=rows.filter(p=>p.metrics.fields[k]);return [k,{matched:eligible.filter(p=>p.metrics.fields[k].exactSubstring).length,total:eligible.length}];}));
const ocrRows=r.runs.filter(p=>p.record.attempts[0].ocr.length);
const summary={suiteOcr:aggregate(ocrRows),syntheticScan:aggregate(r.syntheticScan.pages),
  suiteOcrEdits:ocrRows.reduce((n,p)=>n+p.metrics.normalized.editDistance,0),scanEdits:r.syntheticScan.pages.reduce((n,p)=>n+p.metrics.normalized.editDistance,0),
  corpusCounts:{unique:10,originalDirectOnly:2,originalWithOcr:8,scanDerived:10},externalRequests:r.checks.externalRequests.length};
await writeFile(root+'results/summary.json',JSON.stringify(summary,null,2)+'\n');
const counts=obj=>Object.entries(obj).map(([k,v])=>`${k} ${v.matched}/${v.total}`).join(', ');
const heap=r.runs.map(p=>p.mainThreadHeap).filter(x=>x!==null);
const runtimePackages=['pdfjs-dist','tesseract.js','tesseract.js-core','playwright','playwright-core'];
const methods=network.requests.filter(x=>x.url.includes('/models/')&&x.url.endsWith('.traineddata'));
const report=`# 단계 B — 로컬 B1 PDF·OCR 최소 기능 검증

작성일: 2026-10-18 (Asia/Seoul). **B0 통과 / B1 최소 기능 구현·시험·기록 완료. OCR 정확도 합격·업무 배포 승인은 아님.** 법률 규칙·정답 후보는 전부 PENDING 유지.

## 1. 작업 기준·범위·Git

- 대상: \`jhlee8403/inheritage\`, origin \`https://github.com/jhlee8403/inheritage.git\`.
- 실제 작업 폴더: Mac 로컬 \`~/Desktop/상속분프로그램\`. Cloud가 아니다.
- 기준: \`docs/inheritance-design\` / \`8776506daf2da153feb64084b420bc6ae84fee39\`.
- 실제 브랜치: \`${git('branch','--show-current')}\`. 이 보고서 생성 시 HEAD: \`${codeHead}\`.
- 가공 표본 커밋: \`4669a38\`. 구현 커밋: \`d50416d\`. 보고서 자신을 포함하는 최종 커밋 해시는 순환 기재하지 않고 Git 로그·최종 답변으로 식별한다.
- 필수 단계 A 문서 10개(CODEX_HANDOFF, DECISIONS, DATA_MODEL, ENGINE_DESIGN, OCR_EVALUATION_PLAN, ENVIRONMENT_PLAN, TEST_PLAN, RULES_DRAFT, LEGAL_REVIEW_QUEUE, RUN_LOG)를 다시 읽었다. 단계 A 원문은 수정하지 않았다.
- 실험은 \`experiments/offline-ocr/\` 아래에 분리했다. main·기준 브랜치 변경, force push, history 재작성, PR·merge 없음.
- 로컬 Git 작성자 설정이 없어 자동화 작성자 \`Codex <codex@localhost>\`를 커밋 명령별로만 지정했다. 개인 이메일·전역 설정은 추가하지 않았다.

## 2. 로컬 B0 환경과 승인

macOS 26.5.1, Apple Silicon arm64, Git 2.50.1 (Apple Git-155), Command Line Tools 설치 확인. Node ${r.environment.node}, npm 11.19.1. Node는 공식 tarball의 SHA-256 검증 후 사용자 폴더 \`~/.local/share/node-v24.22.0-darwin-arm64\`에 설치됐다. 새 zsh 로그인 셸 PATH는 \`~/.local/bin\`을 포함한다.

대상 저장소 clone·원격 기준 브랜치 조회, npm registry ping, 공식 OCR 모델 주소 HEAD가 실제 성공했다. 제한된 명령 실행 환경의 DNS 실패는 표준 \`require_escalated\` 요청 후 해결됐다. 과거 Cloud proxy:8080 실패를 현재 제약으로 적용하지 않았다. 프록시 제거·TLS 검증 해제·네트워크 정책 변경·sudo·브라우저 보안 해제는 수행하지 않았다.

개발 브라우저는 Chromium ${r.environment.browser}, Playwright의 별도 임시 headless 컨텍스트다. Safari 존재도 B0에서 확인했으나 본시험에 사용하지 않았다. 로컬 Microsoft Edge 미설치, Edge·업무 PC 시험 **미실시**. 실제 모델/추론 강도 설정은 이 작업에서 조회·변경하지 않았다.

## 3. 구현된 최소 기능

PDF 파일 선택, 페이지 선택/렌더링, 정상 텍스트층 직접 추출, 텍스트 없는 페이지와 텍스트 면적이 적은 이미지 영역 OCR, 원문/후보 대조, 페이지·좌표 연결, 영역 드래그 재OCR, 수동 수정, 선택/복사, 실패 페이지 재시도와 오류 표시를 구현했다. 렌더 회전과 PDF 좌표를 분리하며, 수정값·인식 원문·출처·시도를 메모리에 남긴다.

후보는 NEEDS_REVIEW이며 사실 확정이 아니다. 혼합 영역 검출은 이미지 연산자·텍스트 면적 기반 휴리스틱이다. 일반 PDF의 완전성 보증이 아니고, 깨진 기존 OCR층·복잡한 중첩·장식 이미지 등은 추가 검증이 필요하다. 사용자가 전체/영역 OCR을 선택할 수 있다. PNG 업로드, 계산 엔진, 법률 규칙 적용, 동일인 병합, 가족관계 확정, 사건관리, 클라우드 OCR, 생성형 AI 판정은 구현하지 않았다.

## 4. 패키지·자원·모델

|패키지|버전|라이선스|설치 파일 합계 bytes|
|---|---|---|---:|
${a.packages.filter(p=>runtimePackages.includes(p.name)).map(p=>`|${p.name}|${p.version}|${esc(p.license)}|${p.installedBytes}|`).join('\n')}

설치 경로는 실험 폴더의 \`node_modules/\`. PDF.js 공식 저장소는 https://github.com/mozilla/pdf.js, Tesseract는 https://github.com/naptha/tesseract.js 및 https://github.com/naptha/tesseract.js-core, Playwright는 https://github.com/microsoft/playwright 이다. 정확한 archive URL·npm SHA-512 integrity·package.json SHA-256·전이 패키지·라이선스 파일·크기는 \`results/assets-manifest.json\`에 기록했다. npm install --ignore-scripts 결과 audit 0 vulnerabilities는 당시 npm 보고이며 포괄적 보안 검증이 아니다.

모델은 tessdata_fast의 고정 커밋 \`87416418657359cb625c412a48b6e1d6d41c29bd\`, LSTM-only, \`kor+eng+chi_tra\`, PSM 3으로 사용했다. 한자 지원은 이 조합에 대한 시험이며 한국어 인명 일반 성능 보장이 아니다.

|모델|bytes|SHA-256|로컬 경로|
|---|---:|---|---|
${a.sources.filter(s=>s.name.startsWith('tessdata_fast/')).map(s=>`|${s.name}|${s.bytes}|${s.sha256}|${s.target}|`).join('\n')}

공식 모델 URL은 manifest에 고정했다. 모델 라이선스 Apache-2.0 원문도 로컬에 포함했다. 언어 모델 자체는 커밋하지 않았다. PDF.js build·module worker·CMap·standard_fonts·WASM과 Tesseract script·worker·core 변형·WASM 모두 \`public/vendor/\`에 복사했다. 자원 ${a.runtimeFiles.length}개, 전체 ${a.runtimeBytes} bytes (${(a.runtimeBytes/1048576).toFixed(2)} MiB), 각 파일 SHA-256 기록. 사용하지 않는 core 변형도 현재 포함되어 용량 최적화는 미실시다.

Noto Sans KR은 Google Fonts 고정 커밋 \`47d54ca1ebb14fd864695f1d39dc734f39017c33\`, OFL-1.1, 글꼴 파일 ${a.sources.find(s=>s.name==='Noto Sans KR').bytes} bytes. 원본은 \`.cache/fonts/\`, PDF에는 서브셋, 라이선스는 fixtures에 보존했다. ReportLab 4.4.9, Pillow 12.3.0, pypdf 6.10.0은 Codex bundled Python 26.1017.11052에서 사용했으며 출처·라이선스·크기·metadata 해시는 \`results/fixture-tools.json\`에 기록했다. Poppler 26.05.0은 bundled pdftoppm을 렌더 검수에만 사용했다(공식 https://poppler.freedesktop.org/, GPL 계열, 앱 배포 자원에 포함하지 않음).

재배포 전 PDF.js/표준 글꼴·Tesseract core 전이 자원·모델·OFL의 실제 LICENSE/NOTICE를 배포본과 함께 다시 확인해야 한다. 저장소 패키지 라이선스만으로 전체 배포 고지 완료를 선언하지 않는다. 개발용 Python·Poppler·Playwright·브라우저를 업무 PC 필수 설치물로 지정하지 않았다.

## 5. 완전 가공 표본과 PNG→PDF

10개 고유 표본을 새로 작성했다. 정상 텍스트(1·3쪽), 순수 스캔(2·5~10쪽), 제목 텍스트+본문 이미지(4쪽), 한글 이름·날짜·관계·숫자·한자, 90도 회전(7), 3도 기울기(8), 저해상도(9), 흐림/선/도장 형태 원 겹침(10)을 포함한다. 표본 글꼴은 얇은 기본 굵기여서 실제 문서 분포를 대표하지 않는다.

원문 \`fixtures/truth.json\`을 인식 전에 고정했고 OCR 결과에 맞춰 고치지 않았다. 앱은 정답 파일을 읽지 않는다. \`scripts/generate-fixtures.py\`로 suite.pdf를 생성하고 pypdf로 7개 순수 이미지 페이지의 직접 추출이 비어 있음, 혼합 페이지는 제목만 추출됨을 검증했다. Poppler로 10쪽을 렌더하고 전체 contact sheet 및 작업대 화면을 시각 검수했다. 원본 U1/U2·실제 사건·가명 처리 자료는 사용하지 않았다.

사용자 추가 요청에 따라 이미 존재하던 PNG 10장을 \`fixtures/source-png/page-01.png\`~\`page-10.png\`에 바이트 그대로 보존했다. \`scripts/build-synthetic-pdf.py\`가 이를 순서대로 \`fixtures/synthetic-scan.pdf\`에 묶는다. 각 이미지가 한 페이지이며 회전·기울기·화질을 보정하지 않았다. 파일 ${sourceMap.pdfBytes} bytes, SHA-256 \`${sourceMap.pdfSha256}\`.

PDF 10쪽, 페이지당 이미지 1개, 텍스트 출력 연산자 없음, 추출 텍스트 0, PDF에서 해독한 RGB 픽셀 SHA-256과 PNG RGB 픽셀 SHA-256 **10/10 일치**. 대응표는 \`fixtures/synthetic-scan-map.json\`. 원래 .cache PNG도 변경하지 않았다. PNG는 동일 10개 표본의 파생물이며 20개의 독립 표본으로 확대하지 않는다.

## 6. 실제 추출·OCR 결과

최종 측정 시작(UTC): ${r.startedAt}; 종료(UTC): ${r.finishedAt}. 각 시각에 9시간을 더하면 Asia/Seoul이다. 서로 다른 구현 디버깅 실행을 평균내지 않았고 마지막 완주 실행만 표에 기록한다. 정확도 개선을 위한 모델/표본 정답 튜닝은 하지 않았다.

필드 ‘일치’는 NFC·공백 제거 후 원문 필드 문자열이 후보에 존재한다는 뜻이다. 의미/관계 확정이나 필드 위치 정확도는 측정하지 않았다. S/D/I는 공백 제거 후 전체 문자 정렬의 오인/누락/추가 수다. 숫자·한자 편집은 페이지 전체의 해당 문자열을 비교한 수치다. 읽기 순서가 틀린 회전 페이지는 필드 문자열이 남아 있어도 전체 오류가 클 수 있다. 원시 문자 기준 값도 evaluation.json에 따로 저장했다.

### 원래 suite.pdf

${rowsTable(r.runs)}

직접 추출 전용 2쪽은 원문 일치. 실제 OCR을 실행한 8쪽의 필드 존재 일치는 ${counts(summary.suiteOcr)}. OCR 대상의 최소 문자 수정량 합계는 ${summary.suiteOcrEdits}회다. 이는 사람의 실제 클릭·수정 시간 측정이 아니라 편집거리 하한이다.

### PNG로 묶은 synthetic-scan.pdf

${rowsTable(r.syntheticScan.pages)}

작업대 파일 선택으로 10쪽 인식, **10/10 렌더링, 10/10 직접 텍스트 0항목, 10/10 실제 OCR 실행·비어 있지 않은 후보 생성**. 필드 존재 일치: ${counts(summary.syntheticScan)}. 최소 문자 수정량 합계 ${summary.scanEdits}회. 후보가 생성됐다는 사실과 정확하다는 사실을 구분한다. 특히 이름·한자·회전 읽기 순서에 오류가 남았다.

## 7. 시간·자원·재OCR·수정·복사

- 최초 OCR 초기화(로컬 자원 점검+worker/core/모델 시작): ${r.runs[1].record.attempts[0].ocr[0].startupMs} ms. 최초 suite 스캔 처리 전체: ${r.runs[1].record.attempts[0].totalMs} ms. 위 페이지 시간에는 렌더 시간과 OCR 시간을 분리했다.
- 새 컨텍스트 synthetic-scan 최초 초기화: ${r.syntheticScan.pages[0].record.attempts[0].ocr[0].startupMs} ms. 빈 앱 캐시여도 OS 파일 캐시까지 비웠다는 뜻은 아니다.
- 같은 worker로 suite 2쪽 반복 처리: ${r.repeat.attempt.totalMs} ms. 영역 드래그 재OCR: ${r.region.attempt.totalMs} ms. 각 한 번 측정이며 p50/p95 벤치마크가 아니다.
- main frame JS heap 표본 범위 ${Math.min(...heap)}~${Math.max(...heap)} bytes. CDP JSHeapUsedSize이며 worker/WASM/native/브라우저 전체 메모리와 최대 사용량은 미측정이다.
- 영역 드래그 → 영역 재OCR 성공, 후보/좌표 연결 유지. PDF→viewport 좌표 왕복의 최대 오차 ${r.checks.coordinateRoundTrip.maxPixelError} px. 이 수치가 인식한 글자의 실제 위치 정확도까지 보증하지 않는다.
- 90도 PDF 페이지를 보기 회전 3회 후 다시 인식하는 경로도 시험. 수동 회전 후에도 이름/번호 오류가 남아 회전만으로 해결된다고 결론내리지 않았다. 원본 PDF/PNG 회전은 변경하지 않았다.
- 원문 기준으로 후보 수동 수정, 텍스트 전체 선택, 페이지 이동 후 수정 유지 확인. 자동 복사 내용의 후보 경고 포함 여부 확인. 실제 브라우저 Permissions-Policy로 복사를 거부한 새 컨텍스트에서도 선택/키보드 복사 대안 확인. 인간 사용자의 실제 수정 시간은 미측정이다.

## 8. 실패·재시도·실제 stack trace

1. 개발 중 이미지 렌더: PDF.js 6의 Util.applyTransform이 점 배열을 제자리 수정하고 void를 반환하는데 반환값을 좌표로 사용해 오류가 났다. 변환 후 원래 점을 반환하도록 수정. 최초 실제 trace는 \`results/render-error-reproduction.json\`에 보존했다.

\`\`\`text
TypeError: Cannot read properties of undefined (reading '0')
    at http://127.0.0.1:4173/src/engine.mjs:7:56
    at Array.map (<anonymous>)
    at bounds (http://127.0.0.1:4173/src/engine.mjs:7:46)
    at PdfOcrSession.render (http://127.0.0.1:4173/src/engine.mjs:53:19)
\`\`\`

2. PDF 교체: this.pdf.destroy is not a function 오류를 발견했다. PDFDocumentLoadingTask.destroy로 자원을 해제하도록 수정했다. 최종 잘못된 입력은 \`${esc(r.checks.invalidPdfError)}\`로 정상 거부됐고 **동일 화면에서** 정상 PDF 재선택·추출이 성공했다.
3. 초기 복사 거부 시험은 CDP 권한 설정 대상이 실제 테스트 컨텍스트와 달라 30초 대기 실패가 났다. 테스트 컨텍스트 응답의 Permissions-Policy로 실제 거부 조건을 만들도록 시험을 수정했다. 제품 보안을 낮춘 것이 아니다.
4. 초기 모델 404 시험에서 worker 초기화가 45초 타임아웃까지 기다렸다. 로컬 필수 자원 사전 확인을 추가해 실제 경로/HTTP 코드를 즉시 표시하도록 개선했다. 최종 404 주입 오류는 아래와 같다. 주입을 제거하고 ‘실패 페이지 재시도’를 눌러 ${r.checks.retry.retried.totalMs} ms에 후보 생성으로 복구했다.

\`\`\`text
${r.checks.retry.failure.stack}
\`\`\`

최종 corpus의 자연 발생 처리 실패는 0쪽이다. 인식 오류는 여러 쪽에 남아 있다. 의도적으로 주입한 모델 누락과 잘못된 PDF는 음성 시험이며 전체 정확도 실패와 별도다. 최종 npm test 종료 코드 0, metrics 단위시험 2개 통과. 오류 원문·시도별 결과는 evaluation.json/network.json에 남겼다.

## 9. 오프라인 자원·외부 요청

새 임시 Chromium 컨텍스트, 초기 localStorage/sessionStorage 0, IndexedDB 빈 목록, service worker 0. cold corpus에서 브라우저 HTTP cache 비활성화, Tesseract cacheMethod none. 끝에도 앱 storage가 비어 있음을 확인했다. OS 네트워크 설정은 변경하지 않고 브라우저 테스트에서 loopback 외 HTTP(S) 요청을 차단·기록했다. CSP도 self-only다.

기록된 전체 요청 ${network.requests.length}건 중 **앱의 외부 HTTP(S) 요청 시도 ${r.checks.externalRequests.length}건**. 모델 HEAD/GET 요청 ${methods.length}건은 모두 127.0.0.1의 미리 준비한 파일이다. 첫 OCR에 모델을 로컬 서버에서 읽지만 인터넷에서 다운로드하지 않는다. 외부 CDN·telemetry·인증·클라우드 OCR 미사용. 개발 설치/모델 준비 시의 승인된 외부 다운로드는 런타임 요청과 구분한다.

PDF CMap/표준 글꼴/PDF WASM은 실제 파일·해시를 로컬에 갖췄다. 이번 embedded-font/단순 이미지 PDF에서 모든 CMap·폰트·JPEG2000 등의 자원 분기까지 실행한 것은 아니다. 요청 로그는 앱 컨텍스트 범위이며 OS 전체 패킷 캡처 결과가 아니다.

## 10. file:// 와 loopback

|경로|실제 결과|실패 지점·한계|
|---|---|---|
|file://|FAIL|src/app.mjs ES module 로드가 origin null CORS에 차단되어 앱 초기화 이전 실패. PDF worker/WASM/model 기능은 이 경로에서 도달하지 못해 미판정|
|http://127.0.0.1:4173|B1 최소 기능 동작|10쪽 직접/혼합 및 10쪽 파생 스캔 시험. 개발용 loopback 허용은 업무 PC 서버 승인과 다름|

실제 브라우저 오류(로컬 홈 경로만 가림):

\`\`\`text
${r.fileProtocol.errors.map(x=>x.message).join('\n')}
\`\`\`

브라우저 web security/file access 옵션을 해제하지 않았다. Microsoft Edge **미실시**, Chromium 통과를 Edge 통과로 보고하지 않는다.

## 11. 미실시·제한·다음 권고

80쪽 이상 본평가, 독립 평가자의 정답 검수, 손글씨/세로쓰기/업무 서식 대표성, 복잡한 PDF 이미지 반복/클리핑, 전체 프로세스 메모리·p95·100쪽 스트레스, 모델 조합 비교/정확도 최적화, PaddleOCR, 실제 사건, 법률 엔진·단계 C·업무 배포는 미실시다. 10개 가공 표본으로 일반 OCR 성능 합격을 선언하지 않는다.

다음에는 업무 PC/Edge/loopback 허용 여부를 먼저 확인하고, 별도 승인된 범위에서 표본 대표성과 이름·한자 오류를 평가하는 것이 필요하다. 확대 본평가·Paddle 통합·단계 C·법률 활성화·실제 사건·업무 설치는 추가 승인 대상이며 자동 시작하지 않았다.

## 12. 저장·push

node_modules, vendor/model 본체, 브라우저 캐시, .cache, 스크린샷 출력은 Git 제외. 원본 가공 PNG와 소형 PDF·정답·스크립트·manifest·측정 JSON만 보존한다. 작업 중 별도로 추가된 루트 PNG는 작업 범위 밖으로 취급하여 수정·커밋하지 않았다.

실행: \`GIT_TERMINAL_PROMPT=0 git push --dry-run origin HEAD:refs/heads/spike/offline-ocr\`. 종료 코드 128:

\`\`\`text
fatal: could not read Username for 'https://github.com': terminal prompts disabled
\`\`\`

터미널 push 인증이 준비되지 않아 실제 push **미실시**. 사용자 지시대로 로컬 커밋까지 완료하는 경로를 택했다. 토큰 탐색·채팅 비밀번호 요청·새 인증 권한 부여를 수행하지 않았다. PR·merge 없음.

## 부록: 과거 Cloud B0 실패 보고 원문

아래는 \`docs/stage-b0-report-20261018\` / \`0f41299c637b93d4bc5e1651f33195af591a8621\`의 과거 보고서다. 현재 로컬 결과와 별개이며 원문을 삭제하거나 성공으로 바꾸지 않았다.

<details>
<summary>과거 Cloud B0 FAIL 보고서 펼치기</summary>

${cloud}
</details>
`;
await writeFile(repo+'docs/inheritance/STAGE_B_REPORT.md',report);
console.log('Wrote local B1 report with unchanged historical Cloud report appendix.');
