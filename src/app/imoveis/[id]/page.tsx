import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { areas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MapPin, Ruler, Building2, Wallet, ArrowLeft, MessageCircle, ExternalLink } from "lucide-react";
import { CONTACT } from "@/lib/contact";
import { areaLabel, brl, num } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [area] = await db.select().from(areas).where(eq(areas.id, id)).limit(1);
  if (!area || area.status !== "disponivel") notFound();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY_V2 || process.env.SUPABASE_SERVICE_ROLE_KEY;
  let photos: { id: number; name: string; url: string; category: string }[] = [];
  if (url && key) {
    const admin = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.from("media").select("id,name,category,kind,sort_order")
      .eq("area_id", id).eq("kind", "photo").order("sort_order", { ascending: true });
    if (!error) photos = [...(data ?? [])]
      .sort((a,b) => Number(b.category === "capa") - Number(a.category === "capa") || a.sort_order-b.sort_order)
      .map((item) => ({ id: item.id, name: item.name, category: item.category, url: `/api/public/media/${item.id}` }));
  }
  const mapsUrl = `https://www.google.com/maps?q=${area.lat},${area.lng}`;
  const facts = [
    ["Área do terreno", areaLabel(area.landAreaM2)],
    ["Área construída", area.builtAreaM2 > 0 ? `${num(area.builtAreaM2)} m²` : "Não informada"],
    ["Preço por m²", area.pricePerM2 > 0 ? `${brl(area.pricePerM2)}/m²` : "Sob consulta"],
    ["Valor anunciado", area.totalPrice > 0 ? brl(area.totalPrice) : "Sob consulta"],
    ["Município", area.city],
    ["Bairro / região", area.neighborhood || "Não informado"],
    ["Tipo", area.kind === "galpao" ? "Galpão" : area.kind === "misto" ? "Uso misto" : "Terreno / gleba"],
    ["Negociação", area.transaction === "locacao" ? "Locação" : "Venda"],
    ["Zoneamento", area.zoning || "Não informado"],
    ["CEP", area.zipCode || "Não informado"],
    ["Coordenadas", `${area.lat}, ${area.lng}`],
  ];
  return <main className="min-h-screen bg-[#f5f3ef] text-[#102b34]">
    <header className="bg-[#0b2a35] text-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
      <Link href="/imoveis" className="text-sm text-white/80 hover:text-white"><ArrowLeft className="mr-2 inline h-4 w-4"/>Voltar ao portfólio</Link>
      <img src="/api/brand/logo" alt="EldoradoCorp" className="max-h-12 max-w-[220px] object-contain"/>
    </div></header>
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-7 sm:px-6">
      <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#8c2f43]">{area.code} · {area.kind === "galpao" ? "Galpão" : area.kind === "misto" ? "Uso misto" : "Terreno"}</p><h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{area.name}</h1><p className="mt-2 text-sm text-[#63747a]"><MapPin className="mr-1 inline h-4 w-4"/>{[area.neighborhood,area.city,"SP"].filter(Boolean).join(" · ")}</p></div><a href={CONTACT.whatsapp(`Tenho interesse no imóvel ${area.code} — ${area.name}. Gostaria de receber a ficha completa.`)} target="_blank" rel="noreferrer" className="rounded-xl bg-[#0b5964] px-4 py-3 text-sm font-semibold text-white"><MessageCircle className="mr-2 inline h-4 w-4"/>Solicitar informações</a></section>
      <section className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-2 sm:grid-cols-2">
          {photos.length ? photos.map((photo,index)=><div key={photo.id} className={index===0?"relative h-[330px] overflow-hidden rounded-2xl bg-[#e9e6df] sm:col-span-2":"relative h-40 overflow-hidden rounded-xl bg-[#e9e6df]"}><img src={photo.url} alt={photo.name || area.name} className="h-full w-full object-cover" loading={index===0?"eager":"lazy"}/>{photo.category==="capa"?<span className="absolute left-3 top-3 rounded-full bg-[#0b2a35]/85 px-3 py-1 text-xs text-white">Foto de capa</span>:null}</div>) : <div className="flex h-[330px] items-center justify-center rounded-2xl bg-[#e9e6df] text-sm text-[#63747a] sm:col-span-2">Fotografias não cadastradas para este imóvel.</div>}
        </div>
        <aside className="rounded-2xl border border-[#e3ded5] bg-white p-5"><p className="text-xs text-[#63747a]">Valor anunciado</p><p className="mt-1 text-3xl font-semibold">{area.totalPrice>0?brl(area.totalPrice):"Sob consulta"}</p><p className="mt-1 text-xs text-[#63747a]">{area.pricePerM2>0?brl(area.pricePerM2)+"/m²":"Valor por m² não informado"}</p><div className="mt-5 grid grid-cols-2 gap-2">{[{label:"Terreno",value:areaLabel(area.landAreaM2),icon:Ruler},{label:"Construído",value:area.builtAreaM2>0?areaLabel(area.builtAreaM2):"—",icon:Building2}].map(item=><div key={item.label} className="rounded-xl bg-[#f5f3ef] p-3"><item.icon className="h-4 w-4 text-[#63747a]"/><p className="mt-2 text-[10px] text-[#63747a]">{item.label}</p><p className="text-sm font-semibold">{item.value}</p></div>)}</div><a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0b5964]">Abrir localização no mapa <ExternalLink className="h-4 w-4"/></a></aside>
      </section>
      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"><div className="rounded-2xl border border-[#e3ded5] bg-white p-5"><h2 className="text-lg font-semibold">Apresentação do imóvel</h2><p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#52666d]">{area.description || "Descrição comercial ainda não cadastrada."}</p><h3 className="mt-6 text-sm font-semibold">Características e informações</h3><dl className="mt-3 grid gap-2 sm:grid-cols-2">{facts.map(([label,value])=><div key={label} className="rounded-lg bg-[#f5f3ef] p-3"><dt className="text-[10px] text-[#63747a]">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>)}</dl></div><div className="space-y-4"><div className="rounded-2xl border border-[#e3ded5] bg-white p-5"><h2 className="text-lg font-semibold">Zoneamento e diretrizes</h2><p className="mt-2 text-sm text-[#52666d]">{area.zoning || "Zoneamento não informado no cadastro."}</p><p className="mt-2 whitespace-pre-line text-sm text-[#63747a]">{area.zoningNotes || "Não há observações adicionais cadastradas."}</p></div><div className="rounded-2xl border border-[#e3ded5] bg-white p-5"><h2 className="text-lg font-semibold">Condições ambientais</h2><p className="mt-2 text-sm text-[#52666d]">{area.environmentalRestriction?"Há restrição ambiental cadastrada.":"Nenhuma restrição ambiental foi declarada no cadastro."}</p><p className="mt-2 whitespace-pre-line text-sm text-[#63747a]">{area.environmentalNotes || "Não há observações ambientais adicionais cadastradas."}</p></div><div className="rounded-2xl border border-[#e3ded5] bg-white p-5"><h2 className="text-lg font-semibold">Localização</h2><p className="mt-2 text-sm text-[#63747a]">Coordenadas cadastradas: {area.lat}, {area.lng}</p><a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#0b5964]">Navegar no Google Maps <ExternalLink className="h-4 w-4"/></a></div></div></section>
      <footer className="border-t border-[#e3ded5] py-5 text-center text-xs text-[#63747a]">EldoradoCorp · Imóveis Corporativos · Dados exibidos conforme cadastro e disponibilidade do ativo.</footer>
    </div>
  </main>;
}
