# Territórios sem endereços

## Ajuste local — 23/10/2026

Solicitação: depois de mover o último endereço para outro território, o cadastro vazio continuava no mapa e a janela de edição não oferecia arquivamento. O número deve continuar reservado e o cadastro deve poder ser reutilizado.

- Territórios com lista de endereços vazia ficam ocultos do mapa padrão, inclusive quando há uma posição antiga preservada. Também não entram no resumo de territórios do bairro. Não são excluídos nem arquivados automaticamente.
- O controle administrativo **Sem endereços (N)** abre uma lista no idioma atual com os territórios vazios ativos e arquivados. A lista funciona sem coordenadas e oferece Editar, Arquivar ou Reativar. Continua acessível mesmo quando não há itens.
- A edição mostra o aviso **Sem endereços**, explica a preservação do número e inclui Arquivar/Reativar. Ações de escrita são bloqueadas offline ou durante arquivamento. Designações por link continuam exigindo devolução antes de editar/arquivar.
- Ao remover o último endereço pelo fluxo Remover do território, a transação retorna o esvaziamento efetivamente salvo. A interface sai do foco vazio, abre a lista e oferece **Arquivar** ou **Manter para reutilizar**.
- O arquivamento oferecido após a remoção relê o território na transação e recusa a ação caso novos endereços tenham sido incluídos durante a confirmação. Exige administrador e mantém a proteção contra designação por link.
- Código, ID, histórico, eventual vínculo de cartão/QR e posição anterior são preservados. Ao adicionar novos endereços a um território ativo, o cálculo existente atualiza os totais e a posição; ele deixa a lista de vazios e volta ao mapa. Um arquivado precisa ser reativado primeiro.
- A exclusão de territórios continua bloqueada nas Rules. Arquivamento não libera números; a sugestão continua usando o maior número cadastrado mais um. Nenhuma reciclagem automática foi adicionada.

## Verificação

- 357 testes unitários em 25 arquivos aprovados, incluindo dez regressões novas de modelo/UI: remoção do último e do penúltimo endereço, preservação de identidade e número, arquivamento/reativação, nova inclusão durante confirmação, permissões, reutilização e ações da lista/edição.
- Lint, build e diff-check aprovados.
- Prévia local no navegador embutido: lista e edição com dados fictícios; ações Arquivar/Reativar exercitadas apenas no estado local da demonstração, sem acesso ao banco. Lista e botão de reativação conferidos no viewport já existente, sem alterar dimensões. Evidências: `artifacts/territorios-vazios/lista-local.png` e `edicao-local.png`.
- Não houve validação do fluxo completo no mapa autenticado, persistência em emulador ou dispositivo físico nesta rodada. O teste de concorrência cobre a releitura transacional com armazenamento simulado.

Implementação somente local, sem publicação, migração, alteração de dados reais (inclusive T014), commit ou push. Não são necessárias novas coleções, índices ou alterações nas Rules para este ajuste.

## Publicação — 23/10/2026

Ajuste publicado no frontend/PWA/OTA **3.9.389**, junto com a retirada do agrupamento por zoom. Autorização e conferência remota registradas em `docs/enderecos-sem-agrupamento.md`. Arquivos publicados e pacote OTA conferidos por SHA-256. Nenhum território real, incluindo T014, foi modificado por esta publicação; a ocultação dos vazios decorre da interface atualizada. Arquivamento/reativação reais continuam sendo ações explícitas do administrador na aplicação.
