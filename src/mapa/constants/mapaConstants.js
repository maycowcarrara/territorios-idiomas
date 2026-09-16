export const getEnvNumber = (key, fallback) => {
    const value = Number.parseFloat(import.meta.env[key]);
    return Number.isFinite(value) ? value : fallback;
};

export const MAP_INITIAL_CENTER = [
    getEnvNumber('VITE_MAP_CENTER_LAT', -26.485),
    getEnvNumber('VITE_MAP_CENTER_LNG', -51.995)
];

export const MAP_INITIAL_ZOOM = getEnvNumber('VITE_MAP_INITIAL_ZOOM', 14);

export const ADMIN_OFFLINE_MESSAGE = 'Você está offline. Ações administrativas precisam de conexão para evitar conflito de designações. Conecte-se para continuar.';

export const MAPA_VISUALIZACAO = Object.freeze({
    TERRITORIOS: 'territorios',
    ENDERECOS: 'enderecos'
});
