/**
 * CENTRAL DE AJUDA DOS CAMPOS — Land Bank Corp
 * Cada campo do sistema tem uma explicação técnica e um passo a passo de
 * preenchimento. Usada nos tooltips (?), no módulo Documentação e nos PDFs.
 */

export type HelpEntry = {
  label: string;
  what: string;
  how: string;
  technical?: string;
  example?: string;
};

export type HelpGroup = {
  id: string;
  title: string;
  description: string;
  entries: Record<string, HelpEntry>;
};

export const HELP: Record<string, HelpGroup> = {
  identificacao: {
    id: "identificacao",
    title: "Identificação do imóvel",
    description: "Dados que nomeiam e classificam o ativo dentro do land bank.",
    entries: {
      name: {
        label: "Nome do imóvel",
        what: "Título comercial do ativo, usado em propostas, relatórios e apresentações.",
        how: "Descreva o produto + município + vetor. Ex.: “Galpão Logístico Sumaré — Eixo Anhanguera”.",
        example: "Galpão Logístico Sumaré — Eixo Anhanguera",
      },
      code: {
        label: "Código do imóvel",
        what: "Identificador único do ativo no CRM (não pode repetir).",
        how: "Deixe em branco para o sistema gerar (3 letras do município + número). Use letras maiúsculas.",
        technical: "O código é a chave usada no link público da apresentação: /apresentacao/CODIGO.",
        example: "SUM-001",
      },
      status: {
        label: "Status comercial",
        what: "Etapa do pipeline em que o ativo está.",
        how: "Disponível → em estudo → em negociação → reservado. Vendido e Cancelado saem do portfólio ativo e ficam apenas em Consultas.",
        technical: "Vendidos/cancelados não entram em mapa, indicadores nem relatórios por regra de negócio.",
      },
      kind: {
        label: "Tipo de ativo",
        what: "Classifica o produto para a análise de mercado.",
        how: "Terreno/gleba para áreas não construídas; Galpão/logística para áreas com construção operacional; Uso misto apenas quando não houver definição.",
        technical: "A análise de M² da região exclui uso misto e residencial — compara sempre o mesmo produto.",
      },
      transaction: {
        label: "Transação",
        what: "Define se o preço informado é de venda ou de locação.",
        how: "Selecione Venda para valor de aquisição/venda e Locação para mensalidade. Isso separa o Quadro de M².",
        technical: "Venda usa R$/m²; locação usa R$/m²/mês. Nunca são somados no mesmo comparativo.",
      },
      description: {
        label: "Descrição do imóvel",
        what: "Narrativa comercial e técnica do ativo.",
        how: "Informe infraestrutura, pé-direito, docas, pátio, acessos, infraestrutura urbana e tese de investimento.",
        technical: "Descrições acima de 180 caracteres aumentam a pontuação de completude do dossiê no Land Score.",
      },
      featured: {
        label: "Destacar no portfólio",
        what: "Coloca o ativo na vitrine de apresentação do painel.",
        how: "Marque apenas ativos com dossiê completo e material fotográfico pronto.",
      },
    },
  },
  localizacao: {
    id: "localizacao",
    title: "Localização e perímetro",
    description: "Como o ativo é posicionado no mapa e como importar o KMZ.",
    entries: {
      city: {
        label: "Município",
        what: "Município paulista onde o imóvel está (base IBGE com 645 municípios de SP).",
        how: "Digite o nome e selecione na lista. Ao escolher, o CRM carrega e grava população, renda, IDHM e benchmark — uma vez só, mantendo a consulta leve.",
        technical: "Fonte: IBGE Censo 2022, PIB municipal 2023 e IDHM 2010. O código IBGE é vinculado automaticamente.",
      },
      neighborhood: {
        label: "Bairro / distrito",
        what: "Bairro usado na tabela de M² por bairro.",
        how: "Preenchido automaticamente pelo KMZ (geocodificação reversa) ou digitado manualmente.",
      },
      address: {
        label: "Endereço completo",
        what: "Endereço de referência, rodovia e km.",
        how: "Informe rodovia, km, número e ponto de referência. Ex.: “Rodovia Anhanguera (SP-330), km 108”.",
      },
      zipCode: {
        label: "CEP",
        what: "CEP do imóvel.",
        how: "Preenchido pelo KMZ quando disponível; pode ser digitado no formato 00000-000.",
      },
      lat: {
        label: "Latitude",
        what: "Coordenada do ponto central do ativo.",
        how: "Clique no mapa do cadastro ou importe o KMZ — o valor é preenchido automaticamente.",
        technical: "Usada para calcular distâncias a Viracopos, Campinas, Piracicaba e Sumaré (hubs logísticos).",
      },
      lng: {
        label: "Longitude",
        what: "Coordenada do ponto central do ativo.",
        how: "Automática ao clicar no mapa ou importar o KMZ.",
      },
      kmz: {
        label: "Importar KMZ / KML",
        what: "Carrega o perímetro oficial do imóvel e a metragem calculada.",
        how: "Clique em “Selecionar arquivo” e escolha o .kmz ou .kml. O sistema extrai polígonos, ponto central, área geodésica, nome e descrição, identifica o município/bairro/CEP e vincula os indicadores IBGE.",
        technical: "Área calculada por fórmula geodésica sobre o elipsoide (WGS-84). O arquivo fica anexado ao dossiê como documento KMZ.",
        example: "Anexe o KMZ gerado no Google Earth (Salvar lugar como → KMZ).",
      },
      map: {
        label: "Mapa do cadastro",
        what: "Mapa para definição e conferência do ponto e do perímetro.",
        how: "Clique para mover o ponto central. Alterne entre Mapa, Satélite e Humanitário no topo do mapa para conferir limites.",
      },
    },
  },
  metragens: {
    id: "metragens",
    title: "Metragens, valores e zoneamento",
    description: "Como preencher áreas, preços e restrições legais do imóvel.",
    entries: {
      landAreaM2: {
        label: "Área do terreno (m²)",
        what: "Área total da gleba/terreno, exibida em três unidades: m², hectares (ha) e alqueires (alq).",
        how: "Se importou KMZ, o campo vem preenchido com a área geodésica. Caso contrário, informe a área da matrícula.",
        technical:
          "Conversões usadas: 1 ha = 10.000 m² e 1 alqueire paulista = 24.200 m² (padrão no Estado de São Paulo). Atenção: alqueire mineiro/goiano = 48.400 m² e alqueire do norte = 27.225 m². É a base do cálculo de perda por restrições, do VGV e do preço por hectare.",
        example: "42000",
      },
      builtAreaM2: {
        label: "Área construída (m²)",
        what: "Área edificada (galpão, armazém, benfeitorias).",
        how: "Deixe 0 ou vazio para terrenos sem construção.",
        technical: "A relação construída/terreno define a taxa de ocupação usada no parecer de terraplenagem e no Land Score.",
      },
      pricePerM2: {
        label: "Valor por m²",
        what: "Preço pedido por metro quadrado.",
        how: "Informe o valor de venda (R$/m²) ou de locação (R$/m²/mês), conforme a transação.",
        technical: "Comparado ao benchmark municipal auditado para gerar o desvio percentual em Inteligência.",
      },
      totalPrice: {
        label: "Valor total",
        what: "Valor total do imóvel.",
        how: "Use o botão “usar” para aplicar a sugestão (valor por m² × área do terreno) ou digite o valor negociado.",
      },
      zoning: {
        label: "Zoneamento",
        what: "Zona de uso do solo definida pela prefeitura.",
        how: "Informe a sigla e o nome. Ex.: “Zona Industrial 1 (ZI-1)”. Consulte a lei de uso e ocupação do município.",
        technical: "Zoneamento favorável a uso industrial/logístico eleva o pilar de risco do Land Score.",
      },
      zoningNotes: {
        label: "Observações de zoneamento",
        what: "Parâmetros urbanísticos aplicáveis.",
        how: "Anote coeficiente de aproveitamento, taxa de ocupação, altura máxima e restrições de acesso.",
      },
      environmentalRestriction: {
        label: "Restrição ambiental",
        what: "Indica se há APP, reserva legal, dutos, nascentes ou outras limitações.",
        how: "Marque quando houver e detalhe os campos abaixo. Depois, demarque a área no mapa para calcular a perda exata em m² e %.",
        technical: "Ativos com restrição recebem alerta no Land Score e são destacados nos relatórios.",
      },
      environmentalNotes: {
        label: "Detalhes da restrição ambiental",
        what: "Descrição técnica das restrições.",
        how: "Informe curso d'água, largura da faixa, distância de dutos, licenciamento necessário e compensações.",
      },
    },
  },
  contatos: {
    id: "contatos",
    title: "Proprietário, contatos e parceiros",
    description: "Quem responde pelo ativo e quem intermedeia a negociação.",
    entries: {
      ownerName: {
        label: "Proprietário / empresa",
        what: "Titular do imóvel.",
        how: "Informe razão social ou nome completo conforme a matrícula.",
      },
      contactName: {
        label: "Contato responsável",
        what: "Pessoa que acompanha a negociação.",
        how: "Nome + função, ex.: “Marcelo Prado (diretor)”.",
      },
      contactPhone: {
        label: "Telefone / WhatsApp",
        what: "Telefone do contato.",
        how: "Somente números com DDI. Ex.: 5519994960304.",
      },
      contactEmail: {
        label: "E-mail",
        what: "E-mail do contato.",
        how: "Será usado no envio do dossiê ao cliente.",
      },
      partnerName: {
        label: "Parceiro corretor — nome",
        what: "Corretor parceiro que intermedeia o ativo.",
        how: "Preenchimento manual. Aparece na ficha em PDF, ao lado do proprietário.",
      },
      listingUrl: {
        label: "Link do anúncio",
        what: "Endereço externo onde o imóvel está anunciado (portal imobiliário, site da imobiliária, vídeo de apresentação, matéria etc.).",
        how: "Cole a URL completa, começando por https://. O CRM valida o endereço e cria botões “Anúncio” na ficha, no dossiê e no mapa interativo.",
        technical:
          "Aceita apenas http/https; se você digitar sem protocolo, o sistema acrescenta https:// automaticamente. O link é aberto em nova aba e não passa por redirecionador interno.",
        example: "https://www.portaldocorretor.com.br/imovel/galpao-sumare-12345",
      },
      partnerPhone: {
        label: "Parceiro corretor — telefone",
        what: "Telefone do parceiro.",
        how: "Com DDI, ex.: 5519999999999.",
      },
    },
  },
  terreno: {
    id: "terreno",
    title: "Topografia, curvas de nível e terraplenagem",
    description: "Como interpretar o motor topográfico e o parecer de custo.",
    entries: {
      interval: {
        label: "Equidistância (m)",
        what: "Distância vertical entre as curvas de nível.",
        how: "Escolha 0,5 · 1 · 2 · 5 · 10 · 20 · 50 m. Quanto menor, mais detalhe. Ao alterar, o mapa redesenha na hora.",
        technical: "Curvas mestras são geradas a cada 2,5 / 5 / 10 m (múltiplo automático do intervalo).",
      },
      buffer: {
        label: "Entorno (m)",
        what: "Faixa analisada ao redor do KMZ.",
        how: "Escolha 10 · 50 · 100 · 200 · 500 m. Serve para ver o contexto do relevo e acessos.",
      },
      targetMode: {
        label: "Cota de projeto",
        what: "Critério que define a cota de terraplenagem.",
        how: "Equilíbrio de massas (recomendado) busca corte = aterro; Cota média usa a média ponderada; Cota mínima gera mais aterro; Cota máxima gera mais corte; Manual usa o valor digitado.",
        technical: "O equilíbrio é resolvido por bisseção (80 iterações) considerando empolamento de 25%, fator de compactação 1,15 e perda de 5%.",
      },
      targetElevation: {
        label: "Cota do projeto (m)",
        what: "Elevação alvo do platô.",
        how: "Habilitado no modo manual. Informe em metros com até duas casas decimais.",
      },
      resolution: {
        label: "Resolução da grade",
        what: "Quantidade de amostras de elevação por eixo.",
        how: "20 a 48 amostras. Mais resolução = curvas mais fiéis, processamento um pouco maior.",
        technical: "A grade é amostrada uma única vez em 500 m de entorno; equidistância e entorno são recalculados no navegador (instantâneo).",
      },
      demSource: {
        label: "Fonte topográfica (MDE)",
        what: "Modelo digital de elevação usado no perfil.",
        how: "SRTM 30 m (padrão), Copernicus GLO-90 ou ASTER 30 m. O comparativo entre fontes mostra a diferença média em metros.",
        technical: "SRTM 30 m é a mesma família de dados usada pelo Google Earth; diferenças acima de 4 m acionam arbitragem automática pelo ASTER.",
      },
      verticalOffset: {
        label: "Ajuste vertical (m)",
        what: "Correção de calibração do perfil.",
        how: "Use quando o perfil estiver deslocado em relação ao Google Earth. Positivo sobe, negativo desce.",
      },
      contourScope: {
        label: "Exibir curvas",
        what: "Quais curvas aparecem no mapa.",
        how: "Dentro + entorno, somente dentro do KMZ (padrão) ou somente entorno.",
      },
      heatmap: {
        label: "Mapa de calor",
        what: "Camada de cores do relevo.",
        how: "Escolha Cotas do terreno (verde = baixo, vermelho = alto) ou Corte × Aterro (bordô = corte, petróleo = aterro). Ajuste a opacidade na barra.",
      },
      profile: {
        label: "Perfil de elevação",
        what: "Gráfico do relevo ao longo do comprimento e da largura.",
        how: "As linhas centrais passam pelo centroide do KMZ. Leia ganho/perda de elevação, inclinação máxima e média — igual ao Google Earth.",
        technical: "Amostragem a 5 m no MDE com interpolação; verde = aterro, vermelho = corte em relação à cota de projeto.",
      },
      cutFill: {
        label: "Parecer de terraplenagem",
        what: "Estimativa de volumes e custo de corte/aterro.",
        how: "Volumes calculados dentro do KMZ. Confira cota de projeto, corte, aterro, excedente/déficit e custo por m².",
        technical: "Custos unitários: corte R$ 7,40/m³, aterro R$ 11,20/m³, transporte R$ 4,60/m³, bota-fora R$ 9,80/m³, empréstimo R$ 32/m³, regularização R$ 2,10/m².",
      },
    },
  },
  restricoes: {
    id: "restricoes",
    title: "Restrições e perda de área",
    description: "Como demarcar perdas e calcular o impacto no aproveitamento.",
    entries: {
      type: {
        label: "Tipo de restrição",
        what: "Natureza da área não aproveitável.",
        how: "APP/mata ciliar, nascente, linhão, duto, faixa de domínio, reserva legal, alagado ou outra.",
      },
      label: {
        label: "Identificação",
        what: "Nome que diferencia a restrição.",
        how: "Ex.: “APP do córrego do Boa Vista” ou “Linhão CPFL 138 kV”.",
      },
      polygonTool: {
        label: "Ferramenta de demarcação (polígono)",
        what: "Desenho por vértices para APP, nascente, duto, faixa e reserva legal.",
        how: "Clique em 3 ou mais pontos no mapa formando o contorno da restrição. A área e o % de perda são calculados automaticamente.",
        technical: "Método: área geodésica do polígono ÷ área total do imóvel × 100. A demarcação fica salva e visível no mapa.",
      },
      axisTool: {
        label: "Ferramenta de traço (linhão)",
        what: "Desenho por eixo para linhas de energia.",
        how: "Selecione o padrão (13,8 kV, 34,5 kV, 69/88/138 kV, 230 kV, 440 kV ou personalizado), trace o eixo com 2+ pontos e o sistema gera a faixa automaticamente com o recuo padrão.",
        technical: "CPFL GED-22: 15 m para cada lado em 69/88/138 kV (30 m) e 10 m para cada lado em 34,5 kV (20 m). NBR 5422 para tensões superiores.",
      },
      setback: {
        label: "Recuo do eixo (m/lado)",
        what: "Distância da faixa de servidão em relação ao eixo.",
        how: "Vem preenchido pelo padrão escolhido; ajuste se a escritura de servidão indicar outra largura.",
      },
      lossPct: {
        label: "Perda de área",
        what: "Percentual do imóvel que não pode ser aproveitado.",
        how: "Calculado automaticamente. Some todas as demarcações para obter a perda total e a área aproveitável.",
      },
    },
  },
  inteligencia: {
    id: "inteligencia",
    title: "Land Score e inteligência de mercado",
    description: "Como o CRM pontua ativos e compara preços.",
    entries: {
      score: {
        label: "Land Score",
        what: "Nota de 0 a 100 que resume o potencial do ativo.",
        how: "≥ 82 alta prioridade; 70–81 ativo estratégico; 58–69 monitorar; < 58 revisar tese.",
        technical: "Pilares e pesos: localização/mercado 22%, logística 20%, preço vs. benchmark 20%, aproveitamento 15%, zoneamento/risco 13%, completude do dossiê 10%.",
      },
      benchmark: {
        label: "Benchmark de solo",
        what: "Preço de referência de terreno industrial/logístico do município.",
        how: "Serve de base para o desvio percentual do preço pedido.",
        technical: "Referência municipal ajustada: proximidade de Viracopos (±6%), urbanização (±3/4%) e PIB per capita (±4/5%). Confiança alta com amostras de portfólio.",
      },
      avgIncome: {
        label: "Renda média",
        what: "Rendimento mensal por pessoa no município.",
        how: "Usada no potencial de consumo e no pilar de mercado do score. Nos municípios da área de atuação é o valor medido do Censo 2022; nos demais, estimativa calibrada.",
        technical:
          "Renda média: Censo 2022 (IBGE) — rendimento domiciliar per capita. Renda mediana = 0,68 × média (razão regional). Indicador distinto do salário formal (CEMPRE).",
      },
      formalSalary: {
        label: "Salário formal (salários mínimos)",
        what: "Salário médio mensal dos trabalhadores formais do município, publicado pelo IBGE em quantidade de salários mínimos — o mesmo número exibido no portal IBGE Cidades.",
        how: "Leia em salários mínimos e em reais. Ex.: Sumaré = 3,30 salários mínimos (2023). Convertido pelo piso paulista vigente de R$ 1.874,36.",
        technical:
          "Fonte oficial: IBGE — Cadastro Central de Empresas (CEMPRE) 2023, tabela 13, variável 'Salário médio mensal (salários mínimos)', extraída do arquivo público do IBGE. Conversão: salários mínimos × piso regional de São Paulo (Lei estadual 18.471/2026, R$ 1.874,36, vigente desde 01/06/2026). Não é estimativa: é o valor publicado pelo IBGE. Os 645 municípios de SP estão cobertos.",
      },
      consumption: {
        label: "Potencial de consumo",
        what: "Massa de renda anual do município.",
        how: "Leia como teto de mercado, não como demanda endereçável.",
        technical: "Cálculo: população × renda média mensal × 12.",
      },
      distances: {
        label: "Distâncias a rodovias, aeroportos, porto e capital",
        what: "Menor distância do imóvel até o eixo (acesso mais próximo) de cada rodovia, além da capital, do Porto de Santos e dos aeroportos de Viracopos, Congonhas e Cumbica.",
        how: "Leia da menor para a maior distância. Use os painéis do dossiê, da ficha em PDF e dos relatórios; o tooltip mostra o nome completo, a observação e as coordenadas do ponto de acesso.",
        technical:
          "Rodovias: geometria vetorial real do OpenStreetMap (Overpass API, licença ODbL), com todos os segmentos de pista do Estado de São Paulo. A distância é geodésica (elipsoide WGS-84) até o ponto mais próximo do eixo, calculada por projeção ponto-segmento. Aeroportos, porto e capital usam coordenadas dos terminais. É distância em linha reta: a distância rodoviária percorrida pode ser maior — use o atalho de rota para o trajeto real.",
      },
      marketTable: {
        label: "Quadro de M² da região",
        what: "Tabela de preços por bairro ou por produto.",
        how: "Escolha Venda ou Locação e depois Por bairros ou Por produtos. Compare sempre o mesmo produto.",
      },
    },
  },
  mapa: {
    id: "mapa",
    title: "Mapa, dossiê e documentos",
    description: "Como navegar, gerar PDF e enviar ao cliente.",
    entries: {
      basemap: {
        label: "Mapa / Satélite / Humanitário",
        what: "Camadas de visualização.",
        how: "Satélite para conferir limites, Mapa para ruas e Humanitário (OSM HOT) para infraestrutura e áreas vulneráveis.",
      },
      maximize: {
        label: "Maximizar",
        what: "Abre o mapa em tela cheia para apresentação.",
        how: "Clique em Maximizar; no modo tela cheia há um painel com acesso ao dossiê, ficha PDF, WhatsApp e apresentação.",
      },
      ficha: {
        label: "Exportar ficha (PDF)",
        what: "Documento A4 retrato com todos os dados do ativo.",
        how: "Abre a ficha com foto do mapa (na visualização salva), curvas, KMZ, restrições, perfil de elevação, IBGE e mosaico de fotos. Use Imprimir/Salvar PDF.",
      },
      docs: {
        label: "Documentos e fotos",
        what: "Dossiê digital do imóvel.",
        how: "Envie matrícula, planta, projeto, mapa, laudo, contrato e KMZ (até 9 MB por arquivo). Fotos são comprimidas automaticamente.",
        technical: "Arquivos ficam armazenados no banco e disponíveis no link público da apresentação.",
      },
      streetview: {
        label: "Apresentação do local (satélite, fachada e rua)",
        what: "Foto real do imóvel com o perímetro KMZ, foto de fachada do dossiê e mapa de rua navegável.",
        how: "No card “Apresentação do local” alterne entre Satélite, Fachada e Rua. Use “Street View” para abrir o panorama oficial do Google na coordenada do ativo (nova aba, sem bloqueio de API), além de Earth, Maps e rota.",
        technical:
          "Imagem de satélite vem do serviço público Esri World Imagery (mesmo provedor do basemap satélite), recortada no bounding box do perímetro com 40% de folga. A foto de fachada é a primeira imagem do dossiê.",
      },
      share: {
        label: "Enviar ao cliente",
        what: "Compartilhamento do dossiê.",
        how: "WhatsApp abre a mensagem pronta (telefone do time), e-mail envia ou abre seu cliente de e-mail, e “copiar link” gera a apresentação pública.",
      },
      consultas: {
        label: "Consultas",
        what: "Arquivo de vendidos e cancelados.",
        how: "Ativos encerrados saem do controle operacional e ficam aqui apenas para consulta e histórico.",
      },
    },
  },
};

export type HelpLookup = HelpEntry & { group: string; groupTitle: string; key: string };

export const HELP_INDEX: Record<string, HelpLookup> = Object.values(HELP).reduce(
  (accumulator, group) => {
    for (const [key, entry] of Object.entries(group.entries)) {
      const value: HelpLookup = { ...entry, group: group.id, groupTitle: group.title, key };
      // aceita tanto o caminho completo (identificacao.name) quanto a chave curta (name)
      accumulator[`${group.id}.${key}`] = value;
      if (!accumulator[key]) accumulator[key] = value;
    }
    return accumulator;
  },
  {} as Record<string, HelpLookup>,
);

export function getHelp(key: string): HelpLookup | null {
  return HELP_INDEX[key] ?? null;
}

/** Lista de campos (caminho + rótulo) para índices de ajuda e testes. */
export const HELP_FIELD_PATHS = Object.values(HELP).flatMap((group) =>
  Object.keys(group.entries).map((key) => ({
    path: `${group.id}.${key}`,
    key,
    label: group.entries[key].label,
    group: group.id,
    groupTitle: group.title,
  })),
);

export const HELP_TOTAL_FIELDS = Object.keys(HELP_INDEX).length;
