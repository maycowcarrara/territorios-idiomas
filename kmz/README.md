# Conversao de KMZs

Esta pasta guarda os fluxos auxiliares de conversao de mapas para o formato GeoJSON usado pelo app.

## Palmas

O fluxo antigo de Palmas continua em `conversor.py`. Ele espera arquivos separados para poligonos, quadras, referencias e condominios:

```powershell
cd kmz
python conversor.py
```

## General Carneiro

O fluxo de General Carneiro usa `conversor_general.py`.

Nesse caso, cada arquivo `.kmz` representa um territorio, e cada poligono dentro do KMZ representa uma quadra. O nome do KMZ vira o nome do territorio, e o numero da quadra e extraido do nome do poligono.

### Pre-requisito

O conversor usa `Shapely` para unir e recortar os poligonos:

```powershell
python -m pip install shapely
```

### Entrada

Coloque todos os KMZs do General em:

```text
kmz/general/
```

Exemplo:

```text
kmz/general/C1 CENTRO.kmz
kmz/general/C2 SANTA RITA.kmz
kmz/general/C3 CAPAO BONITO.kmz
```

### Gerar o JSON

Na raiz do projeto, rode:

```powershell
python kmz\conversor_general.py kmz\general
```

Por padrao, a saida sera:

```text
public/mapa.general.json
```

Tambem e possivel escolher outro arquivo de saida:

```powershell
python kmz\conversor_general.py kmz\general --output public\mapa.general.json
```

### Como o conversor monta o territorio

1. Le todos os poligonos de quadras do KMZ.
2. Gera um ponto interno para cada quadra com `representative_point()`, evitando pins fora de quadras concavas.
3. Une os poligonos com `Shapely`.
4. Aplica fechamento morfologico com `buffer` para preencher ruas e espacos internos entre quadras do mesmo territorio.
5. Gera um unico `Polygon` para o app.
6. Aplica correcoes manuais conhecidas de divisa.

### Correcoes manuais atuais

As regras ficam em `TERRITORY_CLIP_RULES` dentro de `conversor_general.py`.

No par abaixo, o primeiro territorio e recortado pelo segundo; o segundo permanece intacto:

```text
C26 recorta por C25
C18 recorta por C19
C1 recorta por C3
C1 recorta por C4
```

Tambem existe uma posicao manual de rotulo:

```text
C7 GETULIO VARGAS: labelPosition perto/acima da quadra 2
```

### Validacao recomendada

Depois de gerar o JSON, confira:

```powershell
python -m json.tool public\mapa.general.json > $null
```

E rode o app em modo General:

```powershell
npm.cmd run dev:general
```

Conferir visualmente, principalmente:

```text
C1 / C3 / C4
C18 / C19
C25 / C26
C7 GETULIO VARGAS
```

## Bootstrap e deploy

`npm run deploy:general` nao cria nem atualiza documentos em `territorios` no Firestore. Ele faz build, live update bundle e deploy do projeto Firebase.

Quando o mapa de General for alterado e for necessario criar os documentos base dos territorios no Firestore, rode o bootstrap separadamente:

```powershell
npm run firestore:bootstrap:general -- --map ./public/mapa.general.json --seed-territories
```

Use o bootstrap com cuidado em ambiente ja em uso, porque ele atua nos documentos base da colecao `territorios`.
