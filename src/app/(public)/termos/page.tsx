import { legal, LEGAL_VERSION } from "@/lib/legal";
export const metadata = { title: "Termos de uso" };
export const dynamic = "force-dynamic";

export default function Termos() {
  const l = legal();
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-12">
      <h1>Termos de uso</h1>
      <p className="hint">Versão {LEGAL_VERSION}. Ao criar uma conta ou usar a Questeca, você concorda com estes termos.</p>

      <h2>1. Quem somos</h2>
      <p>A Questeca é operada por <b>{l.nome}</b>, CNPJ {l.cnpj}, com sede em {l.endereco} (“Questeca”, “nós”). Contato: {l.email}.</p>

      <h2>2. O serviço</h2>
      <p>Serviço web para professores e escolas montarem avaliações com questões existentes, gerarem PDF e Word, corrigirem, calcularem notas, planejarem a retomada de conteúdos, produzirem documentos de coordenação e trocarem materiais em comunidade. O serviço é destinado a maiores de 18 anos responsáveis pelo trabalho docente ou pela gestão escolar. Estudantes não têm conta; seus dados são lançados por professores e escolas.</p>

      <h2>3. Conta, escolas e papéis</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Você deve informar dados verdadeiros e manter suas credenciais em sigilo. Atividades feitas com a sua conta são de sua responsabilidade; avise-nos de qualquer uso indevido.</li>
        <li>Uma escola pode ter papéis (gestão, coordenação, professor) e definir quem acessa cada turma. Quando você usa a conta vinculada a uma escola, a escola é a responsável pelos registros institucionais e pode acessá-los conforme os papéis que definiu.</li>
        <li>Você pode sair de uma escola. Registros institucionais permanecem com a escola, conforme o contrato e a lei.</li>
        <li>Podemos suspender contas que violem estes termos, a lei ou a segurança do serviço, avisando você sempre que possível.</li>
      </ul>

      <h2>4. Questões, conteúdo e direitos autorais</h2>
      <p>O acervo é composto por itens autorais de exemplo e por questões de provas e fontes públicas ou autorizadas. Cada item mostra seu estado (em curadoria, só referência, liberado, em revisão, bloqueado) e sua fonte. Itens “só referência” exibem apenas a identificação e o link oficial. A reprodução de cada item segue a licença ou autorização do respectivo titular exibida no item; você deve respeitá-la ao usar as provas geradas. Não garantimos que um item esteja livre de erro: gabaritos podem ser retificados, e, nesse caso, avisaremos e permitiremos reprocessar as notas afetadas.</p>
      <p>O conteúdo que você cria (provas, anotações, registros) continua sendo seu ou da sua escola. Você nos concede licença limitada apenas para armazenar, processar e exibir esse conteúdo para prestar o serviço. Na comunidade, o que você publica fica visível para o público escolhido (geral ou escola) e você declara ter direito de compartilhá-lo.</p>

      <h2>5. Uso aceitável</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Não publique dados de estudantes (nomes, notas, imagens, observações) em canais públicos, como o mural geral.</li>
        <li>Não tente acessar dados de outras contas ou escolas, burlar limites, sobrecarregar o serviço, copiar o acervo em massa ou usar o serviço para fins ilícitos.</li>
        <li>Não envie conteúdo ofensivo, discriminatório, que infrinja direitos de terceiros ou que contenha malware. Conteúdo denunciado poderá ser removido pela moderação.</li>
      </ul>

      <h2>6. Dados pessoais</h2>
      <p>O tratamento de dados pessoais está descrito na <a href="/privacidade">Política de privacidade</a>. Não usamos provas, documentos de aula ou dados de estudantes para treinar modelos de inteligência artificial.</p>

      <h2>7. Recursos automáticos e de IA</h2>
      <p>Quando ativados, sugestões e leituras automáticas (por exemplo, de fotos de cartões ou tabelas) são apoio. Resultados duvidosos são mostrados para conferência e nada entra na nota sem confirmação. A decisão sobre notas, aprovação e qualquer medida sobre estudantes é sempre de pessoas responsáveis.</p>

      <h2>8. Planos, cobrança e cancelamento</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>O plano gratuito não exige cartão. Planos pagos mostram valor, periodicidade, renovação e forma de cancelamento antes da contratação, e as cotas de cada plano são exibidas na página de planos.</li>
        <li>Assinaturas renovam automaticamente a cada ciclo até o cancelamento. Você pode cancelar a qualquer momento nas configurações e mantém o acesso até o fim do ciclo já pago.</li>
        <li>Para compras online feitas à distância, você pode exercer o direito de arrependimento em até 7 dias da contratação (art. 49 do Código de Defesa do Consumidor), com devolução dos valores pagos.</li>
        <li>Em caso de falha de pagamento há um período de regularização informado na tela; depois dele, o plano volta ao gratuito, sem apagar seus dados.</li>
        <li>O plano para escolas é contratado em separado, e as condições do contrato prevalecem sobre este item.</li>
        <li>Podemos reajustar preços com aviso prévio de pelo menos 30 dias; o novo valor vale a partir da renovação seguinte.</li>
      </ul>

      <h2>9. Disponibilidade e responsabilidade</h2>
      <p>Trabalhamos para manter o serviço estável, mas não garantimos funcionamento ininterrupto. Mantenha cópia das notas e documentos oficiais da escola. Na extensão permitida em lei, nossa responsabilidade se limita aos danos diretos comprovados e, salvo dolo ou culpa grave, ao valor pago por você nos 12 meses anteriores ao fato. Nada aqui limita direitos que a lei garante ao consumidor.</p>

      <h2>10. Encerramento e seus dados</h2>
      <p>Você pode encerrar a conta e pedir a exclusão ou a exportação dos seus dados (veja a Política de privacidade). Ao encerrar, os dados são excluídos ou anonimizados nos prazos da política, salvo o que a lei exigir guardar.</p>

      <h2>11. Mudanças nestes termos</h2>
      <p>Podemos atualizar estes termos. Mudanças relevantes serão avisadas por e-mail ou no aplicativo com antecedência razoável; continuar usando após a vigência significa concordar com a nova versão. A versão em vigor está sempre nesta página.</p>

      <h2>12. Lei aplicável e foro</h2>
      <p>Aplica-se a lei brasileira. Fica eleito o foro da comarca de {l.foro}, ressalvado o foro do domicílio do consumidor, quando aplicável.</p>

      <h2>13. Contato</h2>
      <p>{l.email}, ou pelo formulário de suporte na Central de ajuda.</p>
    </article>
  );
}
