import type { GeoPolygon } from "@/db/schema";

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6378137;

export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceKm(a: LatLng, b: LatLng): number {
  return Math.round((distanceMeters(a, b) / 1000) * 10) / 10;
}

/** Área geodésica de um anel [lng, lat] usando a fórmula de excesso esférico. */
export function ringAreaM2(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  const rad = Math.PI / 180;
  let total = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % ring.length];
    total += (lng2 - lng1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

export function ringCentroid(ring: [number, number][]): LatLng {
  if (!ring.length) return { lat: 0, lng: 0 };
  let lng = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
  }
  return { lat: lat / ring.length, lng: lng / ring.length };
}

/** Gera um polígono irregular aproximado ao redor de um ponto (dados de demonstração). */
export function ringAround(
  lat: number,
  lng: number,
  radiusM: number,
  vertices = 8,
  skew = 0.82,
): [number, number][] {
  const points: [number, number][] = [];
  const latDelta = radiusM / 111320;
  const lngDelta = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i < vertices; i += 1) {
    const angle = (i / vertices) * Math.PI * 2;
    const wobble = 0.72 + 0.28 * Math.sin(i * 2.3 + 1.7) + 0.12 * Math.cos(i * 1.1);
    points.push([
      Number((lng + Math.cos(angle) * lngDelta * wobble * skew).toFixed(6)),
      Number((lat + Math.sin(angle) * latDelta * wobble).toFixed(6)),
    ]);
  }
  points.push(points[0]);
  return points;
}

export function polygonAreaM2(polygon: GeoPolygon): number {
  return Math.round(ringAreaM2(polygon.coordinates));
}

export function polygonsTotalAreaM2(polygons: GeoPolygon[]): number {
  return polygons.reduce((sum, polygon) => sum + polygonAreaM2(polygon), 0);
}

export function polygonsCentroid(polygons: GeoPolygon[]): LatLng | null {
  const ring = polygons.find((polygon) => polygon.coordinates.length > 2)?.coordinates;
  return ring ? ringCentroid(ring) : null;
}

/** Converte um anel para o formato aceito pelo Leaflet: [lat, lng][] */
export function ringToLatLngs(ring: [number, number][]): [number, number][] {
  return ring.map(([lng, lat]) => [lat, lng]);
}

export function formatCoordinate(value: number, axis: "lat" | "lng"): string {
  const hemisphere = axis === "lat" ? (value >= 0 ? "S" : "N") : value >= 0 ? "E" : "W";
  const label = axis === "lat" && value < 0 ? "S" : axis === "lng" && value < 0 ? "W" : hemisphere;
  return `${Math.abs(value).toFixed(5)}° ${label}`;
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
