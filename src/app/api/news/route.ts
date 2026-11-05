import { getLatestNews, getMarketNews } from "@/lib/news";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Notícias do mercado corporativo — atualização automática diária.
 * GET  → snapshot do dia (coleta se necessário).
 * POST → força a coleta diária antes de responder.
 */
export async function GET() {
  try {
    const snapshot = await getMarketNews();
    return Response.json({ ok: true, ...snapshot }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[news:GET]", error);
    const fallback = await getLatestNews().catch(() => null);
    return Response.json({ ok: Boolean(fallback), ...(fallback ?? {}) }, { status: fallback ? 200 : 500 });
  }
}

export async function POST() {
  try {
    const snapshot = await getMarketNews(true);
    return Response.json({ ok: true, ...snapshot });
  } catch (error) {
    console.error("[news:POST]", error);
    return Response.json({ ok: false, error: "Falha ao atualizar notícias." }, { status: 500 });
  }
}
