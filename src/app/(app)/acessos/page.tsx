import { ShieldCheck } from "lucide-react";
import { AccessManager } from "@/components/admin/access-manager";

export const dynamic = "force-dynamic";

export default function AccessPage() {
  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-2 text-leaf"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Segurança e governança</span></div>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Controle de acessos</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">Convide usuários, atribua permissões e revogue acessos. Somente administradores podem abrir esta área.</p>
      </header>
      <AccessManager />
    </div>
  );
}
