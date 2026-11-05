import type { ContourFeature } from "@/db/schema";

export type Ring = [number, number][];

const round9 = (value: number) => Math.round(value * 1e9) / 1e9;


/**
 * MOTOR GEOMÉTRICO DE CURVAS DE NÍVEL (isomorfismo servidor × navegador)
 * ------------------------------------------------------------------
 * Marching squares + recorte exato no polígono. Roda no servidor (primeira
 * geração) e no NAVEGADOR, permitindo redesenhar as curvas instantaneamente
 * quando a equidistância ou o entorno mudam — sem recalcular a análise.
 */

export function pointInRing(lat: number, lng: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [lngI, latI] = ring[i];
    const [lngJ, latJ] = ring[j];
    if (latI > lat !== latJ > lat && lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI || 1e-15) + lngI) {
      inside = !inside;
    }
  }
  return inside;
}

export function segmentIntersection(
  a1: [number, number],
  a2: [number, number],
  b1: [number, number],
  b2: [number, number],
): number | null {
  const rx = a2[0] - a1[0];
  const ry = a2[1] - a1[1];
  const sx = b2[0] - b1[0];
  const sy = b2[1] - b1[1];
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-15) return null;
  const qpx = b1[0] - a1[0];
  const qpy = b1[1] - a1[1];
  const t = (qpx * sy - qpy * sx) / denominator;
  const u = (qpx * ry - qpy * rx) / denominator;
  if (t < -1e-12 || t > 1 + 1e-12 || u < -1e-12 || u > 1 + 1e-12) return null;
  return Math.max(0, Math.min(1, t));
}

export function contourChains(grid: number[][], level: number, bounds: Bounds): Ring[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (rows < 2 || cols < 2) return [];

  const latAt = (row: number) => bounds.north - ((bounds.north - bounds.south) * row) / (rows - 1);
  const lngAt = (col: number) => bounds.west + ((bounds.east - bounds.west) * col) / (cols - 1);

  type Segment = { a: [number, number]; b: [number, number] };
  const segments: Segment[] = [];

  const interp = (v1: number, v2: number, p1: [number, number], p2: [number, number]): [number, number] => {
    const denominator = v2 - v1;
    const t = Math.abs(denominator) < 1e-12 ? 0.5 : (level - v1) / denominator;
    const clamped = Math.max(0, Math.min(1, t));
    return [
      round9(p1[0] + (p2[0] - p1[0]) * clamped),
      round9(p1[1] + (p2[1] - p1[1]) * clamped),
    ];
  };

  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      const v00 = grid[row][col];
      const v01 = grid[row][col + 1];
      const v11 = grid[row + 1][col + 1];
      const v10 = grid[row + 1][col];
      if (![v00, v01, v11, v10].every(Number.isFinite)) continue;
      const lowest = Math.min(v00, v01, v11, v10);
      const highest = Math.max(v00, v01, v11, v10);
      if (level < lowest || level > highest) continue;

      const p00: [number, number] = [round9(lngAt(col)), round9(latAt(row))];
      const p01: [number, number] = [round9(lngAt(col + 1)), round9(latAt(row))];
      const p11: [number, number] = [round9(lngAt(col + 1)), round9(latAt(row + 1))];
      const p10: [number, number] = [round9(lngAt(col)), round9(latAt(row + 1))];

      const crossings: [number, number][] = [];
      if ((v00 < level && v01 >= level) || (v00 >= level && v01 < level)) crossings.push(interp(v00, v01, p00, p01));
      if ((v01 < level && v11 >= level) || (v01 >= level && v11 < level)) crossings.push(interp(v01, v11, p01, p11));
      if ((v11 < level && v10 >= level) || (v11 >= level && v10 < level)) crossings.push(interp(v11, v10, p11, p10));
      if ((v10 < level && v00 >= level) || (v10 >= level && v00 < level)) crossings.push(interp(v10, v00, p10, p00));

      if (crossings.length === 2) {
        segments.push({ a: crossings[0], b: crossings[1] });
      } else if (crossings.length === 4) {
        // caso ambíguo (sela): resolve pela média dos cantos
        const center = (v00 + v01 + v11 + v10) / 4;
        if (center >= level) {
          segments.push({ a: crossings[0], b: crossings[1] });
          segments.push({ a: crossings[2], b: crossings[3] });
        } else {
          segments.push({ a: crossings[0], b: crossings[3] });
          segments.push({ a: crossings[1], b: crossings[2] });
        }
      }
    }
  }

  // encadeamento por coordenadas idênticas (arredondadas) — sem prender segmentos isolados
  const key = (point: [number, number]) => `${point[0].toFixed(9)},${point[1].toFixed(9)}`;
  const byStart = new Map<string, number[]>();
  segments.forEach((segment, index) => {
    const k = key(segment.a);
    const list = byStart.get(k) ?? [];
    list.push(index);
    byStart.set(k, list);
  });

  const used = new Array(segments.length).fill(false);
  const chains: Ring[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    if (used[index]) continue;
    used[index] = true;
    const chain: Ring = [segments[index].a, segments[index].b];
    let extended = true;
    while (extended) {
      extended = false;
      const tail = chain[chain.length - 1];
      const candidates = byStart.get(key(tail)) ?? [];
      for (const candidate of candidates) {
        if (used[candidate]) continue;
        used[candidate] = true;
        chain.push(segments[candidate].b);
        extended = true;
        break;
      }
    }
    if (chain.length >= 2) chains.push(chain);
  }

  return chains;
}

export function clipChain(chain: Ring, ring: Ring): { inside: Ring[]; outside: Ring[] } {
  const inside: Ring[] = [];
  const outside: Ring[] = [];
  let currentIn: Ring = [];
  let currentOut: Ring = [];

  const flush = () => {
    if (currentIn.length >= 2) inside.push(currentIn);
    if (currentOut.length >= 2) outside.push(currentOut);
    currentIn = [];
    currentOut = [];
  };

  const pushPoint = (point: [number, number], isInside: boolean) => {
    if (isInside) {
      if (currentOut.length >= 2) outside.push(currentOut);
      if (currentOut.length === 1) outside.push([...currentOut, point]);
      currentOut = [];
      currentIn.push(point);
    } else {
      if (currentIn.length >= 2) inside.push(currentIn);
      if (currentIn.length === 1) inside.push([...currentIn, point]);
      currentIn = [];
      currentOut.push(point);
    }
  };

  for (let index = 0; index < chain.length - 1; index += 1) {
    const start = chain[index];
    const end = chain[index + 1];
    const ts: number[] = [0, 1];
    for (let edge = 0; edge < ring.length - 1; edge += 1) {
      const t = segmentIntersection(start, end, ring[edge], ring[edge + 1]);
      if (t !== null && t > 1e-9 && t < 1 - 1e-9) ts.push(t);
    }
    ts.sort((a, b) => a - b);

    for (let k = 0; k < ts.length - 1; k += 1) {
      const t0 = ts[k];
      const t1 = ts[k + 1];
      if (t1 - t0 < 1e-12) continue;
      const p0: [number, number] = [
        round9(start[0] + (end[0] - start[0]) * t0),
        round9(start[1] + (end[1] - start[1]) * t0),
      ];
      const p1: [number, number] = [
        round9(start[0] + (end[0] - start[0]) * t1),
        round9(start[1] + (end[1] - start[1]) * t1),
      ];
      const midLat = (p0[1] + p1[1]) / 2;
      const midLng = (p0[0] + p1[0]) / 2;
      const isInside = pointInRing(midLat, midLng, ring);
      pushPoint(p0, isInside);
      pushPoint(p1, isInside);
    }
  }
  flush();

  return {
    inside: inside.filter((run) => run.length >= 2),
    outside: outside.filter((run) => run.length >= 2),
  };
}

export type Bounds = { north: number; south: number; east: number; west: number };

export type ContourBuildOptions = {
  grid: number[][];
  bounds: Bounds;
  boundary: [number, number][];
  interval: number;
  indexInterval: number;
  minElevation: number;
  maxElevation: number;
};

/** Gera as curvas de nível recortadas em "dentro do KMZ" e "entorno". */
export function buildContours(options: ContourBuildOptions): ContourFeature[] {
  const { grid, bounds, boundary, minElevation, maxElevation } = options;
  const step = Math.max(0.1, options.interval);
  const indexInterval = Math.max(step, options.indexInterval);
  const ring = boundary.filter((point) => Array.isArray(point) && point.length >= 2);
  const contours: ContourFeature[] = [];
  const start = Math.ceil(minElevation / step) * step;

  for (let level = start; level <= maxElevation + 1e-9; level += step) {
    const contourLevel = Number(level.toFixed(3));
    const kind: ContourFeature["kind"] = Math.abs(contourLevel % indexInterval) < 1e-6 ? "index" : "intermediate";
    for (const chain of contourChains(grid, contourLevel, bounds)) {
      if (ring.length >= 3) {
        const clipped = clipChain(chain, ring);
        for (const run of clipped.inside) {
          contours.push({
            elevation: Number(contourLevel.toFixed(1)),
            coordinates: run.map(([lng, lat]) => [Number(lng.toFixed(6)), Number(lat.toFixed(6))]),
            kind,
            inside: true,
          });
        }
        for (const run of clipped.outside) {
          contours.push({
            elevation: Number(contourLevel.toFixed(1)),
            coordinates: run.map(([lng, lat]) => [Number(lng.toFixed(6)), Number(lat.toFixed(6))]),
            kind,
            inside: false,
          });
        }
      } else {
        contours.push({
          elevation: Number(contourLevel.toFixed(1)),
          coordinates: chain.map(([lng, lat]) => [Number(lng.toFixed(6)), Number(lat.toFixed(6))]),
          kind,
          inside: false,
        });
      }
    }
  }
  return contours;
}

/** Recorta a grade para a janela do entorno solicitado (sem nova consulta ao MDE). */
export function cropGrid(
  values: number[][],
  bounds: Bounds,
  bufferM: number,
  polygonBounds: Bounds,
): { grid: number[][]; bounds: Bounds } {
  const metersLat = 111320;
  const metersLng = 111320 * Math.cos(((bounds.north + bounds.south) / 2 * Math.PI) / 180);
  const padLat = bufferM / metersLat;
  const padLng = bufferM / Math.max(1, metersLng);
  // limite máximo disponível é o próprio bounds amostrado
  const north = Math.min(bounds.north, polygonBounds.north + padLat);
  const south = Math.max(bounds.south, polygonBounds.south - padLat);
  const east = Math.min(bounds.east, polygonBounds.east + padLng);
  const west = Math.max(bounds.west, polygonBounds.west - padLng);

  if (north <= south || east <= west) return { grid: values, bounds };

  const rows = values.length;
  const cols = values[0]?.length ?? 0;
  const indexAt = (lat: number, lng: number): [number, number] => [
    ((bounds.north - lat) / (bounds.north - bounds.south)) * (rows - 1),
    ((lng - bounds.west) / (bounds.east - bounds.west)) * (cols - 1),
  ];
  const [topRow, leftCol] = indexAt(north, west);
  const [bottomRow, rightCol] = indexAt(south, east);
  const r0 = Math.max(0, Math.floor(topRow));
  const r1 = Math.min(rows - 1, Math.ceil(bottomRow));
  const c0 = Math.max(0, Math.floor(leftCol));
  const c1 = Math.min(cols - 1, Math.ceil(rightCol));

  const grid: number[][] = [];
  for (let row = r0; row <= r1; row += 1) grid.push(values[row].slice(c0, c1 + 1));
  if (grid.length < 2 || grid[0].length < 2) return { grid: values, bounds };

  return {
    grid,
    bounds: {
      north: bounds.north - ((bounds.north - bounds.south) * r0) / (rows - 1),
      south: bounds.north - ((bounds.north - bounds.south) * r1) / (rows - 1),
      west: bounds.west + ((bounds.east - bounds.west) * c0) / (cols - 1),
      east: bounds.west + ((bounds.east - bounds.west) * c1) / (cols - 1),
    },
  };
}

