import { describe, it, expect } from "vitest";
import { signCard, verifyCard } from "@/lib/core/card-token";
import { tokenFromScan } from "@/lib/core/scan";
const A = "11111111-1111-4111-8111-111111111111", S = "22222222-2222-4222-8222-222222222222";
describe("Token do QR do cartão", () => {
  it("assina e verifica", () => { const t = signCard(A, S, "segredo"); expect(verifyCard(t, "segredo")).toEqual({ appId: A, studentId: S }); });
  it("rejeita segredo errado, adulteração e lixo", () => {
    const t = signCard(A, S, "segredo");
    expect(verifyCard(t, "outro")).toBeNull();
    const [p, m] = t.split("."); expect(verifyCard(`${Buffer.from(`${A}.${A}`).toString("base64url")}.${m}`, "segredo")).toBeNull();
    expect(verifyCard("abc", "segredo")).toBeNull(); expect(verifyCard(`${p}.`, "segredo")).toBeNull();
  });
  it("extrai o token do link escaneado", () => {
    const t = signCard(A, S, "x");
    expect(tokenFromScan(`https://questeca.app/app/g/${t}`)).toBe(t); expect(tokenFromScan(`/app/g/${t}?x=1`)).toBe(t); expect(tokenFromScan(` ${t} `)).toBe(t);
  });
});
