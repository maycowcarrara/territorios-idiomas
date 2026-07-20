import zipfile
import json
import re
import os
from xml.etree import ElementTree as ET

# --- 1. CONFIGURAÇÕES ---
FILES = {
    "poligonos": "poligonos.kmz",
    "quadras": "quadras.kmz",
    "referencias": "referencias.kmz",
    "condominios": "condominios.kmz"
}
ARQUIVO_SAIDA = "mapa.json"
NS = {'kml': 'http://www.opengis.net/kml/2.2'}

# --- 2. TABELA DE CONVERSÃO (REGRA DE OURO) ---
# Mapeia o nome do arquivo da imagem para o número real que ela representa
ICON_MAPPING = {
    'icon-1.png': '1',
    'icon-2.png': '3',
    'icon-3.png': '5',
    'icon-4.png': '2',
    'icon-5.png': '4',
    'icon-6.png': '6',
    'icon-7.png': '8',
    'icon-8.png': '7',
    'icon-9.png': '9',
    'icon-10.png': '13',
    'icon-11.png': '12',
    'icon-12.png': '11',
    'icon-13.png': '10',
    'icon-14.png': '17',
    'icon-15.png': '📍', # Pin Azul (Não é número)
    'icon-16.png': '16',
    'icon-17.png': '14',
    'icon-18.png': '15',
    'icon-19.png': '18',
    'icon-20.png': '19',
    'icon-21.png': '21',
    'icon-22.png': '22',
    'icon-23.png': '20',
    'icon-24.png': '23'
}

print(f"--- INICIANDO PROCESSAMENTO (COM REGRA DE ÍCONES) ---")

def extrair_kml(kmz_path):
    if not os.path.exists(kmz_path):
        print(f"⚠️ {kmz_path} não encontrado.")
        return None
    try:
        with zipfile.ZipFile(kmz_path, 'r') as z:
            kml_name = [f for f in z.namelist() if f.endswith('.kml')][0]
            return ET.fromstring(z.read(kml_name))
    except Exception as e:
        print(f"❌ Erro: {e}")
        return None

def resolver_numero_pelo_icone(placemark, style_map, icon_map):
    """
    Descobre o nome do arquivo de imagem usado e aplica a tabela ICON_MAPPING.
    """
    style_url = placemark.find('kml:styleUrl', NS)
    if style_url is not None:
        sid = style_url.text.strip().lstrip('#')
        
        # Resolve StyleMap -> Style
        if sid in style_map: 
            sid = style_map[sid]
        
        # Pega o caminho da imagem (ex: images/icon-4.png)
        icon_path = icon_map.get(sid, "")
        
        # Extrai apenas o nome do arquivo (icon-4.png)
        filename = icon_path.split('/')[-1]
        
        # Aplica a tabela de conversão do usuário
        if filename in ICON_MAPPING:
            return ICON_MAPPING[filename]
            
    # Fallback: Se não tiver ícone mapeado, tenta ler do nome original
    nome = placemark.find('kml:name', NS).text or ""
    return nome

def carregar_dados():
    poligonos = []
    todos_pontos = []

    for tipo, path in FILES.items():
        print(f"📖 Lendo {path}...")
        root = extrair_kml(path)
        if root is None: continue

        # Mapeia Estilos e Ícones
        icon_map = {s.get('id'): (s.find('.//kml:Icon/kml:href', NS).text or "") 
                   for s in root.findall('.//kml:Style', NS) if s.find('.//kml:Icon/kml:href', NS) is not None}
        
        style_map = {sm.get('id'): sm.find(".//kml:Pair[kml:key='normal']/kml:styleUrl", NS).text.strip().lstrip('#') 
                    for sm in root.findall('.//kml:StyleMap', NS) if sm.find(".//kml:Pair[kml:key='normal']/kml:styleUrl", NS) is not None}

        for pm in root.findall('.//kml:Placemark', NS):
            nome_original = pm.find('kml:name', NS).text or ""
            
            # POLÍGONOS
            poly = pm.find('.//kml:Polygon', NS)
            if poly is not None:
                coords_text = poly.find('.//kml:coordinates', NS).text
                coords = [tuple(map(float, c.split(',')[:2])) for c in coords_text.split()]
                poligonos.append({'nome': nome_original, 'coords': coords, 'pontos_dentro': []})
                continue

            # PONTOS
            point = pm.find('.//kml:Point', NS)
            if point is not None:
                c = point.find('.//kml:coordinates', NS).text.strip().split(',')
                lng, lat = float(c[0]), float(c[1])
                
                final_name = nome_original
                tipo_pt = 'referencia'
                
                if tipo == "quadras":
                    # Aplica a Lógica de Ícones
                    final_name = resolver_numero_pelo_icone(pm, style_map, icon_map)
                    
                    # Se o nome virou "📍", tratamos como referência ou mantemos quadra?
                    # Assumindo que se está no arquivo de quadras, é quadra, mesmo que seja pin.
                    tipo_pt = 'quadra'
                
                elif tipo == "condominios":
                    tipo_pt = 'condominio'

                todos_pontos.append({
                    'nome': final_name, 'lat': lat, 'lng': lng, 'tipo': tipo_pt
                })

    return poligonos, todos_pontos

def processar():
    poligonos, pontos = carregar_dados()
    
    # Algoritmo Geométrico (Ray Casting)
    def ponto_no_poly(lng, lat, coords):
        n = len(coords)
        inside = False
        p1x, p1y = coords[0]
        for i in range(n + 1):
            p2x, p2y = coords[i % n]
            if lat > min(p1y, p2y) and lat <= max(p1y, p2y) and lng <= max(p1x, p2x):
                if p1y != p2y: xinters = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                if p1x == p2x or lng <= xinters: inside = not inside
            p1x, p1y = p2x, p2y
        return inside

    print(f"\n⚙️ Distribuindo pontos...")
    for p in pontos:
        for poly in poligonos:
            if ponto_no_poly(p['lng'], p['lat'], poly['coords']):
                poly['pontos_dentro'].append(p)
                break

    # --- ORDENAÇÃO E EXPORTAÇÃO ---
    features = []
    
    def sort_key(p):
        # Ordena números (1, 2, 3...) primeiro, texto depois
        try:
            return (0, int(p['nome'])) 
        except ValueError:
            return (1, p['nome'])

    for i, poly in enumerate(poligonos):
        poly['pontos_dentro'].sort(key=sort_key)
        
        # Debug T79
        if "T79" in poly['nome']:
            qs = [p['nome'] for p in poly['pontos_dentro'] if p['tipo']=='quadra']
            print(f"🔎 T79 FINAL: {qs}")

        features.append({
            "type": "Feature",
            "properties": { "id": i + 1, "nome": poly['nome'], "pontos": poly['pontos_dentro'] },
            "geometry": { "type": "Polygon", "coordinates": [[list(c) for c in poly['coords']]] }
        })

    with open(ARQUIVO_SAIDA, 'w', encoding='utf-8') as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, indent=2, ensure_ascii=False)
    
    print(f"\n🚀 SUCESSO! {ARQUIVO_SAIDA} gerado com mapeamento correto.")

if __name__ == "__main__":
    processar()