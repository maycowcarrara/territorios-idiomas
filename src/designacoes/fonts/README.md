# Fonte de impressão Unicode

GNU Unifont 15.0.06, arquivo original sem alterações:
https://unifoundry.com/pub/unifont/unifont-15.0.06/font-builds/unifont-15.0.06.ttf

SHA-256: `9282b6eff54eeca2e7f58c9a40a91049bd219f3e6a45fbee8eba013379b9af3a`.

Autores: Roman Czyborra, Paul Hardy e os colaboradores do GNU Unifont.
Licença escolhida: SIL Open Font License 1.1, incluída em OFL-1.1.txt.
Projeto e créditos: https://unifoundry.com/unifont/index.html

A versão TrueType é necessária para o jsPDF (a distribuição OpenType atual usa CFF).
Só é carregada para cartões com caracteres fora de Windows-1252, pela própria
origem do aplicativo; não envia texto nem credenciais a terceiros. A fonte é
incorporada ao PDF, que não depende das fontes instaladas no dispositivo.

Abrange o BMP: cirílico, chinês, japonês, coreano, árabe e o símbolo №.
O jsPDF processa as formas árabes. Não se promete composição tipográfica de
todos os sistemas de escrita complexos nem cobertura dos planos suplementares
(por exemplo, emoji); glifos ausentes continuam gerando erro explícito.
