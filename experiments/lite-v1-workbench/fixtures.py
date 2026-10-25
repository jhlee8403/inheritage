"""Only invented test material. Existing immutable OCR fixtures are read, never changed."""
from pathlib import Path
from io import BytesIO
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
import hashlib, json
root=Path(__file__).resolve().parent
out=root/'generated/fixtures'
out.mkdir(parents=True,exist_ok=True)
source=root.parent/'offline-ocr/fixtures'
buffer=BytesIO()
c=canvas.Canvas(buffer,pagesize=(595,842),invariant=1)
c.drawString(35,780,'SYNTHETIC PAGE THREE - NO REAL PERSON')
c.drawString(35,740,'<img src=x onerror="globalThis.__pdfInjected=1">')
c.drawString(35,710,'<script>globalThis.__pdfInjected=2</script>')
c.save(); buffer.seek(0)
w=PdfWriter()
w.add_page(PdfReader(source/'text-only.pdf').pages[0])
w.add_page(PdfReader(source/'scan-only.pdf').pages[0])
w.add_page(PdfReader(buffer).pages[0])
w.write(out/'three-pages.pdf')
w=PdfWriter()
for i in range(11):w.add_blank_page(width=595,height=842)
w.write(out/'too-many.pdf')
w=PdfWriter();w.add_blank_page(width=2000,height=2000);w.write(out/'too-large-page.pdf')
records=[]
for name in ['three-pages.pdf','too-many.pdf','too-large-page.pdf']:
 data=(out/name).read_bytes();reader=PdfReader(BytesIO(data));records.append({'name':name,'bytes':len(data),'pages':len(reader.pages),'sha256':hashlib.sha256(data).hexdigest()})
(root/'results/fixtures.json').write_text(json.dumps({'synthetic':True,'files':records},indent=2)+'\n')
print(json.dumps(records))
