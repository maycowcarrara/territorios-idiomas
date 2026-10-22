# Designações por WhatsApp — implementação local

Worker separado do relay. Não envia WhatsApp, e-mail ou push. `wa.me` somente prepara uma conversa: a pessoa confirma qualquer envio fora do sistema.

## Executar sem serviços ou credenciais de produção

Na raiz do repositório, em terminais separados:

```powershell
npm.cmd run designacoes:emulators
npm.cmd run designacoes:prepare
npm.cmd run designacoes:worker
npm.cmd run designacoes:dev
```

`prepare` deve terminar antes do Worker iniciar. O frontend usa `127.0.0.1:5185`, a API `127.0.0.1:8788`, Firestore `127.0.0.1:8185`, Auth `127.0.0.1:9195`. Não interromper servidores que já estejam em outras portas. O projeto é fixado em `demo-territorios-designacoes`, com bloqueio de configuração local fora de loopback/demo. A chave aleatória de demonstração fica no `.dev.vars` ignorado pelo Git. Link de revisão e conta fictícia ficam em `.designacoes-local.json`, também ignorado. Os dados desaparecem ao encerrar os emuladores sem exportação.

A ferramenta instalada é Wrangler 4.120.0, cujo workerd aceita até 2026-08-08. Somente o comando **local** passa `--compatibility-date 2026-08-08`. O arquivo de configuração conserva 2026-10-21. Antes de qualquer publicação, atualizar/validar a ferramenta e a data, sem levar esse ajuste local para produção.

O frontend normal não habilita os controles novos sem `VITE_DESIGNACOES_API_URL`. A demonstração injeta exclusivamente configuração Firebase fictícia e conecta os SDKs aos emuladores. A tela pública usa apenas a API; não exige sessão, instalação ou acesso direto ao Firestore.

Para revisar o painel local, abra `http://127.0.0.1:5185/#/demo-admin` e use **Entrar como administrador fictício**. A rota só existe no modo local, com projeto demo e host loopback; não envia link mágico. Relay, OneSignal e manifesto de atualização remota são explicitamente esvaziados no lançador local.

## Testes

```powershell
npm.cmd run test:unit
npm.cmd run worker:test
npm.cmd run designacoes:test
npm.cmd run lint
npm.cmd run build
```

`designacoes:test` inicia seus emuladores, roda a matriz existente de Rules, o smoke existente de endereços/grupos e o smoke novo de API/Rules/Auth/transações. Pare **seus** emuladores de demonstração antes de executar esse comando nas mesmas portas. Os testes rejeitam execução sem `demo-*` e emuladores locais. Não usam service account real.

O agendamento pode ser exercitado no runtime local com o `--test-scheduled` já incluído no comando:

```powershell
Invoke-WebRequest 'http://127.0.0.1:8788/__scheduled?cron=*%2F15%20*%20*%20*%20*'
```

Esse caminho é fornecido pelo Wrangler em desenvolvimento; não é endpoint público do Worker. A programação a cada 15 minutos é do sistema, não uma automação desta conversa. A chamada local do handler não comprova um Cron Trigger publicado.

## Contratos e autorização

- `shared/designacoes.js`: telefone com validação por país (`libphonenumber-js/max`), ocupação compatível, validação de prazo/data em São Paulo, confirmação por contagem e mensagem completa em partes.
- Contatos têm ID permanente; índice de celular é único em transação. Editar telefone conserva vínculos e histórico. Colisão com outra pessoa retorna conflito; não há fusão automática.
- API administrativa valida ID token Firebase e consulta `usuarios/{email}.role == admin` em cada transação. Assinatura, emissor, audiência, validade e e-mail verificado são exigidos fora dos emuladores. Autorização administrativa é independente das Rules.
- `POST /admin/contatos`, `/admin/contatos/listar`, `/admin/designacoes`, `/admin/designacoes/listar`, `/admin/configuracao`, `/admin/operacao`, `/admin/reconciliar`.
- Ações `POST /admin/designacoes/{id}/{compartilhar,renovar,prorrogar,revogar,devolver,corrigir,reabrir}`. Conversão de e-mail exige `converterEmail: true`, com limpeza atômica do e-mail replicado. Redesignar exige devolver primeiro; arquivar exige devolver e então usar o fluxo administrativo existente.
- Política global só afeta novas designações. `/admin/prazo/previa` lista datas; `/admin/prazo/aplicar` exige confirmação, versão da política e vencimento anterior esperado. Cada designação é alterada atomicamente, com resultado individual e evento determinístico; falhas parciais são expostas para revisão. Nunca aplicar ao carregamento da tela.
- API pública: `POST /public/{territorio,endereco,marcacoes,devolver,concluir}`, token no `Authorization`. A lista possui apenas código, endereço escrito e Maps; contato, e-mail, histórico e documentos completos ficam privados. O token fica no fragmento do link, não no caminho/query da API.
- Token de 12 bytes aleatórios (16 caracteres Base64URL), índice SHA-256, criação condicional e nova tentativa de geração em colisão. Versão e vínculo vigente são conferidos junto com composição, endereços e prazo em cada operação. As duas versões de link consultam; nenhuma prévia fecha ou consome o acesso.
- Reenvio decifra o mesmo token; renovação substitui somente a credencial. Prorrogação não revive vencimento. Revogação bloqueia o link, mas conserva a ocupação até devolução/rotina.
- Cifragem AES-256-GCM: IV novo e AAD com ID da designação. `TOKEN_KEYS_JSON` contém mapa versão → chave Base64 de 32 bytes; `TOKEN_KEY_VERSION` escolhe a chave para novas credenciais. Na rotação, manter versões antigas enquanto houver designações ativas cifradas com elas; renovar explicitamente para substituir credenciais. No encerramento/revogação, a cópia cifrada é removida; índices antigos permanecem sem autorizar escrita. Nunca remover chave antiga antes de encerrar/renovar seus acessos.
- Conta de serviço usa transações REST reais (`beginTransaction`, `batchGet`, `commit`, `rollback`), quatro tentativas com `retryTransaction` e intervalo variável em `ABORTED`. `batchGet` evita falha do emulador no parâmetro binário de transação em GET. Não há sequência de PATCH sem transação.
- Criação recebe `requestId` e compara o conteúdo em retry; alteração de dados com a mesma solicitação gera conflito. Marcações definem estado/conjunto desejado, com versões de composição/progresso. Encerramento é idempotente, mantém evento original e comprovante mínimo. Um token terminal não abre a lista nem modifica designação posterior.

## Cobertura, retorno e prazo

Um território comporta **1 a 100 endereços** neste fluxo. Lista e ordem são congeladas por designação. Alterações diretas de composição, cadastro ou progresso em grupo por link são bloqueadas pelas Rules; devolva antes de editar. O limite garante que marcar/desmarcar todos e designar não sejam partidos em lotes independentes.

Conclusão exige confirmação explícita e data válida entre o início da cobertura e hoje, no fuso `America/Sao_Paulo`. Pode usar todas as marcações ou declaração, sem fabricar visitas. Data da cobertura e instante de registro são separados. Relatórios identificam cobertura declarada, conclusão com marcações, parcial e automática.

Devolução parcial, sem cobertura ou por prazo preserva marcações/início, libera como `ativo`, encerra o link e não altera `ultimaConclusao`. A retomada distingue herdados; reinício explícito arquiva o progresso anterior. Marcações completas sem confirmação de cobertura não entram no contador de bairros cobertos do modo link.

Reabertura auditada exige motivo, ausência de designação posterior e composição compatível; cria outra designação/credencial. Não reativa token anterior. Havendo trabalho posterior, apenas ajuste histórico pode ser registrado. Eventos não são apagados.

O servidor bloqueia o link no vencimento; a rotina faz a liberação/notificação no próximo processamento bem-sucedido. Consulta por `operacionalAtiva + expiraEm`, páginas de 100, até 20 páginas por execução. Excedentes ficam para a execução seguinte. Falhas individuais não interrompem outras designações: estado/falhas da rotina ficam em `operacao_designacoes/vencimentos`, visíveis no painel, e o processamento pode ser reconciliado. Falha de infraestrutura na consulta/commit faz o handler falhar, sem alegar processamento concluído.

Grupo, evento, designação e notificação `designacao-expirada-{id}` são gravados na mesma transação. O aviso `ADMINS` tem leitura em `lidaPor`, individual por administrador. O sininho usa assinatura em tempo real mesmo fechado. Não há WhatsApp/push automático.

## Proteções e publicação posterior

Respostas `no-store`, `no-referrer`, `noindex`, CORS restrito e limitadores por IP e credencial. Produção sem os dois bindings de limitação falha fechada. Logs de aplicação não incluem credenciais. Observabilidade está desabilitada nesta configuração de demonstração. O frontend público não inicia login, push ou atualização automática; registro de service worker ignora abertura direta pública e a recarga automática também é impedida quando a rota muda para pública.

**Esta configuração não é uma configuração de produção.** Publicar requer autorização separada, conta de serviço dedicada com IAM mínimo, chaves secretas próprias, origens/domínio da instância reconfirmados, política e índices revisados, configuração real dos limitadores e Cron Trigger, Rules/frontend coordenados e piloto. Publicar frontend antigo enquanto há vínculos por contato pode classificá-los incorretamente. O relay não precisa de publicação pela única alteração de exportação de seu helper interno.

Não foram validados WhatsApp real, compartilhamento extenso no celular, Android/WebView/deep links nativos, leitor de tela nem produção. Conferência manual do foco após salvamento está pendente: a primeira validação visual encontrou perda de foco, o código foi corrigido e a validação no navegador foi interrompida conforme instrução do usuário. O usuário concordou em conferir manualmente.

## Publicação atual — 22/10/2026

Após autorização do usuário, o conjunto foi publicado no projeto `territ-es-sul-sbs`: frontend/PWA/OTA 3.8.381 em `https://territ-es-sbs.web.app`, Rules/índices e Worker de produção definido em `wrangler.idiomas.jsonc`. Os segredos de produção já existentes foram preservados. O deploy confirmou os limitadores e o Cron Trigger a cada 15 minutos. A configuração `wrangler.jsonc` continua exclusivamente local; não deve substituir `wrangler.idiomas.jsonc` em publicação.

Validações e evidências completas estão na seção 16 de `docs/planejamento-designacao-whatsapp-sem-login.md`. A publicação foi conferida por versão/hash dos artefatos públicos e rejeição de credencial inválida, sem criar dados de teste ou enviar mensagens em produção. Piloto real/WhatsApp/Android permanecem pendentes. Os trechos anteriores sobre publicação futura refletem os pré-requisitos da implementação local original.


## Cartão/PIN — evolução local de 22/10/2026

Contrato e evidências atuais: `../../docs/planejamento-cartao-territorio-pdf-codigo-whatsapp.md`, seção 15. As seções antigas acima descrevem a implementação token16 anterior.

- `CODIGOS_ENABLED=true` somente na configuração local; produção preparada com `false` para permitir ordem de ativação sem interromper links anteriores. PINs existentes continuam revalidados mesmo quando novas emissões estiverem desativadas.
- Novo secret independente: `PIN_HMAC_KEY`, 32 bytes Base64URL sem padding. Não registrar seu valor em log ou chat. O preparador local gera somente em `.dev.vars`; não toca segredos reais. A chave HMAC não pode ser trocada sem preservar os fingerprints históricos; o serviço recusa troca silenciosa. `TOKEN_KEYS_JSON` continua versionando AES-GCM.
- Entradas públicas antes do Bearer: `/public/cartao` (projeção mínima) e `/public/acessar-cartao` (PIN no corpo → sessão forte). Operações existentes continuam exigindo Bearer e revalidação completa.
- Limites por janela/localidade: 5/cartão+IP, 20/IP e 30/cartão em 60 segundos. Não são teto global estrito e não bloqueiam permanentemente cartão ou sessão válida.
- PDF 93 × 145 mm, QR permanente de 23 mm, mapa a 35%. Captura OSM apenas do viewport humano já visível, sem pré-busca/batch/novos tiles para resolução de impressão. Atribuição impressa e falha fechada se mapa incompleto. Integração visual externa e câmera física ainda pendentes.
- `scripts/test-designacoes-local.mjs` inclui `smoke-cartao-emulator.mjs`; use portas livres/configuração local separada quando já houver servidores. A última rodada usou Firestore/Auth 8385/9395.
- Dry-run deve usar `--outdir .wrangler/cartao-validation` (relativo ao Worker e ignorado); não colocar bundle gerado em diretório de fontes/lint.
