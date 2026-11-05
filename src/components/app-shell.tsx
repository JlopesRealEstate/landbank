"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  Database,
  Layers,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { FileBarChart, Archive } from "lucide-react";
import { BrandMark, cn } from "@/components/ui";

const NAV = [
  { href: "/", label: "Painel executivo", icon: LayoutDashboard, hint: "Portfólio e mapa" },
  { href: "/areas", label: "Áreas & Galpões", icon: Layers, hint: "Cadastro e dossiês" },
  { href: "/mapa", label: "Mapa interativo", icon: MapIcon, hint: "Pontos e perímetros" },
  { href: "/inteligencia", label: "Inteligência", icon: Sparkles, hint: "Scores e oportunidades" },
  { href: "/indicadores", label: "Indicadores IBGE", icon: Database, hint: "Cidades e região" },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart, hint: "KPIs e PDF" },
  { href: "/consultas", label: "Consultas", icon: Archive, hint: "Vendidos e cancelados" },
  { href: "/documentacao", label: "Documentação", icon: BookOpen, hint: "Manual e ajuda" },
  { href: "/atualizacoes", label: "Atualizações do CRM", icon: BellRing, hint: "Novidades e melhorias" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV.map((item) => {
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

function SidebarFooter() {
  return (
    <div className="space-y-3">
      <Link
        href="/areas/nova"
        className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-medium text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
      >
        <Plus className="h-4 w-4 text-[#e9b7c1]" />
        Cadastrar área
      </Link>
      <Link
        href="/documentacao"
        className="flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-[11px] font-medium text-white/70 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-white"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Documentação e ajuda dos campos
      </Link>
      <div className="rounded-xl bg-forest-600/60 p-3 ring-1 ring-inset ring-white/10">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-[#e9b7c1]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">Base regional</p>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-white/60">
          Sumaré-SP, RMC e Piracicaba. Imóveis vendidos e cancelados saem do controle e ficam apenas em Consultas.
        </p>
      </div>
      <div className="rounded-xl bg-forest-600/60 p-2.5 ring-1 ring-inset ring-white/10">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/50">Contato comercial</p>
        <p className="mt-1 text-[10px] font-medium text-white">Junior Lopes</p>
        <a href="tel:+5519994960304" className="block text-[10px] text-white/70 hover:text-[#e9b7c1]">
          +55 19 99496-0304
        </a>
        <a href="mailto:junior.lopes@creci.org.br" className="block truncate text-[10px] text-white/70 hover:text-[#e9b7c1]">
          junior.lopes@creci.org.br
        </a>
      </div>
      <p className="px-1 text-[10px] text-white/35">Land Bank Corp · v1.1</p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col justify-between bg-forest px-4 py-5 lg:flex">
        <div>
          <Link href="/" className="flex items-center gap-3 px-1">
            <BrandMark />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">Land Bank Corp</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Áreas &amp; Galpões</p>
            </div>
          </Link>
          <div className="mt-5 flex items-center gap-2 rounded-full bg-forest-600 px-3 py-1.5 text-[10px] text-white/60 ring-1 ring-inset ring-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" />
            Sumaré · RMC · Piracicaba
          </div>
          <div className="mt-6">
            <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">Navegação</p>
            <NavLinks />
          </div>
        </div>
        <SidebarFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark className="h-8 w-8" />
            <div className="leading-tight">
              <p className="text-xs font-semibold text-ink">Land Bank Corp</p>
              <p className="text-[9px] uppercase tracking-[0.14em] text-muted">Áreas &amp; Galpões</p>
            </div>
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
            <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col justify-between bg-forest px-4 py-5">
              <div>
                <div className="flex items-center justify-between">
                  <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                    <BrandMark className="h-8 w-8" />
                    <div className="leading-tight">
                      <p className="text-xs font-semibold text-white">Land Bank Corp</p>
                      <p className="text-[9px] uppercase tracking-[0.14em] text-white/45">Áreas &amp; Galpões</p>
                    </div>
                  </Link>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-white/60">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-6">
                  <NavLinks onNavigate={() => setOpen(false)} />
                </div>
              </div>
              <SidebarFooter />
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
