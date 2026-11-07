"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Bell,
  KeyRound,
  ChevronRight,
  Database,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  Map as MapIcon,
  Menu,
  Plus,
  Sparkles,
  ShieldCheck,
  Settings,
  X,
} from "lucide-react";
import { FileBarChart, Archive } from "lucide-react";
import { BrandMark, cn } from "@/components/ui";
import { CRM_VERSION } from "@/lib/version";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/", label: "Painel executivo", icon: LayoutDashboard, hint: "Portfólio e mapa" },
  { href: "/areas", label: "Áreas & Galpões", icon: Layers, hint: "Cadastro e dossiês" },
  { href: "/mapa", label: "Mapa interativo", icon: MapIcon, hint: "Pontos e perímetros" },
  { href: "/inteligencia", label: "Inteligência", icon: Sparkles, hint: "Scores e oportunidades" },
  { href: "/indicadores", label: "Indicadores IBGE", icon: Database, hint: "Cidades e região" },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart, hint: "KPIs e PDF" },
  { href: "/consultas", label: "Consultas", icon: Archive, hint: "Vendidos e cancelados" },
  { href: "/documentacao", label: "Documentação", icon: BookOpen, hint: "Manual e ajuda" },
  { href: "/acessos", label: "Controle de acessos", icon: ShieldCheck, hint: "Usuários e permissões" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, hint: "Marca e parâmetros" },
];

function NavLinks({ onNavigate, isAdmin, canEdit }: { onNavigate?: () => void; isAdmin: boolean; canEdit: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV.filter((item) => isAdmin || ["/", "/areas", "/mapa", "/indicadores"].includes(item.href)).map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
              active ? "bg-lime text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-forest" : "text-white/60 group-hover:text-[#e9b7c1]")} />
            <span className="flex-1 font-medium">{item.label}</span>
            {active ? <ChevronRight className="h-3.5 w-3.5 opacity-60" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function AuthActions() {
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      if (error || !data.user) {
        window.location.replace("/login?error=session_expired");
        return;
      }
      setEmail(data.user.email ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session?.user) {
        setEmail(null);
        window.location.replace("/login?error=session_expired");
        return;
      }
      setEmail(session.user.email ?? null);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);
  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      window.location.replace("/login");
    } catch (error) {
      console.error("[auth:signout]", error);
      setBusy(false);
      window.location.replace("/login?error=signout");
    }
  }
  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-white/5 px-3 py-2">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-white/45">Conta conectada</p>
        <p className="mt-0.5 truncate text-xs font-medium text-white" title={email ?? "Sessão não identificada"}>{email ?? "Sessão não identificada"}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/definir-senha" className="inline-flex min-w-0 items-center justify-center gap-2 rounded-lg border border-white/15 px-2.5 py-2.5 text-xs font-medium text-white/80 hover:bg-white/10">
          <KeyRound className="h-3.5 w-3.5 shrink-0" /> <span>Senha</span>
        </Link>
        <Link href="/login" className="inline-flex min-w-0 items-center justify-center gap-2 rounded-lg border border-white/15 px-2.5 py-2.5 text-xs font-medium text-white/80 hover:bg-white/10">
          <LogIn className="h-3.5 w-3.5 shrink-0" /> <span>Login</span>
        </Link>
        <button type="button" onClick={() => void signOut()} disabled={busy} className="col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-50">
          <LogOut className="h-3.5 w-3.5 shrink-0" /> {busy ? "Encerrando sessão..." : "Sair do CRM"}
        </button>
      </div>
    </div>
  );
}

function SidebarFooter({ isAdmin, canEdit }: { isAdmin: boolean; canEdit: boolean }) {
  return (
    <div className="w-full space-y-2">
      <AuthActions />
      {canEdit ? (
        <Link
          href="/areas/nova"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-medium text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
        >
          <Plus className="h-4 w-4 text-[#e9b7c1]" />
          Cadastrar área
        </Link>
      ) : null}
      <p className="px-1 pt-1 text-[10px] text-white/35">EldoradoCorp · v{CRM_VERSION}</p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [roleName, setRoleName] = useState<string | null>(null);
  const isAdmin = roleName === "admin";
  const canEdit = isAdmin || roleName === "member";

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle();
      const nextRole = (role as unknown as { role?: string } | null)?.role ?? "reader";
      if (active) setRoleName(nextRole);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!roleName || isAdmin) return;
    const allowed = ["/", "/areas", "/mapa", "/indicadores"];
    if (!allowed.some((path) => pathname === path || pathname.startsWith(path + "/"))) window.location.replace("/");
  }, [pathname, roleName, isAdmin]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="sticky top-0 hidden h-dvh w-[252px] shrink-0 flex-col overflow-hidden bg-forest px-4 py-5 lg:flex">
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain">
          <div className="relative flex items-center justify-between gap-2 rounded-lg p-1.5 pr-10">
          <Link href="/" aria-label="EldoradoCorp Imóveis Corporativos" className="flex min-w-0 flex-1 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/brand/logo" alt="EldoradoCorp Imóveis Corporativos" className="h-auto w-full max-w-[208px] object-contain" />
          </Link>
          <Link href="/atualizacoes" aria-label="Atualizações do CRM" title="Atualizações do CRM" className="absolute right-1 top-1 rounded-lg p-2 text-forest/70 transition hover:bg-paper hover:text-forest">
            <Bell className="h-4 w-4" />
          </Link>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-full bg-forest-600 px-3 py-1.5 text-[10px] text-white/60 ring-1 ring-inset ring-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" />
            Sumaré · RMC · Piracicaba
          </div>
          <div className="mt-6">
            <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">Navegação</p>
            <NavLinks isAdmin={isAdmin} canEdit={canEdit} />
          </div>
        </div>
        <div className="w-full shrink-0 border-t border-white/10 bg-forest pt-3"><SidebarFooter isAdmin={isAdmin} canEdit={canEdit} /></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/" aria-label="EldoradoCorp Imóveis Corporativos" className="flex items-center rounded-lg px-1.5 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/brand/logo" alt="EldoradoCorp Imóveis Corporativos" className="h-auto w-[170px] object-contain" />
          </Link>
          <Link href="/atualizacoes" aria-label="Atualizações do CRM" title="Atualizações do CRM" className="rounded-lg border border-line bg-white p-2 text-muted">
            <Bell className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="rounded-lg border border-line bg-white p-2 text-ink"
          >
            <Menu className="h-4 w-4" />
          </button>
        </header>

        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Fechar menu"
              className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-[min(88vw,320px)] flex-col overflow-hidden bg-forest px-4 py-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
                <div className="flex items-center justify-between">
                  <Link href="/" aria-label="EldoradoCorp Imóveis Corporativos" className="flex items-center rounded-lg px-1.5 py-1" onClick={() => setOpen(false)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/api/brand/logo" alt="EldoradoCorp Imóveis Corporativos" className="h-auto w-[170px] object-contain" />
                  </Link>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-white/60">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-6">
                  <NavLinks isAdmin={isAdmin} canEdit={canEdit} onNavigate={() => setOpen(false)} />
                </div>
              </div>
              <div className="w-full shrink-0 border-t border-white/10 pt-3"><SidebarFooter isAdmin={isAdmin} canEdit={canEdit} /></div>
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 pb-14 pt-5 sm:px-6 lg:px-8 lg:pt-7">
          <div className="mx-auto w-full max-w-[1360px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
