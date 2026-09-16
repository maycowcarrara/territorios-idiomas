export const toRad = (valor) => (Number(valor) * Math.PI) / 180;

export const calcularDistanciaMetros = (origem, destino) => {
    if (!origem || !destino) return 0;

    const lat1 = Number(origem.lat);
    const lng1 = Number(origem.lng);
    const lat2 = Number(destino.lat);
    const lng2 = Number(destino.lng);

    if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) {
        return 0;
    }

    const raioTerra = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(rLat1) * Math.cos(rLat2);

    return 2 * raioTerra * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const toPlainLatLng = (latlng) => {
    const lat = Number(latlng?.lat);
    const lng = Number(latlng?.lng);

    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

export const formatarDistanciaMetros = (metros) => {
    const valor = Number(metros);
    if (!Number.isFinite(valor)) return '';
    if (valor < 1000) return `${Math.round(valor)} m`;

    const quilometros = valor / 1000;
    const casas = quilometros < 10 ? 1 : 0;
    return `${quilometros.toFixed(casas).replace('.', ',')} km`;
};

export const calcularRumo = (origem, destino) => {
    if (!origem || !destino) return null;

    const lat1 = toRad(origem.lat);
    const lat2 = toRad(destino.lat);
    const deltaLng = toRad(destino.lng - origem.lng);

    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2)
        - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};
