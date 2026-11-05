import { ensureDatabase } from "@/db/bootstrap";
import { countAreas } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST() {
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
  const total = await countAreas().catch(() => 0);
  return Response.json({ ok: true, areas: total });
}
