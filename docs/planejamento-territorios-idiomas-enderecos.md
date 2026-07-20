# Planejamento tecnico: Territorios Idiomas com enderecos agrupados

## Objetivo

Adaptar o app `territorios-idiomas` para atender grupos/congregacoes de idiomas, onde o trabalho de campo e baseado em enderecos especificos de moradores estrangeiros.

Na versao atual, o app usa `public/mapa.json` como base visual dos territorios e controla designacao/progresso por territorio/quadra. Nesta evolucao, o app deve continuar importando mapa/enderecos por JSON, mas tambem permitir cadastro manual de novos enderecos diretamente no mapa.

O territorio designavel para o publicador passa a ser um grupo de enderecos proximos, com codigo proprio, progresso, designacao, historico e compartilhamento.

## Decisao de modelo

Separar a entidade permanente `enderecos` da entidade operacional `grupos_enderecos`.

- `enderecos`: cadastro historico de uma casa/local visitavel.
- `grupos_enderecos`: territorio de idioma designavel, formado por varios enderecos proximos.

Nao armazenar a copia principal dos enderecos dentro do grupo. O grupo deve referenciar enderecos e manter apenas contadores/snapshots operacionais necessarios para tela, relatorios e ordenacao.

## Colecoes propostas

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
- Reabrir grupo deve remover status finalizado e liberar nova designacao.
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

## Integracao com JSON

O `public/mapa.json` continua sendo a base visual/importavel.

Para enderecos importados, aceitar pontos:

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

Fluxo recomendado:

- JSON pode semear enderecos e grupos iniciais.
- Depois de importados, a verdade operacional deve ficar no Firestore.
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
   - opcionalmente escolher grupo existente ou deixar sem grupo;
   - gerar codigo automatico `E-000X`;
   - salvar em `enderecos`.

### Agrupamento de enderecos

Fluxos do admin/dirigente:

- selecionar enderecos sem grupo no mapa e criar novo territorio;
- adicionar um endereco a territorio existente;
- remover endereco de um territorio;
- mover endereco entre territorios;
- arquivar/reactivar endereco;
- arquivar/reactivar grupo.

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

### Execucao pelo publicador

1. Publicador abre o grupo designado.
2. Ve lista/mapa de enderecos.
3. Marca cada endereco como visitado.
4. Pode adicionar observacao de visita se necessario.
5. Ao completar todos os enderecos ativos, app permite solicitar/confirmar finalizacao seguindo o padrao atual.

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

## Regras do Firestore

Adicionar rules para:

- leitura de `enderecos` e `grupos_enderecos` por usuarios aprovados;
- create/update/delete logico de enderecos por admin/dirigente autorizado;
- create/update/archive de grupos por admin;
- atualizacao operacional do grupo pelo responsavel atual;
- bloqueio por `designacaoId` nas actions de progresso;
- validacao de campos e limites de texto.

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

Usuario comum/responsavel nao deve conseguir trocar endereco de grupo, arquivar endereco, alterar codigo ou editar designacao.

## Impactos no codigo atual

Arquivos principais:

- `src/Mapa.jsx`
  - renderizar marcadores de enderecos;
  - capturar clique em area vazia;
  - popup/formulario de cadastro;
  - popup de endereco;
  - popup de grupo;
  - destaque visual por grupo/designacao.

- `src/App.jsx`
  - adaptar "Meus territorios" para incluir grupos de enderecos;
  - progresso deve poder ser por quadras ou por enderecos.

- `src/territorioContext.js`
  - criar helpers analogos para grupos de enderecos, ou novo modulo `enderecoTerritorioContext.js`.

- `src/territorioActions.js`
  - criar actions/sync para progresso de grupos, ou novo modulo `enderecoTerritorioActions.js`.

- `src/territorioOfflineModel.js`
  - reduzir estado local com actions de enderecos visitados.

- `src/mapaUtils.js`
  - utilitarios para bounds/centro de grupos e contagem de enderecos.

- `src/Relatorios.jsx`
  - incluir relatorios de grupos por status, responsavel, estrangeiros e historico.

- `src/AdminPanel.jsx`
  - opcional no MVP; depois pode ganhar aba "Enderecos" ou "Territorios de idioma".

- `firestore.rules`
  - adicionar colecoes, validacoes e permissao de progresso por responsavel.

## Fases recomendadas

### Fase 1 - Base de enderecos

- Criar modelo/helpers para `enderecos`.
- Criar contador transacional para codigo `E-000X`.
- Renderizar enderecos no mapa.
- Cadastrar endereco por clique em area vazia.
- Compartilhar localizacao do ponto clicado e do endereco.
- Editar campos basicos.
- Arquivar/reativar endereco.
- Atualizar rules.
- Validar build/lint.

### Fase 2 - Grupos/territorios de idioma

- Criar `grupos_enderecos`.
- Criar contador transacional `T-00X`.
- Criar grupo a partir de enderecos selecionados.
- Vincular/remover/mover endereco entre grupos.
- Calcular `totalEnderecos`, `totalEstrangeiros`, `centro`, `bounds`.
- Mostrar grupo no mapa.
- Arquivar/reativar grupo.
- Atualizar rules.

### Fase 3 - Designacao e execucao

- Designar grupo para publicador.
- Mostrar grupos em "Meus".
- Marcar endereco visitado.
- Calcular progresso por endereco.
- Finalizar/devolver/reabrir grupo.
- Compartilhar link do grupo.
- Notificar admins na devolucao/finalizacao, seguindo padrao atual.

### Fase 4 - Offline e relatorios

- Criar outbox de progresso de grupos.
- Validar conflito por `designacaoId`.
- Relatorios administrativos de grupos/endereco.
- Importador JSON idempotente.
- Ajustar Ajuda/manual.

## Fora do MVP

- Nome estruturado do morador.
- Geocoding automatico de endereco textual.
- Criacao automatica de grupos por cluster.
- Poligono editavel do grupo.
- Historico detalhado por pessoa/familia.
- Regras complexas de privacidade por idioma.

## Criterios de aceite do MVP

- Admin consegue tocar no mapa e cadastrar endereco com codigo automatico.
- Endereco aparece no mapa e pode ser compartilhado.
- Endereco pode ser arquivado sem exclusao fisica.
- Admin consegue criar grupo `T-00X` com enderecos proximos.
- Grupo pode ser designado a publicador.
- Publicador ve o grupo designado e marca enderecos visitados.
- Progresso mostra `visitados / total de enderecos`.
- Finalizacao/devolucao preserva historico e usa `designacaoId`.
- Rules impedem usuario comum de alterar designacao, codigo, agrupamento ou arquivamento.
- Build e lint passam.
