import * as pdfjs from '../public/vendor/pdfjs/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../public/vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;
const local = relative => new URL(relative, import.meta.url).href;
const elapsed = start => Math.round((performance.now() - start) * 10) / 10;
const area = r => Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1]);
const overlap = (a, b) => area([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]);
const bounds = points => [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
const quad = r => [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
function deadline(promise, ms, label) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: ${ms / 1000}초 제한 초과`)), ms); })]).finally(() => clearTimeout(timer));
}

export class PdfOcrSession {
  constructor(progress) { this.progress = progress; this.pages = new Map(); this.worker = null; this.workerStarts = []; }
  async open(bytes) {
    if (this.loadingTask) await this.loadingTask.destroy();
    this.pdf = null;
    this.pages.clear();
    this.loadingTask = pdfjs.getDocument({
      data: bytes, cMapUrl: local('../public/vendor/pdfjs/cmaps/'), cMapPacked: true,
      standardFontDataUrl: local('../public/vendor/pdfjs/standard_fonts/'),
      wasmUrl: local('../public/vendor/pdfjs/wasm/'), isEvalSupported: false,
    });
    this.pdf = await this.loadingTask.promise;
    return this.pdf.numPages;
  }
  async render(pageNumber, canvas, extraRotation = 0) {
    const start = performance.now();
    const page = await this.pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2, rotation: (page.rotate + extraRotation) % 360 });
    if (viewport.width * viewport.height > 16_000_000) throw new Error('실험 최대 렌더 크기(1600만 화소)를 초과했습니다.');
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const content = await page.getTextContent();
    const direct = content.items.filter(x => x.str?.trim()).map((item, index) => {
      const t = pdfjs.Util.transform(viewport.transform, item.transform);
      const h = Math.hypot(t[2], t[3]);
      const angle = Math.atan2(t[1], t[0]);
      const w = item.width * viewport.scale;
      const ux = Math.cos(angle), uy = Math.sin(angle);
      const vx = -uy, vy = ux;
      const points = [[t[4], t[5]], [t[4] + ux*w, t[5] + uy*w], [t[4] + ux*w-vx*h, t[5]+uy*w-vy*h], [t[4]-vx*h, t[5]-vy*h]];
      return { id: `direct-${index}`, source: 'PDF_TEXT', text: item.str, bbox: bounds(points), pdfQuad: points.map(p => viewport.convertToPdfPoint(...p)), status: 'NEEDS_REVIEW' };
    });
    const ops = await page.getOperatorList();
    let matrix = [1, 0, 0, 1, 0, 0]; const stack = []; const images = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const op = ops.fnArray[i], args = ops.argsArray[i];
      if (op === pdfjs.OPS.save) stack.push([...matrix]);
      else if (op === pdfjs.OPS.restore) matrix = stack.pop() || [1, 0, 0, 1, 0, 0];
      else if (op === pdfjs.OPS.transform) matrix = pdfjs.Util.transform(matrix, args);
      else if ([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintImageMaskXObject].includes(op)) {
        const transform = pdfjs.Util.transform(viewport.transform, matrix);
        // PDF.js 6 mutates the point and returns void (not the transformed array).
        const pixels = quad([0, 0, 1, 1]).map(p => { pdfjs.Util.applyTransform(p, transform); return p; });
        const b = bounds(pixels);
        const clipped = [Math.max(0,b[0]), Math.max(0,b[1]), Math.min(canvas.width,b[2]), Math.min(canvas.height,b[3])];
        if (area(clipped) > canvas.width * canvas.height * .015) images.push(clipped);
      }
    }
    const previous = this.pages.get(pageNumber);
    const record = previous || { page: pageNumber, attempts: [], edits: [], candidates: [], text: '', state: 'READY' };
    Object.assign(record, { viewport, pdfView: page.view, rotation: viewport.rotation, extraRotation, direct, images, renderMs: elapsed(start) });
    if (previous) record.candidates.forEach(c => { c.bbox = bounds(c.pdfQuad.map(p => viewport.convertToViewportPoint(...p))); });
    this.pages.set(pageNumber, record);
    page.cleanup();
    return record;
  }
  async getWorker() {
    if (this.worker) return { worker: this.worker, startupMs: 0 };
    const start = performance.now();
    // Fail promptly with the missing local path instead of waiting for a worker init timeout.
    for (const relative of ['../public/vendor/tesseract/worker.min.js',
      '../public/vendor/tesseract-core/tesseract-core-simd-lstm.wasm.js',
      '../public/vendor/tesseract-core/tesseract-core-simd-lstm.wasm',
      '../public/models/kor.traineddata', '../public/models/eng.traineddata', '../public/models/chi_tra.traineddata']) {
      const response = await fetch(local(relative), { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`로컬 OCR 자원 확인 실패: ${relative} (HTTP ${response.status})`);
    }
    const pending = Tesseract.createWorker('kor+eng+chi_tra', 1, {
      workerPath: local('../public/vendor/tesseract/worker.min.js'),
      corePath: local('../public/vendor/tesseract-core/'),
      langPath: local('../public/models/'), gzip: false, cacheMethod: 'none', workerBlobURL: false,
      logger: message => this.progress?.(message.status, message.progress), errorHandler: () => {},
    });
    try {
      this.worker = await deadline(pending, 45000, '로컬 OCR 자원 초기화');
      await this.worker.setParameters({ tessedit_pageseg_mode: '3', preserve_interword_spaces: '1', user_defined_dpi: '144' });
    } catch (error) {
      pending.then(w => w.terminate()).catch(() => {});
      throw error;
    }
    const startupMs = elapsed(start);
    this.workerStarts.push(startupMs);
    return { worker: this.worker, startupMs };
  }
  async recognize(canvas, rect, record) {
    const crop = document.createElement('canvas');
    const r = [Math.floor(rect[0]), Math.floor(rect[1]), Math.ceil(rect[2]), Math.ceil(rect[3])];
    crop.width = r[2] - r[0]; crop.height = r[3] - r[1];
    if (crop.width < 5 || crop.height < 5) throw new Error('OCR 영역이 너무 작습니다.');
    crop.getContext('2d').drawImage(canvas, r[0], r[1], crop.width, crop.height, 0, 0, crop.width, crop.height);
    const start = performance.now();
    const { worker, startupMs } = await this.getWorker();
    try {
      const { data } = await deadline(worker.recognize(crop, {}, { text: true, blocks: true }), 90000, 'OCR');
      const candidates = [];
      for (const block of data.blocks || []) for (const paragraph of block.paragraphs || []) for (const line of paragraph.lines || []) {
        const b = line.bbox;
        const bbox = [b.x0 + r[0], b.y0 + r[1], b.x1 + r[0], b.y1 + r[1]];
        candidates.push({ id: crypto.randomUUID(), source: 'OCR', text: line.text.trim(), bbox,
          pdfQuad: quad(bbox).map(p => record.viewport.convertToPdfPoint(...p)), confidence: line.confidence, status: 'NEEDS_REVIEW' });
      }
      if (!candidates.length && data.text.trim()) candidates.push({ id: crypto.randomUUID(), source: 'OCR', text: data.text.trim(), bbox: r, pdfQuad: quad(r).map(p => record.viewport.convertToPdfPoint(...p)), status: 'NEEDS_REVIEW' });
      return { candidates, rawText: data.text, confidence: data.confidence, rect: r, startupMs, totalMs: elapsed(start) };
    } catch (error) {
      await this.worker?.terminate(); this.worker = null; throw error;
    } finally { crop.width = crop.height = 0; }
  }
  async process(pageNumber, canvas, mode = 'auto', rect = null) {
    const record = this.pages.get(pageNumber);
    const start = performance.now();
    const attempt = { mode, rect, rotation: record.rotation, startedAt: new Date().toISOString(), ocr: [] };
    record.attempts.push(attempt); record.state = 'PROCESSING';
    // Keep prior text/edits intact until a replacement succeeds.
    let candidates = mode === 'region' ? [...record.candidates] : [...record.direct];
    let regions;
    if (mode === 'region') regions = [rect];
    else if (mode === 'full' || !record.direct.length) { regions = [[0, 0, canvas.width, canvas.height]]; candidates = []; }
    else {
      // Heuristic, not a completeness claim: image rectangles with little text coverage.
      regions = record.images.filter(r => record.direct.reduce((sum, t) => sum + overlap(r, t.bbox), 0) / area(r) < .12);
      regions = regions.filter((r, i) => !regions.slice(0, i).some(other => overlap(r, other) / area(r) > .95));
    }
    try {
      for (const region of regions) {
        const result = await this.recognize(canvas, region, record);
        candidates = candidates.filter(c => overlap(c.bbox, region) / Math.max(1, area(c.bbox)) < .5);
        candidates.push(...result.candidates);
        attempt.ocr.push(result);
      }
      candidates.sort((a, b) => Math.abs(a.bbox[1]-b.bbox[1]) > 10 ? a.bbox[1]-b.bbox[1] : a.bbox[0]-b.bbox[0]);
      record.candidates = candidates;
      record.text = candidates.map(c => c.text).join('\n');
      record.state = 'NEEDS_REVIEW'; record.error = null;
      attempt.ok = true; attempt.text = record.text; attempt.directText = record.direct.map(c => c.text).join('\n');
      attempt.ocrRegions = regions; attempt.totalMs = elapsed(start);
      return record;
    } catch (error) {
      record.state = 'FAILED'; record.error = String(error.message || error);
      attempt.ok = false; attempt.error = record.error; attempt.stack = error.stack || null; attempt.totalMs = elapsed(start);
      throw error;
    }
  }
  edit(pageNumber, text) {
    const r = this.pages.get(pageNumber);
    r.edits.push({ before: r.text, after: text, at: new Date().toISOString(), source: 'MANUAL', status: 'NEEDS_REVIEW' });
    r.text = text;
  }
  snapshot() {
    return { workerStarts: this.workerStarts, pages: [...this.pages.values()].map(({ viewport, ...r }) => ({ ...r, viewportTransform: viewport.transform, viewportSize: [viewport.width, viewport.height] })) };
  }
}
