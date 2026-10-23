import json,re,unicodedata,os
import pdfplumber
from pathlib import Path
from pypdf import PdfReader
output=Path(os.environ.get('CARTAO_OUTPUT_DIR','artifacts/cartao-pdf'))
for name in ['curto','seis','longo','paginado']:
 d=json.loads((output/f'{name}.json').read_text(encoding='utf-8'))
 r=PdfReader(output/f'{name}.pdf')
 assert len(r.pages)==1
 text=' '.join(p.extract_text() for p in r.pages)
 clean=lambda s: re.sub(r'\s+','',s)
 for endereco in d['enderecosImpressos']:
  assert clean(endereco) in clean(text), endereco
 for endereco in d['dados']['enderecos']:
  if endereco.get('observacao'):
   assert clean(endereco['observacao']) in clean(text), endereco['observacao']
 assert 'Obs.:' in text
 for label in ['Confirmado', 'Verificar', 'Estudo']:
  assert label in text
 assert text.count('São Bento do Sul')==1
 assert 'Bairro: Jardim' in text
 assert 'Leia o QR' not in text and 'Código de acesso:' not in text
 for p in r.pages:
  assert abs(float(p.mediabox.width)*25.4/72-93)<0.001
  assert abs(float(p.mediabox.height)*25.4/72-145)<0.001
  assert 'Esquema sintético local' in p.extract_text()
 print(name, len(r.pages), 'paginas; medidas, acentos, creditos e enderecos completos OK')
 with pdfplumber.open(output/f'{name}.pdf') as pdf:
  p=pdf.pages[0]
  addresses=[c for c in p.chars if c['top']>78*72/25.4 and c['top']<138*72/25.4]
  assert addresses and all(2.9*72/25.4<=c['x0'] and c['x1']<=90.1*72/25.4 for c in addresses)
  assert max(c['bottom'] for c in addresses)<139*72/25.4
  obs=p.search('Obs.:')[0]['chars']
  assert abs(obs[0]['size']/addresses[0]['size']-0.8)<0.001
  print(name, 'fonte da lista:',round(addresses[0]['size'],2),'pt; sem corte lateral ou no rodape')

with pdfplumber.open(output/'unicode.pdf') as pdf:
 assert len(pdf.pages)==1
 text=unicodedata.normalize('NFKC','\n'.join(p.extract_text() for p in pdf.pages))
 for expected in ['Русский','Українська','中文','日本語','한국어','E-7','7']:
  assert expected in text, expected
 assert any('\u0600' <= c <= '\u06ff' for c in text), 'Arabic glyphs missing'
 for p in pdf.pages:
  assert abs(float(p.width)*25.4/72-93)<0.001
  assert abs(float(p.height)*25.4/72-145)<0.001
 print('unicode: glifos incorporados, sete enderecos e medidas OK; formas arabes conferidas visualmente')
