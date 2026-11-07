"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { GeoPolygon } from "@/db/schema";
import { Building2, MapPin, Ruler, Search, SlidersHorizontal, Wallet, ArrowUpRight, MessageCircle } from "lucide-react";
import { ALQUEIRE_PAULISTA_M2, areaLabel, brl, num } from "@/lib/format";
import { CONTACT } from "@/lib/contact";

type Listing = {
  id: number; code: string; name: string; kind: string; transaction: string; city: string; featured: boolean; status: string;
  neighborhood: string; address: string; description: string; zoning: string; zoningNotes: string; environmentalRestriction: boolean; environmentalNotes: string;
  lat: number; lng: number; geometry: GeoPolygon[]; landAreaM2: number; builtAreaM2: number; pricePerM2: number; totalPrice: number;
  photos: { id: number; url: string; name: string }[];
};
type Market = { day: string; source: string; fetchedAt: string; indices: { label: string; value: string; unit: string; note: string }[]; items: { title: string; link: string; source: string; publishedAt: string; summary: string; category: string }[] } | null;
const MapCanvas = dynamic(() => import("@/components/map/map-canvas").then((module) => module.MapCanvas), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-xs text-[#63747a]">Carregando mapa do portfólio…</div> });
export function PublicPropertyPortal({ listings, market }: { listings: Listing[]; market: Market }) {
  const [query,setQuery]=useState("");
  const [city,setCity]=useState("todos");
  const [kind,setKind]=useState("todos");
  const [transaction,setTransaction]=useState("todos");
  const [minArea,setMinArea]=useState("");
  const [maxPrice,setMaxPrice]=useState("");
  const [sort,setSort]=useState("featured");
  const [photoIndex,setPhotoIndex]=useState<Record<number,number>>({});
  const cities=useMemo(()=>[...new Set(listings.map(x=>x.city))].sort((a,b)=>a.localeCompare(b,"pt-BR")),[listings]);
  const filtered=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase("pt-BR");
    const rows=listings.filter(x=>
      (city==="todos"||x.city===city) &&
      (kind==="todos"||x.kind===kind) &&
      (transaction==="todos"||x.transaction===transaction) &&
      (!minArea||x.landAreaM2>=Number(minArea)) &&
      (!maxPrice||x.totalPrice<=Number(maxPrice)) &&
      (!term||[x.name,x.code,x.city,x.neighborhood,x.description,x.zoning].join(" ").toLocaleLowerCase("pt-BR").includes(term))
    );
    return rows.sort((a,b)=>sort==="price"?a.totalPrice-b.totalPrice:sort==="area"?b.landAreaM2-a.landAreaM2:sort==="recent"?b.id-a.id:a.name.localeCompare(b.name,"pt-BR"));
  },[listings,query,city,kind,transaction,minArea,maxPrice,sort]);
  const totalArea=filtered.reduce((s,x)=>s+x.landAreaM2,0);
  const vgv=filtered.reduce((s,x)=>s+x.totalPrice,0);
  const byCity=cities.map(name=>({name,count:filtered.filter(x=>x.city===name).length})).filter(x=>x.count).sort((a,b)=>b.count-a.count).slice(0,6);
  const maxCity=Math.max(1,...byCity.map(x=>x.count));
  const byKind=[{name:"Terrenos",count:filtered.filter(x=>x.kind==="terreno").length},{name:"Galpões",count:filtered.filter(x=>x.kind==="galpao").length},{name:"Uso misto",count:filtered.filter(x=>x.kind==="misto").length}];
  return <main className="min-h-screen bg-[#f5f3ef] text-[#102b34]">
    <header className="bg-[#0b2a35] text-white"><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}<img src="/api/brand/logo" alt="EldoradoCorp Imóveis Corporativos" className="mb-5 h-auto w-[min(100%,360px)] object-contain" />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold sm:text-4xl">Oportunidades imobiliárias</h1><p className="mt-2 max-w-2xl text-sm text-white/65">Ativos disponíveis para desenvolvimento industrial, logístico, comercial e residencial.</p></div><a href={CONTACT.whatsapp("Olá! Gostaria de conhecer as oportunidades disponíveis no portfólio Land Bank Corp.")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#d5b56b] px-4 py-3 text-sm font-semibold text-[#0b2a35]"><MessageCircle className="h-4 w-4"/>Falar com um consultor</a></div>
    </div></header>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-[#e3ded5] bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">Mapa interativo do portfólio</h2><p className="mt-1 text-xs text-[#63747a]">Explore os ativos disponíveis por localização e abra cada marcador para consultar o resumo.</p></div><span className="text-[10px] text-[#63747a]">Pontos conforme coordenadas cadastradas</span></div><div className="mt-3 h-[420px] overflow-hidden rounded-xl border border-[#e3ded5]"><MapCanvas areas={listings.map((x) => ({ id: x.id, code: x.code, name: x.name, city: x.city, kind: x.kind, status: x.status, lat: x.lat, lng: x.lng, landAreaM2: x.landAreaM2, builtAreaM2: x.builtAreaM2, pricePerM2: x.pricePerM2, totalPrice: x.totalPrice, transaction: x.transaction, listingUrl: null, score: 0, coverUrl: x.photos[0]?.url ?? null, geometry: x.geometry ?? [] }))} basemap="mapa" fitToAreas className="h-full w-full" /></div></section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[{label:"Ativos disponíveis",value:num(filtered.length),icon:Building2},{label:"Área total",value:areaLabel(totalArea),icon:Ruler},{label:"VGV anunciado",value:brl(vgv,{compact:true}),icon:Wallet},{label:"Municípios",value:num(new Set(filtered.map(x=>x.city)).size),icon:MapPin}].map(item=><div key={item.label} className="rounded-2xl border border-[#e3ded5] bg-white p-4"><div className="flex items-center justify-between text-xs text-[#63747a]"><span>{item.label}</span><item.icon className="h-4 w-4"/></div><p className="mt-2 text-2xl font-semibold tabular-nums">{item.value}</p></div>)}
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-[#e3ded5] bg-white p-4"><h2 className="text-sm font-semibold">Ativos por município</h2><div className="mt-3 space-y-2">{byCity.map(x=><div key={x.name} className="grid grid-cols-[120px_1fr_28px] items-center gap-2 text-xs"><span className="truncate text-[#63747a]">{x.name}</span><div className="h-2 overflow-hidden rounded-full bg-[#f0eee9]"><div className="h-full rounded-full bg-[#0b5964]" style={{width:`${x.count/maxCity*100}%`}}/></div><strong className="text-right tabular-nums">{x.count}</strong></div>)}{!byCity.length?<p className="text-xs text-[#63747a]">Sem ativos para os filtros selecionados.</p>:null}</div></div>
        <div className="rounded-2xl border border-[#e3ded5] bg-white p-4"><h2 className="text-sm font-semibold">Distribuição por tipo</h2><div className="mt-3 grid grid-cols-3 gap-2">{byKind.map(x=><div key={x.name} className="rounded-xl bg-[#f5f3ef] p-3"><p className="text-[10px] text-[#63747a]">{x.name}</p><p className="mt-1 text-xl font-semibold tabular-nums">{x.count}</p></div>)}</div><p className="mt-3 text-[10px] text-[#63747a]">Indicadores calculados sobre os imóveis atualmente filtrados.</p></div>
      </section>
      <section className="rounded-2xl border border-[#e3ded5] bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4"/>Encontre seu imóvel</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <label className="flex items-center gap-2 rounded-lg border border-[#e3ded5] px-3 py-2 lg:col-span-2"><Search className="h-4 w-4 text-[#63747a]"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, código, bairro, zoneamento..." className="min-w-0 flex-1 text-xs outline-none"/></label>
          <select value={city} onChange={e=>setCity(e.target.value)} className="rounded-lg border border-[#e3ded5] bg-white px-2 py-2 text-xs"><option value="todos">Todos municípios</option>{cities.map(x=><option key={x}>{x}</option>)}</select>
          <select value={kind} onChange={e=>setKind(e.target.value)} className="rounded-lg border border-[#e3ded5] bg-white px-2 py-2 text-xs"><option value="todos">Todos os tipos</option><option value="terreno">Terreno</option><option value="galpao">Galpão</option><option value="misto">Uso misto</option></select>
          <select value={transaction} onChange={e=>setTransaction(e.target.value)} className="rounded-lg border border-[#e3ded5] bg-white px-2 py-2 text-xs"><option value="todos">Venda e locação</option><option value="venda">Venda</option><option value="locacao">Locação</option></select>
          <select value={sort} onChange={e=>setSort(e.target.value)} className="rounded-lg border border-[#e3ded5] bg-white px-2 py-2 text-xs"><option value="featured">Ordenar: nome</option><option value="price">Menor valor</option><option value="area">Maior área</option><option value="recent">Mais recentes</option></select>
          <input type="number" min="0" value={minArea} onChange={e=>setMinArea(e.target.value)} placeholder="Área mín. m²" className="rounded-lg border border-[#e3ded5] px-3 py-2 text-xs"/>
          <input type="number" min="0" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="Valor máx. R$" className="rounded-lg border border-[#e3ded5] px-3 py-2 text-xs"/>
        </div>
      </section>
      <div className="flex items-center justify-between"><p className="text-xs text-[#63747a]">{filtered.length} oportunidade(s) encontrada(s)</p><a href="#topo" className="text-xs text-[#0b5964]">Voltar ao topo ↑</a></div>
      {filtered.some((x) => x.featured) ? <section><div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#8c2f43]">Seleção EldoradoCorp</p><h2 className="mt-1 text-xl font-semibold">Imóveis em destaque</h2></div><span className="text-xs text-[#63747a]">{filtered.filter((x) => x.featured).length} ativo(s)</span></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.filter((x) => x.featured).slice(0,3).map((x) => <a key={x.id} href={`#${x.code}`} className="rounded-xl border border-[#d5b56b]/60 bg-white p-3 transition hover:shadow-md"><p className="text-[10px] font-semibold uppercase text-[#8c2f43]">{x.code} · {x.city}</p><p className="mt-1 font-semibold">{x.name}</p><p className="mt-1 text-xs text-[#63747a]">{areaLabel(x.landAreaM2)} · {brl(x.totalPrice)}</p></a>)}</div></section> : null}
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(x=>{const photos=x.photos??[];const active=photoIndex[x.id]??0;const photo=photos[active]??photos[0];return <article key={x.id} id={x.code} className="overflow-hidden rounded-2xl border border-[#e3ded5] bg-white shadow-sm">
          <a href={`/imoveis/${x.id}`} className="block"><div className="relative h-52 bg-[#e9e6df]">{photo?<img src={photo.url} alt={photo.name||x.name} className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-xs text-[#63747a]">Imagem não disponibilizada</div>}
            <div className="absolute left-3 top-3 rounded-full bg-[#0b2a35]/90 px-3 py-1 text-[10px] font-semibold text-white">{x.transaction==="locacao"?"Locação":"Venda"}</div>
            {photos.length>1?<div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-[#0b2a35]/90 px-2 py-1 text-xs text-white"><button onClick={()=>setPhotoIndex(s=>({...s,[x.id]:(active-1+photos.length)%photos.length}))} aria-label="Foto anterior">‹</button><span>{active+1}/{photos.length}</span><button onClick={()=>setPhotoIndex(s=>({...s,[x.id]:(active+1)%photos.length}))} aria-label="Próxima foto">›</button></div>:null}
          </div></a>
          <div className="space-y-3 p-4"><div><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-[#8c2f43]">{x.code} · {x.kind==="galpao"?"Galpão":x.kind==="misto"?"Uso misto":"Terreno"}</p><a href={`/imoveis/${x.id}`} className="mt-1 block text-lg font-semibold hover:text-[#0b5964]">{x.name}</a><p className="mt-1 flex items-center gap-1 text-xs text-[#63747a]"><MapPin className="h-3 w-3"/>{[x.neighborhood,x.city,"SP"].filter(Boolean).join(" · ")}</p></div>
            <div className="grid grid-cols-3 gap-2"><div className="rounded-lg bg-[#f5f3ef] p-2"><p className="text-[9px] text-[#63747a]">Terreno</p><p className="text-xs font-semibold">{num(x.landAreaM2)} m²</p><p className="text-[9px] text-[#63747a]">{num(x.landAreaM2/ALQUEIRE_PAULISTA_M2,2)} alq</p></div><div className="rounded-lg bg-[#f5f3ef] p-2"><p className="text-[9px] text-[#63747a]">Hectares</p><p className="text-xs font-semibold">{num(x.landAreaM2/10000,2)} ha</p></div><div className="rounded-lg bg-[#f5f3ef] p-2"><p className="text-[9px] text-[#63747a]">Construído</p><p className="text-xs font-semibold">{x.builtAreaM2?num(x.builtAreaM2)+" m²":"—"}</p></div></div>
            <div className="flex items-end justify-between border-t border-[#e3ded5] pt-3"><div><p className="text-[10px] text-[#63747a]">Valor anunciado</p><p className="text-xl font-semibold">{brl(x.totalPrice)}</p><p className="text-[10px] text-[#63747a]">{brl(x.pricePerM2)}/m²</p></div><a href={CONTACT.whatsapp(`Tenho interesse no ativo ${x.code} — ${x.name}. Gostaria de receber mais informações.`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#0b5964] px-3 py-2 text-xs font-semibold text-white"><MessageCircle className="h-3.5 w-3.5"/>Tenho interesse</a></div>
            <details className="border-t border-[#e3ded5] pt-2"><summary className="cursor-pointer text-xs font-semibold text-[#0b5964]">Detalhes do imóvel</summary><div className="mt-2 space-y-2 text-xs text-[#63747a]"><p className="whitespace-pre-line">{x.description||"Descrição comercial sob consulta."}</p><p><strong className="text-[#102b34]">Zoneamento:</strong> {x.zoning||"Sob consulta"}</p><p><strong className="text-[#102b34]">Valor por m²:</strong> {brl(x.pricePerM2)}</p></div></details>
          </div></article>})}
        {filtered.length===0?<div className="rounded-2xl border border-dashed border-[#d7d0c5] p-12 text-center text-sm text-[#63747a] md:col-span-2 xl:col-span-3">Nenhum imóvel corresponde aos filtros. Ajuste os critérios e tente novamente.</div>:null}
      </section>
      <section className="grid gap-4 lg:grid-cols-[1fr_1.5fr]"><div className="rounded-2xl border border-[#e3ded5] bg-white p-4"><h2 className="text-sm font-semibold">Indicadores financeiros</h2><p className="mt-1 text-[10px] text-[#63747a]">Valores e índices publicados pela fonte cadastrada no sistema.</p>{market?.indices?.length?<div className="mt-3 grid gap-2 sm:grid-cols-2">{market.indices.map((item,i)=><div key={`${item.label}-${i}`} className="rounded-lg bg-[#f5f3ef] p-3"><p className="text-[10px] text-[#63747a]">{item.label}</p><p className="mt-1 text-lg font-semibold">{item.value} {item.unit}</p>{item.note?<p className="mt-1 text-[10px] text-[#63747a]">{item.note}</p>:null}</div>)}</div>:<p className="mt-3 text-xs text-[#63747a]">Indicadores financeiros não disponíveis na base neste momento. Nenhum valor foi estimado.</p>}{market?<p className="mt-3 text-[9px] text-[#63747a]">Fonte: {market.source} · Atualizado em {new Date(market.fetchedAt).toLocaleString("pt-BR")}</p>:null}</div><div className="rounded-2xl border border-[#e3ded5] bg-white p-4"><h2 className="text-sm font-semibold">Notícias corporativas</h2><p className="mt-1 text-[10px] text-[#63747a]">Últimas notícias disponíveis na base de inteligência.</p>{market?.items?.length?<div className="mt-3 divide-y divide-[#e3ded5]">{market.items.slice(0,6).map((item,i)=><a key={`${item.link}-${i}`} href={item.link} target="_blank" rel="noreferrer" className="block py-2.5 first:pt-0 hover:text-[#0b5964]"><p className="text-xs font-semibold">{item.title}</p><p className="mt-1 text-[10px] text-[#63747a]">{item.source} · {item.publishedAt?new Date(item.publishedAt).toLocaleDateString("pt-BR"):"Data não informada"}</p><p className="mt-1 line-clamp-2 text-[11px] text-[#63747a]">{item.summary}</p></a>)}</div>:<p className="mt-3 text-xs text-[#63747a]">Nenhuma notícia corporativa disponível na base. A seção será preenchida quando a rotina de coleta registrar novas fontes.</p>}</div></section>
      <footer className="border-t border-[#e3ded5] py-5 text-center text-xs text-[#63747a]">EldoradoCorp · Imóveis Corporativos · Informações sujeitas à confirmação documental e disponibilidade.</footer>
    </div>
  </main>;
}
