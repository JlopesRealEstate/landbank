import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { requireAdmin } from "@/lib/authorization";
import { BrandSettings } from "@/components/admin/brand-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const access = await requireAdmin();
  if ("response" in access) redirect("/acesso-negado");
  return <div className="space-y-5">
    <header><div className="flex items-center gap-2 text-leaf"><Settings className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Administração do CRM</span></div>
      <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Configurações</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">Parâmetros globais e identidade visual da plataforma.</p>
    </header>
    <BrandSettings />
  </div>;
}
