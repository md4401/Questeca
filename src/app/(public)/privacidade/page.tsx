import { legal, LEGAL_VERSION } from "@/lib/legal";
export const metadata = { title: "Privacidade" };
export const dynamic = "force-dynamic";

export default function Privacidade() {
  const l = legal();
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-12">
      <h1>Política de privacidade</h1>
      <p className="hint">Versão {LEGAL_VERSION}. Segue a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).</p>

      <h2>1. Quem é responsável</h2>
      <p><b>{l.nome}</b>, CNPJ {l.cnpj}, {l.endereco}. Encarregado pelo tratamento de dados (DPO): {l.encarregado} — <b>{l.email}</b>.</p>
      <p>Papéis: pelos dados da <b>conta de professor</b> e do uso do serviço, a Questeca é <b>controladora</b>. Pelos dados de <b>estudantes</b> lançados por uma escola ou professor vinculado a ela, a escola é a controladora e a Questeca atua como <b>operadora</b>, seguindo as instruções da escola. Professores sem escola (espaço pessoal) respondem pelos dados que lançam.</p>

      <h2>2. Dados que tratamos</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li><b>Conta:</b> nome, e-mail, senha (guardada apenas como hash irreversível), escola e papel.</li>
        <li><b>Estudantes (lançados por professores/escolas):</b> nome, identificador escolar, turma, respostas, notas, ausências e observações pedagógicas. Não pedimos CPF, endereço, saúde ou dados sensíveis; não os registre.</li>
        <li><b>Arquivos enviados:</b> fotos/PDF de cartões-resposta, tabelas de notas, materiais de aula e anexos.</li>
        <li><b>Uso e segurança:</b> registros de acesso, endereço IP, tipo de navegador, tentativas de login, histórico de alterações (para auditoria) e métricas de uso do produto.</li>
        <li><b>Cobrança:</b> plano, status e faturas. Dados de cartão são tratados pelo processador de pagamentos; <b>não os armazenamos</b>.</li>
        <li><b>Contato:</b> mensagens de suporte e pedidos de demonstração.</li>
      </ul>

      <h2>3. Para que usamos e em que base legal</h2>
      <table className="t">
        <thead><tr><th>Finalidade</th><th>Base legal (LGPD, art. 7º/11)</th></tr></thead>
        <tbody>
          <tr><td>Criar e manter a conta, prestar o serviço (montar e corrigir avaliações, notas, relatórios)</td><td>Execução de contrato</td></tr>
          <tr><td>Tratar dados de estudantes a pedido da escola</td><td>Instrução do controlador (escola); execução de políticas públicas/educacionais e interesse legítimo da escola, no melhor interesse do estudante (art. 14)</td></tr>
          <tr><td>Segurança, prevenção a fraude, auditoria, moderação</td><td>Legítimo interesse; cumprimento de obrigação legal</td></tr>
          <tr><td>Cobrança, notas fiscais e obrigações fiscais</td><td>Execução de contrato; obrigação legal</td></tr>
          <tr><td>E-mails de serviço (verificação, recuperação de senha, convites, avisos de cobrança)</td><td>Execução de contrato</td></tr>
          <tr><td>Melhoria do produto com métricas agregadas</td><td>Legítimo interesse</td></tr>
        </tbody>
      </table>
      <p>Não vendemos dados, não fazemos publicidade com eles e <b>não usamos dados de estudantes, provas ou documentos de aula para treinar modelos de IA</b>.</p>

      <h2>4. Crianças e adolescentes</h2>
      <p>Por padrão, estudantes não têm login: os registros são feitos por professores ou pela escola, em benefício do estudante, e ficam restritos à turma e à escola autorizadas. <b>Se a escola ativar o portal</b>, ela pode convidar o estudante e seus responsáveis por link individual de uso único. Cada conta vê somente os dados do próprio estudante vinculado (tarefas, agenda, notas, frequência, avisos e mensagens liberadas pela escola). Para menores de 18 anos, recomendamos que o convite seja feito ao responsável, que pode acompanhar e solicitar a exclusão do acesso. A escola pode revogar um acesso a qualquer momento. Mensagens entre contas seguem as regras de contato definidas pela escola e podem ser moderadas. Notas, fotos, observações e anexos são privados e nunca aparecem na comunidade. Nesta, publicações com nomes de estudantes ou notas são bloqueadas antes de publicar. Na aplicação digital, o estudante acessa apenas um link individual, sem criar conta.</p>

      <h2>5. Com quem compartilhamos (operadores)</h2>
      <p>Usamos prestadores sob contrato, que tratam dados apenas para nos prestar serviço: hospedagem da aplicação (Stay Cloud), banco de dados (Neon), envio de e-mails (Resend) e, se o plano pago estiver ativo, pagamentos (Stripe). Se o recurso de IA for ativado, enviamos ao provedor apenas o trecho mínimo necessário (por exemplo, a imagem de um cartão ou de uma tabela), sem usar o material para treinamento. Também podemos compartilhar dados quando a lei ou ordem judicial exigir. Alguns desses prestadores armazenam dados fora do Brasil; nesses casos adotamos as garantias do art. 33 da LGPD (cláusulas contratuais e prestadores com padrões adequados de proteção).</p>

      <h2>6. Por quanto tempo guardamos</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Conta e conteúdo: enquanto a conta existir. Ao encerrar, excluímos ou anonimizamos em até 30 dias, salvo o que a lei exigir manter.</li>
        <li>Dados de estudantes em escola: pelo prazo definido pela escola; ao fim do contrato, são exportados à escola e excluídos em até 90 dias.</li>
        <li>Registros de acesso: 6 meses (Marco Civil da Internet, art. 15). Registros de auditoria: até 5 anos. Dados fiscais: 5 anos.</li>
        <li>Cópias de segurança expiram no ciclo do provedor do banco, sem retorno de dados excluídos ao uso normal.</li>
      </ul>

      <h2>7. Seus direitos</h2>
      <p>Você pode, a qualquer tempo, pedir: confirmação e acesso aos dados; correção; anonimização, bloqueio ou exclusão de dados desnecessários; portabilidade; informação sobre compartilhamentos; revogação de consentimento (quando for a base); e revisão de decisões automatizadas. Escreva para <b>{l.email}</b> (assunto “Privacidade”); respondemos em até 15 dias. Para dados de estudantes de uma escola, direcionamos o pedido à escola, controladora. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>

      <h2>8. Segurança</h2>
      <p>Senhas com hash; sessões com token armazenado como hash; conexões criptografadas (HTTPS); isolamento de dados entre escolas com verificação de permissão a cada acesso; limite de tentativas de login; registro de auditoria das alterações em notas e gabaritos. Nenhum sistema é totalmente imune: em caso de incidente com risco relevante, comunicaremos os afetados e a ANPD nos termos da lei.</p>

      <h2>9. Cookies</h2>
      <p>Usamos um cookie estritamente necessário (<code>qs_session</code>) para manter você conectado. Não usamos cookies de publicidade nem de rastreamento de terceiros.</p>

      <h2>10. Mudanças</h2>
      <p>Avisaremos mudanças relevantes por e-mail ou no aplicativo. A versão vigente está sempre nesta página.</p>
    </article>
  );
}
