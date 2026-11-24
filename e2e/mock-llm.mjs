// Servidor falso de IA (API compatível com OpenAI) para testar o fluxo "escolher e criar questões com IA" sem chave.
// Uso: node e2e/mock-llm.mjs   e suba o app com AI_PROVIDER=nvidia NVIDIA_API_KEY=x NVIDIA_URL=http://127.0.0.1:9999/v1
import http from "node:http";
http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const j = JSON.parse(b); const usr = j.messages[1].content.map((x) => x.text).join("");
    let out; let atraso = 0;
    if (usr.includes("[lento]")) atraso = 5000; // simula uma resposta demorada (para testar o botão Parar)
    const anexo = usr.match(/\[ANEXO do professor:[^\]]*\]\s*<<<\s*([\s\S]*?)>>>/);
    if (anexo) out = JSON.stringify({ acao: "responder", texto: `Li o anexo: ${anexo[1].trim().slice(0, 60)}` });
    else if (usr.includes("Devolva só um JSON array com até 15")) out = '["machado","bentinho","capitu","realismo","ironia"]';
    else if (usr.includes("Escolha as ")) { const ids = [...usr.matchAll(/#([0-9a-f]{8}) \|/g)].map((m) => "#" + m[1]); out = JSON.stringify({ ids: ids.slice(-4).reverse() }); }
    else if (usr.includes("questões inéditas")) {
      const n = Number(usr.match(/Crie (\d+) quest/)?.[1] ?? 1);
      out = JSON.stringify(Array.from({ length: n }, (_, k) => ({ tema: "Realismo brasileiro", enunciado: `Questão criada pela IA número ${k + 1}: em Dom Casmurro, qual é a principal dúvida narrativa?`, alternativas: ["Se Capitu traiu Bentinho", "Se Bentinho era rico", "Se José Dias mentia", "Se Escobar viajou", "Se Dona Glória voltou"], gabarito: "A" })));
    } else out = '{"acao":"responder","texto":"ok"}';
    res.setHeader("content-type", "application/json");
    setTimeout(() => res.end(JSON.stringify({ choices: [{ message: { content: out } }], usage: { prompt_tokens: 900, completion_tokens: 120 } })), atraso);
  });
}).listen(9999);
