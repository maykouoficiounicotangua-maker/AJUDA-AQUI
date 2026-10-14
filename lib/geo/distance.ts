/**
 * Distância geográfica simples (Haversine). Sem API externa.
 * Futuro: trocar por PostGIS (ST_DWithin) mantendo a mesma assinatura.
 */
const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export interface Coords {
  lat: number;
  lng: number;
}

export function haversineKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Arredonda para ~1 km: único formato de coordenada permitido em dados públicos. */
export function toPublicCoords(c: Coords): Coords {
  return { lat: Math.round(c.lat * 100) / 100, lng: Math.round(c.lng * 100) / 100 };
}

/** Texto aproximado para exibir; nunca revela precisão maior que 1 km. */
export function formatApproxDistance(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return "menos de 1 km";
  if (km < 10) return `cerca de ${Math.round(km)} km`;
  if (km < 100) return `cerca de ${Math.round(km / 5) * 5} km`;
  return "mais de 100 km";
}
