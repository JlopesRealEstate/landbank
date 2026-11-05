import JSZip from "jszip";
import type { GeoPolygon } from "@/db/schema";
import { ringAreaM2, ringCentroid } from "@/lib/geo";

export type KmzParseResult = {
  documentName: string;
  name: string;
  description: string;
  polygons: GeoPolygon[];
  points: { lat: number; lng: number }[];
  center: { lat: number; lng: number } | null;
  totalAreaM2: number;
  placemarkCount: number;
  fileNames: string[];
};

function parseCoordinates(raw: string): [number, number][] {
  return raw
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(","))
    .filter((tuple) => tuple.length >= 2)
    .map((tuple) => [Number(tuple[0]), Number(tuple[1])] as [number, number])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180);
}

function textOf(element: Element | null | undefined): string {
  return element?.textContent?.trim() ?? "";
}

/** Busca tolerante a arquivos KML com e sem prefixo de namespace (kml:Placemark). */
function tagList(root: Element | Document, localName: string): Element[] {
  const namespaced = Array.from(root.getElementsByTagNameNS("*", localName)) as Element[];
  if (namespaced.length) return namespaced;
  return Array.from(root.getElementsByTagName(localName));
}

function firstTag(root: Element | Document, localName: string): Element | undefined {
  return tagList(root, localName)[0];
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function parseKmzFile(file: File): Promise<KmzParseResult> {
  const name = file.name.toLowerCase();
  let kmlFiles: { path: string; text: string }[] = [];

  if (name.endsWith(".kml")) {
    kmlFiles = [{ path: file.name, text: await file.text() }];
  } else if (name.endsWith(".kmz") || name.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entries = Object.values(zip.files).filter(
      (entry) => !entry.dir && entry.name.toLowerCase().endsWith(".kml") && !entry.name.startsWith("__MACOSX"),
    );
    if (!entries.length) {
      throw new Error("O arquivo KMZ não contém nenhum arquivo KML interno.");
    }
    const sorted = entries.sort((a, b) => (a.name === "doc.kml" ? -1 : b.name === "doc.kml" ? 1 : 0));
    kmlFiles = await Promise.all(
      sorted.map(async (entry) => ({ path: entry.name, text: await entry.async("text") })),
    );
  } else {
    throw new Error("Formato não suportado. Envie um arquivo .kmz ou .kml.");
  }

  const parser = new DOMParser();
  const polygons: GeoPolygon[] = [];
  const points: { lat: number; lng: number }[] = [];
  let documentName = "";
  let firstName = "";
  let firstDescription = "";
  let placemarkCount = 0;

  for (const kml of kmlFiles) {
    const doc = parser.parseFromString(kml.text, "text/xml");
    if (doc.getElementsByTagName("parsererror").length) {
      throw new Error("Não foi possível interpretar o KML. Verifique a integridade do arquivo.");
    }
    if (!documentName) {
      const documentTag = firstTag(doc, "Document");
      documentName = textOf(documentTag ? firstTag(documentTag, "name") : undefined);
    }

    const placemarks = tagList(doc, "Placemark");
    placemarkCount += placemarks.length;

    placemarks.forEach((placemark, index) => {
      const placemarkName = textOf(firstTag(placemark, "name"));
      const placemarkDescription = stripHtml(textOf(firstTag(placemark, "description")));
      if (!firstName && placemarkName) firstName = placemarkName;
      if (!firstDescription && placemarkDescription) firstDescription = placemarkDescription;

      const polygonNodes = tagList(placemark, "Polygon");
      let addedPolygon = false;

      for (const polygonNode of polygonNodes) {
        const rings = tagList(polygonNode, "LinearRing");
        const coordinateNodes = rings.length
          ? rings.map((ring) => firstTag(ring, "coordinates")).filter(Boolean)
          : tagList(polygonNode, "coordinates");

        coordinateNodes.forEach((coordinateNode, ringIndex) => {
          if (!coordinateNode) return;
          const ring = parseCoordinates(coordinateNode.textContent ?? "");
          if (ring.length < 3) return;
          const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
          const normalized = closed ? ring : [...ring, ring[0]];
          const areaM2 = Math.round(ringAreaM2(normalized));
          if (areaM2 < 1) return;
          addedPolygon = true;
          polygons.push({
            coordinates: normalized.map(([lng, lat]) => [Number(lng.toFixed(6)), Number(lat.toFixed(6))] as [number, number]),
            label: placemarkName || `Perímetro ${polygons.length + 1}${ringIndex > 0 ? ` (anel ${ringIndex + 1})` : ""}`,
            areaM2,
          });
        });
      }

      if (!addedPolygon) {
        const lines = tagList(placemark, "LineString");
        for (const line of lines) {
          const coordinateNode = firstTag(line, "coordinates");
          if (!coordinateNode) continue;
          const ring = parseCoordinates(coordinateNode.textContent ?? "");
          if (ring.length < 4) continue;
          const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
          const normalized = closed ? ring : [...ring, ring[0]];
          const areaM2 = Math.round(ringAreaM2(normalized));
          if (areaM2 > 4) {
            polygons.push({ coordinates: normalized, label: placemarkName || "Perímetro (linha)", areaM2 });
            addedPolygon = true;
          }
        }
      }

      if (!addedPolygon) {
        const pointNodes = tagList(placemark, "Point");
        for (const pointNode of pointNodes) {
          const coordinateNode = firstTag(pointNode, "coordinates");
          const coords = parseCoordinates(coordinateNode?.textContent ?? "");
          if (coords[0]) {
            points.push({ lng: coords[0][0], lat: coords[0][1] });
          }
        }
      }

      if (!polygons.length && !points.length && index === 0) {
        const coordinates = firstTag(placemark, "coordinates");
        const ring = parseCoordinates(coordinates?.textContent ?? "");
        if (ring.length >= 3) {
          polygons.push({
            coordinates: ring.length > 3 && ring[0][0] === ring[ring.length - 1][0] ? ring : [...ring, ring[0]],
            label: placemarkName || "Perímetro importado",
            areaM2: Math.round(ringAreaM2(ring)),
          });
        }
      }
    });
  }

  if (!polygons.length && !points.length) {
    throw new Error("O arquivo não contém polígonos ou pontos válidos.");
  }

  const totalAreaM2 = polygons.reduce((sum, polygon) => sum + (polygon.areaM2 ?? 0), 0);
  const largest = [...polygons].sort((a, b) => (b.areaM2 ?? 0) - (a.areaM2 ?? 0))[0];
  const center = largest
    ? ringCentroid(largest.coordinates)
    : points[0]
      ? { lat: points[0].lat, lng: points[0].lng }
      : null;

  return {
    documentName: documentName || file.name,
    name: firstName || documentName || "Área importada",
    description: firstDescription,
    polygons,
    points,
    center,
    totalAreaM2,
    placemarkCount,
    fileNames: kmlFiles.map((kml) => kml.path),
  };
}
