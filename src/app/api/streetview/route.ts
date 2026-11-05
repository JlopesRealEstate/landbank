import { hasGoogleKey, streetViewLinks } from "@/lib/streetview";

export const dynamic = "force-dynamic";

/**
 * GOOGLE STREET VIEW — verificação de disponibilidade para o ponto do imóvel.
 * A chave (GOOGLE_MAPS_API_KEY ou NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) fica sempre no
 * servidor. Sem chave, a rota devolve os links oficiais do Google para abrir o
 * panorama em nova aba — funcional e sem custo.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const heading = Number(url.searchParams.get("heading") ?? 0);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ ok: false, error: "Coordenadas inválidas." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const location = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const links = streetViewLinks(lat, lng, Number.isFinite(heading) ? heading : 0);

  if (!hasGoogleKey() || !apiKey) {
    return Response.json({
      ok: true,
      hasKey: false,
      available: false,
      location,
      links,
      message:
        "Visualização embutida disponível ao configurar GOOGLE_MAPS_API_KEY. Enquanto isso, use os atalhos oficiais para abrir o Street View, o Earth e a rota até o imóvel.",
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const metadataResponse = await fetch(
      `https://maps.googleapis.com/maps/api/streetview/metadata?location=${location}&key=${apiKey}`,
      { signal: controller.signal, cache: "no-store" },
    );
    clearTimeout(timeout);
    const metadata = (await metadataResponse.json()) as {
      status?: string;
      pano_id?: string;
      date?: string;
      location?: { lat: number; lng: number };
    };

    const available = metadata.status === "OK";
    return Response.json({
      ok: true,
      hasKey: true,
      available,
      location,
      status: metadata.status,
      panoId: metadata.pano_id ?? null,
      capturedAt: metadata.date ?? null,
      panoramaLocation: metadata.location ?? null,
      embedUrl: available
        ? `https://www.google.com/maps/embed/v1/streetview?key=${apiKey}&location=${location}&heading=${Math.round(
            Number.isFinite(heading) ? heading : 0,
          )}&pitch=0&fov=80`
        : null,
      imageUrl: `https://maps.googleapis.com/maps/api/streetview?size=900x460&location=${location}&fov=80&heading=${Math.round(
        Number.isFinite(heading) ? heading : 0,
      )}&key=${apiKey}`,
      links,
      message: available
        ? "Panorama disponível para este ponto."
        : "O Google ainda não possui panorama nesta coordenada. Use o Street View mais próximo ou o Earth.",
    });
  } catch (error) {
    console.error("[streetview]", error);
    return Response.json({
      ok: true,
      hasKey: true,
      available: false,
      location,
      links,
      message: "Não foi possível consultar o Street View agora. Use os atalhos oficiais.",
    });
  }
}
