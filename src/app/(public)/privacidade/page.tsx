export const metadata = { title: "Privacidade" };
export default function Privacidade() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 space-y-4">
      <h1>Política de privacidade</h1>
      <p className="hint">Versão 2026-11 — modelo inicial alinhado à LGPD (Lei nº 13.709/2018), sujeito a revisão jurídica.</p>
      <h2>Dados que tratamos</h2>
      <p>Conta de professor: nome, e-mail e senha (armazenada apenas como hash). Registros de turma: nome e identificador escolar dos alunos, respostas, notas e observações lançadas pelo professor. Imagens de cartões-resposta e tabelas enviadas para correção.</p>
      <h2>Finalidade e minimização</h2>
      <p>Usamos os dados somente para prestar o serviço: montar e corrigir avaliações, calcular notas, gerar relatórios e operar a conta. Em tarefas assistidas por IA enviamos apenas identificadores e trechos mínimos necessários.</p>
      <h2>Crianças e adolescentes</h2>
      <p>Os alunos não têm login. Os registros são feitos pelo professor ou pela escola, no melhor interesse do estudante, e ficam restritos à turma e à escola autorizada. Fotos, notas, observações e anexos são privados.</p>
      <h2>Compartilhamento</h2>
      <p>Não vendemos dados. Operadores de infraestrutura (hospedagem, banco de dados, e-mail, pagamentos) tratam dados sob contrato. Notas e dados de estudantes não podem ser publicados no mural da comunidade.</p>
      <h2>Retenção e direitos</h2>
      <p>Você pode corrigir, exportar e solicitar a exclusão dos seus dados pelo suporte. A escola define a retenção dos registros institucionais conforme o contrato. Incidentes de segurança são comunicados aos afetados.</p>
      <h2>Contato do encarregado</h2>
      <p>Pelo formulário de suporte (assunto “Privacidade”).</p>
    </article>
  );
}
