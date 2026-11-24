/** Tours de primeira visita: um por página. `sel` é uma lista de seletores CSS (usa o primeiro que estiver visível; no celular o menu lateral vira a barra de baixo). */
export type PassoTour = { sel?: string[]; titulo: string; texto: string };
export type Tour = { id: string; passos: PassoTour[] };

const MENU = ['nav[aria-label="Principal"]', 'nav[aria-label="Navegação principal"]'];
const t = (id: string, passos: PassoTour[]): Tour => ({ id, passos });

export const TOURS: Record<string, Tour> = {
  "/app": t("inicio", [
    { titulo: "Bem-vindo à Segunda Lousa", texto: "Este é o seu início. Vamos mostrar rapidinho onde ficam as coisas — leva menos de um minuto.", sel: [".inicio-head h1"] },
    { sel: MENU, titulo: "Menu principal", texto: "Turmas, notas, frequência, provas, planos, biblioteca, quiz, agenda, GizIA e mensagens. No celular, “Mais” abre o resto." },
    { sel: [".inicio-head .btn", '[data-testid="criar-prova"]'], titulo: "Crie uma prova", texto: "O atalho mais usado: monte uma prova com questões de vestibulares a partir do que você ensinou." },
    { sel: [".kpi-row"], titulo: "Seus números", texto: "Turmas, alunos, provas e pendências de relance. Toque em qualquer um para abrir." },
    { sel: ['a[aria-label="Buscar no banco de questões"]'], titulo: "Busca no banco", texto: "Pesquise questões por assunto, autor ou obra, a qualquer hora." },
  ]),
  "/app/meu-dia": t("meu-dia", [
    { sel: ["main h1", "h1"], titulo: "Meu dia", texto: "As aulas de hoje, na ordem do seu horário, com o plano do dia e a chamada." },
    { sel: [".divide-y", '[data-testid="sem-aulas"]'], titulo: "Aulas de hoje", texto: "Veja a chamada pendente e abra a turma ou o plano. Cadastre seus horários para preencher esta lista." },
  ]),
  "/app/turmas": t("turmas", [
    { sel: ["h1"], titulo: "Suas turmas", texto: "Cada turma reúne alunos, notas, frequência, avaliações e ocorrências." },
    { sel: [".page-head .actions .btn", 'a[href="/app/turmas/nova"]'], titulo: "Nova turma", texto: "Crie uma turma e cole a lista de alunos — a prévia mostra tudo antes de salvar." },
  ]),
  "/app/notas": t("notas", [
    { sel: ["h1"], titulo: "Notas", texto: "Notas por turma e por período, com a média calculada pela regra da escola." },
    { sel: [".page-head .actions .btn", 'a[href*="avaliac"]'], titulo: "Nova avaliação", texto: "Adicione atividades e lance as notas na grade. Zero, falta e pendente nunca se confundem." },
    { sel: ["select#turma", "select[name=turma]"], titulo: "Turma e período", texto: "Troque a turma e o bimestre aqui." },
  ]),
  "/app/frequencia": t("frequencia", [
    { sel: ["h1"], titulo: "Frequência", texto: "Faça a chamada e acompanhe quem está faltando." },
    { sel: ['[data-testid="abrir-chamada"]'], titulo: "Fazer chamada", texto: "Abre a chamada num modal: marque Presente, Falta ou Justificada, ou use “Marcar todos presentes”." },
  ]),
  "/app/provas": t("provas", [
    { sel: ["h1"], titulo: "Provas", texto: "Rascunhos, provas aplicadas e correção, num só lugar." },
    { sel: ['a[href="/app/provas/montar"]'], titulo: "Montar prova", texto: "Digite os temas, a série e a disciplina: a Segunda Lousa busca questões de vestibulares e abre a prova no editor." },
    { sel: ['a[href="/app/provas/listas"]'], titulo: "Lista A/B", texto: "Gera duas versões com as mesmas questões em outra ordem, para reduzir cola." },
    { sel: ['a[href="/app/provas/corrigir-foto"]'], titulo: "Corrigir por foto", texto: "Fotografe uma resposta escrita à mão: a GizIA sugere nota e comentário." },
  ]),
  "/app/provas/montar": t("montar", [
    { sel: ["#themes"], titulo: "O que você ensinou", texto: "Escreva os temas do jeito que falar: “funções do 2º grau”, “Machado de Assis”, “cinemática”. Separe por vírgula." },
    { sel: ["#grade"], titulo: "Série e dificuldade", texto: "A série define a dificuldade-alvo das questões escolhidas." },
    { sel: ['form button[type="submit"]'], titulo: "Montar", texto: "A prova abre no editor, onde tudo pode ser trocado, reordenado e editado como num documento." },
  ]),
  "/app/biblioteca": t("biblioteca", [
    { sel: ["h1"], titulo: "Biblioteca", texto: "Materiais, provas e apresentações juntos." },
    { sel: [".lib-tabs"], titulo: "Abas e busca", texto: "Filtre por tipo, busque pelo título e escolha a turma." },
    { sel: ['[data-testid="adicionar-material"]'], titulo: "Adicionar material", texto: "Guarde textos, links e arquivos, e compartilhe com a escola se quiser." },
  ]),
  "/app/quiz": t("quiz", [
    { sel: ["h1"], titulo: "Quiz ao vivo", texto: "Estilo Kahoot: a turma entra por um código no celular e responde valendo pontos." },
    { sel: ['[data-testid="novo-quiz"]'], titulo: "Novo quiz", texto: "Crie à mão, como num formulário, ou peça para a GizIA escrever." },
  ]),
  "/app/agenda": t("agenda", [
    { sel: ["h1"], titulo: "Agenda", texto: "Provas, prazos e reuniões num calendário." },
    { sel: ['[data-testid="adicionar-evento"]'], titulo: "Adicionar evento", texto: "Cria um evento num modal, com repetição e lembrete." },
  ]),
  "/app/assistente": t("gizia", [
    { sel: [".giz-main", "main"], titulo: "GizIA, sua assistente", texto: "Peça provas, planos de aula, apresentações em PowerPoint e quiz. Ela te faz algumas perguntas antes de criar." },
    { sel: ['[data-testid="nova-conversa"]'], titulo: "Conversas", texto: "Cada assunto vira uma conversa, como no ChatGPT. Você pode renomear e apagar." },
    { sel: [".giz-composer", "form"], titulo: "Escreva ou anexe", texto: "Use o ＋ para anexar PDF, DOCX ou foto como material-base. Dá para parar e editar mensagens." },
    { sel: ['[data-testid="creditos"]'], titulo: "Créditos", texto: "O uso de IA gasta créditos diários (1.000 tokens = 1 crédito)." },
  ]),
  "/app/chat": t("mensagens", [
    { sel: [".chat-list"], titulo: "Conversas", texto: "Fale com colegas e a coordenação. Toque em ＋ para iniciar uma conversa ou criar um grupo." },
    { sel: [".chat-pane"], titulo: "Mensagens", texto: "Escolha uma conversa para ler e responder, anexar arquivos e reagir." },
  ]),
  "/app/planos-de-aula": t("planos", [
    { sel: ["h1"], titulo: "Planos de aula", texto: "Crie planos completos com objetivos, momentos e avaliação — editáveis." },
    { sel: [".page-head .actions .btn", "form button[type=submit]"], titulo: "Criar plano", texto: "Informe o tema e a duração. Se a GizIA estiver ativa, ela escreve o rascunho." },
  ]),
  "/app/banco": t("banco", [
    { sel: ['input[name="q"]', "input[type=search]"], titulo: "Busca no banco", texto: "Digite um assunto, autor ou obra: a busca também traz tópicos relacionados." },
    { sel: ['[data-testid="resultado-questao"]'], titulo: "Resultados", texto: "Cada questão mostra banca, ano, gabarito e o motivo de ter aparecido. Inclua numa prova com um toque." },
  ]),
};
