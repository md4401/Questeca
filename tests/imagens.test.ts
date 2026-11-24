import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
vi.mock("server-only", () => ({}));
import http from "node:http";
import type { AddressInfo } from "node:net";
import { buscarImagem, baixarImagens } from "@/lib/assistente/imagens";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const GRANDE = Buffer.concat([PNG, Buffer.alloc(8000, 1)]); // passa do mínimo de 5 KB
let srv: http.Server; let base = "";
beforeAll(async () => {
  srv = http.createServer((req, res) => {
    const u = new URL(req.url!, "http://x");
    if (u.pathname === "/img.png") { res.setHeader("content-type", "image/png"); res.end(GRANDE); return; }
    const termo = u.searchParams.get("gsrsearch") ?? "";
    const page = (lic: string, id: number) => ({ imageinfo: [{ thumburl: `${base}/img.png`, mime: "image/png", width: 1600, extmetadata: { LicenseShortName: { value: lic }, Artist: { value: "<a href='x'>Maria &amp; Cia</a>" } } }], pageid: id });
    const pages = termo.includes("nc") ? { 1: page("CC BY-NC 4.0", 1) } : termo.includes("nada") ? {} : { 1: page("CC BY-NC 4.0", 1), 2: page("CC BY-SA 4.0", 2) };
    res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ query: { pages } }));
  }).listen(0);
  await new Promise((r) => srv.once("listening", r));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  process.env.IMAGENS_API_URL = `${base}/api`;
});
afterAll(() => srv.close());

describe("busca de imagens livres", () => {
  it("pega a foto de licença livre, ignora NC e devolve o crédito", async () => {
    const im = await buscarImagem("Bastille 1789");
    expect(im).not.toBeNull();
    expect(im!.dataUrl.startsWith("image/png;base64,")).toBe(true);
    expect(im!.credito).toBe("Foto: Maria & Cia / Wikimedia Commons / CC BY-SA 4.0");
  });
  it("só licença não livre ou nenhum resultado → null (o slide usa a ilustração)", async () => {
    expect(await buscarImagem("nc")).toBeNull();
    expect(await buscarImagem("nada")).toBeNull();
  });
  it("sem rede → null, sem derrubar a criação", async () => {
    process.env.IMAGENS_API_URL = "http://127.0.0.1:9/api";
    expect(await buscarImagem("qualquer", 800)).toBeNull();
    process.env.IMAGENS_API_URL = `${base}/api`;
  });
  it("baixa várias em paralelo pelas chaves pedidas", async () => {
    const r = await baixarImagens([{ chave: "capa", busca: "a" }, { chave: "3", busca: "nada" }]);
    expect(Object.keys(r)).toEqual(["capa"]);
  });
  it("IMAGENS_DESLIGADAS=1 desliga a busca", async () => {
    process.env.IMAGENS_DESLIGADAS = "1"; expect(await buscarImagem("a")).toBeNull(); delete process.env.IMAGENS_DESLIGADAS;
  });
});
