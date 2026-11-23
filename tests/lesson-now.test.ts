import { describe, it, expect } from "vitest";
import { lessonNow, nowInSP, toMin } from "@/lib/core/lesson-now";

const slots = [
  { id: "a", weekday: 1, startTime: "07:30", endTime: "08:20" },
  { id: "b", weekday: 1, startTime: "08:20", endTime: "09:10" },
  { id: "c", weekday: 1, startTime: "13:00", endTime: "13:50" },
  { id: "d", weekday: 2, startTime: "07:30", endTime: "08:20" },
];
// segunda-feira, 23/11/2026 (UTC-3): 10:45Z = 07:45 em Brasília
describe("Aula de Agora", () => {
  it("converte para o horário de Brasília", () => {
    expect(nowInSP(new Date("2026-11-23T10:45:00Z"))).toEqual({ weekday: 1, minutes: 7 * 60 + 45, dateISO: "2026-11-23" });
    expect(nowInSP(new Date("2026-11-24T01:30:00Z")).dateISO).toBe("2026-11-23"); // 22:30 de segunda
  });
  it("acha a aula em andamento e a próxima", () => {
    const r = lessonNow(slots, new Date("2026-11-23T10:45:00Z"));
    expect(r.current?.id).toBe("a"); expect(r.next?.id).toBe("b"); expect(r.today.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
  it("início inclusivo, fim exclusivo", () => {
    expect(lessonNow(slots, new Date("2026-11-23T11:20:00Z")).current?.id).toBe("b"); // 08:20
  });
  it("entre aulas não há aula atual, mas há a próxima", () => {
    const r = lessonNow(slots, new Date("2026-11-23T14:00:00Z")); // 11:00
    expect(r.current).toBeNull(); expect(r.next?.id).toBe("c");
  });
  it("sem aulas hoje", () => {
    const r = lessonNow(slots, new Date("2026-11-22T15:00:00Z")); // domingo
    expect(r.current).toBeNull(); expect(r.next).toBeNull(); expect(r.today).toEqual([]);
  });
  it("toMin", () => expect(toMin("09:05")).toBe(545));
});
