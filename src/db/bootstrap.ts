import { sql } from "drizzle-orm";
import { db } from "@/db";
import { areas, cities, media, activities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CITY_SEED } from "@/lib/cities";
import SP_MUNICIPALITIES from "@/data/sp-municipalities.json";
import SP_INDICATORS from "@/data/sp-ibge-indicators.json";
import { MINIMUM_WAGE } from "@/lib/minimum-wage";

const SP_MINIMUM_WAGE = MINIMUM_WAGE.value;
import { ringAround } from "@/lib/geo";
import type { GeoPolygon } from "@/db/schema";

const PHOTOS = {
  fachada: "/images/galpao-fachada.jpg",
  interior: "/images/galpao-interior.jpg",
  armazem: "/images/armazem-interior.jpg",
  terreno: "/images/terreno-plano.jpg",
  aerea: "/images/aerea-distrito.jpg",
  rodovia: "/images/area-rodovia.jpg",
};

type SeedArea = {
  code: string;
  name: string;
  kind: string;
  status: string;
  description: string;
  city: string;
  neighborhood: string;
  address: string;
  zipCode: string;
  lat: number;
  lng: number;
  radius: number;
  landAreaM2: number;
  builtAreaM2: number;
  pricePerM2: number;
  totalPrice: number;
  zoning: string;
  zoningNotes: string;
  environmentalRestriction: boolean;
  environmentalNotes: string;
  ownerName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  featured: boolean;
  photos: string[];
  documents: { name: string; category: string; mimeType: string }[];
  activity: string;
};

const SEED_AREAS: SeedArea[] = [
  {
    code: "SUM-001",
    name: "Galpão Logístico Sumaré — Eixo Anhanguera",
    kind: "galpao",
    status: "disponivel",
    description:
      "Galpão logístico de alto padrão em Sumaré, com pé-direito livre de 12 metros, 8 docas niveladas, piso industrial e pátio de manobras para carretas. Localizado a poucos minutos dos acessos da Rodovia Anhanguera (SP-330) e da Bandeirantes (SP-348), no principal corredor logístico da Região Metropolitana de Campinas. Estrutura em concreto pré-moldado, sprinklers e área administrativa pronta para operação.",
    city: "Sumaré",
    neighborhood: "Jardim Picerno",
    address: "Rodovia Anhanguera (SP-330), km 108 — Sumaré/SP",
    zipCode: "13175-000",
    lat: -22.8006,
    lng: -47.2705,
    radius: 240,
    landAreaM2: 42000,
    builtAreaM2: 18500,
    pricePerM2: 950,
    totalPrice: 39900000,
    zoning: "Zona Industrial 1 (ZI-1)",
    zoningNotes: "Plano Diretor de Sumaré permite uso industrial e logístico de médio e grande porte, com coeficiente de aproveitamento 1,5.",
    environmentalRestriction: false,
    environmentalNotes: "Sem APP identificada na gleba. Recomendado estudo geotécnico e verificação de drenagem.",
    ownerName: "Prado Participações S/A",
    contactName: "Junior Lopes",
    contactPhone: "5519994960304",
    contactEmail: "junior.lopes@creci.org.br",
    featured: true,
    photos: [PHOTOS.fachada, PHOTOS.interior, PHOTOS.aerea],
    documents: [
      { name: "Matrícula atualizada — SUM-001.pdf", category: "Matrícula", mimeType: "application/pdf" },
      { name: "Planta baixa — galpão 18.500 m².pdf", category: "Planta", mimeType: "application/pdf" },
      { name: "Perímetro KMZ — SUM-001.kmz", category: "KMZ", mimeType: "application/vnd.google-earth.kmz" },
    ],
    activity: "Dossiê revisado e perímetro conferido em imagem de satélite.",
  },
  {
    code: "NOD-002",
    name: "Área Bruta Nova Odessa — SP-304",
    kind: "terreno",
    status: "disponivel",
    description:
      "Gleba plana de 12 hectares com frente para a Rodovia Luiz de Queiroz (SP-304), no Distrito Industrial de Nova Odessa. Excelente alternativa para condomínio logístico de até 60.000 m² de área construída, com acesso duplo e infraestrutura de água, energia e gás no entorno. Terreno limpo, sem edificações e com topografia favorável (declividade inferior a 3%).",
    city: "Nova Odessa",
    neighborhood: "Distrito Industrial",
    address: "Rodovia Luiz de Queiroz (SP-304), km 122 — Nova Odessa/SP",
    zipCode: "13460-000",
    lat: -22.7774,
    lng: -47.318,
    radius: 420,
    landAreaM2: 120000,
    builtAreaM2: 0,
    pricePerM2: 445,
    totalPrice: 53400000,
    zoning: "Zona Industrial (ZI)",
    zoningNotes: "Lei de Uso e Ocupação do Solo de Nova Odessa permite galpões logísticos com altura de até 20 m.",
    environmentalRestriction: false,
    environmentalNotes: "Ausência de cursos d'água na gleba. Necessária outorga para captação de água pluvial.",
    ownerName: "Família Bertoldi",
    contactName: "Junior Lopes",
    contactPhone: "5519994960304",
    contactEmail: "junior.lopes@creci.org.br",
    featured: true,
    photos: [PHOTOS.terreno, PHOTOS.rodovia, PHOTOS.aerea],
    documents: [
      { name: "Matrícula — NOD-002.pdf", category: "Matrícula", mimeType: "application/pdf" },
      { name: "Levantamento topográfico — NOD-002.pdf", category: "Projeto", mimeType: "application/pdf" },
    ],
    activity: "Prospecção registrada. Proprietário aceita proposta com sinal de 20%.",
  },
  {
    code: "HOR-003",
    name: "Terreno Hortolândia — Jardim Amanda",
    kind: "terreno",
    status: "em_negociacao",
    description:
      "Terreno urbano de 25.000 m² em Hortolândia, a 3 km do centro e próximo ao eixo de acesso da Rodovia Anhanguera. Indicado para galpão de última milha, centro de distribuição urbano ou loteamento industrial de pequeno porte. Área já cercada, com frente asfaltada e iluminação pública.",
    city: "Hortolândia",
    neighborhood: "Jardim Amanda",
    address: "Rua Pastor Alfredo Barbosa de Oliveira, 1200 — Hortolândia/SP",
    zipCode: "13188-000",
    lat: -22.876,
    lng: -47.211,
    radius: 180,
    landAreaM2: 25000,
    builtAreaM2: 0,
    pricePerM2: 515,
    totalPrice: 12875000,
    zoning: "Zona Mista (ZM)",
    zoningNotes: "Permite uso misto com restrições de horário para carga e descarga. Consultar diretrizes viárias.",
    environmentalRestriction: false,
    environmentalNotes: "Sem restrição mapeada. Verificar faixa de drenagem do córrego do Boa Vista.",
    ownerName: "JSL Investimentos Imobiliários",
    contactName: "Junior Lopes",
    contactPhone: "5519994960304",
    contactEmail: "junior.lopes@creci.org.br",
    featured: true,
    photos: [PHOTOS.terreno, PHOTOS.aerea],
    documents: [
      { name: "Certidão de ônus — HOR-003.pdf", category: "Matrícula", mimeType: "application/pdf" },
      { name: "Estudo de viabilidade — HOR-003.pdf", category: "Laudo", mimeType: "application/pdf" },
    ],
    activity: "Proposta de R$ 12,1 mi recebida. Aguardando contraproposta do proprietário.",
  },
  {
    code: "CPQ-004",
    name: "Galpão Campinas — Vetor Viracopos",
    kind: "galpao",
    status: "reservado",
    description:
      "Galpão classe A de 24.000 m² em terreno de 60.000 m², a 6 km do Aeroporto Internacional de Viracopos. Imóvel com certificação de eficiência energética, docas para 14 veículos, pátio para carretas e área de expansão para mais 10.000 m². Ocupação atual de 40% do terreno, com possibilidade de Built-to-Suit.",
    city: "Campinas",
    neighborhood: "Vetor Viracopos",
    address: "Av. Ruy Rodriguez, 4100 — Campinas/SP",
    zipCode: "13052-400",
    lat: -23.0012,
    lng: -47.139,
    radius: 300,
    landAreaM2: 60000,
    builtAreaM2: 24000,
    pricePerM2: 1120,
    totalPrice: 67200000,
    zoning: "Zona de Desenvolvimento Econômico 2 (ZDE-2)",
    zoningNotes: "Uso logístico e industrial permitido. Área inserida no eixo de desenvolvimento do aeroporto.",
    environmentalRestriction: false,
    environmentalNotes: "Área fora de APP. Verificar interferência aeroportuária (PDIR) para altura de edificações.",
    ownerName: "Viracopos Logística FII",
    contactName: "Junior Lopes",
    contactPhone: "5519994960304",
    contactEmail: "junior.lopes@creci.org.br",
    featured: true,
    photos: [PHOTOS.fachada, PHOTOS.armazem, PHOTOS.interior],
    documents: [
      { name: "Matrícula — CPQ-004.pdf", category: "Matrícula", mimeType: "application/pdf" },
      { name: "AVCB e laudo técnico.pdf", category: "Laudo", mimeType: "application/pdf" },
      { name: "Planta de implantação — CPQ-004.pdf", category: "Planta", mimeType: "application/pdf" },
    ],
    activity: "Ativo reservado para fundo de investimento. Fase de due diligence.",
  },
  {
    code: "PAU-005",
    name: "Gleba Paulínia — Polo Petroquímico",
    kind: "terreno",
    status: "em_estudo",
    description:
      "Gleba de 21 hectares no vetor industrial de Paulínia, próxima ao polo petroquímico e ao acesso da Rodovia Zeferino Vaz (SP-332). Área estratégica para operações químicas, centros de distribuição de granéis ou pátios logísticos. A tese exige estruturação ambiental prévia, com mapeamento de APP do rio Atibaia e faixa de dutos.",
    city: "Paulínia",
    neighborhood: "Betel",
    address: "Rodovia Zeferino Vaz (SP-332), km 118 — Paulínia/SP",
    zipCode: "13140-000",
    lat: -22.748,
    lng: -47.168,
    radius: 520,
    landAreaM2: 210000,
    builtAreaM2: 0,
    pricePerM2: 405,
    totalPrice: 85050000,
    zoning: "Zona Industrial Petroquímica (ZIP)",
    zoningNotes: "Uso estritamente industrial. Exige licenciamento ambiental de alto impacto e plano de emergência.",
    environmentalRestriction: true,
    environmentalNotes:
      "Faixa de APP do rio Atibaia (~120 m) e interferência de dutos da Transpetro. Necessários EIA/RIMA, compensação ambiental e outorga.",
    ownerName: "Terra Nova Participações",
    contactName: "Junior Lopes",
    contactPhone: "5519994960304",
    contactEmail: "junior.lopes@creci.org.br",
    featured: true,
    photos: [PHOTOS.aerea, PHOTOS.rodovia, PHOTOS.terreno],
    documents: [
      { name: "Matrícula — PAU-005.pdf", category: "Matrícula", mimeType: "application/pdf" },
      { name: "Estudo ambiental preliminar.pdf", category: "Laudo", mimeType: "application/pdf" },
    ],
    activity: "Alerta ambiental registrado: validar APP e dutos antes de qualquer proposta.",
  },
  {
    code: "PIR-006",
    name: "Área Piracicaba — Distrito Unileste",
    kind: "terreno",
    status: "disponivel",
    description:
      "Área industrial de 85.000 m² no Distrito Industrial Unileste, em Piracicaba, com frente para a SP-304 e acesso à Rodovia Luiz de Queiroz. Região consolidada por indústrias de bioenergia, metalurgia e agroindústria, com disponibilidade de mão de obra e infraestrutura completa. Ideal para planta industrial ou centro de distribuição regional.",
    city: "Piracicaba",
    neighborhood: "Distrito Industrial Unileste",
    address: "Rodovia Luiz de Queiroz (SP-304), km 160 — Piracicaba/SP",
    zipCode: "13422-000",
    lat: -22.7,
    lng: -47.6,
    radius: 360,
    landAreaM2: 85000,
    builtAreaM2: 0,
    pricePerM2: 305,
    totalPrice: 25925000,
    zoning: "ZUPI — Zona de Uso Predominantemente Industrial",
    zoningNotes: "Permite indústrias de médio e grande porte, com taxa de ocupação máxima de 60%.",
    environmentalRestriction: false,
    environmentalNotes: "Área fora de APP. Licenciamento simplificado para uso industrial classe 2.",
    ownerName: "Agro Industrial Piracicaba S/A",
    contactName: "Junior Lopes",
    contactPhone: "5519994960304",
    contactEmail: "junior.lopes@creci.org.br",
    featured: false,
    photos: [PHOTOS.aerea, PHOTOS.terreno],
    documents: [{ name: "Matrícula — PIR-006.pdf", category: "Matrícula", mimeType: "application/pdf" }],
    activity: "Ativo cadastrado com perímetro importado de KMZ do proprietário.",
  },
  {
    code: "IND-007",
    name: "Galpão Indaiatuba — Eixo SP-075",
    kind: "galpao",
    status: "disponivel",
    description:
      "Galpão de 14.000 m² em terreno de 32.000 m² no Distrito Industrial de Indaiatuba, com frente para a Rodovia Santos Dumont (SP-075). Estrutura metálica, pé-direito de 10 m, 6 docas e pátio de manobras. Área remanescente permite expansão de mais 8.000 m², aproveitando a demanda de galpões classe A no vetor sul da RMC.",
    city: "Indaiatuba",
    neighborhood: "Distrito Industrial",
    address: "Rodovia Santos Dumont (SP-075), km 62 — Indaiatuba/SP",
    zipCode: "13330-000",
    lat: -23.092,
    lng: -47.21,
    radius: 220,
    landAreaM2: 32000,
    builtAreaM2: 14000,
    pricePerM2: 1280,
    totalPrice: 40960000,
    zoning: "Zona Industrial (ZI-2)",
    zoningNotes: "Permite ampliação até 70% de taxa de ocupação mediante aprovação de projeto.",
    environmentalRestriction: false,
    environmentalNotes: "Sem APP na gleba. Verificar plano de drenagem do córrego Santa Rita.",
    ownerName: "Indaiatuba Logística Ltda.",
    contactName: "Junior Lopes",
    contactPhone: "5519994960304",
    contactEmail: "junior.lopes@creci.org.br",
    featured: false,
    photos: [PHOTOS.fachada, PHOTOS.armazem],
    documents: [
      { name: "Matrícula — IND-007.pdf", category: "Matrícula", mimeType: "application/pdf" },
      { name: "Projeto de expansão.pdf", category: "Projeto", mimeType: "application/pdf" },
    ],
    activity: "Potencial de expansão de 8.000 m² identificado pela inteligência Land Bank.",
  },
  {
    code: "MMO-008",
    name: "Área Monte Mor — Frente SP-101",
    kind: "terreno",
    status: "disponivel",
    description:
      "Gleba de 15 hectares às margens da Rodovia SP-101, em Monte Mor, com topografia plana e solo firme. Área com grande apelo para condomínios logísticos de alto padrão, pátios de containers e operações de e-commerce, com raio de 25 km de Campinas e acesso rápido à Anhanguera. Ambiente com forte expansão de galpões nos últimos cinco anos.",
    city: "Monte Mor",
    neighborhood: "Jardim Capuavinha",
    address: "Rodovia SP-101, km 14 — Monte Mor/SP",
    zipCode: "13190-000",
    lat: -22.9467,
    lng: -47.315,
    radius: 480,
    landAreaM2: 150000,
    builtAreaM2: 0,
    pricePerM2: 298,
    totalPrice: 44700000,
    zoning: "Zona de Expansão Industrial (ZEI)",
    zoningNotes: "Uso industrial e logístico permitido mediante estudo de impacto de vizinhança.",
    environmentalRestriction: false,
    environmentalNotes: "Verificar faixa de drenagem e área de recarga do aquífero na porção sul.",
    ownerName: "Monte Mor Agropecuária Ltda.",
    contactName: "Junior Lopes",
    contactPhone: "5519994960304",
    contactEmail: "junior.lopes@creci.org.br",
    featured: false,
    photos: [PHOTOS.terreno, PHOTOS.aerea],
    documents: [{ name: "Matrícula — MMO-008.pdf", category: "Matrícula", mimeType: "application/pdf" }],
    activity: "Benchmark regional atualizado: R$ 315/m² para terrenos logísticos em Monte Mor.",
  },
  {
    code: "SUM-009",
    name: "Sítio Urbano Sumaré — Bairro Matão",
    kind: "misto",
    status: "em_estudo",
    description:
      "Sítio urbano de 18.000 m² no Bairro Matão, em Sumaré, com casa sede e benfeitorias. Área com potencial para loteamento residencial de médio padrão ou empreendimento misto, em região com infraestrutura consolidada, comércio local e acesso à Rodovia Bandeirantes. Estudo urbanístico inicial indica possibilidade de 60 lotes.",
    city: "Sumaré",
    neighborhood: "Bairro Matão",
    address: "Estrada Municipal do Matão, 900 — Sumaré/SP",
    zipCode: "13170-000",
    lat: -22.839,
    lng: -47.241,
    radius: 160,
    landAreaM2: 18000,
    builtAreaM2: 600,
    pricePerM2: 690,
    totalPrice: 12420000,
    zoning: "Zona Residencial de Densidade Média (ZR-2)",
    zoningNotes: "Necessária aprovação de loteamento e doação de áreas institucionais (35%).",
    environmentalRestriction: false,
    environmentalNotes: "Sem APP mapeada. Recomendada análise de árvores isoladas e drenagem.",
    ownerName: "Espólio Ferreira",
    contactName: "Junior Lopes",
    contactPhone: "5519994960304",
    contactEmail: "junior.lopes@creci.org.br",
    featured: false,
    photos: [PHOTOS.terreno],
    documents: [{ name: "Matrícula — SUM-009.pdf", category: "Matrícula", mimeType: "application/pdf" }],
    activity: "Estudo urbanístico preliminar anexado ao dossiê.",
  },
  {
    code: "SUM-011",
    name: "Chácara Sumaré — Bairro Área Cura (cancelado)",
    kind: "misto",
    status: "cancelado",
    description:
      "Imóvel retirado do portfólio ativo após reprovação da análise de due diligence: matrícula com divergência de área e restrição de drenagem identificada. Mantido no histórico para consulta e comparativo de mercado.",
    city: "Sumaré",
    neighborhood: "Área Cura",
    address: "Rua das Acácias, 455 — Sumaré/SP",
    zipCode: "13178-000",
    lat: -22.8032,
    lng: -47.3105,
    radius: 150,
    landAreaM2: 9500,
    builtAreaM2: 320,
    pricePerM2: 640,
    totalPrice: 6080000,
    zoning: "Zona Residencial (ZR-1)",
    zoningNotes: "Uso residencial unifamiliar — incompatível com a tese logística da Land Bank Corp.",
    environmentalRestriction: true,
    environmentalNotes: "Faixa de drenagem do córrego Área Cura e divergência de matrícula.",
    ownerName: "Espólio Andrade",
    contactName: "Junior Lopes",
    contactPhone: "5519994960304",
    contactEmail: "junior.lopes@creci.org.br",
    featured: false,
    photos: [PHOTOS.terreno],
    documents: [{ name: "Matrícula — SUM-011.pdf", category: "Matrícula", mimeType: "application/pdf" }],
    activity: "Cadastro cancelado: fora do controle operacional, disponível apenas para consulta.",
  },
  {
    code: "LIM-010",
    name: "Galpão Limeira — Rodovia Anhanguera",
    kind: "galpao",
    status: "vendido",
    description:
      "Galpão de 9.600 m² em terreno de 48.000 m², com frente para a Rodovia Anhanguera em Limeira. Ativo vendido em 2025 para operador logístico nacional, registrado no portfólio como referência de pricing e de performance para a tese de galpões da Land Bank Corp.",
    city: "Limeira",
    neighborhood: "Distrito Industrial",
    address: "Rodovia Anhanguera (SP-330), km 142 — Limeira/SP",
    zipCode: "13480-000",
    lat: -22.5647,
    lng: -47.4017,
    radius: 320,
    landAreaM2: 48000,
    builtAreaM2: 9600,
    pricePerM2: 620,
    totalPrice: 29760000,
    zoning: "Zona Industrial (ZI)",
    zoningNotes: "Uso industrial consolidado com licença de operação vigente.",
    environmentalRestriction: false,
    environmentalNotes: "Regularizado.",
    ownerName: "Limeira Logística S/A",
    contactName: "Junior Lopes",
    contactPhone: "5519994960304",
    contactEmail: "junior.lopes@creci.org.br",
    featured: false,
    photos: [PHOTOS.armazem, PHOTOS.fachada],
    documents: [{ name: "Matrícula — LIM-010.pdf", category: "Matrícula", mimeType: "application/pdf" }],
    activity: "Ativo vendido — mantido no portfólio como referência de mercado.",
  },
];

const DDL = [
  `CREATE TABLE IF NOT EXISTS areas (
    id serial PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    kind text NOT NULL DEFAULT 'terreno',
    status text NOT NULL DEFAULT 'disponivel',
    description text NOT NULL DEFAULT '',
    city text NOT NULL,
    city_slug text NOT NULL,
    neighborhood text NOT NULL DEFAULT '',
    address text NOT NULL DEFAULT '',
    zip_code text NOT NULL DEFAULT '',
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    land_area_m2 double precision NOT NULL DEFAULT 0,
    built_area_m2 double precision NOT NULL DEFAULT 0,
    price_per_m2 double precision NOT NULL DEFAULT 0,
    total_price double precision NOT NULL DEFAULT 0,
    zoning text NOT NULL DEFAULT '',
    zoning_notes text NOT NULL DEFAULT '',
    environmental_restriction boolean NOT NULL DEFAULT false,
    environmental_notes text NOT NULL DEFAULT '',
    geometry jsonb NOT NULL DEFAULT '[]'::jsonb,
    map_view jsonb,
    transaction text NOT NULL DEFAULT 'venda',
    partner_name text NOT NULL DEFAULT '',
    partner_phone text NOT NULL DEFAULT '',
    listing_url text NOT NULL DEFAULT '',
    kmz_file_name text,
    owner_name text NOT NULL DEFAULT '',
    contact_name text NOT NULL DEFAULT '',
    contact_phone text NOT NULL DEFAULT '',
    contact_email text NOT NULL DEFAULT '',
    featured boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS areas_city_slug_idx ON areas (city_slug)`,
  `CREATE TABLE IF NOT EXISTS media (
    id serial PRIMARY KEY,
    area_id integer NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    kind text NOT NULL DEFAULT 'photo',
    category text NOT NULL DEFAULT 'outro',
    name text NOT NULL,
    mime_type text NOT NULL DEFAULT 'application/octet-stream',
    size integer NOT NULL DEFAULT 0,
    caption text NOT NULL DEFAULT '',
    data text,
    external_url text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS media_area_idx ON media (area_id)`,
  `ALTER TABLE areas ADD COLUMN IF NOT EXISTS map_view jsonb`,
  `ALTER TABLE ibge_cities ADD COLUMN IF NOT EXISTS median_income double precision NOT NULL DEFAULT 0`,
  `ALTER TABLE ibge_cities ADD COLUMN IF NOT EXISTS formal_min_wages double precision NOT NULL DEFAULT 0`,
  `ALTER TABLE ibge_cities ADD COLUMN IF NOT EXISTS formal_avg_salary double precision NOT NULL DEFAULT 0`,
  `ALTER TABLE ibge_cities ADD COLUMN IF NOT EXISTS ibge_checked_at timestamptz`,
  `ALTER TABLE ibge_cities ADD COLUMN IF NOT EXISTS consumption_potential double precision NOT NULL DEFAULT 0`,
  `ALTER TABLE terrain_analyses ADD COLUMN IF NOT EXISTS resolution integer NOT NULL DEFAULT 30`,
  `ALTER TABLE terrain_analyses ADD COLUMN IF NOT EXISTS view_config jsonb`,
  `ALTER TABLE areas ADD COLUMN IF NOT EXISTS transaction text NOT NULL DEFAULT 'venda'`,
  `ALTER TABLE areas ADD COLUMN IF NOT EXISTS partner_name text NOT NULL DEFAULT ''`,
  `ALTER TABLE areas ADD COLUMN IF NOT EXISTS partner_phone text NOT NULL DEFAULT ''`,
  `ALTER TABLE areas ADD COLUMN IF NOT EXISTS listing_url text NOT NULL DEFAULT ''`,
  `ALTER TABLE terrain_analyses ADD COLUMN IF NOT EXISTS cross_profile jsonb`,
  `ALTER TABLE terrain_analyses ADD COLUMN IF NOT EXISTS dem_comparison jsonb`,
  `ALTER TABLE terrain_analyses ADD COLUMN IF NOT EXISTS grid_lines jsonb`,
  `ALTER TABLE terrain_analyses ADD COLUMN IF NOT EXISTS grid_info jsonb`,
  `ALTER TABLE terrain_analyses ADD COLUMN IF NOT EXISTS dem_source text NOT NULL DEFAULT 'srtm30m'`,
  `ALTER TABLE terrain_analyses ADD COLUMN IF NOT EXISTS vertical_offset double precision NOT NULL DEFAULT 0`,
  `ALTER TABLE terrain_analyses ADD COLUMN IF NOT EXISTS dem_grid jsonb`,
  `CREATE TABLE IF NOT EXISTS area_restrictions (
    id serial PRIMARY KEY,
    area_id integer NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    type text NOT NULL DEFAULT 'app',
    geometry_type text NOT NULL DEFAULT 'polygon',
    axis_meta jsonb,
    label text NOT NULL DEFAULT '',
    notes text NOT NULL DEFAULT '',
    coordinates jsonb NOT NULL DEFAULT '[]'::jsonb,
    area_m2 double precision NOT NULL DEFAULT 0,
    gross_area_m2 double precision NOT NULL DEFAULT 0,
    outside_area_m2 double precision NOT NULL DEFAULT 0,
    loss_pct double precision NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS area_restrictions_area_idx ON area_restrictions (area_id)`,
  `ALTER TABLE area_restrictions ADD COLUMN IF NOT EXISTS geometry_type text NOT NULL DEFAULT 'polygon'`,
  `ALTER TABLE area_restrictions ADD COLUMN IF NOT EXISTS axis_meta jsonb`,
  `ALTER TABLE area_restrictions ADD COLUMN IF NOT EXISTS gross_area_m2 double precision NOT NULL DEFAULT 0`,
  `ALTER TABLE area_restrictions ADD COLUMN IF NOT EXISTS outside_area_m2 double precision NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS market_news (
    id serial PRIMARY KEY,
    day text NOT NULL,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    indices jsonb NOT NULL DEFAULT '[]'::jsonb,
    source text NOT NULL DEFAULT 'Google News · InfoMoney · Exame · Money Times',
    fetched_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS market_news_day_idx ON market_news (day)`,
  `CREATE TABLE IF NOT EXISTS activities (
    id serial PRIMARY KEY,
    area_id integer REFERENCES areas(id) ON DELETE CASCADE,
    type text NOT NULL DEFAULT 'info',
    title text NOT NULL,
    detail text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS activities_area_idx ON activities (area_id)`,
  `CREATE TABLE IF NOT EXISTS terrain_analyses (
    id serial PRIMARY KEY,
    area_id integer NOT NULL UNIQUE REFERENCES areas(id) ON DELETE CASCADE,
    interval double precision NOT NULL DEFAULT 5,
    buffer_m integer NOT NULL DEFAULT 250,
    source text NOT NULL DEFAULT 'SRTM 30m',
    contours jsonb NOT NULL DEFAULT '[]'::jsonb,
    stats jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS ibge_cities (
    id serial PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    ibge_code text NOT NULL,
    region text NOT NULL,
    population_2022 integer NOT NULL DEFAULT 0,
    population_2010 integer NOT NULL DEFAULT 0,
    area_km2 double precision NOT NULL DEFAULT 0,
    gdp_per_capita double precision NOT NULL DEFAULT 0,
    avg_income double precision NOT NULL DEFAULT 0,
    formal_min_wages double precision NOT NULL DEFAULT 0,
    formal_avg_salary double precision NOT NULL DEFAULT 0,
    median_income double precision NOT NULL DEFAULT 0,
    consumption_potential double precision NOT NULL DEFAULT 0,
    idhm double precision NOT NULL DEFAULT 0,
    urbanization double precision NOT NULL DEFAULT 0,
    market_price_m2 double precision NOT NULL DEFAULT 0,
    lat double precision NOT NULL DEFAULT 0,
    lng double precision NOT NULL DEFAULT 0,
    top_sectors text NOT NULL DEFAULT '',
    highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
    source text NOT NULL DEFAULT 'IBGE — Censo 2022 / Cidades',
    ibge_checked_at timestamptz
  )`,
];

let bootstrapPromise: Promise<void> | null = null;

async function runBootstrap(): Promise<void> {
  // Production schema is provisioned by versioned Supabase migrations.
  // Do not execute runtime DDL against managed production tables on requests.
  if (process.env.NODE_ENV !== "production") {
    for (const statement of DDL) {
      await db.execute(sql.raw(statement));
    }
  }

  await db.insert(cities).values(
    CITY_SEED.map((city) => ({
      ...city,
      consumptionPotential: city.consumptionPotential > 0 ? city.consumptionPotential : city.population2022 * city.avgIncome * 12,
    })),
  ).onConflictDoNothing();

  // Normaliza nomes gravados como slug (ex.: "santos" → "Santos")
  await db.execute(sql`
    UPDATE ibge_cities c
    SET name = i.name
    FROM (VALUES ${sql.join(
      (SP_INDICATORS as SpIndicatorRow[]).map((city) => sql`(${city.code}, ${city.name})`),
      sql`, `,
    )}) AS i(code, name)
    WHERE c.ibge_code = i.code AND c.name = lower(c.name)
  `);

  // Backfill de renda mediana e potencial de consumo (auditoria de renda)
  await db.execute(sql`
    UPDATE ibge_cities
    SET median_income = ROUND(avg_income * 0.68),
        consumption_potential = population_2022 * avg_income * 12
    WHERE avg_income > 0 AND (median_income = 0 OR consumption_potential = 0)
  `);

  // Grava o salário médio dos trabalhadores FORMAIS (CEMPRE/IBGE 2023) e sua
  // conversão em reais pelo piso paulista vigente.
  for (const indicator of SP_INDICATORS as SpIndicatorRow[]) {
    const wages = indicator.minWages2023 ?? 0;
    if (wages <= 0) continue;
    const brl = Math.round(wages * SP_MINIMUM_WAGE * 100) / 100;
    await db.execute(sql`
      UPDATE ibge_cities
      SET formal_min_wages = ${wages}, formal_avg_salary = ${brl}
      WHERE ibge_code = ${indicator.code}
        AND (formal_min_wages <> ${wages} OR formal_avg_salary <> ${brl})
    `);
  }

  // Corrige rendas gravadas pelo modelo antigo (razão linear PIB × 4,61%),
  // que inflava municípios industriais (ex.: Itupeva R$ 6.874 → R$ 2.165).
  for (const indicator of SP_INDICATORS as SpIndicatorRow[]) {
    if (!indicator.avgIncome) continue;
    await db.execute(sql`
      UPDATE ibge_cities
      SET avg_income = ${indicator.avgIncome},
          median_income = ${indicator.medianIncome},
          consumption_potential = ${indicator.population2022 * indicator.avgIncome * 12},
          source = ${`IBGE — Censo 2022 / PIB 2023 / IDHM 2010 · renda ${indicator.incomeSource}`}
      WHERE ibge_code = ${indicator.code}
        AND (avg_income = 0 OR avg_income > ${indicator.avgIncome * 1.6})
    `);
  }

  // Base completa do Estado de São Paulo (IBGE): 645 municípios para novos cadastros.
  /**
   * Base IBGE embarcada: população (Censo 2022), PIB per capita (2023), IDHM 2010
   * e renda média/mediana já calibrada (Censo 2022 medido ou modelo PIB+IDHM).
   */
  type SpIndicatorRow = {
    code: string;
    name: string;
    population2022: number;
    gdpPerCapita: number;
    areaKm2: number;
    idhm: number;
    avgIncome: number;
    medianIncome: number;
    incomeSource: string;
    minWages2023?: number | null;
    formalSalary2023Brl?: number | null;
  };
  const indicatorByCode = new Map<string, SpIndicatorRow>(
    (SP_INDICATORS as SpIndicatorRow[]).map((city) => [city.code, city]),
  );

  const spSeed = (SP_MUNICIPALITIES as { code: string; name: string; lat: number; lng: number }[]).map((city) => {
    const indicator = indicatorByCode.get(city.code);
    const avgIncome = indicator?.avgIncome ?? 0;
    const population = indicator?.population2022 ?? 0;
    const formalMinWages = indicator?.minWages2023 ?? 0;
    const formalAvgSalary = formalMinWages > 0 ? Math.round(formalMinWages * SP_MINIMUM_WAGE * 100) / 100 : 0;
    return {
      slug: citySlugOf(city.name),
      name: city.name,
      ibgeCode: city.code,
      region: "São Paulo · base IBGE",
      population2022: population,
      population2010: 0,
      areaKm2: indicator?.areaKm2 ?? 0,
      gdpPerCapita: indicator?.gdpPerCapita ?? 0,
      avgIncome,
      formalMinWages,
      formalAvgSalary,
      medianIncome: indicator?.medianIncome ?? 0,
      consumptionPotential: population * avgIncome * 12,
      idhm: indicator?.idhm ?? 0,
      urbanization: 0,
      marketPriceM2: 0,
      lat: city.lat,
      lng: city.lng,
      topSectors: "",
      highlights: [],
      source: `IBGE — Censo 2022 / CEMPRE 2023 / PIB 2023 / IDHM 2010 · renda ${indicator?.incomeSource ?? "estimada"}`,
    };
  });
  for (let index = 0; index < spSeed.length; index += 200) {
    await db.insert(cities).values(spSeed.slice(index, index + 200)).onConflictDoNothing();
  }

  await db.execute(sql`SELECT pg_advisory_lock(4815162342)`);
  try {
    const existing = await db.select({ id: areas.id }).from(areas).limit(1);
    if (existing.length === 0) {
      for (const seed of SEED_AREAS) {
        const geometry: GeoPolygon[] = [
          {
            coordinates: ringAround(seed.lat, seed.lng, seed.radius),
            label: seed.name,
          },
        ];
        const [inserted] = await db
          .insert(areas)
          .values({
            code: seed.code,
            name: seed.name,
            kind: seed.kind,
            status: seed.status,
            description: seed.description,
            city: seed.city,
            citySlug: citySlugOf(seed.city),
            neighborhood: seed.neighborhood,
            address: seed.address,
            zipCode: seed.zipCode,
            lat: seed.lat,
            lng: seed.lng,
            landAreaM2: seed.landAreaM2,
            builtAreaM2: seed.builtAreaM2,
            pricePerM2: seed.pricePerM2,
            totalPrice: seed.totalPrice,
            zoning: seed.zoning,
            zoningNotes: seed.zoningNotes,
            environmentalRestriction: seed.environmentalRestriction,
            environmentalNotes: seed.environmentalNotes,
            geometry,
            kmzFileName: `${seed.code}-perimetro.kmz`,
            ownerName: seed.ownerName,
            contactName: seed.contactName,
            contactPhone: seed.contactPhone,
            contactEmail: seed.contactEmail,
            featured: seed.featured,
            transaction: /galp/i.test(seed.kind) || /-00[147]$/.test(seed.code) ? "locacao" : "venda",
            partnerName: seed.featured ? "Junior Lopes" : "",
            partnerPhone: seed.featured ? "5519994960304" : "",
          })
          .returning({ id: areas.id });

        if (!inserted) continue;

        await db.insert(media).values([
          ...seed.photos.map((url, index) => ({
            areaId: inserted.id,
            kind: "photo",
            category: index === 0 ? "capa" : "fachada",
            name: url.split("/").pop() ?? "foto.jpg",
            mimeType: "image/jpeg",
            externalUrl: url,
            sortOrder: index,
          })),
          ...seed.documents.map((doc, index) => ({
            areaId: inserted.id,
            kind: "document",
            category: doc.category,
            name: doc.name,
            mimeType: doc.mimeType,
            externalUrl: "/docs/documento-exemplo.pdf",
            size: 48210,
            sortOrder: index,
          })),
        ]);

        await db.insert(activities).values([
          {
            areaId: inserted.id,
            type: "created",
            title: "Ativo cadastrado no Land Bank",
            detail: "Cadastro criado com dados de IBGE, perímetro e dossiê documental.",
          },
          {
            areaId: inserted.id,
            type: "import",
            title: "Perímetro importado de KMZ",
            detail: `${seed.code}-perimetro.kmz · dados da cidade vinculados automaticamente.`,
          },
          {
            areaId: inserted.id,
            type: "intel",
            title: "Análise de inteligência",
            detail: seed.activity,
          },
        ]);
      }
    }
    // Garante um exemplo de imóvel cancelado para a tela de Consultas (idempotente).
    const cancelledDemo = SEED_AREAS.find((seed) => seed.code === "SUM-011");
    if (cancelledDemo) {
      const existingCancelled = await db
        .select({ id: areas.id })
        .from(areas)
        .where(eq(areas.code, cancelledDemo.code))
        .limit(1);
      if (existingCancelled.length === 0) {
        const [inserted] = await db
          .insert(areas)
          .values({
            code: cancelledDemo.code,
            name: cancelledDemo.name,
            kind: cancelledDemo.kind,
            status: cancelledDemo.status,
            description: cancelledDemo.description,
            city: cancelledDemo.city,
            citySlug: citySlugOf(cancelledDemo.city),
            neighborhood: cancelledDemo.neighborhood,
            address: cancelledDemo.address,
            zipCode: cancelledDemo.zipCode,
            lat: cancelledDemo.lat,
            lng: cancelledDemo.lng,
            landAreaM2: cancelledDemo.landAreaM2,
            builtAreaM2: cancelledDemo.builtAreaM2,
            pricePerM2: cancelledDemo.pricePerM2,
            totalPrice: cancelledDemo.totalPrice,
            zoning: cancelledDemo.zoning,
            zoningNotes: cancelledDemo.zoningNotes,
            environmentalRestriction: cancelledDemo.environmentalRestriction,
            environmentalNotes: cancelledDemo.environmentalNotes,
            geometry: [{ coordinates: ringAround(cancelledDemo.lat, cancelledDemo.lng, cancelledDemo.radius), label: cancelledDemo.name }],
            kmzFileName: `${cancelledDemo.code}-perimetro.kmz`,
            ownerName: cancelledDemo.ownerName,
            contactName: cancelledDemo.contactName,
            contactPhone: cancelledDemo.contactPhone,
            contactEmail: cancelledDemo.contactEmail,
            featured: false,
          })
          .returning({ id: areas.id });
        if (inserted) {
          await db.insert(media).values({
            areaId: inserted.id,
            kind: "document",
            category: "Matrícula",
            name: "Matrícula — SUM-011.pdf",
            mimeType: "application/pdf",
            externalUrl: "/docs/documento-exemplo.pdf",
            size: 48210,
          });
          await db.insert(activities).values({
            areaId: inserted.id,
            type: "cancelled",
            title: "Cadastro cancelado",
            detail: "Ativo retirado do controle operacional — disponível apenas para consulta.",
          });
        }
      }
    }
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(4815162342)`);
  }
}

function citySlugOf(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function ensureDatabase(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }
  return bootstrapPromise;
}
