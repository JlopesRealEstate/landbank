import { BellRing, CheckCircle2, FileUp, Map, ShieldCheck, Sparkles } from "lucide-react";

const releases = [
  {
    version: "1.2.0",
    date: "05/11/2026",
    title: "Dossiê digital e mapas",
    items: [
      { icon: FileUp, title: "Documentos e fotos", detail: "Upload direto e seguro no Supabase Storage, sem passar arquivos grandes pelo limite de requisição da hospedagem." },
      { icon: ShieldCheck, title: "Acesso protegido", detail: "Sessão validada antes de registrar arquivos; documentos continuam em bucket privado." },
      { icon: Map, title: "Mapas de demarcação", detail: "Alternância entre Satélite, Mapa e Humanitário no desenho de APP, linhões e outras restrições." },
    ],
  },
  {
    version: "1.1.0",
    date: "05/11/2026",
    title: "Estrutura inicial do Land Bank Corp",
    items: [
      { icon: Sparkles, title: "Painel e módulos", detail: "Painel executivo, áreas e galpões, inteligência territorial, indicadores e relatórios." },
    ],
  },
];

export default function UpdatesPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-forest p-6 text-white">
        <div className="flex items-center gap-2 text-lime"><BellRing className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.18em]">Central de novidades</span></div>
        <h1 className="mt-3 text-2xl font-semibold">Atualizações do CRM</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">Veja o que mudou, para que serve cada melhoria e como usar os recursos do Land Bank Corp.</p>
        <div className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1.5 text-xs">Versão atual: 1.2.0</div>
      </header>
      <div className="space-y-5">
        {releases.map((release) => (
          <section key={release.version} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf">Versão {release.version}</p><h2 className="mt-1 text-lg font-semibold text-ink">{release.title}</h2></div>
              <span className="rounded-full bg-paper px-3 py-1 text-xs text-muted">{release.date}</span>
            </div>
            <div className="mt-4 divide-y divide-line">
              {release.items.map((item) => {
                const Icon = item.icon;
                return <div key={item.title} className="flex gap-3 py-3 first:pt-0 last:pb-0"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-leaf-50 text-leaf"><Icon className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold text-ink">{item.title}</h3><p className="mt-1 text-sm leading-6 text-muted">{item.detail}</p></div></div>;
              })}
            </div>
          </section>
        ))}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted"><CheckCircle2 className="h-4 w-4 text-leaf" />As novidades serão registradas aqui a cada publicação relevante.</p>
    </div>
  );
}
