import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'docs', 'manuals');

const appName = 'Territórios General';
const generatedAt = new Date().toLocaleDateString('pt-BR');

const colors = {
  blue: [37, 99, 235],
  navy: [30, 64, 175],
  green: [22, 163, 74],
  yellow: [245, 158, 11],
  orange: [234, 88, 12],
  red: [220, 38, 38],
  violet: [124, 58, 237],
  slate: [51, 65, 85],
  gray: [100, 116, 139],
  lightBlue: [239, 246, 255],
  lightOrange: [255, 247, 237],
  lightYellow: [254, 252, 232],
  lightGreen: [240, 253, 244],
  lightGray: [248, 250, 252],
  border: [226, 232, 240]
};

const docs = [
  {
    fileName: 'guia-admins-territorios-general.pdf',
    title: 'Guia rápido dos administradores',
    subtitle: 'Como cuidar dos territórios no dia a dia',
    audience: 'Administradores',
    accent: colors.blue,
    intro:
      'Este guia é para usar na prática. O admin cuida dos usuários, designa territórios, acompanha o andamento, abre relatórios e controla campanhas quando houver.',
    quickBox: {
      title: 'O mais importante',
      items: [
        'Use o mapa para designar e devolver territórios.',
        'Use o Painel do Sistema para aprovar pessoas, arrumar nome/WhatsApp e mandar comunicados.',
        'Use Relatórios para ver o que está livre, ocupado, parado há muito tempo ou aguardando finalização.',
        'Promova alguém para admin somente se ele realmente vai cuidar do sistema.'
      ]
    },
    sections: [
      {
        title: '1. Aprovar e cadastrar usuários',
        items: [
          'Abra o menu lateral e toque em Painel do Sistema.',
          'Quem pediu acesso aparece como Pendente. Confira se é a pessoa certa e toque em Aprovar.',
          'Para cadastrar antes, informe Gmail, nome e WhatsApp. O e-mail precisa ser Gmail.',
          'Use Editar para corrigir nome ou WhatsApp.',
          'Use Remover apenas quando tiver certeza. Para tirar poder de admin, use o botão de permissão e deixe como Dirigente.'
        ]
      },
      {
        title: '2. Designar um território',
        items: [
          'Vá ao Mapa e toque no território.',
          'No popup, confira o Responsável atual. Se estiver Livre, escolha o dirigente na lista.',
          'Toque em Salvar. O sistema prepara uma mensagem de WhatsApp com o link do território.',
          'Envie a mensagem ao dirigente. Isso evita confusão e já leva a pessoa direto para o lugar certo.',
          'Se precisar trocar o responsável, escolha outro dirigente e salve. Se precisar devolver, escolha "-- Devolver / Livre --".'
        ]
      },
      {
        title: '3. Entender as cores do mapa',
        items: [
          'Laranja claro ou escuro: território livre. Quanto mais escuro, mais tempo parado.',
          'Azul: território seu ou em andamento.',
          'Cinza: ocupado por outro dirigente.',
          'Amarelo: todas as quadras foram marcadas, mas o dirigente ainda precisa confirmar a finalização.',
          'Verde: território finalizado oficialmente.',
          'Roxo: quando o território está com você e você também é admin.'
        ]
      },
      {
        title: '4. Acompanhar e liberar territórios',
        items: [
          'O território ocupado mostra nome do responsável e percentual feito.',
          'Quando estiver 100%, fica Aguardando finalização até o dirigente confirmar.',
          'Depois da confirmação, os admins recebem notificação.',
          'Para deixar um território finalizado disponível de novo, toque nele e use Disponibilizar Novamente.',
          'Se o dirigente devolveu antes de terminar, o sistema registra o ciclo no histórico.'
        ]
      },
      {
        title: '5. Relatórios',
        items: [
          'Abra menu lateral > Relatórios.',
          'Escolha o contexto: Pregação normal ou uma campanha.',
          'Use os cards/filtros para ver livres, ocupados, aguardando, finalizados ou parados há mais tempo.',
          'Use a busca por código, nome do território ou nome do dirigente.',
          'Abra uma linha para ver histórico recente.',
          'Toque em Baixar PDF quando precisar enviar ou guardar o relatório.'
        ]
      },
      {
        title: '6. Campanhas',
        items: [
          'No Painel do Sistema, crie ou reative uma campanha quando a congregacao for trabalhar em modo especial.',
          'Quando a campanha está ativa, o topo do app muda de cor e mostra a cobertura.',
          'O andamento da campanha fica separado da pregação normal. As observações das quadras continuam aparecendo.',
          'Ao terminar, use Voltar ao modo normal. Não exclua campanha sem necessidade, porque isso apaga o progresso dela.'
        ]
      },
      {
        title: '7. Comunicados e observações',
        items: [
          'No Painel do Sistema, envie comunicado para todos os usuários aprovados ou somente para admins.',
          'Escreva mensagens curtas: o que mudou, quando vale e o que a pessoa precisa fazer.',
          'Nas quadras, use observações só para informações úteis e permanentes, como ponto difícil, prédio, portão ou pedido de não visitar.',
          'Admin pode corrigir ou apagar observações quando necessário.'
        ]
      },
      {
        title: 'Cuidados simples',
        items: [
          'Não mantenha muitos admins. Quanto menos gente mexendo em configuração, melhor.',
          'Antes de apagar usuário ou campanha, confira duas vezes.',
          'Se algo não salvou, confira internet e tente novamente antes de repetir várias vezes.',
          'Quando houver dúvida, primeiro consulte Relatórios. Ele mostra melhor a situação geral.'
        ]
      }
    ]
  },
  {
    fileName: 'guia-dirigentes-territorios-general.pdf',
    title: 'Guia rápido dos dirigentes',
    subtitle: 'Como usar seus territórios na prática',
    audience: 'Dirigentes',
    accent: colors.green,
    intro:
      'Este guia é para o dirigente que recebeu território. O foco é simples: entrar, achar o território, marcar as quadras, anotar o que for importante e finalizar quando terminar.',
    quickBox: {
      title: 'O mais importante',
      items: [
        'Entre com sua conta Google e aguarde aprovação se for o primeiro acesso.',
        'Use o botão Meus para encontrar seus territórios.',
        'Marque cada quadra feita tocando no número dela.',
        'Quando tudo estiver feito, confirme a finalização.'
      ]
    },
    sections: [
      {
        title: '1. Entrar no app',
        items: [
          'Abra o app Territorios General.',
          'Toque em Entrar com Google e escolha seu Gmail.',
          'Se aparecer que seu acesso foi solicitado, aguarde um admin aprovar.',
          'Depois de aprovado, você entra direto no mapa.',
          'Se trocar de celular, entre com o mesmo Gmail. Não crie outra conta.'
        ]
      },
      {
        title: '2. Ver seus territórios',
        items: [
          'No topo, toque em Meus.',
          'A lista mostra os territórios que estão com você, normalmente do mais antigo para o mais recente.',
          'Toque em Ir para o Mapa para abrir o território certo.',
          'Se não aparecer nenhum território, fale com o servo de territórios.'
        ]
      },
      {
        title: '3. Usar o mapa no campo',
        items: [
          'Use dois dedos para aproximar o mapa ate aparecerem as quadras.',
          'O botão de GPS ajuda a centralizar onde você está.',
          'O botão do olho esconde as cores por um momento, ajudando a ler nomes de ruas.',
          'Se precisar trocar o tipo de mapa, use o botão de camada no canto inferior esquerdo.'
        ]
      },
      {
        title: '4. Marcar quadras',
        items: [
          'Quando uma quadra for trabalhada, toque na bolinha com o número dela.',
          'Vermelho quer dizer não feita. Verde quer dizer feita.',
          'Marque conforme for trabalhando para não esquecer depois.',
          'Marque somente quadras do seu território.'
        ]
      },
      {
        title: '5. Fazer observações',
        items: [
          'No celular, segure o dedo em cima do número da quadra.',
          'No computador, clique com o botão direito no número da quadra.',
          'Escreva apenas o que ajuda na próxima visita: prédio, portão, casa difícil, pedido de não visitar ou informação importante.',
          'Uma bolinha amarela mostra que aquela quadra tem observação.',
          'Evite detalhes desnecessários ou comentários pessoais.'
        ]
      },
      {
        title: '6. Ponto de encontro',
        items: [
          'Toque no lugar do mapa onde deseja marcar o encontro.',
          'Abra o popup do território.',
          'Toque em Ponto de Encontro.',
          'O app abre o WhatsApp com o link do local para enviar ao grupo ou aos publicadores.'
        ]
      },
      {
        title: '7. Finalizar o território',
        items: [
          'Quando todas as quadras estiverem verdes, o território fica 100%.',
          'Toque em Confirmar Finalização no popup, ou abra Meus e use Finalizar agora.',
          'Depois disso, os admins são avisados automaticamente.',
          'Peça outro território com antecedência, sem esperar ficar parado.'
        ]
      },
      {
        title: '8. Quando tiver campanha',
        items: [
          'Se houver campanha ativa, o topo do app muda de cor e mostra o nome da campanha.',
          'Trabalhe normalmente os territórios que forem designados para você.',
          'A campanha não apaga o andamento da pregação normal. Ela fica separada no sistema.',
          'As observações das quadras continuam aparecendo.'
        ]
      },
      {
        title: 'Problemas comuns',
        items: [
          'Não consigo entrar: confira se está usando o Gmail certo e se o admin já aprovou.',
          'Mapa não achou minha posição: ative o GPS e permita localização para o app.',
          'Toquei errado numa quadra: toque novamente para voltar.',
          'Internet falhou: espere voltar e confira se ficou salvo antes de continuar.',
          'Território errado: avise o admin. Não tente resolver criando outra conta.'
        ]
      }
    ]
  }
];

function mmColor(doc, color) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function fillColor(doc, color) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function drawFooter(doc, currentPage, totalPages) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setDrawColor(...colors.border);
  doc.line(16, pageHeight - 14, pageWidth - 16, pageHeight - 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...colors.gray);
  doc.text(`${appName} - guia prático`, 16, pageHeight - 8);
  doc.text(`Pagina ${currentPage} de ${totalPages}`, pageWidth - 16, pageHeight - 8, { align: 'right' });
}

function addPageIfNeeded(doc, y, needed = 22) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed <= pageHeight - 22) return y;
  doc.addPage();
  return 22;
}

function wrapped(doc, text, x, y, width, options = {}) {
  const {
    size = 10,
    style = 'normal',
    color = colors.slate,
    lineHeight = 5
  } = options;

  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(...color);

  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function bulletList(doc, items, x, y, width) {
  for (const item of items) {
    y = addPageIfNeeded(doc, y, 13);
    fillColor(doc, colors.blue);
    doc.circle(x + 1.5, y - 1.3, 0.8, 'F');
    y = wrapped(doc, item, x + 5, y, width - 5, {
      size: 10,
      lineHeight: 4.7
    }) + 1.8;
  }
  return y;
}

function callout(doc, title, items, x, y, width, accent) {
  const startY = y;
  const contentWidth = width - 12;
  let measureY = y + 12;
  const lineCounts = items.map((item) => doc.splitTextToSize(item, contentWidth - 5).length);
  const estimatedHeight = 14 + lineCounts.reduce((sum, count) => sum + count * 4.5 + 3, 0);
  y = addPageIfNeeded(doc, y, estimatedHeight);

  fillColor(doc, colors.lightBlue);
  doc.roundedRect(x, y, width, estimatedHeight, 2, 2, 'F');
  fillColor(doc, accent);
  doc.rect(x, y, 3, estimatedHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...accent);
  doc.text(title.toUpperCase(), x + 7, y + 8);

  measureY = y + 15;
  for (const item of items) {
    fillColor(doc, accent);
    doc.circle(x + 8, measureY - 1.5, 0.75, 'F');
    measureY = wrapped(doc, item, x + 12, measureY, contentWidth - 5, {
      size: 9.5,
      lineHeight: 4.5
    }) + 1.5;
  }

  return Math.max(startY, y) + estimatedHeight + 8;
}

function drawLegend(doc, y) {
  const legend = [
    ['Livre recente', colors.lightOrange, 'Disponível para designar.'],
    ['Livre antiga', colors.orange, 'Mais escuro: está parada há mais tempo.'],
    ['Ocupado', colors.gray, 'Esta com outro dirigente.'],
    ['Aguardando', colors.yellow, '100%, faltando confirmar finalização.'],
    ['Finalizado', colors.green, 'Encerrado oficialmente.']
  ];

  y = addPageIfNeeded(doc, y, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...colors.slate);
  doc.text('Legenda rápida das cores', 16, y);
  y += 6;

  for (const [label, color, desc] of legend) {
    y = addPageIfNeeded(doc, y, 9);
    fillColor(doc, color);
    doc.roundedRect(16, y - 4.2, 6, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...colors.slate);
    doc.text(label, 25, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.gray);
    doc.text(desc, 62, y);
    y += 7;
  }

  return y + 3;
}

function drawCover(doc, data) {
  const pageWidth = doc.internal.pageSize.getWidth();

  fillColor(doc, data.accent);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(appName, 16, 14);
  doc.setFontSize(8.5);
  doc.text(`General Carneiro - PR | Atualizado em ${generatedAt}`, 16, 21);

  try {
    const logoPath = path.join(rootDir, 'public', 'icon-general-192.png');
    const logo = fs.readFileSync(logoPath).toString('base64');
    doc.addImage(`data:image/png;base64,${logo}`, 'PNG', pageWidth - 32, 7, 18, 18);
  } catch {
    // The guide still works without the logo.
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...colors.slate);
  doc.text(data.title, 16, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...colors.gray);
  doc.text(data.subtitle, 16, 58);

  fillColor(doc, colors.lightGray);
  doc.roundedRect(16, 68, pageWidth - 32, 20, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...data.accent);
  doc.text(`PARA: ${data.audience.toUpperCase()}`, 22, 77);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.slate);
  doc.text('Linguagem simples, passos curtos e foco no uso real.', 22, 83);

  return wrapped(doc, data.intro, 16, 102, pageWidth - 32, {
    size: 11,
    lineHeight: 5.2
  }) + 8;
}

function makePdf(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  let y = drawCover(doc, data);
  y = callout(doc, data.quickBox.title, data.quickBox.items, margin, y, contentWidth, data.accent);

  if (data.audience === 'Administradores') {
    y = drawLegend(doc, y);
  }

  for (const section of data.sections) {
    y = addPageIfNeeded(doc, y, 24);
    mmColor(doc, data.accent);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(section.title, margin, y);
    y += 7;
    y = bulletList(doc, section.items, margin, y, contentWidth);
    y += 3;
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    drawFooter(doc, i, totalPages);
  }

  const outPath = path.join(outDir, data.fileName);
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
  return outPath;
}

fs.mkdirSync(outDir, { recursive: true });
const paths = docs.map(makePdf);

for (const pdfPath of paths) {
  console.log(pdfPath);
}
