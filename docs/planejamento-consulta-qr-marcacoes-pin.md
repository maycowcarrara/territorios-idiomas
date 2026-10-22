# Consulta pelo QR sem código e marcações liberadas por PIN

Data: 22/10/2026. Estado: **implementado e validado localmente; não publicado; aceite visual/piloto pendentes** (seção 11).

Prompt de implementação: [prompt-implementacao-consulta-qr-marcacoes-pin.md](./prompt-implementacao-consulta-qr-marcacoes-pin.md).

## 1. Objetivo e precedência

O QR permanente do cartão abre mapa, lista de endereços, observações e navegação sem pedir código. Marcar, desmarcar, registrar cobertura e devolver exigem a sessão obtida com o PIN vigente. Os controles operacionais ficam ocultos até a habilitação, em vez de aparecerem desabilitados.

Esta mudança foi solicitada e confirmada pelo usuário nesta conversa. A exposição de endereços, coordenadas e observações a quem possui o QR é intencional. O identificador do cartão continua opaco, sem catálogo público de cartões e sem tratar o código visível T-12 como credencial.

Este plano prevalece sobre os planos anteriores **somente** na exigência de PIN para leitura pelo cartão, nos textos relacionados e na separação dos modos de tela. Preserva a autorização de escrita e o restante dos contratos. Os documentos antigos registram decisões históricas, incluindo restrições que esta evolução substitui. Não executar novamente os prompts antigos nem recriar os recursos já existentes.

Base conferida no checkout: frontend 3.8.383, cartão/PIN implementados, PDF de uma página com QR no cabeçalho, cidade e bairro. A publicação da versão foi verificada na etapa anterior desta conversa; o planejamento não realizou nova consulta remota. A etapa documental original não autorizou mudanças funcionais ou publicação. A solicitação posterior de implementação e testes locais está registrada na seção 11; publicação segue sem autorização.

## 2. Experiência definida

| Entrada/estado | Consulta | Controles operacionais |
| --- | --- | --- |
| QR `#/c/:cartaoId` | Abre diretamente | Ocultos; botão discreto “Habilitar marcações” no cabeçalho |
| Botão de habilitação | Mantém mapa/lista visíveis | Abre formulário de quatro dígitos |
| PIN válido | Troca para a projeção autenticada atual | Aparecem marcações, progresso e barra de devolução |
| PIN incorreto, vencido ou limite de tentativas | Consulta continua disponível | Formulário mostra erro; nenhuma ação é liberada |
| Link WhatsApp `#/c/:cartaoId/:codigo` | Preserva troca automática do código por sessão | Libera diretamente se válido, sem pedir o código novamente |
| Link WhatsApp com `/fechar` | Valida antes de abrir revisão | Mantém confirmação de devolução existente |
| Sessão perde autorização durante o uso | Recarrega consulta atual do cartão quando disponível | Oculta controles, fecha revisão e explica que é preciso habilitar novamente |
| Devolução/conclusão bem-sucedida | Mostra comprovante atual | Nenhuma edição adicional; nova abertura do QR retorna à consulta |

Posição escolhida: botão secundário discreto junto ao título, fora da barra inferior. No modo consulta, a barra inferior operacional não existe; também não aparecem checkboxes, ações em lote, etiquetas de feito/pendente, progresso, prazo da designação, avisos de progresso herdado ou instruções de devolução. Não apresentar todos os endereços como “pendentes”: o modo consulta não informa o progresso operacional.

Formulário com rótulo “Código de quatro dígitos”, teclado numérico, zeros à esquerda, botão “Habilitar” e opção “Cancelar”. Cancelar devolve foco ao botão sem desmontar a consulta. Não focar automaticamente um PIN ao abrir o QR. Erros de PIN não substituem o mapa por uma tela de erro.

Escolha de sessão para esta evolução: abrir a rota simples do QR inicia em consulta; não restaurar automaticamente edição só porque há token no sessionStorage. Ao tocar em “Habilitar marcações”, uma sessão salva para **esse cartão e origem** pode ser revalidada e aproveitada; se inválida, removê-la e mostrar o formulário. Recarregar a rota simples volta à consulta. Links que trazem código continuam habilitando automaticamente. Não guardar PIN em storage. Manter comprovante de sessão encerrada sob seu contrato próprio, sem confundi-lo com permissão de editar.

## 3. Base técnica confirmada

| Arquivo | Comportamento atual e alteração prevista |
| --- | --- |
| `src/designacoes/CartaoPublico.jsx` | Faz bootstrap, troca de PIN, limpeza do fragmento e restauração automática de sessão; hoje mostra formulário antes dos dados. Passará a coordenar consulta, habilitação e sessão operacional. |
| `src/designacoes/TerritorioPublico.jsx` | Carrega `/public/territorio` e acopla consulta, progresso, marcações, confirmação e comprovante. Tornar a capacidade operacional explícita e reutilizar a apresentação sem duplicar a página. |
| `src/designacoes/MapaTerritorioPublico.jsx` | Popups têm botão próprio de marcação e marcadores exibem feito/pendente. Receber capacidade explícita, omitindo controles e semântica de progresso em consulta. |
| `src/designacoes/territorioPublico.css` | Ajustar botão/formulário e remover reserva de espaço da barra fixa no modo consulta; manter comportamento móvel. |
| `src/designacoes/idiomaPublico.js` / `useIdiomaPublico.js` | Adicionar textos PT/EN/ES e tratamento localizado dos estados de habilitação. |
| `src/designacoesApi.js` | POST, Bearer opcional, `no-store` e `no-referrer` já existem. Usar transporte atual sem mudar o erro/offline dos demais consumidores. |
| `workers/designacoes/src/index.js` | Só `/public/cartao` e `/public/acessar-cartao` dispensam Bearer. Adicionar uma única rota de consulta à lista explícita, classificação de leitura e despacho. |
| `workers/designacoes/src/service.js` | `cardAction('cartao')` retorna apenas código/disponibilidade; `acessar-cartao` cria sessão. `publicAction` valida sessão, vínculo, versões e prazo; `validarVinculo` mistura validade operacional e carregamento das observações. Separar nova projeção de leitura sem relaxar essa função. |
| `shared/designacoes.js` | Mensagem atual diz “No cartão físico, leia o QR e informe este código”. Atualizar para deixar claro que o código libera marcações/devolução. |
| `src/App.jsx` / `src/main.jsx` | Rotas `/c/` e `/t/` e exceções da PWA já existem. Preservar, sem novo login/RouteGuard. |

`projetar(d)` contém dados operacionais e pode retornar comprovante. Não reutilizá-la para consulta anônima. `validarVinculo` deve continuar recusando designação expirada, encerrada ou divergente para operações protegidas.

## 4. Contrato da API

Adicionar **POST `/public/consulta-cartao`**, corpo `{ "cartaoId": "identificador-opaco" }`, sem Bearer. Manter `/public/cartao` mínimo para compatibilidade com clientes antigos e `/public/acessar-cartao` como única troca de PIN por sessão.

Resposta proposta, montada por allowlist:

```json
{
  "modo": "consulta",
  "podeMarcar": false,
  "codigo": "T-12",
  "nome": "Centro",
  "habilitacaoDisponivel": true,
  "enderecos": [
    {
      "id": "endereco-id",
      "codigo": "E-1",
      "endereco": "Rua Exemplo, 12 — Centro",
      "lat": -26.25,
      "lng": -49.38,
      "mapsUrl": null,
      "observacao": "Entrada pela lateral."
    }
  ]
}
```

`habilitacaoDisponivel` informa somente se há designação atual apta a receber PIN pelo critério do servidor; é dica de UI, não autorização. `podeMarcar: false` é descritivo: cliente nunca concede capacidade a partir de flags manipuláveis. Nenhuma rota de escrita aceitará cartaoId, essa resposta ou ausência de credencial como substituto da sessão.

Não retornar: contato/responsável/telefone, autor, documentos completos, PIN/hash/cifra/tokens, ID da designação, histórico, auditoria, comprovante, prazo, feitos/herdados ou versões de progresso. Não aceitar filtros de coleção ou IDs arbitrários de endereço enviados pelo visitante. Não criar rota de listagem/pesquisa de cartões.

Respostas: 200 com projeção válida, 404 genérico para cartão inexistente/território arquivado/sem endereços disponíveis, 409 para composição inconsistente, 429 para limitação e 503 para serviço indisponível. Não retornar sucesso com lista parcial causada por erro de vínculo.

## 5. Fonte dos dados e ciclo de vida

1. Validar cartaoId pelo padrão atual e resolver `cartoes_territorios/{id}` → `grupos_enderecos/{grupoId}`.
2. Usar a composição **atual** `g.enderecoIds`, na ordem existente, e os documentos atuais de `enderecos`. Não depender de uma designação ativa nem de seu snapshot para consulta. Não obter/criar cartão a partir dessa rota.
3. Respeitar o limite existente `MAX_ENDERECOS_DESIGNACAO`, sem criar outro número arbitrário. Rejeitar IDs duplicados, inválidos, documentos ausentes ou vínculo `grupoId` divergente, com erro genérico. Excluir arquivados, nunca endereços de outro território. Se não restar endereço, retornar indisponível.
4. Projetar código pela convenção atual; endereço e bairro pela composição já usada no cartão, coordenadas e navegação pelos helpers existentes. Não passar campos extras por spread.
5. Observação atual: usar `informacao` textual não vazia; alternativamente `observacao`, com o mesmo limite atual de 20.000 caracteres. Renderizar como texto, nunca HTML. Preservar navegação mesmo quando não houver coordenadas válidas, pelo fallback já existente, sem introduzir geocodificação.
6. Consulta funciona enquanto o cartão resolve um território não arquivado com endereços válidos, inclusive sem responsável, designação por login/e-mail ou link legado, devolvido, concluído/finalizado ou com prazo expirado. Esses estados não habilitam PIN indevidamente. Arquivar o território suspende consulta; reativar permite novamente se o vínculo do cartão e os endereços forem válidos. Endereço arquivado não é exposto.
7. Não ler o PIN, criar sessão, renovar prazo, devolver automaticamente, reconciliar ou alterar marcações nessa consulta. Expiração/cron existentes continuam separados.
8. Após habilitar, descartar a projeção anônima como fonte das ações e carregar `/public/territorio` autenticado: essa resposta continua ligada ao snapshot/composição e progresso vigentes. Nunca construir payload de escrita com uma lista anônima possivelmente diferente. Preservar toda confirmação e controle de concorrência.

As diferenças entre a composição atual de leitura e o snapshot autorizado são deliberadas. Se a designação estiver inconsistente, a consulta atual pode existir e a habilitação falhar; mostrar orientação para procurar o responsável, sem corrigir dados automaticamente.

## 6. Autorização, proteção e compatibilidade

- Rota nova explicitamente incluída no despacho sem Bearer; não liberar `/public/*` por prefixo. Não aceitar POST de consulta em rotas de mutação.
- Manter REQUEST_LIMITER, CORS, limites de corpo, `no-store`, `no-referrer`, `noindex` e serviço desativado falhando fechado. Classificar consulta como leitura para não consumir WRITE_LIMITER; não usar limitadores de tentativas de PIN na consulta. Não registrar payload de endereços/observações ou credenciais. Não apresentar CORS/robots como mecanismos de autenticação.
- Manter PIN_IP_LIMITER, PIN_CARD_IP_LIMITER, PIN_CARD_LIMITER, reserva atômica, HMAC/cifra e sessão aleatória com prazo/versão atuais. Nenhuma troca de secrets, enfraquecimento do PIN ou nova credencial somente de leitura é necessária.
- Preservar `/public/territorio`, `/endereco`, `/marcacoes`, `/concluir` e `/devolver` autenticados. Revalidar vínculo, expiração e versões em cada ação. Ocultar UI complementa a proteção, não a substitui.
- Não abrir coleções nas Firestore Rules. Worker acessa os dados por credencial de serviço e precisa validar a nova projeção por conta própria. Não exige nova coleção, índice, migração, backfill ou cache público.
- Links legados `/t/:token` mantêm fluxo autorizado atual. Links `/c/:id/:codigo[/fechar]` continuam funcionais. Não alterar conteúdo dos QRs/PDFs emitidos nem o layout atual do PDF. A versão 3.8.383 já removeu instruções do PDF.
- Limpar PIN do fragmento imediatamente como hoje, inclusive se inválido. Erro de consulta não deve impedir o fluxo independente de troca do PIN válido quando a API autenticada estiver disponível; erro de PIN não deve apagar consulta bem-sucedida. Não tentar autenticar repetidamente.
- A consulta não persiste dados em storage, service worker ou modo offline. Revalidar ao retornar à aba. Uma tela já recebida não pode ser remotamente apagada de todas as cópias; no próximo retorno/revalidação, retirar conteúdo de território que ficou indisponível. Distinguir falha de rede de perda de autorização: não converter timeout/5xx em “código inválido”, e bloquear novas ações até revalidação em caso de estado incerto.

## 7. Organização da UI e transições

`CartaoPublico` coordena estados independentes de consulta e habilitação. Evitar um único `busy`/`erro` que substitua a página inteira ao digitar PIN. Usar cancelamento/identidade de requisição para não aplicar resposta de outro cartão, PIN ou sessão.

Reutilizar mapa, navegação, lista e observações numa apresentação comum. A implementação pode extrair um componente de conteúdo ou adicionar props explícitas ao componente existente; não criar segunda versão da tela com markup duplicado. Capacidade operacional deve ser requisito explícito em todo callback. Nunca simular autorização anônima com um token fictício, `feitos: []` ou `herdados: []` para enganar componentes operacionais.

Propagar modo consulta aos popups e marcadores do mapa. Condicionar a montagem dos controles de marcação, revisão, declaração de cobertura, seletor de data e rodapé. No modo operacional, preservar atualizações reais, estados ocupados, versões, acessibilidade e comprovante.

Em 401/403/410, limpar sessão inadequada e voltar à consulta do cartão, sem repetir escrita. Em 409, respeitar a semântica do erro: conflito de progresso exige releitura autenticada e revisão; vínculo/designação alterados não podem manter botões operacionais ativos. Não tratar todos os 409 como perda de sessão. Revalidar o token após o erro para decidir o estado. Leituras de comprovante já autorizadas continuam separadas e não concedem marcação.

## 8. Matriz de aceitação

| Camada | Casos obrigatórios |
| --- | --- |
| Projeção | Sem designação, designação ativa, vencida antes do cron, devolvida, concluída, por e-mail e legado: consulta atual permitida; habilitação só quando realmente possível. |
| Integridade | ID inexistente, arquivado, nenhum endereço, endereço arquivado, excluído, duplicado ou reatribuído; não vazar outro território nem devolver resposta parcialmente válida por falha de vínculo. |
| Privacidade | Objeto com campos extras sensíveis em fixtures; resposta pública contém só allowlist e observações textuais atuais, sem progresso/contato/PIN/sessão/snapshot histórico. |
| Sem efeitos | Comparar estado antes/depois da consulta: nenhum cartão, sessão, evento, marcação, prazo ou auditoria criados/alterados. |
| Proteção HTTP | Consulta sem Bearer funciona; todas as mutações sem token, com cartaoId, token inválido ou somente PIN são recusadas; limites/CORS/cache permanecem. |
| PIN/sessão | Zeros à esquerda, erro, 429, expiração, renovação, revogação, reatribuição; sessão de outro cartão nunca habilita; erro não apaga consulta. |
| UI | QR mostra mapa/endereço/observação/navegar; não há controles operacionais no DOM/foco/popup, progresso ou espaço vazio do rodapé; formulário discreto, cancelar/foco, loading/erro. |
| Transições | Alternar cartão durante requisição, PIN automático, sessão guardada, resposta atrasada, sair/voltar à aba, falha de rede, conflito 409 e sessão encerrada; sem reaplicar resposta antiga nem repetir escrita. |
| Regressões | Link WhatsApp e `/fechar`, legado `/t/`, confirmação todos/parcial/nenhum, data de cobertura, progresso herdado, duplo clique, comprovante e cron. |
| Apresentação | PT/EN/ES, telas pequenas, teclado, leitor de tela, navegação externa e mapa; observações com texto parecido com HTML continuam literais. |

Executar testes unitários e HTTP em `tests/unit/designacoes.test.js`, cobertura de UI significativa no harness disponível e smoke em `scripts/smoke-cartao-emulator.mjs`, além de `npm.cmd run test:unit`, `npm.cmd run lint` e `npm.cmd run build`. Usar emuladores demo e a configuração local já existente; conferir portas antes. Regras continuam privadas: executar a matriz existente em emuladores para provar ausência de abertura acidental. Não repetir toda a matriz de PDF, relay ou fornecedor cartográfico se essas áreas permanecerem inalteradas.

**Navegador:** na primeira falha, parar essa validação e pedir ajuda ao usuário. Não repetir login, trocar navegador, viewport ou insistir. Continuar verificações independentes e separar evidência de testes locais de aceite visual, WhatsApp real, impressão e Android/WebView. A falha anterior não foi resolvida nesta etapa documental.

## 9. Sequência de implementação e publicação futura

1. Ler planos, instruções aplicáveis, status/hunks e testes; preservar o checkout extenso e sem commit.
2. Implementar projeção anônima isolada e testes de allowlist, integridade e ausência de efeitos.
3. Adicionar rota HTTP restrita e testes que comprovem que escritas continuam protegidas.
4. Separar consulta/habilitação e reutilizar apresentação da tela/mapa; adicionar PT/EN/ES e testes de transição.
5. Ajustar mensagem WhatsApp apenas no texto que descreve o código; preservar link, divisão e reenvio existentes.
6. Executar matriz local proporcional; registrar comandos, resultados, decisões e pendências neste plano. Entregar alterações revisáveis.
7. **Somente com nova autorização específica**, publicar Worker retrocompatível primeiro e frontend/PWA/OTA depois; incrementar versão pelo fluxo existente e verificar versão/assets. A API nova deve ser aditiva para o frontend anterior continuar funcionando. Se necessário rollback, restaurar frontend anterior mantendo a API aditiva, sem mexer em dados ou secrets. Não remover endpoint que já esteja em uso por clientes atualizados.

Publicações anteriores desta conversa não autorizam automaticamente publicar esta nova evolução. A implementação local foi posteriormente solicitada com o prompt e está registrada na seção 11: sem migração, escrita operacional real, mensagens, contratação, commit/push ou deploy.

## 10. Critério de conclusão local

QR abre consulta atual sem PIN; consulta não oferece nem executa operações; botão habilita pelo PIN vigente; link WhatsApp preserva acesso operacional direto; API impede escrita anônima; casos de ciclo de vida e concorrência são cobertos; fluxos legados e comprovante preservados. Relatório final distingue o que passou em teste do que depende de usuário/navegador/piloto e não declara este planejamento como funcionalidade pronta.


## 11. Implementação e validação locais — 22/10/2026

Autorização: pedido anexado pelo usuário para executar o prompt desta evolução. Checkout inicial com 30 arquivos rastreados alterados e diversos arquivos não rastreados; hunks e artefatos anteriores preservados. Não existe `AGENTS.md` físico no checkout ou nos diretórios ancestrais aplicáveis; seguida a instrução fornecida na conversa. Não foram usados subagentes. Base e versão mantidas em **3.8.383**, sem publicação ou verificação remota atual.

### Implementação efetiva

- `workers/designacoes/src/index.js`: inclusão explícita de `/public/consulta-cartao` na allowlist sem Bearer e classificação de leitura. Mantidos REQUEST_LIMITER, limite de corpo, CORS, no-store, no-referrer e noindex. A consulta não consome WRITE_LIMITER nem os três limitadores de PIN. Demais rotas protegidas permanecem autenticadas.
- `workers/designacoes/src/service.js`: projeção nova isolada de `projetar` e `validarVinculo`, em transação sem writes (o adaptador existente encerra leitura com rollback). Resolve cartão/vínculo inverso, grupo e composição atual. Recusa duplicação, IDs inválidos, documento ausente e endereço de outro grupo; exclui arquivados e recusa lista vazia. Allowlist explícita, observação textual atual limitada a 20 mil caracteres, coordenadas válidas ou pesquisa Maps pelo endereço; não usa URLs arbitrárias armazenadas. Não decifra nem verifica PIN, cria sessão, reconcilia ou altera ciclo/progresso. A disponibilidade de habilitação é somente uma indicação calculada pelo estado e vínculos da designação, sem conceder autorização. Snapshot de designação inválido não bloqueia uma consulta atual íntegra.
- Leitura autenticada pode receber `cartaoId` para conferir que a sessão pertence ao cartão solicitado; o parâmetro somente restringe o acesso e nunca substitui a sessão. Clientes legados sem esse parâmetro continuam compatíveis.
- `src/designacoes/CartaoPublico.jsx`: consulta e habilitação com erros/gerações de requisição independentes. Fragmento com PIN removido antes do I/O, inclusive no erro. QR simples não restaura edição; botão pode revalidar a sessão da mesma origem/cartão antes de pedir PIN. PIN preserva zeros, não vai para storage, cancelar invalida respostas pendentes e devolve foco. A troca automática do link WhatsApp funciona mesmo se a consulta falhar. Toda ativação lê `/public/territorio` autenticado antes de montar a capacidade operacional. Trocar cartão/entrada invalida o estado anterior. Expiração e perda de autorização retiram os controles e recarregam consulta; comprovante autorizado segue separado.
- `src/designacoes/TerritorioPublico.jsx`: apresentação única com modo de consulta explícito, sem token ou progresso fictício. Consulta não monta checkboxes, estados feito/pendente, prazo, progresso, herdados, revisão, confirmação, ações de devolução nem rodapé. Escritas recebem exclusivamente IDs/versões do snapshot autenticado. Retorno à aba bloqueia ações durante releitura; se há escrita pendente, aguarda sua resposta e depois revalida. Rede/5xx não viram PIN inválido nem repetem escrita. 409 de progresso relê dados e exige revisão; 409 na própria leitura de autorização retira capacidade.
- `src/designacoes/MapaTerritorioPublico.jsx`: capacidade propagada explicitamente a marcadores/popups; consulta tem navegação e observação textual, sem situação operacional ou botão de marcação. `territorioPublico.css` elimina a reserva do rodapé na consulta e estiliza o formulário/foco. `idiomaPublico.js` contém PT/EN/ES para habilitação.
- `shared/designacoes.js`: alterada somente a explicação do PIN na mensagem: QR consulta, código libera marcações/devolução. Links, divisão/reenvio e legado preservados.
- Harness acrescentado com `react-test-renderer` em devDependencies, preservando as alterações anteriores de versão/dependências. Testes montam os componentes React reais com transporte e superfícies DOM/mapa simulados; não constituem validação visual nem teste de navegador real. Novos arquivos: `tests/unit/consultaCartaoUi.test.js` e `consultaMapaUi.test.js`; ampliados `designacoes.test.js` e `scripts/smoke-cartao-emulator.mjs`.

### Resultados obtidos

| Comando | Resultado e alcance |
| --- | --- |
| `npm.cmd run test:unit -- --reporter=dot` | **335/335 testes, 21 arquivos**. Projeção/allowlist/ausência de efeitos; ciclo sem designação, ativa, vencida, devolvida, concluída, e-mail, legado, revogada e divergente; composição inválida; autorização HTTP; transições de UI, PIN 0000/erros/429, cancelamento/foco simulado, resposta atrasada, troca de cartão/rota, StrictMode, retorno à aba, rede/409, sessão encerrada/comprovante; popup PT/EN/ES. |
| `npm.cmd run lint` | Aprovado, sem erros ou avisos. |
| `npm.cmd run build` | Frontend/PWA aprovados, sem incremento de versão. |
| `npm.cmd run designacoes:test` | Configuração existente `firebase.designacoes.local.json`, projeto **demo-territorios-designacoes**, somente Auth/Firestore. Rules **53/53**, smoke legado aprovado, designações **102 verificações**, cartão/PIN/consulta **35 verificações**. Comparação de todas as coleções do namespace demo antes/depois da consulta, inclusive vencida antes do cron, não encontrou alterações. |
| `npm.cmd exec -- wrangler deploy --dry-run --config workers/designacoes/wrangler.idiomas.jsonc --outdir .wrangler/consulta-cartao-validation` | Bundle e verificações locais aprovados com Wrangler **4.151.3**; encerrou com `--dry-run: exiting now`, sem upload/publicação. Bundle gerado preservado em `output/consulta-qr-worker-validation/`. |
| `git diff --check` | Aprovado. Avisos de conversão LF/CRLF em arquivos existentes não são erros de whitespace. |

Portas 8185/9195/4415/4515 e as de desenvolvimento foram consultadas antes de iniciar: não havia listeners nas portas verificadas. Os emuladores iniciados pela suíte foram encerrados pelo próprio comando. Nenhum servidor existente foi interrompido. Fixtures fictícias apenas, sem acesso a endereços/designações reais. As negações PERMISSION_DENIED dos testes negativos, o `Network error` intencional do teste unitário e avisos de metadados/ESM do ambiente não impediram a aprovação das suítes.

Skills usadas: `cloudflare`, `workers-best-practices` e `wrangler`. Consultados best practices oficiais, schema/CLI instalada e tipos atuais `@cloudflare/workers-types` **5.20261022.1** em pasta temporária, sem alterar bindings ou configuração. Referência: [Cloudflare Workers — boas práticas](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).

### Pendências e limites

A falha anterior de captura no navegador (seção 15 do plano do cartão) continua sem resolução registrada. **Nenhuma nova tentativa de navegador, login, troca de navegador ou viewport foi feita.** Solicitada ajuda ao usuário para confirmar a resolução ou conferir manualmente. Permanecem pendentes: apresentação real em telas pequenas, rolagem, foco/tabulação/leitor de tela reais, mapa e navegação externa no navegador, WhatsApp/QR impresso, Android/WebView e piloto. Harness, testes HTTP e emuladores não comprovam esses aceites.

PDF, QR emitido, telefone/cadastro e permissões administrativas não foram alterados nesta evolução; não foi repetida a matriz PDF/relay/fornecedor cartográfico. Nenhuma mudança em Rules/índices, migração, coleção nova, cache offline de consulta, secrets, dados reais, mensagens, commit/push ou automação. Não se declara publicação nem aceite integral. Uma futura publicação depende de nova autorização específica e segue **backend aditivo retrocompatível primeiro, frontend/PWA/OTA depois**.


## 12. Nova tentativa de navegador autorizada — 22/10/2026

Após explicar a falha anterior, o usuário autorizou expressamente: “sim, vai”. Preparada demonstração isolada com dados fictícios em namespace `demo-cartao-*`, usando Auth/Firestore 9295/8285, API 8789 e Vite 5186. As portas estavam livres; nenhum processo existente foi substituído. A cópia do helper e seus dados ficam em `output/consulta-qr-visual/`, sem sobrescrever `tmp/cartao-local/acesso.json` ou outros artefatos prévios. Emuladores e demonstração ficaram em execução para conferência manual.

A ferramenta abriu o QR no navegador integrado e **conseguiu capturar imagens nesta rodada**. Não foram alterados navegador, viewport, idioma ou login. A interface detectou inglês automaticamente. Resultados observados:

- Consulta abriu mapa, dois endereços, observação e navegação sem pedir PIN; não havia checkbox, progresso ou barra de devolução.
- Rolagem mostrou os dois endereços completos, sem reproduzir o desaparecimento de conteúdo. Os tiles OSM carregaram nessa amostra.
- Popup de consulta mostrou endereço, observação e Navegar, sem ação ou situação operacional.
- Habilitar abriu campo numérico; cancelar voltou o foco ao botão. PIN fictício incorreto exibiu erro e preservou consulta; PIN válido revelou os controles.
- Uma marcação somente na fixture foi confirmada e a lista passou a 1/2. Revisão parcial exibiu contagem e confirmação corretas, com foco no título; cancelar retornou foco ao botão de devolução. Nenhuma devolução foi confirmada.

**Inconsistência detectada e interrupção:** após salvar, o rótulo acessível/tooltip do ponto E-1 no mapa ainda dizia `Pending`, enquanto a lista já mostrava `Done`. A conferência de navegador foi encerrada nesse ponto, sem repetir a validação após a correção. Inspeção do código instalado de React-Leaflet confirmou que o atualizador de Marker não sincroniza a opção `title`; Leaflet a reaplica ao atualizar o ícone. Corrigido `MapaTerritorioPublico.jsx` para atualizar opção e atributo do elemento usando a referência do marcador, preservando o marcador e popup existentes. Teste de regressão verifica transições pendente/feito, idioma e consulta sem remontagem. **336 testes** aprovados, lint e build aprovados após o ajuste. A correção do rótulo ainda precisa de conferência em navegador; não se declara aceite visual integral.

Capturas efetivamente obtidas: `output/consulta-qr-visual/consulta-rolagem.png`, `popup-consulta.png`, `pin-incorreto.png`, `marcacao-autorizada.png` e `revisao-parcial.png`. Elas registram a rodada antes da correção do rótulo. O texto com `\n` visível na observação é literal da fixture herdada do helper, sem transformação dos dados pela tela.

Pendências restantes: revalidar o rótulo corrigido, link automático com `/fechar` em navegador, demais idiomas e tecnologias assistivas, navegação externa real, dispositivos/WhatsApp/QR físico e piloto. O desaparecimento antigo não foi reproduzido, mas sua causa histórica continua sem diagnóstico fechado. Sem publicação, incremento de versão, dados reais, mensagem, commit ou push.


## 13. Compactação visual solicitada — 22/10/2026

A pedido do usuário, o botão textual de habilitação virou um cadeado discreto no canto do cabeçalho, com nome acessível e tooltip PT/EN/ES, alvo de 40 px e fluxo de PIN/cancelamento preservado. Retirada a linha extra que o botão ocupava; consulta usa título e margens mais compactos. Na amostra do navegador, o cabeçalho de consulta mediu aproximadamente 106 px.

Popup: padding reduzido de 14 para 10 px, intervalo vertical de 12 para 4 px, endereço a 12 px e observação secundária a 11 px/linha 1,3. A altura máxima aproveita melhor a área do mapa sem retirar o limite adaptativo para observações extensas. Na fixture conferida, conteúdo/área visível foram iguais (137 px em consulta e 140 px no acesso habilitado), sem rolagem interna. Nenhum texto foi truncado.

Lista: cartões com padding de 10 px, intervalo de 8 px, bordas/cantos menores, endereço a 14 px com peso normal e observação a 12 px com margens explícitas. Mantidos os controles de toque existentes. Legenda de pendente/feito permanece montada somente com capacidade operacional autenticada; instrução textual de +/− removida. Os controles reais de zoom continuam no mapa.

Validação: 336 testes unitários/componentes, lint, build e diff-check aprovados. Adaptado somente o seletor do harness para reconhecer o nome acessível do cadeado. Conferência no navegador integrado existente, sem mudança de viewport/navegador/login: cabeçalho compacto, popup sem scroll na fixture, consulta com zero checkboxes e sem legenda/rodapé operacional. Capturas `output/consulta-qr-visual/consulta-cadeado.png` e `popup-compacto.png`; aba mantida para revisão. O estado autorizado observado também mostrou o rótulo `Done` do marcador previamente corrigido. Sem publicação ou alteração de versão/dados reais.
