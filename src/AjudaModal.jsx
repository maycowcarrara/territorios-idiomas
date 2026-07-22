import React, { useEffect, useMemo, useState } from 'react';
import { ModalFrame } from './uiPrimitives';
import { buttonClass } from './uiClasses';

const TABS_BASE = [
    { id: 'primeiros-passos', label: 'Primeiros passos' },
    { id: 'publicador', label: 'Publicador' },
    { id: 'admin', label: 'Admin' },
    { id: 'online', label: 'Conexão' },
    { id: 'ferramentas', label: 'Ferramentas' },
    { id: 'documentos', label: 'Documentos' }
];

const PUBLICADOR_OVERVIEW_STEPS = [
    {
        title: 'Abra seus territórios',
        description: 'Use "Meus" para ver os territórios designados para você, conferir o progresso e entrar direto no mapa do grupo.'
    },
    {
        title: 'Veja os endereços do grupo',
        description: 'Abra o território T e use "Lista" ou "Ver no mapa" para consultar somente os endereços daquele trabalho.'
    },
    {
        title: 'Pregue e marque o progresso',
        description: 'Em cada endereço, use "Navegar" quando precisar de rota e marque como pregado depois da visita.'
    },
    {
        title: 'Finalize quando completar',
        description: 'Quando todos os endereços ativos estiverem pregados, finalize o território para avisar que o trabalho terminou.'
    }
];

const ADMIN_OVERVIEW_STEPS = [
    {
        title: 'Cadastre os endereços',
        description: 'No mapa, toque ou clique em um ponto vazio e use "Cadastrar endereço". O app gera o código E automaticamente e salva endereço, quantidade de pessoas e observações.'
    },
    {
        title: 'Forme territórios de idioma',
        description: 'Um território é um grupo de endereços próximos. Cadastre já em um território, crie um novo ou selecione endereços sem território e toque em "Vincular território".'
    },
    {
        title: 'Designe para um publicador',
        description: 'Abra o marcador T, escolha um publicador aprovado ou use "Enviar para nova pessoa". Depois envie a mensagem pronta pelo WhatsApp ou compartilhe o link.'
    },
    {
        title: 'Acompanhe a pregação',
        description: 'O publicador abre "Meus Territórios", entra no mapa do grupo, marca cada endereço como pregado e finaliza quando todos estiverem concluídos.'
    }
];

const ADDRESS_STATUS = [
    { label: 'E ativo', colors: 'bg-teal-500 border-teal-700', description: 'Endereço individual disponível para agrupamento.' },
    { label: 'E agrupado', colors: 'bg-indigo-500 border-indigo-700', description: 'Endereço já ligado a um território T.' },
    { label: 'E selecionado', colors: 'bg-amber-400 border-amber-600', description: 'Endereço escolhido para criar ou alimentar um território.' },
    { label: 'E pregado', colors: 'bg-emerald-500 border-emerald-700', description: 'Endereço marcado como feito durante a execução.' }
];

const TERRITORY_STATUS = [
    { label: 'Ativo', description: 'Território disponível para designação.' },
    { label: 'Designado', description: 'Território em andamento com responsável.' },
    { label: 'Finalizado', description: 'Todos os endereços foram marcados como pregados.' },
    { label: 'Arquivado', description: 'Oculto do mapa padrão, sem apagar o histórico.' }
];

const PUBLICADOR_STEPS = [
    {
        title: 'Achar o território',
        description: 'Use "Meus" no topo. A lista mostra as designações em ordem, com progresso e o botão "Ir para o Mapa".'
    },
    {
        title: 'Abrir lista ou foco no mapa',
        description: 'No marcador do território, use "Lista" para ver os endereços ou "Ver no mapa" para focar somente naquele grupo.'
    },
    {
        title: 'Pregar endereço por endereço',
        description: 'Abra o endereço, toque em "Navegar" se precisar de rota e use "Marcar pregado". Se marcou errado, use "Desmarcar".'
    },
    {
        title: 'Finalizar',
        description: 'Quando todos os endereços ativos estiverem pregados, o botão "Finalizar território" fica disponível.'
    }
];

const ADMIN_STEPS = [
    {
        title: 'Cadastrar endereço',
        description: 'Toque em área vazia do mapa, informe endereço, quantidade de pessoas e observação. No cadastro, você pode deixar sem território, criar um novo ou vincular a um existente.'
    },
    {
        title: 'Selecionar e vincular',
        description: 'No menu "..." de um endereço sem território, use "Selecionar para território". Depois toque em "Vincular território" para criar um T ou adicionar a um T existente.'
    },
    {
        title: 'Administrar território',
        description: 'No marcador T, veja total de endereços, pessoas, progresso, lista, foco no mapa, designação, devolução, compartilhamento e arquivamento.'
    },
    {
        title: 'Manter a base limpa',
        description: 'Use arquivar/reativar para endereços e territórios. Arquivar oculta do mapa padrão, mas preserva dados e histórico.'
    }
];

const TOOL_ITEMS = [
    {
        badge: <div className="bg-blue-100 p-1.5 rounded text-blue-600 mt-0.5 font-bold text-xs w-7 h-7 flex items-center justify-center">Meus</div>,
        title: 'Achar territórios designados',
        description: 'Mostra os territórios que estão com você, o progresso de cada um e o atalho para abrir o mapa no grupo correto.'
    },
    {
        badge: (
            <div className="bg-teal-100 p-1.5 rounded text-teal-600 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
            </div>
        ),
        title: 'GPS e navegação',
        description: 'O GPS centraliza sua posição. Em um endereço, "Navegar" abre a rota para chegar ao ponto cadastrado.'
    },
    {
        badge: <div className="bg-indigo-100 p-1.5 rounded text-indigo-600 mt-0.5 font-bold text-xs w-7 h-7 flex items-center justify-center">T</div>,
        title: 'Foco no território',
        description: 'Em um marcador T, "Ver no mapa" destaca somente os endereços daquele território e mostra o progresso no topo.'
    }
];

const DOCUMENT_LINKS = [
    { href: '/privacy-policy.html', label: 'Política de Privacidade' },
    { href: '/terms-of-use.html', label: 'Termos de Uso' },
    { href: '/account-deletion.html', label: 'Exclusão de Conta' },
    { href: '/data-deletion-request.html', label: 'Exclusão de Dados' }
];

function TabButton({ active, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors ${
                active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-200 hover:text-blue-700'
            }`}
        >
            {label}
        </button>
    );
}

function InfoCard({ tone = 'gray', title, description, children }) {
    const tones = {
        blue: 'bg-blue-50 border-blue-200',
        violet: 'bg-violet-50 border-violet-200',
        amber: 'bg-amber-50 border-amber-200',
        gray: 'bg-gray-50 border-gray-200',
        sky: 'bg-sky-50 border-sky-200'
    };

    return (
        <section className={`rounded-xl border p-3 sm:p-4 ${tones[tone] || tones.gray}`}>
            <h4 className="text-sm font-bold text-gray-900">{title}</h4>
            {description ? <p className="mt-1 text-sm text-gray-700">{description}</p> : null}
            {children ? <div className="mt-3">{children}</div> : null}
        </section>
    );
}

const AjudaModal = ({ isOpen, onClose, isAdmin = false }) => {
    const tabs = useMemo(() => (
        isAdmin ? TABS_BASE : TABS_BASE.filter((tab) => tab.id !== 'admin')
    ), [isAdmin]);
    const overviewSteps = isAdmin ? ADMIN_OVERVIEW_STEPS : PUBLICADOR_OVERVIEW_STEPS;
    const addressStatusItems = isAdmin
        ? ADDRESS_STATUS
        : ADDRESS_STATUS.filter((status) => status.label !== 'E selecionado');
    const [activeTab, setActiveTab] = useState(tabs[0].id);

    useEffect(() => {
        if (!tabs.some((tab) => tab.id === activeTab)) {
            setActiveTab(tabs[0].id);
        }
    }, [activeTab, tabs]);

    if (!isOpen) return null;

    return (
        <ModalFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Como usar o mapa"
            subtitle="Fluxo atual do Territórios Idiomas: endereços cadastrados, agrupados em territórios e designados para pregação."
            size="lg"
            accentClass="bg-blue-600"
            bodyClassName="flex min-h-0 flex-col overflow-hidden p-0"
            titleIcon={(
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )}
            footer={(
                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className={buttonClass('primary', 'px-6')}
                    >
                        Entendi, vamos lá!
                    </button>
                </div>
            )}
        >
                <div className="border-b border-gray-100 bg-gray-50 px-3 py-2.5 shrink-0">
                    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {tabs.map((tab) => (
                            <TabButton
                                key={tab.id}
                                label={tab.label}
                                active={activeTab === tab.id}
                                onClick={() => setActiveTab(tab.id)}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                    {activeTab === 'primeiros-passos' ? (
                        <div className="space-y-4">
                            <InfoCard
                                tone="blue"
                                title="Fluxo do Idiomas"
                                description={
                                    isAdmin
                                        ? 'A base operacional é o que foi cadastrado no Firestore. Endereço é E; território de idioma é T.'
                                        : 'Para o publicador, o essencial é abrir o território designado, visitar os endereços e marcar o progresso.'
                                }
                            >
                                <div className="space-y-2.5">
                                    {overviewSteps.map((step, index) => (
                                        <div key={step.title} className="flex items-start gap-3 rounded-xl bg-white p-3 border border-blue-100 shadow-sm">
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{step.title}</p>
                                                <p className="mt-0.5 text-sm text-gray-600">{step.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </InfoCard>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <InfoCard
                                    tone="violet"
                                    title="Endereço"
                                    description={
                                        isAdmin
                                            ? 'Cada casa ou local visitável recebe um código E automático, como E-1, com endereço, quantidade de pessoas e observação.'
                                            : 'Cada ponto visitável aparece com código E, endereço, quantidade de pessoas e observação quando houver.'
                                    }
                                />

                                <InfoCard
                                    title="Território"
                                    description={
                                        isAdmin
                                            ? 'O território T é o grupo designável ao publicador. Ele reúne endereços próximos e calcula progresso por endereços pregados.'
                                            : 'O território T é o grupo de endereços que foi designado para você trabalhar.'
                                    }
                                >
                                    <p className="text-xs font-semibold text-gray-600">
                                        Códigos salvos como T-001 aparecem na tela de forma curta, como T-1.
                                    </p>
                                </InfoCard>
                            </div>

                            <InfoCard
                                tone="sky"
                                title="Marcadores do mapa"
                                description="As cores ajudam a entender o estado dos endereços durante cadastro, agrupamento e execução."
                            >
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {addressStatusItems.map((status) => (
                                        <div key={status.label} className="rounded-xl border border-sky-100 bg-white p-3 shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <div className={`h-4 w-4 rounded-full border ${status.colors}`}></div>
                                                <p className="text-sm font-bold text-gray-900">{status.label}</p>
                                            </div>
                                            <p className="mt-1 text-xs font-medium text-gray-600">{status.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </InfoCard>

                            <InfoCard
                                tone="amber"
                                title="Status dos territórios"
                                description="O marcador T também mostra em que ponto o território está."
                            >
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {TERRITORY_STATUS.map((status) => (
                                        <div key={status.label} className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm">
                                            <p className="text-sm font-bold text-gray-900">{status.label}</p>
                                            <p className="mt-1 text-xs font-medium text-gray-600">{status.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </InfoCard>
                        </div>
                    ) : null}

                    {activeTab === 'publicador' ? (
                        <div className="space-y-4">
                            <InfoCard
                                tone="blue"
                                title="Como trabalhar um território"
                                description="Use este fluxo quando um território T estiver designado para você."
                            >
                                <div className="space-y-2.5">
                                    {PUBLICADOR_STEPS.map((step, index) => (
                                        <div key={step.title} className="flex items-start gap-3 rounded-xl bg-white p-3 border border-blue-100 shadow-sm">
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{step.title}</p>
                                                <p className="mt-0.5 text-sm text-gray-600">{step.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </InfoCard>

                            <div className="grid gap-4 md:grid-cols-2">
                                <InfoCard
                                    tone="sky"
                                    title="O que aparece no endereço"
                                    description="O popup mostra código E, endereço, quantidade de pessoas cadastradas, observação, navegação e compartilhamento."
                                />

                                <InfoCard
                                    tone="amber"
                                    title="Precisa de internet"
                                    description="A marcação de endereços e a finalização do território de idioma são online-first neste momento."
                                >
                                    <p className="text-sm text-gray-700">
                                        Se a conexão falhar, aguarde voltar antes de marcar progresso para evitar conflito de designação.
                                    </p>
                                </InfoCard>
                            </div>
                        </div>
                    ) : null}

                    {activeTab === 'admin' ? (
                        <div className="space-y-4">
                            <InfoCard
                                tone="violet"
                                title="Rotina administrativa"
                                description="Essas ações precisam de conexão e ficam bloqueadas quando o app está offline."
                            >
                                <div className="space-y-2.5">
                                    {ADMIN_STEPS.map((step, index) => (
                                        <div key={step.title} className="flex items-start gap-3 rounded-xl bg-white p-3 border border-violet-100 shadow-sm">
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{step.title}</p>
                                                <p className="mt-0.5 text-sm text-gray-600">{step.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </InfoCard>

                            <div className="grid gap-4 md:grid-cols-2">
                                <InfoCard
                                    title="Enviar para nova pessoa"
                                    description="Se o publicador ainda não está na lista, informe nome, e-mail e WhatsApp. O app libera o acesso e prepara a mensagem de envio."
                                />

                                <InfoCard
                                    tone="sky"
                                    title="Informações gerais"
                                    description="O botão de informações no header do admin mostra totais ativos de territórios, endereços e pessoas, além de separados para finalizados e arquivados."
                                />
                            </div>
                        </div>
                    ) : null}

                    {activeTab === 'online' ? (
                        <div className="space-y-4">
                            <InfoCard
                                tone="amber"
                                title="Fluxo de endereços é online-first"
                                description={
                                    isAdmin
                                        ? 'Cadastro, edição, arquivamento, agrupamento, designação, marcação de pregado e finalização de territórios T dependem de conexão.'
                                        : 'Marcação de pregado e finalização de territórios T dependem de conexão.'
                                }
                            >
                                <div className="space-y-2 text-sm text-gray-700">
                                    <p>Isso evita que uma designação antiga sobrescreva outra mudança feita enquanto alguém estava sem internet.</p>
                                    <p>Se alguma ação administrativa estiver desativada, verifique a conexão antes de tentar novamente.</p>
                                </div>
                            </InfoCard>

                            <div className="grid gap-4 md:grid-cols-2">
                                <InfoCard
                                    title="Mapas Offline"
                                    description="A tela ainda existe para o fluxo legado de territórios por quadras, mas o progresso dos territórios de idioma ainda não tem sincronização offline robusta."
                                />

                                <InfoCard
                                    tone="blue"
                                    title="Dados do Idiomas"
                                    description="O app não usa mais mapa JSON como base inicial. O que aparece em Idiomas vem dos endereços e territórios cadastrados no Firestore."
                                />
                            </div>

                            <InfoCard
                                tone="gray"
                                title="Quando algo não aparecer"
                                description="Confirme se o usuário está aprovado, se o território está ativo e se o link abre a conta correta. Territórios arquivados ficam ocultos no mapa padrão."
                            />
                        </div>
                    ) : null}

                    {activeTab === 'ferramentas' ? (
                        <div className="space-y-4">
                            <InfoCard
                                title="Atalhos úteis"
                                description="Esses botões aceleram bastante o uso do mapa no dia a dia."
                            >
                                <div className="space-y-4">
                                    {TOOL_ITEMS.map((item) => (
                                        <div key={item.title} className="flex gap-3 items-start rounded-xl bg-white p-3 border border-gray-100 shadow-sm">
                                            {item.badge}
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{item.title}</p>
                                                <p className="text-sm text-gray-600">{item.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </InfoCard>

                            <div className="grid gap-4 md:grid-cols-2">
                                <InfoCard
                                    tone="sky"
                                    title="Camadas"
                                    description={
                                        isAdmin
                                            ? 'Alterne mapa padrão, Google ou satélite. O admin também pode mostrar/ocultar bairros, referências e condomínios quando disponíveis.'
                                            : 'Alterne mapa padrão, Google ou satélite para facilitar a leitura das ruas e pontos.'
                                    }
                                />

                                <InfoCard
                                    tone="violet"
                                    title="Compartilhar"
                                    description="Endereços, territórios e pontos clicados podem gerar link de localização para WhatsApp ou compartilhamento do aparelho."
                                />
                            </div>
                        </div>
                    ) : null}

                    {activeTab === 'documentos' ? (
                        <div className="space-y-4">
                            <InfoCard
                                tone="gray"
                                title="Documentos públicos do app"
                                description="Se precisar consultar regras, privacidade ou exclusão de dados, os links ficam aqui."
                            >
                                <div className="flex flex-wrap gap-3 text-sm font-semibold">
                                    {DOCUMENT_LINKS.map((link) => (
                                        <a
                                            key={link.href}
                                            href={link.href}
                                            className="rounded-full border border-blue-200 bg-white px-4 py-2 text-blue-700 hover:border-blue-300 hover:text-blue-800"
                                        >
                                            {link.label}
                                        </a>
                                    ))}
                                </div>
                            </InfoCard>
                        </div>
                    ) : null}
                </div>

        </ModalFrame>
    );
};

export default AjudaModal;
