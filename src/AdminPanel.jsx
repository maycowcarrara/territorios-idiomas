import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { useSistema } from './useSistema';
import { getDefaultSistemaConfig, slugifyCampanha } from './sistema';
import { getTerritorioContextCollectionRef } from './territorioContext';
import { useUiFeedback } from './uiFeedback';
import { enviarComunicadoPeloRelay, relayDisponivel } from './notificationRelay';
import { useOnlineStatus } from './useOnlineStatus';
import { AppPage, PageHeader } from './uiPrimitives';
import { buttonClass } from './uiClasses';

const ADMIN_OFFLINE_MESSAGE = 'Você está offline. Ações administrativas precisam de conexão para evitar conflito de designações. Conecte-se para continuar.';
const ADMIN_OFFLINE_ACTION_CLASS = 'disabled:cursor-not-allowed disabled:opacity-50';
const ADMIN_TABS = [
    { id: 'usuarios', label: 'Usuários', icon: '👥' },
    { id: 'campanhas', label: 'Campanhas', icon: '📢' },
    { id: 'comunicados', label: 'Comunicados', icon: '🔔' }
];

const AdminPanel = () => {
    const isOnline = useOnlineStatus();
    const [usuarios, setUsuarios] = useState([]);
    const [campanhas, setCampanhas] = useState([]);
    const [campanhaTitulo, setCampanhaTitulo] = useState('');
    const [campanhaSlug, setCampanhaSlug] = useState('');
    const [salvandoCampanha, setSalvandoCampanha] = useState(false);
    const [campanhaParaExcluir, setCampanhaParaExcluir] = useState(null);
    const [confirmacaoExclusao, setConfirmacaoExclusao] = useState('');
    const [carregandoResumoExclusao, setCarregandoResumoExclusao] = useState(false);
    const [registrosCampanhaParaExcluir, setRegistrosCampanhaParaExcluir] = useState(0);
    const [excluindoCampanha, setExcluindoCampanha] = useState(false);
    const { config: contextoSistema } = useSistema();
    const { notify, confirm } = useUiFeedback();
    const adminActionsDisabled = !isOnline;

    const ensureOnlineAdminAction = () => {
        if (isOnline) return true;

        notify({
            title: 'Administração bloqueada offline',
            message: ADMIN_OFFLINE_MESSAGE,
            variant: 'warning',
            durationMs: 7000
        });
        return false;
    };

    // Estados para NOVO usuário
    const [novoEmail, setNovoEmail] = useState('');
    const [novoNome, setNovoNome] = useState('');
    const [novoWhats, setNovoWhats] = useState('');
    const [loadingAdd, setLoadingAdd] = useState(false);
    const [comunicadoGeral, setComunicadoGeral] = useState('');
    const [enviandoComunicado, setEnviandoComunicado] = useState(false);
    const [destinoComunicado, setDestinoComunicado] = useState('todos');
    const [activeTab, setActiveTab] = useState('usuarios');
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('todos');
    const [cadastroAberto, setCadastroAberto] = useState(false);

    // Estados para EDIÇÃO inline
    const [editandoId, setEditandoId] = useState(null);
    const [dadosEditados, setDadosEditados] = useState({});

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "usuarios"), (snapshot) => {
            const lista = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Ordenar: Pendentes primeiro, depois Admins, depois resto
            lista.sort((a, b) => {
                if (a.role === 'aguardando' && b.role !== 'aguardando') return -1;
                if (a.role !== 'aguardando' && b.role === 'aguardando') return 1;
                if (a.role === 'admin' && b.role !== 'admin') return -1;
                if (a.role !== 'admin' && b.role === 'admin') return 1;
                return a.nome?.localeCompare(b.nome);
            });
            setUsuarios(lista);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "campanhas"), (snapshot) => {
            const lista = snapshot.docs.map((campanhaDoc) => ({
                id: campanhaDoc.id,
                ...campanhaDoc.data()
            }));

            lista.sort((a, b) => {
                const dataA = a.atualizadaEm?.seconds || a.criadaEm?.seconds || 0;
                const dataB = b.atualizadaEm?.seconds || b.criadaEm?.seconds || 0;
                return dataB - dataA;
            });

            setCampanhas(lista);
        });

        return () => unsub();
    }, []);

    useEffect(() => {
        let ativo = true;

        const carregarResumoExclusao = async () => {
            if (!campanhaParaExcluir) {
                setConfirmacaoExclusao('');
                setRegistrosCampanhaParaExcluir(0);
                setCarregandoResumoExclusao(false);
                return;
            }

            setConfirmacaoExclusao('');
            setCarregandoResumoExclusao(true);

            try {
                const contextoQuery = query(
                    getTerritorioContextCollectionRef(db),
                    where("contextoId", "==", campanhaParaExcluir.id)
                );
                const snapshot = await getDocs(contextoQuery);

                if (ativo) {
                    setRegistrosCampanhaParaExcluir(snapshot.size);
                }
            } catch (error) {
                console.error("Erro ao carregar resumo da campanha para exclusão:", error);
                if (ativo) {
                    setRegistrosCampanhaParaExcluir(0);
                }
            } finally {
                if (ativo) {
                    setCarregandoResumoExclusao(false);
                }
            }
        };

        carregarResumoExclusao();

        return () => {
            ativo = false;
        };
    }, [campanhaParaExcluir]);

    // --- ADICIONAR NOVO ---
    const handleAdicionar = async (e) => {
        e.preventDefault();
        if (!ensureOnlineAdminAction()) return;
        if (!novoEmail) return;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(novoEmail)) {
            notify({
                title: 'E-mail inválido',
                message: 'Por favor, verifique o formato informado.',
                variant: 'warning'
            });
            return;
        }

        const whatsLimpo = novoWhats.replace(/\D/g, '');
        if (novoWhats && (whatsLimpo.length < 10 || whatsLimpo.length > 11)) {
            notify({
                title: 'WhatsApp inválido',
                message: 'O número deve ter DDD + 8 ou 9 dígitos.',
                variant: 'warning'
            });
            return;
        }

        setLoadingAdd(true);
        const emailFormatado = novoEmail.trim().toLowerCase();

        try {
            await setDoc(doc(db, "usuarios", emailFormatado), {
                role: 'comum',
                nome: novoNome || 'Novo Dirigente',
                whatsapp: whatsLimpo,
                criadoEm: new Date()
            });
            setNovoEmail('');
            setNovoNome('');
            setNovoWhats('');
            setCadastroAberto(false);
            notify({
                title: 'Usuário cadastrado',
                message: 'Usuário adicionado com sucesso.',
                variant: 'success'
            });
        } catch (error) {
            console.error("Erro ao adicionar:", error);
            notify({
                title: 'Cadastro bloqueado',
                message: 'Verifique suas permissões e tente novamente.',
                variant: 'error'
            });
        }
        setLoadingAdd(false);
    };

    // --- AÇÕES RÁPIDAS (ATUALIZADO COM CONFIRMAÇÃO) ---
    const mudarRole = async (user, novaRole) => {
        if (!ensureOnlineAdminAction()) return;
        const nomeUsuario = user.nome || user.id;
        const aprovandoUsuario = user.role === 'aguardando' && novaRole === 'comum';
        const promovendoAdmin = novaRole === 'admin';
        const rebaixandoAdmin = user.role === 'admin' && novaRole === 'comum';
        const alerta = aprovandoUsuario
            ? `Deseja aprovar o acesso de ${nomeUsuario} como dirigente?`
            : promovendoAdmin
                ? `⚠️ ATENÇÃO: Você está prestes a tornar ${nomeUsuario} um ADMINISTRADOR.\n\nEle terá acesso total ao sistema, incluindo edição e exclusão de dados.\n\nDeseja continuar?`
                : `Deseja remover as permissões de administrador de ${nomeUsuario}?`;

        if (!(await confirm({
            title: aprovandoUsuario ? 'Aprovar usuário' : promovendoAdmin ? 'Promover para admin' : 'Remover permissão de admin',
            message: alerta,
            tone: promovendoAdmin || rebaixandoAdmin ? 'warning' : 'info',
            confirmLabel: aprovandoUsuario ? 'Aprovar' : promovendoAdmin ? 'Promover' : 'Remover'
        }))) {
            return;
        }

        try {
            await updateDoc(doc(db, "usuarios", user.id), { role: novaRole });
        } catch {
            notify({
                title: 'Permissão não alterada',
                message: 'Não foi possível mudar a permissão agora.',
                variant: 'error'
            });
        }
    };

    const remover = async (email) => {
        if (!ensureOnlineAdminAction()) return;
        if (!(await confirm({
            title: 'Excluir usuário',
            message: `Tem certeza que deseja excluir definitivamente o usuário ${email}?\n\nEssa ação não pode ser desfeita.`,
            tone: 'danger',
            confirmLabel: 'Excluir'
        }))) {
            return;
        }

        try {
            await deleteDoc(doc(db, "usuarios", email));
        } catch {
            notify({
                title: 'Usuário não removido',
                message: 'Não foi possível remover esse usuário agora.',
                variant: 'error'
            });
        }
    };

    // --- LÓGICA DE EDIÇÃO ---
    const iniciarEdicao = (user) => {
        setEditandoId(user.id);
        setDadosEditados({ ...user });
    };

    const cancelarEdicao = () => {
        setEditandoId(null);
        setDadosEditados({});
    };

    const salvarEdicao = async () => {
        if (!editandoId) return;
        if (!ensureOnlineAdminAction()) return;

        try {
            await updateDoc(doc(db, "usuarios", editandoId), {
                nome: dadosEditados.nome,
                whatsapp: dadosEditados.whatsapp
            });
            setEditandoId(null);
        } catch (error) {
            console.error(error);
            notify({
                title: 'Edição não salva',
                message: 'Não foi possível salvar as alterações.',
                variant: 'error'
            });
        }
    };

    const handleEditChange = (campo, valor) => {
        setDadosEditados(prev => ({ ...prev, [campo]: valor }));
    };

    const enviarComunicadoGeral = async (e) => {
        e.preventDefault();
        if (!ensureOnlineAdminAction()) return;

        const mensagem = comunicadoGeral.trim();
        const destinatarios = usuarios.filter((user) => user.role === 'admin' || user.role === 'comum');
        const admins = usuarios.filter((user) => user.role === 'admin');

        if (!mensagem) {
            notify({
                title: 'Mensagem obrigatoria',
                message: 'Digite a mensagem do comunicado.',
                variant: 'warning'
            });
            return;
        }

        if (destinoComunicado === 'admins' && admins.length === 0) {
            notify({
                title: 'Sem destinatarios',
                message: 'Não há administradores para receber o comunicado.',
                variant: 'warning'
            });
            return;
        }

        if (destinoComunicado === 'todos' && destinatarios.length === 0) {
            notify({
                title: 'Sem destinatarios',
                message: 'Não há usuários aprovados para receber o comunicado.',
                variant: 'warning'
            });
            return;
        }

        const totalDestino = destinoComunicado === 'admins' ? admins.length : destinatarios.length;
        const rotuloDestino = destinoComunicado === 'admins' ? 'admin(s)' : 'usuário(s)';

        if (!(await confirm({
            title: 'Enviar comunicado',
            message: `Enviar este comunicado para ${totalDestino} ${rotuloDestino}?`,
            tone: 'warning',
            confirmLabel: 'Enviar'
        }))) {
            return;
        }

        setEnviandoComunicado(true);

        try {
            let resultadoRelay = null;

            if (relayDisponivel()) {
                resultadoRelay = await enviarComunicadoPeloRelay({
                    destino: destinoComunicado,
                    mensagem
                });
            } else {
                const agora = new Date();
                if (destinoComunicado === 'admins') {
                    const batchSize = 400;

                    for (let index = 0; index < admins.length; index += batchSize) {
                        const batch = writeBatch(db);
                        admins
                            .slice(index, index + batchSize)
                            .forEach((admin) => {
                                const notificacaoRef = doc(collection(db, "notificacoes"));
                                batch.set(notificacaoRef, {
                                    para: admin.id,
                                    texto: mensagem,
                                    data: agora,
                                    lida: false,
                                    tipo: 'comunicado',
                                    origem: 'admin'
                                });
                            });

                        await batch.commit();
                    }
                } else {
                    const batchSize = 400;

                    for (let index = 0; index < destinatarios.length; index += batchSize) {
                        const batch = writeBatch(db);

                        destinatarios
                            .slice(index, index + batchSize)
                            .forEach((user) => {
                                const notificacaoRef = doc(collection(db, "notificacoes"));
                                batch.set(notificacaoRef, {
                                    para: user.id,
                                    texto: mensagem,
                                    data: agora,
                                    lida: false,
                                    tipo: 'comunicado',
                                    origem: 'admin'
                                });
                            });

                        await batch.commit();
                    }
                }
            }

            setComunicadoGeral('');
            notify({
                title: 'Comunicado enviado',
                message: resultadoRelay
                    ? `Comunicado enviado para ${resultadoRelay.destinatarios ?? totalDestino} ${rotuloDestino}. Push ${resultadoRelay.canal ?? 'relay'}: ${resultadoRelay.pushesEnviados ?? 0} enviado(s), ${resultadoRelay.pushesFalharam ?? 0} falha(s).`
                    : `Comunicado enviado para ${totalDestino} ${rotuloDestino}.`,
                variant: 'success'
            });
        } catch (error) {
            console.error("Erro ao enviar comunicado geral:", error);
            notify({
                title: 'Envio indisponível',
                message: String(error?.message || 'Não foi possível enviar o comunicado geral.'),
                variant: 'error'
            });
        } finally {
            setEnviandoComunicado(false);
        }
    };

    const ativarCampanha = async ({ id, titulo }) => {
        if (!ensureOnlineAdminAction()) return;
        setSalvandoCampanha(true);

        try {
            const agora = new Date();
            await setDoc(doc(db, "campanhas", id), {
                id,
                titulo,
                atualizadaEm: agora,
                criadaEm: agora
            }, { merge: true });

            await setDoc(doc(db, "configuracoes", "sistema"), {
                contextoAtivoId: id,
                contextoAtivoTipo: 'campanha',
                contextoAtivoTitulo: titulo,
                contextoAtivoCor: 'violet',
                campanhaAtiva: true,
                campanha_ativa: id,
                nome_campanha: titulo,
                atualizadaEm: agora
            }, { merge: true });

            setCampanhaTitulo('');
            setCampanhaSlug('');
            notify({
                title: 'Campanha ativada',
                message: `Campanha "${titulo}" ativada com sucesso.`,
                variant: 'success'
            });
        } catch (error) {
            console.error("Erro ao ativar campanha:", error);
            notify({
                title: 'Campanha não ativada',
                message: 'Não foi possível ativar a campanha.',
                variant: 'error'
            });
        } finally {
            setSalvandoCampanha(false);
        }
    };

    const handleCriarCampanha = async (e) => {
        e.preventDefault();
        const titulo = campanhaTitulo.trim();
        const id = slugifyCampanha(campanhaSlug || titulo);

        if (!titulo) {
            notify({
                title: 'Titulo obrigatorio',
                message: 'Informe o título da campanha.',
                variant: 'warning'
            });
            return;
        }

        if (!id) {
            notify({
                title: 'Identificador inválido',
                message: 'Não consegui gerar um identificador válido para a campanha.',
                variant: 'error'
            });
            return;
        }

        await ativarCampanha({ id, titulo });
    };

    const voltarModoNormal = async () => {
        if (!ensureOnlineAdminAction()) return;
        if (!(await confirm({
            title: 'Desativar campanha',
            message: 'Voltar o sistema para a pregação normal agora?',
            tone: 'warning',
            confirmLabel: 'Voltar ao normal'
        }))) return;

        setSalvandoCampanha(true);
        try {
            const configNormal = getDefaultSistemaConfig();
            await setDoc(doc(db, "configuracoes", "sistema"), {
                ...configNormal,
                campanha_ativa: configNormal.contextoAtivoId,
                nome_campanha: '',
                atualizadaEm: new Date()
            }, { merge: true });
            notify({
                title: 'Modo normal ativo',
                message: 'Sistema voltou para o modo normal.',
                variant: 'success'
            });
        } catch (error) {
            console.error("Erro ao voltar para o modo normal:", error);
            notify({
                title: 'Mudança não concluída',
                message: 'Não foi possível voltar para o modo normal.',
                variant: 'error'
            });
        } finally {
            setSalvandoCampanha(false);
        }
    };

    const abrirModalExclusaoCampanha = (campanha) => {
        setCampanhaParaExcluir(campanha);
    };

    const fecharModalExclusaoCampanha = (forcar = false) => {
        if (excluindoCampanha && !forcar) return;
        setCampanhaParaExcluir(null);
        setConfirmacaoExclusao('');
        setRegistrosCampanhaParaExcluir(0);
        setCarregandoResumoExclusao(false);
    };

    const excluirCampanha = async () => {
        if (!campanhaParaExcluir) return;
        if (!ensureOnlineAdminAction()) return;

        if (contextoSistema.contextoAtivoId === campanhaParaExcluir.id) {
            notify({
                title: 'Campanha em uso',
                message: 'Desative a campanha antes de excluir.',
                variant: 'warning'
            });
            return;
        }

        if (confirmacaoExclusao.trim() !== campanhaParaExcluir.id) {
            notify({
                title: 'Confirmação incompleta',
                message: 'Digite o identificador exato da campanha para confirmar a exclusão.',
                variant: 'warning'
            });
            return;
        }

        setExcluindoCampanha(true);

        try {
            const campanhaExcluida = campanhaParaExcluir;
            const contextoQuery = query(
                getTerritorioContextCollectionRef(db),
                where("contextoId", "==", campanhaParaExcluir.id)
            );
            const contextoSnapshot = await getDocs(contextoQuery);
            const refsParaExcluir = [
                ...contextoSnapshot.docs.map((docSnapshot) => docSnapshot.ref),
                doc(db, "campanhas", campanhaParaExcluir.id)
            ];

            const batchSize = 400;
            for (let index = 0; index < refsParaExcluir.length; index += batchSize) {
                const batch = writeBatch(db);
                refsParaExcluir
                    .slice(index, index + batchSize)
                    .forEach((docRef) => batch.delete(docRef));
                await batch.commit();
            }

            fecharModalExclusaoCampanha(true);
            notify({
                title: 'Campanha excluída',
                message: `Campanha "${campanhaExcluida.titulo || campanhaExcluida.id}" excluída com sucesso.`,
                variant: 'success'
            });
        } catch (error) {
            console.error("Erro ao excluir campanha:", error);
            notify({
                title: 'Exclusão não concluída',
                message: 'Não foi possível excluir a campanha.',
                variant: 'error'
            });
        } finally {
            setExcluindoCampanha(false);
        }
    };

    // --- CONTADORES ---
    const totalUsers = usuarios.length;
    const totalAdmins = usuarios.filter((u) => u.role === 'admin').length;
    const usuariosPendentes = usuarios.filter((u) => u.role === 'aguardando');
    const totalPendentes = usuariosPendentes.length;
    const totalAprovados = usuarios.filter((u) => u.role === 'admin' || u.role === 'comum').length;
    const totalDestinoComunicado = destinoComunicado === 'admins' ? totalAdmins : totalAprovados;
    const buscaUsuario = userSearch.trim().toLowerCase();
    const usuariosFiltrados = usuarios.filter((user) => {
        const correspondePerfil = userRoleFilter === 'todos' || user.role === userRoleFilter;
        const conteudoBusca = `${user.nome || ''} ${user.id || ''} ${user.whatsapp || ''}`.toLowerCase();
        const correspondeBusca = !buscaUsuario || conteudoBusca.includes(buscaUsuario);

        return correspondePerfil && correspondeBusca;
    });
    const adminTabs = ADMIN_TABS.map((tab) => {
        if (tab.id === 'usuarios') {
            return {
                ...tab,
                badge: totalPendentes > 0 ? `${totalPendentes} pend.` : `${totalUsers}`
            };
        }

        if (tab.id === 'campanhas') {
            return {
                ...tab,
                badge: contextoSistema.campanhaAtiva ? 'ativa' : `${campanhas.length}`
            };
        }

        if (tab.id === 'comunicados') {
            return {
                ...tab,
                badge: `${totalDestinoComunicado}`
            };
        }

        return tab;
    });
    const formatarTelefone = (valor) => {
        return valor
            .replace(/\D/g, '')
            .replace(/^(\d{2})(\d)/g, '($1) $2')
            .replace(/(\d)(\d{4})$/, '$1-$2');
    };

    return (
        <AppPage>
                <PageHeader
                    eyebrow="Administração"
                    title="Painel de Controle"
                    subtitle="Usuários, campanhas e comunicados com uma visão limpa para decisões rápidas."
                    actions={(
                        <>
                            <div className={`inline-flex items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${isOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                                <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                {isOnline ? 'Online' : 'Offline'}
                            </div>
                            <Link to="/app" className={buttonClass('secondary')}>
                                ← Voltar ao Mapa
                            </Link>
                        </>
                    )}
                />

                {!isOnline && (
                    <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900 shadow-sm">
                        {ADMIN_OFFLINE_MESSAGE}
                    </div>
                )}

                <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Dirigentes</p>
                            <p className="mt-1 text-lg font-black text-slate-800">{totalUsers}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Admins</p>
                            <p className="mt-1 text-lg font-black text-blue-700">{totalAdmins}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Pendentes</p>
                            <p className={`mt-1 text-lg font-black ${totalPendentes > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>{totalPendentes}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Modo</p>
                            <p className="mt-1 truncate text-[13px] font-black text-violet-700">
                                {contextoSistema.campanhaAtiva ? contextoSistema.contextoAtivoTitulo : 'Pregação normal'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
                    <div className="overflow-x-auto">
                        <div className="flex min-w-max gap-2">
                            {adminTabs.map((tab) => {
                                const ativa = activeTab === tab.id;

                                return (
                                    <button
                                        key={tab.id}
                                        id={`tab-${tab.id}`}
                                        type="button"
                                        role="tab"
                                        aria-selected={ativa}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`min-w-[160px] rounded-xl border px-3 py-2 text-left transition-all ${ativa ? 'border-slate-900 bg-slate-900 text-white' : 'border-transparent bg-white text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${ativa ? 'bg-white/15' : 'bg-slate-100'}`}>
                                                    {tab.icon}
                                                </span>
                                                <p className="text-xs font-bold">{tab.label}</p>
                                            </div>
                                            {tab.badge ? (
                                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${ativa ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-600'}`}>
                                                    {tab.badge}
                                                </span>
                                            ) : null}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {activeTab === 'usuarios' && (
                    <section role="tabpanel" aria-labelledby="tab-usuarios" className="space-y-6">
                        <div className={`grid grid-cols-1 gap-6 ${totalPendentes > 0 ? 'xl:grid-cols-[0.95fr_1.05fr]' : ''}`}>
                            {totalPendentes > 0 && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-xl font-black text-slate-900">{totalPendentes} pendência(s)</h2>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setUserRoleFilter('aguardando');
                                                setUserSearch('');
                                            }}
                                            className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-700 transition-all hover:bg-amber-50"
                                        >
                                            Ver só pendentes
                                        </button>
                                    </div>
                                    <div className="mt-5 space-y-3">
                                        {usuariosPendentes.slice(0, 3).map((user) => (
                                            <div key={user.id} className="rounded-2xl border border-white bg-white/90 p-3.5 shadow-sm">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-800">{user.nome || 'Sem nome'}</p>
                                                        <p className="mt-1 truncate text-xs font-mono text-slate-400">{user.id}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => mudarRole(user, 'comum')}
                                                        disabled={adminActionsDisabled}
                                                        className={`rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-emerald-700 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                    >
                                                        Aprovar agora
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-xl font-black text-slate-900">Cadastrar novo usuário</h2>
                                    <button
                                        type="button"
                                        onClick={() => setCadastroAberto((prev) => !prev)}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-lg font-bold text-slate-600 transition-all hover:bg-slate-100"
                                        aria-label={cadastroAberto ? 'Recolher cadastro' : 'Abrir cadastro'}
                                    >
                                        <span aria-hidden="true">{cadastroAberto ? '−' : '+'}</span>
                                    </button>
                                </div>
                                {cadastroAberto ? (
                                    <form onSubmit={handleAdicionar} className="mt-5">
                                        <fieldset disabled={adminActionsDisabled || loadingAdd} className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${adminActionsDisabled ? 'opacity-60' : ''}`}>
                                            <div className="md:col-span-2">
                                                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Nome completo</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ex: João Silva"
                                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                                    value={novoNome}
                                                    onChange={(e) => setNovoNome(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">E-mail</label>
                                                <input
                                                    type="email"
                                                    placeholder="Ex: joao@exemplo.com"
                                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                                    value={novoEmail}
                                                    onChange={(e) => setNovoEmail(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">WhatsApp</label>
                                                <input
                                                    type="text"
                                                    placeholder="(46) 99999-9999"
                                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                                    value={novoWhats}
                                                    maxLength={15}
                                                    onChange={(e) => setNovoWhats(formatarTelefone(e.target.value))}
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <button
                                                    type="submit"
                                                    disabled={loadingAdd || adminActionsDisabled}
                                                    className={`inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                >
                                                    {loadingAdd ? 'Salvando...' : '+ Adicionar usuário'}
                                                </button>
                                            </div>
                                        </fieldset>
                                    </form>
                                ) : null}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">Lista de usuários</h2>
                                </div>
                                <div className="w-full max-w-md">
                                    <div>
                                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Buscar usuário</label>
                                        <input
                                            type="text"
                                            value={userSearch}
                                            onChange={(e) => setUserSearch(e.target.value)}
                                            placeholder="Nome, e-mail ou telefone"
                                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {[
                                    { value: 'todos', label: 'Todos' },
                                    { value: 'aguardando', label: 'Pendentes' },
                                    { value: 'comum', label: 'Dirigentes' },
                                    { value: 'admin', label: 'Admins' }
                                ].map((option) => {
                                    const ativa = userRoleFilter === option.value;

                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setUserRoleFilter(option.value)}
                                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${ativa ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-slate-600">
                                    Exibindo <span className="font-bold text-slate-800">{usuariosFiltrados.length}</span> de <span className="font-bold text-slate-800">{totalUsers}</span> usuário(s).
                                </p>
                                {(userSearch || userRoleFilter !== 'todos') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUserSearch('');
                                            setUserRoleFilter('todos');
                                        }}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-100"
                                    >
                                        Limpar filtros
                                    </button>
                                )}
                            </div>

                            <div className="mt-6 space-y-4 md:hidden">
                                {usuariosFiltrados.map((user) => (
                                    <div key={user.id} className={`rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm ${editandoId === user.id ? 'ring-2 ring-blue-100 bg-blue-50/20' : ''}`}>
                                        <div className="mb-3 flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-500">
                                                    {(user.nome || user.id || '?')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    {editandoId === user.id ? (
                                                        <input
                                                            type="text"
                                                            value={dadosEditados.nome || ''}
                                                            onChange={(e) => handleEditChange('nome', e.target.value)}
                                                            className="w-full rounded-lg border border-blue-300 bg-white px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                                            placeholder="Nome"
                                                            disabled={adminActionsDisabled}
                                                        />
                                                    ) : (
                                                        <h4 className="text-sm font-bold text-slate-800">{user.nome || 'Sem Nome'}</h4>
                                                    )}
                                                    <p className="max-w-[170px] truncate text-xs font-mono text-slate-400">{user.id}</p>
                                                </div>
                                            </div>
                                            <div>
                                                {user.role === 'admin' ? (
                                                    <span className="rounded-full border border-purple-200 bg-purple-100 px-2 py-1 text-[10px] font-bold text-purple-700">ADMIN</span>
                                                ) : user.role === 'aguardando' ? (
                                                    <span className="rounded-full border border-red-200 bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">PENDENTE</span>
                                                ) : (
                                                    <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600">DIRIGENTE</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mb-4 pl-[3.25rem]">
                                            {editandoId === user.id ? (
                                                <input
                                                    type="text"
                                                    value={dadosEditados.whatsapp || ''}
                                                    onChange={(e) => handleEditChange('whatsapp', e.target.value)}
                                                    className="w-full rounded-lg border border-blue-300 bg-white px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                                    placeholder="WhatsApp"
                                                    disabled={adminActionsDisabled}
                                                />
                                            ) : user.whatsapp ? (
                                                <a href={`https://wa.me/${user.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-green-700">
                                                    <span className="text-xs">🟢</span> {user.whatsapp}
                                                </a>
                                            ) : (
                                                <span className="text-sm italic text-slate-300">Sem WhatsApp</span>
                                            )}
                                        </div>

                                        <div className="flex gap-2 border-t border-slate-100 pt-3">
                                            {editandoId === user.id ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={salvarEdicao}
                                                        disabled={adminActionsDisabled}
                                                        className={`flex-1 rounded-xl bg-green-600 py-2 text-sm font-bold text-white ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                    >
                                                        Salvar
                                                    </button>
                                                    <button type="button" onClick={cancelarEdicao} className="flex-1 rounded-xl bg-slate-200 py-2 text-sm font-bold text-slate-700">Cancelar</button>
                                                </>
                                            ) : (
                                                <>
                                                    {user.role === 'aguardando' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => mudarRole(user, 'comum')}
                                                            disabled={adminActionsDisabled}
                                                            className={`flex-1 rounded-xl bg-green-600 py-2 text-sm font-bold text-white shadow-sm transition-transform active:scale-95 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                        >
                                                            Aprovar acesso
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => iniciarEdicao(user)}
                                                                disabled={adminActionsDisabled}
                                                                className={`flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-blue-600 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => mudarRole(user, user.role === 'admin' ? 'comum' : 'admin')}
                                                                disabled={adminActionsDisabled}
                                                                className={`flex flex-1 items-center justify-center rounded-xl border p-2 transition-colors ${user.role === 'admin' ? 'border-red-100 bg-red-50 text-red-600' : 'border-yellow-100 bg-yellow-50 text-yellow-600'} ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                            >
                                                                {user.role === 'admin' ? (
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M10 2.25a.75.75 0 0 1 .75.75v9.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V3a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                                                                        <path d="M5.5 15.25a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Z" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M10 17.75a.75.75 0 0 1-.75-.75V7.81L7.03 10.03a.75.75 0 1 1-1.06-1.06l3.5-3.5a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 1 1-1.06 1.06l-2.22-2.22V17a.75.75 0 0 1-.75.75Z" clipRule="evenodd" />
                                                                        <path d="M5.5 3.25a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Z" />
                                                                    </svg>
                                                                )}
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => remover(user.id)}
                                                        disabled={adminActionsDisabled}
                                                        className={`flex flex-1 items-center justify-center rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {usuariosFiltrados.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-400">
                                        Nenhum usuário encontrado com os filtros atuais.
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                                                <th className="px-6 py-4 font-bold">Usuário / E-mail</th>
                                                <th className="px-6 py-4 font-bold">WhatsApp</th>
                                                <th className="px-6 py-4 text-center font-bold">Permissão</th>
                                                <th className="px-6 py-4 text-right font-bold">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {usuariosFiltrados.map((user) => (
                                                <tr key={user.id} className={`transition-colors hover:bg-blue-50/30 ${editandoId === user.id ? 'bg-yellow-50' : ''}`}>
                                                    <td className="px-6 py-4">
                                                        {editandoId === user.id ? (
                                                            <div className="flex flex-col gap-1">
                                                                <input
                                                                    type="text"
                                                                    value={dadosEditados.nome || ''}
                                                                    onChange={(e) => handleEditChange('nome', e.target.value)}
                                                                    className="rounded-lg border border-blue-300 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                                                    placeholder="Nome"
                                                                    disabled={adminActionsDisabled}
                                                                />
                                                                <span className="pl-1 text-xs font-mono text-slate-400">{user.id} (fixo)</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-bold text-slate-500 shadow-sm">
                                                                    {(user.nome || user.id || '?')[0].toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-slate-800">{user.nome || 'Sem Nome'}</div>
                                                                    <div className="text-xs font-mono text-slate-400">{user.id}</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {editandoId === user.id ? (
                                                            <input
                                                                type="text"
                                                                value={dadosEditados.whatsapp || ''}
                                                                onChange={(e) => handleEditChange('whatsapp', e.target.value)}
                                                                className="w-36 rounded-lg border border-blue-300 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                                                placeholder="WhatsApp"
                                                                disabled={adminActionsDisabled}
                                                            />
                                                        ) : user.whatsapp ? (
                                                            <a href={`https://wa.me/${user.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-green-100 bg-green-50 px-2.5 py-1 text-sm font-medium text-green-700 transition-colors hover:bg-green-100">
                                                                <span className="text-xs">🟢</span> {user.whatsapp}
                                                            </a>
                                                        ) : (
                                                            <span className="text-sm italic text-slate-300">--</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {user.role === 'admin' ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">
                                                                🛡️ Admin
                                                            </span>
                                                        ) : user.role === 'aguardando' ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                                                                ⏳ Pendente
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
                                                                👤 Dirigente
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {editandoId === user.id ? (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={salvarEdicao}
                                                                        disabled={adminActionsDisabled}
                                                                        className={`rounded-lg bg-green-100 p-2 text-green-700 transition-colors hover:bg-green-200 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                                        title="Salvar"
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                                    </button>
                                                                    <button type="button" onClick={cancelarEdicao} className="rounded-lg bg-red-100 p-2 text-red-700 transition-colors hover:bg-red-200" title="Cancelar">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {user.role === 'aguardando' ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => mudarRole(user, 'comum')}
                                                                            disabled={adminActionsDisabled}
                                                                            className={`rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-green-700 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                                        >
                                                                            Aprovar
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => iniciarEdicao(user)}
                                                                            disabled={adminActionsDisabled}
                                                                            className={`rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                                            title="Editar dados"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                                                        </button>
                                                                    )}

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => mudarRole(user, user.role === 'admin' ? 'comum' : 'admin')}
                                                                        disabled={adminActionsDisabled}
                                                                        className={`rounded-lg p-2 transition-colors ${user.role === 'admin' ? 'text-purple-400 hover:bg-red-50 hover:text-red-600' : 'text-slate-400 hover:bg-yellow-50 hover:text-yellow-600'} ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                                        title={user.role === 'admin' ? 'Remover admin' : 'Promover a admin'}
                                                                    >
                                                                        {user.role === 'admin' ? (
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                                <path fillRule="evenodd" d="M10 2.25a.75.75 0 0 1 .75.75v9.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V3a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                                                                                <path d="M5.5 15.25a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Z" />
                                                                            </svg>
                                                                        ) : (
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                                <path fillRule="evenodd" d="M10 17.75a.75.75 0 0 1-.75-.75V7.81L7.03 10.03a.75.75 0 1 1-1.06-1.06l3.5-3.5a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 1 1-1.06 1.06l-2.22-2.22V17a.75.75 0 0 1-.75.75Z" clipRule="evenodd" />
                                                                                <path d="M5.5 3.25a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Z" />
                                                                            </svg>
                                                                        )}
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => remover(user.id)}
                                                                        disabled={adminActionsDisabled}
                                                                        className={`rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                                        title="Remover usuário"
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {usuariosFiltrados.length === 0 && (
                                    <div className="p-8 text-center italic text-slate-400">Nenhum usuário encontrado com os filtros atuais.</div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 'campanhas' && (
                    <section role="tabpanel" aria-labelledby="tab-campanhas" className="space-y-6">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">Campanhas</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {contextoSistema.campanhaAtiva
                                            ? `${contextoSistema.contextoAtivoTitulo} (${contextoSistema.contextoAtivoId})`
                                            : 'Pregação normal'}
                                    </p>
                                </div>
                                {contextoSistema.campanhaAtiva ? (
                                    <button
                                        type="button"
                                        onClick={voltarModoNormal}
                                        disabled={salvandoCampanha || adminActionsDisabled}
                                        className={`rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                    >
                                        Desativar campanha
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h3 className="text-lg font-black text-slate-900">Nova campanha</h3>
                            <form onSubmit={handleCriarCampanha} className="mt-4">
                                <fieldset disabled={adminActionsDisabled || salvandoCampanha} className={`grid grid-cols-1 items-end gap-3 lg:grid-cols-[1.4fr_1fr_auto] ${adminActionsDisabled ? 'opacity-60' : ''}`}>
                                    <div>
                                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Título da campanha</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Convite da Celebração"
                                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                                            value={campanhaTitulo}
                                            onChange={(e) => setCampanhaTitulo(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Identificador interno</label>
                                        <input
                                            type="text"
                                            placeholder="ex: celebracao_2026"
                                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                                            value={campanhaSlug}
                                            onChange={(e) => setCampanhaSlug(slugifyCampanha(e.target.value))}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={salvandoCampanha || adminActionsDisabled}
                                        className={`rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-violet-700 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                    >
                                        {salvandoCampanha ? 'Salvando...' : 'Ativar'}
                                    </button>
                                </fieldset>
                            </form>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                <h3 className="text-lg font-black text-slate-900">Campanhas salvas</h3>
                                <p className="text-sm text-slate-500">{campanhas.length} campanha(s)</p>
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {campanhas.length > 0 ? campanhas.map((campanha) => {
                                    const ativa = contextoSistema.contextoAtivoId === campanha.id;

                                    return (
                                        <div key={campanha.id} className={`rounded-2xl border p-3.5 ${ativa ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-slate-50'}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{campanha.titulo || campanha.id}</p>
                                                    <p className="mt-1 text-xs font-mono text-slate-400">{campanha.id}</p>
                                                </div>
                                                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${ativa ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-500'}`}>
                                                    {ativa ? 'ATIVA' : 'SALVA'}
                                                </span>
                                            </div>
                                            <div className="mt-4 grid gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => ativarCampanha({ id: campanha.id, titulo: campanha.titulo || campanha.id })}
                                                    disabled={salvandoCampanha || ativa || adminActionsDisabled}
                                                    className={`w-full rounded-xl border border-violet-200 bg-white py-2 text-sm font-bold text-violet-700 hover:bg-violet-50 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                >
                                                    {ativa ? 'Campanha atual' : 'Reativar'}
                                                </button>
                                                {ativa && (
                                                    <button
                                                        type="button"
                                                        onClick={voltarModoNormal}
                                                        disabled={salvandoCampanha || adminActionsDisabled}
                                                        className={`w-full rounded-xl bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                    >
                                                        Desativar agora
                                                    </button>
                                                )}
                                                {!ativa && (
                                                    <button
                                                        type="button"
                                                        onClick={() => abrirModalExclusaoCampanha(campanha)}
                                                        disabled={salvandoCampanha || excluindoCampanha || adminActionsDisabled}
                                                        className={`w-full rounded-xl border border-red-200 bg-white py-2 text-sm font-bold text-red-700 hover:bg-red-50 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                                    >
                                                        Excluir campanha
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-500">
                                        Nenhuma campanha cadastrada ainda.
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 'comunicados' && (
                    <section role="tabpanel" aria-labelledby="tab-comunicados" className="space-y-6">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="text-xl font-black text-slate-900">Comunicado geral</h2>
                                <span className="text-sm text-slate-500">{totalDestinoComunicado} destino(s)</span>
                            </div>

                            <form onSubmit={enviarComunicadoGeral} className="mt-4">
                                <fieldset disabled={adminActionsDisabled || enviandoComunicado} className={`space-y-5 ${adminActionsDisabled ? 'opacity-60' : ''}`}>
                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase text-slate-500">Destino</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { value: 'todos', label: `Todos os aprovados (${totalAprovados})` },
                                                { value: 'admins', label: `Somente admins (${totalAdmins})` }
                                            ].map((option) => {
                                                const ativa = destinoComunicado === option.value;

                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => setDestinoComunicado(option.value)}
                                                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${ativa ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                                    >
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Mensagem</label>
                                        <textarea
                                            rows={5}
                                            placeholder="Ex: O app foi atualizado. Fechem e abram novamente para carregar a nova versão."
                                            className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                                            value={comunicadoGeral}
                                            onChange={(e) => setComunicadoGeral(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <p className="text-sm text-slate-500">
                                            {relayDisponivel()
                                                ? 'Push e aviso interno para quem estiver habilitado.'
                                                : 'Aviso interno disponível dentro do app.'}
                                        </p>
                                        <button
                                            type="submit"
                                            disabled={enviandoComunicado || totalDestinoComunicado === 0 || adminActionsDisabled}
                                            className={`rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-amber-600 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                        >
                                            {enviandoComunicado ? 'Enviando...' : 'Enviar comunicado'}
                                        </button>
                                    </div>
                                </fieldset>
                            </form>
                        </div>
                    </section>
                )}
            

            {campanhaParaExcluir && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={fecharModalExclusaoCampanha}>
                    <div className="w-full max-w-lg rounded-2xl border border-red-100 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4 border-b border-red-100 bg-red-50 px-6 py-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-500">Exclusão definitiva</p>
                                <h3 className="mt-1 text-xl font-extrabold text-red-700">
                                    Excluir campanha "{campanhaParaExcluir.titulo || campanhaParaExcluir.id}"
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={fecharModalExclusaoCampanha}
                                disabled={excluindoCampanha}
                                className="rounded-lg px-2 py-1 text-red-400 hover:bg-white hover:text-red-600 disabled:opacity-50"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-5 px-6 py-5">
                            <p className="text-sm leading-relaxed text-gray-600">
                                Essa ação apaga a campanha cadastrada e todo o progresso salvo nela. Não existe restauração automática depois da exclusão.
                            </p>

                            <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 md:grid-cols-2">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Título</p>
                                    <p className="mt-1 font-bold text-gray-800">{campanhaParaExcluir.titulo || campanhaParaExcluir.id}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Identificador</p>
                                    <p className="mt-1 font-mono text-xs text-gray-600">{campanhaParaExcluir.id}</p>
                                </div>
                                <div className="md:col-span-2">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Registros de progresso vinculados</p>
                                    <p className="mt-1 font-bold text-gray-800">
                                        {carregandoResumoExclusao ? 'Carregando...' : `${registrosCampanhaParaExcluir} registro(s) em territorios_contexto`}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">
                                    Digite <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-700">{campanhaParaExcluir.id}</span> para confirmar
                                </label>
                                <input
                                    type="text"
                                    value={confirmacaoExclusao}
                                    onChange={(e) => setConfirmacaoExclusao(e.target.value)}
                                    placeholder="Confirme o identificador"
                                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition-all focus:border-red-400 focus:ring-2 focus:ring-red-200"
                                    disabled={excluindoCampanha || adminActionsDisabled}
                                />
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={fecharModalExclusaoCampanha}
                                    disabled={excluindoCampanha}
                                    className="rounded-lg border border-gray-300 px-4 py-2.5 font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={excluirCampanha}
                                    disabled={excluindoCampanha || carregandoResumoExclusao || confirmacaoExclusao.trim() !== campanhaParaExcluir.id || adminActionsDisabled}
                                    className={`rounded-lg bg-red-600 px-4 py-2.5 font-bold text-white hover:bg-red-700 ${ADMIN_OFFLINE_ACTION_CLASS}`}
                                >
                                    {excluindoCampanha ? 'Excluindo...' : 'Excluir definitivamente'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AppPage>
    );
};

export default AdminPanel;
