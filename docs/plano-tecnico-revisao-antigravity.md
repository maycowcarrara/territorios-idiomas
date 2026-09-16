# Plano técnico da revisão geral: pontos 1 a 6

Data de referência: 16/09/2026. Projeto: `C:\Projetos\territorios-idiomas`.

Este documento é um roteiro de implementação para o Antigravity. Nenhuma das melhorias abaixo é considerada implementada por este planejamento. Os nomes de novos arquivos são sugestões; confirme os padrões atuais antes de criá-los.

## 1. Objetivo e sequência

Melhorar manutenção, previsibilidade e desempenho, preservando os fluxos de cadastro, importação, designação, execução e finalização de territórios.

Os números P1 a P6 correspondem aos pontos da revisão original. A ordem de execução muda para criar proteção antes das refatorações:

| Ordem | Ponto | Entrega | Dependência | Risco principal |
| --- | --- | --- | --- | --- |
| 0 | Preparação | Estado inicial e contratos registrados | Nenhuma | Misturar trabalho existente |
| 1 | P3 | Documentação de build e versão alinhada | Preparação | Incrementar versão inadvertidamente |
| 2 | P2 | Testes de regras de negócio e atualização | Preparação | Testes com rede real ou pouco representativos |
| 3 | P1 | Componentes e responsabilidades separados | P2 | Regressão de estado, listeners e mapa |
| 4 | P4 | Worker testado e consultas proporcionais ao destino | P2 | Alterar destinatários ou duplicar notificações |
| 5 | P5 | Rules testadas e simplificadas pontualmente | P2 | Ampliar permissões ou quebrar legado |
| 6 | P6 | Medições e otimizações comprovadas | P1, P4, P5 | Confundir chunk menor com carregamento menor |

Executar sequencialmente no mesmo checkout. P4 e P5 são independentes entre si, mas não devem ser editados simultaneamente com mudanças nos manifests e lockfiles compartilhados.

## 2. Instruções permanentes para o executor

- Começar com `git status --short`, ler eventuais `AGENTS.md` aplicáveis e inspecionar o diff dos arquivos que serão tocados.
- Preservar alterações preexistentes. Não usar reset, checkout de arquivos, stash automático ou limpeza de diretórios para obter um checkout limpo.
- Esta execução cobre alterações e validações locais. Commit, push, deploy, migração, seed remoto e gravação em produção dependem de autorização explícita separada.
- Não executar `git-push`, `deploy:all`, `web:deploy`, `deploy:rules`, `worker:deploy`, `seed:config:enderecos`, backfill ou importação remota durante estas etapas.
- Testes devem usar dados sintéticos, emuladores ou mocks. Não enviar push, e-mail, geocodificação em lote ou notificações reais.
- Ao tentar validar no navegador, se a primeira tentativa falhar, interromper essa validação e pedir ajuda ao usuário. Não insistir com outras sessões, seletores ou logins. Prosseguir apenas no trabalho independente; registrar a prova visual como pendente.
- Manter React/Vite/Firebase/Capacitor e JavaScript. Não introduzir TypeScript, store global, novo backend ou troca de biblioteca de mapas neste escopo.
- Conservar coleções, IDs e contratos de `enderecos`, `grupos_enderecos`, `grupoId`, `grupoCodigo`, `grupoDesignadoPara`, designação e histórico.
- Manter cores de status/seleção nos marcadores E e bairro/dias nos marcadores T. Não redesenhar essa convenção.
- Prévia da importação deve continuar sem escrita; aplicação continua sendo ação explícita. O código atual também atualiza campos permitidos de cadastros existentes: preservar esse comportamento, sem mover vínculos conflitantes silenciosamente.
- Revisar ajuda/documentação quando alguma mudança afetar o comportamento visível. Preservar textos em pt-BR.
- Parar uma fase dependente se os testes relevantes falharem; diagnosticar sem remover assertions ou enfraquecer permissões para obter aprovação.

## 3. Preparação e estado inicial

### Evidências da leitura atual

- `src/Mapa.jsx`, `src/App.jsx`, `src/AdminPanel.jsx` e `src/Relatorios.jsx` concentram várias responsabilidades. Use nomes de símbolos como referência; linhas e tamanhos mudam durante o trabalho.
- `App.jsx` já utiliza `lazy()` para mapa, administração e relatórios. `Relatorios.jsx` já usa importação dinâmica de `jspdf` e `jspdf-autotable`.
- `vite.config.js` já separa dependências em chunks; o precache Workbox inclui `**/*.{js,css,html,ico,png,svg}`.
- Há smoke integrado em `scripts/smoke-enderecos-grupos-emulator.mjs`; não há scripts de teste unitário na raiz nem de teste no pacote do Worker.
- `README.md` afirma que `build` incrementa versão, mas `package.json` define `build` como Vite e `build:bump` como incremento seguido de build.
- `handleNotificationRelayRequest` chama `listUsuarios` antes das verificações específicas de autorização de `broadcast`/`notify`.
- Lint, build e smoke passaram na revisão anterior desta conversa. Não foram repetidos na elaboração deste documento; registrar uma nova linha de base antes de implementar.

Existiam alterações locais nestes arquivos ao elaborar o plano:

```text
android/app/src/main/java/br/com/territoriosidiomas/app/NativeLiveUpdatePlugin.java
android/build.gradle
package-lock.json
package.json
public/version.json
scripts/use-android-firebase-config.cjs
src/App.jsx
src/Mapa.jsx
src/nativeLiveUpdate.js
src/updateUtils.js
src/version.json
```

Essa lista é informativa; o `git status` atual prevalece. Não modificar os arquivos Android neste plano sem uma necessidade demonstrada e registrada.

### Procedimento inicial

1. Registrar branch/HEAD, status, versões de Node/npm/Java e disponibilidade das dependências locais. Não instalar versões globais nem atualizar dependências em massa.
2. Ler os arquivos-alvo e seus consumidores. Comparar qualquer recomendação deste documento com o código atual.
3. Criar `docs/execucao-revisao-tecnica.md` com estado inicial, evidências, decisões e status de cada fase.
4. Rodar os comandos abaixo, separadamente, na raiz. O smoke deve acessar apenas os emuladores indicados; conferir variáveis de ambiente herdadas e o projeto antes de executar.

```powershell
git status --short
git diff --stat
npm.cmd run lint
npm.cmd run build
npm.cmd exec -- firebase emulators:exec --project territorios-idiomas-smoke --only firestore,auth "node scripts/smoke-enderecos-grupos-emulator.mjs"
git diff --check
```

No smoke, negações esperadas de permissão são parte dos testes. Avaliar assertions e código de saída; não interpretar qualquer `PERMISSION_DENIED` como defeito. Se uma dependência estiver ausente, instalar a versão compatível com os manifests/lockfiles e registrar isso.

## 4. P3: alinhar build, versão e documentação

### Arquivos

`README.md`, `package.json`, `gerar-versao.js`, `scripts/create-live-update-bundle.cjs`, `src/version.json`, `public/version.json` e scripts Android apenas para leitura dos contratos.

### Implementação

1. Mapear os comandos existentes em uma tabela: finalidade, incremento de versão, geração de artefato e publicação.
2. Corrigir a documentação para o contrato atual: `build` compila sem incrementar; `build:bump` incrementa e compila; publicação web utiliza `build:bump` e o pacote live-update.
3. Explicar a distinção entre build web, pacote OTA/live-update e binário Android. Documentar quais scripts realmente alteram cada versão, sem presumir que build Android incrementa tudo.
4. Manter os aliases atuais. Não remover scripts nem mudar política de release para resolver uma divergência documental.
5. Conferir coerência de versão entre package, lockfile e JSONs. Se houver divergência anterior, registrá-la; não sobrescrever o trabalho de versão já em andamento.
6. Verificar que um `build` comum deixa intactos o conteúdo e os hashes dos arquivos de versão/manifests monitorados antes e depois. Não rodar `build:bump` no checkout apenas para testar a documentação.

### Aceite

- README descreve os scripts reais e distingue compilar, incrementar e publicar.
- `npm.cmd run build` passa sem introduzir alterações nos arquivos de versão.
- Nenhuma versão é incrementada e nenhum comando de publicação é executado por esta fase.

## 5. P2: testes de comportamento

### Arquivos e estrutura sugerida

Criar `vitest.config.js` e `tests/unit/`. Acrescentar scripts `test:unit` e `test:unit:watch`; manter o smoke existente e criar um alias `test:smoke` para o comando local da preparação.

Selecionar versões de Vitest e, apenas se necessário, ambiente DOM compatíveis com o Node/Vite instalados. Usar configuração de testes separada para não carregar o plugin PWA nem registrar service worker nos testes. Limitar descoberta a `tests/unit/**/*.test.js`; excluir suites do Worker, Rules, Android e arquivos gerados. Usar imports explícitos de APIs do Vitest para evitar globals implícitos no ESLint.

### Casos obrigatórios

| Área | Símbolos/arquivo existentes | Casos relevantes |
| --- | --- | --- |
| CSV | `parseEnderecoCsvRows`, `buildEnderecoCsvPreview`, `analyzeEnderecoCsvImport`, `applyEnderecoCsvGeocoding` em `enderecoCsvImport.js` | Cabeçalhos/aliases, aspas e quebras de linha, BOM e formato aceito, coordenadas alternativas, fora da área, duplicados, conflitos, inserção, atualização permitida, nenhuma mudança e item bloqueado |
| Códigos | `normalizeCodigoManual`, `isCodigoManualValido`, formatadores e geradores de ID em `enderecoModel.js` | Maiúsculas/espaços, formato inválido, códigos manuais/legados e distinção entre código exibido e ID do documento |
| Configuração | `enderecoConfig.js` | Idioma padrão, idiomas duplicados/inativos e padrões de código por idioma |
| Bairros | `normalizeBairroNome`, `normalizeBairroKey`, `resolveBairroNomeOficial`, `buildBairroId` em `bairrosSbs.js` | Acentos, espaços, prefixos reconhecidos, nome desconhecido e valores vazios |
| Progresso | `getGrupoEnderecoProgresso`, `calculateGrupoEnderecoStats` em `enderecoModel.js` | Grupo vazio, parcial/completo, IDs visitados inválidos/repetidos e endereços arquivados conforme contrato atual |
| Atualização | `checkForUpdateStatus` e wrapper em `updateUtils.js`; `nativeLiveUpdate.js` | Versão igual/diferente, falha HTTP/rede, modo manual/automático, atualização nativa disponível/instalada e retorno booleano do wrapper |

### Implementação

1. Criar fixtures sintéticas pequenas, com resultado esperado explícito. Não copiar planilhas pessoais ou dados de produção.
2. Cobrir os módulos existentes antes de extraí-los. Importar funções puras de `enderecoModel.js` sem inicializar banco; só extrair helpers quando o acoplamento realmente impedir o teste isolado.
3. Para CSV, testar a precedência atual das coordenadas e correção de sinal apenas quando sustentada pela área configurada. Não chamar Nominatim; simular geocodificação.
4. Provar que analisar a planilha não chama escrita nem geocodificação externa automática. Validar que conflitos de território permanecem bloqueados e os totais refletem todas as categorias.
5. Para atualização, simular `fetch`, Capacitor, `navigator.serviceWorker`, localização e timers; restaurar os mocks após cada teste. Não chamar plugin Android real nem navegar/recarregar a página de teste.
6. Verificar que atualização PWA não atualiza registros OneSignal; redirecionamento manual preserva a rota/hash e recarga nativa só ocorre na condição implementada. Usar timers controlados.
7. Distinguir comportamento atual de comportamento desejado. Se surgir defeito, adicionar caso reproduzível e registrar uma correção pequena; não alterar regra de produto por inferência.

### Aceite

- Suite unitária determinística, sem credenciais, emulador ou rede real.
- Resultado cobre decisões de domínio, não somente snapshots/formatos internos.
- `test:unit`, lint e build passam. Smoke continua passando se alguma função de domínio tiver sido alterada.
- Não exigir porcentagem arbitrária de cobertura; registrar quais riscos foram cobertos e quais faltam.

## 6. P1: separar responsabilidades dos componentes grandes

### Estratégia

Realizar extrações pequenas com verificação entre elas. Reduzir linhas não é o critério de sucesso: cada módulo deve ter responsabilidade reconhecível, sem importações circulares nem duplicação de estado remoto.

| Origem | Primeiras extrações sugeridas | Preservar na origem inicialmente |
| --- | --- | --- |
| `Mapa.jsx` | Formulários, controles, marcadores/camadas e helpers de apresentação | Orquestração do mapa, assinaturas e estado compartilhado |
| `App.jsx` | Modais, menu, notificações; depois sessão/autenticação | Composição de rotas, guards e integração dos fluxos globais |
| `AdminPanel.jsx` | Conteúdo de cada aba e fluxo de prévia/aplicação CSV | Coordenação das abas e dados compartilhados |
| `Relatorios.jsx` | Filtros/agregações puras, tabelas, exportação PDF | Estado dos filtros e composição da tela |

### Sequência de implementação

1. **P1a, mapa visual:** mover `EnderecoFormModal`, `GrupoEnderecoFormModal` e modais correlatos para `src/mapa/components/`; controles para `src/mapa/controls/`; camadas para `src/mapa/layers/`. Mover os estilos/helpers usados junto do componente quando fizer sentido. Preservar props e comportamento.
2. **P1b, mapa e efeitos:** só depois identificar hooks coesos em `src/mapa/hooks/` para localização, eventos ou dados. Garantir uma assinatura por responsabilidade e cleanup de watchers, listeners, timers e requests. Não criar um hook genérico de centenas de linhas que apenas esconda o componente original.
3. **P1c, app:** extrair modais/menu primeiro; isolar `useAuthSessionState` e componentes de autenticação depois. Revisar consumidores/contextos antes de mover estado. Manter Google login, magic link, deep links, botão voltar Android, guard de admin e atualização manual.
4. **P1d, admin:** separar por abas reais de `ADMIN_TABS`, incluindo o fluxo de importação. Manter bloqueio offline, prévia, confirmação, resultado e destaque dos endereços importados no mapa.
5. **P1e, relatórios:** extrair cálculos/filtros testáveis e o gerador PDF. Conservar links para o mapa, totais, bairros, idiomas e arquivados. Manter carregamento dinâmico do exportador e de suas bibliotecas.
6. Usar imports diretos. Evitar barrels que tragam todas as telas para o mesmo grafo de importação, contexts criados só para eliminar duas props e memoização indiscriminada.
7. Após cada lote, rodar unitários, lint e build. Rodar smoke quando domínio, consultas ou integrações de escrita forem tocados; não repetir a suite pesada para cada simples movimentação de JSX.

### Validação funcional

No navegador local, validar uma sessão sintética/admin e uma de publicador em ambiente de teste, em viewport desktop e mobile. Confirmar disponibilidade desse ambiente antes de qualquer gravação. Sem ambiente seguro, validar leitura disponível e registrar operações não comprovadas.

- Mapa: E/T, seleção/foco, bairros, popup mobile, controles ocultados/restaurados, clique longo e ausência de clique fantasma ao fechar popup.
- Cadastro: abas Dados/Histórico, validação de obrigatórios e estado ao abrir/fechar o modal.
- Territórios: designação, marcar/desmarcar, devolver, finalizar e atualização de totais em emulador.
- App: login/saída, guard, navegação direta, consulta de versão e notificações simuladas.
- Relatórios: filtros, totais consistentes e geração de PDF com conteúdo conferido.

Aplicar a regra de interrupção na primeira falha de navegador. O build web não comprova comportamento Android; registrar validações que exigem dispositivo separadamente.

### Aceite

- Responsabilidades separadas sem mudança intencional de produto ou contrato de dados.
- Sem duplicação de assinatura Firestore, watcher GPS ou listener Leaflet após montar/desmontar.
- Testes passam; verificações visuais realizadas ou explicitamente pendentes com motivo.
- Cada subetapa tem diff revisável e evidência no registro de execução.

## 7. P4: simplificar e testar o Worker

### Arquivos

`workers/notifications-relay/src/index.js`, seu `package.json`, configurações Wrangler e README; `firestore.indexes.json` somente se uma consulta nova realmente exigir índice. Conferir também os consumidores do relay no frontend.

### Implementação em três lotes

**P4a, proteção por testes.** Configurar testes locais com a integração oficial Cloudflare/Vitest compatível com as dependências instaladas. Usar configuração própria do pacote, env fictício, mocks de todas as saídas HTTP e bloqueio de rede não interceptada. Não carregar secrets reais ou executar `sync-env` para testar. Testar handlers públicos sem substituir por mocks toda a lógica de autenticação/autorização que se pretende verificar.

Casos mínimos: token ausente/inválido/expirado; issuer/audience incorretos; usuário aguardando/comum/admin; ação/destino inválidos; broadcast autorizado/negado; notify direto; notify para ADMINS nos tipos permitidos; destinatário inexistente; tokens repetidos; OneSignal indisponível/falhando; falha parcial FCM; magic link com entrada inválida; e CORS/preflight.

**P4b, consulta de destinatários.** Manter validação de ID token e leitura do remetente; concluir autorização e validação da ação antes de buscar destinatários. Notificação individual deve ler diretamente o documento de destino pelo identificador canônico atual. ADMINS deve consultar `role == admin`. Broadcast geral deve selecionar os mesmos perfis atuais (`admin`/`comum`), com paginação/lotes compatíveis com a API adotada. Não carregar todos os usuários em um notify individual. Não assumir que a API `runQuery` usa a mesma paginação da API de listagem; consultar a documentação ao implementá-la.

Comparar listas antes/depois em fixtures com mais de uma página e perfis misturados. Preservar IDs, codificação de e-mail nos paths, deduplicação de tokens, filtros, formato das notificações, destinos de links e contadores da resposta. Não adicionar filtro por status ou excluir um perfil que hoje recebe sem uma decisão de produto.

**P4c, organização e resiliência.** Extrair somente responsabilidades úteis, por exemplo autenticação, acesso Firestore, destinatários e canais push. Substituir `Promise.all` irrestrito de FCM por concorrência limitada, testada com vários tokens. Tratar rejeições por destinatário sem perder o resultado do lote. Preservar a regra de fallback OneSignal/FCM e não introduzir retry automático que possa duplicar entregas. Logs devem conter operação, duração/contagem/status, sem tokens, chaves, magic links ou dados pessoais desnecessários.

### CORS e link de acesso

O código atual reflete o header Origin. Inventariar origens efetivas web, desenvolvimento e Capacitor antes de propor allowlist; não adivinhar a origem Android. Testar origem permitida, rejeitada, sem Origin e OPTIONS, incluindo `Vary: Origin` quando houver resposta variável. CORS não substitui autenticação nem impede chamadas diretas ao endpoint de magic link. Eventual rate limit deve ser planejado separadamente com armazenamento/binding apropriado, sem contador global em memória e sem ativar infraestrutura remota nesta execução.

### Aceite

- Requisição negada não lista destinatários, grava notificações nem chama canal push.
- Notify individual faz leitura de remetente/destino sem varrer coleção; consultas de grupos preservam destinatários em todas as páginas.
- Concorrência FCM respeita o limite e falha individual não oculta as demais entregas.
- Tests executam offline em runtime local e não geram e-mail/push real.
- Contrato HTTP continua compatível; mudanças de configuração, índices e prova Android pendentes ficam documentadas.

Referências: [boas práticas Workers](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) e [integração de testes Vitest](https://developers.cloudflare.com/workers/testing/vitest-integration/). Conferir APIs e versões na implementação; não copiar configuração obsoleta de teste.

## 8. P5: Rules com matriz de autorização e simplificação pontual

### Arquivos

`firestore.rules`, `firebase.json`, `firestore.indexes.json`, `scripts/smoke-enderecos-grupos-emulator.mjs` e novos `tests/rules/`.

### Implementação

1. Construir uma matriz com linhas por coleção/operação e colunas anônimo, aguardando, comum não designado, comum designado e admin. Preencher com o comportamento real de regras e chamadas. Cobrir também notas, notificações, usuários e configurações quando reutilizarem helpers alterados.
2. Criar suite com `@firebase/rules-unit-testing` compatível e configuração separada da suite unitária. Usar projetos de teste e emulador local obrigatórios, limpando apenas dados desses projetos. Fazer setup privilegiado só para fixtures; assertions de autorização devem usar clientes sujeitos às Rules.
3. Acrescentar casos para permissões permitidas e negadas: leitura direta e por query, tentativa de elevar role, atribuir grupo de outro usuário, alterar metadados protegidos, mudar campos fora da lista permitida, arquivar e excluir fisicamente.
4. Cobrir vínculos endereço/grupo, `grupoDesignadoPara`, progresso, finalização incompleta/completa, limpeza de designação e preservação do histórico. Incluir documentos legados sem metadados opcionais aceitos hoje e transações com leituras `getAfter` quando aplicáveis.
5. Conferir a diferença entre falha de validação do domínio e rejeição real das Rules: chamar o SDK diretamente nos testes negativos de segurança, sem depender de um helper frontend que bloqueie antes da requisição.
6. Só então simplificar duplicação demonstrada, guardas de campos opcionais e helpers. Não juntar permissões de admin/publicador por aparência similar; preservar campos permitidos e invariantes. Fazer uma alteração lógica por vez e repetir a matriz atingida.
7. Manter `firestore.rules` como fonte de publicação. Não criar divisão em vários arquivos com compilador próprio apenas para reduzir tamanho.
8. Melhorar resumo dos testes, agrupando negações esperadas. Não suprimir globalmente erros do SDK nem substituir assertions por filtros de log; deixar falhas inesperadas visíveis e com saída não zero.
9. Executar a suite de Rules e o smoke integral. Testar queries reais usadas pelo app; passar no emulador não comprova existência dos índices no ambiente remoto.

### Aceite

- Matriz documentada e testada antes/depois, incluindo legado e casos de tentativa de acesso indevido.
- Nenhuma permissão ampliada para facilitar refatoração; exclusão física de endereços/grupos continua negada ao cliente conforme o contrato atual.
- Smoke passa integralmente, negações esperadas ficam identificadas e erros inesperados continuam falhando.
- Nenhuma publicação de Rules/índices ou alteração de dados remotos.

## 9. P6: desempenho medido por fluxo

### Arquivos

`vite.config.js`, entrypoints/rotas em `App.jsx`, módulos extraídos do mapa/admin/relatórios, exportador PDF e assinaturas Firestore dos fluxos medidos.

### Linha de base

1. Gerar build de produção e registrar tamanho bruto/gzip dos chunks e grafo de imports. Usar análise local do bundle/manifest sem publicá-los.
2. Medir os fluxos: login; publicador abrindo mapa; admin abrindo painel; abrir relatórios; exportar PDF.
3. Separar arquivos baixados pela navegação, executados por import e baixados pelo precache do service worker. O glob atual pode baixar PDFs e telas lazy na instalação mesmo sem executá-los.
4. Comparar primeira visita sem cache/SW, instalação do PWA e visita recorrente, usando o mesmo dispositivo, viewport, rede, dados e sessão. Registrar bytes transferidos, número de requests, tempo até interação e assinaturas Firestore ativas. Não afirmar número de leituras faturadas com base apenas na contagem de listeners.

### Otimizações candidatas, condicionadas às medições

- Corrigir import estático indireto que faça admin/relatórios/PDF entrarem no caminho inicial do publicador; preservar os `lazy()` já existentes.
- Manter geração PDF atrás da ação explícita e evitar antecipar imports em efeitos. Não remover `html2canvas` só porque aparece no build: verificar quem o utiliza e como os PDFs são gerados.
- Se o precache de módulos raros pesar na instalação, avaliar exclusão seletiva com cache sob demanda. Antes de alterar, registrar o contrato offline atual e preservar atualização e navegação com recursos já armazenados. Não excluir chunks necessários a imports estáticos nem prometer abrir pela primeira vez offline um relatório nunca baixado.
- Eliminar listeners duplicados, limpar subscriptions na mudança de usuário/rota/contexto e suspender consultas de modais fechados quando o contrato permitir. Manter dados necessários ao mapa atualizados.
- Otimizar cálculos repetidos de agrupamento/bairro por custo medido; aplicar `useMemo`/`memo` apenas quando dependências e perfil justificarem.
- Rever `manualChunks` só após entender o grafo. Evitar criar dependências cruzadas que obriguem o download de telas opcionais.

### Aceite

- Relatório antes/depois reproduzível em `docs/execucao-revisao-tecnica.md`, com condições da medição e números por fluxo.
- Código de admin/relatórios/PDF não é executado no fluxo inicial do publicador por import antecipado. Downloads de precache ficam classificados separadamente.
- Otimização escolhida reduz o custo medido e não causa regressão funcional, de atualização ou offline; não estabelecer percentual de ganho sem linha de base.
- Testar primeira instalação, segunda abertura, navegação e atualização PWA após mudanças de cache. Preservar SW OneSignal e o caminho nativo de live-update.
- Se navegador estiver bloqueado, entregar análise estática e registrar desempenho real/PWA como não comprovados. Não inventar métricas.

## 10. Comandos e encerramento de cada fase

Scripts propostos a criar nas fases correspondentes, não disponíveis na redação deste plano:

| Script | Responsabilidade |
| --- | --- |
| `test:unit` | Vitest da raiz, somente testes unitários, execução única |
| `test:unit:watch` | Mesma suite em modo observação |
| `test:smoke` | Emuladores Auth/Firestore e smoke integrado existente |
| `test:rules` | Emulador Firestore e suite isolada de autorização |
| `worker:test` | Delegar ao script `test` do pacote notifications-relay |

Depois que os scripts existirem, estes são os comandos finais locais. Não executar como uma cadeia que ignore erro intermediário; verificar cada saída:

```powershell
npm.cmd run test:unit
npm.cmd run worker:test
npm.cmd run test:rules
npm.cmd run test:smoke
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
```

Ao final de cada fase, atualizar o registro com: arquivos alterados, contratos preservados, testes e resultado, evidência visual/Android, pendências e próximo passo. Usar os estados `pendente`, `em andamento`, `implementado com validação pendente`, `validado localmente` e `bloqueado`. Não marcar validado se faltou um critério relevante.

Se for preciso desfazer um lote, restaurar somente os trechos produzidos nessa fase, a partir do diff registrado. Não reverter arquivos inteiros com alterações anteriores. Publicação e seu eventual rollback serão planejados em outra solicitação, por superfície: Hosting/live-update, Worker, Rules/índices e Android.

## 11. Prompts prontos para o Antigravity

### Prompt inicial recomendado

```text
Trabalhe no projeto C:\Projetos\territorios-idiomas.
Leia integralmente docs/plano-tecnico-revisao-antigravity.md e eventuais AGENTS.md.
Execute a preparação e P3 (scripts/documentação de versão).
Crie docs/execucao-revisao-tecnica.md com linha de base, estado de cada fase e evidências.
Preserve todas as alterações locais existentes e os contratos descritos no plano.
Não faça commit, push, deploy, incremento de versão ou gravação em produção.
Se a primeira tentativa de validação no navegador falhar, pare essa validação e me peça ajuda; não insista.
Implemente e valide o escopo solicitado, depois informe alterações, testes, limitações e próximo passo.
```

### Continuação: P2

```text
Leia docs/plano-tecnico-revisao-antigravity.md e docs/execucao-revisao-tecnica.md.
Execute P2: configure testes unitários compatíveis e cubra CSV, códigos/configuração,
bairros, progresso e atualização web/nativa conforme os casos do plano.
Preserve o importador atual, incluindo atualizações permitidas de registros existentes.
Mantenha mocks sem rede real e preserve o smoke integrado.
Valide e atualize o registro de execução. Respeite todas as restrições permanentes.
```

### Continuação: P1, um lote por vez

```text
Leia o plano e o registro de execução em docs.
Execute a próxima subetapa pendente de P1, na ordem P1a, P1b, P1c, P1d, P1e.
Faça apenas as extrações desse lote, preservando comportamento e alterações anteriores.
Verifique subscriptions, cleanup, mapa mobile, guards e carregamento dinâmico aplicáveis.
Execute as validações do lote e atualize o registro com o próximo lote pendente.
Respeite a interrupção na primeira falha de navegador e as demais restrições do plano.
```

### Continuação: P4

```text
Leia o plano e o registro de execução em docs.
Execute P4 em lotes: testes locais do Worker, consultas proporcionais ao destino,
depois separação de responsabilidades e concorrência limitada de push.
Preserve autorização, destinatários, contratos HTTP e fallback OneSignal/FCM.
Não envie push/e-mail real, não carregue secrets reais nos testes e não publique.
Trate CORS conforme origens comprovadas e registre infraestrutura adicional como pendência.
Valide e atualize o registro, respeitando as restrições permanentes do plano.
```

### Continuação: P5

```text
Leia o plano e o registro de execução em docs.
Execute P5: documente a matriz de acesso e adicione testes positivos/negativos com
clientes sujeitos às Rules antes de simplificar helpers de firestore.rules.
Preserve contratos legados, vínculos, campos operacionais e proibição de exclusão física.
Rode a matriz e o smoke em emuladores locais. Não publique Rules/índices nem use produção.
Atualize o registro com evidências e eventuais limitações.
```

### Continuação: P6 e verificação final

```text
Leia o plano e o registro de execução em docs.
Execute P6: estabeleça linha de base por fluxo e distinga navegação, execução de JS e precache PWA.
Implemente apenas otimizações sustentadas pelas medições, preservando atualização e offline.
Se o navegador falhar na primeira tentativa, peça ajuda e registre as medições como pendentes.
Execute os checks finais aplicáveis e atualize o registro com o estado real de P1 a P6.
Não publique nem faça commit. Entregue mudanças, provas, limitações e pendências por superfície.
```

## 12. Quadro inicial

| Fase | Estado neste documento | Evidência requerida para encerrar |
| --- | --- | --- |
| Preparação | Pendente de execução | Baseline atual e inventário das alterações existentes |
| P3 | Planejado | Documentação corrigida e build sem incremento |
| P2 | Planejado | Testes de comportamento locais aprovados |
| P1 | Planejado | Lotes extraídos e regressões verificadas |
| P4 | Planejado | Worker local testado, destinatários e concorrência corretos |
| P5 | Planejado | Matriz Rules e smoke aprovados |
| P6 | Planejado | Medições comparáveis e comportamento PWA verificado |

Fora deste plano: novas funcionalidades do ponto 7 da revisão, mudanças de produto,
migração de stack, novos serviços pagos, release Android, publicação remota e commit.
