# Paleta simplificada do mapa

## Alteração local — 23/10/2026

Autorização: “ok, concordo, pode fazer essa alteração”, após a proposta de revisão de cores, balões e contornos.

- Cinza: território disponível e endereço pendente. Azul: designado/em andamento, igual para administrador e publicador. Verde com ✓: território finalizado ou endereço visitado. Âmbar com ◷: todos os endereços marcados de uma designação ativa, aguardando confirmação de finalização.
- O estado arquivado prevalece sobre marcas/designações anteriores: cinza com borda tracejada; símbolo de arquivo no território. Os filtros e regras de visibilidade existentes são preservados.
- A cor do bairro deixa de substituir a situação do território. Bairros têm apenas contorno cinza fino e preenchimento transparente; a área interna continua recebendo cliques para abrir seus detalhes.
- Balões usam uma borda branca fina e sombra leve, sem halos permanentes. Quantidades/vínculos têm selos neutros. O ponto “Comigo” indica a própria designação, com texto no detalhe. Endereços selecionados/importados têm um anel escuro sem trocar a cor da situação.
- Áreas dos territórios têm preenchimento a 8% e contorno fino; o território focado tem contorno um pouco mais espesso. Antiguidade permanece em texto, sem escala de laranjas.
- Controles T/E e ações principais usam azul. Legenda acompanha as quatro situações. O mapa por link/QR também usa endereço pendente cinza e feito verde com ✓; nenhuma alteração de permissão ou dados foi feita.
- Estilos do mapa foram extraídos para `src/mapa/mapStyles.js`, compartilhados com a demonstração isolada em `artifacts/paleta-mapa/`.

## Verificação e limites

367 testes unitários em 27 arquivos aprovados, incluindo regressões de prioridade do arquivamento, designação removida com marcas anteriores, espera versus finalização e antiguidade sem mudança de cor. Lint e build aprovados.

A demonstração abriu no navegador local em `http://127.0.0.1:5183/artifacts/paleta-mapa/index.html`, com os cinco estados esperados na árvore acessível. O botão Selecionar visitado respondeu e passou a mostrar “Visitado e selecionado” e “Desmarcar seleção”. Dados inteiramente fictícios, sem tiles remotos nem banco. A captura de tela falhou na primeira tentativa; a validação no navegador foi interrompida e foi pedida ajuda ao usuário, conforme sua instrução AGENTS.md. Aparência visual, legenda aberta, mapa autenticado e dispositivo físico ainda não foram confirmados.

Sem publicação, mudança de versão, alteração de dados reais, commit ou push nesta rodada.

## Nova captura autorizada — 23/10/2026

O usuário autorizou expressamente outra tentativa de captura. A captura pela API do navegador funcionou. Conferidos visualmente os balões nas quatro cores e o arquivado tracejado, preenchimentos leves e contorno neutro do bairro. Selecionar visitado manteve o endereço verde com ✓ e acrescentou apenas o anel escuro. A legenda abriu com as quatro situações e fechou por Entendi. O viewport existente foi preservado.

Foi corrigida apenas a demonstração: as amostras dos balões QR deixaram de herdar a altura reservada ao mapa completo. A interface da aplicação não precisou de novos ajustes nesta conferência. Capturas: `artifacts/paleta-mapa/paleta-local.png` e `artifacts/paleta-mapa/legenda-local.png`. A prévia permanece disponível no navegador.

Esta verificação é local, com dados fictícios e estilos compartilhados; não confirma mapa autenticado ou aparelho físico. Sem publicação nesta etapa.

## Publicação autorizada — 23/10/2026

Autorização do usuário: “poe publicar”. Executado `npm.cmd run web:deploy`: guard do projeto aprovado, build final aprovado e frontend/PWA/OTA **3.9.392** publicado em https://territ-es-sbs.web.app, projeto `territ-es-sul-sbs`, alvo `hosting:app`. Lockfile alinhado à versão.

Verificação remota às 15:48 (America/Sao_Paulo), por `node scripts/verificar-publicacao-cartao.mjs`: versão pública e manifesto OTA 3.9.392; 34 arquivos HTML/SW/assets iguais ao build por SHA-256; ZIP OTA igual ao local e ao hash `65f0100f6281be1f4d3f04fef548a9e39f0d870bff02e915df2110221ec5207f`. API existente rejeitou credencial inválida com 403, CORS esperado e `no-store`. Evidência em `artifacts/release/verification-3.9.392.json`.

Publicação limitada ao Hosting/frontend/PWA/OTA, sem publicação de Worker, Rules ou índices. Nenhum dado operacional alterado; sem migração, mensagens, commit ou push. A conferência visual foi a prévia local fictícia registrada acima; confirmação no mapa autenticado e aparelho físico permanece separada da distribuição verificada.
