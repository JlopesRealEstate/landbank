import { getAreaById, logActivity } from "@/lib/data";
import { buildIntel, shareSummary } from "@/lib/intelligence";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function loadArea(id: string) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return null;
  return getAreaById(numericId);
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const result = await loadArea(id);
  if (!result) return Response.json({ ok: false, error: "Imóvel não encontrado." }, { status: 404 });
  const origin = new URL(request.url).origin;
  const intel = buildIntel(result.area, result.city, {
    photos: result.area.photoCount,
    documents: result.area.documentCount,
  });
  const payload = shareSummary(result.area, result.city, intel, origin);
  return Response.json({ ok: true, ...payload });
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const result = await loadArea(id);
    if (!result) return Response.json({ ok: false, error: "Imóvel não encontrado." }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as { to?: string; message?: string };
    const origin = new URL(request.url).origin;
    const intel = buildIntel(result.area, result.city, {
      photos: result.area.photoCount,
      documents: result.area.documentCount,
    });
    const payload = shareSummary(result.area, result.city, intel, origin);
    const to = (body.to ?? "").trim();

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return Response.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      await logActivity(result.area.id, "share", "Proposta preparada para envio", `Destinatário: ${to} (envio via cliente de e-mail).`);
      return Response.json({
        ok: true,
        mode: "mailto",
        fallback: `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.text)}`,
        message:
          "Nenhum provedor de e-mail transacional está configurado. Abrimos o dossiê pré-preenchido no seu aplicativo de e-mail.",
      });
    }

    const from = process.env.RESEND_FROM ?? "Land Bank Corp <onboarding@resend.dev>";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: payload.subject,
        text: `${body.message ? `${body.message}\n\n` : ""}${payload.text}`,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[share:email]", detail);
      return Response.json({ ok: false, error: "Falha no provedor de e-mail." }, { status: 502 });
    }

    await logActivity(result.area.id, "share", "Dossiê enviado por e-mail", `Destinatário: ${to}`);
    return Response.json({ ok: true, mode: "email", message: `Dossiê enviado para ${to}.` });
  } catch (error) {
    console.error("[share:email]", error);
    return Response.json({ ok: false, error: "Não foi possível enviar o dossiê." }, { status: 500 });
  }
}
