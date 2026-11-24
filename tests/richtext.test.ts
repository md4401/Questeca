import { describe, it, expect } from "vitest";
import { fromHtml, toHtml, parseMarkup, normalizeMarkup, plain } from "@/lib/core/richtext";
describe("Texto formatado", () => {
  it("HTML do editor vira marcação", () => {
    expect(fromHtml("Calcule <b>x</b> e <i>y</i> e <u>z</u>.")).toBe("Calcule {b}x{/b} e {i}y{/i} e {u}z{/u}.");
    expect(fromHtml("<strong>a</strong><em>b</em>")).toBe("{b}a{/b}{i}b{/i}");
  });
  it("aninhamento e quebras de linha", () => {
    expect(fromHtml("<b>a<i>b</i></b><br>c")).toBe("{b}a{/b}{b}{i}b{/i}{/b}\nc");
    expect(fromHtml("<div>um</div><div>dois</div>")).toBe("um\ndois");
    expect(fromHtml("a<br><br><br><br>b")).toBe("a\n\nb");
  });
  it("entidades e HTML perigoso não passam", () => {
    expect(fromHtml("2 &lt; 3 &amp; 4&nbsp;5")).toBe("2 < 3 & 4 5");
    expect(plain(fromHtml('<script>alert(1)</script>oi <img src=x onerror=alert(1)>'))).toBe("alert(1)oi ");
    expect(toHtml("a < b {b}x{/b}")).toBe("a &lt; b <b>x</b>");
  });
  it("chaves literais sobrevivem e tags desconhecidas somem", () => {
    const m = fromHtml("conjunto {1, 2}");
    expect(plain(m)).toBe("conjunto {1, 2}");
    expect(normalizeMarkup("{b}ok{/b}{x}")).toBe("{b}ok{/b}{x}".replace("{x}", "{lb}x}"));
  });
  it("ida e volta mantém o texto e o formato", () => {
    const m = "Linha {b}um{/b}\n{i}dois{/i} {u}três{/u}";
    expect(fromHtml(toHtml(m))).toBe(m);
    expect(parseMarkup(m)).toHaveLength(2);
  });
  it("marcação não fechada é equilibrada ao normalizar", () => { expect(normalizeMarkup("{b}aberto")).toBe("{b}aberto{/b}"); });
});
