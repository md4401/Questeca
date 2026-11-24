import type { Entity } from "./search";

/** Tópicos escolares comuns em vestibulares: o professor digita o assunto do jeito dele e a busca acha as palavras que a prova usa. */
const t = (id: string, label: string, names: string[], related: string[]): Entity => ({ id, label, names, related });
export const TOPICOS: Entity[] = [
  // Matemática
  t("funcao2", "Função do 2º grau", ["funcao do 2 grau", "funcoes do 2 grau", "funcao do segundo grau", "funcao quadratica", "funcoes quadraticas", "equacao do 2 grau", "equacao do segundo grau"], ["parabola", "vertice", "raizes", "bhaskara", "discriminante", "delta", "concavidade", "ponto de maximo", "ponto de minimo"]),
  t("funcao1", "Função do 1º grau", ["funcao do 1 grau", "funcoes do 1 grau", "funcao afim", "funcao do primeiro grau"], ["coeficiente angular", "reta", "taxa de variacao", "grafico", "funcao linear"]),
  t("exp", "Função exponencial e logaritmo", ["funcao exponencial", "logaritmo", "logaritmos", "exponencial"], ["log", "base", "crescimento exponencial", "decaimento", "meia vida", "juros compostos"]),
  t("pa", "Progressões", ["progressao aritmetica", "progressao geometrica", "progressoes", "pa e pg"], ["razao", "termo geral", "soma dos termos", "sequencia"]),
  t("porc", "Porcentagem e juros", ["porcentagem", "porcentagens", "juros", "matematica financeira"], ["desconto", "acrescimo", "juros simples", "juros compostos", "taxa", "lucro", "prejuizo"]),
  t("geoplana", "Geometria plana", ["geometria plana", "area", "perimetro", "triangulo", "circunferencia"], ["pitagoras", "semelhanca", "angulo", "poligono", "losango", "trapezio", "raio"]),
  t("geoesp", "Geometria espacial", ["geometria espacial", "volume", "prisma", "cilindro", "esfera", "piramide", "cone"], ["area lateral", "capacidade", "litros", "solido"]),
  t("trigo", "Trigonometria", ["trigonometria", "seno", "cosseno", "tangente"], ["triangulo retangulo", "angulo", "radiano", "circulo trigonometrico", "razoes trigonometricas"]),
  t("prob", "Probabilidade e combinatória", ["probabilidade", "analise combinatoria", "combinatoria", "permutacao", "arranjo", "combinacao"], ["fatorial", "evento", "espaco amostral", "principio multiplicativo", "sorteio"]),
  t("estat", "Estatística", ["estatistica", "media", "mediana", "moda", "desvio padrao"], ["grafico", "tabela", "frequencia", "histograma", "dados", "amostra"]),
  t("analitica", "Geometria analítica", ["geometria analitica", "equacao da reta", "distancia entre pontos"], ["plano cartesiano", "coordenadas", "coeficiente angular", "circunferencia", "ponto medio"]),
  // Física
  t("cinem", "Cinemática", ["cinematica", "movimento uniforme", "movimento uniformemente variado", "mru", "mruv", "queda livre", "lancamento"], ["velocidade", "aceleracao", "deslocamento", "velocidade media", "espaco", "gravidade", "movimento"]),
  t("dinam", "Dinâmica e leis de Newton", ["dinamica", "leis de newton", "newton", "forca"], ["massa", "inercia", "atrito", "forca de atrito", "peso", "normal", "tensao", "aceleracao", "forca resultante"]),
  t("energia", "Trabalho e energia", ["trabalho e energia", "energia mecanica", "energia cinetica", "energia potencial", "potencia"], ["conservacao de energia", "joule", "trabalho", "watt", "rendimento"]),
  t("eletric", "Eletricidade", ["eletricidade", "circuito eletrico", "corrente eletrica", "lei de ohm", "eletrodinamica"], ["resistor", "resistencia", "tensao", "ddp", "potencia eletrica", "ampere", "volt", "serie", "paralelo", "carga eletrica"]),
  t("optica", "Óptica", ["optica", "lente", "lentes", "espelho", "espelhos", "refracao", "reflexao"], ["raio de luz", "imagem", "foco", "indice de refracao", "miopia"]),
  t("termo", "Termologia e calor", ["termologia", "calorimetria", "termodinamica", "calor"], ["temperatura", "dilatacao", "calor especifico", "gas ideal", "entropia", "isotermica", "ciclo"]),
  t("ondas", "Ondas e som", ["ondulatoria", "ondas", "acustica", "som"], ["frequencia", "comprimento de onda", "amplitude", "efeito doppler", "ressonancia", "eco"]),
  // Química
  t("quimorg", "Química orgânica", ["quimica organica", "funcoes organicas", "hidrocarbonetos"], ["alcool", "cetona", "aldeido", "acido carboxilico", "ester", "isomeria", "carbono", "cadeia carbonica", "polimero"]),
  t("equil", "Equilíbrio químico", ["equilibrio quimico", "constante de equilibrio", "ph", "acidos e bases", "acido base"], ["le chatelier", "kc", "solucao tampao", "hidrolise", "indicador", "poh"]),
  t("estequio", "Estequiometria", ["estequiometria", "calculo estequiometrico", "mol", "massa molar"], ["reagente limitante", "rendimento", "balanceamento", "avogadro", "proporcao"]),
  t("eletroq", "Eletroquímica", ["eletroquimica", "pilha", "pilhas", "eletrolise"], ["oxidacao", "reducao", "anodo", "catodo", "potencial padrao", "bateria", "corrosao"]),
  t("solucoes", "Soluções", ["solucoes", "concentracao", "diluicao", "propriedades coligativas"], ["molaridade", "soluto", "solvente", "solubilidade", "pressao de vapor", "osmose"]),
  t("termoquim", "Termoquímica e cinética", ["termoquimica", "cinetica quimica", "entalpia"], ["exotermica", "endotermica", "lei de hess", "energia de ativacao", "catalisador", "velocidade de reacao"]),
  // Biologia
  t("citologia", "Citologia", ["citologia", "celula", "celulas", "organelas"], ["membrana plasmatica", "mitocondria", "nucleo", "ribossomo", "citoplasma", "mitose", "meiose", "respiracao celular"]),
  t("genetica", "Genética", ["genetica", "leis de mendel", "heredograma", "hereditariedade"], ["dna", "gene", "alelo", "dominante", "recessivo", "genotipo", "fenotipo", "cromossomo", "mutacao", "cruzamento"]),
  t("evolucao", "Evolução", ["evolucao", "selecao natural", "darwin", "especiacao"], ["lamarck", "adaptacao", "fosseis", "ancestral comum", "deriva genetica"]),
  t("ecologia", "Ecologia", ["ecologia", "cadeia alimentar", "ecossistema", "biomas", "bioma"], ["populacao", "comunidade", "nicho", "producao", "sucessao ecologica", "ciclo do carbono", "poluicao", "efeito estufa", "biodiversidade"]),
  t("fisiohum", "Fisiologia humana", ["fisiologia humana", "sistema digestorio", "sistema circulatorio", "sistema nervoso", "sistema imunologico"], ["hormonio", "coracao", "sangue", "neuronio", "vacina", "anticorpo", "digestao", "rim"]),
  t("botanica", "Botânica", ["botanica", "plantas", "fotossintese"], ["clorofila", "estomato", "seiva", "angiosperma", "gimnosperma", "polinizacao", "fruto"]),
  // História
  t("brasilcol", "Brasil Colônia", ["brasil colonia", "periodo colonial", "colonizacao do brasil"], ["capitanias hereditarias", "engenho", "escravidao", "bandeirantes", "pau brasil", "jesuitas", "ciclo do ouro", "inconfidencia mineira"]),
  t("imperio", "Brasil Império", ["brasil imperio", "imperio do brasil", "segundo reinado", "periodo imperial"], ["dom pedro", "abolicao", "lei aurea", "guerra do paraguai", "cafe", "regencia"]),
  t("republica", "República brasileira", ["republica velha", "era vargas", "estado novo", "ditadura militar", "redemocratizacao"], ["coronelismo", "politica do cafe com leite", "vargas", "ai 5", "diretas ja", "constituicao de 1988"]),
  t("guerras", "Guerras mundiais", ["primeira guerra mundial", "segunda guerra mundial", "guerra fria", "nazismo", "fascismo"], ["holocausto", "hitler", "mussolini", "tratado de versalhes", "otan", "urss", "muro de berlim", "crise de 1929"]),
  t("antiga", "Antiguidade", ["antiguidade", "grecia antiga", "roma antiga", "egito antigo", "idade media", "feudalismo"], ["democracia ateniense", "imperio romano", "faraos", "senhores feudais", "servidao", "cruzadas"]),
  t("indust", "Revolução Industrial e capitalismo", ["revolucao industrial", "capitalismo", "imperialismo", "neocolonialismo"], ["fabrica", "operarios", "maquina a vapor", "proletariado", "socialismo", "marx", "burguesia", "partilha da africa"]),
  t("escravidao", "Escravidão e abolição", ["escravidao", "abolicao", "trafico negreiro", "quilombo"], ["lei aurea", "africanos", "zumbi", "lei do ventre livre", "abolicionismo"]),
  // Geografia
  t("clima", "Clima e meio ambiente", ["climatologia", "clima", "aquecimento global", "mudancas climaticas", "desmatamento"], ["efeito estufa", "el nino", "massas de ar", "chuva", "amazonia", "desertificacao", "sustentabilidade"]),
  t("urban", "Urbanização e população", ["urbanizacao", "demografia", "populacao", "migracao", "migracoes"], ["exodo rural", "metropole", "favela", "piramide etaria", "envelhecimento", "natalidade", "mobilidade urbana"]),
  t("global", "Globalização e geopolítica", ["globalizacao", "geopolitica", "blocos economicos", "ordem mundial"], ["mercosul", "uniao europeia", "multinacionais", "china", "comercio internacional", "brics"]),
  t("relevo", "Geologia e relevo", ["geologia", "relevo", "tectonica de placas", "hidrografia", "bacias hidrograficas"], ["vulcao", "terremoto", "erosao", "rios", "solo", "mineral", "planalto", "planicie"]),
  // Língua portuguesa, literatura, redação
  t("figuras", "Figuras de linguagem", ["figuras de linguagem", "metafora", "metonimia", "ironia", "hiperbole"], ["comparacao", "antitese", "paradoxo", "personificacao", "eufemismo"]),
  t("sintaxe", "Sintaxe e gramática", ["sintaxe", "concordancia", "regencia", "crase", "pontuacao", "classes de palavras"], ["sujeito", "predicado", "oracao subordinada", "verbo", "pronome", "adjetivo", "conjuncao"]),
  t("generos", "Gêneros e interpretação de texto", ["interpretacao de texto", "genero textual", "generos textuais", "tipologia textual"], ["cronica", "noticia", "artigo de opiniao", "charge", "tirinha", "argumentacao", "coesao", "coerencia"]),
  t("romantismo", "Romantismo", ["romantismo", "indianismo"], ["alencar", "castro alves", "goncalves dias", "ultrarromantismo", "condoreirismo", "nacionalismo"]),
  t("barroco", "Barroco e Arcadismo", ["barroco", "arcadismo", "classicismo", "trovadorismo", "humanismo"], ["gregorio de matos", "padre vieira", "cantiga", "locus amoenus", "fugere urbem"]),
  t("parnasianismo", "Parnasianismo e Simbolismo", ["parnasianismo", "simbolismo", "pre modernismo"], ["olavo bilac", "cruz e sousa", "arte pela arte", "euclides da cunha", "os sertoes"]),
  // Inglês e Filosofia/Sociologia
  t("ingles", "Inglês: interpretação", ["ingles", "english", "reading comprehension"], ["verb tense", "present perfect", "passive voice", "text", "according to the text"]),
  t("filosofia", "Filosofia", ["filosofia", "etica", "epistemologia"], ["socrates", "platao", "aristoteles", "kant", "descartes", "nietzsche", "existencialismo", "mito da caverna"]),
  t("sociologia", "Sociologia", ["sociologia", "cidadania", "desigualdade social", "cultura"], ["durkheim", "weber", "marx", "movimentos sociais", "estratificacao", "direitos humanos", "preconceito"]),
];
