import Link from "next/link";
import {
  BookOpen,
  Building2,
  Compass,
  FileText,
  Layers,
  Map as MapIcon,
  Mountain,
  ShieldAlert,
  Sparkles,
  Table2,
} from "lucide-react";
import { HELP, HELP_TOTAL_FIELDS } from "@/lib/help";
import { CONTACT } from "@/lib/contact";
import { Eyebrow, BrandMark } from "@/components/ui";
import { DocumentacaoPrintButton } from "@/components/documentacao/print-button";

export const dynamic = "force-dynamic";

const GROUP_ICONS: Record<string, typeof BookOpen> = {
  identificacao: Building2,
  localizacao: MapIcon,
  metragens: Layers,
  contatos: FileText,
  terreno: Mountain,
  restricoes: ShieldAlert,
  inteligencia: Sparkles,
  mapa: Compass,
};

const WORKFLOWS = [
  {
    title: "1. Cadastrar um imóvel (5 minutos)",
    steps: [
      "Áreas & Galpões → “Nova área / importar KMZ”.",
      "Arraste o arquivo KMZ na área pontilhada: o sistema lê o perímetro, calcula a área geodésica e detecta município, bairro e CEP.",
      "Confira o município (os indicadores IBGE são carregados e gravados automaticamente).",
      "Preencha metragens, valor por m² (o total é sugerido pelo botão “usar”) e zoneamento.",
      "Informe proprietário, contato e, se houver, o parceiro corretor.",
      "Salve: o ativo nasce com dossiê, mapa e Land Score.",
    ],
  },
  {
    title: "2. Completar o dossiê",
    steps: [
      "No dossiê, aba “Documentos & fotos”: envie matrícula, planta, projeto, laudo e o KMZ (até 9 MB por arquivo).",
      "Fotos são comprimidas automaticamente e formam o mosaico da ficha em PDF.",
      "A aba “Inteligência” aponta pendências que reduzem o Land Score.",
    ],
  },
  {
    title: "3. Analisar topografia e terraplenagem",
    steps: [
      "Aba “Mapa & perímetro” → painel “Topografia”.",
      "Clique em “Processar análise” (a primeira vez consulta o MDE).",
      "Ajuste equidistância e entorno: as curvas são redesenhadas na hora, sem recalcular.",
      "Escolha o critério de cota de projeto e confira corte, aterro, excedente/déficit, custo total e custo por m².",
      "Leia os dois perfis (comprimento e largura) e compare as fontes topográficas.",
    ],
  },
  {
    title: "4. Demarcar restrições e perda de área",
    steps: [
      "No painel “Restrições e perda de área”, escolha o tipo.",
      "Para APP, nascente, duto, faixa e reserva: clique 3+ pontos formando o polígono.",
      "Para linhão: escolha o padrão de faixa (CPFL/NBR) e trace o EIXO com 2+ pontos — a faixa é gerada automaticamente.",
      "Salve: a demarcação permanece no mapa, na visão geral e na ficha PDF, com m² e % de perda.",
      "Some as restrições para obter a perda total e a área aproveitável.",
    ],
  },
  {
    title: "5. Apresentar ao cliente",
    steps: [
      "Abra “Mapa interativo” e clique em Maximizar (tela cheia).",
      "Selecione o ponto e acesse o dossiê, ficha PDF, WhatsApp ou apresentação pública.",
      "A ficha PDF sai em A4 retrato com foto do mapa na visualização salva, curvas, KMZ, restrições, perfis, IBGE e mosaico de fotos.",
      "Use “Enviar ao cliente” para WhatsApp, e-mail ou link público.",
    ],
  },
];

const METRICS = [
  {
    title: "Área geodésica do KMZ",
    text: "Área calculada sobre o elipsoide (WGS-84) a partir do anel do perímetro. É a área oficial do dossiê e a base do % de perda e do preço por hectare.",
    formula: "fórmula de excesso esférico sobre as coordenadas do anel",
  },
  {
    title: "Unidades de área (m² · ha · alq)",
    text: "Toda área é exibida em metros quadrados, hectares e alqueires para leitura imediata por produtores, investidores e corretores.",
    formula: "1 ha = 10.000 m² · 1 alqueire paulista = 24.200 m² (alqueire mineiro = 48.400 m²; do norte = 27.225 m²)",
  },
  {
    title: "Perda por restrição",
    text: "Percentual do imóvel que não pode ser aproveitado por APP, nascente, linhão, duto, faixa de domínio, reserva legal ou área alagada.",
    formula: "(área da restrição ÷ área total do KMZ) × 100",
  },
  {
    title: "Land Score",
    text: "Nota 0–100 do potencial do ativo: localização/mercado, logística, preço vs. benchmark, aproveitamento, zoneamento/risco e completude do dossiê.",
    formula: "22% + 20% + 20% + 15% + 13% + 10% (média ponderada dos pilares)",
  },
  {
    title: "Benchmark de solo",
    text: "Preço de referência do terreno industrial/logístico do município, ajustado por vetor logístico, urbanização e PIB per capita.",
    formula: "referência municipal × (1 + ajustes de −6% a +6%)",
  },
  {
    title: "Renda média e mediana",
    text: "Rendimento domiciliar mensal por pessoa (Censo 2022). Indicador diferente do salário formal: mede toda a renda das famílias, inclusive informais.",
    formula: "IBGE Censo 2022 · renda mediana = 0,68 × média (razão regional)",
  },
  {
    title: "Salário formal (salários mínimos)",
    text: "Salário médio mensal dos trabalhadores formais, publicado pelo IBGE no CEMPRE. É o valor comparável ao portal IBGE Cidades — ex.: Sumaré 3,30 salários mínimos em 2023.",
    formula: "IBGE CEMPRE 2023 × piso regional SP R$ 1.874,36 (Lei 18.471/2026) — valor oficial, sem estimativa",
  },
  {
    title: "Potencial de consumo",
    text: "Massa de renda anual do município. Serve como teto de mercado, não como demanda endereçável.",
    formula: "população × renda média mensal × 12",
  },
  {
    title: "Terraplenagem (corte/aterro)",
    text: "Volumes integrados célula a célula dentro do KMZ, com reconciliação de área e balanço de massas.",
    formula: "Σ (Δcota × área da célula); equilíbrio por bisseção com empolamento 25% e compactação 1,15",
  },
  {
    title: "Custo de terraplenagem",
    text: "Soma dos serviços de corte, aterro, transporte interno, bota-fora, empréstimo e regularização.",
    formula: "quantidade × custo unitário (R$ 7,40 a R$ 32,00 por m³ conforme serviço)",
  },
  {
    title: "Perfil de elevação",
    text: "Relevo ao longo das linhas centrais de comprimento e largura, com ganho/perda e inclinações — mesma leitura do Google Earth.",
    formula: "amostragem a 5 m no MDE + interpolação linear; ganho = Σ subidas; perda = Σ descidas",
  },
];

const FAQ = [
  {
    question: "Por que o mapa não mostra curvas ao abrir?",
    answer:
      "A análise topográfica precisa ser processada uma vez por imóvel (botão “Processar análise”). Depois disso, equidistância e entorno redesenham instantaneamente no navegador. Verifique também o seletor “Exibir curvas” (padrão: somente dentro do KMZ).",
  },
  {
    question: "Por que o perfil não bate exatamente com o Google Earth?",
    answer:
      "Ambos usam dados SRTM 30 m, mas o Google Earth pode usar outro MDE na sua região. Compare no painel “Comparativo de fontes” (SRTM, Copernicus, ASTER) e ajuste a fonte ou o “Ajuste vertical” para calibrar.",
  },
  {
    question: "Um ativo vendido desapareceu do portfólio.",
    answer:
      "Regra de negócio: status Vendido e Cancelado saem do controle operacional (painel, mapa, indicadores e relatórios) e ficam em “Consultas”. Para retornar, edite o status.",
  },
  {
    question: "Qual a diferença entre demarcação por polígono e por eixo?",
    answer:
      "Polígono (APP, nascente, duto, faixa, reserva): você desenha o contorno. Eixo (linhão): você traça a linha central e o sistema gera a faixa com o recuo padrão da CPFL/NBR para cada lado.",
  },
  {
    question: "Como o preço é comparado ao mercado?",
    answer:
      "O preço do ativo é comparado ao benchmark auditado do município, sempre no mesmo produto (terreno × terreno, galpão × galpão) e na mesma transação (venda × locação). Desvios acima de 12% reduzem o pilar de preço do score.",
  },
  {
    question: "Os dados do IBGE são oficiais?",
    answer:
      "Sim. A base embarcada usa Censo 2022 (população), PIB municipal 2023 e IDHM 2010 (PNUD). Renda mediana é estimada pela razão 0,68 da média e o benchmark de solo é referência interna da Land Bank Corp.",
  },
];

export default function DocumentationPage() {
  const groups = Object.values(HELP);

  return (
    <div className="documentacao space-y-5">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <Eyebrow>Manual da ferramenta</Eyebrow>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/documentacao/pdf"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#8c2f43] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-[#7a2739]"
          >
            <FileText className="h-3.5 w-3.5" /> Exportar PDF (A4 retrato)
          </Link>
          <DocumentacaoPrintButton />
        </div>
      </div>
      <div>
        <Eyebrow>Manual da ferramenta</Eyebrow>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold sm:text-3xl">
          <BookOpen className="h-6 w-6 text-[#8c2f43]" /> Documentação
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Tudo sobre como funciona, como preencher, como visualizar e como interpretar os dados do Land Bank Corp.
          São {HELP_TOTAL_FIELDS} campos documentados, com explicação técnica, passo a passo e exemplos. Em todos os
          formulários, o ícone <span className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full border border-[#8c2f43] text-[9px] font-bold text-[#8c2f43]">?</span> ao
          lado do campo abre a mesma explicação (passe o mouse ou toque no celular).
        </p>
      </div>

      <nav className="rounded-2xl border border-line bg-white p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Navegação rápida</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {groups.map((group) => {
            const Icon = GROUP_ICONS[group.id] ?? BookOpen;
            return (
              <a
                key={group.id}
                href={`#${group.id}`}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-paper/60 px-2.5 py-1 text-[10.5px] font-medium text-ink-soft hover:border-[#8c2f43] hover:text-[#8c2f43]"
              >
                <Icon className="h-3 w-3" /> {group.title.replace(/^(\d+\.\s*)?/, "")}
              </a>
            );
          })}
          <a href="#fluxo" className="inline-flex items-center gap-1 rounded-full border border-line bg-paper/60 px-2.5 py-1 text-[10.5px] font-medium text-ink-soft hover:border-[#8c2f43] hover:text-[#8c2f43]">
            Fluxo de trabalho
          </a>
          <a href="#metricas" className="inline-flex items-center gap-1 rounded-full border border-line bg-paper/60 px-2.5 py-1 text-[10.5px] font-medium text-ink-soft hover:border-[#8c2f43] hover:text-[#8c2f43]">
            <Table2 className="h-3 w-3" /> Métricas e fórmulas
          </a>
          <a href="#faq" className="inline-flex items-center gap-1 rounded-full border border-line bg-paper/60 px-2.5 py-1 text-[10.5px] font-medium text-ink-soft hover:border-[#8c2f43] hover:text-[#8c2f43]">
            Perguntas frequentes
          </a>
        </div>
      </nav>

      <section id="fluxo" className="rounded-2xl border border-line bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-ink">Fluxo de trabalho recomendado</h2>
        <p className="mt-1 text-[11.5px] text-muted">
          Sequência completa, do cadastro à apresentação ao cliente. Cada etapa alimenta a próxima — dossiê completo = score
          mais alto e decisão mais segura.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {WORKFLOWS.map((flow) => (
            <div key={flow.title} className="rounded-xl border border-line bg-paper/40 p-3">
              <p className="text-[12px] font-semibold text-ink">{flow.title}</p>
              <ol className="mt-1.5 space-y-1">
                {flow.steps.map((step, index) => (
                  <li key={step} className="flex gap-1.5 text-[11px] leading-relaxed text-ink-soft">
                    <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-forest text-[8px] font-bold text-white">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {groups.map((group) => {
        const Icon = GROUP_ICONS[group.id] ?? BookOpen;
        return (
          <section key={group.id} id={group.id} className="scroll-mt-20 rounded-2xl border border-line bg-white">
            <div className="flex items-start gap-2 border-b border-line px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f6e8eb] text-[#8c2f43]">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-ink">{group.title}</h2>
                <p className="text-[11px] text-muted">{group.description}</p>
              </div>
              <span className="ml-auto rounded-full bg-paper px-2 py-0.5 text-[9.5px] font-semibold text-muted">
                {Object.keys(group.entries).length} campos
              </span>
            </div>
            <div className="divide-y divide-line/70">
              {Object.entries(group.entries).map(([key, entry]) => (
                <article key={key} id={`campo-${key}`} className="scroll-mt-20 px-4 py-2.5">
                  <h3 className="text-[12px] font-semibold text-ink">{entry.label}</h3>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">
                    <span className="font-semibold text-[#8c2f43]">O que é: </span>
                    {entry.what}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">
                    <span className="font-semibold text-[#8c2f43]">Como preencher: </span>
                    {entry.how}
                  </p>
                  {entry.technical ? (
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">
                      <span className="font-semibold">Detalhe técnico: </span>
                      {entry.technical}
                    </p>
                  ) : null}
                  {entry.example ? (
                    <p className="mt-0.5 text-[10.5px] text-muted">
                      <span className="font-semibold">Exemplo: </span>
                      {entry.example}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <section id="metricas" className="scroll-mt-20 rounded-2xl border border-line bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-ink">Métricas, cálculos e fórmulas</h2>
        <p className="mt-1 text-[11.5px] text-muted">
          Como cada número do CRM é obtido. Todas as métricas são calculadas no servidor e gravadas com o ativo, garantindo
          que relatórios e apresentações usem sempre o mesmo valor.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[11px]">
            <thead className="bg-paper/60 text-[9px] uppercase tracking-[0.1em] text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Métrica</th>
                <th className="px-3 py-2 font-semibold">Como interpretar</th>
                <th className="px-3 py-2 font-semibold">Fórmula / critério</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {METRICS.map((metric) => (
                <tr key={metric.title} className="align-top">
                  <td className="px-3 py-2 font-medium text-ink">{metric.title}</td>
                  <td className="px-3 py-2 text-ink-soft">{metric.text}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted">{metric.formula}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="faq" className="scroll-mt-20 rounded-2xl border border-line bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-ink">Perguntas frequentes</h2>
        <div className="mt-2 space-y-2">
          {FAQ.map((item) => (
            <details key={item.question} className="rounded-xl border border-line bg-paper/40 px-3 py-2">
              <summary className="cursor-pointer text-[11.5px] font-semibold text-ink">{item.question}</summary>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-forest p-4 text-white sm:p-5">
        <h2 className="text-sm font-semibold">Precisa de apoio?</h2>
        <p className="mt-1 text-[11.5px] text-white/70">
          Fale com o time responsável pelo CRM para treinamento, inclusão de novos produtos ou revisão de benchmark.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <a
            href={`https://wa.me/${CONTACT.phoneE164}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-lime px-3 py-1.5 font-semibold text-white"
          >
            WhatsApp {CONTACT.phoneDisplay}
          </a>
          <a href={`mailto:${CONTACT.email}`} className="rounded-lg bg-white/10 px-3 py-1.5 font-medium text-white ring-1 ring-inset ring-white/20">
            {CONTACT.email}
          </a>
          <Link href="/areas/nova" className="rounded-lg bg-white/10 px-3 py-1.5 font-medium text-white ring-1 ring-inset ring-white/20">
            Cadastrar primeiro imóvel
          </Link>
        </div>
      </section>
    </div>
  );
}
