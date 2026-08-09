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
Codigo
Barrio
Direccion
Informacion
Classe
Cuantas pessoas
```

Mapeamento:

```text
Codigo -> codigo
Barrio -> bairro
Direccion -> endereco
Informacion -> informacao
Classe -> classe
Cuantas pessoas -> quantidadeEstrangeiros
```

Recomendacao:

- A planilha pode continuar como fonte administrativa de preparo/conferencia.
- O Firestore deve ser a fonte operacional do app.
- Importacao deve ser idempotente por `codigo`.
- Importacao deve ter dry-run antes de gravar.
- Dry-run deve apontar novos, atualizados, duplicados, invalidos e arquivados.

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

Criar script futuro:

```text
scripts/import-enderecos-planilha.mjs
```

Requisitos:

- aceitar CSV/JSON exportado da planilha;
- `--dry-run` padrao;
- `--apply` apenas com confirmacao explicita;
- validar codigo unico;
- normalizar classe e codigo;
- criar/atualizar endereco por `codigo`;
- opcionalmente vincular por `grupoCodigo` em fase posterior;
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

### Fase futura sem prioridade - Importador da planilha

- Importador fica adiado por enquanto.
- Se voltar a ser necessario, deve continuar com dry-run padrao, validacao de duplicados/invalidos e gravacao idempotente por `codigo`.

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
