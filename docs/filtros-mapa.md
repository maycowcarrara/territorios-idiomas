# Filtros compactos do mapa

## Ajuste local — 23/10/2026

A pedido do usuário, o botão de texto “Sem endereços (N)” deixa de ficar exposto no mapa. Um ícone de funil no canto superior direito do mapa, com área de toque de 40 px e desenho de 18 px, abre o painel **Filtros do mapa**.

O painel reúne os controles existentes de idioma (quando há alternância disponível), endereços arquivados, territórios arquivados e a lista de territórios sem endereços. Os arquivados usam caixas de seleção com contagem. A lista de vazios e suas ações continuam dentro do painel, ajustadas à largura disponível. Ao retirar o último endereço, o painel abre junto da lista e da oferta de arquivamento. As ações de vincular endereços selecionados e limpar destaque da importação continuam fora dos filtros.

O painel fecha pelo X, Escape ou clique fora. Escape e X devolvem o foco ao ícone; rótulo acessível e estado expandido permanecem disponíveis, mesmo sem texto visível no botão. Um ponto discreto indica filtros/lista ativos. O painel tem largura e rolagem limitadas à janela, com isolamento dos gestos do Leaflet.

Validação: 357 testes, lint, build e diff-check aprovados. Prévia no navegador local, com dados fictícios e sem banco: abertura pelo ícone, acesso à lista e fechamento por Escape com retorno de foco conferidos. Captura do painel em `artifacts/filtros-mapa/painel-local.png`. A prévia valida o componente; não representa aceite do mapa autenticado ou aparelho físico.

Sem publicação, alteração de dados reais, mudança de versão, commit ou push nesta rodada.

## Publicação autorizada — 23/10/2026

Autorização: “publique”. Executado `npm.cmd run web:deploy`, publicando frontend/PWA/OTA **3.9.390** em https://territ-es-sbs.web.app, projeto `territ-es-sul-sbs`, alvo `hosting:app`. Inclui o ícone de filtro no canto superior direito e painel com idioma, arquivados e acesso à lista de vazios. Guard de projeto e build aprovados; lockfile alinhado.

Conferência às 14:17 (America/Sao_Paulo), por `node scripts/verificar-publicacao-cartao.mjs`: versão e manifesto OTA 3.9.390; 34 arquivos HTML/SW/assets iguais ao build por SHA-256; pacote OTA igual ao local e ao hash `7cd23cb4905cb892e047a6a35ef0a995ee6509ddda316351cc1737bf55dcbea3`. API existente rejeitou token inválido com 403, CORS esperado e `no-store`. Evidência em `artifacts/release/verification-3.9.390.json`.

Worker, Rules e índices não precisaram de publicação. Sem dados operacionais alterados, migração, mensagens, commit ou push. A validação visual anterior foi local e fictícia; confirmação na aplicação real/dispositivo segue separada da distribuição dos arquivos.

## Correção da seleção dos filtros — 23/10/2026

O usuário relatou que marcar opções não acrescentava territórios ao mapa e autorizou ajuste com republicação. Confirmado no código: o predicado rejeitava todo território vazio antes de avaliar os filtros e rejeitava todos os territórios na visão de endereços. A opção Sem endereços apenas abria o gerenciamento.

Corrigido: cada opção marcada acrescenta sua categoria. Mostrar territórios arquivados inclui os arquivados com ou sem endereços; Mostrar territórios sem endereços inclui vazios ativos ou arquivados. As categorias são somadas: um vazio arquivado continua visível enquanto qualquer uma dessas opções aplicáveis estiver marcada. Territórios selecionados explicitamente também podem aparecer na visão de endereços. Territórios comuns continuam seguindo a visão T/E. Vazios e arquivados continuam ocultos por padrão. O filtro não altera dados nem restaura o cadastro.

Mostrar endereços arquivados mantém o comportamento de inclusão de endereços. Alterar uma seleção sai do foco de um território para aplicar a escolha globalmente, preservando o idioma ativo. A contagem de territórios arquivados agora usa o mesmo conjunto do idioma exibido. O botão Gerenciar territórios sem endereços é separado da nova seleção de mapa, e abrir a lista não ativa filtros. Textos de edição/gerenciamento foram alinhados à ocultação por padrão. A posição anterior preservada é reutilizada, sem deslocamento artificial ou zoom automático; cadastros sem posição válida continuam disponíveis no gerenciamento.

Validação: 363 testes em 26 arquivos, lint, build e diff-check aprovados. Seis novas regressões cobrem padrão, modo T/E, arquivado vazio, categorias combinadas e desmarcação. Demonstração no navegador com o predicado real e marcadores Leaflet, sem tiles remotos/banco: marcação exibiu T14/T17 arquivados, vazios acrescentaram T15, visão E manteve os extras, desmarcação retirou as categorias. Todos os códigos/dados da demonstração eram fictícios. Evidência: `artifacts/filtros-mapa/marcadores-local.png`. Não houve validação autenticada dos cadastros reais nem dispositivo físico nesta rodada.

### Republicação da correção — 23/10/2026

Autorização do usuário: “Tá, você faz algum ajuste então e republicar ou não precisa?”, atendida com ajuste e republicação. Executado `npm.cmd run web:deploy`, frontend/PWA/OTA **3.9.391**, projeto `territ-es-sul-sbs`, alvo `hosting:app`, https://territ-es-sbs.web.app. Guard de projeto e build final aprovados; lockfile alinhado à versão.

Verificação remota às 14:45 (America/Sao_Paulo), por `node scripts/verificar-publicacao-cartao.mjs`: versão pública e manifesto OTA 3.9.391; 34 arquivos HTML/SW/assets iguais ao build por SHA-256; ZIP OTA igual ao local e ao hash `e94d029c2efdec0f6faf5552b7d1fe7bdfa5ac857161d1bb04f95b5f36e5c28a`. API existente rejeitou credencial inválida com 403, CORS esperado e `no-store`. Evidência em `artifacts/release/verification-3.9.391.json`.

Sem nova publicação de Worker/Rules/índices. Nenhum território real alterado ou criado para validar; sem migração, mensagens, commit ou push. A confirmação na aplicação autenticada/aparelho físico segue separada da demonstração local e da verificação de distribuição.
