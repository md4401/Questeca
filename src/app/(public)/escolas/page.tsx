import { Form, Field, SubmitButton } from "@/components/form";
import { demoRequestAction } from "./actions";

export const metadata = { title: "Para escolas" };

export default function Escolas() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1>A Questeca na sua escola</h1>
      <p className="mt-2 text-lg text-ink-soft">Um padrão cadastrado vale para as próximas provas. A coordenação recebe documentos no formato esperado e acompanha o que ainda precisa de revisão, com acesso limitado à sua atribuição.</p>
      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {[
          ["Cabeçalho e modelos da escola", "A coordenação aprova o modelo uma vez; todos os professores usam."],
          ["Regras de nota configuráveis", "Escala, pesos, arredondamento, ausências e recuperação."],
          ["Convites e papéis", "Professores, coordenação e gestão com permissões separadas."],
          ["Documentos da coordenação", "Planejamento, diário, relatórios e conselho de classe com revisão."],
        ].map(([t, d]) => <li key={t} className="card"><h3>{t}</h3><p className="text-sm text-ink-soft">{d}</p></li>)}
      </ul>
      <section id="demonstracao" className="card mt-10" aria-labelledby="demo-h">
        <h2 id="demo-h">Solicitar demonstração</h2>
        <p className="hint mb-4">Mostramos o fluxo com dados de exemplo. Peça um modelo de cabeçalho, um formato de planilha e uma prova real autorizada para adaptar o piloto.</p>
        <Form action={demoRequestAction} resetOnOk>
          <Field label="Seu nome" name="name" required autoComplete="name" />
          <Field label="E-mail" name="email" type="email" required autoComplete="email" />
          <Field label="Escola" name="school" required />
          <div className="field"><label htmlFor="message">Mensagem (opcional)</label><textarea id="message" name="message" className="input" /></div>
          <SubmitButton>Solicitar demonstração</SubmitButton>
        </Form>
      </section>
    </div>
  );
}
