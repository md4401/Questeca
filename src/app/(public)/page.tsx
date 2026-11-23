import Link from "next/link";

export default function Home() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:items-center">
        <div>
          <p className="badge mb-3">Para professores do 6º ano ao Ensino Médio</p>
          <h1 className="text-4xl md:text-5xl">Monte uma prova com questões que cobram o que você ensinou.</h1>
          <p className="mt-4 text-lg text-ink-soft">Use os resultados para planejar a próxima aula e organizar as entregas da turma. Questões reais do Enem e de vestibulares, com origem e gabarito conferíveis.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn" href="/criar-conta">Criar primeira prova grátis</Link>
            <Link className="btn btn-ghost" href="/escolas#demonstracao">Solicitar demonstração para escolas</Link>
          </div>
          <p className="mt-3 text-sm text-ink-soft">Sem cartão. Você pode começar sem cadastrar alunos.</p>
        </div>
        <div aria-label="Exemplo do editor (dados de exemplo)" className="card">
          <p className="hint mb-2">Colégio Exemplo › 9º B › Matemática <span className="badge badge-amber ml-2">Exemplo identificado</span></p>
          <h2 className="mb-1">Prova de porcentagem</h2>
          <p className="hint mb-4">Rascunho salvo · 6 de 8 itens · 35 min estimados</p>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div className="rounded-lg border border-line p-4">
              <p className="text-xs font-bold text-ink-soft">QUESTÃO 04 · Exemplo Questeca</p>
              <p className="statement mt-1">Um produto de R$ 200,00 recebe 10% de desconto e, depois, mais 10% sobre o novo preço. Qual o preço final?</p>
              <p className="hint mt-2">Exige: porcentagem e descontos sucessivos.</p>
              <p className="mt-2 text-sm font-semibold text-brand">Trocar · Fixar · Ver fonte</p>
            </div>
            <div className="card-tint text-sm">
              <p className="font-bold">Mapa da prova</p>
              <p className="mt-1">4 itens de cálculo</p><p>2 de interpretação</p>
              <p className="mt-3 rounded-lg bg-brand px-3 py-2 text-center font-bold text-white">Ver prévia</p>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="mb-6">Como funciona</h2>
        <ol className="grid gap-4 md:grid-cols-4">
          {[
            ["1. Diga o que ensinou", "Cole texto, envie PDF/DOCX ou use o que já registrou na turma. Você confirma o que vai cair, o que é pré-requisito e o que ainda não ensinou."],
            ["2. Revise o rascunho", "A Questeca busca só questões existentes e explica cada escolha. Troque, fixe, reordene e veja o mapa da prova."],
            ["3. Imprima e aplique", "PDF do aluno e gabarito do professor em arquivos separados, no cabeçalho da sua escola."],
            ["4. Corrija e retome", "Lance notas por planilha ou grade, veja o desempenho por habilidade e prepare a retomada com questões reais."],
          ].map(([t, d]) => (
            <li key={t} className="card"><h3 className="mb-1">{t}</h3><p className="text-sm text-ink-soft">{d}</p></li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-10 md:grid-cols-3">
        <div className="card-tint"><h3>Pertinência</h3><p className="mt-1 text-sm">Uma turma do 9º ano pode receber um item do Enem quando os conhecimentos exigidos já foram trabalhados. Conferimos o raciocínio da resolução, não só a palavra no enunciado.</p></div>
        <div className="card-tint"><h3>Procedência</h3><p className="mt-1 text-sm">Veja onde cada questão caiu, o gabarito e o motivo da seleção. A IA escolhe e explica; nunca inventa questões.</p></div>
        <div className="card-tint"><h3>Continuidade</h3><p className="mt-1 text-sm">Respostas, notas e observações alimentam a turma e os documentos da coordenação, no modelo da escola.</p></div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="card flex flex-wrap items-center justify-between gap-4">
          <div><h2>Planos para professores e escolas</h2><p className="text-ink-soft">Comece grátis. Evolua quando precisar de mais turmas e correção em lote.</p></div>
          <Link className="btn" href="/planos">Ver planos</Link>
        </div>
      </section>
    </>
  );
}
