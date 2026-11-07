import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { activities, areaRestrictions, areas, cities, media, terrainAnalyses } from "@/db/schema";
import type { Activity, Area, City } from "@/db/schema";
import { ensureDatabase } from "@/db/bootstrap";
import { CITY_SEED, findCity, type CitySeed } from "@/lib/cities";
import { isArchivedStatus } from "@/lib/format";
import type { AreaRecord, PortfolioSummary } from "@/lib/intelligence";
import { summarize } from "@/lib/intelligence";

export type MediaMeta = {
  id: number;
  areaId: number;
  kind: string;
  category: string;
  name: string;
  mimeType: string;
  size: number;
  caption: string;
  externalUrl: string | null;
  sortOrder: number;
  createdAt: Date;
  url: string;
};

const mediaMetaSelect = {
  id: media.id,
  areaId: media.areaId,
  kind: media.kind,
  category: media.category,
  name: media.name,
  mimeType: media.mimeType,
  size: media.size,
  caption: media.caption,
  externalUrl: media.externalUrl,
  sortOrder: media.sortOrder,
  createdAt: media.createdAt,
};

function withUrl(row: Omit<MediaMeta, "url">): MediaMeta {
  return { ...row, url: row.externalUrl ?? `/api/media/${row.id}` };
}

async function getSupabaseMediaRows(areaId?: number): Promise<MediaMeta[]> {
  try {
    // Authenticate first, then read media metadata with the server-only key.
    // This avoids RLS policies silently hiding existing photos from card queries.
    const session = await createClient();
    const { data: auth, error: authError } = await session.auth.getUser();
    if (authError || !auth.user) return [];
    const { data: role, error: roleError } = await session.from("user_roles")
      .select("role").eq("user_id", auth.user.id).maybeSingle();
    if (roleError || !["admin", "member", "reader"].includes(role?.role ?? "")) return [];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY_V2 || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !secret) throw new Error("Chave administrativa do Supabase não configurada.");
    const admin = createAdminClient(supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    let query = admin.from("media")
      .select("id,area_id,kind,category,name,mime_type,size,caption,external_url,sort_order,created_at")
      .order("sort_order", { ascending: true }).order("id", { ascending: true });
    if (areaId !== undefined) query = query.eq("area_id", areaId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row: any) => withUrl({
      id: row.id, areaId: row.area_id, kind: row.kind, category: row.category,
      name: row.name, mimeType: row.mime_type, size: row.size ?? 0,
      caption: row.caption ?? "", externalUrl: row.external_url,
      sortOrder: row.sort_order ?? 0, createdAt: new Date(row.created_at),
    }));
  } catch (mediaError) {
    console.error("[media:metadata]", mediaError);
    return [];
  }
}

export async function getAreas(options?: { includeArchived?: boolean }): Promise<AreaRecord[]> {
  await ensureDatabase();
  const [areaRows, mediaRows] = await Promise.all([
    db.select().from(areas).orderBy(desc(areas.featured), desc(areas.updatedAt)),
    getSupabaseMediaRows(),
  ]);

  const byArea = new Map<number, MediaMeta[]>();
  for (const row of mediaRows) {
    const list = byArea.get(row.areaId) ?? [];
    list.push(withUrl(row));
    byArea.set(row.areaId, list);
  }

  const filtered = options?.includeArchived
    ? areaRows
    : areaRows.filter((area) => !isArchivedStatus(area.status));

  return filtered.map((area) => {
    const items = byArea.get(area.id) ?? [];
    const photos = items.filter((item) => item.kind === "photo");
    const documents = items.filter((item) => item.kind === "document");
    const cover = photos.find((photo) => photo.category === "capa") ?? photos[0];
    return {
      ...area,
      photoCount: photos.length,
      documentCount: documents.length,
      coverUrl: cover?.url ?? null,
      photos: (cover ? [cover, ...photos.filter((photo) => photo.id !== cover.id)] : photos).map((photo) => ({ id: photo.id, url: area.status === "disponivel" ? `/api/public/media/${photo.id}` : photo.url, name: photo.name, category: photo.category })),
      hasKmz: area.geometry.length > 0 || Boolean(area.kmzFileName),
    };
  });
}

export async function getCities(): Promise<City[]> {
  await ensureDatabase();
  return db.select().from(cities).orderBy(asc(cities.name));
}

/** Todas as cidades disponíveis para cadastro (645 municípios de SP + base regional). */
export async function getCityOptions(): Promise<City[]> {
  const rows = await getCities();
  const seen = new Set(rows.map((row) => row.slug));
  const extra = CITY_SEED.filter((seed) => !seen.has(seed.slug)).map((seed) => cityFromSeed(seed));
  const normalizeName = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
  const byName = new Map<string, City>();
  for (const city of [...rows, ...extra]) {
    const key = normalizeName(city.name);
    const current = byName.get(key);
    // mantém a versão com indicadores IBGE (população > 0) e benchmark de solo
    if (!current || (city.population2022 > 0 && current.population2022 === 0) || (city.marketPriceM2 > 0 && current.marketPriceM2 === 0)) {
      byName.set(key, city);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function cityFromSeed(seed: CitySeed): City {
  return {
    id: 0,
    slug: seed.slug,
    name: seed.name,
    ibgeCode: seed.ibgeCode,
    region: seed.region,
    population2022: seed.population2022,
    population2010: seed.population2010,
    areaKm2: seed.areaKm2,
    gdpPerCapita: seed.gdpPerCapita,
    avgIncome: seed.avgIncome,
    formalMinWages: seed.formalMinWages ?? 0,
    formalAvgSalary: seed.formalAvgSalary ?? 0,
    medianIncome: seed.medianIncome,
    consumptionPotential: seed.consumptionPotential > 0 ? seed.consumptionPotential : seed.population2022 * seed.avgIncome * 12,
    idhm: seed.idhm,
    urbanization: seed.urbanization,
    marketPriceM2: seed.marketPriceM2,
    lat: seed.lat,
    lng: seed.lng,
    topSectors: seed.topSectors,
    highlights: seed.highlights,
    source: "IBGE — Censo 2022 / Cidades",
    ibgeCheckedAt: null,
  };
}

export async function getCityMap(): Promise<Map<string, City>> {
  const rows = await getCities();
  const map = new Map(rows.map((city) => [city.slug, city]));
  for (const seed of CITY_SEED) {
    if (!map.has(seed.slug)) map.set(seed.slug, cityFromSeed(seed));
  }
  return map;
}

export function resolveCity(map: Map<string, City>, slug: string, name?: string): City | undefined {
  return map.get(slug) ?? (name ? map.get(findCity(name)?.slug ?? "") : undefined);
}

export async function getPortfolio(): Promise<{
  areas: AreaRecord[];
  cityMap: Map<string, City>;
  summary: PortfolioSummary;
  cities: City[];
  archived: AreaRecord[];
  archivedSummary: PortfolioSummary;
}> {
  const [activeList, archivedList, cityMap] = await Promise.all([
    getAreas(),
    getArchivedAreas(),
    getCityMap(),
  ]);
  return {
    areas: activeList,
    cityMap,
    summary: summarize(activeList, cityMap),
    cities: [...cityMap.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    archived: archivedList,
    archivedSummary: summarize(archivedList, cityMap),
  };
}

/** Imóveis vendidos ou cancelados: fora do controle operacional, disponíveis só para consulta. */
export async function getArchivedAreas(): Promise<AreaRecord[]> {
  const all = await getAreas({ includeArchived: true });
  return all.filter((area) => isArchivedStatus(area.status));
}

export async function getAreaById(
  id: number,
): Promise<{ area: AreaRecord; media: MediaMeta[]; activities: Activity[]; city?: City } | null> {
  await ensureDatabase();
  const [area] = await db.select().from(areas).where(eq(areas.id, id)).limit(1);
  if (!area) return null;
  const [items, activityRows] = await Promise.all([
    getSupabaseMediaRows(id),
    db.select().from(activities).where(eq(activities.areaId, id)).orderBy(desc(activities.createdAt)).limit(20),
  ]);
  const photos = items.filter((item) => item.kind === "photo");
  const cover = photos.find((photo) => photo.category === "capa") ?? photos[0];
  const cityRows = await db.select().from(cities).where(eq(cities.slug, area.citySlug)).limit(1);
  const city = cityRows[0] ?? (findCity(area.city) ? cityFromSeed(findCity(area.city)!) : undefined);

  return {
    area: {
      ...area,
      photoCount: photos.length,
      documentCount: items.filter((item) => item.kind === "document").length,
      coverUrl: cover?.url ?? null,
      hasKmz: area.geometry.length > 0 || Boolean(area.kmzFileName),
    },
    media: items,
    activities: activityRows,
    city,
  };
}

export async function getAreaByCode(
  code: string,
): Promise<{ area: AreaRecord; media: MediaMeta[]; activities: Activity[]; city?: City } | null> {
  await ensureDatabase();
  const [area] = await db.select().from(areas).where(eq(areas.code, code)).limit(1);
  if (!area) return null;
  return getAreaById(area.id);
}

export async function getTerrainAnalysis(areaId: number) {
  await ensureDatabase();
  const [row] = await db.select().from(terrainAnalyses).where(eq(terrainAnalyses.areaId, areaId)).limit(1);
  return row ?? null;
}

export async function getAreaRestrictions(areaId: number) {
  await ensureDatabase();
  return db
    .select()
    .from(areaRestrictions)
    .where(eq(areaRestrictions.areaId, areaId))
    .orderBy(desc(areaRestrictions.areaM2));
}

export async function getMediaFile(
  id: number,
): Promise<{ data: string | null; externalUrl: string | null; mimeType: string; name: string } | null> {
  await ensureDatabase();
  const [row] = await db
    .select({ data: media.data, externalUrl: media.externalUrl, mimeType: media.mimeType, name: media.name })
    .from(media)
    .where(eq(media.id, id))
    .limit(1);
  return row ?? null;
}

export async function logActivity(areaId: number, type: string, title: string, detail = ""): Promise<void> {
  await db.insert(activities).values({ areaId, type, title, detail });
}

export async function countAreas(): Promise<number> {
  await ensureDatabase();
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(areas);
  return row?.count ?? 0;
}

export async function getAreaOptions(): Promise<{ id: number; code: string; name: string; city: string }[]> {
  await ensureDatabase();
  return db
    .select({ id: areas.id, code: areas.code, name: areas.name, city: areas.city })
    .from(areas)
    .orderBy(asc(areas.name));
}

export async function getAreaForMedia(areaId: number): Promise<{ id: number; code: string } | null> {
  await ensureDatabase();
  const [row] = await db.select({ id: areas.id, code: areas.code }).from(areas).where(eq(areas.id, areaId)).limit(1);
  return row ?? null;
}

export async function deleteMedia(areaId: number, mediaId: number): Promise<void> {
  await db.delete(media).where(and(eq(media.areaId, areaId), eq(media.id, mediaId)));
}
