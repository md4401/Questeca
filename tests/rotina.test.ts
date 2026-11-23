import { describe, it, expect } from "vitest";
import { summarize, isLow } from "@/lib/core/attendance";
import { expand, slotConflicts, weekStart, isoWeekday, fromSP, spISO, type EventLike } from "@/lib/core/calendar";

describe("frequência", () => {
  it("só conta chamadas registradas e falta justificada não é presença", () => {
    expect(summarize([])).toEqual({ total: 0, present: 0, absent: 0, justified: 0, pct: null });
    const s = summarize([{ status: "present" }, { status: "present" }, { status: "absent" }, { status: "justified" }]);
    expect(s).toMatchObject({ total: 4, present: 2, absent: 1, justified: 1, pct: 50 });
    expect(isLow(74.9)).toBe(true); expect(isLow(75)).toBe(false); expect(isLow(null)).toBe(false);
  });
});

describe("agenda", () => {
  const base = (o: Partial<EventLike>): EventLike => ({ id: "e", title: "Aula", category: "evento", scope: "school", startsAt: fromSP("2026-03-02", "08:00"), allDay: false, ...o });
  it("semana começa na segunda e fuso é São Paulo", () => {
    expect(weekStart("2026-03-08")).toBe("2026-03-02"); expect(weekStart("2026-03-02")).toBe("2026-03-02");
    expect(isoWeekday("2026-03-08")).toBe(7); expect(isoWeekday("2026-03-02")).toBe(1);
    expect(spISO(fromSP("2026-03-02", "23:30"))).toBe("2026-03-02");
  });
  it("expande recorrência semanal, diária e mensal com limite", () => {
    const w = expand([base({ recurrence: { freq: "weekly", until: "2026-03-23" } })], fromSP("2026-03-01"), fromSP("2026-04-30"));
    expect(w.map((o) => spISO(o.start))).toEqual(["2026-03-02", "2026-03-09", "2026-03-16", "2026-03-23"]);
    const d = expand([base({ recurrence: { freq: "daily", interval: 2, until: "2026-03-07" } })], fromSP("2026-03-01"), fromSP("2026-03-31"));
    expect(d).toHaveLength(3);
    const m = expand([base({ startsAt: fromSP("2026-01-31", "09:00"), recurrence: { freq: "monthly", until: "2026-05-31" } })], fromSP("2026-01-01"), fromSP("2026-06-30"));
    expect(m.map((o) => spISO(o.start))).toEqual(["2026-01-31", "2026-03-31", "2026-05-31"]); // fevereiro e abril não têm dia 31
    expect(expand([base({})], fromSP("2026-04-01"), fromSP("2026-04-30"))).toHaveLength(0);
  });
  it("detecta conflito de turma, professor e sala (e permite horários encostados)", () => {
    const ex = [{ id: "1", classId: "A", teacherId: "p1", room: "Sala 3", weekday: 1, startTime: "07:30", endTime: "08:20" }];
    const mk = (o: object) => ({ classId: "B", teacherId: "p2", room: null, weekday: 1, startTime: "08:00", endTime: "08:50", ...o });
    expect(slotConflicts(mk({}), ex)).toEqual([]);
    expect(slotConflicts(mk({ classId: "A" }), ex).map((c) => c.kind)).toEqual(["turma"]);
    expect(slotConflicts(mk({ teacherId: "p1" }), ex).map((c) => c.kind)).toEqual(["professor"]);
    expect(slotConflicts(mk({ room: "sala 3" }), ex).map((c) => c.kind)).toEqual(["sala"]);
    expect(slotConflicts(mk({ teacherId: "p1", startTime: "08:20", endTime: "09:10" }), ex)).toEqual([]);
    expect(slotConflicts(mk({ id: "1", classId: "A", startTime: "07:40" }), ex)).toEqual([]);
  });
});

