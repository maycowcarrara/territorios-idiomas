# Prompt para implementar consulta pelo QR e marcações por PIN

Abra uma nova conversa no projeto `C:\Projetos\territorios-idiomas` e cole o texto abaixo. Não é necessário executar o prompt antigo do cartão/PDF.

```text
Implemente e valide localmente a evolução de consulta pelo QR sem código e habilitação de marcações por PIN no projeto C:\Projetos\territorios-idiomas.

Leia integralmente:
1. docs/planejamento-consulta-qr-marcacoes-pin.md (plano vigente desta evolução).
2. docs/planejamento-cartao-territorio-pdf-codigo-whatsapp.md (base implementada e registros de publicação, inclusive seções 18 e 19).
3. docs/planejamento-designacao-whatsapp-sem-login.md (contratos legados e de designação).

O novo plano substitui somente a exigência anterior de código para ler o cartão e os textos/estados de tela relacionados. Não execute o prompt antigo de implementação do cartão; cartão, PIN, WhatsApp e PDF já existem. A base local registrada é 3.8.383. Registros históricos não comprovam o estado remoto atual. Esta tarefa autoriza implementação e testes locais, não publicação.

Antes de editar, leia AGENTS.md/instruções aplicáveis, confira git status e os hunks e preserve todo trabalho existente, inclusive arquivos não rastreados. O checkout contém alterações anteriores já publicadas e ainda sem commit. Não limpe, resete, faça stash indiscriminado nem sobrescreva arquivos para começar do zero. Use npm.cmd no Windows. Use as skills pertinentes ao alterar Cloudflare Workers. Não use subagentes sem solicitação explícita ou instrução aplicável.

Comportamento obrigatório:
- QR #/c/:cartaoId abre mapa, endereços, observações atuais e Navegar sem PIN ou login.
- Consulta não mostra checkboxes, marcações nos popups, feito/pendente, progresso herdado, prazo, ações em lote, barra inferior operacional, conclusão ou devolução. Sem controles ocultos apenas por CSS ou espaço reservado da barra.
- Botão discreto “Habilitar marcações” no cabeçalho abre formulário de quatro dígitos. PIN válido troca para a projeção autenticada e revela os controles existentes. PIN errado/expirado/429 ou cancelar não apagam a consulta.
- Link WhatsApp com código continua trocando automaticamente por sessão; /fechar abre revisão somente com autorização válida. Limpar PIN do fragmento como hoje, inclusive em erro. Não guardar PIN em storage.
- Rota simples inicia em consulta; sessão salva não habilita automaticamente. Ao tocar em habilitar, pode revalidar sessão do mesmo cartão/origem antes de pedir novo PIN. Atualizar a rota simples volta à consulta. Preservar o comprovante de devolução sem conceder edição.

Backend:
- Adicionar POST /public/consulta-cartao sem Bearer, por allowlist explícita. Manter /public/cartao mínimo e compatível e /public/acessar-cartao como troca do PIN por sessão.
- Resolver cartão opaco, grupo e composição atual; projetar só campos permitidos conforme o plano. Endereços/observações são consultáveis por quem possui o QR por decisão expressa do usuário. Não expor contatos, responsável, telefone, PIN, tokens, histórico, comprovante ou progresso.
- Não reutilizar projetar(d) nem enfraquecer validarVinculo para obter leitura anônima. Sem criar sessão/cartão, renovar, reconciliar, devolver ou escrever dados nessa consulta. Excluir arquivados e recusar composição inválida/vínculo divergente sem vazamento parcial.
- Consulta pode existir sem designação ativa, após prazo/devolução/conclusão e em território por e-mail ou legado. Grupo arquivado ou sem endereço válido fica indisponível. Habilitar marcação exige designação por PIN realmente válida.
- Todas as rotas de mutação e /public/territorio permanecem autenticadas. Sessão forte, PIN/HMAC/cifra, limites, relógio do servidor, versões, vínculo e invalidação continuam intactos. CartaoId ou flags do cliente nunca autorizam escrita.
- Manter no-store/no-referrer/noindex/CORS, REQUEST_LIMITER e limites de corpo. Consulta é leitura, não consome limitadores de tentativas de PIN nem WRITE_LIMITER. Não abrir Firestore Rules, criar catálogo público, nova coleção, migração, índice ou cache offline da consulta.

Frontend:
- Reutilizar apresentação de TerritorioPublico e MapaTerritorioPublico sem duplicar a página; capacidade operacional explícita em componentes/callbacks. Nenhum token fictício ou progresso vazio para simular autorização.
- CartaoPublico coordena consulta e habilitação independentemente: erro de um não apaga o outro. Tratar retorno à aba, troca rápida de cartão, respostas atrasadas, expiração e falha de rede. Após habilitação, carregar /public/territorio autenticado antes de permitir ações; nunca escrever usando a composição anônima.
- Perda de autorização fecha controles/revisão e volta à consulta atual quando disponível. Distinguir conflito 409 de progresso de sessão inválida; preservar releitura/revisão e comprovante atuais. Não repetir escrita automaticamente.
- PT/EN/ES, acessibilidade, foco e teclado numérico; consulta não foca o PIN ao abrir. Navegação e observações continuam utilizáveis.
- Atualizar no WhatsApp apenas a explicação do PIN para indicar que libera marcações e devolução; preservar links, divisão/reenvio e legado /t/.
- Não alterar PDF, layout, QR existente, permissões administrativas, cadastro/telefone ou fluxos por login fora do necessário.

Execute a matriz do plano com testes significativos de projeção, ausência de efeitos, autorização HTTP, ciclo de vida, PIN/sessão, UI/transições e regressões. Rode npm.cmd run test:unit, npm.cmd run lint, npm.cmd run build e smoke/Rules nos emuladores demo conforme configuração existente, preservando servidores e portas ocupadas. Não faça teste com endereços ou designações reais. Evite ampliar testes de PDF/relay/fornecedor cartográfico se essas áreas não mudarem.

Instrução do usuário: se a primeira tentativa de usar navegador para validar falhar, pare essa validação e peça ajuda; não insista, repita login ou troque navegador/viewport. Há falha de navegador anterior registrada, sem resolução documentada: não a contorne silenciosamente. Continue verificações independentes e informe a pendência visual.

Não faça deploy de Worker, Hosting/PWA/OTA, Rules ou índices; não incremente versão para release, migre dados reais, envie WhatsApp/e-mail, contrate serviço, faça commit/push ou crie automação sem nova autorização específica. Aprovações de publicação anteriores eram de outras alterações. Prepare implementação concreta e revisável antes de qualquer pedido posterior de publicação. Para futura publicação autorizada, a sequência é backend aditivo retrocompatível, depois frontend.

Não fique só propondo novo plano: inspecione e implemente até concluir o escopo local viável. Atualize o plano com arquivos, decisões, comandos e resultados realmente obtidos, deixando explícitos bloqueios externos. Ao concluir, informe comportamento, testes, limitações e pendências de navegador/piloto/publicação. Não declare esta especificação como implementação pronta.
```
