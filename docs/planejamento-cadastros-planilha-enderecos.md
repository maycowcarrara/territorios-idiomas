# Planejamento tecnico: cadastros por planilha, codigos manuais e tipos de endereco

## Objetivo

Evoluir o fluxo de enderecos/territorios do `territorios-idiomas` para trabalhar com uma central de cadastros alinhada a planilha administrativa.

O cadastro de endereco passa a aceitar codigo manual, sempre em maiusculas, alfanumerico e com hifen. Os territorios tambem passam a poder ser definidos manualmente, com codigo proprio e associacao aos enderecos escolhidos.

Este plano nao implementa runtime. Ele registra o contrato tecnico para iniciar a proxima fase.

## Decisoes fechadas

- Interface do sistema em portugues.
- Idioma como contexto de trabalho, nao como pergunta repetida a cada cadastro.
- Primeira configuracao operacional: espanhol em Sao Bento do Sul.
- Prefixo padrao de endereco: `ES-SBS-`.
- Prefixo padrao de territorio: `ES-SBS-T`.
- Campo de codigo abre preenchido com o prefixo, mas fica totalmente editavel.
- Codigo salvo sempre normalizado em uppercase.
- Tipos/classes de endereco: `confirmado`, `verificar`, `estudo`, `excluido`.
- Status operacional do endereco: `ativo`, `arquivado`.
- Quando `classe` for `excluido`, o endereco deve ficar com `status: "arquivado"`.
- Usar "Arquivado" na UI; evitar "Inativo", pois esse termo ja tem significado para publicador.

## Configuracoes e padroes operacionais

O sistema deve permitir definir padroes nas configuracoes administrativas. Esses padroes servem para preencher os formularios mais rapido, mas os campos continuam editaveis por admin.

Exemplo de configuracao inicial:

```js
{
  idiomaPadraoId: "es",
  idiomaPadraoNome: "Espanhol",
  prefixoEnderecoPadrao: "ES-SBS-",
  prefixoTerritorioPadrao: "ES-SBS-T",
  classeEnderecoPadrao: "confirmado",
  quantidadeEstrangeirosPadrao: 1,
  cidadePadrao: "Sao Bento do Sul",
  ufPadrao: "SC"
}
```

Comportamento esperado:

- cadastro de endereco abre com idioma espanhol e codigo iniciado por `ES-SBS-`;
- cadastro de territorio abre com codigo iniciado por `ES-SBS-T`;
- classe do endereco abre como `Confirmado`;
- quantidade de pessoas abre como `1`;
- cidade/UF podem apoiar preenchimento, importacao e validacao futura, sem bloquear edicao manual;
- quando houver mais de um idioma ativo, o admin pode trocar o contexto de trabalho, e os padroes passam a seguir o idioma escolhido.

## Padrao de codigo

Endereco:

```text
ES-SBS-001
ES-SBS-002
ES-SBS-008A
```

Territorio:

```text
ES-SBS-T01
ES-SBS-T02
```

Regra minima recomendada:

```text
^[A-Z0-9]+(?:-[A-Z0-9]+)+$
```

Observacoes:

- O formato exige pelo menos um hifen.
- Letras devem ser salvas em maiusculas.
- O sistema deve remover espacos no inicio/fim antes de validar.
- A regra permite evoluir para outros idiomas/cidades sem alterar codigo.

## Modelo de dados recomendado

### `enderecos`

Campos novos ou ajustados:

```js
{
  codigo: "ES-SBS-001",
  idiomaId: "es",
  idiomaNome: "Espanhol",
  bairro: "Serra Alta",
  endereco: "R. Alvino Bertoli, 555 - Serra Alta, Sao Bento do Sul - SC, 89291-620",
  informacao: "Hugo (Merida)",
  classe: "confirmado",
  status: "ativo",
  quantidadeEstrangeiros: 1
}
```

Campos existentes que devem ser preservados:

- `grupoId`
- `grupoCodigo`
- `grupoDesignadoPara`
- `lat`
- `lng`
- `origem`
- `criadoEm`
- `criadoPor`
- `atualizadoEm`
- `atualizadoPor`
- `arquivadoEm`
- `arquivadoPor`

Regra de negocio:

- `confirmado`, `verificar` e `estudo` mantem `status: "ativo"`.
- `excluido` salva `status: "arquivado"`.
- Endereco arquivado nao aparece no mapa padrao.
- Endereco arquivado nao pode ser selecionado para criar territorio.
- Endereco arquivado nao entra no progresso do territorio.
- Documento nunca deve ser apagado fisicamente no fluxo comum.

### `grupos_enderecos`

Campos novos ou ajustados:

```js
{
  codigo: "ES-SBS-T01",
  idiomaId: "es",
  idiomaNome: "Espanhol",
  nome: "Serra Alta 01",
  bairro: "Serra Alta",
  status: "ativo",
  enderecoIds: ["addr_ES_SBS_001", "addr_ES_SBS_002"]
}
```

Campos existentes que devem ser preservados:

- `totalEnderecos`
- `totalEstrangeiros`
- `centro`
- `bounds`
- `designadoPara`
- `designadoNome`
- `dataDesignacao`
- `designacaoId`
- `cicloAtual`
- `enderecos_visitados`
- `historico`
- `ultimaConclusao`
- `ultimaAlteracao`

Regra de negocio:

- Territorio deve agrupar enderecos do mesmo idioma.
- Territorio manual deve validar codigo unico.
- O vinculo endereco/territorio continua usando `grupoId` e `grupoCodigo`.
- O app deve preservar o contrato atual de designacao e progresso por endereco.

## Cadastros auxiliares configuraveis

Criar colecoes/configuracoes administraveis, sem hardcode espalhado:

### `idiomas`

Exemplo:

```js
{
  id: "es",
  nome: "Espanhol",
  codigoPrefixoEndereco: "ES-SBS-",
  codigoPrefixoTerritorio: "ES-SBS-T",
  ativo: true,
  ordem: 1
}
```

### `tipos_endereco`

Exemplo:

```js
{
  id: "confirmado",
  label: "Confirmado",
  statusPadrao: "ativo",
  ordem: 1,
  ativo: true
}
```

Itens iniciais:

```text
confirmado -> Confirmado -> ativo
verificar -> Verificar -> ativo
estudo -> Estudo -> ativo
excluido -> Excluido -> arquivado
```

### `bairros`

Opcional na primeira fase. Pode comecar como campo texto livre com normalizacao simples e virar cadastro depois.

## Relacao com a planilha

Colunas observadas/esperadas:

```text
Territorio
Codigo
Barrio
Direccion
Informacion
Classe
Cuantas pessoas
Lat, Long
Latitude
Longitude
Link Maps
```

Mapeamento:

```text
Territorio -> grupoCodigo / grupos_enderecos.codigo
Codigo -> codigo
Barrio -> bairro
Direccion -> endereco
Informacion -> informacao
Classe -> classe
Cuantas pessoas -> quantidadeEstrangeiros
Lat, Long / Latitude / Longitude -> lat / lng
Link Maps -> referencia externa opcional, sem contrato operacional obrigatorio
```

Recomendacao:

- A planilha pode continuar como fonte administrativa de preparo/conferencia.
- O Firestore deve ser a fonte operacional do app.
- Importacao deve ser idempotente por `codigo`.
- Importacao deve ter dry-run antes de gravar.
- Dry-run deve apontar novos, atualizados, duplicados, invalidos e arquivados.
- A coluna `Territorio` deve usar preferencialmente o codigo do territorio, como `ES-SBS-T01`.
- `Territorio` vazio importa o endereco sem vinculo, para agrupamento posterior no app.
- `Territorio` preenchido deve vincular o endereco ao territorio correspondente quando nao houver conflito.
- Se o territorio informado ainda nao existir, o importador pode criar `grupos_enderecos` com esse codigo e agrupar os enderecos da mesma importacao.
- Se o endereco ja existir vinculado a outro territorio, nao mover automaticamente; marcar como conflito para revisao.
- Endereco com `classe: "excluido"` deve ficar arquivado e nao deve ser vinculado a territorio ativo.

## Importador CSV publicado

Objetivo do recurso:

- permitir que admin informe nas configuracoes o link CSV publicado da planilha;
- baixar o CSV pelo navegador usando `fetch`, desde que o link permita CORS;
- executar primeiro uma verificacao sem gravar;
- mostrar uma previa clara antes de inserir qualquer endereco;
- inserir somente novos enderecos depois de uma acao explicita do admin;
- criar ou vincular territorios conforme a coluna `Territorio`;
- buscar coordenadas faltantes usando o mesmo provedor de busca de endereco ja usado no mapa, com fila lenta e cache.

Configuracao sugerida em `configuracoes/cadastros_enderecos`:

```js
{
  planilhaCsvUrl: "https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv",
  planilhaCsvAtualizadaEm: timestamp
}
```

Fluxo esperado na administracao:

1. Admin cola ou altera o link CSV em Configuracoes.
2. Admin salva os padroes.
3. Admin clica em "Verificar planilha".
4. O sistema baixa e valida o CSV, sem escrever no Firestore.
5. O sistema mostra totais de novos, existentes, invalidos, duplicados, sem coordenada, territorios a criar e conflitos.
6. Para linhas sem coordenada, o sistema oferece "Buscar pins faltantes".
7. A busca usa endereco + cidade/UF padrao, nao usa informacoes pessoais da coluna `Informacion`.
8. O sistema aceita automaticamente apenas resultado unico/confiavel dentro da area configurada; casos duvidosos ficam para revisao manual.
9. Admin clica em "Inserir novos enderecos" para gravar.

Regras para coordenadas:

- Preferir `Lat, Long` quando existir e for valido.
- Usar `Latitude`/`Longitude` como fallback.
- Corrigir longitude positiva somente quando a area configurada indicar claramente que a versao negativa cai dentro da regiao esperada.
- Se nao houver coordenada valida, buscar pelo endereco com `searchAddresses`.
- Respeitar o throttle de Nominatim existente e manter cache local para evitar repetir consultas.
- Para uso do Nominatim publico, manter baixo volume, uma consulta por vez, no maximo 1 requisicao por segundo, e nao executar importacao recorrente automatica.

Gravacao:

- Criar endereco por codigo normalizado usando o mesmo doc id derivado do codigo.
- Nao sobrescrever endereco existente na primeira versao do importador.
- Gravar `origem: "importacao"` e `importacaoId` curto identificando a verificacao/importacao.
- Criar territorio quando `Territorio` estiver preenchido e ainda nao existir.
- Vincular novos enderecos ao territorio informado preenchendo `grupoId`, `grupoCodigo` e `grupoDesignadoPara: null`.
- Atualizar totais, centro e bounds do territorio com base nos enderecos ativos.
- Preservar designacao e progresso de territorios existentes.
- Nao apagar documentos; arquivamento deve acontecer por classe/status.

Limites da primeira implementacao:

- Sem importacao recorrente automatica.
- Sem mover endereco existente entre territorios automaticamente.
- Sem gravar linhas sem coordenada confirmada.
- Sem salvar `Link Maps` em `enderecos` enquanto nao houver campo aprovado nas regras e no modelo.
- Sem deploy/publicacao sem autorizacao explicita.

## Impactos tecnicos

### `src/enderecoModel.js`

Alterar:

- validacao/normalizacao de codigo manual;
- criacao de endereco sem depender obrigatoriamente de contador automatico;
- criacao de territorio com codigo manual;
- calculo de status quando `classe === "excluido"`;
- atualizacao basica para permitir `bairro`, `informacao` e `classe`;
- mensagens de erro para codigo duplicado/formato invalido.

Preservar:

- `grupoId`;
- `grupoCodigo`;
- `grupoDesignadoPara`;
- designacao;
- progresso;
- finalizacao.

### `src/Mapa.jsx`

Alterar:

- formulario de endereco para exibir codigo manual pre-preenchido com prefixo;
- campo codigo totalmente editavel;
- campos de bairro, informacao e classe;
- exibicao do tipo/classe no popup;
- filtro/visual de arquivados;
- criacao de territorio com codigo manual pre-preenchido;
- bloqueio visual para enderecos arquivados.

Preservar:

- mapa como superficie operacional;
- selecao de enderecos sem grupo;
- foco em grupo;
- fluxo "Meus Territorios";
- marcacao de enderecos pregados.

### `firestore.rules`

Alterar:

- regex de `enderecos.codigo` para codigo manual alfanumerico com hifen;
- regex de `grupos_enderecos.codigo`;
- allowlist de campos de endereco para incluir `idiomaId`, `idiomaNome`, `bairro`, `informacao`, `classe`;
- allowlist de campos de grupo para incluir `idiomaId`, `idiomaNome`, `bairro`;
- validacao de `classe` nos valores permitidos;
- validacao de `classe === "excluido"` exigir `status === "arquivado"`;
- manter bloqueios para usuario comum nao editar cadastro base.

### Scripts/importador

Criar modulo/app e, opcionalmente, script auxiliar:

```text
src/enderecoCsvImport.js
scripts/import-enderecos-planilha.mjs
```

Requisitos:

- aceitar CSV/JSON exportado da planilha;
- `--dry-run` padrao;
- `--apply` apenas com confirmacao explicita;
- validar codigo unico;
- normalizar classe e codigo;
- extrair coordenadas de `Lat, Long`, `Latitude` e `Longitude`;
- buscar coordenadas faltantes pela busca de endereco existente, com throttle e cache;
- criar endereco por `codigo`;
- vincular por `grupoCodigo` quando a coluna `Territorio` estiver preenchida;
- criar territorio ausente informado pela coluna `Territorio`;
- preservar designacao/progresso de territorio existente;
- nao mover endereco existente de territorio automaticamente;
- nao apagar documentos; usar `classe: "excluido"` + `status: "arquivado"`.

## Fases sugeridas

### Fase 1 - Modelo e cadastro manual no app

- Adicionar normalizadores de codigo manual.
- Adicionar campos `idiomaId`, `idiomaNome`, `bairro`, `informacao`, `classe`.
- Ajustar formulario de endereco.
- Ajustar formulario de territorio para codigo manual.
- Atualizar Firestore Rules.
- Atualizar smoke de emulator para codigos `ES-SBS-001` e `ES-SBS-T01`.

### Fase 2 - Cadastros auxiliares configuraveis

- Criar fonte de configuracao para idiomas e tipos de endereco.
- Criar configuracao administrativa de padroes operacionais.
- Carregar idioma ativo no admin.
- Aplicar prefixos, classe padrao e quantidade padrao automaticamente no formulario.
- Permitir futuro alternador de idioma apenas quando houver mais de um idioma ativo.

### Fase 3 - Publicacao e configuracao em producao

- Publicar a Fase 2 no Hosting quando autorizado.
- Criar ou revisar `configuracoes/cadastros_enderecos` em producao.
- Confirmar que os formularios usam os padroes publicados.
- Validar manualmente cadastro de endereco e territorio com os padroes configurados.

### Fase 4 - Alternador controlado de idiomas

- [x] Permitir mais de um idioma ativo na configuracao.
- [x] Carregar idioma ativo no contexto administrativo.
- [x] Aplicar prefixos e classes conforme o idioma selecionado.
- [x] Manter o alternador visivel somente quando houver mais de um idioma ativo.

### Fase 5 - Relatorios e refinamentos

- Filtros por idioma, bairro, classe e arquivados.
- Relatorio de enderecos.
- Relatorio de territorios por idioma/bairro/classe.
- Auditoria de alteracoes relevantes.

### Fase 6 - Importador CSV publicado com previa

- Campo `planilhaCsvUrl` nas configuracoes administrativas.
- Botao "Verificar planilha" sem gravacao.
- Parser CSV e normalizacao de colunas.
- Previa com novos, existentes, duplicados, invalidos, sem coordenada, territorios a criar e conflitos.
- Busca controlada de pins faltantes usando a busca existente do mapa.
- Botao separado para inserir novos enderecos.
- Criacao/vinculo de territorios pela coluna `Territorio`.
- Ajuste de Firestore Rules para permitir criacao admin com `origem: "importacao"`.
- Smoke de emulator cobrindo importacao, territorio novo, territorio existente e conflitos.

### Fase 7 - Refinamentos de mapa, importacao e execucao em campo

Objetivo:

- melhorar a leitura dos pins de endereco no mapa;
- reduzir atrito na conferencia/importacao por planilha;
- deixar o modo de execucao do publicador mais limpo;
- expor auditoria basica da origem de importacao;
- manter todos os contratos internos de dados.

Fora do escopo:

- nao implementar clusters de enderecos;
- nao implementar contadores por territorio no mapa, como `T-3 · 12`;
- nao criar resumo clicavel por territorio para substituir pins individuais;
- nao alterar coordenadas reais, `grupoId`, `grupoCodigo`, designacao, progresso ou finalizacao.

1. Pins compactos e resistentes a estouro:

- o texto dentro do pin de endereco deve usar rotulo curto, por exemplo `ES-SBS-019` -> `E-19`;
- o codigo completo deve continuar visivel em tooltip, popup, listas e mensagens quando fizer sentido;
- adicionar protecao visual no CSS do pin (`max-width`, `overflow`, centralizacao e tamanho de fonte) para codigos inesperados nao estourarem a bolha;
- nao alterar o codigo salvo no Firestore.

2. Reducao de sobreposicao sem cluster:

- detectar pins de endereco muito proximos na tela;
- aplicar deslocamento visual leve, deterministico e reversivel somente na renderizacao;
- manter cada endereco como pin individual;
- manter popup, navegacao e acoes usando a coordenada real do endereco;
- recalcular o deslocamento quando zoom/lista visivel mudar.

3. Dry-run real da verificacao da planilha:

- separar a acao de salvar a URL da planilha da acao de verificar;
- criar botao/acao explicita para salvar `planilhaCsvUrl`;
- fazer "Verificar planilha" baixar e validar o CSV sem gravar configuracao, enderecos ou territorios;
- manter "Aplicar importacao" como acao separada para gravacao de enderecos/territorios;
- ajustar textos da UI para deixar claro o que grava e o que nao grava.

4. Previa melhor para linhas sem pin:

- na secao "Sem coordenada", mostrar codigo, endereco, bairro, query usada e motivo/estado;
- manter o botao geral "Buscar pins faltantes";
- adicionar acao individual "Buscar pin" por linha, quando viavel;
- garantir que `Informacion`/`Información` continue fora da geocodificacao;
- deixar claro quando uma busca nao retorna resultado confiavel dentro da area configurada.

5. Destaque da ultima importacao:

- apos aplicar importacao, guardar localmente o `importacaoId` retornado;
- destacar temporariamente no mapa os enderecos inseridos ou atualizados nessa importacao;
- oferecer acao simples para limpar destaque;
- nao criar nova colecao para esse destaque;
- nao alterar regras de designacao/progresso por causa do destaque.

6. Modo publicador mais limpo:

- quando publicador estiver executando territorio designado, reduzir o popup/controles ao essencial;
- priorizar codigo curto, endereco, informacao, navegar e marcar/desmarcar pregado;
- esconder controles administrativos e informacoes que nao ajudam no campo;
- manter acessibilidade e botoes com areas de toque confortaveis no celular.

7. Auditoria visivel da importacao:

- usar campos ja existentes, como `origem`, `importacaoId`, `atualizadoEm` e `atualizadoPor`;
- mostrar no popup/cadastro uma indicacao discreta de origem/importacao quando existir;
- preparar filtro administrativo para ultima importacao ou enderecos importados;
- nao criar historico pesado nem nova colecao nesta fase.

Validacoes especificas da Fase 7:

- conferir visualmente que pins longos nao estouram a bolha;
- conferir que pins proximos continuam clicaveis individualmente;
- confirmar que "Verificar planilha" nao grava configuracao nem dados;
- confirmar que "Salvar URL" grava somente a URL da planilha/configuracao;
- confirmar que `Informacion`/`Información` nao entra na query de geocodificacao;
- confirmar em modo publicador que as acoes essenciais continuam disponiveis;
- se a validacao de navegador falhar na primeira tentativa por ambiente/login/navegador, parar e pedir ajuda.

## Validacoes esperadas

Local:

```text
npm.cmd run lint
npm.cmd run build
npm.cmd exec --yes --package firebase-tools -- firebase emulators:exec --project territorios-idiomas-smoke --only firestore,auth "node scripts/smoke-enderecos-grupos-emulator.mjs"
```

Browser/manual:

- cadastrar endereco com codigo `ES-SBS-001`;
- cadastrar endereco com codigo em minusculo e confirmar normalizacao para uppercase;
- tentar codigo duplicado e ver bloqueio;
- marcar classe `Excluido` e confirmar que aparece como `Arquivado`;
- criar territorio `ES-SBS-T01` com enderecos ativos;
- confirmar que endereco arquivado nao entra em territorio;
- designar territorio e marcar enderecos como pregados.
- verificar planilha CSV sem gravar;
- buscar pins faltantes uma vez e parar para ajuda se a validacao de navegador falhar na primeira tentativa;
- inserir novos enderecos somente em ambiente controlado/autorizado;
- confirmar que enderecos com `Territorio` preenchido aparecem dentro do territorio correto.

Publicacao:

- Nao publicar sem autorizacao explicita.
- Se rules forem alteradas, publicar Firestore Rules somente quando autorizado.
- Se frontend for alterado, publicar Hosting somente quando autorizado.

## Prompt pronto para iniciar a implementacao

```text
Vamos iniciar a Fase 1 do plano em C:\Projetos\territorios-idiomas.

Leia primeiro:
- docs/planejamento-cadastros-planilha-enderecos.md
- docs/planejamento-territorios-idiomas-enderecos.md
- src/enderecoModel.js
- src/Mapa.jsx
- firestore.rules
- scripts/smoke-enderecos-grupos-emulator.mjs

Escopo: implemente somente a Fase 1.

Objetivo:
- trocar o cadastro de endereco e territorio para codigo manual, com prefixo sugerido mas campo totalmente editavel;
- endereco padrao: ES-SBS-001;
- territorio padrao: ES-SBS-T01;
- normalizar codigo para uppercase;
- validar codigo alfanumerico com hifen;
- garantir unicidade antes de salvar;
- adicionar campos de endereco: idiomaId, idiomaNome, bairro, informacao, classe;
- usar classes: confirmado, verificar, estudo, excluido;
- quando classe for excluido, salvar status arquivado;
- manter a UI usando "Arquivado", nunca "Inativo";
- preservar grupoId, grupoCodigo, grupoDesignadoPara, designacao, progresso e finalizacao existentes.

Nao implemente ainda:
- importador de planilha;
- alternador completo de multiplos idiomas;
- relatorios novos;
- deploy/publicacao.

Validacoes esperadas:
- npm.cmd run lint
- npm.cmd run build
- smoke do emulador para enderecos/grupos atualizado com ES-SBS-001 e ES-SBS-T01
- git diff --check

Ao finalizar, reporte:
- arquivos alterados;
- o que foi validado localmente;
- o que ainda depende de browser/manual;
- se Firestore Rules/Hosting precisam de publicacao, mas nao publique sem eu autorizar.
```

## Prompt pronto para iniciar o importador CSV

```text
Vamos iniciar a Fase 6 do plano em C:\Projetos\territorios-idiomas.

Antes de editar:
- rode `git status --short`;
- leia `AGENTS.md` se existir;
- leia `docs/planejamento-cadastros-planilha-enderecos.md`;
- leia `src/enderecoModel.js`, `src/enderecoConfig.js`, `src\AdminPanel.jsx`, `src\Mapa.jsx`, `src\addressSearch.js`, `src\nominatimThrottle.js`, `firestore.rules` e `scripts\smoke-enderecos-grupos-emulator.mjs`.

Escopo: implementar o importador CSV publicado com previa, sem deploy/publicacao.

CSV de referencia:
https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8flZBnRxIHfPA6DvgjSE2Kr-s8bXaZSWgDzsQKCmMdZtimwIq2-L-AI9fYg9p079rAy8oy3eTGauv/pub?gid=0&single=true&output=csv

Objetivo funcional:
- adicionar em Configuracoes um campo `planilhaCsvUrl` para o link CSV da planilha;
- salvar esse campo em `configuracoes/cadastros_enderecos`;
- adicionar botao "Verificar planilha" que baixa o CSV e faz dry-run sem gravar;
- criar um modulo reutilizavel, provavelmente `src/enderecoCsvImport.js`, para parser/normalizacao/validacao;
- mapear colunas: `Territorio`, `Codigo`, `Barrio`, `Direccion`/`Dirección`, `Informacion`/`Información`, `Classe`, `Cuantas pessoas`/`Cuántas personas`, `Lat, Long`, `Latitude`, `Longitude`, `Link Maps`;
- normalizar classes com emojis/textos: Confirmado -> `confirmado`, Chequear -> `verificar`, Estudio/Estúdio -> `estudo`, Excluido -> `excluido`;
- extrair coordenadas validas primeiro de `Lat, Long`, depois de `Latitude`/`Longitude`;
- para linhas sem coordenada, oferecer busca de pins faltantes usando `searchAddresses`, respeitando `waitForNominatimThrottle`, cache e area de busca configurada;
- nao enviar a coluna `Informacion` para o provedor de geocodificacao;
- mostrar previa com totais de novos, existentes, duplicados, invalidos, sem coordenada, territorios a criar, vinculos a territorios existentes e conflitos;
- adicionar botao separado "Inserir novos enderecos";
- criar somente enderecos novos;
- se `Territorio` estiver preenchido e o territorio nao existir, criar `grupos_enderecos` com esse codigo;
- se `Territorio` estiver preenchido e o territorio existir, vincular o novo endereco nele;
- se endereco ja existir em outro territorio, nao mover automaticamente; marcar conflito para revisao;
- preservar `grupos_enderecos`, `grupoId`, `grupoCodigo`, `grupoDesignadoPara`, designacao, progresso e finalizacao;
- endereco com classe `excluido` deve ficar `arquivado` e nao entrar em territorio ativo;
- gravar importados com `origem: "importacao"` e `importacaoId`;
- ajustar Firestore Rules para permitir criacao admin de endereco por importacao, mantendo usuario comum bloqueado;
- atualizar smoke do emulador para cobrir importacao por CSV, territorio novo, territorio existente, sem coordenada e conflito.

Nao fazer:
- nao publicar Hosting;
- nao publicar Firestore Rules;
- nao criar/mover registros em producao;
- nao implementar importacao recorrente automatica;
- nao mover endereco existente entre territorios automaticamente;
- nao salvar `Link Maps` em Firestore enquanto nao houver campo aprovado no modelo/regras.

Validacoes esperadas:
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd exec --yes --package firebase-tools -- firebase emulators:exec --project territorios-idiomas-smoke --only firestore,auth "node scripts/smoke-enderecos-grupos-emulator.mjs"`
- `git diff --check`

Validacao browser/manual:
- tente uma validacao de navegador; se falhar na primeira tentativa por ambiente/login/navegador, pare e me peca ajuda em vez de insistir.

Ao finalizar, reporte:
- arquivos alterados;
- comportamento implementado;
- o que foi validado por CLI/emulador;
- o que ficou pendente de browser/manual;
- se Firestore Rules/Hosting precisam ser publicados depois, mas nao publique sem autorizacao explicita.
```
