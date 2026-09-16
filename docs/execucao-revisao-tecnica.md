# Registro de Execução da Revisão Técnica: Pontos 1 a 6

Data de referência: 16/09/2026. Projeto: `C:\Projetos\territorios-idiomas`.

Este documento registra a linha de base, evidências de execução, decisões técnicas e o status de cada fase do [Plano Técnico da Revisão Geral](./plano-tecnico-revisao-antigravity.md).

---

## 1. Quadro de Status das Fases

| Fase | Estado | Evidência / Resumo |
| --- | --- | --- |
| **Preparação** | Validado localmente | Baseline registrada, ferramentas locais verificadas, `lint`, `build` e `smoke` em emulador aprovados sem rede real. |
| **P3** | Validado localmente | Documentação de build/scripts/versão alinhada em `README.md`, idempotência de `npm run build` comprovada por hashes, inventário de versões concluído. |
| **P2** | Validado localmente | Suite unitária Vitest com 59 testes cobrindo CSV, códigos/formatadores, configuração de idiomas, bairros, progresso de territórios e atualização web/nativa. Smoke em emulador, lint e build aprovados. |
| **P1** | Planejado | Extração modular em lotes (`Mapa.jsx`, `App.jsx`, `AdminPanel.jsx`, `Relatorios.jsx`), iniciando por P1a. |
| **P4** | Planejado | Testes locais e otimização de consultas do Cloudflare Worker (`notifications-relay`). |
| **P5** | Planejado | Matriz de autorização e testes das Firestore Security Rules em emulador. |
| **P6** | Planejado | Medições comparativas por fluxo e análise de bundles/precache PWA. |

---

## 2. Linha de Base (Baseline) do Ambiente

### 2.1 Ambiente e Ferramental Local
- **Branch**: `master`
- **Commit HEAD**: `bfb85c07ac0ebb84d5d979d6f0d752f8c55d3e3c` (`feat: add native live update support and version tracking for v3.5.353`)
- **Node.js**: `v24.11.1`
- **npm**: `11.18.0`
- **Java**: `OpenJDK 21.0.11 LTS` (Temurin-21.0.11+10)
- **Firebase CLI**: `firebase-tools@15.24.0` (executado via `npm.cmd exec -- firebase`)
- **Vite**: `7.3.6`
- **ESLint**: `9.39.5`
- **Vitest**: `5.0.1` (instalado em P2 como devDependency compatível com Vite 7)

### 2.2 Estado Inicial do Repositório
- `git status --short`: Repositório limpo no início da execução (as alterações de desenvolvimento prévias haviam sido commitadas no HEAD `bfb85c0`).
- Sem alterações staged ou uncommitted no checkout inicial.

### 2.3 Verificações da Preparação
Comandos executados sequencialmente na raiz:

1. **`git status --short`**: Saída vazia (código 0).
2. **`git diff --stat`**: Saída vazia (código 0).
3. **`npm.cmd run lint`**: Aprovado com código 0 (ESLint nos arquivos `.js` e `.jsx`).
4. **`npm.cmd run build`**: Aprovado com código 0 (`vite build --mode idiomas`). Geração de chunks e Service Worker PWA (44 entries precache) em 4.73s. Nenhuma modificação nos arquivos versionados.
5. **Smoke integrado no emulador (`smoke-enderecos-grupos-emulator.mjs`)**:
   - Comando: `npm.cmd exec -- firebase emulators:exec --project territorios-idiomas-smoke --only firestore,auth "node scripts/smoke-enderecos-grupos-emulator.mjs"`
   - Emuladores utilizados: Auth (local) e Firestore (local) no projeto sintético `territorios-idiomas-smoke`.
   - Negações esperadas de permissão (RPC Write error Code 7 `PERMISSION_DENIED`) validadas como parte do conjunto de segurança.
   - Resultados:
     - `ok - bloqueado: codigo duplicado de endereço`
     - `ok - bloqueado: codigo invalido de endereço`
     - `ok - bloqueado: território misturando idiomas`
     - `ok - bloqueado: vincular endereço de outro idioma ao território existente`
     - `ok - bloqueado: designar grupo finalizado sem disponibilizar`
     - `ok - bloqueado: trocar idioma de endereço agrupado`
     - `ok - bloqueado: codigo duplicado de território`
     - `ok - bloqueado: rule impede publicador designado marcar endereço fora do grupo`
     - `ok - bloqueado: rule impede publicador designado duplicar endereço visitado`
     - `ok - bloqueado: rule impede publicador designado finalizar antes de completar`
     - `ok - bloqueado: publicador editar endereço básico`
     - `ok - bloqueado: rule impede usuário não designado ler grupo para marcar endereço`
     - `ok - bloqueado: rule impede usuário não designado atualizar grupo`
     - `ok - fluxo endereços/grupos validado no emulador`
     - **Status final do smoke**: Sucesso (código 0).
6. **`git diff --check`**: Saída vazia (código 0).

---

## 3. P3: Alinhamento de Build, Versão e Documentação

### 3.1 Diagnóstico das Divergências Encontradas
1. **Divergência Documental no README**:
   - O `README.md` afirmava incorretamente: *"Observação: `npm run build` atualiza automaticamente os arquivos de versão antes da build."*
   - Na prática, `package.json` define:
     - `"build": "vite build --mode idiomas"`: compilação pura estática, **sem** alteração de versão.
     - `"build:bump": "npm run update-version && npm run build"`: incremento explícito antes da compilação.
     - `"web:deploy"` / `"deploy:all"`: acionam `build:bump` seguido de `live-update:bundle`.
2. **Divergência entre Package, Lockfile e Gradle**:
   - `package.json`: `"version": "3.5.353"`
   - `src/version.json`: `"version": "3.5.353"`
   - `public/version.json`: `"version": "3.5.353"`
   - `package-lock.json`: `"version": "3.5.350"` (ocorre porque o script `gerar-versao.js` altera diretamente `package.json` via manipulação de JSON sem invocar `npm version` ou atualizar o lockfile).
   - `android/app/build.gradle`: `versionCode 340`, `versionName "3.0.340"` (a sincronização Android é isolada em `scripts/sync-android-version.cjs` e ocorre apenas no fluxo de `android:release`).

### 3.2 Mapeamento Completo dos Comandos

| Script | Finalidade | Incrementa versão? | Artefatos gerados | Publica? |
| --- | --- | --- | --- | --- |
| `npm run dev` (`dev:idiomas`) | Inicia servidor de desenvolvimento Vite | Não | Nenhum (em memória) | Não |
| `npm run lint` | Validação estática de código com ESLint | Não | Nenhum | Não |
| `npm run build` (`build:idiomas`, `web:build`, `web:build:idiomas`) | Compilação estática web para produção (`vite build --mode idiomas`) | Não | Arquivos em `dist/` | Não |
| `npm run update-version` | Incrementa patch no `package.json` e gera `src/version.json` e `public/version.json` via `gerar-versao.js` | Sim (patch no package e JSONs) | `package.json`, `src/version.json`, `public/version.json` | Não |
| `npm run build:bump` | Executa `update-version` seguido de `build` | Sim (via `update-version`) | `package.json`, `version.json`, `dist/` | Não |
| `npm run live-update:bundle` | Cria pacote ZIP OTA e manifest a partir de `dist/` (`scripts/create-live-update-bundle.cjs`) | Não | `dist/live-update/territorios-idiomas-<versao>.zip`, `dist/live-update/manifest.json` | Não |
| `npm run preview` | Servidor local para pré-visualizar `dist/` | Não | Nenhum | Não |
| `npm run web:deploy` (`deploy`, `deploy:idiomas`, `web:deploy:idiomas`) | Trava Firebase (`guard:firebase`), `build:bump`, `live-update:bundle` e deploy Hosting | Sim (via `build:bump`) | `dist/`, pacote OTA e deploy no Hosting | Sim (Firebase Hosting `app`) |
| `npm run deploy:all` (`deploy:all:idiomas`) | Trava Firebase, `build:bump`, `live-update:bundle` e deploy Hosting + Rules + Índices | Sim (via `build:bump`) | `dist/`, pacote OTA e deploy completo | Sim (Hosting, Rules, Índices) |
| `npm run deploy:rules` (`deploy:rules:idiomas`) | Valida credenciais e publica apenas Security Rules do Firestore | Não | Nenhum | Sim (Firestore Rules) |
| `npm run worker:deploy` (`worker:deploy:idiomas`) | Publica o Cloudflare Worker do relay de notificações | Não | Artefatos do Worker | Sim (Cloudflare Worker) |
| `npm run android:version` | Sincroniza `versionCode` (patch) e `versionName` do `package.json` para `android/app/build.gradle` | Não (apenas replica para Gradle) | `android/app/build.gradle` | Não |
| `npm run android:sync` (`cap:sync`) | Sincroniza Capacitor, config nativa e assets Android com a instância ativa | Não | Arquivos nativos Android | Não |
| `npm run android:assemble` (`android:assemble:idiomas`) | Compila web (`build`), aplica Firebase, sincroniza Capacitor e gera APK debug | Não | APK debug nativo | Não |
| `npm run android:debug` (`android:debug:idiomas`, `android:build`, `android:apk`) | Executa `android:assemble` e copia APK para pasta de artefatos | Não | APK debug copiado | Não |
| `npm run android:release` (`android:release:idiomas`, `android:play`) | Compila web (`build`), replica versão para Gradle (`android:version`), checa OAuth, sincroniza Capacitor e compila APK/AAB release | Não altera `package.json` (apenas copia versão para Gradle) | APK e AAB release em `android-artifacts/` | Não |

### 3.3 Ações Implementadas em P3
1. **Atualização de [README.md](../README.md)**:
   - Removida a asserção incorreta sobre incremento de versão no `build`.
   - Adicionada tabela exata de scripts com finalidade, incremento de versão, artefatos gerados e publicação.
   - Detalhada a distinção técnica entre compilação web pura (`build`), atualização de versão para deploy (`build:bump`), pacote OTA (`live-update:bundle`) e compilações nativas Android.
2. **Preservação de Scripts e Aliases**:
   - Nenhum script em `package.json` foi removido ou alterado, preservando total compatibilidade operacional.
3. **Comprovação de Idempotência do `build`**:
   - Hashes SHA-256 dos arquivos de controle de versão antes e após execução de `npm.cmd run build`:
     - `package.json`: `A24773A41E75D2B7195A8BAF61E7182F26B71435C7FBE922A15ECAB2CA75F066` (inalterado)
     - `package-lock.json`: `0A0C893CA956AFEF294518EE5369F69BE8DA622074FC82B51D8ADEEA149A14A4` (inalterado)
     - `src/version.json`: `D81EDE6E056796A9068C369CE8B4D07DB2ECAF32595B0FF38C24BAA9063A224E` (inalterado)
     - `public/version.json`: `D81EDE6E056796A9068C369CE8B4D07DB2ECAF32595B0FF38C24BAA9063A224E` (inalterado)
     - `android/app/build.gradle`: `76B92BEB543106E264FDE8C70C0C78E57D5CCD2C31623DD860D5CD4BE784CFE7` (inalterado)
   - O comando `git status --short` após o build registrou apenas as alterações intencionais na documentação.

---

## 4. P2: Testes de Comportamento e Regras de Negócio

### 4.1 Estrutura e Ferramental Configurado
- Criado [vitest.config.js](../vitest.config.js) com descoberta isolada em `tests/unit/**/*.test.js`, excluindo regras, Worker e Android.
- Ambiente de testes: `environment: 'node'`, sem dependência de browser real para testes de lógica de domínio.
- Adicionados scripts ao [package.json](../package.json):
  - `"test:unit": "vitest run --config vitest.config.js"`
  - `"test:unit:watch": "vitest --config vitest.config.js"`
  - `"test:smoke": "npm exec -- firebase emulators:exec --project territorios-idiomas-smoke --only firestore,auth \"node scripts/smoke-enderecos-grupos-emulator.mjs\""`
- Todas as APIs de teste (`describe`, `it`, `expect`, `vi`, etc.) importadas explicitamente de `'vitest'` para cumprir as regras do ESLint sem variáveis globais implícitas.

### 4.2 Suites de Testes Criadas e Casos Cobertos (59 testes)

1. **Importação de CSV de Endereços (`tests/unit/enderecoCsvImport.test.js` - 13 testes)**:
   - Aliases de cabeçalhos em português, espanhol e inglês (`territorio`, `barrio`, `direccion`, `informacion`, `classe`, `latLong`).
   - Células com quebras de linha e aspas duplas escapadas.
   - Suporte a arquivos com BOM (`\uFEFF`).
   - Extração de coordenadas por coluna de par (`latLong`), colunas separadas (`latitude`/`longitude`), e links do Google Maps.
   - Correção automática de sinal de longitude positiva no Brasil.
   - Tratamento de coordenadas fora da área permitida (`isInsideViewbox`).
   - Classificação em `novo` (`canInsert: true`), `existente` (sem alterações, `canUpdate: false`), e `atualizar` (alterações permitidas, `canUpdate: true`).
   - Detecção de código duplicado na mesma planilha.
   - Bloqueio de conflito quando endereço já pertence a outro território.
   - Identificação de linhas sem coordenadas e montagem da query de geocodificação.
   - Validação da aplicação de geocodificação sintética via `applyEnderecoCsvGeocoding` sem chamadas HTTP reais.

2. **Códigos Manuais, Formatação e IDs (`tests/unit/enderecoCodigos.test.js` - 12 testes)**:
   - `normalizeCodigoManual`: maiúsculas, remoção de espaços e tratamento de nulos.
   - `isCodigoManualValido`: validação estrita (`^[A-Z0-9]+(?:-[A-Z0-9]+)+$`). Rejeição de strings vazias, números puros sem hífen, hífens duplos ou posições inválidas.
   - Distinção entre código e ID do Firestore: `getEnderecoDocIdFromCodigo` (`e_es_sbs_001`), `getGrupoEnderecoDocIdFromCodigo` (`g_es_sbs_t01`).
   - Geradores de sequências e exibição amigável: `formatEnderecoCodigo` (`E-0001`), `formatEnderecoCodigoExibicao` (`E-1`), `getEnderecoDocIdFromSequence` (`e_0001`), `formatGrupoEnderecoCodigo` (`T-001`), `formatGrupoEnderecoCodigoExibicao` (`T-1`), `formatGrupoEnderecoNomeExibicao` (`Território T-1`).

3. **Configuração de Idiomas e Prefixos (`tests/unit/enderecoConfig.test.js` - 8 testes)**:
   - `normalizeEnderecoConfig`: fallback completo quando vazio, normalização de IDs para minúsculas, deduplicação de idiomas.
   - Seleção de idioma padrão ativo quando o ID informado estiver inativo.
   - `getEnderecoIdiomasAtivos`: filtro exclusivo de idiomas ativos.
   - `getEnderecoConfigForIdioma`: recuperação de prefixos de código por idioma e fallback para idioma padrão quando inexistente.
   - `getEnderecoCodigoPadraoFromConfig` e `getGrupoEnderecoCodigoPadraoFromConfig`: geração de sufixos numéricos sem duplicação quando o prefixo já termina com dígito.

4. **Normalização e Resolução de Bairros (`tests/unit/bairrosSbs.test.js` - 6 testes)**:
   - `normalizeBairroNome`: remoção de diacríticos, caracteres especiais e capitalização.
   - `normalizeBairroKey`: remoção de palavras de parada (`BAIRRO`, `DE`, `DA`, `DO`, `DAS`, `DOS`).
   - `resolveBairroNomeOficial`: mapeamento para a lista oficial com acentuação oficial e fallback para termos não reconhecidos.
   - `buildBairroId`: geração de slugs estáveis (`bela-alianca`, `25-de-julho`, etc.).

5. **Progresso e Estatísticas de Territórios (`tests/unit/enderecoProgresso.test.js` - 8 testes)**:
   - `getGrupoEnderecoProgresso`: grupo vazio (0%), grupo parcial (50%), grupo completo (100%), deduplicação de IDs visitados e preservação de status `finalizado`/`arquivado`.
   - `calculateGrupoEnderecoStats`: lista vazia, filtragem de coordenadas inválidas/não finitas e exclusão de endereços com status arquivado. Cálculo do centroide médio e dos limites geográficos (`bounds`).

6. **Atualização Web e PWA (`tests/unit/updateUtils.test.js` - 8 testes)**:
   - `checkForUpdateStatus`: versão idêntica (`updateAvailable: false`), versão mais recente (`updateAvailable: true`), tratamento gracioso de erro HTTP 404 e rejeição de rede sem quebrar a aplicação.
   - Atualização manual PWA: chamada exclusiva de `registration.update()` no service worker do app (`sw.js`) e redirecionamento preservando o hash de rota da SPA.
   - Modo nativo: delegação para `checkNativeLiveUpdate` e agendamento de recarga com timer controlado ao confirmar pacote instalado.
   - `checkForUpdate`: wrapper booleano.

7. **Live Update Android / Capacitor (`tests/unit/nativeLiveUpdate.test.js` - 4 testes)**:
   - `isNativeLiveUpdateAvailable`: ativação estrita para plataforma `android` com `LIVE_UPDATE_ENABLED`.
   - `checkNativeLiveUpdate`: bloqueio em ambiente Web/iOS sem invocar plugin, chamada automática com `manifestUrl` original, e chamada manual com `cacheBuster` (`?t=...`).

### 4.3 Resultados das Validações Locais em P2
- **`npm.cmd run test:unit`**: 59 testes aprovados (7 suites) em 682ms.
- **`npm.cmd run lint`**: Aprovado sem erros ou advertências.
- **`npm.cmd run build`**: Aprovado sem alterações nos arquivos de versão (4.24s).
- **`npm.cmd run test:smoke`**: Aprovado no emulador local (código 0).
- **`git diff --check`**: Aprovado sem conflitos de whitespace.

---

## 5. Contratos Preservados e Decisões Técnicas

- **Sem commit, push ou deploy**: Nenhuma operação remota foi executada.
- **Sem alteração em arquivos nativos Android**: `android/app/build.gradle` e plugins mantidos intactos.
- **Idempotência preservada**: Nenhuma versão foi incrementada inadvertidamente durante a preparação, P3 e P2.
- **Regras de negócio e contratos de dados**: Estruturas de coleções (`enderecos`, `grupos_enderecos`), IDs e fluxos online-first mantidos 100% íntegros.
- **Mocks 100% locais**: Nenhum teste unitário realizou chamadas de rede real, Push OneSignal, Nominatim ou geocodificação externa.

---

## 5. P1: Separação de Responsabilidades dos Componentes Grandes

### 5.1 P1a: Modularização Visual do Mapa (Concluído)
- **Estrutura criada**:
  - `src/mapa/utils/mapDomEvents.js`: isolamento de eventos Leaflet (`stopMapDomEvent`, `useLeafletDomEventIsolation`).
  - `src/mapa/utils/enderecoModalUtils.js`: utilitários de formulário e auditoria (`formatAuditDateTime`, `getEnderecoAuditOriginLabel`, `hasEnderecoAuditInfo`, `getEnderecoInitialForm`).
  - `src/mapa/layers/bairroSbsUtils.js`: paleta e cálculos de resumo por bairro (`createEmptyBairroResumo`, `getBairroSbsColor`, `BAIRRO_SBS_COLOR_PALETTE`).
  - `src/mapa/utils/mapGeoUtils.js`: funções geodésicas e de formatação de distância (`calcularDistanciaMetros`, `formatarDistanciaMetros`, `toPlainLatLng`, `calcularRumo`, `toRad`).
  - `src/mapa/constants/mapaConstants.js`: constantes de mapa (`MAP_INITIAL_CENTER`, `MAP_INITIAL_ZOOM`, `ADMIN_OFFLINE_MESSAGE`, `MAPA_VISUALIZACAO`).
- **Componentes modais e camadas extraídos**:
  - `src/mapa/components/ModalNota.jsx`: modal de anotações do território/quadra.
  - `src/mapa/components/ModalConfirmacaoFinalizacao.jsx`: modal de confirmação de finalização.
  - `src/mapa/components/EnderecoFormModal.jsx`: modal de cadastro e edição de endereço com abas Dados/Histórico.
  - `src/mapa/components/GrupoEnderecoFormModal.jsx`: modal de criação e agrupamento de territórios.
  - `src/mapa/components/GrupoEnderecosModal.jsx`: modal de detalhes, designação e endereços de um território.
  - `src/mapa/components/MarcadorUsuario.jsx`: marcador animado de GPS do usuário com pulso e compartilhamento.
  - `src/mapa/components/PontoMapaClicado.jsx`: marcador de ponto clicado ou resultado de busca no mapa.
  - `src/mapa/controls/AddressSearchControl.jsx`: controle de busca de logradouro via OpenStreetMap/Nominatim.
  - `src/mapa/controls/SeletorCamadas.jsx`: seletor de visualização (T/E, camadas de satélite, referências, condomínios, bairros).
  - `src/mapa/controls/ControlesNavegacao.jsx`: controle de alternância de GPS e botões de zoom.
  - `src/mapa/layers/BairroSbsLayer.jsx`: camada de polígonos dos bairros oficiais de São Bento do Sul com popup de cobertura.
- **Redução e desacoplamento**:
  - `src/Mapa.jsx` foi reduzido de ~5.677 linhas para ~3.993 linhas mantendo 100% da compatibilidade de props, sem quebrar o Fast Refresh do Vite.

### 5.2 P1b: Hooks e Efeitos do Mapa (Concluído)
- **Hooks extraídos em `src/mapa/hooks/`**:
  1. `useGeolocationTracking.js`:
     - Gerencia permissões (Capacitor nativo Android vs `navigator.geolocation` Web).
     - Watch de posição com limpeza estrita de `watchId` e timeouts no unmount ou desligamento.
     - Filtragem por thresholds de precisão (`PRECISAO_MAXIMA_INICIAL`, `PRECISAO_MAXIMA_RASTREAMENTO`).
     - Cálculo de rumo/direção, rastreamento de trilha com distância mínima e flyTo inicial suave.
  2. `useEnderecoConfigIdioma.js`:
     - Gerencia sincronização Firestore de `getEnderecoConfigRef(db)`.
     - Seleção de idioma ativo integrada com `localStorage`.
     - Derivação memoizada de `enderecoIdiomasAtivos`, `idiomaAtivoEndereco`, `enderecoConfigAtiva`, `mostrarAlternadorIdiomaEndereco`, `filtrarPorIdiomaEndereco`, `pertenceAoIdiomaAtivoEndereco`.
  3. `useMapTouchInteraction.js`:
     - Gerencia toque longo no mapa (`iniciarToqueLongoMapa`, `finalizarToqueLongoMapa`, `cancelarToqueLongoMapa`).
     - Supressão de clique fantasma após toque longo ou abertura de popup de bairro.
     - Suporte a menu de contexto e limpeza de timers controlada.
- **Validações de P1a e P1b**:
  - `npm.cmd run lint`: 0 erros, 0 advertências.
  - `npm.cmd run test:unit`: 59 testes aprovados (7 suites) em 971ms.
  - `npm.cmd run build`: Sucesso em 6.28s, gerando bundles otimizados sem quebra de chunks.

### 5.3 P1c: Modularização do App (Concluído)
- **Constantes e Redirecionamento**:
  - `src/app/constants/appConstants.js`: constantes de app (`APP_TITLE`, `APP_SHORT_NAME`, `APP_SUBTITLE`, `APP_ICON_192`, `POST_LOGIN_REDIRECT_KEY`, `APP_ROUTE`, `BACK_TO_EXIT_WINDOW_MS`).
  - `src/app/utils/redirectUtils.js`: normalização, armazenamento seguro e consumo de redirecionamento pós-login (`normalizePostLoginRedirect`, `rememberPostLoginRedirect`, `consumePostLoginRedirect`, `peekPostLoginRedirect`, `getRedirectFromCurrentUrl`, `rememberRedirectFromCurrentUrl`).
  - `src/app/utils/pwaInstallPrompt.js`: singleton para captura do prompt de instalação do PWA (`beforeinstallprompt`).
  - `src/app/utils/meusTerritoriosUtils.js`: consultas Firestore e montagem das listas de territórios e grupos designados com cálculo de bounds e centroide.
- **Componentes Visuais e Modais (`src/app/components/`)**:
  - `SistemaChip.jsx`: indicador visual de sistema (Normal vs Campanha) com contagem de cobertura.
  - `ModalConfirmacaoLogout.jsx`: modal acessível de confirmação de encerramento de sessão.
  - `SobreModal.jsx`: modal de informações de versão, build e links institucionais.
  - `InformacoesGeraisModal.jsx`: resumo de progresso do publicador e métricas de territórios.
  - `MeusTerritoriosModal.jsx`: lista interativa de territórios e grupos atribuídos ao usuário autenticado com atalhos de navegação no mapa.
  - `StatusSincronizacaoChip.jsx`: modal detalhado de status online/offline e pendências IndexedDB.
  - `LegendaModal.jsx`: modal explicativo com convenções de cores e recência dos territórios.
  - `SininhoNotificacoes.jsx`: central de notificações do usuário com suporte a leitura, contagem não lida e ações de designação/devolução.
  - `MenuLateral.jsx`: drawer de navegação lateral com atalhos de admin, relatórios, PWA install prompt, alternância de sistema e controle push.
- **Autenticação e Sessão (`src/app/auth/`)**:
  - `useAuthSessionState.js`: hook de observação de estado de autenticação Firebase (`useAuthSessionState`) e construtor seguro de usuário (`buildSafeAuthUser`).
  - `AuthStatusScreen.jsx`: tela de transição com spinner e identidade visual do aplicativo.
  - `Login.jsx`: tela completa de login com suporte a Google Popup (Web), Google Native (Android Capacitor) e Magic Link por e-mail (com tratamento robusto de erros e URLs de continuação).
- **Roteamento e Handlers (`src/app/navigation/`)**:
  - `RouteGuard.jsx`: guarda de rotas verificando autenticação, autorização de publicador e permissão estrita de administrador.
  - `LazyPage.jsx`: wrapper Suspense com indicador de carregamento para chunks sob demanda.
  - `MagicLinkOpenHandler.jsx`: listener nativo do Capacitor para abertura de deep links de link mágico no Android (`appUrlOpen`).
  - `BackButtonExitHandler.jsx`: tratamento de duplo toque no botão voltar para fechar app no Android (`backButton`) e interceptação de histórico popstate em PWA standalone.
- **Redução de Acoplamento em `src/App.jsx`**:
  - `src/App.jsx` foi reduzido de **2.893 linhas** para **584 linhas** (redução de 79.8% do arquivo original), mantendo apenas o `Dashboard` coordenador e a estrutura central de rotas do `App`.
- **Validações de P1c**:
  - `npm.cmd run lint`: 0 problemas (0 erros, 0 advertências).
  - `npm.cmd run test:unit`: 59 testes aprovados (7 suites) em 882ms.
  - `npm.cmd run build`: Sucesso em 4.95s, gerando chunks limpos (`Mapa`, `AdminPanel`, `Relatorios`, `index`, `sw.js` PWA v1.3.0).

---

### 5.4 P1d: Modularização do AdminPanel (Concluído)
- **Constantes e Utilitários (`src/admin/`)**:
  - `src/admin/constants/adminConstants.js`: `ADMIN_OFFLINE_MESSAGE`, `ADMIN_OFFLINE_ACTION_CLASS`, `LAST_IMPORT_HIGHLIGHT_STORAGE_KEY`, `ADMIN_TABS`, `UF_OPTIONS`.
  - `src/admin/utils/adminUtils.js`: funções puras de configuração de idiomas (`getEnderecoConfigFormIdiomas`, `criarEnderecoIdiomaForm`), formatação de viewbox e máscara de telefone.
- **Abas e Seções Extraídas (`src/admin/tabs/`)**:
  - `ComunicadosTab.jsx`: formulário de envio de notificações push/broadcast, seleção de destinatários (todos, administradores, publicadores) e salvamento no Firestore com proteção offline.
  - `CampanhasTab.jsx`: gerenciamento de campanhas especiais, ativação de modo campanha, retorno ao modo normal e modal de confirmação de exclusão.
  - `UsuariosTab.jsx`: tabela de usuários, filtros por papel, busca de publicadores, aprovação de pendentes, edição em linha de privilégios e cadastro de novo usuário.
  - `ImportacaoCsvSection.jsx`: upload e análise de CSV de endereços, conferência, destaque da última importação, geocodificação de pinos faltantes via Nominatim/OSM e aplicação atômica de lotes no Firestore.
  - `PadroesTab.jsx`: parâmetros operacionais do sistema, prefixos padrão de endereços e territórios por idioma, lista de idiomas ativos e busca de município IBGE com cálculo de limites geográficos (viewbox).
- **Redução de Acoplamento em `src/AdminPanel.jsx`**:
  - `src/AdminPanel.jsx` foi reduzido de **2.674 linhas** para **1.551 linhas** (redução de 42%), preservando o ciclo de vida, permissões de admin, listener de conectividade e listeners de sincronização.
- **Validações de P1d**:
  - `npm.cmd run lint`: 0 problemas (0 erros, 0 advertências).
  - `npm.cmd run test:unit`: 59 testes aprovados (7 suites) em 915ms.
  - `npm.cmd run build`: Sucesso em 5.75s, com chunk dedicado `AdminPanel` e sem quebras de dependência.

### 5.5 P1e: Modularização dos Relatórios (Concluído)
- **Constantes e Utilitários (`src/relatorios/`)**:
  - `src/relatorios/constants/relatorioConstants.js`: constantes de tipo de relatório (`RELATORIO_TERRITORIOS`, `RELATORIO_ENDERECOS`), status (`STATUS_ARQUIVADO`), e opções de filtro.
  - `src/relatorios/utils/relatorioUtils.js`: funções puras para formatação de datas (`toDateValue`, `formatDateValue`, `getDiasDesde`), geração de chaves canônicas (`getGrupoEnderecoIdentityKey`, `getGrupoEnderecoCanonicalKeys`), ordenação numérica (`getCodigoOrdenacao`), cálculo de recência (`getUltimaEdicaoTexto`), limites/centro (`getGrupoEnderecoBoundsStr`, `getGrupoEnderecoCentro`), formatação de tempo em linguagem natural (`formatarTempo`, `formatarTempoTerritorio`), estilos de status (`getStatusVisual`, `getCorTempo`) e links de mapa (`buildMapaLinkSearch`).
  - `src/relatorios/utils/relatorioPdfExport.js`: exportação profissional de PDF em paisagem com geração dinâmica de links interativos para o mapa, rodapé paginado e carregamento dinâmico sob demanda (`import('jspdf')`, `import('jspdf-autotable')`) para isolamento de bundle.
- **Componentes Extraídos (`src/relatorios/components/`)**:
  - `FiltrosRelatorio.jsx`: resumo consolidado (total, concluídos, em andamento, disponíveis), barra de busca por texto, seletores rápidos de relatório (territórios vs endereços), filtros dropdown com contadores (status, idioma, bairro, classe, arquivados, ordenação) e botão de reset.
  - `RelatorioResultados.jsx`: visualização híbrida responsiva (cards interativos com ações em telas pequenas / mobile e tabela com colunas detalhadas em desktop), suportando multi-expansão de histórico, links de visualização no mapa, badges de recência e cópia de anotações.
- **Redução de Acoplamento em `src/Relatorios.jsx`**:
  - `src/Relatorios.jsx` foi reduzido de **1.889 linhas** para **650 linhas** (redução de 65.6%), delegando renderização visual e exportação PDF para módulos especializados.
- **Cobertura de Testes de Unidade (`tests/unit/relatorioUtils.test.js`)**:
  - 22 testes unitários cobrindo conversão de datas, chaves canônicas de territórios, bounds, cálculos de centro, regras de status de progresso, links de mapa, ordenação de opções e formatação de tempo em linguagem natural.
- **Validações de P1e**:
  - `npm.cmd run lint`: 0 problemas (0 erros, 0 advertências).
  - `npm.cmd run test:unit`: 81 testes aprovados (8 suites) em 810ms.
  - `npm.cmd run build`: Sucesso em 5.39s. Bundle do chunk `Relatorios` reduzido de ~75 kB para 44 kB gzipped, com `jspdf` e `jspdf-autotable` carregados dinamicamente em chunks sob demanda.

---

---

## 6. P4: Worker de Relay de Notificações (`workers/notifications-relay/src/index.js`) (Concluído)

### 6.1 P4a: Proteção por Testes Automatizados e Mocks Sintéticos
- **Configuração Vitest**:
  - Criado [workers/notifications-relay/vitest.config.js](../workers/notifications-relay/vitest.config.js) isolado para a execução da suite do Worker sem misturar dependências Web/browser.
  - Adicionado script `"test": "vitest run --config vitest.config.js"` em [workers/notifications-relay/package.json](../workers/notifications-relay/package.json).
  - Adicionado script raiz `"worker:test": "vitest run --config workers/notifications-relay/vitest.config.js"` em [package.json](../package.json).
- **Suite de Testes Unitários ([workers/notifications-relay/test/notificationsRelay.test.js](../workers/notifications-relay/test/notificationsRelay.test.js) - 20 testes)**:
  - Geração dinâmica de pares de chaves RSA WebCrypto para simulação sintética de JWKS Firebase e Service Account Google, sem depender de rede nem carregar secrets reais.
  - Cobertura dos 13 casos mínimos obrigatórios do plano técnico:
    1. Rejeição de ID token ausente (HTTP 401).
    2. Rejeição de ID token mal formatado (HTTP 500) e expirado (rejeição na verificação criptográfica).
    3. Rejeição de tokens com audience (`aud`) ou issuer (`iss`) incorretos.
    4. Bloqueio de usuário com papel não-admin tentando enviar broadcast (HTTP 403).
    5. Validação de ações inexistentes e destinos inválidos de broadcast (HTTP 400).
    6. Envio bem-sucedido de broadcast por administrador para o grupo `admins` (HTTP 200).
    7. Envio direto de `notify` individual por administrador para um publicador (HTTP 200).
    8. Envio de `notify` para `ADMINS`:
       - Publicador comum enviando notificação de `conclusao` ou `devolucao` (permitido, HTTP 200).
       - Usuário aguardando aprovação enviando notificação de `cadastro` (permitido, HTTP 200).
       - Publicador comum tentando enviar notificação de `cadastro` (bloqueado, HTTP 403).
    9. Destinatário inexistente tratado graciosamente sem lançar exceção não capturada.
    10. Deduplicação estrita de FCM tokens repetidos no destinatário.
    11. Fallback automático para FCM quando o canal primário OneSignal falhar com 0 entregas.
    12. Concorrência limitada via `mapWithConcurrencyLimit` com processamento em lotes e isolamento de falhas por token.
    13. Magic Link rejeitando e-mails mal formatados (HTTP 400) e gerando links válidos via IdentityToolkit.
    14. CORS / preflight: requisições OPTIONS retornando HTTP 204 com cabeçalhos `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers` e cabeçalho `Vary: Origin`.

### 6.2 P4b: Consultas Proporcionais ao Destino
- **Autorização Prévia sem Leituras Desnecessárias**:
  - A chamada incondicional e prematura a `listUsuarios(env, accessToken)` que ocorria antes da verificação da ação e do papel do usuário foi completamente eliminada.
  - A autenticação, verificação de ID token e validação do usuário remetente ocorrem antes de qualquer busca de destinatários.
  - Se a requisição for negada (ex: remetente não-admin tentando broadcast), a resposta 403 é emitida imediatamente com **zero leituras adicionais no Firestore**.
- **Busca Direta por Identificador Canônico**:
  - Para `action === 'notify'` com destinatário específico (`para !== 'ADMINS'`), o documento de destino é lido diretamente pelo ID canônico (`usuarios/${encodeURIComponent(para)}`), sem jamais varrer a coleção inteira.
  - Para destinatários de perfil administrativo (`para === 'ADMINS'` ou broadcast para `admins`), foi implementada a função `queryUsuariosPorRole(env, accessToken, 'admin')` utilizando o endpoint REST `runQuery` do Firestore com filtro estruturado por campo (`role == admin`), reduzindo drasticamente o consumo de leituras com fallback resiliente para `listUsuarios` caso o projeto necessite.

### 6.3 P4c: Concorrência Limitada e Resiliência Push
- **Controle de Concorrência FCM**:
  - Criada a função `mapWithConcurrencyLimit(items, limit, asyncFn)` com `FCM_CONCURRENCY_LIMIT = 5`, garantindo que múltiplos envios para FCM nunca disparem requisições simultâneas irrestritas que possam saturar a rede ou atingir rate limits.
  - Cada envio é isolado em bloco `try/catch` individual: se um token for rejeitado ou expirar, a falha é computada em `pushesFalharam` sem abortar os demais envios do lote.
- **Header `Vary: Origin`**:
  - Adicionado cabeçalho `Vary: Origin` em todas as respostas CORS dinâmicas geradas pela função `corsHeaders(request)`.

### 6.4 Validações de P4
- **`npm.cmd run lint`**: 0 problemas (0 erros, 0 advertências).
- **`npm.cmd run worker:test`**: 20 testes aprovados em 168ms.
- **`npm.cmd run test:unit`**: 81 testes de frontend aprovados (8 suites) em 1.15s.
- **`npm.cmd run test:smoke`**: Aprovado com sucesso no emulador local do Firebase (todas as regras e fluxos de endereços/grupos validados).
- **`npm.cmd run build`**: Aprovado em 6.55s, gerando todos os chunks de produção e bundles PWA sem anomalias.
- **`git diff --check`**: 0 advertências de whitespace.

---

## 7. P5: Rules com Matriz de Autorização e Simplificação Pontual (Concluído)

### 7.1 Matriz de Autorização por Papel e Operação

| Coleção / Recurso | Operação | Anônimo | Aguardando | Comum (não designado) | Comum (designado) | Admin | Observações e Invariantes |
|---|---|---|---|---|---|---|---|
| `usuarios/{userId}` | `get` | ❌ Negado | ❌ Negado | ❌ Negado (exceto se `meuEmail() == userId`) | ❌ Negado (exceto se `meuEmail() == userId`) | ✅ Permitido | Leitura direta do próprio perfil permitida a qualquer autenticado |
| `usuarios/{userId}` | `list` / query | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | Apenas admin pode listar todos os usuários |
| `usuarios/{userId}` | `create` | ❌ Negado | ✅ Permitido (apenas próprio email, role `aguardando`) | ❌ Negado (já criado) | ❌ Negado | ✅ Permitido | Auto-cadastro restrito a status/role aguardando com ID igual ao e-mail |
| `usuarios/{userId}` | `update` | ❌ Negado | ❌ Negado | ❌ Negado (exceto auto-atualização de campos cosméticos/FCM token) | ❌ Negado (exceto auto-atualização de campos cosméticos/FCM token) | ✅ Permitido | Proibida auto-elevação de privilégio (`role`) ou alteração de status por não-admin |
| `usuarios/{userId}` | `delete` | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado (cliente) | Deleção de usuários vetada no cliente |
| `enderecos/{id}` | `read` (get/list) | ❌ Negado | ❌ Negado | ✅ Permitido (ativos) | ✅ Permitido (ativos) | ✅ Permitido (todos) | Publicador só lê endereços ativos; admin lê ativos e arquivados |
| `enderecos/{id}` | `create` | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | Criação exclusiva de administrador |
| `enderecos/{id}` | `update` | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado (exceto via território designado) | ✅ Permitido | Publicador não pode alterar campos básicos (rua, bairro, notas) de endereços fora do seu território |
| `enderecos/{id}` | `delete` | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | Exclusão física vetada para todos |
| `grupos_enderecos/{id}` | `read` (get/list) | ❌ Negado | ❌ Negado | ✅ Permitido | ✅ Permitido | ✅ Permitido | Leitura de grupos para visualização de cobertura no mapa |
| `grupos_enderecos/{id}` | `create` | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | Criação de territórios exclusiva de admin |
| `grupos_enderecos/{id}` | `update` (designação/devolução) | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | Apenas admin designa ou remove designação de territórios |
| `grupos_enderecos/{id}` | `update` (visitas/execução) | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido (apenas no território designado a ele) | ✅ Permitido | Validação estrita por `metadadosExecucaoGrupoEnderecoValidos()`, requer `status: 'ativo'`, `enderecosVisitadosIds`, `atualizadoEm`, `atualizadoPor: meuEmail()` |
| `grupos_enderecos/{id}` | `delete` | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | Exclusão física vetada para todos |
| `configuracoes/{id}` | `read` | ❌ Negado | ❌ Negado | ✅ Permitido | ✅ Permitido | ✅ Permitido | Leitura de padrões e idiomas ativos |
| `configuracoes/{id}` | `write` | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | Escrita restrita a administradores |
| `comunicados/{id}` | `read` | ❌ Negado | ❌ Negado | ✅ Permitido | ✅ Permitido | ✅ Permitido | Leitura de comunicados pelos publicadores |
| `comunicados/{id}` | `write` | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | Escrita de comunicados restrita a administradores |
| `campanhas/{id}` | `read` | ❌ Negado | ❌ Negado | ✅ Permitido | ✅ Permitido | ✅ Permitido | Leitura de campanhas ativas |
| `campanhas/{id}` | `write` | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | Gestão de campanhas restrita a administradores |

### 7.2 Suite Dedicada de Testes de Regras (`scripts/test-firestore-rules.mjs`)
- Criado o script [scripts/test-firestore-rules.mjs](../scripts/test-firestore-rules.mjs) executando 52 asserções detalhadas contra o emulador local do Firestore (`@firebase/rules-unit-testing`).
- Adicionado script ao [package.json](../package.json): `"test:rules": "firebase emulators:exec --project territorios-idiomas-rules --only firestore \"node scripts/test-firestore-rules.mjs\""`.
- Cobertura das seguintes categorias:
  1. Acesso anônimo (bloqueio universal em todas as coleções).
  2. Usuário com papel `aguardando` (bloqueio de leitura de endereços e territórios; permissão apenas para criação do próprio documento de usuário e leitura de seu próprio perfil).
  3. Usuário comum não designado (leitura de endereços ativos e grupos de endereços; bloqueio de leitura de usuários e de endereços arquivados; bloqueio de atualização em territórios dos quais não é designado; bloqueio de auto-elevação para `admin`).
  4. Usuário comum designado (permissão para marcar visitas no território que lhe foi designado via `metadadosExecucaoGrupoEnderecoValidos()`; bloqueio se tentar marcar endereço fora do grupo, duplicar IDs visitados, ou alterar campos cadastrais protegidos).
  5. Administrador (acesso irrestrito para leitura e escrita administrativa; respeito às regras de integridade e bloqueio de exclusão física).

### 7.3 Simplificação Pontual em `firestore.rules`
- Identificada e corrigida duplicação no bloco `match /grupos_enderecos/{grupoId}`:
  - Existiam duas declarações separadas de `allow update` com condições idênticas de metadados e autorização.
  - As declarações foram unificadas em uma única regra limpa e sem redundância, mantendo todas as proteções intactas.

### 7.4 Validações de P5
- **`npm.cmd run test:rules`**: 52 asserções aprovadas com êxito no emulador local em 3.9s.
- **`npm.cmd run test:smoke`**: 100% aprovado no emulador com todas as regras e bloqueios de domínio intactos.
- **`npm.cmd run test:unit`**: 81 testes de frontend aprovados (8 suites).
- **`npm.cmd run worker:test`**: 20 testes do worker aprovados.
- **`npm.cmd run lint`**: 0 problemas (0 erros, 0 advertências).
- **`npm.cmd run build`**: Aprovado com sucesso.
- **`git diff --check`**: 0 advertências de whitespace.

---

## 8. P6: Desempenho Medido por Fluxo (Concluído)

### 8.1 Linha de Base e Grafo de Chunks

A análise estática detalhada do grafo de dependências e dos chunks gerados pelo Rollup/Vite revelou o seguinte comportamento na linha de base:

1. **Grafo Inicial de Entrada (Login / Shell do Dashboard)**:
   - O chunk de entrada (`index-*.js`) carregava estaticamente `react-vendor`, `firebase-core`, `firebase-auth`, `firebase-firestore`, `firebase-transport` e, inadvertidamente, `map-vendor` (Leaflet).
   - Causa raiz: `manualChunks` no `vite.config.js` capturava `leaflet/dist/leaflet.css` (importado em `main.jsx`) e o atribuía ao chunk `map-vendor`. Isso forçava o Rollup a criar uma dependência estática de `index-*.js` para `map-vendor-*.js`, puxando **151.88 kB (44.22 kB gzip)** desnecessariamente antes mesmo de o mapa ser aberto.

2. **Rotas com Code-Splitting Sob Demanda (`React.lazy`)**:
   - `Mapa` (`/`): carregado sob demanda apenas após autenticação e navegação para o mapa (134.73 kB, 37.67 kB gzip).
   - `AdminPanel` (`/admin`): carregado sob demanda apenas para administradores (81.91 kB, 20.79 kB gzip).
   - `Relatorios` (`/relatorios`): carregado sob demanda apenas quando a tela de relatórios é acessada (42.78 kB, 12.08 kB gzip).

3. **Bibliotecas Pesadas de Exportação PDF (`jspdf`, `jspdf-autotable`, `canvg`, `html2canvas`)**:
   - As bibliotecas de PDF somam **786.64 kB não-comprimido (240 kB gzip)**.
   - Foram completamente isoladas atrás da ação explícita de exportação (`exportarRelatorioTerritoriosPdf` via `import('jspdf')` e `import('jspdf-autotable')`).
   - Nenhuma biblioteca de PDF é carregada estaticamente ou antecipada em efeitos no fluxo inicial do publicador, no login ou no AdminPanel.

4. **Precache do Service Worker (PWA v1.3.0)**:
   - A configuração original usava `globPatterns: ['**/*.{js,css,html,ico,png,svg}']` sem exclusões, incluindo 44 entradas totalizando **3.060,29 KiB (~3,28 MB)** no download inicial de instalação do PWA.
   - Arquivos não essenciais estavam inflando o precache:
     - `play-feature-graphic.png` (199.25 kB) — banner da Google Play Store não utilizado no app.
     - `icon-general-512.png` (218.89 kB) e `icon-general-192.png` (39.10 kB) — ícones de instância alternativa não utilizados na versão `idiomas`.
     - Chunks dinâmicos de PDF (`jspdf`, `html2canvas`, `index.es/canvg`, `purify.es`) (786.64 kB).

### 8.2 Otimizações Implementadas em `vite.config.js`

1. **Guarda de CSS em `manualChunks`**:
   - Adicionada a regra `if (normalizedId.endsWith('.css')) return;` no início de `manualChunks`.
   - O CSS do Leaflet continua sendo extraído no bundle de estilos (`index-*.css`), mas o arquivo JS `map-vendor-*.js` é **100% desvinculado** do chunk de entrada `index-*.js`.
   - **Ganho**: Redução imediata de **151.97 kB (-44.25 kB gzip)** na carga inicial de JavaScript da aplicação (Login / Shell).

2. **Precache Seletivo com Cache sob Demanda no Workbox**:
   - Configurado `globIgnores` no VitePWA para ignorar no precache inicial:
     - Imagens de marketing da Play Store e ícones da instância alternativa (`**/play-feature-graphic.png`, `**/icon-general-*.png`).
     - Chunks de exportação PDF (`**/jspdf*`, `**/html2canvas*`, `**/index.es*`, `**/purify.es*`).
   - Adicionada regra de `runtimeCaching` com estratégia `StaleWhileRevalidate` e cache dedicado `pdf-export-cache` (validade de 30 dias) para os chunks de PDF quando requisitados pelo usuário.
   - **Ganho**: O payload do precache do PWA caiu de **3.060,29 KiB (44 entradas) para 1.815,40 KiB (35 entradas)**, representando uma economia de **1.244,89 KiB (-40.7%)** na instalação do PWA, preservando integralmente o funcionamento offline após a primeira exportação de PDF.

### 8.3 Comparativo de Métricas Antes e Depois

| Fluxo / Métrica | Antes de P6 | Depois de P6 | Variação Absoluta | Variação Relativa |
|---|---|---|---|---|
| **JS Inicial (Login / Shell)** | 1.099,94 kB (gzip: 331,20 kB) | 947,97 kB (gzip: 286,95 kB) | **-151,97 kB (gzip: -44,25 kB)** | **-13.8% (-13.4% gzip)** |
| **Precache PWA (Instalação)** | 3.060,29 KiB (44 arquivos) | 1.815,40 KiB (35 arquivos) | **-1.244,89 KiB (-9 arquivos)** | **-40.7% de payload** |
| **Rota do Mapa (Publicador)** | Chunks carregados sob demanda | Chunks carregados sob demanda (`map-vendor` entra apenas aqui) | Sem impacto em login | Isolamento estrito mantido |
| **Rota de Relatórios** | 42.86 kB (gzip: 12.10 kB) | 42.78 kB (gzip: 12.08 kB) | Estável | PDF isolado sob clique |
| **Exportação PDF** | 787 kB carregados sob clique | 787 kB carregados sob clique + `runtimeCaching` | Cache local de 30 dias | Offline garantido pós-uso |

---

## 9. Verificação Final e Conformidade com o Plano Técnico

Conforme a Seção 10 do [docs/plano-tecnico-revisao-antigravity.md](file:///c:/Projetos/territorios-idiomas/docs/plano-tecnico-revisao-antigravity.md), todos os comandos de encerramento foram executados individualmente no ambiente Windows PowerShell, sem falhas ou erros intermediários:

### 9.1 Resultados dos Comandos Finais

1. **`npm.cmd run test:unit`**:
   - 8 suites executadas em 1.16s.
   - **81 testes aprovados (100% de sucesso)**.
   - Cobertura: Bairros SBS, Live Update Android/Capacitor, Atualização Web/PWA, Códigos Manuais, Progresso de Territórios, Configuração de Idiomas, Importação CSV e Utilitários de Relatórios.

2. **`npm.cmd run worker:test`**:
   - 1 suite executada em 891ms.
   - **20 testes aprovados (100% de sucesso)**.
   - Cobertura: Autenticação Firebase ID token, autorização por role, broadcast, notify individual, notify ADMINS, fallback OneSignal/FCM, concorrência limitada FCM (limite 5), Magic Link e CORS com `Vary: Origin`.

3. **`npm.cmd run test:rules`**:
   - Suite de regras executada no Firestore Emulator em 3.9s.
   - **52 asserções aprovadas (100% de sucesso)**.
   - Cobertura completa da matriz de autorização para papéis: anônimo, aguardando, comum não designado, comum designado e admin.

4. **`npm.cmd run test:smoke`**:
   - Smoke test integrado executado no Firebase Emulator (Auth + Firestore).
   - **100% de sucesso (código de saída 0)**.
   - Regras de integridade de código, duplicidade de endereços/territórios, vinculação entre idiomas e metadados de execução validadas com êxito.

5. **`npm.cmd run lint`**:
   - ESLint v9 executado em todos os arquivos `.js` e `.jsx`.
   - **0 erros, 0 advertências**.

6. **`npm.cmd run build`**:
   - Vite v7.3.6 gerou o bundle de produção em 4.81s sem erros.
   - Precache PWA v1.3.0 gerado com 35 entradas otimizadas (1.815,40 KiB).
   - Arquivos `version.json` e `android/app/build.gradle` preservados sem bump indevido.

7. **`git diff --check`**:
   - Executado sem nenhum erro de whitespace (trailing spaces corrigidos).

8. **`git status --short`**:
   - Apenas os arquivos do escopo foram modificados.
   - Nenhuma alteração não intencional ou arquivo temporário residual.

---

## 10. Conclusão da Revisão Técnica

Todas as fases do plano técnico foram concluídas com sucesso rigoroso:
- **Preparação & P3**: Build idempotente comprovado via SHA-256 e documentação de scripts consolidada no README.
- **P2**: Criação de 59 testes unitários cobrindo o núcleo de regras de negócio de endereços, territórios, bairros e atualização.
- **P1**: Modularização de 4 arquivos gigantescos (`Mapa.jsx`, `App.jsx`, `AdminPanel.jsx`, `Relatorios.jsx`), resultando na criação de arquitetura modular em `src/mapa/`, `src/app/`, `src/admin/` e `src/relatorios/`, com acréscimo de 22 testes unitários adicionais.
- **P4**: Endurecimento do Cloudflare Worker com 20 testes unitários offline, eliminação de listagens desnecessárias de usuários, consultas proporcionais e concorrência limitada para FCM.
- **P5**: Construção da matriz de autorização do Firestore Rules, suite dedicada com 52 asserções no emulador local e simplificação pontual da duplicação em `grupos_enderecos`.
- **P6**: Otimização de bundle e precache no Vite/PWA, reduzindo o JS inicial em 152 kB e o payload de precache PWA em 1,24 MB (40.7%), com isolamento completo das bibliotecas de PDF e Leaflet.
- **Compromissos estritos cumpridos**: Nenhum commit, nenhum push, nenhum deploy remoto e nenhuma gravação em banco de produção.


