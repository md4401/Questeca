import { describe, it, expect } from "vitest";
import { splitMinutes, templatePlan } from "@/lib/core/lesson-plan";
import { templateOpinion } from "@/lib/core/opinion";
describe("Plano de aula por modelo", () => {
  it("minutos somam a duração", () => { for (const d of [30, 45, 50, 100]) expect(splitMinutes(d).reduce((a, b) => a + b, 0)).toBe(d); });
  it("estrutura padrão e habilidades do tema", () => {
    const p = templatePlan({ theme: "Porcentagem e descontos sucessivos", grade: "9", subject: "Matemática", durationMin: 50, school: "Escola X", className: "9º B", teacher: "Ana", date: "2026-11-23" });
    expect(p.momentos).toHaveLength(5); expect(p.momentos.reduce((a, m) => a + m.minutos, 0)).toBe(50);
    expect(p.habilidades.join(" ")).toMatch(/Porcentagem simples/); expect(p.origem).toBe("modelo"); expect(p.objetivos[0]).toContain("Porcentagem e descontos sucessivos");
  });
});
describe("Parecer descritivo por modelo", () => {
  it("compõe frases só com o que foi registrado", () => {
    const t = templateOpinion({ name: "Iara Dias", periodLabel: "novembro", tags: ["participou", "dificuldade"], notes: ["Foi à lousa na aula de frações."], attendancePct: 92.5, average: 7.4 })!;
    expect(t).toMatch(/Iara participou ativamente/); expect(t).toMatch(/Por outro lado, Iara demonstrou dificuldade/); expect(t).toMatch(/92,5%/); expect(t).toMatch(/média 7,4/); expect(t).toMatch(/Registros do professor: Foi à lousa/); expect(t).toMatch(/acompanhamento próximo/);
  });
  it("sem registros não inventa nada", () => { expect(templateOpinion({ name: "João", periodLabel: "novembro", tags: [], notes: [], attendancePct: null, average: null })).toBeNull(); });
});
