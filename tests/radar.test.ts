import { describe, it, expect } from "vitest";
import { gradeDrop, consecutiveAbsences, radarOf, DEFAULT_RADAR as T } from "@/lib/core/radar";

describe("Radar de risco", () => {
  it("queda brusca: última nota vs média das anteriores", () => {
    expect(gradeDrop([8, 8, 4], T)).toMatchObject({ last: 4, prevAvg: 8, drop: 4 });
    expect(gradeDrop([7, 6.5], T)).toBeNull();
    expect(gradeDrop([5], T)).toBeNull();
    expect(gradeDrop([9, 8, 8, 3], T)?.prevAvg).toBeCloseTo(8.333, 2);
  });
  it("faltas seguidas: justificada não interrompe nem conta; presença interrompe", () => {
    expect(consecutiveAbsences(["present", "absent", "absent", "absent"])).toBe(3);
    expect(consecutiveAbsences(["absent", "absent", "present", "absent"])).toBe(1);
    expect(consecutiveAbsences(["absent", "justified", "absent", "absent"])).toBe(3);
    expect(consecutiveAbsences([])).toBe(0);
  });
  it("níveis e motivos", () => {
    expect(radarOf({ scores: [7, 7], attendance: ["present", "present", "present"] }, T).level).toBe("ok");
    const a = radarOf({ scores: [8, 8, 4], attendance: ["present", "present", "present", "present"] }, T);
    expect(a.level).toBe("alerta"); expect(a.reasons[0]).toMatch(/Queda de nota/); expect(a.flags.drop).toBe(true);
    const b = radarOf({ scores: [], attendance: ["present", "present", "present", "absent", "absent", "absent"] }, T);
    expect(b.flags.streak).toBe(true); expect(b.reasons.join(" ")).toMatch(/3 faltas seguidas/);
    const c = radarOf({ scores: [9, 9, 8], attendance: ["present", "absent", "present", "present", "present", "present"] }, T);
    expect(c.level).toBe("ok");
  });
  it("frequência baixa só com 3+ registros", () => {
    expect(radarOf({ scores: [], attendance: ["absent", "present"] }, T).flags.lowAttendance).toBe(false);
    expect(radarOf({ scores: [], attendance: ["absent", "present", "absent", "present", "absent"] }, T).flags.lowAttendance).toBe(true);
  });
});
