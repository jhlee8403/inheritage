"""Losslessly wrap the existing ten PNGs. Never rotate, resize or enhance pixels."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
from pypdf.generic import ContentStream

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'fixtures/source-png'
SOURCE.mkdir(parents=True, exist_ok=True)
sha = lambda data: hashlib.sha256(data).hexdigest()
for i in range(1, 11):
    original = ROOT / f'.cache/render/page-{i:02d}.png'
    saved = SOURCE / f'page-{i:02d}.png'
    if not saved.exists():
        if not original.exists():
            raise FileNotFoundError(f'Missing preserved source PNG: {saved}')
        shutil.copy2(original, saved)
    if original.exists() and sha(original.read_bytes()) != sha(saved.read_bytes()):
        raise ValueError(f'Refusing to overwrite different source PNG: {saved}')
paths = [SOURCE / f'page-{i:02d}.png' for i in range(1, 11)]
target = ROOT / 'fixtures/synthetic-scan.pdf'
c = canvas.Canvas(str(target), invariant=1, pageCompression=1)
c.setTitle('Synthetic scan - preserved source PNG pages 01-10')
mapping = []
for i, p in enumerate(paths, 1):
    with Image.open(p) as im:
        w, h = im.size
        # A nominal 96 DPI changes only PDF point dimensions; no raster resampling.
        c.setPageSize((w * .75, h * .75))
        c.drawImage(ImageReader(im), 0, 0, width=w * .75, height=h * .75)
        c.showPage()
        mapping.append({'page': i, 'png': f'fixtures/source-png/{p.name}',
                        'originalPreviewPath': f'.cache/render/{p.name}',
                        'pngSha256': sha(p.read_bytes()), 'pngBytes': p.stat().st_size,
                        'pixels': [w, h], 'rgbPixelSha256': sha(im.convert('RGB').tobytes()),
                        'pdfPoints': [w * .75, h * .75], 'pdfRotation': 0})
c.save()
r = PdfReader(target)
assert len(r.pages) == 10
for p, m in zip(r.pages, mapping):
    assert not p.extract_text().strip(), f'Unexpected text on page {m["page"]}'
    assert not any(op in (b'Tj', b'TJ', b"'", b'"') for _, op in ContentStream(p.get_contents(), r).operations)
    assert len(p.images) == 1
    embedded = p.images[0].image.convert('RGB')
    assert sha(embedded.tobytes()) == m['rgbPixelSha256'], f'Pixels changed: {m["page"]}'
    m['embeddedPixelsIdentical'] = True
(ROOT / 'fixtures/synthetic-scan-map.json').write_text(json.dumps({
    'origin': 'Ten pre-existing Poppler page PNGs of our fully invented suite.pdf. These are derivatives of the same ten samples, not ten new independent samples.',
    'conversion': 'One PNG per page; lossless PDF image stream; no text operators, resampling, deskew, sharpening or rotation correction.',
    'pdf': 'fixtures/synthetic-scan.pdf', 'pdfSha256': sha(target.read_bytes()),
    'pdfBytes': target.stat().st_size, 'pageCount': len(r.pages), 'pages': mapping,
}, ensure_ascii=False, indent=2) + '\n')
print('10 PNGs preserved; PDF has 10 image-only pages; decoded RGB pixels identical on all 10.')
