import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export type GeoPolygon = {
  /** GeoJSON-style ring: [lng, lat] */
  coordinates: [number, number][];
  label?: string;
  areaM2?: number;
};

export type CityHighlight = { label: string; value: string };

export const areas = pgTable(
  "areas",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    /** terreno | galpao | misto */
    kind: text("kind").notNull().default("terreno"),
    /** disponivel | em_estudo | em_negociacao | reservado | vendido */
    status: text("status").notNull().default("disponivel"),
    description: text("description").notNull().default(""),
    city: text("city").notNull(),
    citySlug: text("city_slug").notNull(),
    neighborhood: text("neighborhood").notNull().default(""),
    address: text("address").notNull().default(""),
    zipCode: text("zip_code").notNull().default(""),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    landAreaM2: doublePrecision("land_area_m2").notNull().default(0),
    builtAreaM2: doublePrecision("built_area_m2").notNull().default(0),
    pricePerM2: doublePrecision("price_per_m2").notNull().default(0),
    totalPrice: doublePrecision("total_price").notNull().default(0),
    zoning: text("zoning").notNull().default(""),
    zoningNotes: text("zoning_notes").notNull().default(""),
    environmentalRestriction: boolean("environmental_restriction").notNull().default(false),
    environmentalNotes: text("environmental_notes").notNull().default(""),
    geometry: jsonb("geometry").$type<GeoPolygon[]>().notNull().default([]),
    kmzFileName: text("kmz_file_name"),
    ownerName: text("owner_name").notNull().default(""),
    contactName: text("contact_name").notNull().default(""),
    contactPhone: text("contact_phone").notNull().default(""),
    contactEmail: text("contact_email").notNull().default(""),
    featured: boolean("featured").notNull().default(false),
    /** venda | locacao — separa o quadro de M² por transação */
    transaction: text("transaction").notNull().default("venda"),
    /** parceiro corretor (preenchimento manual) */
    partnerName: text("partner_name").notNull().default(""),
    partnerPhone: text("partner_phone").notNull().default(""),
    /** link externo do anúncio do imóvel (portal, site, vídeo etc.) */
    listingUrl: text("listing_url").notNull().default(""),
    /** última visualização de mapa configurada pelo usuário (usada na ficha em PDF) */
    mapView: jsonb("map_view").$type<MapViewConfig | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("areas_city_slug_idx").on(table.citySlug)],
);

export const media = pgTable(
  "media",
  {
    id: serial("id").primaryKey(),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "cascade" }),
    /** photo | document */
    kind: text("kind").notNull().default("photo"),
    /** capa | fachada | aerea | planta | matricula | projeto | mapa | laudo | contrato | outro */
    category: text("category").notNull().default("outro"),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull().default("application/octet-stream"),
    size: integer("size").notNull().default(0),
    caption: text("caption").notNull().default(""),
    /** base64 payload when the file is stored inside the database */
    data: text("data"),
    /** public path or remote URL (used for demo/seed assets) */
    externalUrl: text("external_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("media_area_idx").on(table.areaId)],
);

export type TerrainViewConfig = {
  contourScope: "both" | "inside" | "around";
  showContours: boolean;
  heatmapMode: "elevation" | "cutfill";
  heatmapScope: "both" | "inside" | "around";
  heatmapOpacity: number;
};

export type MapViewConfig = {
  basemap: string;
  lat: number;
  lng: number;
  zoom: number;
  contourScope?: "both" | "inside" | "around";
  heatmapMode?: "elevation" | "cutfill";
  heatmapScope?: "both" | "inside" | "around";
  heatmapOpacity?: number;
  contours?: boolean;
  heatmap?: boolean;
};

export type ContourFeature = {
  elevation: number;
  coordinates: [number, number][];
  kind: "index" | "intermediate";
  /** true = trecho dentro da demarcação do KMZ; false = entorno */
  inside?: boolean;
};

export type TerrainHeatmap = {
  rows: number;
  cols: number;
  values: number[][];
  bounds: { north: number; south: number; east: number; west: number };
  min: number;
  max: number;
};

export type TerrainProfilePoint = {
  distanceM: number;
  elevation: number;
  target: number;
  delta: number;
};

export type TerrainProfile = {
  /** comprimento | largura */
  axis: "comprimento" | "largura";
  points: TerrainProfilePoint[];
  lengthM: number;
  distanceM?: number;
  azimuth: number;
  direction: string;
  highest: { lat: number; lng: number; elevation: number };
  lowest: { lat: number; lng: number; elevation: number };
  /** métricas no padrão Google Earth */
  gainM: number;
  lossM: number;
  maxSlopeUp: number;
  maxSlopeDown: number;
  avgSlopeUp: number;
  avgSlopeDown: number;
  samples: number;
  spacingM: number;
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  source: string;
};

export type GradingCostLine = {
  label: string;
  quantity: number;
  unit: string;
  unitCost: number;
  total: number;
};

export type GradingReport = {
  targetMode: string;
  targetElevation: number;
  insideAreaM2: number;
  cellAreaM2: number;
  cutVolumeM3: number;
  fillVolumeM3: number;
  netVolumeM3: number;
  borrowVolumeM3: number;
  spoilVolumeM3: number;
  transportedVolumeM3: number;
  avgCutM: number;
  avgFillM: number;
  maxCutM: number;
  maxFillM: number;
  cuttingCells: number;
  fillingCells: number;
  costs: GradingCostLine[];
  totalCost: number;
  costPerM2: number;
  costPerHa: number;
  days: number;
  machines: { name: string; qty: number; note: string }[];
  notes: string[];
};

export type TerrainStats = {
  minElevation: number;
  maxElevation: number;
  rangeM: number;
  meanElevation: number;
  slopePct: number;
  insidePoints: number;
  aroundPoints: number;
  cellsInside: number;
  cellsAround: number;
  dominantDirection: string;
  contourCount: number;
  indexInterval: number;
  /** área geodésica do perímetro KMZ */
  geodesicAreaM2?: number;
  /** área de integração (soma das células dentro do polígono) */
  integrationAreaM2?: number;
  areaErrorPct?: number;
  profileLengthM?: number;
  gridRows?: number;
  gridCols?: number;
  contourSegments?: number;
  studiedAreaM2?: number;
  aroundAreaM2?: number;
  /** intervalo efetivamente aplicado após ajuste automático */
  effectiveInterval?: number;
  insideAreaM2?: number;
  cellAreaM2?: number;
  insideContours?: number;
  aroundContours?: number;
};

export const terrainAnalyses = pgTable(
  "terrain_analyses",
  {
    id: serial("id").primaryKey(),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "cascade" })
      .unique(),
    interval: doublePrecision("interval").notNull().default(5),
    bufferM: integer("buffer_m").notNull().default(250),
    source: text("source").notNull().default("SRTM 30m"),
    /** both | inside | around — preferência de exibição no mapa */
    scope: text("scope").notNull().default("both"),
    /** resolução da grade (nº de amostras por eixo) efetivamente usada */
    resolution: integer("resolution").notNull().default(30),
    /** configuração de exibição persistida (curvas, mapa de calor, opacidade) */
    viewConfig: jsonb("view_config").$type<TerrainViewConfig | null>(),
    targetMode: text("target_mode").notNull().default("mean"),
    targetElevation: doublePrecision("target_elevation"),
    /** MDE usado nos perfis de elevação */
    demSource: text("dem_source").notNull().default("srtm30m"),
    /** ajuste vertical de calibração (m) */
    verticalOffset: doublePrecision("vertical_offset").notNull().default(0),
    /** grade de elevação amostrada (usada para redesenhar curvas no navegador) */
    demGrid: jsonb("dem_grid").$type<{
      values: number[][];
      bounds: { north: number; south: number; east: number; west: number };
      innerValues: number[][];
      innerBounds: { north: number; south: number; east: number; west: number };
      polygonBounds: { north: number; south: number; east: number; west: number };
      boundary: [number, number][];
      min: number;
      max: number;
      bufferM: number;
    } | null>(),
    contours: jsonb("contours").$type<ContourFeature[]>().notNull().default([]),
    stats: jsonb("stats").$type<TerrainStats>().notNull(),
    heatmap: jsonb("heatmap").$type<TerrainHeatmap | null>(),
    cutFillHeatmap: jsonb("cut_fill_heatmap").$type<TerrainHeatmap | null>(),
    profile: jsonb("profile").$type<TerrainProfile | null>(),
    crossProfile: jsonb("cross_profile").$type<TerrainProfile | null>(),
    /** grade de análise alinhada ao imóvel (cobre 100% do perímetro) */
    gridLines: jsonb("grid_lines").$type<{ coordinates: [number, number][]; kind: string }[]>(),
    gridInfo: jsonb("grid_info").$type<{
      columns: number;
      rows: number;
      cellLengthM: number;
      cellWidthM: number;
      cellAreaM2: number;
      cellCount: number;
      coveredAreaM2: number;
      coveragePct: number;
      lengthSpanM: number;
      widthSpanM: number;
      centerLat: number;
      centerLng: number;
      azimuth: number;
    } | null>(),
    /** comparativo entre modelos digitais de elevação (SRTM, Copernicus, ASTER) */
    demComparison: jsonb("dem_comparison").$type<
      {
        source: string;
        label: string;
        provider: string;
        resolution: string;
        live: boolean;
        samples: number;
        meanElevation: number;
        minElevation: number;
        maxElevation: number;
        meanAbsoluteDiff: number;
        bias: number;
        agreementPct: number;
      }[]
    >(),
    grading: jsonb("grading").$type<GradingReport | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  summary: string;
  category: string;
};

export const marketNews = pgTable(
  "market_news",
  {
    id: serial("id").primaryKey(),
    /** coleta diária (YYYY-MM-DD) */
    day: text("day").notNull(),
    items: jsonb("items").$type<NewsItem[]>().notNull().default([]),
    indices: jsonb("indices").$type<{ label: string; value: string; unit: string; note: string }[]>().notNull().default([]),
    source: text("source").notNull().default("Google News · InfoMoney · Exame · Money Times"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("market_news_day_idx").on(table.day)],
);

export const areaRestrictions = pgTable(
  "area_restrictions",
  {
    id: serial("id").primaryKey(),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "cascade" }),
    /** app | nascente | linhão | duto | faixa_estrada | reserva_legal | alagado | outro */
    type: text("type").notNull().default("app"),
    /** polygon (demarcação por vértices) | axis (traço de eixo com recuo) */
    geometryType: text("geometry_type").notNull().default("polygon"),
    /** eixo do linhão + parâmetros de recuo (CPFL/NBR) quando geometryType = axis */
    axisMeta: jsonb("axis_meta").$type<{
      axis: [number, number][];
      setbackM: number;
      widthM: number;
      lengthM: number;
      voltageKv: number;
      standard: string;
      source: string;
    } | null>(),
    label: text("label").notNull().default(""),
    notes: text("notes").notNull().default(""),
    coordinates: jsonb("coordinates").$type<[number, number][]>().notNull().default([]),
    /** área considerada na perda: apenas o que está DENTRO da demarcação do KMZ */
    areaM2: doublePrecision("area_m2").notNull().default(0),
    /** área total do desenho (inclui trechos fora do KMZ) */
    grossAreaM2: doublePrecision("gross_area_m2").notNull().default(0),
    /** parcela desenhada fora da demarcação — desconsiderada na perda */
    outsideAreaM2: doublePrecision("outside_area_m2").notNull().default(0),
    lossPct: doublePrecision("loss_pct").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("area_restrictions_area_idx").on(table.areaId)],
);

export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    areaId: integer("area_id").references(() => areas.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("info"),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("activities_area_idx").on(table.areaId)],
);

export const cities = pgTable("ibge_cities", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  ibgeCode: text("ibge_code").notNull(),
  region: text("region").notNull(),
  population2022: integer("population_2022").notNull().default(0),
  population2010: integer("population_2010").notNull().default(0),
  areaKm2: doublePrecision("area_km2").notNull().default(0),
  gdpPerCapita: doublePrecision("gdp_per_capita").notNull().default(0),
  avgIncome: doublePrecision("avg_income").notNull().default(0),
  /** IBGE CEMPRE: salário médio mensal dos trabalhadores formais, em salários mínimos */
  formalMinWages: doublePrecision("formal_min_wages").notNull().default(0),
  /** salário médio mensal dos trabalhadores formais em reais (piso SP × salários mínimos) */
  formalAvgSalary: doublePrecision("formal_avg_salary").notNull().default(0),
  /** renda mediana mensal estimada (R$) — referência interna auditada */
  medianIncome: doublePrecision("median_income").notNull().default(0),
  /** potencial de consumo anual (R$) = população × renda média × 12 */
  consumptionPotential: doublePrecision("consumption_potential").notNull().default(0),
  idhm: doublePrecision("idhm").notNull().default(0),
  urbanization: doublePrecision("urbanization").notNull().default(0),
  /** benchmark interno Land Bank Corp para terreno industrial/logístico */
  marketPriceM2: doublePrecision("market_price_m2").notNull().default(0),
  lat: doublePrecision("lat").notNull().default(0),
  lng: doublePrecision("lng").notNull().default(0),
  topSectors: text("top_sectors").notNull().default(""),
  highlights: jsonb("highlights").$type<CityHighlight[]>().notNull().default([]),
  source: text("source").notNull().default("IBGE — Censo 2022 / Cidades"),
  /** última tentativa de enriquecimento (cache para não sobrecarregar a API) */
  ibgeCheckedAt: timestamp("ibge_checked_at", { withTimezone: true }),
});

export type Area = typeof areas.$inferSelect;
export type NewArea = typeof areas.$inferInsert;
export type MediaItem = typeof media.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type City = typeof cities.$inferSelect;
