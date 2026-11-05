# AeroPing

Radar de viagens para o casal: metas de preço, histórico de cotações, comparação de milhas e decisões compartilhadas. Interface responsiva com instalação na tela inicial.

## Estado da versão

- Radares com origem, destino, datas, bagagem, conexões e margem de preço.
- Busca real de ida e volta, em reais, para dois adultos na classe econômica.
- Filtros de conexões, horários, companhias, ordenação e link do itinerário para confirmar e reservar na fonte.
- Criação de radar a partir dos resultados e atualização manual de preços.
- Até 8 radares ativos monitorados em segundo plano aproximadamente a cada 6 horas; tentativas com erro voltam à fila em 2 horas.
- Histórico automático e registro manual complementar; orçamento por pessoa e total do casal.
- Pings por Web Push após ativação em cada aparelho compatível, incluindo com a página fechada. No iPhone, instalar na tela inicial.
- Visual mostarda, fontes maiores, controles de toque e navegação adaptados ao celular.
- Histórico e alertas calculados sobre cotações registradas.
- Comparador dinheiro versus milhas, incluindo taxas e custo do milheiro.
- Decisões de cada viajante, exportação e restauração de backups.
- Login por senha e ativação por convite privado, de uso único e válido por 7 dias.
- Banco compartilhado no Supabase: dois membros por casal, com isolamento por RLS.
- Sincronização de alterações, conferência de atualizações a cada 30 segundos com o app aberto e detecção de conflitos.
- Convite para o segundo viajante pelo painel de ajustes, sem envio automático de mensagens.
- Prévia de compartilhamento com Open Graph e imagem PNG de 1200 × 630 pixels.

A busca usa a página pública do Google Voos, sem API paga. É uma seleção de itinerários, não uma garantia de encontrar toda tarifa. A integração depende do formato e disponibilidade da fonte; não contorna restrições de acesso. Não há previsão por IA, emissão, pesquisa automática de milhas, WhatsApp ou calendário flexível nesta versão. As datas e os aeroportos são exatos. Bagagem despachada não confirmada nunca gera alerta de oferta compatível. Confirme preço, taxas, bagagem e disponibilidade antes de comprar.

## GitHub Pages

O fluxo `.github/workflows/pages.yml` verifica o código e as regras do radar antes de publicar `dist/`. Em Settings → Pages, a origem deve ser **GitHub Actions**.

O site e o código são públicos. Dados privados e credenciais administrativas não são incluídos no repositório. O Supabase mantém os dados do casal em banco separado, protegido por autenticação e RLS. O arquivo `site-config.js` contém somente a URL e a chave pública publishable do projeto.

## Desenvolvimento

Requer Node.js 20 ou superior. Sem dependências para instalar.

```sh
npm start
npm run check
npm test
```

Abra `http://127.0.0.1:4173`. O site utiliza caminhos relativos e funciona no subdiretório `/aeroping/` do GitHub Pages. O service worker guarda os arquivos do app para uso offline; fontes e fotos externas podem não aparecer sem internet.

## Custos

Nenhum serviço pago é ativado por este código. GitHub Pages atende a publicação estática em repositórios públicos no GitHub Free. O Supabase Free pode atender o uso inicial do casal, dentro dos limites do plano e sujeito a pausas por inatividade. A fonte pública não exige chave de API. O servidor limita a 80 consultas novas por dia por casal e 15 segundos entre consultas manuais novas; o cache dura 15 minutos. Datas de volta devem estar nos próximos 330 dias. A fila verifica dois radares a cada 15 minutos; os oito primeiros radares ativos elegíveis recebem monitoramento. Os demais podem ser consultados manualmente. Nenhum upgrade, cartão ou serviço pago foi contratado.

- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Supabase Free](https://supabase.com/pricing)
- [Pausas do Supabase Free](https://supabase.com/docs/guides/platform/free-project-pausing)

## Dados e segurança

Use somente chave Supabase pública publishable/anon no cliente. Nunca use `service_role`, `sb_secret_`, senha do banco ou token de gerenciamento no frontend. Não armazene CPF, passaporte, cartão ou documentos neste app.

O banco é a fonte principal dos dados. A cópia local ajuda durante falhas temporárias de rede; mantenha o app aberto até as alterações serem sincronizadas. O adaptador usa revisão otimista para detectar alterações concorrentes, sem sobrescrever silenciosamente o outro aparelho. A sessão persiste no navegador e pode ser encerrada pelos ajustes.

## Ativação dos dois acessos

O primeiro viajante recebe um link privado de ativação, separado do código público. Ele escolhe a própria senha (mínimo de 8 caracteres). Depois, em Ajustes, gera um convite para o e-mail do segundo viajante. Convites são credenciais privadas: não os coloque em issues, commits ou arquivos públicos. O hash fica em uma tabela privada; o token é validado pela função de servidor `enroll` antes de criar uma conta e associá-la ao casal. O endpoint faz a própria autenticação por convite e não recebe uma sessão de usuário existente. As funções privilegiadas de cadastro só podem ser executadas pela função de servidor.

Não existe cadastro público: o gatilho no Auth exige a marca de cadastro definida pela API administrativa da função `enroll`. O envio de e-mail não é necessário. O convite só permite cadastrar o endereço específico escolhido pelo primeiro viajante. O destinatário deve recebê-lo por um canal privado.

## Login Google

O fluxo Google está preparado com PKCE, troca do código de uso único e conferência de associação ao casal antes de manter a sessão. O botão aparece somente quando o provedor Google estiver habilitado nas configurações públicas do projeto Supabase. A configuração externa do provedor não é alterada por este código.

Para habilitar com um cliente Google já existente, acrescente o callback `https://yaydshjqhfzrilxbdegv.supabase.co/auth/v1/callback` aos endereços autorizados desse cliente no Google Cloud, preservando os endereços dos outros aplicativos. Configure o Client ID e o Client Secret no provedor Google do projeto AeroPing. Em URL Configuration do Supabase, configure `https://ricardobsanti.github.io/aeroping/` como Site URL e como redirect permitido. O segredo nunca deve ser colocado no repositório.

O ajuste de banco em `supabase/google-enrollment.sql` já foi aplicado ao projeto. Novas contas Google só recebem acesso quando o endereço confirmado pela identidade do provedor tem um convite privado ativo. Metadados editáveis pelo usuário não autorizam acesso. Contas já cadastradas continuam exigindo sua associação ao casal.

O nome e a foto da conta Google aparecem no cabeçalho, no menu lateral e nos ajustes. O app atualiza os dados do perfil ao abrir uma sessão existente. Contas sem foto mostram as iniciais; imagens indisponíveis também retornam às iniciais. Esses dados são apenas de apresentação e não concedem permissões.

O esquema está em `supabase/schema.sql`, e a função em `supabase/functions/enroll/index.ts`. O SQL é um registro da estrutura já criada: não o execute novamente sobre o projeto existente. A criação do primeiro casal e de seu convite é feita separadamente, sem guardar e-mail ou token no repositório.

Fotos: Unsplash. Fontes: Google Fonts (DM Sans e Manrope).

## Busca e monitoramento no servidor

Os arquivos supabase/flight-monitoring.sql, light-schedule.sql, light-push.sql e light-private-policies.sql registram alterações já aplicadas. Não os execute novamente no projeto existente. A função light-search valida a sessão no Auth e a associação ao casal antes de aceitar buscas. Cache, cotas, fila, chaves de agendamento e chaves de notificações ficam no esquema privado. Funções internas só são executáveis pelo servidor. O agendamento usa pg_cron e pg_net, com credencial aleatória privada. Não depende do computador ficar ligado. A pausa do plano gratuito ou indisponibilidade de fontes pode interromper as consultas.

Preços automáticos são totais de ida e volta para dois adultos, divididos por dois para comparação com a meta. O preço da opção de volta já é o pacote completo e nunca é somado ao preço do pacote de ida. Salvamentos automáticos incrementam a revisão compartilhada; clientes antigos não sobrescrevem o histórico em segundo plano. Alertas repetidos no mesmo patamar são suprimidos. O histórico guarda até 365 consultas por radar e 500 eventos.

A fonte e as licenças estão documentadas em supabase/functions/_shared/THIRD-PARTY.md. Verificação: 25 testes locais, buscas reais nacionais e internacionais no servidor, autenticação, isolamento, cache, agendamento HTTP, histórico, conflito de revisão e bagagem pendente. A entrega de notificações depende da permissão e do serviço de push de cada aparelho.

## Criação simples de ping

O formulário principal pede só cidade de destino, ida e volta. A cidade de origem é lembrada no espaço compartilhado e pode ser alterada em uma seção recolhida. Os aeroportos são definidos automaticamente a partir da localidade; os resultados mostram os nomes completos. A base de cidades e aeroportos é um recorte de serviços regulares de [OurAirports](https://ourairports.com/data/), em domínio público, atualizado nesta versão em 5 de novembro de 2026. O aeroporto principal da localidade é selecionado automaticamente; esta versão não compara todos os aeroportos de uma região. Cidades ambíguas exigem escolher a sugestão com estado e país.

Preço-alvo e preferências ficam em Mais opções. Sem preço manual, a primeira cotação estabelece a referência e o aviso ocorre com queda de pelo menos 10%. A referência permanece fixa para evitar alvos móveis. Também é possível criar um ping com um clique a partir de uma oferta. Os radares e metas personalizados anteriores são preservados. O nome padrão do segundo viajante passou a Viajante 2, mantendo nomes personalizados. O arquivo simple-pings.sql registra a alteração de banco já aplicada.

## Meta e margem no formulário principal

A criação e a edição de pings agora exibem valor máximo por pessoa e margem percentual acima desse valor, junto ao destino e às datas. Os dois campos são obrigatórios; novos pings não substituem a escolha do usuário por uma meta automática. Criar ping a partir dos resultados também abre esse formulário. Exemplo: R$ 800 por pessoa, margem de 10%, aviso até R$ 880; o alvo continua R$ 800. Pings antigos podem ser editados para adotar uma meta manual.

A fonte pública às vezes devolve uma página normal sem os dados de tarifas. O adaptador permite uma única nova tentativa nessa condição específica, com limite global de tempo. Restrições HTTP, consentimento e desafios não são contornados. Falhas isoladas em combinações de retorno preservam os itinerários válidos e indicam resultados parciais; nenhum preço é inferido. Testes: 30 verificações locais, mais busca nova real GRU–SSA de 23 a 25/01/2027 no servidor.

## Ícone adaptável

A marca usa um avião vetorial centralizado, com fundo mostarda opaco em toda a área. O SVG é a fonte visual; as versões PNG de 192 e 512 pixels são destinadas ao sistema operacional. O manifesto declara entradas separadas any e maskable, e o símbolo cabe na zona circular segura. Não há moldura escura nem cantos transparentes no arquivo. Nomes versionados atualizam os recursos do site; ícones de aplicativos já instalados dependem também da atualização pelo navegador e pelo lançador do aparelho.

## Tela principal e compra

A tela inicial concentra os pings em cartões com foto, rota, datas, preço, meta, margem e ação de compra. Banner promocional, estatísticas grandes e blocos repetidos foram retirados. Os detalhes têm capa do destino, preço por pessoa e total para dois adultos, cartões independentes de ida e volta, dados de bagagem e histórico recolhido.

Ir para a compra usa o link exato da última cotação com URL válida, sem inventar tarifa ou direcionamento. Para consultas automáticas, abre o itinerário selecionado no Google Voos, que apresenta as opções de reserva. O preço é comparado explicitamente com a meta; links de compra não afirmam que uma oferta acima do alvo está dentro do orçamento. Históricos sem URL não ganham botões falsos. Os detalhes de voos só aparecem se o itinerário corresponde à rota, às datas e à cotação atual.

As miniaturas são gratuitas, obtidas pelo PageImages da Wikipédia e pelos metadados do Wikimedia Commons, com filtro de conteúdo livre e crédito de autor/licença junto à imagem. O aplicativo guarda apenas o endereço e a atribuição em cache público local por sete dias. A foto é decorativa e não interfere na consulta de passagens; sem imagem disponível, mostra uma capa neutra. As imagens têm recorte visual para o formato do cartão.
