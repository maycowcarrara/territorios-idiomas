# Publicação 3.9.386 — 22/10/2026

Autorização do usuário: “terminando pode publicar tudo”.

Publicado frontend/PWA e pacote OTA em https://territ-es-sbs.web.app, projeto `territ-es-sul-sbs`, alvo `hosting:app`, usando `npm.cmd run web:deploy`. Package, lockfile e arquivos de versão sincronizados em 3.9.386.

Alteração desta rodada: abas Só WhatsApp e Com login compartilham estilos compactos de seletor, campos e ação. Novo convite fica na lista; campos extras aparecem somente nessa escolha e a ação para publicador existente aparece após seleção. Caminho legado de login recebe a mesma organização.

Validação local: 341 testes unitários/componentes, lint dos arquivos alterados, diff-check e build aprovados. Sem nova tentativa de navegador após a falha anterior; conferência visual no celular permanece pendente.

Conferência pública às 18:51 (America/Sao_Paulo): versão e manifesto OTA 3.9.386; 32 arquivos HTML/SW/assets idênticos ao build por SHA-256. ZIP público corresponde ao local e ao hash do manifesto. API existente rejeita credencial inválida com 403, CORS esperado e `no-store`. Evidência em `verification-3.9.386.json`.

Backend, regras e índices já publicados na rodada anterior, sem novas alterações nesta rodada. Sem migração, escrita de dados operacionais, mensagens, commit ou push.
