from pathlib import Path
import importlib.util, json, zipfile, xml.etree.ElementTree as ET
from pypdf import PdfReader
root=Path(r'F:\coding_projects\ai-tour-guide-device')
print('MODULES', {m:bool(importlib.util.find_spec(m)) for m in ['numpy','PIL','pypdfium2','fitz','pdfplumber','trimesh']})
with zipfile.ZipFile(root/'docs/meetings/第一次南客松项目筹备会会议纪要.docx') as z:
 tree=ET.fromstring(z.read('word/document.xml'))
 print('MEETING\n'+'\n'.join(''.join(p.itertext()) for p in tree.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p')))
r=PdfReader(root/'stopwatch-nav/reference/StopWatch.pdf')
for i,p in enumerate(r.pages):
 print(f'\nPDF PAGE {i+1}\n{p.extract_text()}')
print('\nOLD HANDOFF\n'+(root/'modeling/v00/modeling-handoff.md').read_text(encoding='utf8'))

