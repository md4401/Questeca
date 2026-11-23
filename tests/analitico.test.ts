import { describe, it, expect } from "vitest";
import { riskOf, distribution, mean, thresholdsFrom } from "@/lib/core/analytics";
describe("indicadores de atenção", () => {
  const t = thresholdsFrom({ minAttendance: 75, minAverage: 6, maxLateTasks: 2 });
  it("explica cada critério e não infere sem dados", () => {
    expect(riskOf({ average: null, averagePartial: false, attendancePct: null, lateTasks: 0 }, t)).toEqual({ level: "sem_dados", reasons: ["Sem dados suficientes para sinalizar."] });
    expect(riskOf({ average: 8, averagePartial: false, attendancePct: 90, lateTasks: 0 }, t).level).toBe("ok");
    const one = riskOf({ average: 5.5, averagePartial: true, attendancePct: 90, lateTasks: 0 }, t);
    expect(one.level).toBe("atencao"); expect(one.reasons[0]).toMatch(/Média 5,5 \(parcial\) abaixo de 6/);
    const two = riskOf({ average: 4, averagePartial: false, attendancePct: 60, lateTasks: 3 }, t);
    expect(two.level).toBe("alerta"); expect(two.reasons).toHaveLength(3);
    expect(riskOf({ average: null, averagePartial: false, attendancePct: 60, lateTasks: 0 }, t).reasons[0]).toMatch(/Frequência 60%/);
  });
  it("limites vêm da escola, com a nota de aprovação como padrão", () => {
    expect(thresholdsFrom(undefined, 7).minAverage).toBe(7); expect(thresholdsFrom({ minAverage: 5 }, 7).minAverage).toBe(5); expect(thresholdsFrom(undefined).minAttendance).toBe(75);
  });
  it("distribuição e média", () => {
    expect(distribution([0, 1.9, 2, 5, 10], 10).map((b) => b.n)).toEqual([2, 1, 1, 0, 1]);
    expect(mean([2, 4])).toBe(3); expect(mean([])).toBeNull();
  });
});

