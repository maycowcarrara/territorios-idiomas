# Cartão de território em PDF, código de acesso e WhatsApp em campo único

Data: 22/10/2026. Estado: implementação e testes locais realizados; fonte OSM de viewport escolhida. Aceite visual completo, captura real e piloto físico continuam pendentes (seção 15).

Prompt de continuidade: [prompt-implementacao-cartao-territorio-pdf.md](./prompt-implementacao-cartao-territorio-pdf.md).

Evolução implementada e validada somente localmente em 22/10/2026, sem publicação e com aceite visual/piloto pendentes: [consulta pelo QR sem código e habilitação de marcações por PIN](./planejamento-consulta-qr-marcacoes-pin.md), com [prompt próprio](./prompt-implementacao-consulta-qr-marcacoes-pin.md). Essa evolução substitui no código local a exigência de PIN para leitura; mantém a escrita protegida. Resultados e limites estão na seção 11 do novo plano. Não reutilizar o prompt antigo para iniciar essa evolução.

## 1. Objetivo e precedência

Gerar no próprio sistema um cartão físico reutilizável para cada território de idiomas, com mapa estático, lista de endereços e QR permanente. A consulta digital continua na tela existente, autorizada por um código compartilhável da designação vigente. Simplificar também o cadastro de WhatsApp para um único campo, aceitando o telefone completo copiado pelo dirigente.

Este documento complementa [planejamento-designacao-whatsapp-sem-login.md](./planejamento-designacao-whatsapp-sem-login.md). Em caso de conflito, este plano prevalece apenas quanto ao cartão/PDF, ao novo acesso por quatro dígitos, às observações digitais e à entrada/normalização do WhatsApp. Os demais contratos de designação, progresso, prazo, devolução, histórico e permissões continuam vigentes.

O documento anterior registra publicação da versão 3.8.381 em 22/10/2026. Esse registro histórico não comprova o estado remoto atual. Esta análise conferiu arquivos locais e documentação oficial, sem consultar dados operacionais ou validar produção.

Escopo: territórios de idiomas baseados em `grupos_enderecos` e `enderecos`. Não alterar o modelo legado `territorios`/`territorios_contexto`, contas, permissões ou designações por e-mail para adaptar este fluxo.

## 2. Decisões funcionais consolidadas

1. PDF vertical de **93 mm de largura por 145 mm de altura**.
2. Mapa abaixo do cabeçalho, QR discreto ao lado do título e restante da página dedicado aos endereços. Rodapé somente com créditos e data. Uma única página, com redução uniforme da fonte quando necessário (revisão da seção 18).
3. Mapa com pontos identificados pelos códigos dos endereços, correspondentes à lista. Não colocar observações ou textos completos sobre cada ponto.
4. Lista impressa com código e endereço completo. Observações ficam na consulta digital, abaixo de cada endereço.
5. Um QR por cartão/território, permanente entre designações, sem senha ou código corrente embutido.
6. Um código numérico de **quatro dígitos** por acesso vigente, preservando zeros à esquerda. Exemplo fictício: `0482`.
7. QR físico pede somente o código. Não pede telefone, país, senha de conta, SMS ou confirmação de posse do número.
8. Link enviado no WhatsApp já contém identificação do território e código e abre diretamente após validação no servidor. Não exige redigitar nem confirmar o código.
9. Encaminhar a mensagem permite compartilhar o trabalho. Quem possui o código vigente tem acesso às mesmas ações daquele território; o sistema não afirma verificar a identidade de quem o utilizou.
10. WhatsApp do contato em um único campo: DDI + DDD + número, com ou sem o nono dígito brasileiro. Retirar o seletor BR/PY/AR/Outro da designação.
11. A geração da mensagem permanece no fluxo existente de abrir/copiar/compartilhar WhatsApp. Não criar envio automático por API nem afirmar que a mensagem foi entregue.

## 3. Base local confirmada e pontos de integração

| Arquivo/área | Situação observada | Trabalho previsto |
| --- | --- | --- |
| `src/designacoes/DesignacaoWhatsApp.jsx` | Campo de país, formatação nacional durante digitação e envio de `pais`; cadastro, compartilhamento e edição de contatos | Campo internacional único; código escrito na mensagem e ações de acesso |
| `shared/designacoes.js` | `normalizarTelefone` usa `libphonenumber-js/max`; `comporMensagem` monta lista e link | Normalização compartilhada com equivalência brasileira e mensagem com código |
| `workers/designacoes/src/service.js` | Contato E.164 com índice único; credencial cifrada para reenvio; transações e vínculo por designação | Reserva/ciclo do PIN, cartão estável, emissão de sessão e compatibilidade |
| `workers/designacoes/src/crypto.js` | Token aleatório de 12 bytes, representado em 16 caracteres; hash e AES-GCM | Manter credenciais fortes internamente; adicionar PIN sem apenas encurtar o token |
| `workers/designacoes/src/index.js` | Todas as rotas exigem Bearer antes do despacho; limitadores existentes | Entrada de cartão anterior ao requisito de Bearer e proteção específica contra tentativas |
| `src/App.jsx` | `HashRouter`; detecção do modo público aceita somente `#/t/` | Incluir as novas rotas públicas sem cair no login/painel |
| `src/designacoes/TerritorioPublico.jsx` | Lista, mapa, progresso, navegação e devolução | Reutilizar tela e adicionar observação em cada item |
| `src/designacoes/MapaTerritorioPublico.jsx` | Leaflet, OpenStreetMap e enquadramento por coordenadas | Compartilhar cálculo geográfico; criar composição própria para impressão |
| `src/designacoes/idiomaPublico.js` e `useIdiomaPublico.js` | Interface pública em português, inglês e espanhol | Traduzir entrada, erros e legendas novas; preservar endereço original |
| `src/relatorios/utils/relatorioPdfExport.js` | Exportação com jsPDF/AutoTable | Reutilizar padrões, sem modificar os relatórios existentes para virar cartão |
| `src/pdfExport.js` | Download web e exportação/compartilhamento Capacitor | Reutilizar e generalizar texto/pasta somente se necessário, sem regressão nos relatórios |
| `src/Mapa.jsx`, `src/enderecoModel.js` | Territórios, permissões administrativas e campos `informacao`/`observacao` | Entrada administrativa para gerar cartão e projeção explícita das observações |
| `src/shareLinks.js`, `src/publicAppUrl.js` | Construção de URL pública e `wa.me` | Centralizar URLs novas, sem duplicar DDI ou publicar PIN no QR |

Rever os hunks atuais antes da implementação: o checkout contém extensa evolução concorrente, inclusive arquivos não rastreados. Não usar reset, limpeza, stash indiscriminado ou substituição de arquivos inteiros para começar esta etapa.

## 4. Experiência do cartão e geração do PDF

### 4.1 Composição revisada em 22/10/2026

- Cabeçalho: código/nome do território, idioma, cidade e “Bairro: nome”, nessa ordem, em linhas separadas, sem dados do responsável atual. Cidade identificada nos endereços; quando ausente, usar a cidade padrão configurada no sistema. Cidades distintas identificadas são preservadas na mesma linha, com quebra conforme necessário.
- Área do mapa: 87 × 50,75 mm, abaixo do cabeçalho. Ruas legíveis e pontos com os mesmos códigos da lista.
- Lista: código destacado, endereço completo e quebra natural de linha. Não cortar texto, substituir endereço por reticências ou omitir itens para caber.
- Rodapé: somente créditos cartográficos e data de geração, alinhados à direita, em 5 pt ou menos caso necessário. Sem instruções ou campo de código de acesso.
- Margens de 3 mm; fonte da lista inicialmente de 10 pt. Se o conjunto não couber, reduzir uniformemente a fonte de todos os endereços até caber na página, sem omissões.
- QR preto sobre branco, sem logotipo, com zona livre de quatro módulos e 20 mm no canto superior direito, ao lado do título e fora do mapa. Leitura impressa permanece pendente de teste físico.

O mapa é imagem estática de alta resolução; lista e QR devem preferencialmente permanecer vetoriais. Como referência de rasterização, 300 ppi para a página inteira equivalem aproximadamente a 1098 × 1713 pixels; o PDF conserva a página física exata independentemente desses pixels.

Gerar sempre uma página de 93 × 145 mm. Seis endereços de duas linhas são o cenário de referência em 10 pt. Listas maiores ou textos extensos recebem redução uniforme; em casos extremos, a fonte pode ficar pequena para impressão. Não gerar continuação nem implementar imposição gráfica/A4.

### 4.2 Fluxo administrativo

1. Abrir território, abrir os três pontos e escolher “Gerar cartão PDF”, disponível ao administrador já autorizado a consultar seus endereços.
2. Resolver os endereços ativos do território, com ordem estável e igual entre lista e marcadores; informar itens arquivados excluídos.
3. Criar/obter o identificador permanente do cartão em operação administrativa idempotente. Gerar cartão não designa, não renova código e não altera marcações.
4. Enquadrar os pontos para a proporção real de impressão. Avisar sobre localização ausente e impedir mapa incompleto apresentado como válido.
5. Mostrar prévia de uma página e permitir baixar/compartilhar o PDF no caminho já suportado pela plataforma.

Se o território estiver designado, usar a mesma composição de endereços vigente validada pelo servidor. Se estiver livre, usar a composição atual. Não modificar a composição de uma designação ativa para ajustar o PDF.

Gerar o PDF localmente sob ação do administrador; não publicar arquivos com endereços em bucket/URL pública, nem persistir PDFs em produção como parte obrigatória desta entrega. Nome sugerido: `territorio-T-12-cartao-2026-10-22.pdf`.

O papel mostra endereços a quem o possui e não pode ser revogado digitalmente. Trocar responsável não exige reimpressão; mudar endereços exige atualizar o cartão. O QR sempre resolve o território atual, enquanto os textos e o mapa impressos são um retrato da geração.

### 4.3 Mapa estático: implementação e dependência a resolver

**Atualização de 22/10:** após autorização do usuário, foi escolhido OSM por captura manual do viewport visível, detalhado na seção 15. O texto abaixo registra os cuidados do planejamento original.

Separar um adaptador de mapa estático do layout PDF, com entrada de coordenadas, dimensões, estilo, códigos e créditos, e saída de imagem validada. Reutilizar Leaflet/cálculo de limites quando útil; não capturar a tela inteira do celular ou o painel com controles.

O projeto usa `tile.openstreetmap.org` para navegação interativa. Isso não é autorização genérica para obter tiles em segundo plano para PDFs: a política proíbe pré-busca/download em massa e não oferece garantia de disponibilidade. Antes de escolher a fonte definitiva, confirmar expressamente permissão para imagem estática, impressão, cache e volume esperado. Não implementar lote de 100 territórios contra o servidor comunitário, nem usar bots que percorrem mapas para forçar carregamento.

Decisão técnica pendente para a implementação: escolher uma fonte que permita o uso pretendido (captura de viewport efetivamente exibido, se os termos aplicáveis permitirem, ou fornecedor específico de mapas estáticos). Documentar termos e eventual custo antes de ativar dependência paga. Não contratar serviço nem presumir chave disponível. A interface e o PDF podem ser desenvolvidos/testados com uma imagem cartográfica de teste; isso não constitui aceite da integração real.

No adaptador final, resolver carregamento, timeout, CORS e falha parcial. Nunca baixar PDF com mapa em branco alegando sucesso. Manter atribuição legível e não enviar observações, telefones ou PIN ao fornecedor do mapa. A leitura de coordenadas por fornecedor externo deve ficar documentada.

## 5. QR permanente e link com código

Formatos propostos, com identificador fictício `k7m2p9x4`:

```text
QR físico:       https://territ-es-sbs.web.app/#/c/k7m2p9x4
Link WhatsApp:   https://territ-es-sbs.web.app/#/c/k7m2p9x4/0482
Revisar/devolver:https://territ-es-sbs.web.app/#/c/k7m2p9x4/0482/fechar
```

O identificador público representa permanentemente um território dentro da instância; não é a senha. Preferir um identificador opaco curto, aleatório e estável, reservado de forma atômica, em vez do código de exibição `T-12`, que pode mudar ou se repetir em outro contexto. O namespace precisa distinguir instância/idioma quando houver backend compartilhado.

O campo visível no QR mostra “Território T-12” e “Código de acesso”, com teclado numérico, colagem e quatro posições acessíveis. Tratar o código como string de quatro caracteres ASCII (`^\d{4}$`), nunca como inteiro. Não converter `0482` em `482`.

O link com código chama a mesma validação automaticamente ao abrir, sem etapa extra. Falha mantém o formulário disponível. Abrir link, obter prévia no WhatsApp ou abrir `/fechar` não marca endereços nem devolve o território.

QR sem sessão válida pede código; uma sessão já válida para aquele território pode abrir diretamente para evitar repetição. O QR sozinho nunca cria permissão.

Após validar, o navegador usa credencial aleatória forte de sessão vinculada à designação e à versão do acesso. Remover o PIN da barra de endereço com substituição do histórico depois da troca, sem alterar a mensagem original compartilhável. A sessão pode ser mantida em `sessionStorage`, separada por cartão/instância, para sobreviver à ida ao Maps; não usar credencial permanente ou guardar respostas de endereços no cache da PWA.

O PIN é curto por decisão de usabilidade; a sessão forte não aumenta sua resistência a adivinhação no ponto de entrada. O código não verifica identidade ou propriedade do celular. Não reintroduzir telefone, OTP, conta ou CAPTCHA obrigatório como etapa normal.

### 5.1 Estados e mensagens

| Estado | Resposta esperada |
| --- | --- |
| QR conhecido, sem sessão | Identificação mínima do território e campo de código; sem mapa, endereço ou observação |
| Território livre | “Peça ao dirigente para designar este território para você.” |
| Código correto da designação ativa | Abre a tela atual, com navegação, observações, progresso e devolução |
| Código errado, antigo, revogado ou de outro território | “Código inválido ou encerrado. Confira a mensagem recebida do dirigente.” |
| Muitas tentativas | Espera temporária clara, sem revelar dados nem bloquear permanentemente o território |
| Cartão inexistente, arquivado ou indisponível | Orientação neutra para procurar o dirigente; não mostrar cadastro interno |
| Sem internet | Informa que precisa de conexão para validar/salvar; não apresenta sucesso local |

Sem telefone/identidade, não afirmar “este território está designado para outra pessoa” em resposta a um PIN errado: quem tenta pode ser o próprio responsável digitando errado. Não mostrar nome ou telefone do responsável.

## 6. Código de quatro dígitos: ciclo, unicidade e servidor

### 6.1 Regras do ciclo

| Operação | Código | Sessões/acessos anteriores |
| --- | --- | --- |
| Nova designação | Novo | Não herdar de designação anterior |
| Reenviar mensagem | Mesmo | Continuam válidos dentro do prazo |
| Prorrogar prazo ativo | Mesmo | Seguem a designação vigente |
| Renovar acesso | Novo | Invalidar os anteriores na mesma operação |
| Devolver, concluir ou revogar | Encerrado | Bloquear consulta operacional e escrita |
| Expirar | Encerrado a partir de `expiraEm` | Bloquear mesmo antes de o cron reconciliar |
| Redesignar/reabrir | Novo | Nunca reativar acesso anterior |

Não repetir o mesmo PIN em duas designações simultaneamente válidas da mesma instância. Não reutilizar um PIN já usado naquele território, inclusive após renovação: mensagens antigas não podem voltar a funcionar. Reuso em outro território só pode ocorrer quando o código anterior não autorizar mais nenhuma operação. Dígitos repetidos dentro do PIN são permitidos.

Gerar com fonte criptográfica, distribuição uniforme e zeros à esquerda; não usar sequência, telefone, data, código do território ou `Math.random`. Reservar PIN ativo, histórico de uso, versão do acesso e designação na mesma transação; não confiar em consulta seguida de gravação ou em unicidade no frontend. Tratar colisão e concorrência com retry limitado e erro acionável, sem loop infinito.

Há 10 mil valores possíveis, não um limite de 100 territórios imposto no código. Se um território esgotar seu histórico ou não houver candidato disponível, informar impossibilidade de gerar e preservar o estado anterior. Não reutilizar código antigo ou aumentar o número de dígitos silenciosamente.

### 6.2 Modelo proposto, a ajustar ao menor delta compatível

- `cartoes_territorios/{cartaoId}`: referência privada a `grupoId`/instância e metadados de criação; vínculo único e permanente. Somente a projeção mínima é pública pela API. Reservar também o vínculo inverso para não criar dois cartões concorrentes para um grupo.
- `designacoes_links/{id}` existente: acrescentar modo de acesso (`token16` legado ou `codigo4`), cartão, versão de acesso e código cifrado para reenvio. Não colocar código em `grupos_enderecos`, `enderecos` ou dados públicos administrativos amplos.
- Índice privado de códigos ativos, por instância: reserva única apontando designação/cartão/versão. Liberar na transação de encerramento/renovação, sem apagar histórico de códigos daquele território. Reconciliar reserva expirada de forma idempotente; TTL não decide validade.
- Histórico privado de uso por território: impede reuso mesmo depois de liberar a reserva ativa.
- Índice de sessões: credencial forte, hash/assinatura verificada e vínculo a designação/versão, com vencimento próprio no máximo igual ao prazo da designação. Não é necessário apagar cada sessão para revogar: a versão e o estado vigente precisam ser conferidos em cada requisição.

O PIN tem baixa entropia: SHA-256 simples não protege suas 10 mil possibilidades em caso de acesso ao índice. Usar HMAC com segredo do servidor para as impressões de reserva/verificação e cifragem autenticada para reenvio. Definir namespace e versionamento de chave. A rotação deve conservar a verificação de histórico e a unicidade entre versões; não regenerar fingerprints históricos cegamente ou tornar códigos antigos reutilizáveis. Nunca logar PIN, URL completa com PIN, telefone completo ou token de sessão.

Todas as coleções novas permanecem privadas nas Rules; somente API com projeção/autorizações próprias. Não abrir leitura de `enderecos` para o formulário público. A conta de serviço do Worker exige testes de autorização próprios, pois IAM pode ultrapassar as Rules.

### 6.3 Rotas e limites

Contratos sugeridos:

- Operação administrativa idempotente para obter/criar cartão e dados de exportação, reaproveitando a autenticação Firebase e a autorização de administrador existente.
- `POST /public/cartao`: recebe cartão e retorna somente identificação mínima/situação permitida. Não recebe PIN nem retorna lista/designação/contato.
- `POST /public/acessar-cartao`: recebe `{ cartaoId, codigo }`; aplica limites e valida território/designação/prazo/versão no servidor antes de emitir sessão. O PIN vai no corpo, não na URL da API.
- Rotas operacionais atuais (`territorio`, `endereco`, `marcacoes`, `devolver`, `concluir`) passam a reconhecer a sessão forte e preservar o fluxo legado.

Em `index.js`, tratar as duas entradas públicas antes da exigência geral de Bearer; não remover autenticação das rotas administrativas ou operacionais. Erros e corpos precisam de validação/limite de tamanho. Validação, emissão de sessão e concorrência com renovação/devolução devem impedir sessão utilizável com acesso revogado; cada ação também revalida o vínculo.

Os limites existentes (300 requisições/minuto e 60 escritas/minuto na configuração local de produção) não são uma política suficiente para testar PINs de quatro dígitos. Criar limite específico para entrada, sem aplicar contagem por PIN tentado, pois mudar o PIN contornaria o bloqueio.

Proposta inicial: cinco falhas por janela de um minuto por cartão e origem de rede, com espera progressiva em reincidência e limite de rajada geral. Para agregar tentativas distribuídas contra um cartão, definir orçamento adicional e espera temporária, sem bloqueio definitivo e sem deixar um atacante revogar o acesso de quem já entrou. Considerar redes compartilhadas e manter ações com sessão separadas da entrada.

Os bindings de rate limit do Workers são aproximados e locais a cada localidade Cloudflare. Não apresentar esse mecanismo como teto global estrito. Se o projeto exigir um orçamento global estrito para o PIN, implementá-lo no armazenamento transacional existente (somente nessa entrada, com retenção curta) ou em Durable Object, documentando o custo e os testes. Não introduzir um novo serviço sem necessidade demonstrada. Os limites reduzem tentativas; não tornam um PIN de quatro dígitos equivalente ao token atual.

Respostas operacionais e de troca de código seguem `no-store`, sem cache de service worker; configurações de analytics, logs, erros e referrer não podem expor a credencial.

## 7. Transição dos links atuais

Não interromper automaticamente designações existentes nem migrar registros reais durante desenvolvimento. Manter `#/t/:token` e os acessos de 16 caracteres funcionando até seu encerramento, prazo ou renovação explícita.

Novas designações após ativação do recurso usam código de quatro dígitos. Para uma designação antiga, oferecer uma ação administrativa explícita de ativar/renovar para o novo acesso, com prévia de que a mensagem anterior deixará de funcionar. Gerar PDF ou consultar um contato não executa essa conversão. Depois da conversão, reenviar devolve o mesmo PIN/link novo.

Cartão de designação ainda legada pode pedir que o publicador use a mensagem atual ou solicite o código ao dirigente, sem mostrar lista sem autorização. Na interface administrativa, explicar que é necessário ativar o novo acesso antes de compartilhar um código para o QR.

Revalidar compatibilidade com frontend/PWA antigos e preparar ordem de publicação futura: backend retrocompatível, frontend novo e ativação controlada. Não publicar nesta etapa. Documentar rollback sem restaurar credenciais revogadas ou códigos já usados.

## 8. WhatsApp: um campo, DDI e nono dígito

### 8.1 Experiência de entrada

Campo único `type="tel"`, rótulo “WhatsApp”, exemplo `+55 47 99999-1234` e ajuda curta “Cole o número completo com DDI e DDD. Aceitamos celular brasileiro com ou sem o 9.” Sem dropdown, bandeira, escolha de país ou opção “Outro”.

Permitir colar com `+`, espaços comuns/inseparáveis, parênteses e hífens. Não aplicar a máscara nacional atual durante cada tecla: ela pode truncar/reinterpretar o DDI. Preservar a entrada enquanto a pessoa digita; normalizar no blur/validação e novamente no servidor, com mensagem clara caso inválida. Uma prévia discreta do número reconhecido pode aparecer, sem uma nova etapa obrigatória.

O parser determina DDI a partir do número internacional, sem supor que todo DDI tem dois dígitos. Não prefixar `55` a algo que já tenha DDI. Aceitar `55` sem `+` quando o tamanho total brasileiro for inequívoco; outros países devem usar `+DDI` para evitar adivinhação. Para compatibilidade de clientes/contatos antigos, entradas nacionais com DDD podem continuar usando Brasil como padrão interno; o caminho principal documentado e mostrado na UI é o número internacional completo.

Retirar `pais` do formulário/payload novo. Enquanto clientes antigos existirem, o backend pode aceitar o campo legado como fallback apenas para números sem DDI explícito; nunca sobrescrever um `+DDI` válido. Não alterar globalmente todos os campos de telefone do projeto por causa desta solicitação.

### 8.2 Equivalência brasileira

A exigência é aceitar as duas representações copiadas/recebidas, sem pressupor que o WhatsApp sempre retire o nono dígito. A Anatel define os celulares atuais com nove dígitos e primeiro dígito 9; o sistema deve reconhecer a representação reduzida sem transformar qualquer telefone de oito dígitos em celular.

Regras propostas, usando `libphonenumber-js/max` e uma função compartilhada:

1. Interpretar DDI, validar DDD e separar assinante. Limpeza aceita somente formatação conhecida; não extrair silenciosamente um número de texto arbitrário nem descartar letras/ramal para torná-lo válido.
2. Para Brasil, assinante de nove dígitos: validar como está, sem adicionar outro 9.
3. Para Brasil, assinante de oito dígitos compatível com faixa móvel reduzida (inicial 6–9): construir o candidato com 9 à esquerda e aceitar somente se DDD e candidato forem válidos como móvel nos metadados atuais. Decidir pelo comprimento e pelo plano de numeração, não só por `startsWith('9')`.
4. Se o número de oito dígitos for fixo válido (por exemplo, faixa 2–5), preservá-lo; não acrescentar 9. Um número sintaticamente válido não prova que tem conta WhatsApp. Não adicionar consulta externa automática.
5. Fora do Brasil, aplicar o plano internacional correspondente, sem inserir/remover dígitos brasileiros.
6. Persistir a identidade telefônica canônica em E.164. Para o mesmo móvel brasileiro, com/sem nono dígito devem produzir a mesma chave de busca/unicidade.

Exemplos fictícios de contrato:

| Entrada | Identidade canônica esperada |
| --- | --- |
| `+55 (47) 99999-1234` | `+5547999991234` |
| `+55 47 9999-1234` | `+5547999991234` |
| `554799991234` | `+5547999991234` |
| `+55 47 98888-1234` | `+5547988881234` |
| `+55 47 8888-1234` | `+5547988881234` |
| `+55 47 3222-1234` | `+554732221234`, sem inventar nono dígito |
| `+44 7911 123456` | `+447911123456`, sem alterar o assinante |
| DDD inexistente, número incompleto, letras ou ramal | Erro claro; não persistir |

Os exemplos devem ser conferidos com a versão instalada dos metadados antes de se tornarem fixtures; não são contatos para envio real.

### 8.3 Contatos existentes e links de envio

Busca, seleção, criação e edição precisam usar a mesma equivalência, tanto no frontend quanto no Worker. Adaptar o cadastro inline e a edição de contatos do fluxo de designações; não limitar a correção à máscara visual.

O contato mantém seu ID permanente, nome, vínculos e histórico. Consultar a chave canônica e eventuais aliases legados dentro da transação. Se os dois formatos já estiverem associados a contatos diferentes, retornar conflito para revisão administrativa, sem fundir pessoas/histórico automaticamente. Não migrar nem reescrever toda a base real para aceitar novas entradas; atualizar o contato selecionado somente em ação explícita e auditada.

`buildWhatsAppShareUrl` precisa receber um destino internacional coerente e retirar apenas o `+`/formatação para `wa.me`; não retirar o 9 arbitrariamente e não duplicar DDI. O telefone canônico define equivalência de cadastro; a abertura no WhatsApp é evidência externa distinta. Se o provedor exigir preservar a representação originalmente copiada para entrega, manter destino de envio separado e validado do telefone canônico, sem criar outra identidade de contato e sem escolher/remeter para variantes automaticamente.

Aceitar/normalizar um número pode ser provado em testes locais; entrega/abertura correta no WhatsApp com variantes depende de piloto real autorizado. Não alegar que parsing valida a existência da conta.

## 9. Observações na tela digital

Hoje a projeção dos endereços da designação contém `id`, `codigo`, `endereco` e `mapsUrl`, sem observações. Ampliar a projeção com um campo textual explícito e limitado, reaproveitando `informacao` e o fallback legado `observacao`. Não devolver documentos inteiros ou duplicar os dois campos na interface.

Mostrar o texto completo abaixo do endereço, com quebra de linha e rótulo “Observações”, somente quando houver conteúdo. Renderizar como texto, nunca como HTML. Preservar acentos, valores originais e leitura acessível; não traduzir automaticamente observações.

Política proposta: observações exibidas são as atuais dos endereços ainda vinculados, consultadas na leitura autorizada, sem mudar a composição/endereço congelados da designação. A validação já lê os documentos relacionados; aproveitar essa leitura com projeção mínima, sem um endpoint público genérico. Correção administrativa de observação não precisa renovar código ou reimprimir cartão. Não modificar snapshots/auditoria históricos ao atualizar o texto mostrado.

As observações ficam disponíveis a quem tiver o acesso válido, inclusive por mensagem encaminhada, conforme o modelo escolhido. Nunca enviá-las no bootstrap do QR, na URL ou para o fornecedor do mapa.

## 10. Sequência de implementação proposta

1. **Base e contratos:** ler instruções/hunks/planos, confirmar estado local, definir contratos/testes de telefone, PIN, cartão, projeção e transição. Não recriar o fluxo de designação existente.
2. **Campo WhatsApp:** normalização compartilhada, equivalência/índices privados, cadastro e edição em campo único, regressões para contatos atuais e países internacionais.
3. **Backend do cartão/PIN:** identificador estável, reserva atômica, histórico de uso, cifragem, troca por sessão, limites, invalidação e modo legado. Atualizar Rules/índices locais somente se necessário.
4. **Entradas e mensagem:** rotas `#/c/`, abertura automática, formulário numérico acessível, i18n, texto WhatsApp com código e compartilhamento dos dois links; reusar a tela pública atual.
5. **Observações:** projeção autorizada e exibição por endereço, sem vazamento no bootstrap.
6. **PDF:** protótipo com casos curtos/longos, fonte cartográfica definida e termos registrados, imagem estática, QR permanente, paginação e exportação. Fixture não substitui teste do fornecedor real.
7. **Integração local:** executar matriz abaixo, registrar resultados e pendências de piloto, preparar diff e orientação de publicação separada.

As etapas são dependências de trabalho, não autorização para entregar uma fração como se todo o pedido estivesse pronto. Se houver bloqueio externo real, continuar as partes independentes e registrar claramente o que falta.

## 11. Matriz de aceite e evidências

### Telefone/contato

- Colar `+55`, espaços, parênteses e hífens sem perder DDI/DDD; colagem com espaço inseparável.
- Móvel com/sem 9 resulta no mesmo contato, inclusive quando o assinante reduzido já começa com 9.
- Não duplicar 55 nem tratar DDD 55 como DDI por corte ingênuo.
- Preservar fixo válido e internacional; rejeitar DDD inválido, número curto, texto arbitrário e ramal.
- Busca, criação, edição e concorrência de duas entradas equivalentes preservam unicidade e ID.
- Conflito legado não funde nem transfere histórico. UI não contém seletor de país.

### Código, QR, link e autorização

- `0000`/zeros à esquerda aceitos como formato; códigos não numéricos ou com tamanho errado rejeitados.
- QR sem credencial não revela endereços/observações; código de outro território não abre.
- Link WhatsApp válido abre diretamente, também quando encaminhado; QR pede somente código.
- Reenvio e prorrogação mantêm código; renovar troca e invalida sessões anteriores.
- Concorrência entre gerar, renovar, devolver, expirar e entrar não permite acesso antigo.
- Não repetir PIN ativo globalmente na instância nem PIN histórico no mesmo território; testar colisão e esgotamento sem loop.
- Expiração bloqueia pelo relógio do servidor, sem depender do cron ou TTL.
- Limites contam tentativas com códigos diferentes, não bloqueiam permanentemente o território e não impedem indevidamente ações de sessão já válida.
- Token legado e designação por e-mail continuam funcionando; conversão exige ação administrativa explícita.
- Autorizações testadas diretamente no Worker e nas Rules, incluindo administrador não autorizado, cartão de outra instância e endereço fora da designação.
- Não há vazamento de PIN/token em logs, analytics, referrer, cache PWA ou URLs da API.
- Entrada pública/i18n PT/EN/ES, teclado numérico, foco, erros e retorno do Maps funcionam sem resetar progresso.

### Observações, mapa e PDF

- Observação nova/legada/vazia, texto longo, quebras de linha e texto com caracteres HTML aparecem corretamente, sem execução.
- PDF realmente mede 93 × 145 mm; acentos e endereços completos ficam legíveis, com texto extraível quando aplicável.
- Casos de 1, 4, muitos endereços e endereço longo: nenhuma linha cortada/omitida, paginação identificada.
- Mesmo código/ordem entre ponto e lista; pontos próximos, extremos do enquadramento e localização ausente tratados.
- Fonte do mapa e créditos conferidos; falha de carregamento não produz sucesso com área vazia.
- Decodificar o QR do PDF gerado: contém somente URL permanente do cartão, sem PIN ou token, e não muda ao redesignar.
- Gerar PDF não cria designação, não renova acesso e não altera progresso.
- Testar download web; verificar integração de exportação nativa sem afirmar aceite Android físico.

### Execução e limites da evidência

Usar os comandos reais do `package.json`, conforme impacto: testes unitários direcionados e suíte, `designacoes:test` em emuladores demo, matriz de Rules se afetada, smoke antigo/novo, lint e build. Preservar emuladores/portas que já estejam em uso; nunca conectar o teste à base real. Renderizar e inspecionar ao menos um PDF curto e um paginado, conferindo dimensões, créditos e QR.

Se a primeira tentativa de navegador falhar, interromper essa validação e pedir ajuda ao usuário, conforme instrução explícita do projeto. Não repetir login, trocar navegador ou redimensionar para contornar. Continuar apenas trabalho independente.

Separar resultados automatizados, navegador local, mapa de fornecedor real, leitura de QR impresso, WhatsApp real, Android/WebView e produção. Medidas no PDF não provam impressão em escala correta; orientar imprimir em tamanho real/100%. Nenhuma dessas aceitações foi realizada na elaboração deste plano.

## 12. Escopo da autorização e acompanhamento

Esta conversa autoriza a criação deste plano e do prompt de implementação. Não autoriza alterações funcionais, dependência paga, migração, dados reais, envio de mensagem, publicação, commit ou push.

O prompt de continuidade solicita implementação e validação locais. Produção requer autorização própria, com prévia do que será publicado e dos efeitos sobre links existentes. Não criar automação do Codex: o prazo e o cron pertencem ao sistema existente.

Na futura implementação, acrescentar aqui um diário curto de etapas, arquivos, comandos executados, resultados, pendências e decisões sobre fonte cartográfica/política de limites. Não substituir este estado de planejamento por afirmação de funcionalidade antes da execução.

## 13. Referências oficiais consultadas em 22/10/2026

- [Anatel — Nono dígito](https://www.gov.br/anatel/pt-br/regulado/numeracao/codigos-nacionais/nono-digito): formato atual de celular brasileiro; a aceitação da variante reduzida é uma regra de compatibilidade deste produto.
- [libphonenumber-js — documentação do projeto](https://github.com/catamphetamine/libphonenumber-js): parsing internacional, metadados completos, validação e opção de não extrair números de texto arbitrário.
- [Cloudflare Workers — Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/): bindings aproximados/locais, chaves e limites estritos.
- [OpenStreetMap — Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/): condições do servidor comunitário, atribuição, cache e restrições de pré-busca/download.
- [OpenStreetMap — Attribution Guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines): créditos em imagens estáticas e mapas impressos.
- [OWASP — Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html): limites de tentativas e tratamento de erros. O PIN compartilhável deste plano não pretende verificar a identidade de uma pessoa.

## 14. Progresso da conversa de planejamento

- Criados este documento e o prompt específico de continuidade.
- Conferidos arquivos locais do fluxo atual, histórico documental e fontes oficiais acima.
- Conferidos links locais, delimitadores Markdown e ausência de espaços finais nos dois documentos. Consulta somente de leitura à biblioteca instalada confirmou os dois exemplos canônicos de móvel brasileiro, o fixo e o internacional da tabela; isso não testa ainda a futura normalização da entrada sem 9.
- Nenhum arquivo funcional alterado; nenhum teste funcional, navegador, PDF de exemplo, envio ou deploy executado como parte desta elaboração.


## 15. Implementação local — 22/10/2026

Autorização posterior: executar o prompt e implementar/validar localmente, preservando todos os hunks e arquivos não rastreados. A instrução do navegador foi respeitada. Não houve deploy, escrita/migração em base real, mensagem, contratação, commit ou push. Não foram usados subagentes ou automações do Codex. O histórico de publicação anterior não foi tratado como evidência remota atual.

### Alterações e decisões

- **WhatsApp:** `shared/designacoes.js` faz parsing estrito e compartilhado, aceita formatação/colagem, reconhece o móvel BR reduzido inclusive iniciado por 9, mantém fixos e países internacionais. Sem `+`, somente o DDI brasileiro inequívoco é inferido; números nacionais mantêm o fallback BR e o `pais` de clientes antigos é aceito como compatibilidade. Números internacionais explícitos nunca são sobrescritos pelo país legado. Cadastro/edição/busca implicados no fluxo usam campo único; contas/login existentes preservam seu contrato. Parsing não verifica existência de conta WhatsApp.
- **Contatos:** identidade E.164, ID/histórico estáveis e reserva dos índices canônico e reduzido na mesma transação. Edição lê também aliases anteriores; conflito entre IDs não funde nem transfere histórico. A leitura dos aliases é sequencial dentro da transação. Não houve backfill.
- **Cartão:** `/admin/cartao` autoriza administrador atual e cria/obtém ID opaco de 16 caracteres com vínculo inverso transacional. Código de exibição não é chave. Geração não designa nem renova. Exportação usa composição/snapshot da designação ativa e coordenadas vinculadas; territórios livres usam a composição atual. Arquivados excluídos são contabilizados. Projeção de exportação não inclui observações/contato/PIN.
- **PIN:** quatro caracteres ASCII, inclusive `0000`; AES-256-GCM com AAD da designação para reenvio. Índices/histórico usam HMAC-SHA-256 com segredo independente `PIN_HMAC_KEY` (32 bytes Base64URL sem padding), namespace do projeto e domínio `pin-v1`. Não há SHA simples do PIN. O marcador privado da chave impede rotação silenciosa: trocar o HMAC exige futura migração explícita que preserve histórico/unicidade. As versões AES existentes continuam disponíveis para decifrar acessos antigos.
- **Reserva:** permutação aleatória uniforme com rejection sampling/Fisher-Yates; até 10 mil candidatos distintos e no máximo 128 reservas não históricas consultadas por transação. Histórico esgotado ou reserva indisponível retorna conflito acionável sem alterar o acesso anterior. O histórico fica por território; reservas ativas ficam por fingerprint global da instância. A liberação é lógica ao mudar estado/versão/prazo da designação; a reserva vencida/revogada pode ser reaproveitada por outro território na própria transação de nova emissão. Não se apaga o histórico nem se depende de TTL/cron para autorizar.
- **Sessão:** PIN no corpo de `POST /public/acessar-cartao`; sessão aleatória de 192 bits, limitada à designação/versão e a 12 horas ou ao prazo, o que chegar antes. Reenvio/prorrogação mantêm PIN; renovação troca; encerramento/revogação/expiração bloqueiam PIN e sessões. Toda ação revalida estado, versão, prazo, composição e pertencimento. Tokens legados mantêm o comprovante terminal mínimo; sessões novas encerradas não autorizam novas requisições.
- **Entradas:** `#/c/:cartaoId`, link com PIN e `/fechar` reaproveitam a tela pública. O link com PIN troca automaticamente por sessão e remove a credencial da barra/histórico antes de I/O. QR pede somente código; nenhuma conta, telefone, OTP, CAPTCHA ou confirmação extra. Sessão em `sessionStorage` por origem/cartão; API usa `no-store`, sem cache PWA. A mensagem inclui o código escrito e o link compartilhável, sem envio automático.
- **Legado/ativação:** `CODIGOS_ENABLED=true` no local. A configuração preparada de produção tem `false`, sem alteração remota. Com `false`, criação/renovação legada continuam emitindo token16; acessos codigo4 já existentes continuam válidos e renováveis. Após futura ativação, novas designações e renovação explícita de legado usam PIN. Gerar cartão não converte uma designação. Isso permite preparar backend retrocompatível, atualizar frontend/PWA e só depois ativar novas emissões. Não reativar PIN histórico ou sessão revogada em rollback.
- **Limites:** bindings específicos de 5 tentativas/cartão+IP/minuto, 20/IP/minuto e 30/cartão/minuto; entrada e operações de sessão são separadas. Contam tentativas inclusive corretas, sem chavear pelo PIN digitado; bootstrap não consome esses limites. São limites aproximados por localidade Cloudflare, não teto global estrito. A espera implementada é de uma janela; escalada progressiva e orçamento global transacional estrito ficam fora desta primeira política e exigem avaliação do piloto. Não há bloqueio persistente do território nem revogação por tentativa errada.
- **Concorrência:** quatro tentativas REST, jitter em RNG separado do PIN e espera exponencial; `ABORTED` esgotado retorna 409 claro. As provas incluem criação concorrente, colisão deliberada de PIN, renovação/entrada, duas renovações, revogação/entrada, aliases de telefone e expiração antes do cron.
- **Observações:** projeção textual mínima atual de `informacao`, com fallback `observacao`, limitada a 20 mil caracteres e validada pelo vínculo. Renderização como texto com quebras de linha, nunca HTML. Não altera snapshot/histórico; não entra em QR, PDF, bootstrap ou fornecedor do mapa. PT/EN/ES preservados.
- **Rules:** cartão, vínculo inverso, índice/histórico de PIN e controle da chave fechados para clientes, inclusive administradores. API mantém autorização própria, pois conta de serviço ultrapassa Rules. Nenhum índice composto novo foi necessário.

### PDF e ajuste solicitado durante a implementação

O usuário revisou os modelos e pediu QR/rodapé menores, código + endereço sem cidade/UF e permitiu ampliar o mapa para 35%. O layout final local é:

- Página exata **93 × 145 mm**, mapa **50,75 mm** de altura (35%), margem de 3 mm, lista a 10 pt e paginação sem redução automática de fonte.
- QR vetorial **23 mm**, preto/branco, quatro módulos de zona livre e nível M; contém somente URL permanente. A decodificação das páginas rasterizadas passou; câmera/papel ainda pendentes.
- Rodapé a 7 pt, com data/página e explicação do código. O cartão mostra `Código de acesso: ____` para anotação; o PIN vigente aparece escrito na mensagem. O PDF permanente não grava uma senha que ficaria antiga na próxima designação.
- `enderecoParaCartao` remove somente o segmento reconhecido de São Bento do Sul/SC (e sufixo postal associado) para impressão; preserva rua, número, complemento e bairro, inclusive ruas chamadas São Bento do Sul. Não altera cadastro, edição, snapshot ou consulta digital. Endereço de outro município não é reinterpretado silenciosamente.
- Prévia administrativa em diálogo próprio fora do popup Leaflet; download e compartilhamento reutilizam `pdfExport.js`, com pasta/texto opcionais e defaults dos relatórios preservados. PDF privado permanece local em Blob/arquivo, sem hospedagem pública.
- Caracteres que Helvetica/WinAnsi não representa são recusados com erro claro, em vez de imprimir texto corrompido. PT/EN/ES e acentos dos casos exercitados passaram; escrita fora desse conjunto exige fonte adequada antes de imprimir.

Arquivos principais: `src/designacoes/{CartaoTerritorio,MapaCartaoPreview,CartaoPublico}.jsx`, `cartaoPdf.js`, `cartaoMapa.js`, `cartaoMapaCaptura.js`, `cartaoMapaRotulos.js`, `enderecoCartao.js`; `shared/designacoes.js`; `workers/designacoes/src/{cartoes,errors,service,index,crypto,store}.js`; ajustes nos pontos existentes de `Mapa`, `App`, `AdminPanel`, `UsuariosTab`, tela pública/i18n, Rules e configurações do Worker. Dependências acrescentadas: `qrcode` e `jsqr` (verificação, dev).

### Fonte cartográfica escolhida após esclarecimento do usuário

O usuário não possui fornecedor e autorizou usar Leaflet/OpenStreetMap se o uso fosse permitido. A [FAQ oficial](https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ), seções 1.8.1/1.8.2, permite imagens e mapas impressos com atribuição. A [política dos tiles](https://operations.osmfoundation.org/policies/tiles/) permite visualização interativa normal do viewport humano, proíbe pré-busca/lote/bots e não oferece SLA. A licença do Leaflet não substitui esses termos.

Implementação escolhida: **uma captura manual do viewport já visível por cartão**, após abrir a prévia administrativa. `tile.openstreetmap.org` é acessado somente pelo TileLayer exibido, com `crossOrigin=anonymous`, `referrerPolicy=origin`, `keepBuffer=0` e sem pré-carregar níveis de zoom. Canvas compõe apenas imagens DOM já carregadas; não faz `fetch`, não muda zoom/enquadramento e não abre mapa oculto para exportar. Falha/timeout, tile ausente, área descoberta, mapa oculto/cortado, ponto fora do viewport ou CORS impedem gerar PDF. Créditos impressos: `© OpenStreetMap contributors - ODbL - openstreetmap.org/copyright`, também junto do mapa. As [diretrizes de atribuição](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) foram consultadas.

Volume pretendido: uso ocasional manual, um território por prévia; nenhuma fila/lote/100 territórios/varredura automática. Repetições aproveitam o cache HTTP normal do navegador, sem headers para ignorá-lo e sem cache próprio/offline de tiles. Para volume maior, geração em lote ou detalhe superior ao viewport, será necessária fonte própria/fornecedor apropriado. Nenhum custo contratado ou chave nova é necessário para este modo. O provedor vê as áreas/zoom consultados e a origem; não recebe endereços escritos, códigos locais, observações, telefone ou PIN. Rótulos são compostos no cliente.

A saída Canvas tem 1100 pixels de largura, mas ampliar o bitmap **não aumenta o detalhe original dos tiles**. É obrigatório conferir legibilidade na prévia e em impressão real a 100%; não se declara resolução cartográfica nativa de 300 ppi.

Verificação de protocolo independente do navegador: um único `HEAD https://tile.openstreetmap.org/0/0/0.png`, com User-Agent identificável e Referer de loopback, retornou **200**, `Content-Type: image/png`, `Access-Control-Allow-Origin: *` e `Cache-Control: max-age=91003, stale-while-revalidate=604800, stale-if-error=604800`. Não foi baixada imagem nem feita pré-busca. Isso confirma cabeçalhos daquele recurso, **não** a captura real/legibilidade no navegador ou disponibilidade geral do serviço.

### Comandos e evidências locais

- `npm.cmd run test:unit -- --reporter=dot`: **279 testes em 18 arquivos** aprovados na última rodada anterior à documentação; contratos de telefone/PIN, legado, limites de reserva, projeção, fonte PDF, captura sem rede, cobertura de tiles, pontos coincidentes e endereço impresso.
- `npm.cmd run worker:test`: **20 testes** do relay aprovados.
- `npm.cmd exec -- firebase emulators:exec --config .cartao-test.config.local --project demo-territorios-cartao-tests --only firestore,auth "node scripts/test-designacoes-local.mjs"`: matriz de Rules, smoke antigo, **102 verificações** de designações e **22** de cartão/PIN aprovadas. Configuração local ignorada usa 8385/9395, hub 4435 e logging 4535, preservando demonstrações. O smoke de cartão usa um projeto demo separado com sufixo `-cartao`.
- `npm.cmd run lint`, `npm.cmd run build`, `git diff --check`: conferências locais executadas; resultado final atualizado abaixo se houver novo ajuste. Teste negativo de rede imprime `Network error` esperado; negações de Rules são esperadas.
- `npm.cmd exec -- wrangler types --config workers/designacoes/wrangler.jsonc --path workers/designacoes/worker-configuration.d.ts`: tipos gerados com bindings e nomes dos secrets, sem valores.
- `npm.cmd exec -- wrangler deploy --dry-run --config workers/designacoes/wrangler.idiomas.jsonc --outdir .wrangler/cartao-validation`: somente empacotamento local aprovado, sem publicação. O bundle fica na pasta ignorada do Worker.
- `CARTAO_NODE_MODULES` apontando ao runtime de Node informado pelo Codex + `node scripts/validar-cartao-pdf.mjs`: PDFs sintéticos de **4 endereços/1 página** e **30 endereços/3 páginas**, incluindo endereço longo. Artefatos em `artifacts/cartao-pdf/`.
- Poppler `pdftoppm` a 200/150 dpi para rasterizar; `scripts/verificar-cartao-pdf.py` com pypdf confirmou dimensões, acentos, créditos e todos os textos esperados (sem cidade/UF). `node scripts/decodificar-cartao-qr.mjs` com `jsqr` decodificou o mesmo QR permanente sem PIN em todas as quatro páginas finais. PNGs foram inspecionados; rótulos próximos receberam posicionamento sem sobreposição e linhas aos pontos.

### Navegador e pendências reais

A demonstração isolada usa `demo-cartao-territorio` em Firestore/Auth 8285/9295, API 8789 e Vite 5186, via `scripts/dev-cartao-local.mjs`. O navegador abriu o QR, exibiu somente território/campo numérico e, após PIN fictício, mostrou dois endereços e a observação atual em inglês detectado. A captura de tela falhou; nenhuma nova tentativa, login, troca de navegador ou viewport foi feita. O usuário relatou que o conteúdo some ao rolar e considerou provável falha da visualização do navegador. Não há aceite visual completo nem diagnóstico fechado desse sintoma.

Continuam pendentes: captura **real** do viewport OSM/preview/download pelo navegador, abertura automática do link com PIN e `/fechar` em UI, revisão visual PT/ES/teclado e interação do mapa; câmera lendo QR impresso, legibilidade/escala física, WhatsApp real, Android/WebView e piloto. O fornecedor está definido para o modo manual, mas HEAD + testes sintéticos não completam sua aceitação externa. Não ampliar para lote com o servidor comunitário.

Antes de eventual publicação, sob autorização própria: provisionar `PIN_HMAC_KEY` sem trocar chaves/histórico existentes, conferir IAM/origens/limites, publicar Rules privadas e backend retrocompatível com novas emissões desativadas, atualizar frontend/PWA, executar piloto e só então habilitar `CODIGOS_ENABLED`. A configuração remota e as credenciais existentes não foram consultadas/alteradas nesta etapa.


Fechamento da rodada local: testes unitários (279), relay (20), Rules/smoke antigo, designações (102 verificações) e cartão/PIN (22 verificações) passaram; lint e build passaram após os ajustes de captura e layout. Não foi repetida a validação de navegador depois da falha. Os servidores que já existiam em 5185/8788/8185/9195 foram preservados; a demonstração criada nesta execução permaneceu separada em 5186/8789/8285/9295 para revisão manual. O helper novo verifica portas livres antes de preparar dados e usa namespace demo novo a cada execução.

Resumo estruturado da rodada: `artifacts/cartao-pdf/validation-summary.json`, com hashes dos dois PDFs finais e separação explícita das evidências pendentes.

## 16. Revisão dos apontamentos de bugs — 22/10/2026

Revisão solicitada pelo usuário antes de retomar a publicação autorizada. O checkout estava limpo no início desta revisão; foram preservados os commits e arquivos existentes, sem commit/push desta rodada.

1. **Comprovante com PIN:** confirmado o problema de experiência. A sessão já emitida pode ler somente seu comprovante após encerramento, até sua expiração original (máximo 12 horas). Não abre endereços/observações nem permite marcações; novo PIN permanece bloqueado. Reatribuição, renovação e revogação continuam invalidando a sessão. Isso ajusta a restrição anterior de encerrar toda consulta, sem restituir acesso operacional. Testes cobrem repetição da conclusão, devolução, expiração e reatribuição.
2. **Troca de território:** adicionadas chaves por grupo nas duas instâncias de `DesignacaoWhatsApp` e no cartão; o estado de sucesso, contato e PDF anterior não é reaproveitado em outro grupo.
3. **Secrets Google:** não estavam ausentes em produção: consulta dos nomes confirmou ambos, além de `TOKEN_KEYS_JSON`. Complementado `secrets.required` como prevenção de configuração incompleta. Valores não foram exibidos.
4. **PWA:** os dois guardas de registro/recarga em `main.jsx` agora reconhecem `/t/` e `/c/`.
5. **Telefone colado:** removidos somente caracteres Unicode de direção usados por agendas/WhatsApp antes da validação estrita; letras/ramais continuam rejeitados.
6. **Cartão vencido:** a exportação administrativa ignora somente o prazo da designação; preserva validações de vínculo, composição e endereços. Nenhuma operação pública foi liberada e nenhum prazo é alterado.
7. **Fonte:** adicionado GNU Unifont 15.0.06 TrueType, original sob SIL OFL 1.1 com licença e origem no repositório. Carregamento da própria origem somente quando necessário; incorporado ao PDF. Amostra confirma №, cirílico, chinês, japonês, coreano e formas árabes. Helvetica permanece nos cartões sem esses caracteres. Não se promete cobertura dos planos suplementares/emoji nem composição de todos os sistemas complexos; glifos ausentes seguem com erro explícito, sem omitir endereços. A fonte tem cerca de 12,5 MB antes da compressão e não entra no precache da PWA.
8. **Captura em tela pequena:** diálogo passa a reservar espaço flexível para mapa e controles; mapa preserva proporção e se ajusta à largura/altura disponíveis via container queries. Botão acima do mapa, sem sobrepor a área capturada. A proteção contra mapa oculto/incompleto permanece. Verificação visual no navegador ainda pendente devido à falha anterior.
9. **Subpixels:** cobertura aceita apenas arredondamento menor que um pixel CSS (0,9 px), nas duas direções. Teste com fenda de 0,7 px passa; fendas de 1/2 px e tile ausente continuam recusados.
10. **WhatsApp dividido:** acesso e código passam para a abertura da primeira parte, que é a parte aberta automaticamente. A lista inteira e exatamente um link de acesso são preservados.
11. **Editar território:** botão bloqueado com orientação para devolver primeiro, mais guarda de abertura/salvamento. O modelo já tinha guarda de vínculo; a afirmação de que sempre chegava a um erro bruto do Firestore não era exata. Rules não foram relaxadas.

Alertas extras: scripts `designacoes:dev`, `designacoes:worker`, `designacoes:guard` e `designacoes:deploy` já existem; nenhuma duplicação foi adicionada. Respostas HTML/JSON inválido do gateway agora geram orientação legível com status preservado. `CODIGOS_ENABLED=false` era preparação intencional, não falha do gerador; a ativação integra a publicação autorizada.

Validação desta revisão: **285 testes unitários/19 arquivos**, **20 testes de relay**, matriz Rules, smoke legado, **102 verificações de designações** e **22 de cartão/PIN** passaram. Lint, build e empacotamento Worker sem publicação passaram. PDFs: curto (1 página), paginado (3) e Unicode (2), com medidas e textos conferidos, seis páginas renderizadas/inspecionadas e seis QR Codes decodificados. Também corrigido tamanho do texto no início de páginas de continuação, que herdava 9 pt do subtítulo em vez de 10 pt. Não houve nova tentativa de navegador. Evidências em `artifacts/cartao-pdf/bugfix-*.log`, PDFs/PNGs e scripts de verificação.

## 17. Publicação autorizada — 22/10/2026

Autorização do usuário: “ok, pode publicar tudo”, seguida da solicitação de corrigir os apontamentos antes da publicação. Publicados frontend/PWA e pacote OTA **3.8.382** em https://territ-es-sbs.web.app. Rules privadas e índices publicados sem exclusões; snapshot anterior em `artifacts/release/firestore-before-3.8.382.rules`.

Sequência: provisionado `PIN_HMAC_KEY` com 32 bytes aleatórios, valor não exibido nem salvo em arquivo; preservados os três secrets existentes. Publicado backend retrocompatível com novas emissões desativadas (versão `d006b972-c71d-45ce-96b9-3da6f15fa432`); publicado/conferido frontend; ativado `CODIGOS_ENABLED=true` (versão final `164717d5-a718-47d5-ae47-8854a95821c6`). Os vínculos legados permanecem válidos e passam aos códigos ao renovar pelo fluxo previsto. Novas designações passam a emitir PIN. Cron `*/15 * * * *` mantido, sem execução manual.

Conferência remota: versão e manifesto OTA 3.8.382; **32 arquivos** (HTML, SW e assets, inclusive fonte e módulos carregados sob demanda) iguais ao build por SHA-256. ZIP público igual ao local e ao hash do manifesto `14aa5f2f8e9d16312a9397e2e13e98ddc768aaab228a849825a0b35b336cc99a`. Versão do Worker consultada novamente: flag verdadeira e quatro bindings de secrets presentes, sem acesso a seus valores. Requisição com credencial inválida rejeitada com 403, origem CORS esperada e `no-store`; conferência do backend repetida após ativação. Evidências: `artifacts/release/verification-3.8.382.json` e logs de deploy. Script reproduzível: `node scripts/verificar-publicacao-cartao.mjs` após o build da mesma versão.

Não houve migração de dados, mensagem enviada, designação real de teste, commit ou push. A publicação não comprova piloto, impressão/QR físico, WhatsApp, Android/WebView nem a captura real do mapa em navegador. O ajuste de telas pequenas e a atualização da UI permanecem com conferência visual manual pendente, respeitando a instrução de parar na primeira falha do navegador. A fonte Unicode não depende das fontes do destinatário, mas possui as limitações documentadas na seção 16.

## 18. Ajustes do painel e cartão de uma página — 22/10/2026

Solicitação: ampliar o X no canto superior direito, colocar os três pontos abaixo dele e mover a geração de PDF para esse menu. Aplicado somente ao popup de território, preservando as condições administrativas e os demais fluxos.

PDF: QR vetorial reduzido de 23 para 20 mm no cabeçalho; removidos campo de PIN, instruções e paginação. Créditos e data aparecem somente no rodapé discreto. A lista usa a maior fonte uniforme até 10 pt que caiba na área disponível, medindo todas as quebras antes de desenhar; não há novas páginas nem omissão de endereços. Observações digitais e dados persistidos permanecem sob o contrato anterior.

Validação local: 287 testes unitários/19 arquivos, lint, build e diff-check aprovados. Cinco PDFs sintéticos gerados em `output/pdf/cartao-compacto/`, todos com uma página de 93 × 145 mm: curto, seis endereços de duas linhas (10 pt), seis longos (~7,19 pt), 30 endereços (~3,55 pt) e Unicode. Textos, medidas e margens conferidos por extração; cinco páginas renderizadas e inspecionadas; cinco QRs menores decodificados sem PIN. O exemplo extremo evidencia a perda de legibilidade física ao priorizar uma página. Scripts aceitam `CARTAO_OUTPUT_DIR` para manter as evidências anteriores intactas.

Sem publicação, alteração de versão, commit ou push desta rodada. Conferência visual do popup no navegador, captura cartográfica real e leitura do QR impresso continuam pendentes; não houve nova tentativa de navegador após a falha já registrada.

Complemento do cabeçalho: idioma, cidade e bairro em linhas separadas, após o título. Cidade identificada no endereço com município/UF ou campo explícito, com cidade padrão configurada como alternativa quando ausente; sem geocodificação ou escrita de dados. Cabeçalho ajusta a própria fonte para manter o mapa e a lista nas posições anteriores. Exemplo de seis endereços permanece em uma página e 10 pt na lista. Validação atualizada: 288 testes, lint/build, extração dos cinco PDFs, inspeção do exemplo e cinco QRs decodificados. Sem publicação.

## 19. Publicação dos ajustes do painel e PDF — 22/10/2026

Autorização do usuário: “blz, pode publicar”. Executado `npm.cmd run web:deploy`: frontend/PWA e pacote OTA **3.8.383** publicados em https://territ-es-sbs.web.app, projeto `territ-es-sul-sbs`, somente alvo `hosting:app`. Inclui X ampliado, menu abaixo, geração do cartão dentro do menu, PDF de uma página com QR no cabeçalho e linhas de idioma, cidade e bairro.

Conferência remota às 15:20 (America/Sao_Paulo): versão e manifesto OTA 3.8.383; 32 arquivos do HTML/SW/assets iguais ao build por SHA-256, inclusive módulos do PDF e fonte; ZIP OTA igual ao local e ao hash do manifesto `cf80a54690fcc1a65267521dec7a5f5fba26f9fc0f72c2b3386685e5f3ea5a17`. API existente rejeitou credencial inválida com 403, CORS esperado e `no-store`. Evidência em `artifacts/release/verification-3.8.383.json`.

Backend, Rules e índices não foram republicados nesta rodada. Sem escrita de dados operacionais, commit ou push. Sem nova tentativa de navegador; aceite visual do painel e leitura física do QR permanecem pendentes.
