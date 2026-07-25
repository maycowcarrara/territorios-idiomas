import { arrayUnion } from 'firebase/firestore';
import { TERRITORIO_STATUS } from './territorioContext';
import { enviarEventoNotificacao } from './notificationRelay';
import { normalizeTerritorioNome } from './territorioNome';

function buildContextoSufixo(contextoSistema) {
    if (contextoSistema?.campanhaAtiva && contextoSistema?.contextoAtivoTitulo) {
        return ` na campanha "${contextoSistema.contextoAtivoTitulo}"`;
    }

    if (contextoSistema?.contextoAtivoTipo === 'campanha' && contextoSistema?.contextoAtivoTitulo) {
        return ` na campanha "${contextoSistema.contextoAtivoTitulo}"`;
    }

    return '';
}

function buildFinalizacaoPayload({ dadosBanco, responsavelNome, agora }) {
    const historico = buildHistoricoTerritorio({
        dadosBanco,
        responsavelNome,
        agora
    });

    return {
        designadoPara: null,
        designadoNome: null,
        dataDesignacao: null,
        designacaoId: null,
        cicloAtual: null,
        historico: arrayUnion(historico),
        ultimaConclusao: agora,
        quadras_feitas: [],
        status: TERRITORIO_STATUS.FINALIZADO,
        ultimaAlteracao: agora
    };
}

async function enviarNotificacaoFinalizacao({ nome, responsavelNome, contextoSistema }) {
    const texto = `🏁 O Território ${nome} foi finalizado por ${responsavelNome}${buildContextoSufixo(contextoSistema)}.`;

    await enviarEventoNotificacao({
        para: 'ADMINS',
        texto,
        tipo: 'conclusao',
        origem: 'sistema',
        tituloPush: 'Território finalizado'
    });
}

export function createDesignacaoId() {
    return crypto.randomUUID();
}

export function buildNovoCicloTerritorio({ dadosBanco, novoNome, agora, designacaoId }) {
    if (dadosBanco.designadoPara) {
        return {
            dataInicio: dadosBanco.cicloAtual?.dataInicio || agora,
            responsaveis: [...new Set([...(dadosBanco.cicloAtual?.responsaveis || [dadosBanco.designadoNome]), novoNome])],
            designacaoId
        };
    }

    return {
        dataInicio: agora,
        responsaveis: [novoNome],
        designacaoId
    };
}

export function buildHistoricoTerritorio({ dadosBanco, responsavelNome, agora }) {
    const ciclo = dadosBanco.cicloAtual || {
        dataInicio: dadosBanco.dataDesignacao || agora,
        responsaveis: [responsavelNome],
        designacaoId: dadosBanco.designacaoId || null
    };

    return {
        ...ciclo,
        designacaoId: ciclo.designacaoId || dadosBanco.designacaoId || null,
        dataTermino: agora,
        responsaveis: [...new Set([...(ciclo.responsaveis || []), responsavelNome])]
    };
}

export async function finalizarTerritorioDesignado({ salvarEstadoTerritorio, dadosBanco, nome, contextoSistema }) {
    if (!dadosBanco?.designadoPara) {
        return { ok: false, motivo: 'sem_designacao' };
    }

    const nomeNormalizado = normalizeTerritorioNome(nome);
    const responsavelNome = dadosBanco.designadoNome || 'Dirigente';
    const agora = new Date();
    const contextoSufixo = buildContextoSufixo(contextoSistema);

    await salvarEstadoTerritorio(buildFinalizacaoPayload({
        dadosBanco,
        responsavelNome,
        agora
    }));

    let notificacaoEnviada = true;

    try {
        await enviarNotificacaoFinalizacao({
            nome: nomeNormalizado,
            responsavelNome,
            contextoSistema
        });
    } catch (error) {
        notificacaoEnviada = false;
        console.error('Finalização salva, mas a notificação aos admins falhou:', error);
    }

    return {
        ok: true,
        responsavelNome,
        contextoSufixo,
        notificacaoEnviada
    };
}
