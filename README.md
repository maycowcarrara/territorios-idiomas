# Territórios Idiomas

Sistema web para gestão de territórios de pregação, feito em React + Firebase e usado como PWA em celular e desktop. O app substitui cartões físicos, centraliza designações, marcação de quadras, observações por território e relatórios administrativos.

## Visão Geral

O sistema foi pensado para uso real no dia a dia:

- dirigentes visualizam seus territórios e marcam quadras concluídas
- administradores designam, devolvem, acompanham histórico e geram relatórios
- observações por quadra e condomínio ficam salvas como conhecimento permanente do território
- campanhas podem ser ativadas sem apagar o progresso normal
- o app continua utilizável sem conexão para execução segura do território

## Modo Offline Seguro

O modo offline foi desenhado para permitir trabalho de campo sem abrir brecha para sobrescrever uma designação nova.

### O que pode offline

- marcar e desmarcar quadras
- adicionar, editar e excluir observações
- preparar pedido de finalização
- confirmar finalização para concluir automaticamente quando a conexão voltar
- consultar dados já carregados no aparelho

### O que não pode offline

Ações administrativas exigem conexão:

- designar território
- devolver ou liberar território
- transferir responsável
- finalizar ou reabrir como admin
- criar, ativar ou excluir campanha
- mudar usuários e permissões
- enviar comunicados e notificações administrativas

### Como a proteção funciona

- cada ciclo de designação recebe um `designacaoId`
- toda ação offline guarda `territorioId`, `userEmail`, `designacaoId`, tipo e payload
- na sincronização, a ação só é aplicada se o servidor ainda tiver:
  - `designadoPara === userEmail`
  - `designacaoId === action.designacaoId`
- se a designação mudou, a ação vira `conflict` e não é aplicada automaticamente

### Fila local

As ações locais ficam em uma outbox no IndexedDB com estes estados:

- `pending`
- `syncing`
- `synced`
- `conflict`
- `failed`

Quando o usuário está online, o app mostra uma barra discreta de salvamento abaixo do header. Quando há offline, pendências, falhas ou conflitos, o topo mostra um chip de status; ao tocar nele, o usuário vê os detalhes.

## Funcionalidades

### Mapa

- mapa interativo com Google Maps e OpenStreetMap
- cores por status do território
- controle de zoom, GPS, pontos de referência e condomínios
- marcação de quadras feitas e pendentes
- ponto de encontro compartilhável por WhatsApp
- status de sincronização visível no header

### Observações

- notas por quadra e condomínio
- edição e exclusão com controle por autor/admin
- observações permanentes, compartilhadas entre modo normal e campanhas
- novas notas salvas como documentos próprios em `territorios/{id}/notas`
- notas legadas continuam visíveis para compatibilidade

### Painel do Sistema

- aprovação e gestão de usuários
- edição de nome e WhatsApp
- ativação e desativação de campanhas
- reativação de campanhas salvas
- retorno imediato ao modo normal sem perder progresso anterior
- ações de escrita bloqueadas enquanto o admin estiver offline

### Campanhas

- o sistema possui um contexto ativo global
- no modo normal, o andamento usa a coleção `territorios`
- no modo campanha, o andamento usa a coleção `territorios_contexto`
- as notas continuam no território base e aparecem em qualquer contexto
- o topo do app mostra chip da campanha, variação de cor e percentual de cobertura

### Relatórios

- filtros por status, busca e tempo ocioso
- histórico de ciclos
- exportação em PDF
- relatórios acompanham o contexto ativo do sistema

## Stack

- React 19
- Vite
- Tailwind CSS
- Firebase Auth
- Cloud Firestore
- Firebase Hosting
- Leaflet / React Leaflet
- jsPDF

## Estrutura de Dados

### Planejamento para Territorios Idiomas

O plano tecnico para evoluir esta instancia para cadastro de enderecos, agrupamento em territorios de idioma e designacao desses grupos esta em [docs/planejamento-territorios-idiomas-enderecos.md](./docs/planejamento-territorios-idiomas-enderecos.md).

Status atual:

- enderecos cadastraveis no mapa, com codigo automatico `E-000X`;
- grupos de enderecos cadastraveis no mapa, com codigo automatico `T-00X`;
- grupos podem ser designados para publicadores e aparecem em "Meus Territorios";
- publicador marca enderecos visitados e finaliza o grupo quando todos foram visitados;
- fluxo de enderecos/grupos esta online-first; o offline robusto segue disponivel para territorios/quadras.

### Coleções principais

- `usuarios`
  - documento: e-mail em minúsculo
  - campos principais: `nome`, `role`, `whatsapp`

- `territorios`
  - documento: `t_{numero}`
  - dados permanentes e base de notas
  - campos comuns: `nome`, `ultimaAlteracao`, `historico`
  - subcoleção: `notas`

- `territorios_contexto`
  - documento: `{contextoId}__t_{numero}`
  - progresso do território no contexto ativo
  - campos comuns: `contextoId`, `territorioNumero`, `designadoPara`, `designadoNome`, `designacaoId`, `cicloAtual`, `quadras_feitas`, `status`, `historico`

- `enderecos`
  - documento: `e_0001`, `e_0002`, ...
  - cadastro permanente de uma casa/local visitavel
  - campos comuns: `codigo`, `status`, `grupoId`, `grupoCodigo`, `lat`, `lng`, `endereco`, `quantidadeEstrangeiros`, `observacao`, `origem`, `criadoEm`, `criadoPor`, `atualizadoEm`, `atualizadoPor`

- `grupos_enderecos`
  - documento: `g_001`, `g_002`, ...
  - territorio de idioma designavel, formado por varios enderecos
  - campos comuns: `codigo`, `nome`, `status`, `enderecoIds`, `totalEnderecos`, `totalEstrangeiros`, `centro`, `bounds`, `designadoPara`, `designadoNome`, `designacaoId`, `cicloAtual`, `enderecos_visitados`, `historico`

- `contadores`
  - documento: `codigos`
  - controla as proximas sequencias `proximoEndereco` e `proximoGrupoEndereco`

- `configuracoes`
  - documento: `sistema`
  - controla o contexto ativo do app

- `campanhas`
  - campanhas cadastradas no painel

- `notificacoes`
  - avisos administrativos e notificações do sistema

### Estrutura das notas

Notas novas ficam na subcoleção `territorios/{id}/notas`, com campos como:

- `quadraId`
- `texto`
- `autorEmail`
- `autorNome`
- `data`
- `editadoEm`
- `designacaoId`
- `territorioId`
- `contextoId`

## Regras do Firestore

As rules do projeto estão versionadas em [firestore.rules](./firestore.rules) e referenciadas em [firebase.json](./firebase.json).

As regras atuais cobrem:

- leitura do contexto ativo por usuários aprovados
- gestão de campanhas apenas por admin
- progresso de campanha em `territorios_contexto`
- execução de território permitida ao responsável atual
- bloqueio de escrita quando `designacaoId` mudou
- bloqueio de campos administrativos para usuário comum
- escrita de notas validada por designação e permissões de autor/admin
- leitura de `enderecos` e `grupos_enderecos` por usuários aprovados
- cadastro/edição/arquivamento de endereços apenas por admin
- criação, edição, designação e arquivamento de grupos apenas por admin
- progresso/finalização de grupo apenas pelo publicador designado

## Instalação

### Pré-requisitos

- Node.js 18+
- projeto Firebase configurado
- Firestore, Auth e Hosting habilitados

### Instalar dependências

```bash
npm install
```

### Configurar Firebase

Crie o arquivo `src/firebase.js` com a inicialização do projeto e exporte `db`, `auth` e `googleProvider`.

### Configurar Firebase no Android

Baixe o arquivo `google-services.json` do projeto Firebase Android de Idiomas e salve-o em `android/app/google-services.idiomas.json` ou `android/app/google-services-idiomas.json`.

Esse arquivo fica apenas no ambiente local e não deve ser versionado no Git. O arquivo ativo `android/app/google-services.json` é gerado localmente pelo script:

```bash
npm run android:firebase
```

Os scripts de build Android já fazem essa troca antes de sincronizar o Capacitor.

O `applicationId` do APK/AAB é lido automaticamente do `package_name` do `google-services` selecionado.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run web:deploy
npm run deploy:rules
npm run worker:deploy
npm run android:debug
npm run android:release
```

Os artefatos Android sao salvos com o nome da instancia ativa, definida por `npm run android:firebase`.

O `npm run android:sync` tambem sincroniza a config nativa do Capacitor,
icones e splash com a instancia ativa selecionada pelo `android:firebase:*`.

Observação: `npm run build` atualiza automaticamente os arquivos de versão antes da build.

### Smoke de enderecos/grupos

O fluxo de enderecos e grupos pode ser validado localmente com Auth e Firestore Emulator, sem tocar no projeto real:

```bash
npm exec --yes --package firebase-tools -- firebase emulators:exec --project territorios-idiomas-smoke --only firestore,auth "node scripts/smoke-enderecos-grupos-emulator.mjs"
```

Esse smoke cria usuarios temporarios no emulador e valida cadastro de enderecos, criacao/designacao/finalizacao de grupo e bloqueios de permissao.

## Configuração de Idiomas

O projeto está configurado para a instância Idiomas. O arquivo local esperado é `.env`, que não deve ser enviado ao Git.

O Firebase Hosting usa o target `app` em [firebase.json](./firebase.json), apontando para o site `territ-es-sbs` no projeto `territ-es-sul-sbs`.

O `.env` também deve definir `VITE_PUBLIC_APP_URL` e `VITE_LIVE_UPDATE_MANIFEST_URL` apontando para o Hosting de Idiomas. O app usa `VITE_PUBLIC_APP_URL` ao gerar links compartilháveis no WhatsApp e em PDFs; se ela ficar vazia, o fallback tenta inferir a URL a partir de `VITE_LIVE_UPDATE_MANIFEST_URL`.

Para login por link mágico no Android, a instância ativa também precisa manter coerentes:

- `VITE_PUBLIC_APP_URL`, porque o link continua/retorno do e-mail usa esse Hosting.
- `VITE_FIREBASE_AUTH_DOMAIN`, porque o Firebase pode resolver o App Link pelo domínio `firebaseapp.com`.

O APK registra os dois hosts (`web.app` e `firebaseapp.com`, quando forem diferentes) para que o toque no e-mail volte ao app em vez de cair só no navegador. Se mudar qualquer um desses domínios, rode uma nova sincronização/build Android além do deploy web.

O link mágico é enviado diretamente pelo Firebase Authentication usando `sendSignInLinkToEmail`.
Não configure EmailJS, Brevo ou outro provedor externo para esse fluxo; basta habilitar o provedor de link por e-mail no Firebase Auth e manter o domínio do Hosting autorizado.

Em Idiomas, deixe `VITE_MAPA_URL` vazio para abrir apenas os endereços/grupos cadastrados no Firestore.

### Notificações

As notificações internas usam a coleção `notificacoes` dentro do Firebase da instância ativa. O sininho mostra essas mensagens e também exibe um aviso in-app quando uma nova notificação chega com o app aberto.

O push pelo OneSignal está configurado para a instância Idiomas:

- `VITE_ONESIGNAL_APP_ID` e `VITE_ONESIGNAL_SAFARI_WEB_ID` ficam em `.env` para inicializar o SDK no app Idiomas.
- O Worker de Idiomas precisa dos secrets `ONESIGNAL_APP_ID` e `ONESIGNAL_REST_API_KEY`.
- O app registra tags no OneSignal com `instancia` e `firebaseProjectId`, facilitando conferir no painel se o dispositivo está no ambiente correto.

Para conferir os secrets do Worker de Idiomas:

```bash
cd workers/notifications-relay
wrangler secret list --config wrangler.idiomas.toml
```

## Deploy

Publicar apenas o Hosting da aplicação:

```bash
npm run web:deploy
```

Publicar apenas as rules do Firestore:

```bash
npm run deploy:rules
```

Antes de qualquer deploy Firebase, os scripts rodam uma trava com `firebase projects:list --json` e bloqueiam se a conta ativa nao tiver acesso ao projeto esperado em `.firebaserc`.

Publicar tudo que está em `firebase.json`:

```bash
npm run deploy:all
```

Publicar o Worker de notificações:

```bash
npm run worker:deploy
```

Antes de qualquer deploy do Worker, os scripts rodam uma trava com `npx wrangler whoami` e bloqueiam se o `account_id` esperado nao aparecer na conta Cloudflare ativa. Idiomas usa `workers/notifications-relay/wrangler.idiomas.toml`. Se a instância mudar de conta Cloudflare, entre na conta correta e atualize o `account_id` do arquivo da instância:

```bash
cd workers/notifications-relay
npx wrangler whoami
```

Se a trava acusar conta errada, troque a sessao antes de publicar:

```bash
firebase logout
firebase login

npx wrangler logout
npx wrangler login
```

Se o deploy das rules falhar com permissão `serviceusage.services.use`, ajuste o IAM da conta usada no Firebase CLI no projeto Google Cloud.

## Migração para Outro Firebase

Para copiar o Firestore atual para um projeto Firebase em outra conta Google, use o script documentado em [scripts/firestore-migrate.md](./scripts/firestore-migrate.md).

## Teste em Celular

### Opção recomendada

Use um preview channel do Firebase Hosting para testar com HTTPS, GPS e login Google:

```bash
npm run build
npx firebase hosting:channel:deploy teste-mobile
```

### Rede local

```bash
npm run dev -- --host
```

Útil para ajuste visual, mas GPS e login podem depender de configuração extra e HTTPS.

## Mapas

Em Idiomas, o app não usa mais `public/mapa.json` como base inicial. Com `VITE_MAPA_URL` vazio, o mapa abre sem polígonos importados e mostra somente os endereços/grupos cadastrados.

O arquivo `public/mapa.json` permanece apenas como legado. Se a instância voltar a usar territórios/quadras por GeoJSON, aponte explicitamente `VITE_MAPA_URL` para o arquivo desejado.

Também existe um fluxo auxiliar em `kmz/` para conversão de arquivos de origem para o formato usado pelo sistema.

Veja o passo a passo completo em [kmz/README.md](./kmz/README.md).

## Observações de Produto

- campanhas não apagam o andamento normal
- desativar uma campanha devolve o sistema ao contexto normal imediatamente
- reativar uma campanha retoma o progresso daquela campanha
- observações permanecem disponíveis em qualquer modo

## Licença

Projeto desenvolvido para uso local da congregação de Idiomas.
