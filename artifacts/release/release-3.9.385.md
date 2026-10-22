# Publicação 3.9.385 — 22/10/2026

Autorização: “publique tudo”, seguida de “coloque versão 3.9.385”.

Frontend/PWA e pacote OTA publicados em https://territ-es-sbs.web.app, projeto `territ-es-sul-sbs`, alvo `hosting:app`. A publicação 3.8.384 desta rodada foi substituída pela versão exata solicitada, 3.9.385, sem novo incremento automático. Package e lockfile sincronizados.

Inclui todos os arquivos atuais do build: consulta pública por QR/cartão, ajustes de PDF e mapa, menus verticais dos balões sem X e seletor explícito de publicadores com cadastro novo sob escolha. O botão de designação explica que salva e abre o WhatsApp para confirmação do envio.

Worker `territorios-designacoes-idiomas` publicado e confirmado em 100% na versão `d4b413e5-4fc2-47f3-b474-373defb3107c`; `CODIGOS_ENABLED=true` e cron existente preservados. Nenhum secret foi alterado. Rules já correspondiam à versão publicada; compiladas e liberadas novamente. Índices publicados com sucesso, sem exclusão forçada.

Validação: 341 testes unitários/componentes, 20 testes de relay, matriz Rules e smoke legado, 102 verificações de designações e 35 de cartão/PIN aprovados. Lint geral, empacotamento Worker e build aprovados.

Conferência pública em 22/10/2026 às 18:38 (America/Sao_Paulo): versão e manifesto OTA 3.9.385; 32 arquivos HTML/SW/assets iguais ao build por SHA-256, inclusive fonte e módulos carregados sob demanda. ZIP igual ao local e ao manifesto. API rejeita credencial inválida com 403, CORS esperado e `no-store`. Evidência: `verification-3.9.385.json`.

Não houve migração, designação real de teste, mensagem enviada, commit ou push. Não foi repetida a validação no navegador após a primeira prévia cortada; conferência visual no celular ficou com o usuário. Publicação e hashes não comprovam aceite visual, Android/WebView, WhatsApp ou QR físico.
