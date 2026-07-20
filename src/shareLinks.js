import { buildPublicAppRouteUrl } from './publicAppUrl';

const formatCoordinate = (value) => {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number.toFixed(6) : '';
};

const buildCoordinateQuery = (lat, lng) => {
    const formattedLat = formatCoordinate(lat);
    const formattedLng = formatCoordinate(lng);
    return formattedLat && formattedLng ? `${formattedLat},${formattedLng}` : '';
};

export const buildGoogleMapsUrl = (lat, lng) => {
    const query = buildCoordinateQuery(lat, lng);
    return query
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
        : '';
};

export const buildGoogleMapsDirectionsUrl = (lat, lng) => {
    const destination = buildCoordinateQuery(lat, lng);
    return destination
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`
        : '';
};

export const buildAppLocationUrl = (lat, lng, z = 16) =>
    buildPublicAppRouteUrl('/app', { lat, lng, z });

export const buildWhatsAppShareUrl = (text, whatsapp) => {
    const phone = String(whatsapp || '').replace(/\D/g, '');
    const baseUrl = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
    return `${baseUrl}?text=${encodeURIComponent(text)}`;
};

export const buildLocationShareText = ({ title, territoryName, appUrl, mapsUrl, extraLine }) => {
    const lines = [`*${title}*`];

    if (territoryName) {
        lines.push(`Território: *${territoryName}*`);
    }

    if (extraLine) {
        lines.push(extraLine);
    }

    if (appUrl) {
        lines.push('', `Abrir no app: ${appUrl}`);
    }

    if (mapsUrl) {
        lines.push('', `Google Maps: ${mapsUrl}`);
    }

    return lines.join('\n');
};
