"""Ten unique, entirely invented pages. No source case material or hidden OCR text."""
import hashlib
import io
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter
import reportlab, PIL, pypdf

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'fixtures'
OUT.mkdir(exist_ok=True)
FONT = ROOT / '.cache/fonts/NotoSansKR.ttf'
pdfmetrics.registerFont(TTFont('FixtureKR', str(FONT)))
W, H = 595, 842
specs = [
    ('text', '가온새', '2001-02-03', '자녀', '12345678', ''),
    ('scan', '누리솔', '2002-03-04', '배우자', '23456789', ''),
    ('text-hanja', '다온별', '2003-04-05', '부모', '34567890', '金明秀'),
    ('title-text-image-body', '라온빛', '2004-05-06', '형제자매', '45678901', ''),
    ('dense-numbers', '마루온', '2005-06-07', '자녀', '0123456789 9876543210 1029384756', ''),
    ('hanja', '바다결', '2006-07-08', '배우자', '56789012', '李春花 金明秀'),
    ('rotate90', '새봄결', '2007-08-09', '부모', '67890123', ''),
    ('skew3', '아라봄', '2008-09-10', '형제자매', '78901234', ''),
    ('low-resolution', '자온길', '2009-10-11', '자녀', '89012345', ''),
    ('blur-overlap', '차오름', '2010-11-12', '배우자', '90123456', '金明秀'),
]
truth = []
c = canvas.Canvas(str(OUT / 'suite.pdf'), pagesize=(W, H), invariant=1, pageCompression=1)
c.setTitle('Entirely synthetic OCR fixtures - 10 unique pages')
for i, (kind, name, date, relation, number, hanja) in enumerate(specs, 1):
    title = f'SYNTHETIC OCR TEST {i:02d}'
    lines = [f'성명: {name}', f'날짜: {date}', f'관계: {relation}', f'번호: {number}']
    if hanja:
        lines.append(f'한자: {hanja}')
    lines.append('완전 가공 자료 / 실제 사건 아님')
    ys = [170 + n * 52 for n in range(len(lines))]
    if kind in ('text', 'text-hanja'):
        c.setFont('FixtureKR', 20)
        c.drawString(48, H - 80, title)
        for line, y in zip(lines, ys):
            c.drawString(48, H - y, line)
    else:
        scale = 2
        im = Image.new('RGB', (W * scale, H * scale), 'white')
        d = ImageDraw.Draw(im)
        font = ImageFont.truetype(str(FONT), 20 * scale)
        if kind != 'title-text-image-body':
            d.text((48 * scale, 80 * scale), title, font=font, fill='black', anchor='ls')
        for line, y in zip(lines, ys):
            d.text((48 * scale, y * scale), line, font=font, fill='black', anchor='ls')
        if kind == 'skew3':
            im = im.rotate(3, resample=Image.Resampling.BICUBIC, fillcolor='white')
        if kind == 'low-resolution':
            im = im.resize((496, 702), Image.Resampling.BILINEAR)
        if kind == 'blur-overlap':
            d.line((65, 320, 1070, 338), fill=(100, 100, 100), width=3)
            d.ellipse((790, 370, 1010, 590), outline=(170, 70, 70), width=8)
            im = im.filter(ImageFilter.GaussianBlur(1.5))
        if kind == 'title-text-image-body':
            # Draw only the body image rectangle, leaving title as genuine text.
            cropped = im.crop((0, 115 * scale, W * scale, H * scale))
            c.drawImage(ImageReader(cropped), 0, 0, width=W, height=H - 115)
            c.setFont('FixtureKR', 20)
            c.drawString(48, H - 80, title)
        else:
            c.drawImage(ImageReader(im), 0, 0, width=W, height=H)
    c.showPage()
    truth.append({
        'page': i, 'kind': kind, 'title': title, 'lines': lines,
        'expectedText': '\n'.join([title, *lines]),
        'fields': {'name': name, 'date': date, 'relationship': relation, 'number': number, 'hanja': hanja},
        'pdfSize': [W, H], 'canonicalBodyRectTopLeft': [35, 115, 525, 430],
        'sourceDpi': 60 if kind == 'low-resolution' else (None if kind.startswith('text') else 144),
        'pdfRotation': 90 if kind == 'rotate90' else 0,
        'legalStatus': 'PENDING',
    })
c.save()
reader = PdfReader(OUT / 'suite.pdf')
reader.pages[6].rotate(90)
writer = PdfWriter()
writer.append_pages_from_reader(reader)
with (OUT / 'suite.pdf').open('wb') as f:
    writer.write(f)
for filename, page_index in [('text-only.pdf', 0), ('scan-only.pdf', 1)]:
    subset = PdfWriter()
    subset.add_page(reader.pages[page_index])
    with (OUT / filename).open('wb') as f:
        subset.write(f)
(OUT / 'invalid-pdf.bin').write_bytes(b'This is deliberately not a PDF. Synthetic negative test.\n')
reader = PdfReader(OUT / 'suite.pdf')
structural = []
for page, expected in zip(reader.pages, truth):
    extracted = page.extract_text().strip()
    image_only = expected['kind'] not in ('text', 'text-hanja', 'title-text-image-body')
    if image_only:
        assert not extracted, (expected['page'], extracted)
    if expected['kind'] == 'title-text-image-body':
        assert extracted == expected['title'], extracted
    structural.append({'page': expected['page'], 'pypdfText': extracted, 'imageOnly': image_only})
(OUT / 'truth.json').write_text(json.dumps({'origin': 'All names, dates, relationships and numbers invented for this test. No legal conclusions.', 'uniquePages': 10, 'pages': truth}, ensure_ascii=False, indent=2) + '\n')
(ROOT / 'results/fixture-structure.json').write_text(json.dumps(structural, ensure_ascii=False, indent=2) + '\n')
files = []
for p in sorted(OUT.glob('*.pdf')):
    data = p.read_bytes()
    files.append({'path': f'fixtures/{p.name}', 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
(ROOT / 'results/fixture-manifest.json').write_text(json.dumps({'files': files, 'generator': {'reportlab': reportlab.Version, 'Pillow': PIL.__version__, 'pypdf': pypdf.__version__}, 'note': 'text-only and scan-only are subsets, not additional unique samples'}, indent=2) + '\n')
print('Generated 10 unique synthetic pages; 7 image-only pages have no extractable text.')
