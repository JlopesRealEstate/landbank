import Link from "next/link";
import type { Metadata } from "next";
import { HELP, HELP_TOTAL_FIELDS } from "@/lib/help";
import { CONTACT } from "@/lib/contact";
import { BrandMark } from "@/components/ui";
import { DocumentacaoPrintButton } from "@/components/documentacao/print-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Documentação — Land Bank Corp (PDF)",
  description: "Manual completo do CRM Land Bank Corp, formatado para impressão em A4 retrato.",
};

const WORKFLOW = [
  {
    title: "1. Cadastrar o imóvel",
    steps: [
      "Áreas & Galpões → “Nova área / importar KMZ”.",
      "Arraste o KMZ: perímetro, área geodésica, município, bairro e CEP são extraídos automaticamente.",
      "Confirme o município (indicadores IBGE são carregados e gravados uma única vez).",
      "Preencha metragens, valor por m², total, zoneamento e restrições.",
      "Informe proprietário, contato e parceiro corretor. Salve.",
    ],
  },
  {
    title: "2. Completar o dossiê",
    steps: [
      "Aba “Documentos & fotos”: matrícula, planta, projeto, laudo, contrato e KMZ (até 9 MB por arquivo).",
      "Envie fotos — são comprimidas e compõem o mosaico da ficha em PDF.",
      "A aba “Inteligência” lista pendências que reduzem o Land Score.",
    ],
  },
  {
    title: "3. Topografia e terraplenagem",
    steps: [
      "Aba “Mapa & perímetro” → “Processar análise” (primeira execução consulta o MDE).",
      "Ajuste equidistância e entorno: as curvas são redesenhadas na hora pelo navegador.",
      "Defina a cota de projeto e leia corte, aterro, balanço, custo total e custo por m².",
      "Compare os perfis de comprimento e largura e as fontes topográficas (SRTM, Copernicus, ASTER).",
    ],
  },
  {
    title: "4. Restrições e perda de área",
    steps: [
      "Escolha o tipo de restrição (APP, nascente, duto, faixa, reserva, linhão).",
      "Polígono: clique 3+ pontos. Linhão: escolha o padrão CPFL/NBR e trace o eixo (2+ pontos).",
      "Salve: a demarcação permanece no mapa com m² e % de perda.",
      "Some as restrições para obter perda total e área aproveitável.",
    ],
  },
  {
    title: "5. Apresentar ao cliente",
    steps: [
      "Mapa interativo → Maximizar (tela cheia) → selecionar o ativo.",
      "Acesse dossiê, ficha PDF, Street View, WhatsApp ou apresentação pública.",
      "A ficha PDF é A4 retrato com foto do mapa, curvas, KMZ, restrições, perfis, IBGE e fotos.",
    ],
  },
];

const METRICS = [
  ["Área geodésica do KMZ", "Área oficial do dossiê; base do % de perda e do preço por hectare.", "Excesso esférico sobre o anel de coordenadas (WGS-84)"],
  ["Perda por restrição", "Parte do imóvel não aproveitável.", "(área da restrição ÷ área do KMZ) × 100"],
  ["Land Score", "Nota 0–100 do potencial do ativo.", "22% mercado + 20% logística + 20% preço + 15% aproveitamento + 13% risco + 10% dossiê"],
  ["Benchmark de solo", "Referência de preço do terreno industrial/logístico do município.", "Referência municipal × (1 + ajustes de −6% a +6%)"],
  ["Potencial de consumo", "Massa de renda anual do município (teto de mercado).", "população × renda média mensal × 12"],
  ["Corte/aterro", "Volumes integrados dentro do KMZ com balanço de massas.", "Σ (Δcota × área da célula); empolamento 25%, compactação 1,15, perda 5%"],
  ["Custo de terraplenagem", "Corte, aterro, transporte, bota-fora, empréstimo e regularização.", "quantidade × custo unitário (R$ 2,10/m² a R$ 32,00/m³)"],
  ["Perfil de elevação", "Relevo nas linhas centrais de comprimento e largura.", "amostragem a 5 m no MDE + interpolação; ganho/perda = Σ variações"],
];

export default function DocumentacaoPdfPage() {
  const groups = Object.values(HELP);
  return (
    <div className="min-h-screen bg-paper-deep print:bg-white">
      <div className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <BrandMark className="h-7 w-7" />
          Documentação A4 retrato · {HELP_TOTAL_FIELDS} campos
        </div>
        <div className="flex items-center gap-2">
          <Link href="/documentacao" className="rounded-lg border border-line px-2.5 py-1.5 text-[10px] font-medium text-ink hover:border-leaf">
            Voltar
          </Link>
          <DocumentacaoPrintButton />
        </div>
      </div>

      <main className="doc-sheet mx-auto w-full max-w-[820px] bg-white px-6 py-5 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b-2 border-[#0b2a35] pb-3">
          <div className="flex items-start gap-2.5">
            <BrandMark className="h-11 w-11" />
            <div>
              <p className="text-[14px] font-semibold tracking-tight text-ink">
                Land Bank Corp<span className="ml-1 font-normal text-muted">| Áreas &amp; Galpões</span>
              </p>
              <p className="text-[8px] uppercase tracking-[0.16em] text-muted">Manual de operação e interpretação de dados</p>
              <p className="mt-1 text-[8px] text-muted">
                Emitido em {new Date().toLocaleDateString("pt-BR")} · {CONTACT.name} · {CONTACT.phoneDisplay} · {CONTACT.email}
              </p>
            </div>
          </div>
          <div className="rounded-lg bg-[#0b2a35] px-2.5 py-1.5 text-right text-white">
            <p className="text-[8px] uppercase tracking-[0.14em] text-white/60">Documentação</p>
            <p className="text-[13px] font-bold">{HELP_TOTAL_FIELDS} campos</p>
            <p className="text-[8px] text-[#e9b7c1]">{groups.length} módulos</p>
          </div>
        </header>

        <section className="mt-3">
          <h1 className="text-[12px] font-semibold text-ink">1. Fluxo de trabalho</h1>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {WORKFLOW.map((flow) => (
              <div key={flow.title} className="break-inside-avoid rounded border border-line px-2 py-1.5">
                <p className="text-[9px] font-semibold text-ink">{flow.title}</p>
                <ol className="mt-0.5 list-inside list-decimal space-y-0.5 text-[8px] leading-snug text-ink-soft">
                  {flow.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-3 break-inside-avoid">
          <h1 className="text-[12px] font-semibold text-ink">2. Métricas, cálculos e fórmulas</h1>
          <table className="mt-1 w-full text-left text-[8px]">
            <thead className="bg-paper/70 text-[7px] uppercase tracking-[0.06em] text-muted">
              <tr>
                <th className="px-1.5 py-1 font-semibold">Métrica</th>
                <th className="px-1.5 py-1 font-semibold">Interpretação</th>
                <th className="px-1.5 py-1 font-semibold">Fórmula / critério</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {METRICS.map(([metric, interpretation, formula]) => (
                <tr key={metric} className="align-top">
                  <td className="px-1.5 py-1 font-medium text-ink">{metric}</td>
                  <td className="px-1.5 py-1 text-ink-soft">{interpretation}</td>
                  <td className="px-1.5 py-1 text-muted">{formula}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-3">
          <h1 className="text-[12px] font-semibold text-ink">3. Campos, preenchimento e detalhes técnicos</h1>
          {groups.map((group, index) => (
            <div key={group.id} className="mt-2">
              <p className="border-b border-line pb-0.5 text-[10px] font-semibold text-[#8c2f43]">
                3.{index + 1} {group.title}
              </p>
              <p className="mt-0.5 text-[8px] text-muted">{group.description}</p>
              <div className="mt-1 space-y-1.5">
                {Object.entries(group.entries).map(([key, entry]) => (
                  <article key={key} className="break-inside-avoid rounded border border-line/70 px-2 py-1">
                    <p className="text-[8.5px] font-semibold text-ink">{entry.label}</p>
                    <p className="text-[8px] leading-snug text-ink-soft">
                      <strong className="text-[#8c2f43]">O que é:</strong> {entry.what}
                    </p>
                    <p className="text-[8px] leading-snug text-ink-soft">
                      <strong className="text-[#8c2f43]">Como preencher:</strong> {entry.how}
                    </p>
                    {entry.technical ? (
                      <p className="text-[7.5px] leading-snug text-muted">
                        <strong>Técnico:</strong> {entry.technical}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>

        <footer className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-2 text-[7.5px] leading-relaxed text-muted">
          <div className="rounded border border-line bg-paper/60 px-2 py-1.5">
            <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Contato</p>
            <p className="text-[8.5px] font-semibold text-ink">{CONTACT.name} · Land Bank Corp</p>
            <p>{CONTACT.phoneDisplay}</p>
            <p>{CONTACT.email}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.1em] text-ink-soft">Nota técnica</p>
            <p className="mt-0.5">
              Documento gerado pelo CRM Land Bank Corp. Indicadores IBGE (Censo 2022, PIB municipal 2023, IDHM 2010) e
              referências de benchmark são de uso interno. Análise topográfica baseada em MDE (SRTM 30 m / Copernicus / ASTER)
              não substitui levantamento planialtimétrico nem projeto executivo.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
