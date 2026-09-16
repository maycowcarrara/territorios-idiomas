import { query, where, getDocs, collection } from 'firebase/firestore';
import { db } from '../../firebase';
import { isNormalContext } from '../../sistema';
import { getTerritorioContextCollectionRef, getTerritorioProgresso } from '../../territorioContext';
import {
  getGruposEnderecoCollectionRef,
  getGrupoEnderecoProgresso,
  formatGrupoEnderecoCodigoExibicao,
  formatGrupoEnderecoNomeExibicao
} from '../../enderecoModel';
import { loadMapaData } from '../../mapData';
import { buildFeatureIndex, getFeatureBoundsStr, getTerritorioQuadrasCount } from '../../mapaUtils';
import { normalizeTerritorioNome } from '../../territorioNome';

export const getMeusTerritoriosQuery = ({ email, contextoId }) => {
  if (isNormalContext(contextoId)) {
    return query(collection(db, "territorios"), where("designadoPara", "==", email));
  }

  return query(
    getTerritorioContextCollectionRef(db),
    where("contextoId", "==", contextoId),
    where("designadoPara", "==", email)
  );
};

export const carregarMeusTerritoriosDocs = async ({ email, contextoId }) => {
  const querySnapshot = await getDocs(getMeusTerritoriosQuery({ email, contextoId }));
  return querySnapshot.docs.map((territorioDoc) => ({
    id: territorioDoc.id,
    ...territorioDoc.data()
  }));
};

export const carregarMeusGruposEnderecoDocs = async ({ email }) => {
  const emailNormalizado = String(email || '').toLowerCase();
  const querySnapshot = await getDocs(query(
    getGruposEnderecoCollectionRef(db),
    where("designadoPara", "==", emailNormalizado)
  ));

  return querySnapshot.docs.map((grupoDoc) => ({
    id: grupoDoc.id,
    ...grupoDoc.data()
  }));
};

export const getGrupoEnderecoBoundsStr = (grupo) => {
  const bounds = grupo?.bounds;
  if (!bounds) return null;

  const { minLat, minLng, maxLat, maxLng } = bounds;
  if (![minLat, minLng, maxLat, maxLng].every((value) => Number.isFinite(Number(value)))) {
    return null;
  }

  return `${minLat},${minLng},${maxLat},${maxLng}`;
};

export const getGrupoEnderecoCentro = (grupo) => {
  const lat = Number(grupo?.centro?.lat);
  const lng = Number(grupo?.centro?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  const bounds = grupo?.bounds;
  if (!bounds) return null;

  const minLat = Number(bounds.minLat);
  const minLng = Number(bounds.minLng);
  const maxLat = Number(bounds.maxLat);
  const maxLng = Number(bounds.maxLng);
  if (![minLat, minLng, maxLat, maxLng].every(Number.isFinite)) {
    return null;
  }

  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2
  };
};

export const montarListaMeusTerritorios = async ({ docs }) => {
  if (!Array.isArray(docs) || docs.length === 0) {
    return [];
  }

  const geoData = await loadMapaData();
  const featureMap = buildFeatureIndex(geoData);
  const listaCompleta = docs.map((territorioDoc) => {
    const numeroId = territorioDoc.territorioNumero || parseInt(String(territorioDoc.id).replace(/.*t_/, ''), 10);
    const feature = featureMap.get(numeroId);
    const nome = normalizeTerritorioNome(
      territorioDoc.nome || feature?.properties?.nome,
      `Território ${numeroId}`
    );
    const boundsStr = getFeatureBoundsStr(feature);
    const totalQuadras = getTerritorioQuadrasCount(feature);
    const progresso = getTerritorioProgresso(territorioDoc, totalQuadras);
    const quadrasFeitas = progresso.quadrasFeitasExibicao;
    const quadrasRestantes = Math.max(totalQuadras - quadrasFeitas, 0);
    const percentual = progresso.percentualExibicao;

    let statusResumo = 'Em andamento';
    let descricaoResumo = `${quadrasRestantes} quadra${quadrasRestantes === 1 ? '' : 's'} faltando`;
    let barraClasse = 'bg-blue-600';
    let badgeClasse = 'bg-amber-100 text-amber-700';

    if (progresso.isAguardandoFinalizacao) {
      statusResumo = 'Aguardando finalização';
      descricaoResumo = 'Todas as quadras marcadas; falta confirmar a finalização';
      barraClasse = 'bg-yellow-400';
      badgeClasse = 'bg-yellow-100 text-yellow-700';
    } else if (progresso.isFinalizado) {
      statusResumo = 'Finalizado';
      descricaoResumo = 'Território encerrado e aguardando nova liberação';
      barraClasse = 'bg-green-500';
      badgeClasse = 'bg-green-100 text-green-700';
    }

    let dataFormatada = "Data desc.";
    let dataDesignacaoOrdenacao = 0;
    if (territorioDoc.dataDesignacao) {
      const d = territorioDoc.dataDesignacao.toDate ? territorioDoc.dataDesignacao.toDate() : new Date(territorioDoc.dataDesignacao);
      dataFormatada = d.toLocaleDateString('pt-BR');
      dataDesignacaoOrdenacao = d.getTime();
    }

    return {
      ...territorioDoc,
      tipo: 'territorio',
      numeroId,
      nome,
      boundsStr,
      dataFormatada,
      dataDesignacaoOrdenacao,
      totalQuadras,
      quadrasFeitas,
      quadrasRestantes,
      percentual,
      statusResumo,
      descricaoResumo,
      barraClasse,
      badgeClasse,
      unidadeProgresso: 'quadras',
      tipoLabel: 'Território',
      podeFinalizarDireto: progresso.isAguardandoFinalizacao && Boolean(territorioDoc.designadoPara)
    };
  });

  listaCompleta.sort((a, b) => {
    const diffTempo = a.dataDesignacaoOrdenacao - b.dataDesignacaoOrdenacao;
    if (diffTempo !== 0) return diffTempo;
    return a.numeroId - b.numeroId;
  });

  return listaCompleta;
};

export const montarListaMeusGruposEndereco = ({ docs }) => {
  if (!Array.isArray(docs) || docs.length === 0) {
    return [];
  }

  const listaCompleta = docs.map((grupoDoc) => {
    const progresso = getGrupoEnderecoProgresso(grupoDoc);
    const boundsStr = getGrupoEnderecoBoundsStr(grupoDoc);
    const centro = getGrupoEnderecoCentro(grupoDoc);
    const codigoExibicao = formatGrupoEnderecoCodigoExibicao(grupoDoc.codigo || grupoDoc.id);
    const nomeExibicao = formatGrupoEnderecoNomeExibicao(grupoDoc.nome, grupoDoc.codigo || grupoDoc.id);

    let dataFormatada = "Data desc.";
    let dataDesignacaoOrdenacao = 0;
    if (grupoDoc.dataDesignacao) {
      const d = grupoDoc.dataDesignacao.toDate ? grupoDoc.dataDesignacao.toDate() : new Date(grupoDoc.dataDesignacao);
      dataFormatada = d.toLocaleDateString('pt-BR');
      dataDesignacaoOrdenacao = d.getTime();
    }

    let statusResumo = 'Em andamento';
    let descricaoResumo = `${progresso.faltantes} endereço${progresso.faltantes === 1 ? '' : 's'} faltando`;
    let barraClasse = 'bg-indigo-600';
    let badgeClasse = 'bg-indigo-100 text-indigo-700';

    if (progresso.isFinalizado) {
      statusResumo = 'Finalizado';
      descricaoResumo = 'Território encerrado e aguardando nova liberação';
      barraClasse = 'bg-green-500';
      badgeClasse = 'bg-green-100 text-green-700';
    }

    return {
      ...grupoDoc,
      tipo: 'grupo_endereco',
      numeroId: codigoExibicao,
      nome: nomeExibicao,
      boundsStr,
      lat: centro?.lat,
      lng: centro?.lng,
      dataFormatada,
      dataDesignacaoOrdenacao,
      totalQuadras: progresso.totalEnderecos,
      quadrasFeitas: progresso.visitadosExibicao,
      quadrasRestantes: progresso.faltantes,
      percentual: progresso.percentualExibicao,
      statusResumo,
      descricaoResumo,
      barraClasse,
      badgeClasse,
      unidadeProgresso: 'endereços',
      tipoLabel: 'Território',
      podeFinalizarDireto: progresso.completo && Boolean(grupoDoc.designadoPara) && !progresso.isFinalizado
    };
  });

  listaCompleta.sort((a, b) => {
    const diffTempo = a.dataDesignacaoOrdenacao - b.dataDesignacaoOrdenacao;
    if (diffTempo !== 0) return diffTempo;
    return String(a.codigo || a.id).localeCompare(String(b.codigo || b.id));
  });

  return listaCompleta;
};
