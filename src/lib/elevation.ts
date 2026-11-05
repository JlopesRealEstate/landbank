/**
 * MULTI-FONTE DE ELEVAÇÃO — Land Bank Corp
 * ------------------------------------------------------------------
 * Comparativo de modelos digitais de elevação (MDE) para garantir precisão
 * topográfica e não comprometer o parecer de custo de terraplenagem:
 *  - SRTM 30 m (NASA/NGA) via OpenTopoData — mesma família de dados usada pelo
 *    Google Earth em áreas urbanas;
 *  - Copernicus DEM GLO-90 (ESA) via Open-Meteo;
 *  - ASTER GDEM 30 m (NASA/METI) via OpenTopoData — conferência independente.
 * A amostragem é feita PONTO A PONTO nas coordenadas exatas dos transectos
 * (sem interpolar grade), reduzindo o erro do perfil de elevação.
 */

export type DemSourceId = "srtm30m" | "copernicus" | "aster30m";

export const DEM_SOURCES: Record<DemSourceId, { label: string; provider: string; resolution: string }> = {
  srtm30m: { label: "SRTM 30 m", provider: "NASA/NGA · OpenTopoData", resolution: "30 m" },
  copernicus: { label: "Copernicus GLO-90", provider: "ESA · Open-Meteo", resolution: "90 m" },
  aster30m: { label: "ASTER GDEM 30 m", provider: "NASA/METI · OpenTopoData", resolution: "30 m" },
};

export type DemSample = {
  source: DemSourceId;
  values: (number | null)[];
  live: boolean;
};

type Point = { lat: number; lng: number };

const CHUNK = 100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOpentopo(points: Point[], dataset: "srtm30m" | "aster30m"): Promise<DemSample> {
  const values: (number | null)[] = new Array(points.length).fill(null);
  let live = false;

  for (let start = 0; start < points.length; start += CHUNK) {
    const chunk = points.slice(start, start + CHUNK);
    const locations = chunk.map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`).join("|");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 16000);
        const response = await fetch(`https://api.opentopodata.org/v1/${dataset}?locations=${locations}`, {
          signal: controller.signal,
          headers: { Accept: "application/json", "User-Agent": "LandBankCorpCRM/2.0 (junior.lopes@creci.org.br)" },
          cache: "no-store",
        });
        clearTimeout(timeout);
        if (response.ok) {
          const data = (await response.json()) as { results?: { elevation: number | null }[] };
          if (data.results?.length === chunk.length) {
            data.results.forEach((item, index) => {
              const value = typeof item.elevation === "number" && Number.isFinite(item.elevation) ? item.elevation : null;
              if (value !== null) live = true;
              values[start + index] = value;
            });
            break;
          }
        }
      } catch {
        // nova tentativa
      }
      await delay(1100);
    }
    if (start + CHUNK < points.length) await delay(1050);
  }

  return { source: dataset, values, live };
}

async function fetchCopernicus(points: Point[]): Promise<DemSample> {
  const values: (number | null)[] = new Array(points.length).fill(null);
  let live = false;

  for (let start = 0; start < points.length; start += CHUNK) {
    const chunk = points.slice(start, start + CHUNK);
    const latitudes = chunk.map((point) => point.lat.toFixed(6)).join(",");
    const longitudes = chunk.map((point) => point.lng.toFixed(6)).join(",");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 14000);
        const response = await fetch(
          `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`,
          {
            signal: controller.signal,
            headers: { Accept: "application/json", "User-Agent": "LandBankCorpCRM/2.0" },
            cache: "no-store",
          },
        );
        clearTimeout(timeout);
        if (response.ok) {
          const data = (await response.json()) as { elevation?: (number | null)[] };
          if (data.elevation?.length === chunk.length) {
            data.elevation.forEach((value, index) => {
              const parsed = typeof value === "number" && Number.isFinite(value) ? value : null;
              if (parsed !== null) live = true;
              values[start + index] = parsed;
            });
            break;
          }
        }
      } catch {
        // nova tentativa
      }
      await delay(600);
    }
  }

  return { source: "copernicus", values, live };
}

/** Busca os três MDEs em paralelo (cada um com fallback próprio). */
export async function fetchDemComparison(points: Point[]): Promise<Record<DemSourceId, DemSample>> {
  if (!points.length) {
    return {
      srtm30m: { source: "srtm30m", values: [], live: false },
      copernicus: { source: "copernicus", values: [], live: false },
      aster30m: { source: "aster30m", values: [], live: false },
    };
  }
  const [srtm, copernicus] = await Promise.all([fetchOpentopo(points, "srtm30m"), fetchCopernicus(points)]);
  // o terceiro modelo só é consultado quando há necessidade de arbitragem (diferença alta)
  let aster: DemSample = { source: "aster30m", values: new Array(points.length).fill(null), live: false };
  const comparable = srtm.values.filter((value): value is number => value !== null);
  const copValues = copernicus.values.filter((value): value is number => value !== null);
  if (comparable.length && copValues.length) {
    const meanSrtm = comparable.reduce((sum, value) => sum + value, 0) / comparable.length;
    const meanCop = copValues.reduce((sum, value) => sum + value, 0) / copValues.length;
    if (Math.abs(meanSrtm - meanCop) > 4) {
      aster = await fetchOpentopo(points, "aster30m");
    }
  }
  return { srtm30m: srtm, copernicus: copernicus, aster30m: aster };
}
