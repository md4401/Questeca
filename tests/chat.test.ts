import { describe, it, expect } from "vitest";
import { canStart, withinHours, policyFrom, canPostInGroup, directKey, attachmentProblem, canEdit, embedUrl, validHttpUrl } from "@/lib/core/chat";

describe("regras de conversa", () => {
  const def = policyFrom();
  it("equipe fala entre si; aluno e responsável nunca entre si", () => {
    expect(canStart("teacher", "coordinator", false, def)).toEqual({ ok: true });
    expect(canStart("student", "guardian", true, def).ok).toBe(false);
    expect(canStart("guardian", "guardian", true, def).ok).toBe(false);
    expect(canStart("student", "student", true, { ...def, studentToStaff: true }).ok).toBe(false);
  });
  it("padrão: responsável fala com professor da turma; aluno não, até a escola habilitar", () => {
    expect(canStart("guardian", "teacher", true, def)).toEqual({ ok: true });
    expect(canStart("guardian", "teacher", false, def).ok).toBe(false);
    expect(canStart("student", "teacher", true, def).ok).toBe(false);
    expect(canStart("student", "teacher", true, { ...def, studentToStaff: true })).toEqual({ ok: true });
    expect(canStart("guardian", "teacher", true, { ...def, guardianToStaff: false }).ok).toBe(false);
  });
  it("professor só inicia com quem está ligado à turma", () => {
    expect(canStart("teacher", "guardian", true, def)).toEqual({ ok: true });
    expect(canStart("teacher", "student", false, def).ok).toBe(false);
  });
  it("horário de atendimento no fuso de São Paulo", () => {
    const p = policyFrom({ hoursFrom: "07:00", hoursTo: "19:00" });
    expect(withinHours(new Date("2026-03-02T13:00:00Z"), p)).toBe(true);  // 10:00 SP
    expect(withinHours(new Date("2026-03-02T23:00:00Z"), p)).toBe(false); // 20:00 SP
    expect(withinHours(new Date("2026-03-02T09:59:00Z"), p)).toBe(false); // 06:59 SP
    expect(withinHours(new Date("2026-03-02T23:00:00Z"), def)).toBe(true);
  });
  it("grupos, chave direta, anexos, edição e vídeo", () => {
    expect(canPostInGroup("student", "class", def).ok).toBe(false);
    expect(canPostInGroup("student", "class", { ...def, classGroups: true }).ok).toBe(true);
    expect(canPostInGroup("guardian", "group", { ...def, classGroups: true }).ok).toBe(false);
    expect(directKey("b", "a")).toBe("a:b");
    expect(attachmentProblem("image/svg+xml", 10)).toMatch(/não permitido/);
    expect(attachmentProblem("text/html", 10)).toMatch(/não permitido/);
    expect(attachmentProblem("image/png", 3 * 1024 * 1024)).toMatch(/2 MB/);
    expect(attachmentProblem("application/pdf", 1000)).toBeNull();
    const now = new Date("2026-03-02T12:00:00Z");
    expect(canEdit(new Date("2026-03-02T11:50:00Z"), now)).toBe(true); expect(canEdit(new Date("2026-03-02T11:40:00Z"), now)).toBe(false);
    expect(embedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedUrl("https://vimeo.com/123456")).toBe("https://player.vimeo.com/video/123456");
    expect(embedUrl("https://exemplo.com/video.mp4")).toBeNull(); expect(embedUrl("javascript:alert(1)")).toBeNull();
    expect(validHttpUrl("ftp://x")).toBe(false); expect(validHttpUrl("https://x.com/a")).toBe(true);
  });
});
