/**
 * Tutoriais de cada subseção (subtítulos) das abas — com foco em automação.
 * Chave: "aba:secao". Uso: <SectionHelp t="aba" s="secao" />
 */
export const SECTION_TUTORIALS = {

  // ── 📦 CATÁLOGO ──
  'products:produtos': {
    icon: '🛒', title: 'Produtos do catálogo',
    purpose: 'A vitrine que o cliente vê dentro do WhatsApp: foto, preço e botão de comprar — tudo sincronizado automaticamente.',
    steps: [
      { title: 'Cadastre com foto de verdade', desc: 'Foto quadrada, fundo limpo, bem iluminada. Produtos sem foto vendem até 3x menos.' },
      { title: 'Preço e descrição objetivos', desc: 'Nome claro + 1 linha que responde "o que ganho comprando isso?".' },
      { title: 'Deixe ativo só o que vende', desc: 'Produto pausado sai do catálogo sozinho — sem precisar apagar.' },
      { title: 'Ligue no fluxo do bot', desc: 'No Configurar Bot, o bloco 📦 mostra a vitrine; o pedido chega sozinho em Agendamentos e Pedidos.' },
    ],
    automation: {
      intro: 'Depois de cadastrado, o ciclo é 100% automático:',
      items: [
        'Produto salvo → aparece na hora no catálogo do WhatsApp, sem publicar nada.',
        'Cliente monta o carrinho → pedido cai organizado no painel com status.',
        'Estoque em falta? Pause o produto — ele desaparece do chat instantaneamente.',
      ],
    },
    example: { story: 'O cliente compra sem você intervir:', chat: [
      { from: 'client', text: 'quero comprar' },
      { from: 'bot', text: '🛒 Toque nos itens do catálogo para adicionar ao carrinho:' },
      { from: 'client', text: '1' },
      { from: 'bot', text: '✅ Pedido recebido! Total: R$ 87,90' },
    ], after: 'O pedido chega no painel com todos os itens — você só prepara a entrega.' },
    tip: 'Máximo de 30 produtos ativos: quanto mais limpa a vitrine, mais rápido o cliente decide.',
  },

  'products:servicos': {
    icon: '📅', title: 'Serviços agendáveis',
    purpose: 'Cada serviço tem nome, duração e taxa. É daqui que o bot tira as opções de agendamento que oferece aos clientes.',
    steps: [
      { title: 'Crie o serviço', desc: 'Ex: "Corte + Barba" — duração 45 min, taxa R$ 10.' },
      { title: 'Duração = horários possíveis', desc: 'A duração define o que o bot oferece: 45 min gera 09:00, 09:45, 10:30... e nunca sobrepõe outro serviço.' },
      { title: 'Taxa via PIX garante presença', desc: 'Cliente que paga taxa não fura o horário. Sem pagar em 30 min, o horário é liberado sozinho.' },
      { title: 'Serviço ativo aparece no bot', desc: 'Só serviços ativos entram no menu de agendamento.' },
    ],
    automation: {
      intro: 'O agendamento inteiro roda sozinho:',
      items: [
        'Bot oferece só horários livres (Google Agenda + duração + horário de atendimento).',
        'Cliente paga a taxa → confirmação + evento na agenda, sem você tocar em nada.',
        'Não pagou? Sistema cancela, libera o horário e avisa o cliente.',
      ],
    },
    example: { story: 'Um cliente agenda às 23h, com você dormindo:', chat: [
      { from: 'client', text: '2' },
      { from: 'bot', text: '🗓️ Corte + Barba (45 min)\n\n1️⃣ Terça 09:00\n2️⃣ Terça 09:45\n0️⃣ Menu' },
      { from: 'client', text: '1' },
      { from: 'bot', text: '📅 Reserva feita! Taxa: R$ 10,00 💠 PIX enviado ✅' },
    ], after: 'De manhã a agenda já está cheia e confirmada — a taxa filtra quem é sério.' },
    tip: 'Use taxa pequena (R$ 5 a R$ 20): segura o compromisso sem espantar cliente.',
  },

  'products:horarios': {
    icon: '⏰', title: 'Horários de atendimento',
    purpose: 'Define quando o bot trabalha: abertura, fechamento e dias de funcionamento. Os horários oferecidos aos clientes respeitam exatamente isso.',
    steps: [
      { title: 'Defina abertura e fechamento', desc: 'Ex: 09:00 às 18:00. O bot nunca oferece horário fora dessa janela.' },
      { title: 'Escolha os dias', desc: 'Domingo fechado? Marque os dias que você atende.' },
      { title: 'Salve — vale na hora', desc: 'O próximo cliente que agendar já vê os horários novos.' },
    ],
    automation: {
      intro: 'Pense a longo prazo:',
      items: [
        'Férias ou feriado? Reduza a janela em 1 minuto e o bot respeita.',
        'Atendimento noturno? Apenas estenda o fechamento — o bot cuida do resto.',
      ],
    },
    example: { story: 'Uma barbearia que abre à noite:', chat: [
      { from: 'client', text: 'Tem horário hoje à noite?' },
      { from: 'bot', text: '🕐 Hoje (14h às 22h de funcionamento)\n\n1️⃣ 19:00\n2️⃣ 19:45\n0️⃣ Menu' },
    ], after: 'Configurou uma vez, funciona pra sempre — o bot nunca marca fora do seu expediente.' },
    tip: 'Deixe uma folga de 30 min no fim do dia: o motor já evita horários colados, mas folga extra evita atendimento às pressas.',
  },

  'products:google-agenda': {
    icon: '🔗', title: 'Google Agenda conectada',
    purpose: 'Ao conectar sua Google Agenda, o bot consulta seus compromissos em tempo real e nunca oferece um horário que você já tem ocupado.',
    steps: [
      { title: 'Autorize uma única vez', desc: 'Faça login com o Google e autorize a Agenda. O token é renovado automaticamente.' },
      { title: 'Agenda privada = horário invisível', desc: 'Compromissos pessoais não aparecem pro cliente — o horário simplesmente não é oferecido.' },
      { title: 'Agendamentos entram nela', desc: 'Cada agendamento pago vira um evento na agenda, com nome do cliente e serviço.' },
    ],
    automation: {
      intro: 'Dupla proteção anti-conflito:',
      items: [
        'Consulta a agenda em tempo real a cada menu de horários.',
        'Se alguém marcar enquanto o cliente escolhe, o bot revalida e reoferece horários livres.',
      ],
    },
    example: { story: 'Você marca uma reunião às 15h na sua agenda pessoal:', chat: [
      { from: 'client', text: 'tem 15h hoje?' },
      { from: 'bot', text: '🕐 Horários livres:\n1️⃣ 14:00\n2️⃣ 16:00\n0️⃣ Menu' },
    ], after: 'O 15h nem aparece — sua reunião está lá e o bot sabe disso.' },
    tip: 'Conecte a agenda que você realmente usa no dia a dia — não vale criar uma só pro bot.',
  },

  // ── 📱 CONECTAR WHATSAPP ──
  'whatsapp-setup:automatica': {
    icon: '⚡', title: 'Conexão automática',
    purpose: 'O jeito recomendado: preenche o número comercial, recebe um SMS e o bot entra no ar — sem conta no Meta, sem Facebook.',
    steps: [
      { title: 'Confira se o número está LIVRE', desc: 'Se ele está logado no WhatsApp ou WhatsApp Business de algum celular, a ativação trava — a Meta não permite o mesmo número nos dois lados. Libere primeiro (veja o passo abaixo) e volte aqui.' },
      { title: 'Nome da empresa + número com DDD', desc: 'Funciona com número comercial do chip da loja. Se estava num app, veja "Como liberar o número" mais abaixo.' },
      { title: 'Aguarde o SMS', desc: 'Nossa equipe processa e o código chega por SMS no número informado.' },
      { title: 'Confirme e pronto', desc: 'Código validado = número ativo na plataforma, com API oficial do WhatsApp.' },
    ],
    automation: {
      intro: 'Por que essa é a melhor via:',
      items: [
        'Não exige perfil comercial no Meta — a Arkiel já é a Business oficial.',
        'Não há token que expire — a conexão fica ativa 24h por dia.',
        'Número desconectado? O prazo de reutilização aparece aqui mesmo.',
      ],
    },
    example: { story: 'Ativação enquanto você toma café:', chat: [
      { from: 'client', text: 'oi' },
      { from: 'bot', text: 'Olá! 👋 Como posso ajudar?\n1️⃣ Ver catálogo\n2️⃣ Agendar\n0️⃣ Menu' },
    ], after: 'O mesmo número que só recebia mensagens agora atende sozinho, com selo de conta oficial.' },
    howTo: {
      title: '🔓 Como liberar o número do app oficial (sem perder nada)',
      steps: [
        'Abra o WhatsApp Business no celular do número → Ajustes → Conversas → Backup → tocar em "Salvar" (salva TODAS as conversas no Google Drive).',
        'Exporte as conversas mais críticas: abra a conversa → ⋮ → Mais → Exportar conversa (vai pra seu e-mail como arquivo).',
        'Anote os produtos do catálogo do app (foto, nome, preço) — você recadastra na aba Catálogo do painel e eles vão pro catálogo oficial automaticamente.',
        'Ajustes → Conta → Excluir minha conta → confirme. Isso apaga só a CONTA daquele app; o backup do Google Drive fica intacto.',
        'Anote os grupos em que o número participa — após a migração o número sai dos grupos (regra da Meta, sem API pra gerenciar) e você pede readmissão depois.',
        'Aguarde uns 10 minutos e peça a conexão aqui. Pronto — o bot assume o número, e suas conversas antigas continuam salvas no Drive.',
      ],
    },
    tip: 'Coloque o e-mail de referência de quem decide na empresa — usamos só se precisarmos avisar algo da ativação.',
  },

  'whatsapp-setup:manual': {
    icon: '📋', title: 'Cadastro manual',
    purpose: 'Se o SMS não for viável (número fixo, chip corporativo etc.), o formulário manual aciona nossa equipe para ativar o número com você.',
    steps: [
      { title: 'Preencha tudo', desc: 'Empresa, número, e-mail e observações (ex: "número é fixo, sem SMS").' },
      { title: 'Acompanhe o status', desc: '⏳ Recebido → ⚙️ Em configuração → ✅ Ativo. Se faltar algo, aparece ⚠️ com a observação.' },
      { title: 'Já tem pedido pendente? Não reenvie', desc: 'A página atualiza o pedido existente em vez de criar outro — o mesmo número várias vezes não acelera nada, só confunde.' },
    ],
    automation: { intro: 'A equipe entra no processo só quando necessário:', items: [
      'Verificamos o número e a compatibilidade com a API oficial.',
      'Se precisar de ajuste, a observação diz exatamente o que falta — sem idas e vindas.',
      'Pedido travado na maioria das vezes é número ainda logado no app — o card amarelo no topo da página ensina a liberar.',
    ] },
    example: { story: 'Uma clínica com telefone fixo VoIP:', chat: [
      { from: 'bot', text: '✅ Número ativo! Agendamentos 24h por aqui.' },
    ], after: 'Mesmo sem SMS, o número entra no ar pela verificação manual da equipe.' },
    tip: 'Quanto mais completo o formulário, mais rápido a ativação — observação é sua voz no processo.',
  },

  'whatsapp-setup:facebook': {
    icon: '📶', title: 'Login com Facebook',
    purpose: 'Caminho alternativo para quem já tem conta Meta Business configurada — não é necessário para a maioria.',
    steps: [
      { title: 'Use só se já tiver Business', desc: 'Se sua empresa já gerencia WhatsApp Business API pela Meta, dá pra conectar direto.' },
      { title: 'Prefira a via automática', desc: 'Sem conta Meta? A conexão por SMS (⚡) é mais simples e igualmente oficial.' },
    ],
    automation: { intro: 'Nos dois caminhos o resultado é o mesmo:', items: [
      'Número oficial com API do WhatsApp Business.',
      'Bot ativo 24h, sem depender de login do Facebook depois.',
    ] },
    example: { story: '', chat: [], after: 'Se tiver dúvida de qual caminho usar, comece pela ⚡ automática — se não der, o manual cobre.' },
    tip: 'A via automática não pede senha do Facebook — menos senha circulando, mais segurança.',
  },

  // ── 📣 MARKETING ──
  'marketing:templates': {
    icon: '✉️', title: 'Mensagens prontas',
    purpose: 'Sua biblioteca de campanhas: crie uma vez, guarde, edite na hora do envio e dispare quando quiser.',
    steps: [
      { title: 'Crie a mensagem', desc: 'Texto direto + imagem quando ajudar. Mensagens curtas (2-4 linhas) têm mais resposta.' },
      { title: 'Sempre termine com uma ação', desc: 'Frase de fechamento: "1️⃣ Quero aproveitar" — a resposta entra no fluxo do bot.' },
      { title: 'Reutilize', desc: 'Mensagem salva = campanha futura em 2 cliques.' },
    ],
    automation: {
      intro: 'Transforme marketing em venda automática:',
      items: [
        'Resposta "1️⃣" do cliente cai direto no fluxo de pedido/agendamento.',
        'Regra de ouro: campanha às 10h-11h vende mais que às 8h — todo mundo já acordou.',
        'Guarde 3-4 mensagens-testadas: promoção, lançamento, reativação.',
      ],
    },
    example: { story: 'Modelo pronto que converte:', chat: [
      { from: 'bot', text: '🔥 Só hoje: pizza grande + refri por R$ 49,90.\nResponda 1️⃣ pra garantir a sua antes das 22h.' },
      { from: 'client', text: '1' },
    ], after: 'O "1" dispara o fluxo de pedido — a campanha virou venda sem ninguém atender.' },
    tip: 'Fale de benefício ("sua casa cheirando a pão quente") antes de preço — preço sozinho não convence.',
  },

  'marketing:enviar': {
    icon: '🚀', title: 'Enviar campanha',
    purpose: 'O disparo da mensagem para a sua base: escolha destinatários, veja o custo antes e acompanhe o resultado.',
    steps: [
      { title: 'Escolha os destinatários', desc: 'Toda a base ou seleção — contatos sem WhatsApp válido ficam fora automaticamente.' },
      { title: 'Revise o resumo de custos', desc: 'Cada mensagem de marketing abre uma conversa paga (custo Meta + taxa Arkiel). O resumo mostra o total antes do envio.' },
      { title: 'Edite na hora se quiser', desc: 'A mensagem é editável até o último segundo antes de disparar.' },
      { title: 'Envie e confira o histórico', desc: 'O histórico de uso mostra o que já gastou no mês.' },
    ],
    automation: { intro: 'Rotina que funciona pra quase todo negócio:', items: [
      '1 campanha semanal com oferta real — menos que isso, esquecem de você; mais, bloqueiam.',
      'Segmente: cliente antigo recebe "saudade", cliente novo recebe "bem-vindo".',
      'Mensagem de resposta automática cuida do resto — você só vê os pedidos chegando.',
    ] },
    example: { story: 'Resumo antes do disparo:', chat: [
      { from: 'bot', text: '📤 Enviar pra 412 contatos\n💰 ~412 conversas de marketing\n💠 Custo estimado: R$ 147,50\n\n[Enviar agora]' },
    ], after: 'Nada de surpresa na fatura: o custo aparece antes de você apertar o botão.' },
    tip: 'Comece com um teste de 20-30 contatos: se a resposta for boa, dispare pro resto.',
  },

  'marketing:conversas': {
    icon: '📋', title: 'Conversas cobradas',
    purpose: 'A conferência transparente: o que a plataforma registrou versus o que a Meta cobrou de fato, lado a lado.',
    steps: [
      { title: 'Compare os números', desc: 'O card alinha o seu tracking interno com os números oficiais da conta Meta.' },
      { title: 'Bateu? Tranquilidade total', desc: 'Conversas de marketing e utilidade têm custos diferentes — aqui você vê cada categoria.' },
    ],
    automation: { intro: 'Por que isso importa pro seu bolso:', items: [
      'Você enxerga exatamente onde vai o dinheiro: marketing x atendimento comum.',
      'Base pra decidir o upgrade do plano e o ritmo das campanhas.',
    ] },
    example: { story: '', chat: [], after: 'Use antes de cada campanha grande: saber o custo por conversa transforma disparo em decisão de negócio, não aposta.' },
    tip: 'Conversas de utilidade (confirmação, lembrete) custam bem menos que marketing — prefira-as pra rotina.',
  },

  // ── 📊 ANALYTICS ──
  'analytics:plano': {
    icon: '📈', title: 'Uso do plano',
    purpose: 'Quanto do seu plano já foi consumido no mês — e o que fazer antes de bater no limite.',
    steps: [
      { title: 'Olhe a barra', desc: 'Verde = folga. Amarela = atenção. Se tocar o limite, o bot para de responder até o próximo mês.' },
      { title: 'Perto do limite? Suba de plano', desc: 'A aba ⬆️ Upgrades resolve em 2 minutos — e o bot nem sente.' },
    ],
    automation: { intro: 'Nunca seja pego de surpresa:', items: [
      'Cliente que mais fala costuma ser o que menos compra — o painel ajuda a identificar.',
      'Se estourar 2 meses seguidos, o upgrade se paga sozinho em horas atendidas.',
    ] },
    example: { story: '', chat: [], after: 'Cheque no dia 1º de cada mês: 30 segundos que evitam o bot fora do ar na hora do pico.' },
    tip: 'O plano conta mensagens do mês — campanhas grandes entram na conta. Planeje o disparo olhando aqui.',
  },

  'analytics:mensagens': {
    icon: '✉️', title: 'Mensagens por mês',
    purpose: 'O volume total que passou pelo seu WhatsApp: enviadas + recebidas, na comparação com o limite do plano.',
    steps: [
      { title: 'Identifique os picos', desc: 'Dias e horários de maior movimento — é quando o bot mais economiza seu tempo.' },
      { title: 'Mensagens service são grátis', desc: 'Respostas dentro da janela de 24h não custam. Incentive o cliente a responder rápido.' },
    ],
    automation: { intro: 'Como usar o volume a seu favor:', items: [
      'Pico às 18h-20h? Coloque FAQ e catálogo no fluxo — o bot absorve o volume.',
      'Movimento constante aos sábados? Ative agendamento no fim de semana.',
    ] },
    example: { story: '', chat: [], after: 'Seu número oficial pode atender 100 conversas ao mesmo tempo — o limite é o plano, não a sua equipe.' },
    tip: 'Compare meses seguidos: crescimento de volume = hora de pensar em upgrade antes do aperto.',
  },

  'analytics:status': {
    icon: '🚦', title: 'Status das conversas',
    purpose: 'Como as conversas se dividem: bot, humano e sem bot — o retrato de como seu atendimento está distribuído.',
    steps: [
      { title: 'Bot dominando? Ótimo', desc: 'Significa que o automático resolve e você só entra no que gera dinheiro.' },
      { title: 'Humano alto? Refine o fluxo', desc: 'Muito modo humano = o fluxo do bot não cobre as dúvidas comuns. Revise o menu.' },
    ],
    automation: { intro: 'A meta saudável do Arkiel:', items: [
      '70-80% das conversas resolvidas 100% pelo bot.',
      'Modo humano reservado pra negociação e caso complexo.',
    ] },
    example: { story: '', chat: [], after: 'A cada ajuste no fluxo do bot, volte aqui: se a fatia do bot cresceu, o ajuste funcionou.' },
    tip: 'Se "sem bot" crescer sem você ter ativado, verifique o status do número em Conectar WhatsApp.',
  },

  'analytics:contatos': {
    icon: '🏆', title: 'Contatos mais ativos',
    purpose: 'Seus clientes mais engajados — quem fala, responde e compra. Ouro puro pra marketing.',
    steps: [
      { title: 'Identifique os fiéis', desc: 'Ativos = recorrentes. São os primeiros da lista pra ofertas e novidades.' },
      { title: 'Crie campanha pra eles', desc: 'Na aba 📣 Marketing, selecione esses contatos: taxa de resposta muito maior.' },
    ],
    automation: { intro: 'Rota pronta de dinheiro:', items: [
      'Ativos recebem lançamento primeiro — compram mais e mais rápido.',
      'Quem sumiu da lista? Campanha de reativação ("faz tempo!") pra eles.',
    ] },
    example: { story: '', chat: [], after: 'O seu melhor público já está dentro do painel — é só organizar o disparo.' },
    tip: 'Atividade é melhor indicador que cadastro: quem conversa compra; quem só existe na agenda, nem sempre.',
  },

  // ── 💰 FINANCEIRO ──
  'financeiro:comprovantes': {
    icon: '📄', title: 'Comprovantes',
    purpose: 'O histórico financeiro completo: cada cobrança gerada, paga e confirmada — com data, valor e origem.',
    steps: [
      { title: 'Filtre por categoria', desc: 'Taxas de agendamento, vendas, cobranças manuais — tudo separadinho.' },
      { title: 'Confirme sem planilha', desc: 'PIX pago = comprovante aqui automaticamente. Você não confere nada.' },
      { title: 'Precise reenviar? Use o chat', desc: 'No menu da conversa, 💰 Cobrar gera um novo PIX na hora.' },
    ],
    automation: { intro: 'O fluxo fecha sozinho:', items: [
      'Bot cobra → cliente paga → Mercado Pago confirma → comprovante registrado aqui.',
      'Cobrança manual pelo chat segue o mesmo caminho — zero conferência manual.',
    ] },
    example: { story: '', chat: [], after: 'No fim do mês, o que está aqui é o que entrou — sem cruzar nada à mão.' },
    tip: 'Toda cobrança tem o status visível: pendente, pago ou expirado. Se algo estranho, cheque antes de reenviar.',
  },

  'financeiro:point-tap': {
    icon: '💳', title: 'Point Tap — celular como maquininha',
    purpose: 'Receba presencialmente com o app do Mercado Pago: o cliente aproxima o cartão no seu celular.',
    steps: [
      { title: 'Instale o app do Mercado Pago', desc: 'Disponível pra Android — transforma o celular em maquininha.' },
      { title: 'Abra, cadastre e cobre', desc: 'Abra o app, escolha Point Tap e aproximação do cartão. O valor cai na sua conta MP.' },
    ],
    automation: { intro: 'Integra com o resto da plataforma:', items: [
      'O mesmo Mercado Pago das cobranças do bot — tudo num extrato só.',
      'Cliente presencial que depois compra no chat? Mesma conta, mesmo histórico.',
    ] },
    example: { story: '', chat: [], after: 'Pra balcão, feira e atendimento em domicílio — sem comprar maquininha.' },
    tip: 'Funciona melhor em celulares com NFC: teste com o seu cartão antes de usar com cliente.',
  },

  // ── ⚙️ CONFIGURAÇÕES ──
  'settings:empresa': {
    icon: '🏢', title: 'Sua Empresa',
    purpose: 'Os dados que identificam seu negócio na plataforma — aparecem no painel e nos comprovantes.',
    steps: [
      { title: 'Revise nome e dados', desc: 'Nome correto = cliente reconhece na fatura e no atendimento.' },
      { title: 'Mantenha atualizado', desc: 'Mudou endereço ou contato? Atualize aqui pra documenstos sempre certos.' },
    ],
    automation: { intro: 'Pequeno detalhe, grande efeito:', items: [
      'Nome limpo e correto reduz desconfiança no PIX — o cliente reconhece o pagador.',
    ] },
    example: { story: '', chat: [], after: 'Leva 1 minuto e vale pro resto da vida da conta.' },
    tip: 'Use o nome que o cliente já conhece — apelido da loja vale mais que razão social.',
  },

  'settings:plano': {
    icon: '💎', title: 'Plano Atual',
    purpose: 'Resumo do seu plano: limites, o que está incluso e o caminho pra crescer.',
    steps: [
      { title: 'Confira os limites', desc: 'Mensagens e conversas do mês — o mesmo número que aparece em Analytics.' },
      { title: 'Compare com o uso', desc: 'Perto do teto? A aba ⬆️ Upgrades tem o próximo passo com custo transparente.' },
    ],
    automation: { intro: 'Plano certo = bot nunca para:', items: [
      'Monitor em Analytics + upgrade antecipado = zero downtime no atendimento.',
    ] },
    example: { story: '', chat: [], after: 'Plano apertado é a maior causa de bot fora do ar — e a mais fácil de evitar.' },
    tip: 'O custo mostrado já inclui Meta + Arkiel: sem letrinha miúda.',
  },

  'settings:membros': {
    icon: '👥', title: 'Membros da equipe',
    purpose: 'Convide pessoas para atender junto no mesmo número — cada um vê as conversas no próprio login.',
    steps: [
      { title: 'Convide por e-mail', desc: 'O membro entra com a conta Google dele — sem compartilhar senha.' },
      { title: 'Divida o atendimento', desc: 'Cada membro pode assumir conversas no modo humano; o bot continua trabalhando em paralelo.' },
      { title: 'Revogue quando sair', desc: 'Remove o acesso na hora — sem trocar senha do WhatsApp.' },
    ],
    automation: { intro: 'Equipe + bot sem esbarrar:', items: [
      'Notificação de "humano esperando" vai pra quem estiver online.',
      'Cliente não sabe que são várias pessoas — atende sempre "a empresa".',
    ] },
    example: { story: 'Dois atendentes e um bot, sem confusão:', chat: [
      { from: 'client', text: '2' },
      { from: 'bot', text: '✅ Um especialista chega já.' },
    ], after: 'Quem estiver livre assume a conversa; o resto segue com o bot.' },
    tip: 'Peça aos membros que ativem as notificações — resposta rápida é metade da boa experiência.',
  },

  'settings:aparencia': {
    icon: '🎨', title: 'Aparência',
    purpose: 'Tema claro ou escuro do painel — gosto pessoal, e o painel inteiro acompanha.',
    steps: [
      { title: 'Escolha o tema', desc: 'Claro de dia, escuro de noite — ou compacto pra caber mais na tela.' },
      { title: 'Salva automático', desc: 'O tema fica salvo na sua conta, em qualquer aparelho.' },
    ],
    automation: { intro: '', items: [] },
    example: { story: '', chat: [], after: 'Só conforto visual: menos cansaço em dia longo de atendimento.' },
    tip: 'Tema escuro economiza bateria em telas OLED — útil pra quem atende no celular.',
  },

  'settings:conta': {
    icon: '👤', title: 'Minha Conta',
    purpose: 'Sua sessão de usuário: e-mail, senha/troca de conta e o descadastro do número de WhatsApp.',
    steps: [
      { title: 'Sair da conta', desc: 'Use sempre em computador compartilhado — é o cadeado do seu painel.' },
      { title: 'Descadastrar WhatsApp', desc: 'Libera o número da plataforma. Os prazos pra reutilizar aparecem em Conectar WhatsApp.' },
    ],
    automation: { intro: '', items: [] },
    example: { story: '', chat: [], after: 'Descadastro é reversível dentro do prazo: o mesmo número pode ser reativado depois.' },
    tip: 'Antes de descadastrar, exporte o que precisa (fluxo em JSON, contatos) — alguns dados não voltam.',
  },

  // ── 🔌 API ──
  'api:chave': {
    icon: '🔑', title: 'Sua chave de API',
    purpose: 'O token que identifica sua conta nas integrações — ele vai no cabeçalho Authorization de cada requisição.',
    steps: [
      { title: 'Guarde como senha', desc: 'Com o token, um sistema externo fala com sua conta. Nunca exponha em site ou código público.' },
      { title: 'Suspeitou? Renove', desc: 'Um token novo invalida o antigo na hora — segurança sem drama.' },
    ],
    automation: { intro: 'Com um token válido, os eventos fluem:', items: [
      'Novo pedido do carrinho → POST no seu endpoint.',
      'Agendamento confirmado, pagamento aprovado → notificação pronta pra consumir.',
    ] },
    example: { story: '', chat: [], after: 'É a ponte entre a plataforma e qualquer sistema que sua empresa já usa.' },
    tip: 'Token em variável de ambiente no seu sistema — nunca direto no código.',
  },

  'api:como-usar': {
    icon: '📘', title: 'Como usar a API',
    purpose: 'O básico pra integrar: uma requisição HTTP com Authorization e JSON — direto ao ponto.',
    steps: [
      { title: 'Monte a requisição', desc: 'POST pro endpoint indicado, cabeçalho Authorization com sua chave, corpo em JSON.' },
      { title: 'Consuma as notificações', desc: 'Pedido, agendamento, pagamento — cada evento chega com os dados prontos.' },
      { title: 'Trate como evento', desc: 'Sistema recebe → processa (nota fiscal, logística, CRM) → pronto.' },
    ],
    automation: { intro: 'Exemplos do que dá pra fechar em uma tarde:', items: [
      'ERP emite nota fiscal automática ao receber pedido novo.',
      'CRM registra cliente que agendou pela primeira vez.',
      'Chat interno da equipe recebe alerta de venda grande.',
    ] },
    example: { story: '', chat: [], after: 'Se sua equipe tem um dev, ele sai daqui com a integração funcionando.' },
    tip: 'Teste primeiro com o pedido de um cliente real seu — ver o JSON chegando vale 20 minutos de leitura.',
  },

  // ── 👥 CONTATOS ──
  'contacts:novo': {
    icon: '➕', title: 'Novo contato',
    purpose: 'Cadastro manual, um por um: nome e número com DDD — pra clientes especiais ou começo de base.',
    steps: [
      { title: 'Nome + número com DDD', desc: 'Formato com DDD e código do país (55) quando importar de planilha.' },
      { title: 'Valide o WhatsApp', desc: 'Contatos sem WhatsApp válido não recebem campanhas — o sistema ignora na hora do envio.' },
    ],
    automation: { intro: 'Dica de escala:', items: [
      'Mais de 10 contatos? Use o botão Sincronizar (.vcf/.csv/Google) — em lote é sempre mais rápido.',
    ] },
    example: { story: '', chat: [], after: 'O contato cadastrado já pode receber campanhas e ser agendado pelo bot na primeira mensagem.' },
    tip: 'Cadastre com o nome como o cliente se reconhece — campanha com nome certo tem 2x mais resposta.',
  },

  'contacts:detalhes': {
    icon: '📇', title: 'Detalhes do contato',
    purpose: 'A ficha do cliente: dados, histórico de conversas e o que ele já comprou/agendou.',
    steps: [
      { title: 'Veja o histórico completo', desc: 'Tudo que passou pelo WhatsApp com esse cliente, em ordem.' },
      { title: 'Contexto antes de responder', desc: 'Leia as últimas trocas antes de assumir no modo humano — o cliente não repete a história.' },
    ],
    automation: { intro: '', items: [] },
    example: { story: '', chat: [], after: 'Um cliente bem lembrado é um cliente que volta — use a ficha antes de cada resposta.' },
    tip: 'Atendimento que cita a última compra ("de novo o de sempre?") fideliza sem esforço.',
  },

  // ── 💬 CONVERSAS ──
  'conversations:cobrar': {
    icon: '💰', title: 'Cobrar cliente no chat',
    purpose: 'Gera um PIX na hora, dentro da conversa. O cliente paga, o sistema confirma sozinho e o comprovante vai pro Financeiro.',
    steps: [
      { title: 'Abra o menu da conversa', desc: 'No cabeçalho do chat: 💰 Cobrar.' },
      { title: 'Escolha o valor e a forma', desc: 'Valor avulso ou de um produto/serviço. PIX cai pronto pro cliente.' },
      { title: 'Confirmação automática', desc: 'Pago = confirmado no painel + comprovante no Financeiro. Zero conferência manual.' },
    ],
    automation: { intro: 'Quando a janela de 24h expira, o sistema ainda cobra:', items: [
      'Manda template de cobrança (permitido pela Meta) — o cliente recebe mesmo sem janela aberta.',
      'Cliente responde qualquer coisa → o PIX pendente é entregue na sequência, sem você repetir o pedido.',
    ] },
    example: { story: '', chat: [
      { from: 'bot', text: '💰 Cobrança: R$ 180,00\n💠 PIX Copia e Cola:\n00020126...\nAssim que pagar, confirmamos. ✅' },
      { from: 'client', text: 'paguei agora' },
      { from: 'bot', text: '✅ Pagamento confirmado! Obrigado.' },
    ], after: 'A cobrança vira comprovante sem você abrir o app do banco pra conferir.' },
    tip: 'Cobrou e o cliente sumiu? A cobrança fica visível na conversa — reenvie o mesmo PIX no menu quando retomar.',
  },
}
