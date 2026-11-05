import { ensureDatabase } from "@/db/bootstrap";
import { countAreas } from "@/lib/data";

export const dynamic = "force-dynamic";

// Seeding is intentionally disabled in production until an authenticated
// administrator workflow is implemented. Never expose a public write endpoint.
function productionDisabled() {
  return process.env.NODE_ENV === "production";
}

export async function POST() {
  if (productionDisabled()) {
    return Response.json({ ok: false, error: "Endpoint indisponível." }, { status: 404 });
  }
  try {
    await ensureDatabase();
    const total = await countAreas();
    return Response.json({ ok: true, areas: total, message: "Base regional verificada e semeada com sucesso." });
  } catch (error) {
    console.error("[seed:POST]", error);
    return Response.json({ ok: false, error: "Falha ao preparar a base." }, { status: 500 });
  }
}

export async function GET() {
  if (productionDisabled()) {
    return Response.json({ ok: false, error: "Endpoint indisponível." }, { status: 404 });
  }
  const total = await countAreas().catch(() => 0);
  return Response.json({ ok: true, areas: total });
}
