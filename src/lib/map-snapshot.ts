import type { MapViewConfig } from "@/db/schema";

export type SnapshotTile = { url: string; x: number; y: number; size: number };

export type MapSnapshot = {
  width: number;
  height: number;
  zoom: number;
  center: { lat: number; lng: number };
  basemap: string;
  tiles: SnapshotTile[];
  bounds: { north: number; south: number; east: number; west: number };
  attribution: string;
  available: boolean;
};

const TILE_SERVERS: Record<string, { url: (x: number, y: number, z: number) => string; attribution: string }> = {
  mapa: {
    url: (x, y, z) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    attribution: "© OpenStreetMap contributors",
  },
  satelite: {
    url: (x, y, z) =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    attribution: "Imagens © Esri, Maxar, Earthstar Geographics",
  },
  humanitario: {
    url: (x, y, z) => `https://tile-a.openstreetmap.fr/hot/${z}/${x}/${y}.png`,
    attribution: "© OpenStreetMap contributors · estilo HOT",
  },
};

const TILE_SIZE = 256;

function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * 2 ** zoom;
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom;
}

function tileXToLng(x: number, zoom: number): number {
  return (x / 2 ** zoom) * 360 - 180;
}

function tileYToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

/**
 * Monta a "foto" do mapa exatamente na visualização salva pelo usuário
 * (centro, zoom e camada), com tiles baixados no servidor e embutidos como
 * data URL — assim a impressão em PDF é idêntica à tela, sem depender de CORS.
 */
export async function buildMapSnapshot(view: MapViewConfig, width = 900, height = 470): Promise<MapSnapshot> {
  const basemap = TILE_SERVERS[view.basemap] ? view.basemap : "satelite";
  const zoom = Math.min(19, Math.max(6, Math.round(view.zoom || 15)));
  const center = { lat: view.lat, lng: view.lng };

  const centerX = lngToTileX(center.lng, zoom);
  const centerY = latToTileY(center.lat, zoom);
  const tilesX = Math.ceil(width / TILE_SIZE) + 1;
  const tilesY = Math.ceil(height / TILE_SIZE) + 1;
  const startX = Math.floor(centerX - tilesX / 2);
  const startY = Math.floor(centerY - tilesY / 2);
  const pixelCenterX = (centerX - startX) * TILE_SIZE;
  const pixelCenterY = (centerY - startY) * TILE_SIZE;
  const boundLeft = pixelCenterX - width / 2;
  const boundTop = pixelCenterY - height / 2;

  const tiles: SnapshotTile[] = [];
  const maxTile = 2 ** zoom;

  await Promise.all(
    Array.from({ length: tilesX }).flatMap((_, dx) =>
      Array.from({ length: tilesY }).map(async (_, dy) => {
        const tileX = ((startX + dx) % maxTile + maxTile) % maxTile;
        const tileY = startY + dy;
        if (tileY < 0 || tileY >= maxTile) return;
        const x = dx * TILE_SIZE - boundLeft + (startX < 0 ? 0 : 0);
        const y = dy * TILE_SIZE - boundTop;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 9000);
          const response = await fetch(TILE_SERVERS[basemap].url(tileX, tileY, zoom), {
            signal: controller.signal,
            headers: {
              "User-Agent": "LandBankCorpCRM/1.2 (contato: junior.lopes@creci.org.br)",
              Accept: "image/png,image/jpeg",
            },
          });
          clearTimeout(timeout);
          if (!response.ok) return;
          const buffer = Buffer.from(await response.arrayBuffer());
          const type = response.headers.get("content-type") ?? "image/png";
          tiles.push({
            url: `data:${type};base64,${buffer.toString("base64")}`,
            x: Math.round(x),
            y: Math.round(y),
            size: TILE_SIZE,
          });
        } catch {
          // tile indisponível: segue sem ele
        }
      }),
    ),
  );

  const west = tileXToLng(startX + boundLeft / TILE_SIZE, zoom);
  const east = tileXToLng(startX + (boundLeft + width) / TILE_SIZE, zoom);
  const north = tileYToLat(startY + boundTop / TILE_SIZE, zoom);
  const south = tileYToLat(startY + (boundTop + height) / TILE_SIZE, zoom);

  return {
    width,
    height,
    zoom,
    center,
    basemap,
    tiles,
    bounds: { north, south, east, west },
    attribution: TILE_SERVERS[basemap].attribution,
    available: tiles.length > 0,
  };
}
