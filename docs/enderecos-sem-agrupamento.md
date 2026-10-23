# Endereços sem agrupamento por zoom

## Ajuste local — 23/10/2026

A pedido do usuário, a camada de endereços do mapa administrativo volta a desenhar um marcador por endereço na coordenada cadastrada, em qualquer nível de zoom. Rótulos próximos ou coincidentes podem se sobrepor naturalmente. A camada não calcula grupos, balões de quantidade, deslocamento de posição nem aproximação automática por clique em agrupamento.

Retirada a chamada a `clusterEnderecos` e a renderização de `EnderecoClusterMarker` de `EnderecoMarkersLayer`, em `src/Mapa.jsx`. Mantidos os validadores de coordenadas para rejeitar valores nulos, vazios, não numéricos ou fora dos limites geográficos. A camada não depende mais do zoom para decidir quais marcadores criar. Marcadores individuais mantêm seleção, edição, compartilhamento e marcação de visita. O selo individual que identifica o território de um endereço permanece; ele não é uma contagem de agrupamento.

O ajuste vale também quando a mesma camada exibe os endereços de um território em foco. Não altera cadastros, coordenadas persistidas, marcadores dos territórios, consulta pública, mapa/PDF dos cartões ou o trabalho local de territórios vazios.

Verificação: 357 testes em 25 arquivos, lint e build aprovados. Conferida a ausência de chamadas ao agrupador e de posição alternativa no caminho de renderização da camada. Sem validação visual desta mudança no navegador/dispositivo. Os módulos antigos de agrupamento permanecem no código-fonte, mas não são importados/renderizados pelo mapa; apenas os validadores do utilitário são reutilizados.

Alteração somente local, sem publicação, mudança de versão, escrita em dados reais, commit ou push.

## Publicação autorizada — 23/10/2026

Após os ajustes de territórios vazios e a retirada do agrupamento, o usuário autorizou: “blz, pode publicar então”. Executado `npm.cmd run web:deploy`, publicando frontend/PWA/OTA **3.9.389** em https://territ-es-sbs.web.app, projeto `territ-es-sul-sbs`, alvo `hosting:app`. Guard de projeto e build aprovados; lockfile alinhado à versão.

Verificação remota às 14:00 (America/Sao_Paulo), por `node scripts/verificar-publicacao-cartao.mjs`: versão pública e manifesto OTA 3.9.389; 34 arquivos HTML/SW/assets iguais ao build por SHA-256; ZIP OTA igual ao local e ao hash `9fb7df072abf4512485e63f8730af207cc0c789d3d2d76ae6b3d57542ef16b06`. API existente respondeu 403 à credencial inválida, com CORS esperado e `no-store`. Evidência: `artifacts/release/verification-3.9.389.json`.

Incluídos também os ajustes de `docs/territorios-sem-enderecos.md`. Worker, Rules e índices não precisaram de publicação. Sem alteração de dados reais, migração, mensagens, commit ou push. A conferência remota comprova a distribuição dos arquivos; validação visual do zoom no mapa real e confirmação física continuam pendentes.
