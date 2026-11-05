import { ringAreaM2 } from "@/lib/geo";

/**
 * INTERSEÇÃO DE POLÍGONOS — cálculo de perda DENTRO da demarcação do KMZ
 * ------------------------------------------------------------------
 * Uma restrição (APP, linhão, nascente…) pode ser desenhada ultrapassando o
 * perímetro do imóvel. Só a parcela que cai DENTRO do KMZ representa perda real.
 *
 * Estratégia:
 *  1) polígono convexo → recorte exato por Sutherland–Hodgman;
 *  2) polígono côncavo → integração determinística por grade fina (amostragem
 *     regular sobre a caixa comum), com precisão típica melhor que 0,2%.
 */

type Pt = { x: number; y: number };
export type Ring2D = [number, number][]; // [lng, lat]

const toLocal = (ring: Ring2D): Pt[] => {
  if (!ring.length) return [];
  const lat0 = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
  const m = 111320;
  const mx = m * Math.cos((lat0 * Math.PI) / 180);
  return ring.map(([lng, lat]) => ({ x: lng * mx, y: lat * m }));
};

const signedArea = (ring: Pt[]): number => {
  let total = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    total += current.x * next.y - next.x * current.y;
  }
  return total / 2;
};

const ensureClosed = (ring: Ring2D): Ring2D => {
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
};

const isConvex = (ring: Pt[]): boolean => {
  if (ring.length < 3) return false;
  let sign = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    const c = ring[(index + 2) % ring.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) continue;
    const current = Math.sign(cross);
    if (sign === 0) sign = current;
    else if (sign !== current) return false;
  }
  return true;
};

const lineIntersection = (s: Pt, e: Pt, a: Pt, b: Pt): Pt => {
  const r = { x: e.x - s.x, y: e.y - s.y };
  const q = { x: b.x - a.x, y: b.y - a.y };
  const denominator = r.x * q.y - r.y * q.x;
  if (Math.abs(denominator) < 1e-12) return { x: e.x, y: e.y };
  const t = ((a.x - s.x) * q.y - (a.y - s.y) * q.x) / denominator;
  return { x: s.x + r.x * t, y: s.y + r.y * t };
};

/** Sutherland–Hodgman: recorta `subject` por um `clip` convexo. */
function clipByConvex(subject: Pt[], clip: Pt[]): Pt[] {
  let output = subject;
  const orientation = Math.sign(signedArea(clip)) || 1;

  for (let index = 0; index < clip.length; index += 1) {
    const a = clip[index];
    const b = clip[(index + 1) % clip.length];
    const input = output;
    output = [];
    if (!input.length) break;

    const inside = (point: Pt) =>
      ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)) * orientation >= -1e-9;

    let previous = input[input.length - 1];
    for (const current of input) {
      const currentInside = inside(current);
      const previousInside = inside(previous);
      if (currentInside) {
        if (!previousInside) output.push(lineIntersection(previous, current, a, b));
        output.push(current);
      } else if (previousInside) {
        output.push(lineIntersection(previous, current, a, b));
      }
      previous = current;
    }
  }

  return output;
}

const pointInRing = (point: Pt, ring: Pt[]): boolean => {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const a = ring[index];
    const b = ring[previous];
    if (a.y > point.y !== b.y > point.y) {
      const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-15) + a.x;
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
};

/** Área de interseção por grade regular (fallback para polígonos côncavos). */
function areaByGrid(subject: Pt[], clip: Pt[]): number {
  const all = [...subject, ...clip];
  const minX = Math.min(...all.map((point) => point.x));
  const maxX = Math.max(...all.map((point) => point.x));
  const minY = Math.min(...all.map((point) => point.y));
  const maxY = Math.max(...all.map((point) => point.y));
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0 || height <= 0) return 0;

  const target = 420; // amostras no eixo maior
  const step = Math.max(width, height) / target;
  const columns = Math.max(1, Math.round(width / step));
  const rows = Math.max(1, Math.round(height / step));
  const cellWidth = width / columns;
  const cellHeight = height / rows;

  let hits = 0;
  for (let row = 0; row < rows; row += 1) {
    const y = minY + (row + 0.5) * cellHeight;
    for (let column = 0; column < columns; column += 1) {
      const x = minX + (column + 0.5) * cellWidth;
      const point = { x, y };
      if (pointInRing(point, subject) && pointInRing(point, clip)) hits += 1;
    }
  }
  return hits * cellWidth * cellHeight;
}

export type IntersectionResult = {
  /** área que realmente está dentro da demarcação (m²) */
  insideM2: number;
  /** área total do desenho, incluindo trechos fora (m²) */
  grossM2: number;
  /** parcela desenhada fora do KMZ (m²) — desconsiderada na perda */
  outsideM2: number;
  /** área da demarcação do KMZ usada como denominador (m²) */
  kmzAreaM2: number;
  /** perda percentual em relação ao KMZ */
  lossPct: number;
  /** percentual do desenho que ficou fora */
  outsidePct: number;
  method: "exato" | "grade";
};

/**
 * Calcula a perda de área de uma restrição restrita à demarcação do KMZ.
 */
export function intersectionWithKmz(restriction: Ring2D, kmzRings: Ring2D[]): IntersectionResult {
  const subjectRing = ensureClosed(restriction);
  const grossM2 = Math.round(ringAreaM2(subjectRing as Ring2D));

  const clipRings = kmzRings
    .filter((ring) => ring.length >= 4)
    .map((ring) => ensureClosed(ring))
    .sort((a, b) => ringAreaM2(b) - ringAreaM2(a));
  const kmzRing = clipRings[0] ?? [];
  const kmzAreaM2 = kmzRing.length ? Math.round(ringAreaM2(kmzRing)) : 0;

  if (!kmzRing.length || grossM2 <= 0) {
    return {
      insideM2: 0,
      grossM2,
      outsideM2: grossM2,
      kmzAreaM2,
      lossPct: 0,
      outsidePct: 100,
      method: "exato",
    };
  }

  const subjectLocal = toLocal(subjectRing);
  const clipLocal = toLocal(kmzRing);
  let insideM2 = 0;
  let method: IntersectionResult["method"] = "exato";

  if (isConvex(clipLocal)) {
    const clipped = clipByConvex(subjectLocal, clipLocal);
    insideM2 = clipped.length >= 3 ? Math.round(Math.abs(signedArea(clipped))) : 0;
  } else {
    insideM2 = Math.round(areaByGrid(subjectLocal, clipLocal));
    method = "grade";
  }

  // segurança: nunca exceder a área do próprio desenho nem do KMZ
  insideM2 = Math.max(0, Math.min(insideM2, grossM2, kmzAreaM2));
  const outsideM2 = Math.max(0, grossM2 - insideM2);
  const lossPct = kmzAreaM2 > 0 ? Number(((insideM2 / kmzAreaM2) * 100).toFixed(2)) : 0;

  return {
    insideM2,
    grossM2,
    outsideM2,
    kmzAreaM2,
    lossPct,
    outsidePct: grossM2 > 0 ? Number(((outsideM2 / grossM2) * 100).toFixed(1)) : 0,
    method,
  };
}
