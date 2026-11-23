import { extractTopics, normalize } from "./taxonomy-shim";
import type { LessonPlanContent } from "@/db/schema";

export type PlanInput = { theme: string; grade: string; subject: string; durationMin: number; school: string; className: string; teacher: string; date: string };

/** Distribui o tempo da aula em momentos didáticos (proporções fixas, soma exata). */
export function splitMinutes(total: number) {
  const parts = [0.1, 0.2, 0.4, 0.2, 0.1];
  const m = parts.map((p) => Math.max(2, Math.round(total * p)));
  m[2] += total - m.reduce((a, b) => a + b, 0);
  return m;
}

/** Plano de aula por modelo (sem IA). Estrutura escolar padrão; o texto é sempre rascunho para o professor revisar. */
export function templatePlan(i: PlanInput): LessonPlanContent {
  const topics = extractTopics(i.theme).map((t) => t.name);
  const tema = i.theme.trim();
  const [m1, m2, m3, m4, m5] = splitMinutes(i.durationMin);
  return {
    identificacao: { escola: i.school, turma: i.className, disciplina: i.subject, professor: i.teacher, data: i.date, duracaoMin: i.durationMin },
    tema,
    objetivos: [
      `Compreender os conceitos centrais de ${tema}.`,
      `Aplicar ${tema} na resolução de situações-problema do cotidiano.`,
      `Justificar procedimentos e comunicar o raciocínio com clareza.`,
    ],
    habilidades: topics.length ? topics.map((n) => `Reconhecer, representar e aplicar: ${n}.`) : [`Mobilizar conhecimentos prévios para investigar ${tema}.`],
    recursos: ["Quadro e giz/pincel", "Caderno e lista de exercícios impressa", "Material manipulável ou exemplos do cotidiano", "Projetor (opcional)"],
    momentos: [
      { titulo: "Acolhimento e retomada", minutos: m1, descricao: `Registro de presença e retomada rápida do que a turma já sabe, por meio de duas perguntas diagnósticas sobre ${tema}.` },
      { titulo: "Problematização", minutos: m2, descricao: `Apresentar uma situação-problema que motive ${tema}; os estudantes levantam hipóteses em duplas antes da explicação.` },
      { titulo: "Desenvolvimento", minutos: m3, descricao: `Explicação dialogada com exemplos graduais de ${tema}, do mais simples ao mais desafiador; sistematização no quadro.` },
      { titulo: "Prática orientada", minutos: m4, descricao: `Resolução de exercícios em duplas, com o professor circulando para mediar dificuldades e registrar observações.` },
      { titulo: "Fechamento e avaliação", minutos: m5, descricao: `Síntese coletiva, correção de um item e questão-saída individual para verificar a aprendizagem.` },
    ],
    avaliacao: `Observação da participação, registro das dificuldades durante a prática orientada e questão-saída sobre ${tema}. Os erros mais frequentes orientam a retomada na próxima aula.`,
    adaptacoes: "Oferecer enunciados com letra ampliada e menos itens por folha, permitir uso de material concreto, tempo adicional e atividades em duplas para estudantes com necessidades específicas, conforme o PEI.",
    referencias: ["Base Nacional Comum Curricular (BNCC)", "Livro didático adotado pela escola", "Currículo da rede/escola"],
    origem: "modelo",
  };
}

export { normalize };
