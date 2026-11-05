# AeroPing

Radar de viagens para o casal: metas de preço, histórico de cotações, comparação de milhas e decisões compartilhadas. Interface responsiva com instalação na tela inicial.

## Estado da versão

- Radares com origem, destino, datas, bagagem, conexões e margem de preço.
- Registro manual de cotações por pessoa, ida e volta; orçamento para dois adultos.
- Histórico e alertas calculados sobre cotações registradas.
- Comparador dinheiro versus milhas, incluindo taxas e custo do milheiro.
- Decisões de cada viajante, exportação e restauração de backups.
- Adaptador de autenticação e sincronização Supabase, aguardando configuração do banco.
- Exemplos identificados como demonstração e removíveis.

**Ainda não há consultas automáticas a companhias aéreas, disponibilidade real, previsão por IA, emissão, WhatsApp ou monitoramento com o app fechado.** Os exemplos não são ofertas. A disponibilidade e as regras devem ser verificadas na fonte.

## GitHub Pages

O fluxo `.github/workflows/pages.yml` verifica o código e as regras do radar antes de publicar `dist/`. Em Settings → Pages, a origem deve ser **GitHub Actions**.

O site e o código são públicos. Dados privados e credenciais não devem ser incluídos no repositório. Quando configurado, o Supabase mantém os dados do casal em banco separado, protegido por autenticação e RLS. O compartilhamento entre aparelhos só fica operacional depois da configuração e verificação do banco.

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

Antes do banco ser conectado, os registros ficam apenas no navegador; isso não substitui o requisito de acesso compartilhado do casal. Exporte um backup antes de limpar o armazenamento. O adaptador de nuvem usa revisão otimista para detectar alterações concorrentes.

Fotos: Unsplash. Fontes: Google Fonts (DM Sans e Manrope).
