# AeroPing

Radar de viagens para o casal: metas de preço, histórico de cotações, comparação de milhas e decisões compartilhadas. Interface responsiva com instalação na tela inicial.

## Estado da versão

- Radares com origem, destino, datas, bagagem, conexões e margem de preço.
- Registro manual de cotações por pessoa, ida e volta; orçamento para dois adultos.
- Histórico e alertas calculados sobre cotações registradas.
- Comparador dinheiro versus milhas, incluindo taxas e custo do milheiro.
- Decisões de cada viajante, exportação e restauração de backups.
- Login por senha e ativação por convite privado, de uso único e válido por 7 dias.
- Banco compartilhado no Supabase: dois membros por casal, com isolamento por RLS.
- Sincronização de alterações, conferência de atualizações a cada 30 segundos com o app aberto e detecção de conflitos.
- Convite para o segundo viajante pelo painel de ajustes, sem envio automático de mensagens.
- Prévia de compartilhamento com Open Graph e imagem PNG de 1200 × 630 pixels.

**Ainda não há consultas automáticas a companhias aéreas, disponibilidade real, previsão por IA, emissão, WhatsApp ou monitoramento com o app fechado.** Os exemplos não são ofertas. A disponibilidade e as regras devem ser verificadas na fonte.

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

Nenhum serviço pago é ativado por este código. GitHub Pages atende a publicação estática em repositórios públicos no GitHub Free. O Supabase Free pode atender o uso inicial do casal, dentro dos limites do plano e sujeito a pausas por inatividade. Uma futura fonte de preços reais precisa ser avaliada separadamente, com limites de requisições e bloqueio de gastos.

- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Supabase Free](https://supabase.com/pricing)
- [Pausas do Supabase Free](https://supabase.com/docs/guides/platform/free-project-pausing)

## Dados e segurança

Use somente chave Supabase pública publishable/anon no cliente. Nunca use `service_role`, `sb_secret_`, senha do banco ou token de gerenciamento no frontend. Não armazene CPF, passaporte, cartão ou documentos neste app.

O banco é a fonte principal dos dados. A cópia local ajuda durante falhas temporárias de rede; mantenha o app aberto até as alterações serem sincronizadas. O adaptador usa revisão otimista para detectar alterações concorrentes, sem sobrescrever silenciosamente o outro aparelho. A sessão persiste no navegador e pode ser encerrada pelos ajustes.

## Ativação dos dois acessos

O primeiro viajante recebe um link privado de ativação, separado do código público. Ele escolhe a própria senha (mínimo de 8 caracteres). Depois, em Ajustes, gera um convite para o e-mail do segundo viajante. Convites são credenciais privadas: não os coloque em issues, commits ou arquivos públicos. O hash fica em uma tabela privada; o token é validado pela função de servidor `enroll` antes de criar uma conta e associá-la ao casal. O endpoint faz a própria autenticação por convite e não recebe uma sessão de usuário existente. As funções privilegiadas de cadastro só podem ser executadas pela função de servidor.

Não existe cadastro público: o gatilho no Auth exige a marca de cadastro definida pela API administrativa da função `enroll`. O envio de e-mail não é necessário. O convite só permite cadastrar o endereço específico escolhido pelo primeiro viajante. O destinatário deve recebê-lo por um canal privado.

O esquema está em `supabase/schema.sql`, e a função em `supabase/functions/enroll/index.ts`. O SQL é um registro da estrutura já criada: não o execute novamente sobre o projeto existente. A criação do primeiro casal e de seu convite é feita separadamente, sem guardar e-mail ou token no repositório.

Fotos: Unsplash. Fontes: Google Fonts (DM Sans e Manrope).
