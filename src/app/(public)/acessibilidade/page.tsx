export const metadata = { title: "Acessibilidade" };
export default function Acessibilidade() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 space-y-4">
      <h1>Acessibilidade</h1>
      <p>A meta da Questeca é atender à WCAG 2.2 nível AA: foco visível, navegação por teclado, rótulos de campos, contraste adequado, leitura em zoom e estados que combinam rótulo, ícone e cor.</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Reordenação de questões por botões, além de qualquer arrastar.</li>
        <li>Prévia da prova em escala de cinza e opção de fonte maior sem alterar a habilidade avaliada.</li>
        <li>Formatos brasileiros: vírgula decimal, R$ e datas dd/mm/aaaa.</li>
      </ul>
      <p>Encontrou uma barreira? Fale com o suporte na <a href="/ajuda#contato">Central de ajuda</a>.</p>
    </article>
  );
}
