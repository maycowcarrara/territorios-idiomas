import json,re
from pathlib import Path
from pypdf import PdfReader
for name in ['curto','paginado']:
 d=json.loads(Path(f'artifacts/cartao-pdf/{name}.json').read_text(encoding='utf-8'))
 r=PdfReader(f'artifacts/cartao-pdf/{name}.pdf')
 text=' '.join(p.extract_text() for p in r.pages)
 clean=lambda s: re.sub(r'\s+','',s)
 for endereco in d['enderecosImpressos']:
  assert clean(endereco) in clean(text), endereco
 assert 'São Bento do Sul' not in text
 for p in r.pages:
  assert abs(float(p.mediabox.width)*25.4/72-93)<0.001
  assert abs(float(p.mediabox.height)*25.4/72-145)<0.001
  assert 'Esquema sintético local' in p.extract_text()
 print(name, len(r.pages), 'paginas; medidas, acentos, creditos e enderecos completos OK')
