import { Form, Field, SubmitButton } from "@/components/form";
import { getCtx } from "@/lib/session";
import { contactAction } from "./actions";

export const metadata = { title: "Central de ajuda" };

const GUIDES: [string, string][] = [
  ["Criar a primeira prova", "Crie a conta, informe escola, disciplina e turma. Em “Provas > Nova prova”, descreva o que ensinou, confirme as quatro listas (Vai cair, É pré-requisito, Ainda não ensinei, Preciso confirmar) e revise o rascunho no editor. Você não precisa cadastrar alunos para exportar o PDF."],
  ["Importar notas por planilha", "Em Turmas > Notas, use “Importar planilha” (CSV ou Excel). Mapeie as colunas de matrícula/nome e de nota, revise a prévia (novos, repetidos, atualizações e erros) e confirme. Vírgula decimal é aceita."],
  ["Cabeçalho da escola", "A coordenação cadastra o cabeçalho em Escola > Modelos. Professores veem a prévia com o cabeçalho certo ao exportar."],
  ["Correção por cartão-resposta", "Gere os cartões na aba Aplicação, fotografe pelo celular na aba Correção, confira as leituras incertas ao lado da imagem e confirme."],
  ["Comunidade e privacidade", "Não publique notas, provas respondidas ou fotos que identifiquem alunos. Use a opção Denunciar em qualquer publicação."],
  ["Cobrança e cancelamento", "Em Plano e cobrança você vê uso, renovação, e pode cancelar. O acesso continua até o fim do ciclo pago."],
];

export default async function Ajuda() {
  const ctx = await getCtx();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1>Central de ajuda</h1>
      <div className="mt-6 space-y-3">
        {GUIDES.map(([t, d]) => <details key={t} className="card"><summary className="cursor-pointer font-bold">{t}</summary><p className="mt-2 text-sm text-ink-soft">{d}</p></details>)}
      </div>
      <section id="contato" className="card mt-8" aria-labelledby="c-h">
        <h2 id="c-h">Falar com o suporte</h2>
        <p className="hint mb-3">Não anexe nem cole dados de alunos neste canal.</p>
        <Form action={contactAction} resetOnOk>
          {!ctx && <><Field label="Nome" name="name" required /><Field label="E-mail" name="email" type="email" required /></>}
          <Field label="Assunto" name="subject" required />
          <Field label="Identificador do registro (opcional)" name="recordRef" hint="Ex.: código de uma avaliação ou questão." />
          <div className="field"><label htmlFor="body">Mensagem</label><textarea id="body" name="body" required className="input" /></div>
          <SubmitButton>Enviar</SubmitButton>
        </Form>
      </section>
    </div>
  );
}
