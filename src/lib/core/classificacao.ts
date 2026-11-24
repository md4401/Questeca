import { norm } from "./search";

/** Tema e série indicada de cada questão do banco. Regras determinísticas (sem IA): a IA refina depois com scripts/classificar-questoes-ia.ts. */
export type Tema = { nome: string; subject: string; kw: string[]; series: string[] };
const EM = ["em1", "em2", "em3"], FUND2 = ["6", "7", "8", "9"];
const T = (subject: string, nome: string, series: string[], ...kw: string[]): Tema => ({ nome, subject, kw: kw.map(norm), series });

export const TEMAS: Tema[] = [
  // Matemática
  T("matematica", "Porcentagem e juros", ["7", "8", "9", "em1"], "porcentagem", "por cento", "desconto", "acrescimo", "juros", "taxa de", "lucro", "prejuizo", "financiamento"),
  T("matematica", "Razão, proporção e regra de três", ["6", "7", "8"], "razao", "proporcao", "regra de tres", "escala", "diretamente proporcional", "inversamente proporcional"),
  T("matematica", "Funções", ["9", "em1"], "funcao", "funcoes", "grafico da funcao", "dominio", "f(x)", "parabola", "vertice", "raizes da"),
  T("matematica", "Funções exponencial e logarítmica", ["em1", "em2"], "logaritmo", "log", "exponencial", "decaimento"),
  T("matematica", "Equações e sistemas", ["7", "8", "9"], "equacao", "sistema de equacoes", "sistema linear", "inequacao", "incognita"),
  T("matematica", "Geometria plana", ["7", "8", "9", "em1"], "area do", "perimetro", "triangulo", "circunferencia", "poligono", "losango", "trapezio", "retangulo", "quadrado", "angulo"),
  T("matematica", "Geometria espacial", ["em2", "em3"], "volume", "cilindro", "cone", "esfera", "prisma", "piramide", "cubo", "paralelepipedo"),
  T("matematica", "Trigonometria", ["9", "em1", "em2"], "seno", "cosseno", "tangente", "trigonometri", "radiano"),
  T("matematica", "Geometria analítica", ["em3"], "plano cartesiano", "reta de equacao", "coordenadas", "distancia entre dois pontos", "circunferencia de equacao"),
  T("matematica", "Probabilidade", ["em2", "em3"], "probabilidade", "chance", "sorteio", "dado", "moeda"),
  T("matematica", "Análise combinatória", ["em2"], "combinatoria", "permutacao", "arranjo", "combinacao", "de quantas maneiras", "de quantas formas", "anagrama"),
  T("matematica", "Estatística", ["8", "9", "em3"], "media aritmetica", "mediana", "moda", "desvio padrao", "grafico de barras", "histograma", "tabela de frequencia", "estatistica"),
  T("matematica", "Progressões (PA e PG)", ["em1", "em2"], "progressao aritmetica", "progressao geometrica", "razao da pa", "termo geral"),
  T("matematica", "Números e operações", ["6", "7"], "fracao", "decimal", "numero inteiro", "potencia", "raiz quadrada", "mmc", "mdc", "divisores", "primo"),
  T("matematica", "Matrizes e determinantes", ["em2", "em3"], "matriz", "determinante"),
  T("matematica", "Números complexos e polinômios", ["em3"], "numero complexo", "polinomio", "unidade imaginaria"),
  // Língua Portuguesa e Literatura
  T("literatura", "Machado de Assis e Realismo", ["em1", "em2"], "machado de assis", "dom casmurro", "memorias postumas", "bras cubas", "quincas borba", "capitu", "realismo"),
  T("literatura", "Modernismo", ["em2", "em3"], "modernismo", "modernista", "oswald de andrade", "mario de andrade", "drummond", "manuel bandeira", "clarice lispector", "guimaraes rosa", "graciliano", "vidas secas", "cecilia meireles", "joao cabral"),
  T("literatura", "Romantismo", ["em1", "em2"], "romantismo", "romantico", "jose de alencar", "gonçalves dias", "alvares de azevedo", "castro alves", "iracema"),
  T("literatura", "Barroco, Arcadismo e Quinhentismo", ["em1"], "barroco", "arcadismo", "gregorio de matos", "padre vieira", "quinhentismo", "cláudio manuel", "claudio manuel"),
  T("literatura", "Literatura portuguesa", ["em2", "em3"], "camoes", "fernando pessoa", "eca de queiros", "saramago", "os lusiadas", "trovadorismo"),
  T("literatura", "Simbolismo, Parnasianismo e Naturalismo", ["em2"], "simbolismo", "parnasianismo", "naturalismo", "aluisio azevedo", "o cortico", "cruz e sousa", "olavo bilac"),
  T("lingua-portuguesa", "Gramática e norma-padrão", ["7", "8", "9", "em1"], "concordancia", "regencia", "crase", "pontuacao", "virgula", "pronome", "verbo", "substantivo", "adjetivo", "oracao", "subordinada", "coordenada", "sintaxe", "ortografia", "acentuacao"),
  T("lingua-portuguesa", "Figuras de linguagem e semântica", ["8", "9", "em1"], "metafora", "ironia", "metonimia", "hiperbole", "antitese", "paradoxo", "eufemismo", "polissemia", "sentido figurado", "denotacao", "conotacao"),
  T("lingua-portuguesa", "Gêneros textuais e tipologia", ["7", "8", "9"], "genero textual", "cronica", "charge", "tirinha", "noticia", "editorial", "carta", "resenha", "artigo de opiniao", "tipo textual", "narracao"),
  T("lingua-portuguesa", "Variação linguística", ["8", "9", "em1"], "variacao linguistica", "norma culta", "oralidade", "registro formal", "giria", "regionalismo"),
  T("lingua-portuguesa", "Interpretação de texto", ["6", "7", "8", "9", "em1", "em2", "em3"], "segundo o texto", "de acordo com o texto", "o texto", "autor do texto", "a leitura do texto", "infere-se", "depreende-se"),
  // História
  T("historia", "Brasil Colônia e escravidão", ["7", "8", "em1"], "colonia", "colonial", "escravidao", "engenho", "bandeirantes", "capitanias", "mineracao", "quilombo", "inconfidencia"),
  T("historia", "Brasil Império", ["8", "em2"], "imperio", "dom pedro", "regencia", "abolicao", "guerra do paraguai", "segundo reinado", "lei aurea"),
  T("historia", "Brasil República", ["9", "em3"], "republica velha", "coronelismo", "era vargas", "getulio vargas", "estado novo", "ditadura militar", "redemocratizacao", "constituicao de 1988", "tenentismo", "politica do cafe"),
  T("historia", "Revoluções e Iluminismo", ["8", "em2"], "revolucao francesa", "iluminismo", "revolucao industrial", "independencia dos estados unidos", "absolutismo", "napoleao"),
  T("historia", "Guerras mundiais e século XX", ["9", "em3"], "primeira guerra", "segunda guerra", "guerra fria", "nazismo", "fascismo", "revolucao russa", "holocausto", "crise de 1929"),
  T("historia", "Antiguidade e Idade Média", ["6", "7"], "grecia", "roma", "egito", "mesopotamia", "feudalismo", "idade media", "cruzadas", "renascimento", "imperio romano"),
  T("historia", "América e povos originários", ["7", "8"], "astecas", "maias", "incas", "povos indigenas", "conquista da america", "colonizacao espanhola"),
  // Geografia
  T("geografia", "Cartografia e coordenadas", ["6", "7"], "cartografia", "escala", "coordenadas geograficas", "latitude", "longitude", "fuso horario", "projecao cartografica"),
  T("geografia", "Clima, relevo e meio ambiente", ["6", "7", "em1"], "clima", "massa de ar", "relevo", "bioma", "desmatamento", "aquecimento global", "vegetacao", "bacia hidrografica", "efeito estufa", "desertificacao"),
  T("geografia", "População e urbanização", ["8", "9", "em2"], "populacao", "urbanizacao", "migracao", "demografia", "transicao demografica", "metropole", "favela", "periferia", "piramide etaria"),
  T("geografia", "Economia, globalização e geopolítica", ["9", "em3"], "globalizacao", "geopolitica", "blocos economicos", "industrializacao", "agronegocio", "petroleo", "mercosul", "comercio internacional", "capitalismo", "socialismo"),
  // Ciências da natureza
  T("biologia", "Genética e evolução", ["9", "em3"], "genetica", "dna", "mendel", "alelo", "gene", "mutacao", "evolucao", "selecao natural", "darwin", "heredograma"),
  T("biologia", "Ecologia", ["7", "em2"], "ecologia", "ecossistema", "cadeia alimentar", "teia alimentar", "populacao biologica", "ciclo do carbono", "biodiversidade", "especie", "simbiose"),
  T("biologia", "Citologia e fisiologia", ["8", "em1"], "celula", "mitose", "meiose", "membrana plasmatica", "organela", "fotossintese", "respiracao celular", "sistema digestorio", "sistema nervoso", "hormonio", "imunologia", "vacina", "virus", "bacteria"),
  T("fisica", "Mecânica", ["9", "em1"], "velocidade", "aceleracao", "forca", "newton", "movimento", "energia cinetica", "energia potencial", "trabalho de uma forca", "impulso", "queda livre", "atrito", "lancamento"),
  T("fisica", "Eletricidade e magnetismo", ["9", "em3"], "corrente eletrica", "resistor", "circuito", "tensao eletrica", "campo eletrico", "carga eletrica", "campo magnetico", "potencia eletrica", "lei de ohm"),
  T("fisica", "Termologia e ondas", ["9", "em2"], "temperatura", "calor", "dilatacao", "gas ideal", "termodinamica", "onda", "frequencia", "som", "luz", "refracao", "espelho", "lente", "optica"),
  T("fisica", "Gravitação e hidrostática", ["em1", "em2"], "gravitacao", "kepler", "pressao", "empuxo", "densidade", "hidrostatica", "arquimedes"),
  T("quimica", "Química orgânica", ["em3"], "organica", "hidrocarboneto", "alcool", "acido carboxilico", "polimero", "isomeria", "ester", "benzeno", "ligacao pi"),
  T("quimica", "Estequiometria e soluções", ["em1", "em2"], "mol", "estequiometria", "concentracao", "solucao", "molaridade", "diluicao", "massa molar", "reagente limitante"),
  T("quimica", "Reações, equilíbrio e eletroquímica", ["em2", "em3"], "equilibrio quimico", "ph", "oxirreducao", "pilha", "eletrolise", "cinetica quimica", "entalpia", "reacao endotermica", "acido", "base", "sal"),
  T("quimica", "Estrutura da matéria e tabela periódica", ["9", "em1"], "atomo", "tabela periodica", "ligacao ionica", "ligacao covalente", "eletronegatividade", "distribuicao eletronica", "isotopo", "radioatividade"),
  // Línguas e humanas
  T("ingles", "Inglês: leitura e interpretação", ["em1", "em2", "em3"], "according to the text", "the text", "which of the following", "the author", "the passage", "paragraph"),
  T("espanhol", "Espanhol: leitura e interpretação", ["em1", "em2", "em3"], "segun el texto", "el texto", "el autor", "el parrafo", "en el texto"),
  T("filosofia", "Filosofia", ["em1", "em2", "em3"], "platao", "aristoteles", "kant", "nietzsche", "descartes", "etica", "epistemologia", "iluminismo filosofico", "socrates", "marx"),
  T("sociologia", "Sociologia", ["em1", "em2", "em3"], "durkheim", "weber", "marx", "cultura", "desigualdade social", "movimentos sociais", "cidadania", "ideologia", "estratificacao", "trabalho e sociedade"),
  T("arte", "Arte e movimentos artísticos", ["em1", "em2"], "pintura", "escultura", "arquitetura", "vanguarda", "impressionismo", "cubismo", "arte moderna", "semana de arte moderna", "teatro", "dança"),
];

const has = (hay: string, kw: string) => (` ${hay} `).includes(kw.length < 5 ? ` ${kw} ` : kw);

export type Classif = { tema: string; subject: string; series: string[]; confianca: "alta" | "baixa" };

/** Escolhe o tema pelo maior número de palavras-chave (título e enunciado pesam mais que as alternativas). */
export function classificar(q: { subject: string; title?: string | null; statement?: string | null; alternatives?: { text: string }[] | null }): Classif {
  const head = norm(`${q.title ?? ""} ${(q.statement ?? "")}`);
  const alts = norm((q.alternatives ?? []).map((a) => a.text).join(" "));
  const livre = q.subject === "interdisciplinar" || q.subject === "ciencias";
  let best: { t: Tema; s: number } | null = null;
  for (const t of TEMAS) {
    if (!livre && t.subject !== q.subject && !(q.subject === "lingua-portuguesa" && t.subject === "literatura") && !(q.subject === "literatura" && t.subject === "lingua-portuguesa")) continue;
    let s = 0;
    for (const k of t.kw) { if (has(head, k)) s += 2; else if (has(alts, k)) s += 1; }
    if (s > 0 && (!best || s > best.s)) best = { t, s };
  }
  if (best && best.s >= 2) return { tema: best.t.nome, subject: livre ? best.t.subject : q.subject, series: best.t.series, confianca: best.s >= 4 ? "alta" : "baixa" };
  return { tema: "Geral", subject: q.subject, series: EM, confianca: "baixa" };
}
export const SERIES_FUND2 = FUND2;
