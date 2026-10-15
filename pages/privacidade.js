import LegalPage from '../components/LegalPage'

// Política de Privacidade — Assistente Ark (LGPD, Lei 13.709/2018)
export default function PrivacidadePage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      subtitle="Como a Arkiel Tecnologia e o Assistente Ark coletam, usam, armazenam e protegem dados pessoais — dos usuários da plataforma e das pessoas que conversam com os bots."
      updated="15 de outubro de 2026"
      seoTitle="Política de Privacidade"
    >
      <p>
        Esta Política de Privacidade explica como a <strong>Arkiel Tecnologia</strong> ("Arkiel", "nós") trata dados pessoais na plataforma <strong>Assistente Ark</strong>, em conformidade com a <strong>Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018)</strong>. Ao criar uma conta na plataforma ou interagir com um bot conectado a ela, você declara estar ciente das práticas aqui descritas.
      </p>

      <h2>1. Quem trata seus dados</h2>
      <p><strong>Controladora:</strong> Arkiel Tecnologia. Encarregado de Dados (DPO): <a href="mailto:arkieltech@gmail.com">arkieltech@gmail.com</a>.</p>
      <p>Esta política cobre <strong>dois públicos</strong>, com papéis distintos:</p>
      <ul>
        <li><strong>Usuários da plataforma</strong> — empresas e pessoas que criam conta no Assistente Ark para gerenciar chatbots de WhatsApp ("clientes", "você");</li>
        <li><strong>Contatos finais</strong> — pessoas que conversam com os bots conectados à plataforma. Nesse caso, quem define o conteúdo e a finalidade do atendimento é o cliente (que atua como controlador do seu próprio tratamento), e a Arkiel atua como operadora da infraestrutura, sob instruções dele.</li>
      </ul>

      <h2>2. Quais dados coletamos</h2>
      <h3>2.1 Dos usuários da plataforma</h3>
      <ul>
        <li><strong>Identificação e acesso:</strong> nome, e-mail e foto de perfil da conta Google usada no login;</li>
        <li><strong>Dados da empresa:</strong> nome do negócio, plano contratado, membros da equipe convidados;</li>
        <li><strong>Conexão WhatsApp:</strong> identificadores do número conectado (phone number ID, WABA ID), nome verificado e indicadores de qualidade do número;</li>
        <li><strong>Dados financeiros:</strong> histórico de cobranças e repasses via Mercado Pago, saldo de créditos, assinaturas de planos e fluxos sazonais;</li>
        <li><strong>Credenciais criptografadas:</strong> tokens de acesso (WhatsApp, Google Agenda, chaves de provedores de IA conectados com chave própria) armazenados de forma cifrada (AES-256-GCM);</li>
        <li><strong>Dados de uso:</strong> registros técnicos (logs) de acesso e operações na plataforma.</li>
      </ul>
      <h3>2.2 Dos contatos finais (quem conversa com os bots)</h3>
      <ul>
        <li><strong>Identificação do contato:</strong> número de telefone/WhatsApp e nome de perfil, quando informado;</li>
        <li><strong>Conteúdo das conversas:</strong> mensagens enviadas ao bot e respostas enviadas por ele, armazenadas para que o cliente gerencie o atendimento;</li>
        <li><strong>Dados de interação:</strong> agendamentos, pedidos criados, produtos visualizados e pagamentos iniciados ou confirmados (dados de cartão completos nunca tocam nossos servidores — o pagamento é processado pelo Mercado Pago);</li>
        <li><strong>Dados fornecidos na conversa:</strong> qualquer informação que o próprio contato digitar ao bot.</li>
      </ul>

      <h2>3. Finalidades e bases legais</h2>
      <table>
        <thead>
          <tr><th>Finalidade</th><th>Base legal (LGPD)</th></tr>
        </thead>
        <tbody>
          <tr><td>Executar o serviço contratado: funcionamento dos bots, painel, catálogo de produtos, agendamentos e pagamentos</td><td>Execução de contrato ou de procedimentos preliminares (art. 7º, V)</td></tr>
          <tr><td>Atender solicitações do contato final (responder mensagens, vender, agendar, cobrar) por conta do cliente</td><td>Cumprimento de obrigação legal ou contratual e tutela da saúde em caso de agendamentos de serviços (arts. 7º, II e V; 11º, II, f)</td></tr>
          <tr><td>Cobrança de planos, créditos e comissões (modelo ACP)</td><td>Execução de contrato (art. 7º, V)</td></tr>
          <tr><td>Segurança da plataforma, prevenção a fraude e abuso, auditoria de acessos</td><td>Legítimo interesse (art. 7º, IX) e obrigação legal (art. 7º, II)</td></tr>
          <tr><td>Mensagens de marketing disparadas pelos clientes</td><td>Consentimento ou legítimo interesse do contato final, sob responsabilidade do cliente que dispara</td></tr>
          <tr><td>Funcionalidades de inteligência artificial (respostas inteligentes)</td><td>Execução de contrato, ativadas apenas quando o cliente conecta um provedor de IA com chave própria (art. 7º, V)</td></tr>
          <tr><td>Cumprimento de obrigações legais, fiscais e regulatórias</td><td>Obrigação legal (art. 7º, II)</td></tr>
        </tbody>
      </table>

      <h2>4. Compartilhamento com terceiros</h2>
      <p>Seus dados podem ser tratados pelos seguintes parceiros, nas finalidades descritas:</p>
      <ul>
        <li><strong>Meta / WhatsApp Business API</strong> — envio e recebimento das mensagens do WhatsApp, gestão do número conectado e catálogo;</li>
        <li><strong>Supabase</strong> — banco de dados gerenciado, autenticação e armazenamento dos registros da plataforma;</li>
        <li><strong>Vercel</strong> — hospedagem da aplicação e execução do backend;</li>
        <li><strong>Mercado Pago</strong> — processamento dos pagamentos, geração de PIX e repasses (split);</li>
        <li><strong>Google</strong> — autenticação via conta Google e integração opcional com Google Agenda;</li>
        <li><strong>Provedores de IA</strong> (OpenAI, Anthropic, Google Gemini, entre outros) — somente quando o cliente ativa a inteligência artificial com a própria chave de API; a chave e a configuração ficam cifradas em nossos servidores;</li>
        <li><strong>Google Analytics e Search Console</strong> — medição agregada e anônima de uso do site.</li>
      </ul>
      <p>Não vendemos dados pessoais. Dados só são compartilhados por obrigação legal, ordem judicial ou para proteger direitos da Arkiel, sempre no mínimo necessário.</p>

      <h2>5. Transferência internacional</h2>
      <p>Alguns dos parceiros acima (Meta, Google, Vercel, provedores de IA) podem tratar dados fora do Brasil. Essas transferências são admitidas nos termos do art. 33 da LGPD, amparadas por cláusulas contratuais padrão e compromissos de privacidade exigidos dos provedores, que asseguram nível de proteção equivalente à legislação brasileira.</p>

      <h2>6. Por quanto tempo guardamos</h2>
      <ul>
        <li><strong>Conta e dados da plataforma:</strong> enquanto a conta estiver ativa. Após exclusão, removemos ou anonimizamos os dados em até 30 dias, salvo obrigações legais de retenção (fiscais, por exemplo);</li>
        <li><strong>Conversas e contatos finais:</strong> enquanto o contrato com o cliente permanecer ativo, para que ele possa gerenciar atendimentos. O cliente pode excluir conversas e contatos pelo painel a qualquer momento;</li>
        <li><strong>Registros financeiros:</strong> pelo prazo legal aplicável a documentos fiscais;</li>
        <li><strong>Logs técnicos:</strong> prazo reduzido, apenas o necessário para segurança e diagnóstico.</li>
      </ul>

      <h2>7. Seus direitos (art. 18 da LGPD)</h2>
      <p>Você pode solicitar, a qualquer momento e gratuitamente:</p>
      <ul>
        <li>Confirmação da existência de tratamento e acesso aos seus dados;</li>
        <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
        <li>Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;</li>
        <li>Portabilidade dos seus dados;</li>
        <li>Eliminação de dados pessoais tratados com base no consentimento;</li>
        <li>Informação sobre com quem seus dados foram compartilhados;</li>
        <li>Revogação do consentimento e oposição a tratamentos baseados em legítimo interesse.</li>
      </ul>
      <p>Para exercer esses direitos, escreva para <a href="mailto:arkieltech@gmail.com">arkieltech@gmail.com</a>. Responderemos em até <strong>15 dias</strong>. Contatos finais também podem exercer seus direitos diretamente com a empresa que opera o bot com o qual conversaram.</p>

      <h2>8. Como protegemos</h2>
      <ul>
        <li>Criptografia de credenciais sensíveis (AES-256-GCM) em repouso e tráfego em HTTPS/TLS;</li>
        <li>Isolamento por cliente (multi-tenant) com políticas de segurança em nível de linha no banco de dados;</li>
        <li>Validação de assinatura em todos os webhooks recebidos (Meta e Mercado Pago);</li>
        <li>Autenticação exclusiva via Google, sem senhas armazenadas;</li>
        <li>Chaves de API nunca expostas ao navegador — todo tratamento sensível ocorre no servidor;</li>
        <li>Monitoramento contínuo e revisão periódica de segurança.</li>
      </ul>
      <p>Em caso de incidente de segurança que possa causar risco relevante aos titulares, notificaremos a ANPD e os afetados conforme o art. 48 da LGPD.</p>

      <h2>9. Cookies e tecnologias similares</h2>
      <p>Utilizamos apenas cookies e armazenamento local essenciais: manter sua sessão autenticada, lembrar preferências de tema e medir o uso agregado do site. Não usamos cookies de publicidade nem rastreamento de terceiros para fins de marketing.</p>

      <h2>10. Crianças e adolescentes</h2>
      <p>A plataforma é destinada a empresas e não é direcionada a menores de 18 anos. Tratamento de dados de crianças e adolescentes por parte dos clientes (por exemplo, negócios voltados ao público infantil) é de responsabilidade do próprio cliente, que deve observar o art. 14 da LGPD.</p>

      <h2>11. Alterações desta política</h2>
      <p>Podemos atualizar esta política para refletir mudanças na plataforma ou na legislação. A data da última revisão está sempre no topo desta página. Alterações relevantes serão comunicadas aos usuários da plataforma por e-mail ou aviso no painel.</p>

      <h2>12. Fale com o Encarregado de Dados</h2>
      <p>Dúvidas, pedidos de titulares e comunicações sobre privacidade: <a href="mailto:arkieltech@gmail.com">arkieltech@gmail.com</a>. Você também pode reclamar diretamente à Autoridade Nacional de Proteção de Dados (ANPD).</p>
    </LegalPage>
  )
}
