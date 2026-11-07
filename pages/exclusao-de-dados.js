import LegalPage from '../components/LegalPage'

// Exclusão de Dados — Assistente Ark (LGPD, Lei 13.709/2018, art. 18)
// Página exigida pela Meta para app em produção (User Data Deletion).
export default function ExclusaoDeDadosPage() {
  return (
    <LegalPage
      title="Exclusão de Dados"
      subtitle="Como solicitar a exclusão dos seus dados pessoais do Assistente Ark, o que é apagado, o que precisa ser mantido por obrigação legal e em quanto tempo."
      updated="7 de novembro de 2026"
      seoTitle="Exclusão de Dados"
    >
      <p>
        Esta página explica como solicitar a exclusão de dados pessoais tratados pela <strong>Arkiel Tecnologia</strong> na plataforma <strong>Assistente Ark</strong>, conforme o <strong>art. 18 da LGPD (Lei nº 13.709/2018)</strong>. Ela cobre os dois públicos da plataforma: quem usa o Assistente Ark para gerenciar bots e quem conversa com um bot conectado a ele.
      </p>

      <h2>1. Como solicitar</h2>
      <p>
        Envie um e-mail para <a href="mailto:arkieltech@gmail.com">arkieltech@gmail.com</a> com o assunto <strong>"Exclusão de dados"</strong>, informando:
      </p>
      <ul>
        <li><strong>Se você é usuário da plataforma:</strong> o e-mail da conta usada no login (Google) e o nome da empresa;</li>
        <li><strong>Se você é contato de um bot:</strong> o número de WhatsApp que conversou com o bot e o nome do negócio com quem você falou;</li>
        <li><strong>Escopo:</strong> se deseja excluir todos os seus dados ou apenas parte deles.</li>
      </ul>
      <p>
        Se você é usuário da plataforma, também é possível excluir a conta diretamente no painel: <strong>Configurações → Excluir conta</strong>. A exclusão pela própria conta remove os dados do tenant imediatamente, sem espera.
      </p>

      <h2>2. O que é excluído</h2>
      <ul>
        <li><strong>Dados de cadastro:</strong> nome, e-mail e foto de perfil;</li>
        <li><strong>Dados da empresa:</strong> registros do negócio, membros da equipe e configurações;</li>
        <li><strong>Dados de conversas:</strong> contatos, conversas, mensagens, mídias recebidas e enviadas;</li>
        <li><strong>Dados de atendimento:</strong> agendamentos, pedidos e histórico de interações com o bot;</li>
        <li><strong>Credenciais:</strong> tokens de integração (WhatsApp, Google Agenda, provedores de IA) associados à conta;</li>
        <li><strong>Registros técnicos:</strong> logs de acesso e de operação vinculados ao titular.</li>
      </ul>

      <h2>3. O que é mantido por obrigação legal</h2>
      <p>Alguns registros não podem ser apagados imediatamente, por exigência legal ou regulatória:</p>
      <ul>
        <li><strong>Registros financeiros e fiscais</strong> (valores cobrados, repasses, notas e comprovantes): mantidos pelo prazo legal aplicável, tipicamente <strong>5 anos</strong>, conforme legislação fiscal e civil brasileira;</li>
        <li><strong>Registros de acesso à aplicação</strong>: mantidos por <strong>6 meses</strong>, conforme o Marco Civil da Internet (Lei nº 12.965/2014), art. 15;</li>
        <li><strong>Dados anonimizados</strong>, que não permitem identificar você, podem ser mantidos para fins estatísticos.</li>
      </ul>
      <p>Nesses casos, os dados são <strong>restritos ao armazenamento</strong>, com acesso bloqueado, e eliminados ao fim do prazo.</p>

      <h2>4. Prazo de atendimento</h2>
      <p>
        Confirmamos o recebimento em até <strong>2 dias úteis</strong> e concluímos a exclusão em até <strong>15 dias corridos</strong>, contados da confirmação da sua identidade. Se houver necessidade de prazo maior, você será informado com a justificativa.
      </p>

      <h2>5. Se você conversou com um bot de um negócio</h2>
      <p>
        Quando você conversa com o bot de uma empresa cliente, essa empresa é a <strong>controladora</strong> dos seus dados e a Arkiel atua como <strong>operadora</strong>. Nesse caso, você pode solicitar a exclusão diretamente ao negócio com quem conversou, ou solicitar à Arkiel, pelo e-mail acima, que encaminhe e execute a exclusão em nome desse cliente.
      </p>

      <h2>6. Remover o acesso do Assistente Ark</h2>
      <p>
        Para revogar o acesso do Assistente Ark à sua conta Meta/WhatsApp, acesse <strong>Configurações do Facebook → Apps e sites</strong> e remova o app <strong>Assistente Ark</strong>. A revogação corta o acesso, mas não apaga dados já armazenados; para isso, use os canais do item 1.
      </p>

      <h2>7. Contato do encarregado (DPO)</h2>
      <p>
        <strong>Encarregado de Proteção de Dados:</strong> Arkiel Tecnologia — <a href="mailto:arkieltech@gmail.com">arkieltech@gmail.com</a>. Consulte também a <a href="/privacidade">Política de Privacidade</a> e os <a href="/termos">Termos de Uso</a>.
      </p>
    </LegalPage>
  )
}
