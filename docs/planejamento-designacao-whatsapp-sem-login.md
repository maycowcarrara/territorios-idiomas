# Designação por WhatsApp e acesso sem login

Data: 21/10/2026. Revisão: todas as sete melhorias discutidas foram incluídas, com prazo configurável, devolução automática e revisão de marcações na tela do link. Estado: implementação local iniciada conforme autorização posterior; progresso e evidências na seção 13. Nenhuma publicação realizada.

## 1. Objetivo e recomendação

Permitir que o administrador designe um território de idiomas a um contato identificado pelo celular. O publicador recebe uma mensagem no WhatsApp e pode trabalhar de duas formas:

1. Abrir o território no navegador, consultar os endereços, marcar os pregados e concluir.
2. Usar a lista enviada no WhatsApp e, ao terminar, abrir um link de devolução para revisar as marcações, confirmar cobertura completa ou devolver parcialmente, sem precisar marcar individualmente todos os endereços.

Recomendação: contatos separados de contas de acesso, um link aleatório por designação, uma tela pública restrita àquela designação e validação no backend. Administradores e usuários atuais continuam com seus acessos existentes.

O celular identifica o contato no cadastro; o token autoriza o acesso à designação. Não haverá senha, cadastro, SMS, confirmação de e-mail ou login do publicador nesse fluxo. Consequentemente, o sistema registra uma ação feita pelo link designado ao contato, sem afirmar que verificou a identidade de quem clicou. Um link encaminhado continua utilizável por quem o receber enquanto estiver válido.

Escopo inicial: territórios formados por `grupos_enderecos`. O modelo legado de territórios por quadras e campanhas em `territorios`/`territorios_contexto` fica fora desta alteração.

## 2. O que existe hoje, confirmado no código local

| Área | Comportamento atual | Consequência para a mudança |
| --- | --- | --- |
| `src/usuariosModel.js` | Conta em `usuarios/{email}`; valida e-mail e WhatsApp nacional com 10–11 dígitos | O novo contato precisa existir sem e-mail e ter normalização própria com DDI |
| `src/enderecoModel.js` | `designarGrupoEndereco` exige e-mail; `designarGrupoEnderecoComUsuarioAprovado` cria/aprova usuário e designa em transação | Não usar esse caminho para contatos sem conta |
| `src/enderecoModel.js` | `designadoPara` guarda e-mail; `grupoDesignadoPara` replica esse e-mail nos endereços | Não colocar telefone nesses campos para simular usuário |
| `src/enderecoModel.js` | `finalizarGrupoEnderecoDesignado` exige progresso completo, grava histórico, limpa designação/progresso e aplica `finalizado` | Criar conclusão por declaração sem inventar visitas individuais |
| `src/Mapa.jsx` | Mensagem de designação envia saudação e link para `/app`; compartilhamento do território envia resumo e centro | A nova mensagem deve incluir todos os endereços e os dois acessos |
| `src/shareLinks.js` | Já constrói links Google Maps e `wa.me` com texto | Reutilizar funções de Maps e adaptar o telefone canônico para `wa.me` |
| `src/App.jsx` | Usa `HashRouter`; o Dashboard redireciona visitantes para login | Adicionar rota pública independente do Dashboard |
| `firestore.rules` | Leitura e execução dependem de usuário aprovado e e-mail da designação | Visitante deve usar API restrita; coleções operacionais continuam protegidas |
| `src/relatorios/utils/relatorioUtils.js` | Classifica ocupado/livre usando `designadoPara` | Ajustar para reconhecer designação por contato |
| `src/app/utils/meusTerritoriosUtils.js` | Busca territórios pelo e-mail da conta | Preservar consultas atuais; o link não dá acesso a uma carteira inteira |
| `workers/notifications-relay` | Worker já valida ID token Firebase e acessa Firestore REST com conta de serviço | Há um padrão aproveitável, mas ainda não há API para designação pública |
| `vite.config.js` | PWA com shell pré-carregado e operação online-first | Não armazenar respostas privadas da nova API em cache/offline |

O worktree estava limpo no início do estudo. A análise foi de arquivos locais e documentação oficial; não verificou dados, segredos, permissões IAM nem versões efetivamente publicadas.

## 3. Experiência proposta

### Administrador

1. Abrir o território e escolher **Designar por WhatsApp**.
2. Buscar contato pelo nome ou telefone. Se não existir, informar nome de exibição e celular na mesma tela.
3. Mostrar celular normalizado, território e quantidade de endereços para revisão. Na escolha do contato, exibir também sua carga atual: quantidade de territórios em andamento e tempo da designação mais antiga, por exemplo **Ana — 2 territórios em andamento; o mais antigo há 18 dias**.
4. Confirmar: o servidor salva contato, designação e acesso de forma atômica. Só então apresentar o compartilhamento.
5. Exibir **Enviar no WhatsApp**, **Copiar mensagem** e **Copiar link**.
6. Disponibilizar depois **Compartilhar novamente**, **Renovar link**, **Prorrogar prazo**, **Devolver território** e **Redesignar**.
7. Oferecer visão administrativa de designados, devolvidos parcialmente, devolvidos automaticamente e concluídos, com acesso ao histórico. Não expor essa visão ao portador de um link.

Uma mesma pessoa pode receber vários territórios, cada um com seu link. Reenviar uma mensagem conserva o link atual. Renovar explicitamente gera outro e invalida o anterior. Confirmar designação não significa que a mensagem foi enviada: o administrador ainda confirma o envio no WhatsApp.

Contatos são registros administrativos simples, não usuários com permissões. Não aparecem como novas contas em `usuarios` e não precisam existir no Firebase Authentication.

### Publicador: acompanhar pelo sistema

- Abre diretamente no navegador do celular, inclusive sem aplicativo instalado.
- Vê código/nome do território, endereços, links Maps e progresso; priorizar a lista, sem depender do mapa para executar o trabalho.
- Marca e desmarca somente os endereços ativos daquela designação.
- Ao marcar o último, a tela oferece concluir; não fecha automaticamente sem confirmação.
- **Devolver território** abre a mesma revisão usada pelo link direto. Todos marcados permitem concluir; marcações incompletas permitem devolução parcial ou declaração explícita de cobertura completa.
- Sem internet, informa que não pode salvar; não apresenta sucesso antes da confirmação do servidor.

Não exige instalação, acesso ao painel, ativação de notificações ou consulta ao cadastro de contatos.

### Publicador: acompanhar e devolver pelo WhatsApp

A mensagem contém a lista escrita e um link Maps por endereço. O link **Revisar e devolver território** abre uma tela dedicada ao território daquela designação, sem login. A lista mencionada aqui é a dos endereços desse território; o link não abre outros territórios do contato.

Tela proposta, com linguagem simples e poucos controles:

1. Cabeçalho com código/nome do território e resumo **3 de 8 endereços feitos**.
2. Lista de endereços com código, endereço escrito, botão Maps e marcação grande de **Feito**. Carregar o estado real salvo; marcados e pendentes aparecem juntos e podem ser marcados/desmarcados ali.
3. Ações secundárias **Marcar todos** e **Desmarcar todos**, com feedback do salvamento e possibilidade de corrigir antes de devolver. Alteram apenas as marcações; nunca concluem o território.
4. Um botão principal **Devolver território**. A confirmação adapta o texto ao progresso:

| Marcações | Texto de confirmação | Ação principal |
| --- | --- | --- |
| Todos: 8/8 | **Você está devolvendo este território com todos os 8 endereços marcados como feitos. Confirma que ele foi totalmente coberto?** | **Confirmar cobertura e devolver** |
| Parte: 3/8 | **Você marcou 3 de 8 endereços como feitos. Os outros 5 ficarão pendentes. Deseja devolver assim?** | **Devolver com 5 pendentes** |
| Nenhum: 0/8 | **Nenhum dos 8 endereços foi marcado como feito. O território será devolvido sem confirmação de cobertura.** | **Devolver sem cobertura** |

Nas confirmações com parte ou nenhum marcado, incluir a alternativa secundária **Cobri todos, mas não marquei aqui**. Ela mostra a pergunta explícita **Confirma que cobriu todos os 8 endereços?**, com o resumo do que estava marcado. Assim, continua possível concluir usando somente o controle do WhatsApp, sem fabricar marcações individuais nem obrigar a pessoa a preencher a lista. Não considerar a simples devolução com zero marcações como declaração de cobertura.

Ao confirmar cobertura, a data vem preenchida com **hoje**; um controle discreto **Foi em outro dia?** permite corrigir. Salvar separadamente a data informada da cobertura e o instante real de registro. Validar no servidor que a data não seja futura nem anterior ao início do ciclo de cobertura, considerando retomadas parciais e o fuso `America/Sao_Paulo`.

Só a confirmação final encerra a designação. Cancelar mantém as marcações já salvas e permite continuar a revisão. Depois do sucesso, mostrar comprovante curto: território, resultado, data e feitos/pendentes. Link encerrado não permite mais marcação.

### Simplicidade e acessibilidade obrigatórias

- Uma coluna, texto legível, botões com área de toque confortável, rótulos escritos e indicadores que não dependem apenas de cor.
- Não exigir mapa, gestos escondidos, criação de conta, instalação, tour inicial ou formulário extenso.
- Lista e devolução compartilham o mesmo componente e estado; a rota direta dá foco à revisão, sem criar fluxos concorrentes.
- Impedir devolução enquanto alguma marcação estiver salvando ou falhou. Mostrar **Salvando…**, erro acionável e sucesso somente após resposta do servidor.
- **Marcar todos** inclui todos os endereços da designação; **Desmarcar todos** deixa claro que limpará todas as marcações correntes, inclusive anteriores. Não aplicar apenas ao trecho visível da lista.
- Preservar foco, posição da lista e estado durante salvamentos; após retornar do Maps, revalidar sem apagar a revisão.
- Não mostrar termos como token, ciclo, API ou autenticação na experiência do publicador.

### Correção de devolução ou conclusão

O comprovante orienta **Devolveu por engano? Avise o responsável**, com um botão de contato WhatsApp quando houver número administrativo configurado, sem disparo automático de mensagem. O administrador pode corrigir a conclusão/devolução, registrando motivo, autor e data, sem apagar o evento original.

Reabertura administrativa só é permitida se não houver designação posterior nem mudança de composição incompatível. Ela gera nova designação/acesso, preserva o vínculo com o evento corrigido e nunca reativa o token antigo. Havendo trabalho posterior, registrar ajuste histórico e tratar a situação atual separadamente; não restaurar estado antigo sobre uma designação nova.

Abrir um link ou gerar sua prévia no WhatsApp jamais conclui, consome ou revoga a designação.

## 4. Link curto e ciclo de acesso

Proposta de formato, usando o domínio já configurado no repositório:

```text
https://territ-es-sbs.web.app/#/t/7Jm4qP9xN2vR8cKa
https://territ-es-sbs.web.app/#/t/7Jm4qP9xN2vR8cKa/fechar
```

Tokens acima são exemplos fictícios. `/fechar` abre a lista para revisão e devolução; não executa o fechamento. O mesmo token serve às duas telas, com o mesmo escopo. O texto visível pode dizer **Revisar e devolver**, independentemente do nome técnico da rota.

Recomendo **16 caracteres aleatórios em Base64URL**, derivados de 12 bytes de gerador criptográfico: 96 bits de aleatoriedade. É uma escolha de projeto para manter o link curto com boa resistência a adivinhação, acompanhada de limitação de tentativas e revogação. Não usar sequência, número do telefone, data, código do território, `Math.random` ou um UUID simplesmente cortado. Colisões são tratadas por criação condicional do registro e nova geração.

O nome/código aparece na mensagem e na tela. Colocá-lo também na URL aumenta seu tamanho e não melhora a autorização; proponho omiti-lo. Um domínio próprio mais curto é uma evolução opcional, dependente de domínio/DNS, sem encurtador externo no escopo inicial.

### Prazo nas configurações e devolução automática

Incluir em **Configurações do sistema / Padrões operacionais** o campo **Devolver automaticamente após quantos dias?**, visível/editável apenas ao administrador. Valor inicial sugerido: 90 dias, editável e sem constante obrigatória no código. Exigir inteiro positivo e explicar: **Ao vencer esse prazo, o acesso será encerrado, o território será devolvido automaticamente e os administradores serão avisados. As marcações serão preservadas; isso não confirma cobertura.**

Guardar a política em `configuracoes/designacoes`, com `prazoDevolucaoAutomaticaDias`, versão e metadados de alteração. Não ampliar o acesso público ao documento. Cada designação recebe o prazo aplicado e `expiraEm`, calculado pelo horário do servidor a partir de sua criação. Exibir a data prevista no painel e na tela do link. Prazo de acompanhamento pode ter um aviso antecipado administrativo, mas nunca substitui o vencimento configurado.

Alterar a configuração vale para novas designações. Não devolver retroativamente territórios sem aviso: oferecer aplicação às ativas somente como ação administrativa separada, com prévia das afetadas e confirmação explícita. **Prorrogar prazo** altera a data de uma designação ainda ativa e registra auditoria; **Renovar link** troca apenas a credencial, sem reiniciar o prazo silenciosamente. Reenvio também não estende prazo. Após o vencimento, retomar exige nova designação/link.

No vencimento: invalidar acesso, encerrar a designação com motivo `prazo_expirado`, liberar o território como ativo/disponível e preservar marcações e pendências. Mesmo que todos estejam marcados, não aplicar `finalizado` nem `ultimaConclusao` sem confirmação de cobertura. O histórico identifica **Devolvido automaticamente por prazo**, separado de devolução manual, conclusão e revogação de acesso.

Criar no sininho do administrador uma notificação como **T-13, designado a Ana, foi devolvido automaticamente após 30 dias. Havia 3 de 8 endereços marcados como feitos.** Usar o prazo daquela designação e referência ao histórico; não dizer que o WhatsApp foi enviado, recebido ou lido. Notificação interna é obrigatória; push e WhatsApp automático ficam fora do escopo desta entrega.

Uma rotina agendada no Worker verifica vencimentos mesmo sem alguém abrir o app (cadência proposta: a cada 15 minutos). O bloqueio do token vale exatamente a partir de `expiraEm`; a devolução/notificação pode aparecer na próxima execução bem-sucedida. Consultas do painel também identificam vencimentos pendentes e podem acionar reconciliação autenticada. Não depender só do relógio do navegador, de TTL ou do clique no link para liberar o território.

A rotina usa paginação, índice de `status + expiraEm`, retries limitados e a mesma transação idempotente de encerramento. Falha de processamento deixa a designação expirada e bloqueada, com reconciliação posterior e erro operacional visível ao administrador. Conclusão/devolução manual confirmada antes do vencimento vence a disputa; se o servidor já atingiu o prazo, não aceita novas marcações nem conclusão pelo token. Prorrogação após vencimento não revive o acesso.

Histórico, liberação, encerramento e registro da notificação devem ser confirmados atomicamente por designação. Usar ID determinístico de evento/notificação para impedir avisos repetidos em retries. Se a entrega para os administradores usar documentos por destinatário, registrar evento/outbox na transação e fazer distribuição idempotente; não enviar mensagens externas dentro dela.

Cada requisição valida o token, a expiração, a designação vigente, o estado do território e o vínculo do endereço. Mesmo se um registro antigo ainda disser “ativo”, um `designacaoId` diferente no território invalida o acesso. Reabrir um território não reativa seu link anterior.

## 5. Cadastro de contatos e modelo de dados

### `contatos_publicadores/{contatoIdPermanente}` — acesso administrativo

- `telefoneE164`: DDI + DDD + número, com representação canônica como `+5547999991234`.
- `nome`, `ativo`, `criadoEm`, `criadoPor`, `atualizadoEm`, `atualizadoPor`.
- Opcionalmente, referência a um usuário existente, sem conceder nem alterar permissões dessa conta.

O telefone normalizado é a chave de busca/unicidade para o administrador, mas o contato possui ID interno permanente e independente do número. Manter índice privado `indice_contatos_telefone/{telefoneCanonicoSemMais}` apontando para o contato, atualizado em transação. Máscaras diferentes do mesmo número resolvem para a mesma pessoa. Entrada nacional usa Brasil como padrão explícito; números internacionais exigem seleção de país e validação adequada. Não acrescentar `55` cegamente a números que já tenham DDI.

Esse identificador interno não aparece no link público nem em respostas ao visitante. Alteração de telefone preserva contato, designações e histórico; atualiza o índice em transação e registra auditoria, sem renomear documentos. O compartilhamento futuro usa o número atual; o histórico conserva o retrato do responsável naquele ciclo. Trocar celular não invalida o link automaticamente, mas oferece renovação explícita se o número anterior ficou com outra pessoa. Telefones duplicados, compartilhados ou reaproveitados precisam de revisão administrativa; não fundir pessoas automaticamente nem transferir seu histórico só porque um número coincidiu.

### Campos adicionais em `grupos_enderecos/{grupoId}`

```js
{
  designacaoTipo: 'link', // 'email' para o caminho existente
  designadoContatoId: 'id-permanente-do-contato',
  designadoPara: null,   // continua reservado ao e-mail no modo antigo
  designadoNome: 'Ana',
  designacaoId: 'uuid-do-ciclo',
  dataDesignacao: timestamp,
  cicloAtual: { /* manter campos existentes e acrescentar tipo/contato */ },
  composicaoVersao: 1   // composição estável enquanto houver designação ativa
}
```

Não gravar token em `grupos_enderecos` ou `enderecos`. `designacaoId` identifica o ciclo, não funciona como credencial. Preservar `grupos_enderecos`, `grupoId`, `grupoCodigo` e os códigos armazenados; usar os formatadores existentes para exibição.

Criar um predicado comum, por exemplo `temDesignacaoAtiva(grupo)`, para reconhecer os dois tipos. Substituir checagens de ocupação baseadas apenas em `Boolean(designadoPara)` no mapa, devolução, seleção, relatórios e contadores. Nos documentos antigos, inferir modo e-mail quando existir `designadoPara`, sem exigir migração imediata.

Para o modo link, `grupoDesignadoPara` nos endereços fica nulo. A API resolve os endereços pelo território atual e confirma sua associação. Não usar telefone ou um e-mail fictício nesse campo. Ao converter uma designação antiga, limpar o e-mail replicado para que a conta anterior não conserve leitura indevida.

### `designacoes_links/{designacaoId}` — somente backend

- `grupoId`, `contatoId`, nome/telefone do responsável no momento da designação.
- `tokenHash`, `tokenCifrado`, `chaveVersao`, `tokenVersao`.
- `status`: `ativa`, `concluida`, `devolvida` ou `revogada`; em devoluções, motivo `manual_parcial`, `manual_sem_cobertura` ou `prazo_expirado`.
- `prazoAplicadoDias`, `politicaPrazoVersao`, `expiraEm`, `criadoEm`, `criadoPor`.
- Snapshot da composição e ordem, marcações herdadas, referência da retomada e informações operacionais necessárias para histórico consistente.
- Metadados de renovação, prorrogação, revogação, devolução, conclusão e correção, com horário do servidor e motivo. Data declarada da cobertura em campo separado.

### `acessos_designacao/{sha256DoToken}` — somente backend

- Índice de resolução para `designacaoId` e `tokenVersao`, criado sem sobrescrever um hash já existente.
- A consulta por hash não substitui a validação da designação e do território.
- Registros antigos podem ser mantidos temporariamente como comprovante terminal, sem permitir leitura de endereços ou novas escritas.

O hash permite validar sem guardar texto puro. Para **Compartilhar novamente** após recarregar o painel, conservar também uma cópia cifrada com AES-GCM em documento exclusivo do backend; chave em secret do Worker, IV único e versão da chave. Apenas endpoint administrativo pode recuperá-la, e somente enquanto a designação estiver ativa. Não guardar o token em texto puro em documentos de leitura do app. Definir rotação/retenção dessa chave na implementação.

## 6. Backend e autorização

Recomendo um **Worker específico para designações**, em `workers/designacoes`, usando Firestore como fonte única dos dados. Aproveitar os padrões de verificação Firebase e acesso REST existentes no relay, com testes próprios. A separação evita acoplar o novo acesso público a envio de notificações e login por e-mail. Não é necessário adicionar outro banco, provedor de SMS ou integração oficial WhatsApp nesta etapa.

O Worker administrativo verifica assinatura, emissor, audiência e expiração do ID token Firebase e consulta a permissão atual no Firestore. O acesso do publicador verifica exclusivamente a capacidade concedida pelo token; não faz login anônimo ou login por telefone nos bastidores.

| Endpoint proposto | Autorização | Efeito |
| --- | --- | --- |
| `POST /admin/designacoes` | Firebase + administrador atual | Criar designação e link, com contato novo ou existente |
| `POST /admin/designacoes/{id}/compartilhar` | Administrador | Recuperar link ativo e compor mensagem, sem renová-lo |
| `POST /admin/designacoes/{id}/renovar` | Administrador | Trocar token e invalidar anterior |
| `POST /admin/designacoes/{id}/prorrogar` | Administrador | Alterar vencimento de designação ainda válida com auditoria |
| `POST /admin/designacoes/{id}/revogar` | Administrador | Bloquear acesso; território permanece atribuído para acompanhamento |
| `POST /admin/designacoes/{id}/devolver` | Administrador | Devolver e revogar atomicamente |
| `POST /admin/designacoes/{id}/corrigir` | Administrador | Corrigir evento sem apagar auditoria ou sobrescrever trabalho posterior |
| `POST /public/territorio` | Token no cabeçalho Authorization | Consultar projeção restrita, sem mudar estado |
| `POST /public/endereco` | Token | Definir `{ enderecoId, pregado: true/false, composicaoVersao }` |
| `POST /public/marcacoes` | Token | Definir conjunto desejado para marcar/desmarcar todos atomicamente |
| `POST /public/devolver` | Token | Devolver parcialmente ou sem cobertura, preservando marcações |
| `POST /public/concluir` | Token | Concluir por marcações ou declaração explícita |

Handler agendado interno chama o serviço de devolução por vencimento; não expor endpoint de cron sem autenticação. Reutilizar a política de notificações internas existente e testar leitura por todos os administradores atuais, com estado de lida separado por pessoa. Se usar o canal `ADMINS` existente, garantir atualização automática no sininho em vez de depender de recarga.

Redesignação e arquivamento também devem passar por operações do backend quando houver designação por link. Contatos podem ser geridos diretamente pelo painel com Rules exclusivas para admin ou por endpoints administrativos, mantendo a mesma normalização/unicidade.

Usar POST também na consulta permite URL fixa na API, com credencial fora de query/path e resposta sem cache; não significa que a consulta tenha efeito de escrita. A tela extrai o token do fragmento `#`, envia-o por HTTPS no Authorization e não o inclui em logs. `GET`, `HEAD` e prévias não têm efeitos operacionais.

Resposta pública: código/nome, situação operacional, prazo, versão de composição/progresso, códigos/endereço escrito, coordenadas/Maps e marcações. Informações operacionais de cada endereço podem ser incluídas por uma lista explícita de campos; não devolver o documento completo, histórico, e-mails, telefones, contatos, observações administrativas ou dados de outros territórios. Um número de suporte WhatsApp explicitamente configurado para divulgação pode integrar o comprovante.

As requisições autenticadas por conta de serviço no Firestore usam IAM, e não as Rules dos clientes. Portanto, o Worker precisa implementar todas as verificações de autorização e consistência, com credencial dedicada e permissões mínimas viáveis. CORS limita origens esperadas, mas não substitui autorização.

Rules devem negar acesso direto de visitantes às coleções operacionais e negar leitura/escrita de tokens por qualquer cliente. Para designações por link, restringir escritas diretas que alterem vínculo, composição, progresso ou fechamento: essas operações precisam passar pela lógica transacional do backend, inclusive quando iniciadas pelo painel. Preservar as permissões do caminho e-mail.

## 7. Transações, conclusão e concorrência

### Designar

Uma transação lê território, contato e eventual designação anterior; valida território ativo, endereços e condição esperada; cria contato se necessário; salva designação, índice de token e vínculo no território. Ao substituir o modo e-mail, limpa `grupoDesignadoPara` dos endereços. Se já estiver designado, exige ação explícita de redesignação, sem sobrescrever silenciosamente.

Usar identificador de requisição administrativa para que clique duplicado ou resposta perdida não crie dois ciclos. A resposta só entrega sucesso e link depois do commit. Não enviar WhatsApp dentro de uma transação sujeita a repetição.

### Marcar endereço

Receber o estado desejado, não uma operação “inverter”. Assim, uma repetição de `{ pregado: true }` continua marcada. A transação lê e valida designação, token vigente, território, composição e pertencimento do endereço antes de atualizar. Não confiar em `grupoId`, telefone ou nome enviados pelo visitante para definir autorização.

Marcar/desmarcar todos é uma operação de conjunto validada no servidor e gravada atomicamente para o tamanho de território suportado; definir/validar esse limite na implementação, sem dividir um clique em lotes independentes que possam deixar metade salva. Incrementar versão de progresso e exigir a versão apresentada na confirmação de devolução. Se outra aba alterar as marcações, retornar conflito e mostrar o resumo atualizado antes de confirmar. Conflitos nunca limpam silenciosamente marcações de outra aba.

### Concluir

Dois modos:

- `marcacoes`: todos os endereços ativos pertencentes ao ciclo foram marcados.
- `declaracao`: visitante confirma que cobriu todos, mesmo sem completar as marcações.

Na mesma transação: validar acesso, prazo e versões de composição/progresso; registrar o resultado do ciclo; gravar histórico compatível; aplicar `status: finalizado` e `ultimaConclusao`; limpar designação e progresso corrente conforme o padrão atual; encerrar o acesso. Preservar nomes, tipo do responsável e datas do ciclo no histórico. Registrar separadamente data da cobertura (informada) e data de registro (servidor), com validação temporal.

Registrar `modoConclusao`, quantidade de endereços, quantidade efetivamente marcada e versão da composição. Na declaração, não fabricar eventos nem horários de visita para os endereços pendentes. Relatórios mostram **Cobertura declarada pelo link** ou **Concluído com marcações**, além da situação finalizada.

### Devolver sem concluir e retomar pendências

Devolução parcial, devolução sem marcações e vencimento encerram a designação, invalidam o token, removem o responsável atual e liberam o território com `status: ativo`. Não atualizar `ultimaConclusao`. Preservar no histórico o conjunto de IDs feitos/pendentes e manter o progresso corrente para permitir retomada. Não confundir `status: ativo` com ocupado: a disponibilidade depende do vínculo de designação.

Na próxima designação de um território com progresso parcial, mostrar **Continuar os endereços pendentes** como padrão, com o resumo herdado. Oferecer **Iniciar nova cobertura** como escolha explícita que arquiva o progresso anterior e reinicia as marcações. Sempre gerar novo `designacaoId` e token; ligar a retomada à designação anterior e preservar o início do ciclo de cobertura. Não atribuir as marcações herdadas ao novo responsável como se ele as tivesse realizado. A mensagem de retomada identifica feitos e pendentes e a tela mostra o estado herdado.

### Encerramento idempotente e alterações da lista

Repetir a mesma conclusão/devolução retorna comprovante de como aquela designação já foi encerrada, sem acrescentar outro histórico ou mudar seu motivo. Um token terminal não lê mais a lista nem atua no ciclo seguinte; pode consultar somente o comprovante mínimo daquele encerramento. Tokens trocados por renovação ou revogados por segurança não recuperam comprovante nem dados. Requisições concorrentes de conclusão, devolução automática/manual, renovação, prorrogação e redesignação devem disputar os mesmos documentos de vínculo em transação; validar depois de cada conflito/retry. A conta de serviço via REST exige implementar transações/precondições e retry limitado, não apenas leituras seguidas de PATCH.

Manter composição e ordem da lista estáveis durante a designação. Incluir/remover/transferir/arquivar endereços vinculados exige encerrar a designação atual e oferecer nova designação com prévia das mudanças e mensagem atualizada; não mudar silenciosamente o conjunto enviado pelo WhatsApp. Na entrega inicial, bloquear essas mudanças enquanto houver designação ativa e orientar a devolução/redesignação. Correções cadastrais que não mudem a composição podem ser feitas, mas devem preservar o snapshot enviado e avisar no painel que a mensagem antiga pode estar desatualizada. Remoção urgente de dado sensível sempre bloqueia sua exposição e revoga o acesso afetado, sem manter dado indevido só para preservar o snapshot.

## 8. Mensagem de WhatsApp

Exemplo fictício, usando a mesma ordem da lista no sistema:

```text
Olá, Ana!
Território T-13 — Centro / Espanhol
2 endereços

E-21 — Rua Exemplo, 123 — Centro
https://www.google.com/maps/search/?api=1&query=-26.000000%2C-49.000000

E-22 — Rua Modelo, 456 — Centro
https://www.google.com/maps/search/?api=1&query=-26.001000%2C-49.001000

Abrir território e marcar os endereços:
https://territ-es-sbs.web.app/#/t/7Jm4qP9xN2vR8cKa

Quando terminar, revise as marcações e devolva:
https://territ-es-sbs.web.app/#/t/7Jm4qP9xN2vR8cKa/fechar
```

Gerar links Maps com `buildGoogleMapsUrl` e endereço escrito completo com os dados cadastrados. Se não houver coordenadas válidas, usar pesquisa Maps pelo endereço + cidade/UF quando essa informação for confiável; na falta de localização suficiente, apontar a pendência ao administrador antes de preparar o envio. Nunca montar coordenadas falsas ou omitir silenciosamente um endereço.

Usar `wa.me` para abrir a conversa com texto pronto; o usuário confirma o envio. Isso não requer WhatsApp Business API. Para listas longas, oferecer mensagens numeradas em partes, cópia integral e copiar link separadamente, sem cortar endereços. O limite prático de abertura do compartilhamento deve ser testado no celular; não assumir um limite único entre navegadores e WhatsApp.

O servidor retorna a lista autorizada e a composição usada no compartilhamento. Não montar a mensagem a partir de uma lista incompleta carregada no mapa. Depois de enviada, uma mensagem com endereços não pode ser recolhida pela revogação do link; evitar incluir telefone do contato ou informações além das necessárias ao trabalho.

Acrescentar a data limite do acesso em linguagem simples. Em retomadas, indicar ao lado de cada endereço **Feito anteriormente** ou **Pendente**, mantendo código, endereço e Maps de todos os locais da composição. A mensagem não precisa conter instruções técnicas nem explicar as regras de segurança.

## 9. Proteções operacionais e navegação

- Limitar tentativas por origem de requisição e abuso de tokens; limitar frequência de escritas por designação. Erros públicos não revelam a existência de contatos ou territórios para tokens inválidos.
- `Cache-Control: no-store` na API; não cachear respostas privadas na PWA, não manter outbox de marcações e não gravar lista/token em persistência compartilhada do navegador.
- Usar `Referrer-Policy: no-referrer`, links externos com `noopener noreferrer`, sem analytics, push ou ferramentas de sessão na tela pública. Redigir tokens/Authorization de logs e relatórios de erro.
- Prévia do WhatsApp genérica, sem endereços privados nos metadados HTML. `noindex` como higiene adicional, sem tratá-lo como controle de acesso.
- A rota pública funciona mesmo se houver um administrador logado no mesmo navegador; nunca depende da sessão existente para ampliar seu escopo.
- `App.jsx`, handlers globais de navegação, atualização e deep links precisam reconhecer a rota pública para não enviá-la ao login ou perder uma confirmação em andamento.
- Primeira entrega funciona no navegador/PWA. Se Android interceptar o domínio, validar encaminhamento da nova rota e inicialização pelo link; o handler nativo atual só trata magic link de e-mail. Não condicionar o uso à instalação do APK.
- Contato inativo não recebe novas designações; desativação oferece revogar acessos ativos. Troca de responsável, arquivamento e reabertura nunca reaproveitam uma credencial antiga. Troca de celular preserva o contato e oferece renovação explícita do acesso.

## 10. Compatibilidade e transição

1. Manter contas e designações por e-mail existentes. O novo modo passa a ser a opção preferencial para publicadores sem conta.
2. Sem migração em massa: importar contatos de `usuarios` apenas em uma ação administrativa de revisão, com normalização e deduplicação por celular. Telefones vazios/ambíguos ficam pendentes; nenhum link é gerado ou enviado automaticamente.
3. Para converter uma designação em andamento, o administrador escolhe o contato e confirma a substituição. Encerrar o acesso anterior e registrar o evento, preservando o início e as marcações do ciclo se a intenção for só trocar o meio de acesso. Se houver troca de responsável/ciclo, registrar isso expressamente, sem reset silencioso do progresso.
4. Adaptar ocupação, devolução, arquivamento, relatórios e contadores antes de permitir o primeiro vínculo por contato. A ausência de e-mail não pode fazer território ocupado aparecer livre.
5. Nas designações por link, reaproveitar o histórico atual e acrescentar auditoria própria. Autor de ação pública é `link + designacaoId`, associado ao contato, nunca um e-mail inventado ou identidade verificada.
6. Revisar índices apenas para consultas administrativas realmente necessárias, por exemplo contato + status + data. Nenhum índice público de telefone ou listagem de tokens.

## 11. Etapas e critérios de aceite

| Etapa | Entrega | Critério de conclusão |
| --- | --- | --- |
| 1 — Contrato e contatos | ID permanente, índice único de celular, cadastro/busca, ocupação e progresso herdado | Troca de celular preserva histórico; máscaras não duplicam; ambos os modos têm status correto |
| 2 — Serviço, prazo e segurança | Worker, endpoints, configuração, rotina agendada, notificação, transações e Rules | Vencimento devolve sem confirmar cobertura; aviso único; API restrita; concorrência coberta |
| 3 — Designação e mensagem | Formulário sem e-mail, carga por contato, lista estável, mensagem completa, reenvio/prorrogação | Mesma mensagem não altera prazo; lista completa; operação duplicada não cria outro ciclo |
| 4 — Tela pública e devolução | Lista simples, Maps, ações em lote, confirmação por contagem, data e comprovante | Zero/parcial/total claros; declaração completa sem marcação obrigatória; correção administrativa auditada |
| 5 — Regressão, acompanhamento e piloto | Visão administrativa, relatórios, retomada, emuladores e teste controlado | Fluxo antigo preservado; cobertura não se confunde com devolução; WhatsApp/celular validados |

Testes essenciais:

- Visitante sem token não consulta nem altera Firestore; token de um território não atua em outro, nem em endereço removido/arquivado.
- Token expirado, revogado, renovado ou de ciclo anterior não opera. Slug, telefone e `designacaoId` isolados não dão acesso.
- Revogação e redesignação durante uma escrita impedem alterações no ciclo seguinte; duas designações simultâneas não se sobrepõem silenciosamente.
- Repetir marcação mantém o estado desejado; repetir conclusão não duplica histórico; retry de criação devolve a designação já confirmada.
- Conclusão por declaração funciona com zero, algumas ou todas as marcações. Conclusão por marcações exige o conjunto válido completo.
- Abrir/pré-visualizar ambos os links não muda progresso, não fecha e não consome o acesso.
- Reenvio mantém o token; renovação muda o token; acesso encerrado só mostra comprovante mínimo.
- Mensagem inclui código/nome do território, código/endereço e Maps de cada local; cobre acentos, números internacionais e lista extensa.
- Administrador vê território por contato como ocupado, pode devolver/arquivar e encontra histórico/relatório correto após a conclusão.
- Login e designações atuais por e-mail continuam funcionando, sem liberar dados ao antigo usuário depois da conversão.
- Offline/falha de rede não mostra sucesso falso; retorno da aba revalida a designação e mudanças de composição.
- Trocar celular mantém contato/histórico, resolve unicidade concorrentemente e não funde pessoas por telefone reciclado.
- Mudanças de composição são bloqueadas em designação ativa; nova designação atualiza a mensagem e invalida o acesso anterior.
- Tela direta carrega feitos/pendentes reais, permite edição e lote; marcar todos não conclui nem devolve automaticamente.
- Zero, parte e total geram confirmação correspondente; declaração completa exige confirmação própria. Conflito entre abas exige resumo atualizado.
- Devolução parcial preserva pendências, libera o território sem `ultimaConclusao`; retomada preserva autoria herdada e oferece reinício explícito.
- Correção administrativa não apaga histórico nem sobrescreve designação posterior; reabertura gera novo acesso.
- Data declarada de cobertura é validada no fuso do sistema e não altera o instante real de registro.
- Prazo configurado é capturado na designação; mudar configuração não afeta ativas silenciosamente; renovação/reenvio não prorrogam.
- Rotina funciona sem navegador aberto; vencimento bloqueia no instante devido, devolve sem cobertura e gera aviso administrativo único, inclusive após falha/retry e para 0/parcial/total de marcações.
- Corrida entre vencimento, conclusão e prorrogação não duplica histórico/notificação nem reativa acesso; painel reconcilia pendências de processamento.
- Aviso aparece para administradores e não para publicadores; leitura do aviso por um admin não o marca como lido para todos.
- Prévia, tabulação, leitores de tela, alvos de toque, estados de salvamento e lista extensa mantêm a experiência compreensível.

Executar testes unitários, Worker com Firestore/Auth emuladores, matriz de Rules, smoke existente e build/lint apropriados. Usar projeto de demonstração e credenciais locais simuladas, sem depender de produção para testes automatizados. Como a conta de serviço ignora Rules, testar a autorização da API separadamente dos testes de Rules.

Validação manual posterior: admin designa para contato sem conta; abre mensagem em WhatsApp real; destinatário abre em navegador sem sessão; marca um endereço; conclui pela tela direta; administrador confirma histórico; link antigo deixa de operar. Também testar lista extensa, reenvio e renovação. Evidência local de navegador não comprova WhatsApp real, Android nem versão publicada. Conforme a instrução do projeto, se a primeira tentativa de validação no navegador falhar, parar e pedir ajuda ao usuário, sem insistir ou trocar de navegador automaticamente.

## 12. Publicação e decisões propostas

Escopo consolidado: contato permanente com celular como busca; composição estável; devolução parcial; correção administrativa auditada; carga por contato e painel de acompanhamento; confirmação informativa e data de cobertura; prazo configurável com devolução automática e notificação; lista editável simples no link, com marcar/desmarcar todos. Mantêm-se token de 16 caracteres, Worker separado, conclusão por marcações ou declaração, link por designação, reenvio com armazenamento cifrado e coexistência com e-mail. Os 90 dias são apenas valor inicial sugerido no formulário, sem prazo fixo obrigatório. Esses requisitos estão incluídos no plano; nenhuma configuração foi aplicada ao sistema.

Antes de publicar: preparar serviço com credenciais da instância Idiomas e limitação de abuso; publicar/revisar Rules compatíveis; publicar frontend com ativação controlada; validar um território piloto. A configuração local aponta Firebase `territ-es-sul-sbs` e Hosting `territ-es-sbs`, mas esses alvos e as permissões precisam ser reconfirmados no momento da publicação. O relay de notificações não precisa ser republicado se não houver mudança nele.

Rollback: desativar novas designações por link, revogar acessos ativos e manter uma tela de orientação/comprovante para links já enviados. Não recolocar frontend antigo enquanto houver territórios por contato que ele classificaria como livres. O administrador continua podendo acompanhar e devolver pelo caminho compatível. Nenhum rollback recolhe as listas já enviadas no WhatsApp.

Contexto do planejamento original: o pedido daquela conversa era atualizar o planejamento e fornecer um prompt, sem implementar funcionalidades nela. Em 21/10/2026, uma solicitação posterior autorizou a implementação e validação locais descritas na seção 13. Migração de dados reais e deploy continuam exigindo autorização específica posterior. Prompt de continuidade preservado em `docs/prompt-implementacao-designacao-whatsapp.md`.

## Referências técnicas consultadas

- [Firebase — autenticação da API REST e diferença entre Rules e IAM](https://firebase.google.com/docs/firestore/use-rest-api): fundamenta a autorização obrigatória no serviço.
- [Firebase — transações e escritas atômicas](https://firebase.google.com/docs/firestore/manage-data/transactions): fundamenta as transições consistentes e o tratamento de concorrência; o cliente REST precisa implementar o retry correspondente.
- [Cloudflare — Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/): geração criptográfica, hash e cifragem disponíveis no runtime.
- [Cloudflare — Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) e [handler agendado](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/): fundamentam o processamento de vencimentos sem navegador aberto; cadência de 15 minutos é proposta deste plano, não garantia de execução pontual.
- [OWASP — tokens em URL](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): referência para aleatoriedade, armazenamento, expiração e prevenção de vazamento. O documento trata recuperação de senha; aqui o token é reutilizável durante uma designação, por decisão explícita de produto, e revogado no encerramento.

## 13. Progresso da implementação local — 21/10/2026

Inspeção inicial: não havia `AGENTS.md` físico nos diretórios ancestrais aplicáveis; foi seguida a instrução fornecida pelo usuário para interromper a validação no navegador na primeira falha. O Git apresentava somente este planejamento e o prompt como arquivos novos, sem hunks rastreados. Ambos foram preservados; esta seção registra a evolução sem descartar o escopo aprovado. Não houve deploy, escrita em dados reais, envio de mensagens, commit ou push.

| Etapa | Implementação local | Evidência / limite de aceitação |
| --- | --- | --- |
| 1 — Contrato e contatos | ID permanente, telefone E.164 validado por país, unicidade transacional, edição/inativação, busca/carga; ocupação comum para e-mail/link; distinção entre marcação e cobertura | Testes unitários e smoke com disputa pelo mesmo celular. Cadastro e histórico não usam telefone como ID nem e-mail fictício. Revisão visual administrativa completa ainda pendente. |
| 2 — Serviço, prazo e segurança | `workers/designacoes`, REST transacional com retry, autorização Firebase/role atual, token cifrado e hash, Rules fechadas, política versionada, prorrogação, cron paginado e aviso determinístico; estado operacional e reconciliação | Testes próprios da API, assinatura criptográfica simulada, Rules e Auth/Firestore locais. Vencimento com zero/parte/todos preserva progresso sem cobertura; teste de disputa com conclusão. Handler agendado também executado pelo Wrangler local. Cron/IAM/segredos de produção não foram configurados. |
| 3 — Designação e mensagem | Formulário sem e-mail no território, contato existente/novo, revisão do celular, carga/idade, snapshot completo, Maps, mensagem em partes, cópia, reenvio, renovação, bloqueio e prazo; conversão explícita do modo e-mail | Criação idempotente por solicitação e conteúdo, reenvio com mesmo link e telefone atual, renovação sem mudar prazo; conversão limpa e-mail replicado. Não houve abertura/envio de WhatsApp real. |
| 4 — Tela pública e devolução | Rotas `#/t/:token` e `/fechar`, lista simples, marcações reais e em lote, três resumos, declaração explícita, data validada, comprovante; correção/reabertura auditada sem sobrescrever designação posterior | Navegador abriu sem login, mostrou três endereços fictícios, exibiu confirmação de zero marcações e salvou uma marcação. Foi encontrada perda de foco após salvar; correção implementada, sem repetição da validação visual. O usuário respondeu “ok” à conferência manual. Parte/total/declaração/correções têm testes de serviço; aceitação visual completa permanece pendente. |
| 5 — Compatibilidade e acompanhamento | Controles em Padrões operacionais, painel de situações/histórico/contatos, prévia e confirmação para aplicar política às ativas, relatórios com modo/resultado, contadores de bairros sem cobertura indevida, retomada/reinício; sininho em tempo real com leitura individual | Matriz existente e smoke antigo passaram. Testes novos exercitam concorrência entre abas/designações e leitura independente por administradores. WhatsApp/celular/Android e piloto publicado não validados. |

### Arquivos e execução

- Contratos: `shared/designacoes.js`; integração de compatibilidade em `src/enderecoModel.js`, `src/Mapa.jsx` e relatórios.
- Serviço: `workers/designacoes/src/{index,service,store,crypto}.js`, configuração local e tipos gerados; `firestore.rules` e `firestore.indexes.json`. O relay existente recebeu apenas a exportação do helper de credencial, sem mudança em seus fluxos.
- Interface: `src/designacoes/{DesignacaoWhatsApp,TerritorioPublico,LoginDemonstracao}.jsx`, clientes de API, `App.jsx`, `main.jsx`, configuração Firebase local e exclusão de cache da API na PWA. O frontend padrão só mostra os controles novos se a URL da API for configurada.
- Testes: `tests/unit/designacoes*.test.js`, `scripts/smoke-designacoes-emulator.mjs` e `scripts/test-designacoes-local.mjs`; `firebase.designacoes.local.json` e scripts npm `designacoes:*`.
- Instruções completas, limites e preparação posterior: `workers/designacoes/README.md`.

Comandos executados e resultados finais:

| Verificação | Resultado |
| --- | --- |
| `npm.cmd run test:unit` | 202 testes aprovados em 14 arquivos, incluindo 52 novos. |
| `npm.cmd run worker:test` | 20 testes do relay aprovados. |
| Matriz `scripts/test-firestore-rules.mjs` | 53/53 asserções aprovadas. |
| `scripts/smoke-enderecos-grupos-emulator.mjs` | Fluxo antigo aprovado, incluindo verificações negativas esperadas. |
| `scripts/smoke-designacoes-emulator.mjs` | 72 verificações aprovadas: API, Auth, Rules, transações, concorrência, relógio e sininho. |
| `npm.cmd run lint` | Sem erros ou avisos na verificação final. |
| `npm.cmd run build` | Build local do frontend e PWA aprovado; sem alteração de versão/publicação. |
| `wrangler types` | Tipos gerados a partir da configuração; schema instalado e tipos atuais de Workers consultados. |
| Runtime Wrangler local | Consulta pública retornou HTTP 200 com três endereços; handler agendado retornou “Ran scheduled event”. |

Os testes de integração usaram exclusivamente `demo-territorios-designacoes` e loopback. As portas habituais 8080/9099 já estavam ocupadas; a demonstração usa 8185/9195. Uma segunda configuração **ignorada pelo Git** usou 8285/9295 para o último ciclo de testes, preservando a demonstração. Um erro do emulador em GET com identificador binário de transação foi resolvido usando `batchGet`; contenção recebeu retry com `retryTransaction` e intervalo variável. Erros `PERMISSION_DENIED` dos cenários negativos são esperados e não indicam falha da suíte.

### Limites e próximos passos concretos

1. O usuário confere o foco após salvar e as confirmações pela demonstração local. Não repetir automaticamente a validação no navegador. Ainda faltam revisão visual completa do painel, devolução parcial/total no navegador, tabulação/leitor de tela, falha de rede em UI e lista extensa em celular.
2. Limite inicial: 100 endereços por designação; inclusão/remoção/transferência/arquivamento e edição direta ficam bloqueados enquanto o vínculo por link existir. Devolver primeiro mantém snapshot e histórico; redesignar gera outra credencial. Isso é uma restrição deliberada da entrega inicial, não uma mudança silenciosa da lista enviada.
3. Rotina: páginas de 100, até 20 páginas por execução; excedentes seguem para a próxima execução. O painel expõe falhas/vencidos pendentes. A aplicação global às ativas é explícita, por designação, com prévia, proteção de versão e resultados individuais em caso de falha parcial.
4. A configuração preparada é só de demonstração. O Wrangler instalado (4.120.0) possui runtime até 2026-08-08: o script local passa essa data como ajuste explícito; a configuração conserva a data de 21/10. Antes de publicação, atualizar/validar o runtime e revisar IAM dedicado, segredos/rotação, origens, domínio, limites de abuso, Rules/índices e cron. Nada disso foi aplicado remotamente.
5. Não foram validados WhatsApp real, compartilhamento extenso, destinatário real, Android/WebView/deep links nativos nem piloto em produção. O comprovante oferece contato WhatsApp somente quando um administrador informar explicitamente um número de divulgação em Padrões operacionais; nenhum número real foi configurado.

O escopo local avançou pelas cinco dependências, mas a aceitação integral do plano não é declarada: os itens manuais e o piloto acima permanecem abertos. Qualquer publicação, mensagem externa, migração ou escrita real exige autorização específica posterior.

## 14. Ajustes finais da tela pública — 22/10/2026

Solicitação posterior: simplificar o fim da mensagem para um único acesso ao território, modernizar a tela preservando a leitura confortável, colocar o mapa antes da lista, oferecer navegação/marcação nos pontos e usar confirmação central com ação principal fixa embaixo.

Antes de editar, o Git foi inspecionado: havia alterações posteriores, inclusive de versão, administração, mapa, Worker e correções na própria tela pública. Elas foram preservadas. As proteções contra resposta de consulta atrasada, confirmação ao marcar o último endereço, abertura de links antigos `/fechar` e data padrão resolvida no servidor permanecem no fluxo.

Implementado localmente:

- `shared/designacoes.js`: a mensagem mantém a lista escrita e os links Maps dos endereços; termina com **um único link do território**, para ver, marcar e devolver. Não houve renovação/revogação de links por essa alteração. Links antigos de revisão continuam reconhecidos.
- `src/designacoes/TerritorioPublico.jsx` e `territorioPublico.css`: apresentação com cabeçalho/progresso, cartões mais claros e texto principal de 18–19 px, mapa acima da lista, navegação e marcação por endereço, barra inferior fixa e espaço reservado para ela/safe area. O comprovante recebeu a mesma apresentação visual.
- `MapaTerritorioPublico.jsx` e `territorioPublicoUtils.js`: mapa Leaflet carregado sob demanda, pontos com código/situação e popup para navegar ou marcar/desmarcar. A lista e o mapa usam a mesma operação e a mesma resposta confirmada do servidor. O enquadramento não reinicia a cada marcação. Coordenadas vêm do snapshot já autorizado, inclusive dos links Maps existentes; não há nova consulta a contatos/territórios nem geocodificação. Endereço sem coordenadas continua na lista e usa seu link original de navegação.
- `ModalConfirmacaoPublica.jsx`: `<dialog>` central, fundo inerte, foco inicial no título, navegação de teclado contida pelo navegador, fechamento por botão/cancelar/Escape e bloqueio de fechamento durante o salvamento. Mantidos os resumos zero/parcial/total e a confirmação separada de cobertura declarada. Não há conclusão automática ao marcar todos.

Verificações desta revisão: **212 testes unitários aprovados em 15 arquivos**, incluindo cenários de coordenadas inválidas/ausentes e navegação, além de asserções para um único link do território na mensagem e nas partes. Os **20 testes do relay**, o **build Vite/PWA**, o lint dos arquivos alterados e `git diff --check` passaram. O lint global identificou um erro já presente na inspeção inicial em `gerar-versao.js:14` (`process` não definido); esse arquivo, com alterações posteriores do usuário/outra ferramenta, não foi modificado nesta revisão.

Validação visual: a primeira tentativa abriu a tela com os três endereços fictícios, os pontos e controles do mapa, os links de navegação da lista e a barra inferior. As imagens do mapa exibiram bloqueio 403 do OpenStreetMap. A validação no navegador foi interrompida e foi solicitada ajuda ao usuário, sem repetir a tentativa, trocar navegador ou efetuar login. Por isso, popup, marcação pelo mapa, modal central e disposição final em celular ainda dependem de conferência manual.

Foi identificada uma incompatibilidade entre a política `no-referrer` da tela e a [exigência de Referer do provedor](https://operations.osmfoundation.org/policies/tiles/). O código foi ajustado para a URL canônica do mesmo OpenStreetMap e `referrerPolicy="origin"` **somente nas imagens do mapa**: a origem do site pode ser enviada, sem fragmento/token, caminho ou credencial. A API e os links externos continuam sem referrer. Também há orientação de uso da lista quando o fundo do mapa falha. Esse ajuste não foi revalidado visualmente depois do bloqueio; não se declara o carregamento das imagens como aprovado.

Somente implementação, build e dados fictícios em emuladores locais nesta revisão. Não houve deploy, alteração de versão, escrita real, mensagem externa, commit ou push. A validação em WhatsApp real/Android continua separada.

Ajuste posterior de 22/10: o usuário confirmou que o mapa carregou no navegador habitual e pediu uma apresentação menos ampliada. A tipografia foi reduzida moderadamente (base de 18 para 16 px; endereços de 19 para 17 px; títulos, modais e comprovante proporcionais), com menor peso nos títulos e espaçamentos mais compactos. Botões principais continuam com pelo menos 48 px de altura. Build Vite/PWA aprovado; sem nova tentativa de validação no navegador.

Revisão posterior de 22/10, a pedido do usuário: escala próxima ao restante do sistema (base 14 px, endereços 15 px, títulos 20–24 px), cartões e barra inferior mais compactos. O mapa passou a ocupar toda a largura da página, sem recuos laterais; os textos e a lista conservam seu espaçamento. Removido o controle de zoom adicional, mantendo somente o nativo do Leaflet. Os pontos e o popup ficaram menores, com ações lado a lado e limites calculados a partir da área disponível do mapa, incluindo rolagem para conteúdo extenso.

Nova verificação visual expressamente solicitada: na demonstração local, em área de 307 px de largura, o mapa iniciou em x=0 e ocupou aproximadamente 307 px; a página não apresentou excesso horizontal. O popup aberto mediu aproximadamente 205 × 114 px e ficou inteiramente dentro do mapa de 307 × 240 px. O DOM confirmou exatamente um conjunto de controles de zoom. O fundo do mapa carregou nessa conferência. Evidência local: `artifacts/visual/territorio-mapa-bordas.png`. Essa conferência não substitui testes em WhatsApp/Android nem as demais aceitações pendentes acima.

Feedback de espera — 22/10: marcação individual na lista substitui visualmente o check por um indicador de carregamento e “Salvando…”, mantendo o input montado para preservar foco e acessibilidade. A mesma indicação aparece no botão do popup do endereço e na marcação em lote. A barra inferior sinaliza a operação em andamento; a confirmação mostra “Devolvendo…” ou “Desmarcando…”. A trava síncrona de requisição e os controles desabilitados impedem novas ações enquanto o servidor responde. A situação “feito” continua dependendo da confirmação do servidor; erro libera os controles para nova tentativa. Indicadores têm estado acessível de ocupação e respeitam movimento reduzido. Validação: 212 testes unitários, build Vite/PWA e lint dos dois componentes alterados aprovados. Não houve nova validação visual nesta alteração.

Simplificação posterior — 22/10: removidos “Marcar todos” e “Desmarcar todos” da tela pública, junto com a confirmação de limpeza em lote e os trechos de estado/estilo que ficaram sem uso. A marcação permanece individual na lista e no mapa, com indicador de espera e bloqueio durante o salvamento. Preservados o fluxo de revisão/devolução e os contratos existentes da API. Lint dos componentes, build Vite/PWA e verificação de espaços do diff aprovados. Sem nova validação no navegador nesta alteração.

Identidade visual — 22/10: aplicada a paleta já usada em `src/index.css` e `src/uiClasses.js`: cabeçalho no azul principal, títulos/contadores e cabeçalho do mapa em azul suave, barra inferior com fundo azul claro e cartões com borda lateral azul para pendentes ou verde para feitos. Textos e sinais de situação foram mantidos para não depender somente da cor. O modal segue a mesma paleta. Mantidos tamanho de fonte, mapa sem margens laterais e comportamento das ações. Conferência visual local realizada no cabeçalho, mapa, lista e barra inferior em largura estreita; evidência em `artifacts/visual/territorio-cores-lista.png`. Build Vite/PWA aprovado. Sem mudança de dados ou publicação.

Ajuste do cabeçalho — 22/10: a faixa azul do título passou a ocupar a mesma largura lateral do mapa, com compensação de margens de 20 px (14 px em telas pequenas), sem cantos arredondados nas bordas. Mantido o espaçamento interno para leitura.

Revisão pelo print — 22/10: removido o padding superior externo da página e acrescentado `env(safe-area-inset-top)` ao padding interno do cabeçalho, para o fundo azul chegar ao topo com espaço reservado ao conteúdo em dispositivos com recorte. Popup recebeu padding interno explícito de 14 px, espaço entre conteúdo/ações, área de fechamento afastada e estilos limitados ao mapa público. Marcadores agora usam cápsula interna flex com código centralizado, ponteiro discreto e check somente quando feitos, evitando disputa de display com o ícone do Leaflet. Mantidos limites de tamanho do popup e indicadores de salvamento.

Conferência visual local: cabeçalho em x=0/y=0, mapa e página com aproximadamente 307 px de largura e sem excesso horizontal; popup de aproximadamente 230 × 131 px inteiramente dentro do mapa de 307 × 240 px, padding confirmado de 14 px e código dos marcadores centralizado. Evidência: `artifacts/visual/territorio-popup-marcadores.png`. Build Vite/PWA, lint do componente e 212 testes unitários aprovados. Área segura física em celular/WhatsApp permanece sem validação em dispositivo. Nenhuma escrita de dados ou publicação nesta revisão.

Rótulos e navegação — 22/10: substituída a seta de link externo dos botões “Navegar” por um SVG de direção/rota, compartilhado entre lista e popup, mantendo o texto visível e ocultando o desenho de leitores de tela. A marcação individual passou a exibir apenas “Feito”, preservando checkbox, estado salvo e “Salvando…”. No popup, a ação de desfazer continua “Desmarcar” e o nome acessível explicita a ação de marcar. Mantida a altura mínima de toque. Lint dos componentes e build Vite/PWA aprovados; sem nova validação visual nesta alteração.

## 15. Idiomas automáticos da tela pública — 22/10/2026

Implementados português, inglês e espanhol exclusivamente na tela pública por link, seus popups, confirmações e comprovante. A primeira preferência em `navigator.languages` (ou `navigator.language` quando ausente) determina o idioma base, incluindo variantes regionais. Idiomas não atendidos usam português. O evento `languagechange` atualiza a apresentação; não há seletor adicional nem escolha persistida. O atributo `lang` e o título da página acompanham o idioma e são restaurados ao sair. Nomes/códigos, endereços cadastrados e nomes do mapa base não são traduzidos. Mensagem enviada por WhatsApp e telas administrativas permanecem fora desta alteração.

Datas têm apresentação e valor separados: inglês usa `en-US` (mês/dia/ano), português `pt-BR` e espanhol `es-ES` (dia/mês/ano). O campo nativo de data mantém seu valor ISO `AAAA-MM-DD`, com indicação textual do formato; nenhum texto exibido é reinterpretado para montar a requisição. O prazo e o horário do comprovante conservam o fuso comercial `America/Sao_Paulo`; data de cobertura é formatada como data de calendário sem deslocamento por fuso. Data vazia/inválida em “outro dia” é recusada antes da requisição usando o mesmo validador compartilhado do serviço. Não foram alterados dados armazenados, payloads, limites de data, política de prazo ou servidor.

Arquivos: `src/designacoes/idiomaPublico.js`, `useIdiomaPublico.js`, integração nos três componentes públicos e estilos do fechamento do popup. Erros públicos conhecidos recebem tradução; falhas desconhecidas usam orientação no idioma selecionado. Botões e nomes acessíveis do zoom/fechamento também foram localizados, preservando exatamente um conjunto de controles.

Validação: **238 testes unitários aprovados**, sendo 26 novos para seleção/fallback, completude e parâmetros das traduções, resumos zero/parcial/total, singular/plural, erros, formatos de datas, rejeição de entrada não ISO, datas vazias/inválidas, ano bissexto e independência do fuso do aparelho. Build Vite/PWA, lint dos arquivos alterados e verificação de espaços aprovados. Conferência visual local em inglês detectado automaticamente: tela, resumo parcial, confirmação de cobertura e seletor de data com `10/22/2026` visível e `2026-10-22` no campo. A revisão foi cancelada, sem salvar/devolver nem alterar as marcações existentes. Evidência: `artifacts/visual/territorio-ingles-data.png`. Português/espanhol têm verificação automatizada; troca real de idioma no celular, WhatsApp e Android continuam sem validação em dispositivo. Sem publicação, envio de mensagens, commit ou push.

Aviso compacto — 22/10: o feedback de salvamento saiu da linha entre cabeçalho e mapa e passou a uma cápsula na linha superior do cabeçalho, substituindo temporariamente a orientação “Acompanhe por aqui”. Mostra ícone de espera com o texto curto durante o salvamento e check com confirmação após a resposta, no idioma detectado. O anúncio completo continua disponível na região de status para leitores de tela; o resumo detalhado de conclusão permanece no modal. Nenhuma linha adicional é reservada ao aviso. Lint do componente, build Vite/PWA e verificação de espaços aprovados; sem nova validação no navegador nesta alteração.

## 16. Publicação autorizada — 22/10/2026, versão 3.8.381

O usuário autorizou explicitamente “publicar tudo” após os ajustes locais. Publicado o conjunto implicado no fluxo: Hosting `territ-es-sbs` do projeto `territ-es-sul-sbs` (alias `idiomas`), Rules/índices e Worker `territorios-designacoes-idiomas`. O relay de notificações não foi republicado: sua única alteração de código era exportar um helper para o bundle do Worker de designações, sem mudança de comportamento no serviço já publicado. Nenhum commit/push, migração, mensagem externa ou edição manual de registros reais foi realizado.

Antes da publicação: guardas Firebase/Cloudflare confirmaram projeto e conta; segredos existentes do Worker foram verificados somente pelos nomes, sem substituição/rotação; configuração de produção, limitadores e origens conferidos. Rules remotas foram lidas e seu SHA-256 normalizado coincidiu com o arquivo local (`6fcdf23a0837bbbce8a41387a307a27397008058e47ed9fe5a63265ef24f9214`); o índice de `designacoes_links` já existia. Wrangler 4.151.3 executou dry-run com sucesso. A importação explícita de `node:process` foi acrescentada ao script de versão para corrigir o único erro de lint, preservando suas demais alterações.

Verificações anteriores à publicação: 238 testes unitários, 20 testes do relay, matriz de Rules e smokes antigo/novo em emuladores demo (72 verificações de designações) aprovados; lint global e build aprovados. Os testes usaram portas 8285/9295, preservando a demonstração em 8185/9195. Nenhum teste criou designação em produção.

Publicação:
- Frontend/PWA e pacote de atualização remota **3.8.381**, via Hosting em `https://territ-es-sbs.web.app`.
- API `https://territorios-designacoes-idiomas.espanhola-sul-sbs.workers.dev`, versão Worker `15734218-d80c-48af-be34-78d428884d21`, com Cron Trigger `*/15 * * * *` confirmado pelo deploy. Mantidos a chave existente e os acessos anteriores.
- Rules compiladas/publicadas (conteúdo já atualizado) e índices publicados sem exclusões.

Conferência após publicação: `/version.json` e manifesto OTA retornaram 3.8.381; HTML e os sete assets iniciais conferiram por SHA-256 com o build local. O ZIP público conferiu com o hash do manifesto: `64f9193b4c9a92dd1dbdd1f3745ff4e2dfbb5d436e604f89587680410f7f6f5e`. A API rejeitou uma credencial propositalmente inválida com 403, CORS da origem esperada e `no-store`, sem consultar/escrever registros de designação. Evidências: `artifacts/release/verification-3.8.381.json` e snapshot das Rules anteriores. O build aponta para a API real e não contém a conexão local `127.0.0.1:8788`.

Não foi feito piloto com destinatário real, teste de mensagem WhatsApp, Android/celular físico, escrita autenticada em produção ou disparo manual do agendamento. Esses itens continuam separados da confirmação de publicação e disponibilidade dos artefatos. As limitações históricas das seções anteriores descrevem seus respectivos ciclos locais; esta seção registra o estado publicado atual.
