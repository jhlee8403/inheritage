// Deliberately small, independent script: it must run even if a later payload
// cannot be parsed. No vendor code, dynamic evaluation, or calculation is here.
(function () {
  'use strict';
  var records = {
    c1: {state: 'NOT_STARTED', stage: 'C1_SCRIPT', error: null},
    pdf: {state: 'NOT_STARTED', stage: 'PDF_PAYLOAD', error: null}
  };
  var timers = {};
  function canvasAvailable() { try { return !!document.createElement('canvas').getContext('2d'); } catch (error) { return false; } }
  function capabilities() {
    return {
      textDecoder: typeof window.TextDecoder === 'function',
      textEncoder: typeof window.TextEncoder === 'function',
      promiseWithResolvers: typeof Promise.withResolvers === 'function',
      promiseTry: typeof Promise.try === 'function',
      mapGetOrInsertComputed: typeof Map.prototype.getOrInsertComputed === 'function',
      urlParse: typeof URL.parse === 'function',
      uint8ToHex: typeof Uint8Array.prototype.toHex === 'function',
      uint8FromBase64: typeof Uint8Array.fromBase64 === 'function',
      mathSumPrecise: typeof Math.sumPrecise === 'function',
      workerAPI: typeof Worker === 'function',
      wasmAPI: typeof WebAssembly === 'object',
      sha256API: !!(window.crypto && window.crypto.subtle && window.crypto.subtle.digest),
      fileAPI: typeof File === 'function' && typeof File.prototype.arrayBuffer === 'function',
      canvas2d: canvasAvailable(),
      secureContext: window.isSecureContext === true
    };
  }
  var environment = {userAgent: navigator.userAgent, protocol: location.protocol,
    capabilities: capabilities(), note: 'API presence is not worker/WASM policy success. Windows cause unconfirmed.'};
  function paint(area) {
    var r = records[area], node = document.getElementById(area + '-init-status');
    if (node) node.textContent = area.toUpperCase() + ' 초기화: ' + r.state + ' · ' + r.stage + (r.error ? ' · ' + r.error : '');
    var detail = document.getElementById(area + '-init-details');
    if (detail) detail.textContent = JSON.stringify({area: area, initialization: r, environment: environment}, null, 2);
    if (area === 'pdf' && r.state !== 'READY') {
      document.getElementById('pdf-details').textContent = JSON.stringify({initialization: r, environment: environment}, null, 2);
      if (r.state === 'FAILED' || r.state === 'TIMEOUT') {
        document.getElementById('pdf-status').textContent = 'INIT_ERROR · ' + r.stage + ' · ' + (r.error || '원인 미확정');
        var ids = ['pdf-file', 'pdf-prev', 'pdf-next', 'pdf-ocr', 'pdf-edited'];
        for (var i = 0; i < ids.length; i++) document.getElementById(ids[i]).disabled = true;
      }
    }
  }
  function fail(area, error) {
    var r = records[area];
    if (r.state === 'FAILED' || r.state === 'TIMEOUT') return;
    clearTimeout(timers[area]);
    r.state = 'FAILED'; r.error = String(error && (error.stack || error.message) || error || '원인 미확정');
    paint(area);
  }
  window.__liteInitialization = {
    start: function (area) {
      var r = records[area]; if (r.state === 'FAILED' || r.state === 'TIMEOUT') return;
      r.state = 'RUNNING'; paint(area);
    },
    stage: function (area, name) { records[area].stage = name; paint(area); },
    ready: function (area) {
      var r = records[area]; if (r.state === 'FAILED' || r.state === 'TIMEOUT') return;
      clearTimeout(timers[area]); r.state = 'READY'; paint(area);
      if (area === 'pdf') document.getElementById('pdf-file').disabled = false;
    },
    fail: fail
  };
  // Runtime and parse errors in later scripts reach this already-installed handler.
  window.addEventListener('error', function (event) {
    var area = records.c1.state === 'RUNNING' ? 'c1' : records.pdf.state === 'RUNNING' ? 'pdf' : null;
    if (area) fail(area, event.error || event.message || '원인 미확정');
  });
  window.addEventListener('securitypolicyviolation', function (event) {
    if (event.violatedDirective.indexOf('script-src') !== 0) return;
    ['c1', 'pdf'].forEach(function (area) {
      if (records[area].state !== 'READY') fail(area, 'CSP_SCRIPT_BLOCKED · 스크립트 해시/전달 파일을 확인하세요.');
    });
  });
  ['c1', 'pdf'].forEach(function (area) {
    timers[area] = setTimeout(function () {
      var r = records[area];
      if (r.state === 'READY' || r.state === 'FAILED') return;
      r.state = 'TIMEOUT'; r.error = '초기화 완료 신호 없음 · 구문/CSP/API/실행 중단 원인 미확정'; paint(area);
    }, 10000);
    paint(area);
  });
}());
