import { enrichCity } from "@/lib/ibge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = { slug?: string; name?: string; ibgeCode?: string; lat?: number; lng?: number };

async function handle(input: Body) {
  if (!input.slug && !input.name && !input.ibgeCode) {
    return Response.json({ ok: false, error: "Informe o município (slug, nome ou código IBGE)." }, { status: 400 });
  }
  const result = await enrichCity(input);
  return Response.json({
    ok: result.status !== "unavailable",
    status: result.status,
    city: result.city,
    source: result.source,
    message: result.message,
    ibgeLive: result.ibgeLive,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    return await handle({
      slug: url.searchParams.get("slug") ?? undefined,
      name: url.searchParams.get("name") ?? url.searchParams.get("city") ?? undefined,
      ibgeCode: url.searchParams.get("ibgeCode") ?? undefined,
      lat: url.searchParams.get("lat") ? Number(url.searchParams.get("lat")) : undefined,
      lng: url.searchParams.get("lng") ? Number(url.searchParams.get("lng")) : undefined,
    });
  } catch (error) {
    console.error("[ibge:enrich:GET]", error);
    return Response.json({ ok: false, error: "Falha ao carregar indicadores." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    return await handle(body);
  } catch (error) {
    console.error("[ibge:enrich:POST]", error);
    return Response.json({ ok: false, error: "Falha ao carregar indicadores." }, { status: 500 });
  }
}
