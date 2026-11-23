export type Topic = { slug: string; name: string; area: string; keywords: string[] };

export const TOPICS: Topic[] = [
  { slug: "operacoes-inteiras", name: "Operações com números inteiros", area: "Números", keywords: ["numeros inteiros", "inteiros", "operacoes com inteiros", "numeros negativos"] },
  { slug: "fracoes", name: "Frações e números racionais", area: "Números", keywords: ["fracao", "fracoes", "numeros racionais", "racionais"] },
  { slug: "decimais", name: "Números decimais", area: "Números", keywords: ["decimal", "decimais", "numeros decimais"] },
  { slug: "potenciacao", name: "Potenciação e radiciação", area: "Números", keywords: ["potencia", "potenciacao", "radiciacao", "raiz quadrada", "raizes", "notacao cientifica"] },
  { slug: "razao-proporcao", name: "Razão e proporção", area: "Números", keywords: ["razao", "proporcao", "proporcional", "regra de tres", "escala"] },
  { slug: "grandezas-proporcionais", name: "Grandezas direta e inversamente proporcionais", area: "Números", keywords: ["grandezas", "diretamente proporcional", "inversamente proporcional", "regra de tres composta"] },
  { slug: "porcentagem-simples", name: "Porcentagem simples", area: "Números", keywords: ["porcentagem", "percentual", "por cento", "porcentagens"] },
  { slug: "descontos-sucessivos", name: "Descontos e acréscimos sucessivos", area: "Números", keywords: ["descontos sucessivos", "acrescimos sucessivos", "desconto sucessivo", "aumentos sucessivos", "desconto", "acrescimo"] },
  { slug: "juros-simples", name: "Juros simples", area: "Matemática financeira", keywords: ["juros simples"] },
  { slug: "juros-compostos", name: "Juros compostos", area: "Matemática financeira", keywords: ["juros compostos", "montante composto", "capitalizacao composta"] },
  { slug: "expressoes-algebricas", name: "Expressões algébricas e produtos notáveis", area: "Álgebra", keywords: ["expressoes algebricas", "produtos notaveis", "fatoracao", "monomio", "polinomio"] },
  { slug: "equacao-1grau", name: "Equações do 1º grau", area: "Álgebra", keywords: ["equacao do 1", "equacoes do 1", "equacao de primeiro grau", "equacao linear"] },
  { slug: "sistemas-lineares", name: "Sistemas de equações do 1º grau", area: "Álgebra", keywords: ["sistemas de equacoes", "sistema linear", "sistemas lineares"] },
  { slug: "equacao-2grau", name: "Equações do 2º grau", area: "Álgebra", keywords: ["equacao do 2", "equacoes do 2", "bhaskara", "segundo grau"] },
  { slug: "funcao-afim", name: "Função afim", area: "Funções", keywords: ["funcao afim", "funcao do 1", "funcao linear"] },
  { slug: "funcao-quadratica", name: "Função quadrática", area: "Funções", keywords: ["funcao quadratica", "funcao do 2", "parabola"] },
  { slug: "funcao-exponencial", name: "Função exponencial e logaritmos", area: "Funções", keywords: ["exponencial", "logaritmo", "logaritmos"] },
  { slug: "geometria-plana-perimetro", name: "Perímetro e área de figuras planas", area: "Geometria", keywords: ["area", "perimetro", "figuras planas", "area do triangulo", "area do retangulo", "circulo"] },
  { slug: "angulos", name: "Ângulos e polígonos", area: "Geometria", keywords: ["angulos", "angulo", "poligonos", "triangulos"] },
  { slug: "semelhanca", name: "Semelhança e Teorema de Tales", area: "Geometria", keywords: ["semelhanca", "tales", "triangulos semelhantes"] },
  { slug: "pitagoras", name: "Teorema de Pitágoras", area: "Geometria", keywords: ["pitagoras", "teorema de pitagoras", "triangulo retangulo"] },
  { slug: "trigonometria", name: "Trigonometria no triângulo retângulo", area: "Geometria", keywords: ["trigonometria", "seno", "cosseno", "tangente"] },
  { slug: "volume", name: "Volume e geometria espacial", area: "Geometria", keywords: ["volume", "prisma", "cilindro", "cone", "esfera", "geometria espacial"] },
  { slug: "unidades-medida", name: "Unidades de medida", area: "Grandezas e medidas", keywords: ["unidades de medida", "conversao de unidades", "litros", "metros"] },
  { slug: "estatistica-basica", name: "Média, moda e mediana", area: "Estatística", keywords: ["media", "moda", "mediana", "estatistica", "media aritmetica"] },
  { slug: "graficos-tabelas", name: "Leitura de gráficos e tabelas", area: "Estatística", keywords: ["graficos", "tabelas", "grafico", "tabela", "interpretacao de graficos"] },
  { slug: "probabilidade", name: "Probabilidade", area: "Probabilidade", keywords: ["probabilidade", "chance", "espaco amostral"] },
  { slug: "contagem", name: "Análise combinatória", area: "Probabilidade", keywords: ["analise combinatoria", "combinatoria", "permutacao", "arranjo", "combinacao", "principio multiplicativo"] },
  { slug: "sequencias", name: "Sequências, PA e PG", area: "Álgebra", keywords: ["progressao aritmetica", "progressao geometrica", "sequencias", "padroes", "pa ", "pg "] },
  { slug: "interpretacao", name: "Interpretação e modelagem de problemas", area: "Raciocínio", keywords: ["interpretacao de problemas", "situacoes-problema", "resolucao de problemas"] },
];

export const TOPIC_BY_SLUG = new Map(TOPICS.map((t) => [t.slug, t]));
export const topicName = (slug: string) => TOPIC_BY_SLUG.get(slug)?.name ?? slug;

export const GRADES: { value: string; label: string }[] = [
  { value: "6", label: "6º ano" }, { value: "7", label: "7º ano" }, { value: "8", label: "8º ano" }, { value: "9", label: "9º ano" },
  { value: "em1", label: "1ª série EM" }, { value: "em2", label: "2ª série EM" }, { value: "em3", label: "3ª série EM" },
];
export const gradeLabel = (v: string) => GRADES.find((g) => g.value === v)?.label ?? v;

export const SUBJECTS = [{ value: "matematica", label: "Matemática" }];

export function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Extração heurística de tópicos a partir de texto livre; retorna trecho de origem. */
export function extractTopics(text: string): { slug: string; excerpt: string }[] {
  const n = normalize(text);
  const out: { slug: string; excerpt: string }[] = [];
  for (const t of TOPICS) {
    let idx = -1;
    for (const k of t.keywords) {
      const i = n.indexOf(k);
      if (i >= 0 && (idx < 0 || i < idx)) idx = i;
    }
    if (idx >= 0) {
      const start = Math.max(0, idx - 30);
      out.push({ slug: t.slug, excerpt: "…" + text.slice(start, Math.min(text.length, idx + 60)).replace(/\s+/g, " ").trim() + "…" });
    }
  }
  // “porcentagem” sempre inclui “descontos” só se mencionado; evitar duplicata semântica
  return out;
}

/** Detecta negações simples (“ainda não ensinei X”, “sem X”, “excluir X”). */
export function extractExclusions(text: string): string[] {
  const parts = normalize(text).split(/[.;\n]/);
  const slugs = new Set<string>();
  for (const p of parts) {
    if (/(ainda nao|nao (trabalhei|ensinei|vimos|vi)|sem |excluir|exceto|nao entra|nao cai)/.test(p)) {
      for (const t of TOPICS) if (t.keywords.some((k) => p.includes(k))) slugs.add(t.slug);
    }
  }
  return [...slugs];
}
