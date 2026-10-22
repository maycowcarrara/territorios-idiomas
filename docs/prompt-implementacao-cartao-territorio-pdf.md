# Prompt para implementar cartão PDF, código da designação e WhatsApp em campo único

Abra outra conversa no projeto `C:\Projetos\territorios-idiomas` e copie o texto abaixo. Este prompt substitui o prompt antigo somente para esta evolução; o fluxo de designações existente deve ser aproveitado.

```text
Quero implementar e validar localmente o plano de cartão físico de território em PDF, acesso por código de quatro dígitos e entrada de WhatsApp em campo único no Territórios e Idiomas.

Leia integralmente:
1. C:\Projetos\territorios-idiomas\docs\planejamento-cartao-territorio-pdf-codigo-whatsapp.md
2. C:\Projetos\territorios-idiomas\docs\planejamento-designacao-whatsapp-sem-login.md, incluindo o progresso, ajustes e registro de publicação.

O novo plano prevalece sobre o anterior somente para cartão/PDF, acesso por código, observações digitais e entrada/normalização de telefone. Não recrie a implementação existente de designação nem trate o registro histórico de publicação como validação do estado remoto atual.

Antes de editar, leia AGENTS.md aplicáveis, verifique git status e os hunks existentes e preserve mudanças concorrentes, inclusive arquivos não rastreados. Os documentos e os módulos de designações podem estar sem commit. Não limpe, resete, descarte ou sobrescreva esse trabalho. Use npm.cmd no Windows e as skills pertinentes para Cloudflare/Workers e criação/verificação de PDF. Não use subagentes sem solicitação explícita ou instrução aplicável.

Implemente o conjunto completo em etapas conforme as dependências do plano:

1. WhatsApp em um único campo, sem país/DDI separados. Aceitar colagem de +DDI, DDD e número com espaços, parênteses e hífens. Detectar DDI internacional sem duplicar 55. Para móvel brasileiro com/sem o nono dígito, reconhecer o mesmo contato e persistir a identidade E.164 canônica; decidir por tamanho/plano de numeração, inclusive quando o número reduzido já começa com 9. Não acrescentar 9 a fixo válido nem aplicar a regra brasileira a outro país. Normalizar de forma compartilhada no frontend e no servidor, sem máscara que destrua a colagem. Preservar contatos, ID permanente e histórico, tratar índices/aliases legados com concorrência e não fundir duplicatas automaticamente. Retirar o seletor também das partes de cadastro/edição implicadas neste fluxo, sem refatorar todos os telefones do sistema. Não confundir validade sintática com existência de conta WhatsApp.

2. Cartão permanente por território, com QR que identifica somente o cartão/território. O código de exibição T-12 não deve ser a única chave se puder mudar/repetir. Gerar/obter o identificador estável em operação administrativa idempotente; gerar PDF não designa nem renova o acesso.

3. Código numérico de quatro dígitos da designação atual, incluindo zeros à esquerda. O QR pede somente esse código; não pedir celular, conta, OTP ou código enviado por novo serviço. O link do WhatsApp inclui território + código e valida/abre automaticamente, sem redigitação ou confirmação extra. Mensagem encaminhada também abre, de propósito. O WhatsApp continua no compartilhamento existente, sem envio automático por API. Incluir o código escrito e a explicação de uso no cartão físico.

4. Reserva atômica: não repetir PIN entre designações simultaneamente válidas da instância nem reutilizar PIN histórico no mesmo território. Reenviar/prorrogar mantém; renovar troca; devolver/concluir/revogar/expirar/redesignar/reabrir invalida o acesso anterior e suas sessões. Expiração funciona pelo relógio do servidor, mesmo antes do cron. Tratar colisões, concorrência e esgotamento sem reuso silencioso ou loop. Manter credenciais fortes internamente e trocar PIN por sessão escopada à designação/versão; proteger PIN cifrado e índice com HMAC, sem tratar SHA-256 simples como proteção da baixa entropia. Cada ação revalida a autorização. Não vazar PIN/token em logs, URLs da API, analytics ou cache da PWA. As entradas públicas de cartão precisam ser despachadas antes da exigência geral de Bearer, sem desproteger demais rotas. Implementar limites específicos para tentativas, sem afirmar teto global estrito com bindings Cloudflare aproximados. Não bloquear permanentemente o território por erro de terceiros.

5. Preservar links legados de 16 caracteres e designações por e-mail até encerramento/renovação/conversão explícita. Não migrar a base real. Novas designações usam o novo acesso; ativar código em uma antiga é ação administrativa com efeito explicado sobre a mensagem anterior. QR, novo link e link de revisão aproveitam a tela pública existente. Manter PT/EN/ES, acessibilidade, navegação, marcações, progresso herdado, confirmação todos/parcial/nenhum e devolução sem regressões.

6. Incluir observações atuais abaixo de cada endereço na tela digital, usando projeção textual mínima de informacao/observacao e validação do vínculo. Não retornar documentos completos nem permitir que o QR sem código consulte os dados. Não inserir observações na impressão, no QR ou no fornecedor de mapa.

7. PDF vertical de exatamente 93 × 145 mm, mapa estático aproximadamente nos 30% superiores, pontos com códigos correspondentes à lista, cabeçalho discreto, endereços completos e rodapé com QR permanente/data/créditos. Manter texto legível e QR nítido com zona livre; se não couber, paginar no mesmo tamanho sem omitir/cortar endereços ou encolher indiscriminadamente a fonte. Prévia administrativa e download/compartilhamento pelo caminho existente, sem hospedar PDF privado em URL pública. Não alterar o layout dos relatórios existentes para fazer este cartão.

8. Definir e documentar a fonte cartográfica estática com permissão para impressão/exportação, carregamento/CORS e volume pretendido. Não assumir que os tiles comunitários do OpenStreetMap autorizam pré-busca ou lote. Não contratar fornecedor nem introduzir custo sem autorização. Desenvolver as partes independentes com fixture quando necessário, mas não apresentar a integração real como concluída sem fonte permitida e testada. Avisar localização ausente e não gerar sucesso com mapa vazio. Se precisar de credencial/dado externo, concluir o trabalho independente e pedir somente o necessário, com resultado concreto já revisável.

Execute testes proporcionais e significativos dos contratos, Worker, concorrência, integração em emuladores demo, compatibilidade legada e Rules quando afetadas, além de lint e build. Preserve servidores/portas já em uso. Renderize/inspecione PDFs curto e paginado, confirme medidas, textos, mapa/créditos e decodifique o QR para provar que não contém PIN. Atualize o plano com progresso, decisões, comandos, resultados e pendências reais. Não marque aceite físico ou externo com base em teste local.

Instrução obrigatória do projeto: se a primeira tentativa de usar navegador para validar falhar, pare essa validação e me peça ajuda. Não insista, não repita login e não troque navegador ou viewport para contornar. Continue apenas as partes independentes.

Esta solicitação autoriza implementação e validação locais. Não faça deploy, migração/escrita em dados reais, envio de WhatsApp/e-mail, contratação, commit ou push sem autorização específica. Não crie automação do Codex; o cron existente é parte do sistema.

Não fique apenas propondo outro plano: inspecione e comece a implementar. Prossiga até concluir o escopo local viável, registrando qualquer bloqueio externo concreto e preparando o resultado revisável antes de solicitar autorização adicional. Ao concluir, informe arquivos, comportamento, testes realmente executados, limitações e o que falta para piloto/publicação.
```
