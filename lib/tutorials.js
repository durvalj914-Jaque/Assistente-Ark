/**
 * Conteúdo dos tutoriais contextuais de cada aba do painel.
 * Linguagem simples e direta: o que dá pra fazer, como configurar e um exemplo real.
 */
export const TUTORIALS = {
  conversations: {
    icon: '💬', title: 'Conversas',
    purpose: 'Todas as conversas do seu WhatsApp com clientes, ao vivo. É daqui que você atende quando o cliente precisa de uma pessoa de verdade.',
    hero: '/tutorials/conversations.png',
    automation: { intro: 'Seu papel vira só o que o bot não faz:', items: [
      'Bot responde tudo que é rotina — você só entra quando o cliente escolhe "falar com humano".',
      'Cobrança no chat confirma sozinha via PIX — nenhuma conferência manual.',
      'Notificação no celular avisa quando um cliente espera humano: você não precisa vigiar a tela.',
    ] },
    features: [
      { icon: '👤', title: 'Modo humano', desc: 'Quando você responde pelo painel, o bot pausa sozinho naquela conversa. Quando termina, o bot volta a responder.' },
      { icon: '💰', title: 'Cobrar no chat', desc: 'Gera um PIX na hora, dentro da conversa. O cliente paga e o sistema confirma sozinho — sem você conferir nada.' },
      { icon: '📎', title: 'Enviar mídia', desc: 'Imagens, áudios e documentos direto pro cliente, pelo mesmo número oficial.' },
      { icon: '🔇', title: 'Sem bot', desc: 'Pausa o bot só numa conversa específica, sem desligar o bot dos demais clientes.' },
      { icon: '🔍', title: 'Busca e filtros', desc: 'Todas / Humano / Bot, além de busca por nome e conteúdo das mensagens.' },
    ],
    steps: [
      { title: 'Abra a lista', desc: 'A esquerda mostra quem falou com seu número e o último recado de cada cliente.' },
      { title: 'Clique numa conversa', desc: 'Você vê o histórico completo, com fotos, áudios e arquivos.' },
      { title: 'Responda digitando', desc: 'Ao enviar a primeira resposta, você assume no modo humano — o bot pausa automaticamente.' },
      { title: 'Use o menu do chat', desc: 'No cabeçalho da conversa: Cobrar 💰, Mídia 📎, Sem bot 🔇 e Excluir.' },
    ],
    example: {
      story: 'Um cliente quer negociar preço — o bot entrega pra você:',
      chat: [
        { from: 'client', text: 'Oi! O serviço de manutenção tem desconto pra 2 aparelhos?' },
        { from: 'bot', text: 'Escolha uma opção:\n1️⃣ Ver serviços\n2️⃣ Falar com um humano\n0️⃣ Menu' },
        { from: 'client', text: '2' },
        { from: 'bot', text: '✅ Um especialista vai te responder em instantes.' },
      ],
      after: 'A conversa aparece com a marca 👤 e um pulso amarelo. Você assume, negocia e fecha o desconto — e depois o bot volta a trabalhar sozinho nela.',
    },
    tip: 'O pulso amarelo = cliente esperando humano. Ative as notificações em Configurações para receber alerta no celular.',
  },

  contacts: {
    icon: '👥', title: 'Contatos',
    purpose: 'A agenda dos seus clientes. Cadastre um por um ou importe tudo do celular — e use essa lista como público das campanhas de Marketing.',
    hero: '/tutorials/contacts.png',
    automation: { intro: 'A base de contatos é o combustível da automação:', items: [
      'Importou a agenda → campanhas de reativação prontas pra rodar.',
      'Contatos sem WhatsApp válido ficam de fora sozinhos — você não filtra nada.',
      'Quem responde à campanha entra no fluxo do bot e vira venda sem atendimento humano.',
    ] },
    features: [
      { icon: '📥', title: 'Importar agenda', desc: 'Arquivos .vcf (contatos do celular) e .csv (planilha), em lote.' },
      { icon: '🔄', title: 'Sincronizar', desc: 'Puxe a agenda do Google ou do dispositivo com um clique.' },
      { icon: '✂️', title: 'Ações em massa', desc: 'Selecione vários contatos para excluir ou organizar de uma vez.' },
      { icon: '📇', title: 'Detalhe do contato', desc: 'Histórico completo de conversas e dados do cliente em um só lugar.' },
    ],
    steps: [
      { title: 'Crie um contato', desc: 'Botão "Novo Contato": nome e número com DDD. Pronto.' },
      { title: 'Ou importe em lote', desc: 'Botão "Sincronizar": escolha Google, Dispositivo ou arquivo .vcf/.csv.' },
      { title: 'Organize', desc: 'Busque, selecione em massa e limpe duplicados.' },
      { title: 'Use no Marketing', desc: 'As campanhas da aba 📣 são enviadas para os contatos daqui.' },
    ],
    example: {
      story: 'Uma barbearia importa a agenda do celular e reativa clientes sumidos:',
      chat: [
        { from: 'bot', text: 'Oi João! Faz tempo que não te vemos 💈\nTerça tem 20% no corte + barba. Quer garantir horário?\n1️⃣ Sim, quero\n0️⃣ Não, obrigado' },
        { from: 'client', text: '1' },
      ],
      after: 'A mensagem vai só para quem tem WhatsApp válido — e quem responde já cai no fluxo de agendamento do bot.',
    },
    tip: 'Contato sem número válido fica só de registro: campanhas só chegam em quem pode receber.',
  },

  products: {
    icon: '📦', title: 'Catálogo',
    purpose: 'A vitrine da sua loja dentro do WhatsApp. Cada produto aparece no catálogo oficial, com foto e preço — e aqui também ficam os horários de atendimento.',
    hero: '/tutorials/products.png',
    automation: { intro: 'A loja funciona enquanto você dorme:', items: [
      'Produto salvo → no ar no catálogo na hora, sem publicar.',
      'Cliente monta o carrinho → pedido organizado chega no painel.',
      'Horários de atendimento + Google Agenda = agendamento sem conflito e sem você.',
    ] },
    features: [
      { icon: '🛍️', title: 'Produtos oficiais', desc: 'Foto, nome, preço e descrição — sincronizados automaticamente com o catálogo do WhatsApp.' },
      { icon: '🛒', title: 'Carrinho do cliente', desc: 'O cliente navega, adiciona itens e fecha o pedido sem sair do chat. Até 30 produtos ativos.' },
      { icon: '⏰', title: 'Horários de atendimento', desc: 'Define quando o bot pode agendar e atender — os horários livres respeitam isso.' },
      { icon: '✅', title: 'Ativar/pausar', desc: 'Produto ativo aparece no catálogo; pausado sai do ar sem ser apagado.' },
    ],
    steps: [
      { title: 'Cadastre o produto', desc: 'Novo produto: nome, preço, descrição e uma foto quadrada de fundo claro.' },
      { title: 'Marque como ativo', desc: 'Só produtos ativos aparecem no catálogo que o cliente vê.' },
      { title: 'Salve e pronto', desc: 'A sincronização com o WhatsApp é automática — nada de publicar de novo.' },
      { title: 'Ajuste os horários', desc: 'Em "⏰ Horários de atendimento", defina abertura, fechamento e dias de funcionamento.' },
    ],
    example: {
      story: 'Uma pizzaria cadastra os sabores e o cliente pede sem sair do chat:',
      chat: [
        { from: 'client', text: 'menu' },
        { from: 'bot', text: 'Escolha:\n1️⃣ Ver catálogo\n2️⃣ Falar com humano\n0️⃣ Menu' },
        { from: 'client', text: '1' },
        { from: 'bot', text: '🍕 Catálogo enviado — toque nos itens para montar seu pedido.' },
      ],
      after: 'O cliente monta o carrinho com as fotos, envia o pedido e ele chega organizado na aba 🗓️ Agendamentos e Pedidos.',
    },
    tip: 'A foto é o que mais influencia na venda: quadrada, bem iluminada, fundo limpo.',
  },

  agendamentos: {
    icon: '🗓️', title: 'Agendamentos e Pedidos',
    purpose: 'A central dos seus serviços: agendamentos com taxa via PIX (confirmados sozinhos) e os pedidos do carrinho do WhatsApp.',
    hero: '/tutorials/agendamentos.png',
    automation: { intro: 'A agenda se preenche sozinha:', items: [
      'Bot oferece só horários livres, respeitando duração, expediente e sua agenda pessoal.',
      'Taxa PIX confirmada = agendamento confirmado + evento na Google Agenda.',
      'PIX expirou? Sistema cancela, libera o horário e avisa o cliente — sem horário fantasma.',
    ] },
    features: [
      { icon: '⚙️', title: 'Serviços', desc: 'Cada serviço tem nome, duração e taxa. A duração define os horários que o bot oferece.' },
      { icon: '📅', title: 'Agenda inteligente', desc: 'O bot só oferece horários livres — olha a sua Google Agenda, a duração do serviço e os horários de atendimento.' },
      { icon: '💠', title: 'Taxa via PIX', desc: 'O cliente paga a taxa e o agendamento é confirmado automaticamente. Sem pagar em 30 min? O horário é liberado.' },
      { icon: '📋', title: 'Pedidos do carrinho', desc: 'As compras do catálogo caem aqui, com status e detalhe dos itens.' },
    ],
    steps: [
      { title: 'Crie o serviço', desc: 'Em "Serviços": nome, duração (ex: 45 min) e taxa (ex: R$ 10).' },
      { title: 'Ative o bloco 📅 no bot', desc: 'Na aba Configurar Bot, adicione o bloco de agendamento ao fluxo.' },
      { title: 'Cliente agenda sozinho', desc: 'Ele escolhe serviço, dia e horário — o bot já mostra a duração e o término.' },
      { title: 'Confirmação automática', desc: 'PIX pago = agendamento confirmado + evento criado na sua Google Agenda.' },
      { title: 'Acompanhe aqui', desc: 'Status de tudo: Aguardando pagamento, Confirmado, Concluído, Cancelado.' },
    ],
    example: {
      story: 'Uma clínica elimina a telefonista:',
      chat: [
        { from: 'client', text: 'Queria marcar uma avaliação' },
        { from: 'bot', text: '🗓️ Avaliação (45 min)\n\nEscolha o dia:\n1️⃣ Terça 09/09\n2️⃣ Quarta 10/09\n0️⃣ Menu' },
        { from: 'client', text: '1' },
        { from: 'bot', text: '🕐 Terça 09/09\nDuração: 45 min\n\nHorários livres:\n1️⃣ 09:00\n2️⃣ 10:30\n0️⃣ Menu' },
        { from: 'bot', text: '📅 Reserva feita! Taxa: R$ 10,00\n💠 PIX Copia e Cola enviado.\nApós o pagamento, confirmamos automaticamente. ✅' },
      ],
      after: 'Cliente paga o PIX → agendamento confirmado → evento na Google Agenda → você só vê a agenda cheia.',
    },
    tip: 'Conecte sua Google Agenda em Configurações: o bot nunca marca por cima de um compromisso seu.',
  },

  'whatsapp-setup': {
    icon: '📱', title: 'Conectar WhatsApp',
    purpose: 'Aqui você ativa o número de WhatsApp da sua empresa na plataforma — sem precisar criar conta no Meta nem no Facebook.',
    hero: '/tutorials/whatsapp-setup.png',
    automation: { intro: 'Ativação sem burocracia pra escalar:', items: [
      'Sem conta Meta, sem token expirando — a conexão fica ativa 24h.',
      'Número comercial continua no seu celular, atendendo sozinho à noite.',
      'Status transparente: ⏳ → ⚙️ → ✅, sempre visível nesta aba.',
      'Já tem pedido pendente? A página ATUALIZA o pedido em vez de duplicar — nada de enviar 10 vezes.',
    ] },
    features: [
      { icon: '📝', title: 'Cadastro simples', desc: 'Nome da empresa, número com DDD e e-mail de referência. Nada mais.' },
      { icon: '📩', title: 'Confirmação por SMS', desc: 'Você recebe um código por SMS no número comercial e confirma no painel.' },
      { icon: '📊', title: 'Status transparente', desc: '⏳ Recebido → ⚙️ Em configuração pela equipe → ✅ Ativo (ou ⚠️ precisando de ajuste).' },
      { icon: '🔌', title: 'Descadastro', desc: 'Se precisar liberar o número, o descadastro é feito por aqui.' },
      { icon: '🛡️', title: 'Migração sem perda', desc: 'Backup das conversas no Google Drive antes de liberar o número — nada se perde.' },
    ],
    steps: [
      { title: 'Libere o número (se ele já está num app)', desc: 'Um número não pode estar na plataforma E logado no WhatsApp/Business do celular ao mesmo tempo. No app: Ajustes → Conversas → Backup (salva tudo no Google Drive), depois Ajustes → Conta → Excluir minha conta. O backup fica guardado — você pode restaurar se um dia voltar pro app.' },
      { title: 'Preencha o formulário', desc: 'Empresa, número comercial com DDD e um e-mail de contato.' },
      { title: 'Aguarde o SMS', desc: 'Nossa equipe processa e o código chega por SMS no número informado.' },
      { title: 'Confirme o código', desc: 'Informe o código recebido e o bot entra no ar.' },
      { title: 'Acompanhe o status', desc: 'A própria aba mostra em que pé está a ativação, com observações se faltar algo.' },
    ],
    example: {
      story: 'Uma barbearia passa a atender 24h no número da loja:',
      chat: [
        { from: 'client', text: 'Vocês abrem sábado?' },
        { from: 'bot', text: 'Abrimos! 😄\n1️⃣ Agendar horário\n2️⃣ Ver preços\n0️⃣ Menu' },
      ],
      after: 'O mesmo número que antes só recebia mensagens agora responde, agenda e vende — mesmo com a loja fechada.',
    },
    tip: 'Número novo de chip (nunca logado num app) conecta na hora. Número que estava no app precisa ser liberado primeiro — e conectar não mexe no WhatsApp do seu celular pessoal.',
  },

  bots: {
    icon: '🤖', title: 'Configurar Bot',
    purpose: 'O cérebro do atendimento: o fluxo de mensagens que o bot segue. Cada bloco tem um texto e botões — e cada botão leva ao próximo bloco.',
    hero: '/tutorials/bots.png',
    automation: { intro: 'O bot é o funcionário que nunca dorme:', items: [
      'Cada bloco resolve uma dúvida — quanto mais completo o menu, menos modo humano.',
      'IA gera o fluxo inteiro a partir da descrição do seu negócio; você só revisa.',
      '"0" e "humano" são as válvulas de escape: cliente nunca fica preso no fluxo.',
    ] },
    features: [
      { icon: '🖼️', title: 'Foto e saudação', desc: 'A foto de perfil do WhatsApp e a primeira mensagem que o cliente recebe.' },
      { icon: '🧩', title: 'Fluxo em blocos', desc: 'Menu com botões numerados. Você escreve o texto, cria o botão e o próximo bloco nasce pronto.' },
      { icon: '⌨️', title: 'Comandos fixos', desc: '"0" sempre volta ao menu principal. A palavra-chave humano entrega a conversa pra você.' },
      { icon: '✨', title: 'Fluxo por IA', desc: 'Descreva o atendimento e a IA gera o fluxo completo — você só revisa e ajusta.' },
      { icon: '📤', title: 'Importar/Exportar', desc: 'Fluxo em arquivo JSON, pra backup ou pra copiar entre bots.' },
    ],
    steps: [
      { title: 'Foto + saudação', desc: 'Defina a foto de perfil e a mensagem de boas-vindas ("Olá! Como posso ajudar?").' },
      { title: 'Monte o fluxo', desc: 'Cada bloco = texto + botões. Ex: 1️⃣ Ver catálogo 2️⃣ Agendar 3️⃣ Falar com humano.' },
      { title: 'Ligue os recursos', desc: 'Os blocos especiais: 📦 Catálogo (vitrine), 📅 Agendamento, 💰 Cobrança.' },
      { title: 'Salve e teste', desc: 'Mande uma mensagem pro seu próprio número e acompanhe o fluxo.' },
    ],
    example: {
      story: 'Uma loja monta o atendimento completo em 10 minutos:',
      chat: [
        { from: 'client', text: 'oi' },
        { from: 'bot', text: 'Olá! 👋 Bem-vindo à Loja ABC\n\n1️⃣ Ver catálogo\n2️⃣ Agendar visita\n3️⃣ Falar com humano\n0️⃣ Menu' },
        { from: 'client', text: '3' },
        { from: 'bot', text: '✅ Já vou chamar um especialista. Enquanto isso, posso te ajudar com algo?' },
      ],
      after: 'Menu simples, tudo a um número de distância — e "0" sempre traz o cliente de volta ao início.',
    },
    tip: 'Menus curtos vendem mais: no máximo 4 ou 5 opções por bloco.',
  },

  marketing: {
    icon: '📣', title: 'Marketing',
    purpose: 'Campanhas em massa direto no WhatsApp: crie a mensagem uma vez e dispare para toda a sua base de contatos.',
    hero: '/tutorials/marketing.png',
    automation: { intro: 'Campanha que vira venda sozinha:', items: [
      'Mensagem termina com "responda 1️⃣" → a resposta já entra no fluxo de pedido.',
      'Custo estimado antes do disparo — sem surpresa na conta.',
      'Mensagens salvas = campanhas futuras em 2 cliques, sem reescrever nada.',
    ] },
    features: [
      { icon: '✍️', title: 'Mensagens salvas', desc: 'Crie e guarde os textos das campanhas — edite na hora do envio se quiser.' },
      { icon: '🎯', title: 'Envio segmentado', desc: 'Escolha para quem vai: todos os contatos ou uma seleção.' },
      { icon: '💠', title: 'Créditos por conversa', desc: 'Cada mensagem de marketing abre uma conversa que tem custo (Meta + Arkiel). O resumo mostra antes de enviar.' },
      { icon: '📊', title: 'Conferência com a Meta', desc: 'Compare o que a plataforma registrou com os números oficiais da conta Meta.' },
    ],
    steps: [
      { title: 'Crie a mensagem', desc: 'Nova mensagem: texto (+ imagem). Salve para reutilizar.' },
      { title: 'Escolha os destinatários', desc: 'Toda a base ou uma seleção — contatos sem WhatsApp válido ficam de fora.' },
      { title: 'Revise o custo', desc: 'O resumo mostra quantas conversas e quanto vai custar antes do disparo.' },
      { title: 'Envie e acompanhe', desc: 'Saldo de créditos e histórico de uso ficam na própria aba.' },
    ],
    example: {
      story: 'Um restaurante dispara o "prato do dia" às 11h:',
      chat: [
        { from: 'bot', text: '🍖 Hoje no Fogo de Chão da Esquina: Picanha na brasa + farofa da casa.\n\nPeça pelo menu: 1️⃣ Fazer pedido\n0️⃣ Não quero' },
        { from: 'client', text: '1' },
      ],
      after: 'Quem responde já cai no fluxo de pedido — a campanha vira venda sozinha.',
    },
    tip: 'Conversas de marketing custam mais que as de utilidade. Segmentar bem vale mais que enviar pra todo mundo.',
  },

  analytics: {
    icon: '📊', title: 'Analytics',
    purpose: 'O pulso do seu atendimento: quantas mensagens, quantas conversas e como está o uso do seu plano.',
    hero: '/tutorials/analytics.png',
    automation: { intro: 'Os números apontam as próximas automações:', items: [
      'Pico de mensagens em horário fixo → reforçe FAQ no fluxo, não contrate gente.',
      'Modo humano alto → ajuste o menu do bot pra cobrir as dúvidas repetidas.',
      'Perto do limite do plano → upgrade em 2 minutos, antes do bot parar.',
    ] },
    features: [
      { icon: '📈', title: 'Mensagens por mês', desc: 'Volume enviado e recebido, comparado com o limite do plano.' },
      { icon: '💬', title: 'Conversas iniciadas', desc: 'Quantas janelas de 24h foram abertas — é isso que a Meta cobra.' },
      { icon: '🆓', title: 'Mensagens service', desc: 'As respostas dentro de 24h são gratuitas. O painel mostra quantas você usou.' },
      { icon: '🚦', title: 'Status das conversas', desc: 'Distribuição entre bot, humano e sem bot.' },
    ],
    steps: [
      { title: 'Monitore o limite', desc: 'A barra mostra quanto do plano já foi usado no mês.' },
      { title: 'Observe os picos', desc: 'Dias e horários de maior movimento — ajuste o bot e as campanhas.' },
      { title: 'Antecipe o upgrade', desc: 'Perto do limite? A aba ⬆️ Upgrades resolve antes que o bot pare.' },
    ],
    example: {
      story: 'Uma agência descobre o horário de pico e se antecipa:',
      chat: [
        { from: 'bot', text: 'Antes de falar com nosso time: qual o assunto?\n1️⃣ Orçamento\n2️⃣ Suporte\n0️⃣ Menu' },
      ],
      after: 'Com 60% das mensagens chegando entre 18h e 20h, a agência reforçou o menu automático nesse horário — e o modo humano só entra no que vale.',
    },
    tip: 'Mensagens service são gratuitas: incentive o cliente a responder rápido.',
  },

  financeiro: {
    icon: '💰', title: 'Financeiro',
    purpose: 'O dinheiro do seu negócio na plataforma: como você recebe e tudo que já entrou.',
    hero: '/tutorials/financeiro.png',
    automation: { intro: 'O dinheiro se organiza sozinho:', items: [
      'Cobrança do bot → PIX pago → comprovante registrado. Zero conferência.',
      'Mesma conta Mercado Pago presencial (Point Tap) e online — um extrato só.',
      'Tudo categorizado pra você olhar só o total no fim do mês.',
    ] },
    features: [
      { icon: '💳', title: 'Formas de pagamento', desc: 'PIX, crédito, débito, boleto — cada uma com as taxas configuradas.' },
      { icon: '🧾', title: 'Comprovantes', desc: 'Histórico do que foi cobrado, pago e confirmado, com detalhe de cada cobrança.' },
      { icon: '🤖', title: 'Confirmação automática', desc: 'Cobranças geradas pelo bot confirmam sozinhas via Mercado Pago.' },
      { icon: '📤', title: 'Cobranças manuais', desc: 'Precisa cobrar fora do fluxo? Gere o PIX pela aba ou pelo chat (Cobrar 💰).' },
    ],
    steps: [
      { title: 'Configure as formas', desc: 'Cadastre chave PIX e as bandeiras/formas que você aceita.' },
      { title: 'Cobre no fluxo', desc: 'O bot cobra sozinho (taxa de agendamento, produtos) ou você cobra no chat.' },
      { title: 'Acompanhe os comprovantes', desc: 'Tudo confirmado fica registrado aqui, com data e valor.' },
    ],
    example: {
      story: 'Um personal trainer cobra a mensalidade pelo próprio WhatsApp:',
      chat: [
        { from: 'bot', text: '💰 Mensalidade de setembro: R$ 180,00\n\n💠 PIX Copia e Cola enviado.\nAssim que pagar, confirmamos automaticamente. ✅' },
        { from: 'client', text: 'paguei!' },
      ],
      after: 'O PIX confirma em segundos e o comprovante já aparece no Financeiro — sem planilha, sem conferência.',
    },
    tip: 'Cobranças do bot caem com sua chave PIX via Mercado Pago: configure uma vez e esqueça.',
  },

  settings: {
    icon: '⚙️', title: 'Configurações',
    purpose: 'Os dados da sua empresa, sua equipe, o visual do painel e a sua conta — tudo em um lugar só.',
    hero: '/tutorials/settings.png',
    automation: { intro: 'Configure uma vez, esqueça que existe:', items: [
      'Membros entram por convite e atendem no mesmo número — sem compartilhar senha.',
      'Google Agenda conectada = o bot nunca marca por cima do seu compromisso.',
      'Notificações no celular = você é avisado, não fica vigiando o painel.',
    ] },
    features: [
      { icon: '🏢', title: 'Empresa', desc: 'Nome e dados que aparecem pro seu cliente.' },
      { icon: '👥', title: 'Membros', desc: 'Convide a equipe para atender junto no mesmo número.' },
      { icon: '🎨', title: 'Aparência', desc: 'Tema claro ou escuro — o painel inteiro acompanha.' },
      { icon: '🔑', title: 'Conta', desc: 'Sua sessão, sair da conta e o descadastro do WhatsApp.' },
      { icon: '📅', title: 'Integrações', desc: 'Google Agenda conectada = agendamentos sem conflito com seus compromissos.' },
    ],
    steps: [
      { title: 'Revise a empresa', desc: 'Nome e dados corretos aparecem no atendimento e nos comprovantes.' },
      { title: 'Convide a equipe', desc: 'Adicione membros para dividir o atendimento humano.' },
      { title: 'Escolha o tema', desc: 'Claro de dia, escuro de noite — fica a seu critério.' },
      { title: 'Conecte o Google', desc: 'Autorize a Agenda uma vez; o bot passa a respeitar seus compromissos.' },
    ],
    example: {
      story: 'Uma clínica conecta a agenda e nunca mais tem conflito:',
      chat: [
        { from: 'client', text: 'Tem vaga quinta de manhã?' },
        { from: 'bot', text: '🕐 Quinta 11/09\nDuração: 45 min\n\nHorários livres:\n1️⃣ 09:00\n2️⃣ 10:30\n0️⃣ Menu' },
      ],
      after: 'O horário da reunião particular da dona, marcado na agenda pessoal dela, simplesmente não aparece pro cliente.',
    },
    tip: 'Antes de sair do painel num computador compartilhado, use "Sair da conta".',
  },

  upgrade: {
    icon: '⬆️', title: 'Upgrades',
    purpose: 'Planos e créditos para o seu negócio crescer sem travar: cada plano mostra com transparência o custo do WhatsApp (Meta) e a taxa Arkiel.',
    hero: '/tutorials/upgrade.png',
    automation: { intro: 'O plano acompanha o seu crescimento:', items: [
      'Custo sempre transparente: Meta + taxa Arkiel, sem letrinha miúda.',
      'Créditos avulsos pra picos pontuais sem trocar de plano.',
      'Estourar 2 meses seguidos é o sinal: o upgrade se paga em horas atendidas.',
    ] },
    features: [
      { icon: '📦', title: 'Planos claros', desc: 'Mensagens, conversas iniciadas e o que é grátis (service) — custo Meta + taxa incluídos.' },
      { icon: '💠', title: 'Créditos avulsos', desc: 'Compre créditos de conversa por PIX, sem trocar de plano.' },
      { icon: '🤖', title: 'Ativação via Google Play', desc: 'Assine pelo celular em poucos toques.' },
    ],
    steps: [
      { title: 'Compare os planos', desc: 'Veja limites e preços — o custo é sempre Meta + Arkiel, sem surpresa.' },
      { title: 'Escolha e contrate', desc: 'Direto pelo painel ou pela Google Play.' },
      { title: 'Acompanhe em Analytics', desc: 'O uso do novo limite aparece na aba 📊 na hora.' },
    ],
    example: {
      story: 'A barbearia da Camila estoura o plano no 3º mês:',
      chat: [
        { from: 'bot', text: 'Agendamento confirmado! ✂️ Quinta 14h — até lá!' },
      ],
      after: 'Com o plano maior, o bot segue atendendo à noite e no fim de semana — os horários que mais agendam.',
    },
    tip: 'Regra de bolso: se você trava no limite 2 meses seguidos, o upgrade se paga sozinho em horas atendidas.',
  },

  api: {
    icon: '🔌', title: 'API',
    purpose: 'Para quem tem sistema próprio (ERP, site, app): receba e envie dados da plataforma por HTTP, com autenticação por token.',
    hero: '/tutorials/api.png',
    automation: { intro: 'A plataforma conversa com o que você já usa:', items: [
      'Pedido, agendamento e pagamento disparam notificações no seu sistema.',
      'ERP emite nota, CRM registra cliente, logística aciona entrega — sem digitação.',
      'JSON direto ao ponto: seu dev sai daqui com a integração rodando.',
    ] },
    features: [
      { icon: '🔐', title: 'Token de acesso', desc: 'Toda requisição usa seu token no cabeçalho Authorization. Guarde como senha.' },
      { icon: '📡', title: 'Notificações', desc: 'Novo pedido, agendamento ou pagamento disparam um POST no seu endpoint.' },
      { icon: '🧩', title: 'Integração simples', desc: 'JSON direto ao ponto, sem burocracia.' },
    ],
    steps: [
      { title: 'Pegue o token', desc: 'Ele identifica sua conta — nunca exponha em código público ou site.' },
      { title: 'Configure o endpoint', desc: 'Aponte as notificações para o seu sistema.' },
      { title: 'Consuma os eventos', desc: 'Pedido no carrinho, agendamento confirmado, pagamento aprovado — tudo chega pronto.' },
    ],
    example: {
      story: 'Uma loja emite nota fiscal sem digitar nada:',
      chat: [
        { from: 'client', text: '1' },
        { from: 'bot', text: '🍕 Pedido recebido! Total: R$ 87,90. Confirmamos por aqui. ✅' },
      ],
      after: 'O pedido chega no ERP pela API, a nota sai automática e a logística já é acionada — sem ninguém copiar nada à mão.',
    },
    tip: 'Token vazado = conta comprometida. Gere um novo e invalide o antigo se houver dúvida.',
  },
}
