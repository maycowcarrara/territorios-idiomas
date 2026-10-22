export function getCoordenadasEndereco(endereco) {
  let lat = endereco?.lat;
  let lng = endereco?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") {
    try {
      const url = new URL(endereco?.mapsUrl);
      if (url.protocol !== "https:" || url.hostname !== "www.google.com")
        return null;
      const query = url.searchParams.get("query") || "";
      const match = query.match(
        /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/,
      );
      if (!match) return null;
      lat = Number(match[1]);
      lng = Number(match[2]);
    } catch {
      return null;
    }
  }
  return Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
    ? [lat, lng]
    : null;
}

export function getNavegacaoEndereco(endereco) {
  const coordenadas = getCoordenadasEndereco(endereco);
  return coordenadas
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coordenadas.join(","))}`
    : endereco.mapsUrl;
}
