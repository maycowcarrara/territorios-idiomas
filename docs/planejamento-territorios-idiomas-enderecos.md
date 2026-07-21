# Planejamento tecnico: Territorios Idiomas com enderecos agrupados

## Objetivo

Adaptar o app `territorios-idiomas` para atender grupos/congregacoes de idiomas, onde o trabalho de campo e baseado em enderecos especificos de moradores estrangeiros.

Na versao atual, o app ainda suporta mapas legados por GeoJSON em instancias que definem `VITE_MAPA_URL`, mas a instancia Idiomas nao deve carregar `public/mapa.json` nem semear dados por JSON. Para Idiomas, a verdade operacional passa a ser somente o que for cadastrado no Firestore; importacao de enderecos fica para uma etapa futura.

O territorio designavel para o publicador passa a ser um grupo de enderecos proximos, com codigo proprio, progresso, designacao, historico e compartilhamento.

## Status atual da implementacao

Atualizado em 2026-07-21.

Ja implementado e publicado em Firebase Hosting/Firestore (`territ-es-sul-sbs`, site `territ-es-sbs`, ultima versao publicada confirmada neste plano: `3.0.340`):

- cadastro manual de enderecos no mapa por clique/toque em area vazia;
- codigo automatico transacional `E-000X`;
- persistencia em `enderecos`;
- marcadores de enderecos ativos no mapa;
- compartilhamento de ponto clicado, endereco e grupo;
- edicao de campos basicos do endereco;
- arquivar/reativar endereco sem exclusao fisica;
- criacao de `grupos_enderecos` com codigo automatico `T-00X`;
- selecao de enderecos ativos sem grupo para criar grupo;
- calculo de `totalEnderecos`, `totalEstrangeiros`, `centro` e `bounds`;
- renderizacao de grupo no mapa com marcador, bounds e progresso;
- arquivar/reativar grupo;
- remover endereco de grupo;
- designar grupo para publicador;
- mostrar grupos designados em "Meus Territorios";
- publicador marcar enderecos visitados;
- finalizar grupo quando todos os enderecos ativos estiverem visitados;
- regras do Firestore para `enderecos`, `grupos_enderecos` e `contadores/codigos`;
- smoke local em Auth/Firestore Emulator validando fluxo admin/publicador;
- divisao de chunks Firebase no `vite.config.js`, removendo o aviso de chunk maior que 500 kB no build local;
- nomenclatura visual normalizada para "territorio" e codigos curtos de exibicao (`T-001` salvo, `T-1` exibido; `E-0001` salvo, `E-1` exibido);
- "Meus Territorios" usa `bounds` quando disponivel e cai para `centro` do grupo quando nao houver bounds;
- mapa reconhece `grupoCodigo` como vinculo alem de `grupoId`, evitando que endereco ja agrupado volte a aparecer como selecionavel;
- mapa monta grupos sinteticos a partir de enderecos vinculados quando o documento de `grupos_enderecos` nao estiver presente na leitura local, e recalcula contadores/centro/bounds em tempo de execucao para exibir dados mais completos;
- grupos finalizados aparecem para admin com status visual proprio, e a execucao de enderecos fica bloqueada quando o grupo nao esta ativo;
- botao de informacoes gerais no header com totais de territorios ativos, enderecos ativos e pessoas cadastradas, usando agregacoes `count`/`sum` do Firestore e cache curto em `sessionStorage`;
- indice de agregacao versionado em `firestore.indexes.json` e publicado com `firebase deploy --project idiomas --only firestore:indexes`;
- `npm.cmd run lint`, `npm.cmd run build`, `firebase deploy --project idiomas --only firestore:indexes` e `npm.cmd run web:deploy` passaram em 2026-07-21.

Ainda pendente para fechar o plano completo:

- teste manual em producao com uma conta admin e uma conta publicador;
- mensagem/WhatsApp/notificacao ao designar grupo;
- listagem administrativa dedicada para enderecos e grupos;
- relatorios de enderecos/grupos;
- importador de enderecos idempotente para semear enderecos/grupos futuramente;
- offline robusto para execucao de grupos, equivalente ao fluxo de territorios/quadras;
- ajuda/manual do usuario para o novo fluxo.
- evolucao futura de areas/bairros por poligonos, agrupando varios territorios de idioma para acompanhar quando a area inteira foi pregada.

## Decisao de modelo

Separar a entidade permanente `enderecos` da entidade operacional `grupos_enderecos`.

- `enderecos`: cadastro historico de uma casa/local visitavel.
- `grupos_enderecos`: territorio de idioma designavel, formado por varios enderecos proximos.

Nao armazenar a copia principal dos enderecos dentro do grupo. O grupo deve referenciar enderecos e manter apenas contadores/snapshots operacionais necessarios para tela, relatorios e ordenacao.

## Colecoes implementadas/propostas

### `enderecos`

Documento: `e_{codigoNumerico}` ou UUID com campo `codigo` sequencial.

Campos principais:

```js
{
  codigo: "E-0001",
  status: "ativo", // ativo | arquivado
  grupoId: "g_0003", // null quando ainda nao agrupado
  grupoCodigo: "T-003", // snapshot opcional para UI/listas

  lat: -26.486966,
  lng: -51.995765,
  geohash: "...", // opcional, para buscas geograficas futuras
  endereco: "Rua Exemplo, 123",
  quantidadeEstrangeiros: 2,
  observacao: "Fala espanhol. Melhor horario: fim de tarde.",

  origem: "manual", // manual | json | importacao
  importacaoId: null,
  criadoEm,
  criadoPor,
  atualizadoEm,
  atualizadoPor,
  arquivadoEm: null,
  arquivadoPor: null
}
```

Regras de negocio:

- Cadastro manual permitido para admin/dirigente aprovado conforme regra definida para a instancia.
- Arquivar em vez de excluir fisicamente.
- Endereco arquivado nao aparece no mapa padrao nem entra no progresso do grupo.
- Um endereco ativo deve pertencer a no maximo um grupo.
- Nome do morador nao deve ter campo proprio no MVP; se necessario, fica em `observacao`.

### `grupos_enderecos`

Documento: `g_{codigoNumerico}` ou UUID com campo `codigo` sequencial.

Campos principais:

```js
{
  codigo: "T-003",
  nome: "T-003 - Jardim Sao Joao",
  status: "ativo", // ativo | arquivado | finalizado

  enderecoIds: ["e_0001", "e_0002"], // manter se o grupo nao passar de limites praticos
  totalEnderecos: 8,
  totalEstrangeiros: 15,
  centro: { lat: -26.4861, lng: -51.9962 },
  bounds: {
    minLat: -26.4870,
    minLng: -51.9970,
    maxLat: -26.4850,
    maxLng: -51.9950
  },

  designadoPara: null,
  designadoNome: null,
  dataDesignacao: null,
  designacaoId: null,
  cicloAtual: null,

  enderecos_visitados: [],
  historico: [],
  ultimaConclusao: null,
  ultimaAlteracao: null,

  criadoEm,
  criadoPor,
  atualizadoEm,
  atualizadoPor
}
```

Regras de negocio:

- O grupo e o territorio designavel para o publicador.
- O progresso do grupo e `enderecos_visitados.length / totalEnderecos`.
- Finalizar grupo quando todos os enderecos ativos do grupo forem marcados como visitados.
- Devolver grupo deve limpar designacao e preservar historico.
- Reabrir grupo deve remover status finalizado e liberar nova designacao. Ainda pendente como acao explicita; hoje o admin pode designar novamente o grupo pelo fluxo de administracao quando ele estiver ativo.
- Arquivar grupo nao deve arquivar os enderecos automaticamente; apenas deixa de ser designavel. Os enderecos podem ficar sem grupo ou ser movidos para outro.

### Sequencias de codigo

Usar documento de contador para evitar colisao:

```js
contadores/codigos
{
  proximoEndereco: 1,
  proximoGrupoEndereco: 1,
  atualizadoEm
}
```

Criar codigo por transaction:

- endereco: `E-0001`, `E-0002`, ...
- grupo/territorio de idioma: `T-001`, `T-002`, ...

Observacao de UI: o codigo persistido e validado pelas rules continua com largura minima (`T-001`, `E-0001`), mas a exibicao ao usuario remove zeros a esquerda (`T-1`, `E-1`) para combinar com o padrao visual curto do app.

## Importacao futura de enderecos

Para Idiomas, `public/mapa.json` nao e mais base visual nem fonte inicial de dados. Quando `VITE_MAPA_URL` estiver vazio, o app abre com uma `FeatureCollection` vazia e mostra apenas os enderecos/grupos cadastrados no Firestore.

Instancias legadas que ainda trabalham por territorios/quadras podem definir `VITE_MAPA_URL`, por exemplo `./mapa.general.json`.

Futuramente, o importador de enderecos deve aceitar pontos:

```json
{
  "tipo": "endereco",
  "lat": -26.486966,
  "lng": -51.995765,
  "endereco": "Rua Exemplo, 123",
  "quantidadeEstrangeiros": 2,
  "observacao": "Fala espanhol",
  "codigo": "E-0001",
  "grupoCodigo": "T-003"
}
```

Fluxo futuro recomendado:

- O arquivo de importacao pode semear enderecos e grupos iniciais.
- Depois de importados, a verdade operacional fica no Firestore.
- Importador deve ser idempotente por `codigo` quando informado.
- Se nao houver `codigo`, gerar um novo codigo via contador.
- Se houver `grupoCodigo`, criar/reusar o grupo e vincular o endereco.

## Fluxos de usuario

### Cadastro de endereco no mapa

1. Usuario toca/clica numa parte vazia do mapa.
2. Abrir popup com:
   - `Cadastrar endereco`
   - `Compartilhar localizacao`
3. Ao cadastrar:
   - usar lat/lng do toque;
   - pedir `endereco`;
   - pedir `quantidadeEstrangeiros`;
   - pedir `observacao`;
   - deixar sem grupo no cadastro inicial;
   - gerar codigo automatico `E-000X`;
   - salvar em `enderecos`.

Status: implementado para admin online. A escolha de grupo durante o cadastro ficou fora do MVP; o agrupamento acontece depois, selecionando enderecos sem grupo no mapa.

### Agrupamento de enderecos

Fluxos do admin/dirigente:

- selecionar enderecos sem grupo no mapa e criar novo territorio;
- adicionar um endereco a territorio existente;
- remover endereco de um territorio;
- mover endereco entre territorios;
- arquivar/reactivar endereco;
- arquivar/reactivar grupo.

Status: implementados selecionar enderecos sem grupo, criar grupo, remover endereco de grupo e arquivar/reativar endereco/grupo. O mapa ja trata `grupoId` e `grupoCodigo` como sinais de vinculo, inclusive para evitar selecao duplicada. Adicionar a grupo existente e mover entre grupos continuam pendentes.

No mapa:

- enderecos sem grupo: marcador neutro;
- enderecos agrupados: marcador com cor/rotulo do grupo;
- grupo selecionado: destacar enderecos do grupo e mostrar bounds/linha visual opcional;
- popup do grupo: designar, devolver, compartilhar, ver progresso, finalizar/reabrir.

### Designacao

1. Admin abre um grupo `T-003`.
2. Escolhe publicador.
3. Sistema cria `designacaoId`, `cicloAtual`, `dataDesignacao`.
4. Publicador passa a ver o grupo em "Meus".
5. Link compartilhado deve abrir o mapa enquadrando o grupo ou centralizando no primeiro endereco.

Status: implementado o fluxo de designacao e visualizacao em "Meus Territorios". A navegacao de "Meus" usa bounds quando existem e centro do grupo como fallback. A mensagem pronta/WhatsApp ao designar grupo ainda esta pendente.

### Execucao pelo publicador

1. Publicador abre o grupo designado.
2. Ve lista/mapa de enderecos.
3. Marca cada endereco como visitado.
4. Pode adicionar observacao de visita se necessario.
5. Ao completar todos os enderecos ativos, app permite solicitar/confirmar finalizacao seguindo o padrao atual.

Status: implementado online-first. O publicador ve o grupo no mapa, marca enderecos e finaliza quando o progresso esta completo. Localmente, grupos finalizados aparecem para admin com status proprio e nao aceitam marcacao de novos enderecos ate voltarem para status ativo.

## Offline

Manter o principio atual: offline nao pode sobrescrever uma designacao nova.

Adicionar actions offline especificas para grupos:

- `toggle_endereco_visitado`
- `finalization_request_grupo`
- `finalization_confirm_grupo`
- `add_endereco_visit_note` se houver notas de visita

Cada action deve carregar:

- `grupoId`
- `grupoCodigo`
- `userEmail`
- `designacaoId`
- `payload`

Na sincronizacao, validar no servidor:

- grupo ainda existe e esta ativo;
- `designadoPara === userEmail`;
- `designacaoId` continua igual;
- endereco pertence ao grupo no momento da sincronizacao.

Cadastro, edicao, arquivamento e movimentacao administrativa devem exigir conexao no MVP, como ja ocorre com a administracao atual.

Status atual: enderecos/grupos estao online-first. O offline robusto continua implementado para territorios/quadras, mas ainda nao foi estendido para `grupos_enderecos`.

## Regras do Firestore

Rules implementadas para:

- leitura de `enderecos` e `grupos_enderecos` por usuarios aprovados;
- create/update/delete logico de enderecos por admin;
- create/update/archive de grupos por admin;
- atualizacao operacional do grupo pelo responsavel atual, separando progresso (`enderecos_visitados`) de finalizacao;
- validacao de `enderecos_visitados` para impedir endereco fora do grupo, duplicidade e finalizacao antes de todos os enderecos estarem visitados;
- validacao de campos e limites de texto.

Ainda pendente nas rules/modelo offline:

- bloqueio por `designacaoId` nas actions offline de progresso, quando a outbox de grupos for implementada.

Campos administrativos sensiveis:

- `designadoPara`
- `designadoNome`
- `dataDesignacao`
- `designacaoId`
- `cicloAtual`
- `historico`
- `status`
- `grupoId`
- `enderecoIds`

Usuario comum/responsavel nao deve conseguir trocar endereco de grupo, arquivar endereco, alterar codigo, editar designacao ou forjar finalizacao fora do fluxo completo.

## Impactos no codigo atual

Arquivos principais:

- `src/Mapa.jsx`
  - renderizar marcadores de enderecos;
  - capturar clique em area vazia;
  - popup/formulario de cadastro;
  - popup de endereco;
  - popup de grupo;
  - destaque visual por grupo/designacao;
  - reconciliar `grupoId`/`grupoCodigo` e criar representacao sintetica local quando houver endereco vinculado sem grupo carregado.

- `src/App.jsx`
  - adaptar "Meus territorios" para incluir grupos de enderecos;
  - progresso deve poder ser por quadras ou por enderecos;
  - navegar por bounds ou por centro do grupo quando bounds nao estiverem disponiveis;
  - exibir informacoes gerais no header por agregacoes do Firestore, sem listeners abertos nem leitura completa das colecoes.

- `src/territorioContext.js`
  - sem alteracao principal para grupos no MVP; o progresso de grupos ficou em `src/enderecoModel.js`.

- `src/territorioActions.js`
  - sem alteracao principal para grupos no MVP; as actions online de grupos ficaram em `src/enderecoModel.js`.

- `src/territorioOfflineModel.js`
  - pendente para fase offline de grupos.

- `src/mapaUtils.js`
  - nao foi necessario no MVP; os calculos de grupo ficaram em `src/enderecoModel.js`.

- `src/Relatorios.jsx`
  - incluir relatorios de grupos por status, responsavel, estrangeiros e historico.

- `src/AdminPanel.jsx`
  - opcional no MVP; depois pode ganhar aba "Enderecos" ou "Territorios de idioma".

- `firestore.rules`
  - colecoes, validacoes e permissao de progresso/finalizacao por responsavel implementadas.

- `firestore.indexes.json`
  - indice de agregacao para resumo geral de enderecos ativos e soma de `quantidadeEstrangeiros`.

- `scripts/smoke-enderecos-grupos-emulator.mjs`
  - valida o fluxo admin/publicador com Auth e Firestore Emulator sem tocar no projeto real.

## Fases recomendadas

### Fase 1 - Base de enderecos

- [x] Criar modelo/helpers para `enderecos`.
- [x] Criar contador transacional para codigo `E-000X`.
- [x] Renderizar enderecos no mapa.
- [x] Cadastrar endereco por clique em area vazia.
- [x] Compartilhar localizacao do ponto clicado e do endereco.
- [x] Editar campos basicos.
- [x] Arquivar/reativar endereco.
- [x] Atualizar rules.
- [x] Validar build/lint.

### Fase 2 - Grupos/territorios de idioma

- [x] Criar `grupos_enderecos`.
- [x] Criar contador transacional `T-00X`.
- [x] Criar grupo a partir de enderecos selecionados.
- [ ] Parcial: vincular/remover/mover endereco entre grupos. Remover foi implementado; adicionar a grupo existente e mover continuam pendentes.
- [x] Calcular `totalEnderecos`, `totalEstrangeiros`, `centro`, `bounds`.
- [x] Mostrar grupo no mapa.
- [x] Exibir grupo por `grupoCodigo`/grupo sintetico quando o documento do grupo nao estiver carregado.
- [x] Arquivar/reativar grupo.
- [x] Atualizar rules.

### Fase 3 - Designacao e execucao

- [x] Designar grupo para publicador.
- [x] Mostrar grupos em "Meus".
- [x] Marcar endereco visitado.
- [x] Calcular progresso por endereco.
- [ ] Parcial: finalizar/devolver/reabrir grupo. Finalizar/devolver implementados; reabrir explicito ainda pendente.
- [x] Compartilhar link do grupo.
- [ ] Notificar admins na devolucao/finalizacao, seguindo padrao atual.

### Fase 4 - Offline e relatorios

- [ ] Criar outbox de progresso de grupos.
- [ ] Validar conflito por `designacaoId`.
- [x] Resumo geral agregado no header para territorios, enderecos e pessoas.
- [ ] Relatorios administrativos de grupos/endereco.
- [ ] Importador JSON idempotente.
- [ ] Ajustar Ajuda/manual.

### Evolucao futura - areas/bairros por poligonos

Depois do MVP de enderecos e grupos `T`, uma fase futura pode desenhar poligonos de bairros ou areas maiores no mapa. Esses poligonos nao substituem `grupos_enderecos`; eles funcionam como uma camada de gestao acima dos grupos, reunindo varios territorios de idioma dentro de uma mesma area.

Objetivos dessa camada:

- agrupar visualmente varios territorios `T` por bairro/area;
- calcular progresso consolidado da area a partir dos territorios ou enderecos vinculados;
- indicar se o bairro esta disponivel, em andamento, aguardando finalizacao, finalizado ou parado ha muito tempo;
- permitir que admin/dirigente veja rapidamente quais bairros precisam de prioridade;
- reaproveitar a legenda de "Areas e bairros" do mapa, onde tons mais quentes indicam area disponivel com maior tempo parada.

Modelo a definir nessa fase:

- colecao propria para areas/bairros, por exemplo `areas_bairros`;
- geometria do poligono, preferencialmente GeoJSON;
- vinculo automatico ou manual entre area e territorios `T`;
- regras para considerar uma area inteira pregada: todos os grupos ativos finalizados, todos os enderecos visitados no ciclo, ou outro criterio definido pela congregacao;
- historico por ciclo da area, separado do historico operacional de cada `grupo_enderecos`.

Fora dessa fase futura, os marcadores atuais continuam sendo a verdade operacional em Idiomas: `E` para endereco e `T` para territorio de enderecos.

## Fora do MVP

- Nome estruturado do morador.
- Geocoding automatico de endereco textual.
- Criacao automatica de grupos por cluster.
- Poligono editavel do grupo.
- Poligonos de bairros/areas para consolidar varios territorios `T`.
- Historico detalhado por pessoa/familia.
- Regras complexas de privacidade por idioma.

## Criterios de aceite do MVP

- [x] Admin consegue tocar no mapa e cadastrar endereco com codigo automatico.
- [x] Endereco aparece no mapa e pode ser compartilhado.
- [x] Endereco pode ser arquivado sem exclusao fisica.
- [x] Admin consegue criar grupo `T-00X` com enderecos proximos.
- [x] Grupo pode ser designado a publicador.
- [x] Publicador ve o grupo designado e marca enderecos visitados.
- [x] Progresso mostra `visitados / total de enderecos`.
- [ ] Parcial: finalizacao/devolucao preserva historico e usa `designacaoId`. Historico implementado; guardrail por `designacaoId` ficara na fase offline.
- [x] Rules impedem usuario comum de alterar designacao, codigo, agrupamento ou arquivamento.
- [x] Build, lint e smoke local passam com as alteracoes locais de 2026-07-21.
