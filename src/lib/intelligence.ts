import type { Area, City } from "@/db/schema";
import { distanceKm } from "@/lib/geo";
import { LOGISTIC_HUBS } from "@/lib/cities";
import { brl, num } from "@/lib/format";
import { CONTACT } from "@/lib/contact";

export type AreaRecord = Area & {
  photoCount: number;
  documentCount: number;
  coverUrl: string | null;
  hasKmz: boolean;
};

export type ScorePillar = {
  key: string;
  label: string;
  score: number;
  weight: number;
  note: string;
};

export type AreaIntel = {
  score: number;
  grade: string;
  pillars: ScorePillar[];
  insights: string[];
  alerts: string[];
  benchmark: number;
  marketDeltaPct: number;
  landEquivalentPrice: number;
  pricePerHa: number;
  distances: { sumare: number; campinas: number; viracopos: number; piracicaba: number };
  bestHub: string;
  bestHubKm: number;
};

export type PortfolioSummary = {
  totalAreas: number;
  activeAreas: number;
  totalLandM2: number;
  totalBuiltM2: number;
  vgv: number;
  avgPriceM2: number;
  citiesCount: number;
  statusCounts: Record<string, number>;
  kindCounts: Record<string, number>;
  cityCounts: { city: string; count: number; landM2: number; vgv: number }[];
  alertsCount: number;
  avgScore: number;
  occupancy: number;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const HUB_KEYS = {
  sumare: LOGISTIC_HUBS[3],
  campinas: LOGISTIC_HUBS[0],
  viracopos: LOGISTIC_HUBS[1],
  piracicaba: LOGISTIC_HUBS[2],
};

export function buildIntel(area: Area, city: City | undefined, counts: { photos: number; documents: number }): AreaIntel {
  const point = { lat: area.lat, lng: area.lng };
  const distances = {
    sumare: distanceKm(point, HUB_KEYS.sumare),
    campinas: distanceKm(point, HUB_KEYS.campinas),
    viracopos: distanceKm(point, HUB_KEYS.viracopos),
    piracicaba: distanceKm(point, HUB_KEYS.piracicaba),
  };
  const bestEntry = Object.entries(distances).sort((a, b) => a[1] - b[1])[0];
  const bestHub = (HUB_KEYS as Record<string, { name: string }>)[bestEntry[0]]?.name ?? "Campinas";
  const benchmark = city?.marketPriceM2 ?? 320;
  const builtRatio = area.landAreaM2 > 0 ? area.builtAreaM2 / area.landAreaM2 : 0;
  // Em galpões o preço por m² embute a construção: descontamos o valor das benfeitorias
  // para comparar o solo com o benchmark de terreno da cidade.
  const landEquivalentPrice =
    area.pricePerM2 > 0 ? Math.round(area.pricePerM2 / (1 + builtRatio * 1.6)) : 0;
  const marketDeltaPct =
    landEquivalentPrice > 0 && benchmark > 0 ? ((landEquivalentPrice - benchmark) / benchmark) * 100 : 0;
  const pricePerHa = area.pricePerM2 * 10_000;
  const hasKmz = area.geometry.length > 0 || Boolean(area.kmzFileName);
  const accessText = `${area.address} ${area.name} ${area.neighborhood}`.toLowerCase();
  const onHighway = /(rodovia|sp-\d{2,3}|anhanguera|bandeirantes|luiz de queiroz|santos dumont|washington|castelo|dom pedro|sp-)/i.test(
    accessText,
  );

  const locationScore = clamp(
    (city ? clamp((city.avgIncome / 2600) * 55 + 25, 0, 80) : 45) + (onHighway ? 20 : 6),
  );

  const logisticsScore = clamp(
    100 -
      Math.min(60, distances.viracopos * 0.9) -
      Math.min(30, distances.campinas * 0.4) +
      (onHighway ? 14 : 0),
  );

  const priceScore =
    area.pricePerM2 > 0
      ? clamp(62 - (marketDeltaPct / 100) * 55 + clamp((area.landAreaM2 / 100_000) * 12, 0, 14))
      : 42;

  const occupancy = area.landAreaM2 > 0 ? area.builtAreaM2 / area.landAreaM2 : 0;
  const builtScore =
    area.kind === "galpao"
      ? clamp(40 + (occupancy > 0.15 && occupancy < 0.65 ? 45 : 15) + Math.min(15, area.builtAreaM2 / 2500))
      : clamp(35 + Math.min(45, area.landAreaM2 / 5000) + (area.kind === "misto" ? 8 : 0));

  const zoningRisk = (area.zoningNotes || area.zoning || "").toLowerCase();
  const zoningFriendly = /(industrial|logíst|logist|urbano|misto|eixo)/i.test(zoningRisk);
  const riskScore = clamp(
    74 + (zoningFriendly ? 14 : -6) - (area.environmentalRestriction ? 34 : 0) + (hasKmz ? 6 : -8),
  );

  const dataScore = clamp(
    28 +
      (hasKmz ? 22 : 0) +
      Math.min(18, counts.photos * 6) +
      Math.min(16, counts.documents * 8) +
      (area.description.length > 180 ? 10 : area.description.length > 60 ? 5 : 0) +
      (area.contactName ? 6 : 0),
  );

  const pillars: ScorePillar[] = [
    {
      key: "mercado",
      label: "Localização & mercado",
      score: Math.round(locationScore),
      weight: 0.22,
      note: city
        ? `${city.name} · renda média ${brl(city.avgIncome)} · IDHM ${city.idhm.toFixed(3)}`
        : "Município sem base IBGE vinculada",
    },
    {
      key: "logistica",
      label: "Logística & acessos",
      score: Math.round(logisticsScore),
      weight: 0.2,
      note: `${distances.viracopos} km de Viracopos · ${distances.campinas} km de Campinas${onHighway ? " · frente rodoviária" : ""}`,
    },
    {
      key: "preco",
      label: "Preço vs. mercado",
      score: Math.round(priceScore),
      weight: 0.2,
      note: `R$/m² ${num(area.pricePerM2)} (solo equiv. ${num(landEquivalentPrice)}) · benchmark ${num(benchmark)} (${marketDeltaPct >= 0 ? "+" : ""}${num(marketDeltaPct)}%)`,
    },
    {
      key: "aproveitamento",
      label: "Aproveitamento & produto",
      score: Math.round(builtScore),
      weight: 0.15,
      note:
        area.kind === "galpao"
          ? `${num(area.builtAreaM2)} m² construídos · ocupação ${num(occupancy * 100)}% do terreno`
          : `${num(area.landAreaM2)} m² de terreno${area.kind === "misto" ? " · produto misto" : ""}`,
    },
    {
      key: "risco",
      label: "Zoneamento & risco",
      score: Math.round(riskScore),
      weight: 0.13,
      note: `${area.zoning || "Zoneamento não informado"}${area.environmentalRestriction ? " · restrição ambiental" : " · sem restrição mapeada"}`,
    },
    {
      key: "dados",
      label: "Completude do dossiê",
      score: Math.round(dataScore),
      weight: 0.1,
      note: `${counts.photos} foto(s) · ${counts.documents} documento(s) · ${hasKmz ? "KMZ carregado" : "sem KMZ"}`,
    },
  ];

  const score = Math.round(pillars.reduce((sum, pillar) => sum + pillar.score * pillar.weight, 0));
  const grade =
    score >= 82 ? "Alta prioridade" : score >= 70 ? "Ativo estratégico" : score >= 58 ? "Monitorar" : "Revisar tese";

  const insights: string[] = [];
  if (marketDeltaPct <= -8) {
    insights.push(
      `Preço pedido ${num(Math.abs(marketDeltaPct))}% abaixo do benchmark de ${city?.name ?? "região"} (${brl(benchmark)}/m²) — margem para arbitragem.`,
    );
  } else if (marketDeltaPct >= 12) {
    insights.push(
      `Preço ${num(marketDeltaPct)}% acima do benchmark regional — exige diferenciação de produto ou laudo de valor.`,
    );
  } else {
    insights.push(`Preço alinhado ao benchmark regional (${brl(benchmark)}/m²) para ${city?.name ?? "a região"}.`);
  }
  if (area.kind === "galpao" && occupancy > 0 && occupancy < 0.45) {
    insights.push(
      `Potencial de expansão: apenas ${num(occupancy * 100)}% do terreno está construído — há ${num(area.landAreaM2 - area.builtAreaM2)} m² de área livre.`,
    );
  }
  if (distances.viracopos <= 35) {
    insights.push(
      `Raio de ${distances.viracopos} km do aeroporto de Viracopos, faixa preferencial para operações de e-commerce e carga aérea.`,
    );
  }
  if (city) {
    const growth = city.population2010 > 0 ? ((city.population2022 / city.population2010 - 1) * 100) : 0;
    insights.push(
      `${city.name} cresceu ${num(growth)}% entre 2010 e 2022 (${num(city.population2022)} habitantes) com renda média de ${brl(city.avgIncome)}.`,
    );
  }

  const alerts: string[] = [];
  if (!hasKmz) alerts.push("Perímetro KMZ ausente — polígono não validado.");
  if (counts.photos === 0) alerts.push("Nenhuma foto cadastrada para o material de apresentação.");
  if (counts.documents === 0) alerts.push("Dossiê sem documentos (matrícula, planta ou projeto).");
  if (area.environmentalRestriction) alerts.push("Restrição ambiental declarada — validar APP, reserva legal e licenciamento.");
  if (marketDeltaPct > 22) alerts.push("Preço 22%+ acima do benchmark regional — revisar tese de valor.");
  if (!area.contactName) alerts.push("Contato do proprietário não informado.");
  if (area.totalPrice <= 0) alerts.push("Valor total do imóvel não informado.");

  return {
    score,
    grade,
    pillars,
    insights,
    alerts,
    benchmark,
    marketDeltaPct: Math.round(marketDeltaPct * 10) / 10,
    landEquivalentPrice,
    pricePerHa,
    distances,
    bestHub,
    bestHubKm: bestEntry[1],
  };
}

export function scoreOf(area: Area, city: City | undefined, counts: { photos: number; documents: number }): number {
  return buildIntel(area, city, counts).score;
}

export function summarize(records: AreaRecord[], cityMap: Map<string, City>): PortfolioSummary {
  const totalAreas = records.length;
  const activeAreas = records.filter((record) => record.status !== "vendido").length;
  const totalLandM2 = records.reduce((sum, record) => sum + record.landAreaM2, 0);
  const totalBuiltM2 = records.reduce((sum, record) => sum + record.builtAreaM2, 0);
  const vgv = records.reduce((sum, record) => sum + record.totalPrice, 0);
  const priced = records.filter((record) => record.pricePerM2 > 0);
  const avgPriceM2 = priced.length
    ? priced.reduce((sum, record) => sum + record.pricePerM2, 0) / priced.length
    : 0;

  const cityCounts = new Map<string, { city: string; count: number; landM2: number; vgv: number }>();
  for (const record of records) {
    const key = record.city;
    const current = cityCounts.get(key) ?? { city: key, count: 0, landM2: 0, vgv: 0 };
    current.count += 1;
    current.landM2 += record.landAreaM2;
    current.vgv += record.totalPrice;
    cityCounts.set(key, current);
  }

  const statusCounts: Record<string, number> = {};
  const kindCounts: Record<string, number> = {};
  let alertsCount = 0;
  let scoreSum = 0;

  for (const record of records) {
    statusCounts[record.status] = (statusCounts[record.status] ?? 0) + 1;
    kindCounts[record.kind] = (kindCounts[record.kind] ?? 0) + 1;
    const intel = buildIntel(record, cityMap.get(record.citySlug), {
      photos: record.photoCount,
      documents: record.documentCount,
    });
    alertsCount += intel.alerts.length;
    scoreSum += intel.score;
  }

  return {
    totalAreas,
    activeAreas,
    totalLandM2,
    totalBuiltM2,
    vgv,
    avgPriceM2,
    citiesCount: cityCounts.size,
    statusCounts,
    kindCounts,
    cityCounts: [...cityCounts.values()].sort((a, b) => b.landM2 - a.landM2),
    alertsCount,
    avgScore: totalAreas ? Math.round(scoreSum / totalAreas) : 0,
    occupancy: totalLandM2 ? (totalBuiltM2 / totalLandM2) * 100 : 0,
  };
}

export function shareSummary(
  area: Area,
  city: City | undefined,
  intel: AreaIntel,
  baseUrl: string,
): { subject: string; text: string; whatsappUrl: string; mailtoUrl: string; link: string } {
  const link = `${baseUrl}/apresentacao/${encodeURIComponent(area.code)}`;
  const location = [area.neighborhood, area.city, "SP"].filter(Boolean).join(", ");
  const lines = [
    `*${area.name}*`,
    `Código: ${area.code} · ${area.kind === "galpao" ? "Galpão / logística" : area.kind === "misto" ? "Uso misto" : "Terreno"}`,
    `Localização: ${location}`,
    area.address ? `Endereço: ${area.address}` : "",
    `Terreno: ${num(area.landAreaM2)} m² (${num(area.landAreaM2 / 10_000, 2)} ha)`,
    area.builtAreaM2 > 0 ? `Construção: ${num(area.builtAreaM2)} m²` : "",
    `Valor por m²: ${brl(area.pricePerM2)} · Total: ${brl(area.totalPrice)}`,
    `Zoneamento: ${area.zoning || "não informado"}`,
    area.environmentalRestriction ? `Restrição ambiental: ${area.environmentalNotes || "sim"}` : "",
    city
      ? `IBGE ${city.name}: ${num(city.population2022)} hab · renda média ${brl(city.avgIncome)} · IDHM ${city.idhm.toFixed(3)}`
      : "",
    `Land Score: ${intel.score}/100 (${intel.grade})`,
    "",
    `Contato: ${CONTACT.name} · ${CONTACT.phoneDisplay} · ${CONTACT.email}`,
    `Apresentação completa: ${link}`,
  ].filter(Boolean);

  const text = lines.join("\n");
  const subject = `${area.code} · ${area.name} — Land Bank Corp`;
  return {
    subject,
    text,
    link,
    whatsappUrl: CONTACT.whatsapp(text),
    mailtoUrl: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`,
  };
}
