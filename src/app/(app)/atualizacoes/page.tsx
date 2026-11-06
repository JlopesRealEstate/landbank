import { BellRing, CheckCircle2, FileUp, Map, ShieldCheck, Sparkles, Mountain, Layers, KeyRound, FileCheck } from "lucide-react";
import { CRM_VERSION, CRM_RELEASE_DATE } from "@/lib/version";

const releases = [
  { version: "1.3.5", date: "06/11/2026", title: "Links de recuperação independentes do navegador", items: [{ icon: KeyRound, title: "Confirmação por token hash", detail: "Recuperação de senha e convites usam verifyOtp no servidor, sem depender do verificador PKCE armazenado no navegador que pediu o e-mail." }, { icon: ShieldCheck, title: "Sessão persistida e validada", detail: "Cookies são gravados na resposta de confirmação; a troca de senha exige sessão autenticada." }] },
  { version: "1.3.4", date: "06/11/2026", title: "Recuperação de senha e sessão protegida", items: [{ icon: KeyRound, title: "Formulário de nova senha acessível", detail: "A tela abre mesmo antes do cookie de recuperação existir; só permite salvar após validar a sessão Supabase." }, { icon: ShieldCheck, title: "Bloqueio fail-closed", detail: "Rotas internas continuam protegidas e o CRM retorna ao login quando a sessão não existe ou expira." }] },
  { version: "1.3.3", date: "06/11/2026", title: "Conta, senha e navegação compacta", items: [{ icon: ShieldCheck, title: "Identificação da conta conectada", detail: "O CRM mostra o e-mail autenticado e oferece saída explícita da conta." }, { icon: KeyRound, title: "Recuperação e alteração de senha", detail: "Redefinição pela tela de login e alteração de senha dentro do CRM." }, { icon: BellRing, title: "Atualizações em ícone discreto", detail: "O histórico de versões sai do menu principal e fica acessível pelo sino." }] },
  { version: "1.3.2", date: "06/11/2026", title: "Sessão e controle de acesso", items: [{ icon: ShieldCheck, title: "Controle de acesso com retorno ao login", detail: "Sessões expiradas no painel administrativo agora encaminham para login e retornam à rota solicitada." }, { icon: KeyRound, title: "Ações Login e Logoff", detail: "Navegação com entrada explícita e encerramento global da sessão Supabase." }] },
  { version: "1.3.1", date: "05/11/2026", title: "Recuperação de senha", items: [{ icon: KeyRound, title: "Link de redefinição corrigido", detail: "O e-mail agora aponta para o domínio de produção, passa pelo callback PKCE e abre a tela para definir uma nova senha." }] },
  {
    version: CRM_VERSION,
    date: "05/11/2026",
    title: "Segurança, mapas e relatórios técnicos",
    items: [
      { icon: ShieldCheck, title: "Controle de acesso por perfil", detail: "Login obrigatório, convites e revogação de acesso. RLS também bloqueia acesso direto às tabelas e arquivos para contas sem perfil autorizado." },
      { icon: KeyRound, title: "Convites e senha individual", detail: "Cada colaborador recebe convite por e-mail e define sua própria senha. Nenhuma senha compartilhada pelo administrador." },
      { icon: FileUp, title: "Correção de autenticação no upload", detail: "Validação de usuário com tratamento seguro para sessão ausente, evitando leitura de claims nulos." },
      { icon: Layers, title: "Camada Restrições no mapa", detail: "Ative curvas de nível e polígonos de APP, linhão, dutos e demais perdas do imóvel selecionado." },
      { icon: Mountain, title: "Curvas de 1 metro no PDF", detail: "Geração cartográfica a partir da grade MDE existente, com identificação da limitação da fonte de elevação." },
      { icon: FileCheck, title: "Relatório sem seção topográfica duplicada", detail: "Remoção do bloco repetido de análise e gráfico de perfil." },
    ],
  },
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
        <div className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1.5 text-xs">Versão atual: {CRM_VERSION}</div>
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
      <p className="flex items-center gap-2 text-xs text-muted"><CheckCircle2 className="h-4 w-4 text-leaf" />Versão {CRM_VERSION} · release de {new Date(CRM_RELEASE_DATE + "T12:00:00").toLocaleDateString("pt-BR")} · cada release deve registrar versão, data, commit e resumo técnico.</p>
    </div>
  );
}
