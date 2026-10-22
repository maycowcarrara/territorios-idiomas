# Prompt para iniciar a implementação em outra conversa

Copie o texto abaixo na nova conversa aberta no projeto `C:\Projetos\territorios-idiomas`:

```text
Quero começar a implementação local da designação por WhatsApp e acesso sem login no Territórios e Idiomas.

Leia integralmente C:\Projetos\territorios-idiomas\docs\planejamento-designacao-whatsapp-sem-login.md. Ele contém o escopo consolidado aprovado e os critérios de aceite. Não fique só propondo outro plano: inspecione o código e comece a implementar, seguindo as etapas do documento e mantendo progresso verificável nele.

Antes de editar, leia as instruções AGENTS.md aplicáveis, verifique git status e os hunks existentes e preserve alterações concorrentes, inclusive documentos ainda não rastreados. O planejamento e este prompt podem estar sem commit; isso não os torna descartáveis. Use as skills Cloudflare/Workers pertinentes e consulte documentação oficial atual quando necessário. Não use credenciais de produção para os testes locais.

Escopo obrigatório:
1. Contatos sem conta/e-mail, buscados pelo celular normalizado, com ID interno permanente: trocar número preserva pessoa, histórico e vínculos. Mostrar carga de territórios ao escolher o contato.
2. Designação de grupos_enderecos por contato, com link aleatório curto por designação. Preservar contas e designações por e-mail, contratos internos e códigos atuais. Atualizar mapa, ocupação, devolução, relatórios e contadores para reconhecer o novo modo.
3. Composição estável durante a designação; não alterar silenciosamente a lista enviada. Mensagem WhatsApp com código/nome do território, código/endereço escrito/Maps de cada local, data limite, link de consulta e link de revisão/devolução. Reenvio mantém o acesso; renovação troca apenas o token.
4. Tela pública simples, acessível e sem login/instalação: lista dos endereços daquele território, feitos/pendentes reais, marcar/desmarcar individualmente e marcar/desmarcar todos. Uma ação principal Devolver território, com confirmação clara para todos feitos, parte feita ou nenhum feito. Ações em lote não fecham automaticamente.
5. Permitir conclusão por marcações e por declaração explícita de cobertura completa, mesmo sem marcações individuais. Devolução parcial/sem cobertura preserva marcações e pendências e não conta como território coberto. Retomada identifica progresso herdado e oferece reinício explícito. Data da cobertura vem como hoje, com ajuste discreto e validação no servidor.
6. Comprovante e correção administrativa auditada, sem apagar eventos ou sobrescrever designação posterior. Reabertura gera novo link. Painel distingue designados, devolvidos parcialmente, devolvidos automaticamente e concluídos.
7. Prazo em Configurações do sistema: número de dias até devolver automaticamente. No vencimento, bloquear o link, devolver/liberar o território sem declarar cobertura, preservar marcações e histórico e notificar os administradores pelo sininho. Funcionar sem ninguém abrir o app, com rotina agendada e processamento idempotente. Mudança global não afeta ativas silenciosamente; prorrogação é ação explícita. Não criar uma automação desta conversa no Codex: o agendamento pertence ao sistema/Worker.
8. Backend específico, transações, controle de concorrência, idempotência, autorização estrita por designação, segredo recuperável cifrado para reenvio e Rules sem acesso público direto aos dados. A autorização da API precisa de testes próprios, pois a conta de serviço não depende das Rules.

Implemente em etapas coerentes, começando pelos contratos/contatos/compatibilidade e avançando pelas dependências descritas no plano. Não entregue uma etapa isolada como se todo o fluxo estivesse pronto. Se houver limite real de contexto/ambiente, registre exatamente o concluído, testes executados e próximo passo, sem alegar aceitação do que não foi validado. Use defaults técnicos coerentes com o plano para evitar perguntas sobre escolhas rotineiras.

Execute testes unitários, testes do Worker e integração com emuladores, matriz de Rules, smoke, lint e build conforme as mudanças. Valide relógio/vencimento, devolução automática com aviso único, concorrência, reenvio, troca de telefone, retomada parcial e os três resumos de devolução. Emulação local, navegador, WhatsApp real, Android e produção são evidências separadas.

Instrução obrigatória do projeto: se a primeira tentativa de usar navegador para validar falhar, pare essa validação e me peça ajuda; não insista, não troque navegador e não repita login automaticamente. Continue apenas o trabalho independente dessa validação.

Esta solicitação autoriza implementação e validação locais. Não faça deploy, migração/escrita em dados reais, envio de WhatsApp/e-mail, commit ou push sem autorização específica. Prepare um resultado concreto e revisável antes de pedir qualquer autorização adicional.

Ao concluir, informe arquivos alterados, comportamento implementado, testes realmente executados, pendências e o necessário para um piloto/publicação posterior.
```
