# CakeBoss — Auditoria do código (Fase 1)

Data: 31/10/2026 · Pasta: `Loja Le/docegestao` · Branch: `visual-dinamico` (último commit `9570c41`)

Esta auditoria foi feita **sem alterar nenhum arquivo do sistema**. Ela descreve o estado real do código hoje, inclusive o trabalho ainda não commitado das outras sessões (login, cores, loja com rolagem).

---

## 1. Tecnologias encontradas

| Área | O que existe |
|---|---|
| Base | Vite 6 + React 19 + TypeScript 5.8 (app de página única, sem servidor próprio) |
| Estilo | Tailwind 3 com cores em variáveis CSS (`--pink`, `--lilac`…), tema claro/escuro |
| Fontes | Figtree (texto) e Bricolage Grotesque (títulos), embutidas no app |
| Animação | `motion` 14 (Motion for React) |
| Gráficos | Recharts 3 |
| Ícones | lucide-react |
| Rotas | react-router-dom 7 |
| Nuvem | `@supabase/supabase-js` 2 — projeto `cakeboss-studio` (São Paulo, plano gratuito) |
| 3D | `three` + `@react-three/fiber` — **instalados mas não usados mais** (ver 4.3) |
| Testes | Vitest — 39 testes, todos de regras de cálculo |

Skills disponíveis e que serão usadas: **design-taste-frontend** (Taste Skill), **ui-ux-pro-max**, **impeccable**, além de **emil-design-eng** para movimento. Todas estão instaladas.

## 2. Rotas e telas

**Públicas:** `/entrar`, `/criar-conta`, `/esqueci-senha`, `/redefinir-senha`, `/loja` (+ `/loja/finalizar`, `/loja/conta`).
**Painel (exige login):** `/` Dashboard, `/pedidos`, `/clientes`, `/financeiro`, `/loja-online`, `/fichas` e `/fichas/:id`, `/producoes`, `/estoque`, `/ingredientes`, `/materiais`, `/compras`, `/assistente`, `/custos`, `/historico`, `/configuracoes`.
**Não existe:** landing page do SaaS, escolha de plano, Configurações → Pagamentos, central de mensagens, área do comprador com várias lojas.

## 3. O que já funciona (e será reaproveitado)

- **Precificação** (`lib/pricing.ts`, testada): custo real com ingredientes, embalagens, gás (botijão ou encanado), energia, água, mão de obra, rateio de custos fixos, perdas, taxas; preço mínimo e sugerido; simulador de cenários. **É o coração do produto e está sólido.**
- **Fichas técnicas** e **bolos de aniversário montados** (massa/recheio/cobertura por tamanho).
- **Pedidos:** orçamento → confirmado → produção → pronto → entregue; custo congelado na confirmação; baixa de estoque ao entrar em produção; pagamentos parciais com taxa do cartão; lista e quadro (arrastar e soltar).
- **Estoque e compras:** compra soma ao estoque e lança no financeiro; aviso de estoque baixo; histórico de preços.
- **Financeiro:** entradas, saídas, a receber, lucro dos entregues, gráficos.
- **Clientes:** ficha com total comprado, ticket médio, favoritos.
- **WhatsApp:** mensagens prontas preenchidas com dados do pedido (abre o WhatsApp do aparelho; não é automático).
- **Painel:** busca rápida (Ctrl+K), "Para hoje", cores da marca por confeitaria, tema escuro, mascotes, backup/restauração.
- **Login do painel** (Supabase Auth): criar conta, confirmar e-mail, entrar, esqueci/redefinir senha, sair. Cada conta cria **uma** confeitaria; os dados ficam na nuvem com controle de versão.
- **Loja:** cardápio, opções com preço, monte seu bolo, carrinho, cadastro, checkout com entrega/retirada por cidade e taxa, prazo mínimo, nova abertura com fotos e rolagem.
- **Verificações:** TypeScript sem erros · 39/39 testes · lint sem erros (20 avisos) · build OK.

## 4. Problemas encontrados

### 4.1 Críticos (impedem vender o produto)

1. **A loja e o painel estão desligados um do outro.** Depois do login, o painel lê os dados da nuvem, mas a loja (`/loja`) continua lendo e gravando **só no navegador**. Resultado: um pedido feito na loja **nunca chega** ao painel da confeitaria, e a loja mostra produtos e preços do navegador, não os da conta. Antes do login os dois dividiam o mesmo navegador, então isso é uma **regressão** recente.
2. **Toda a confeitaria é salva como um único bloco** (`workspace_data.data`, JSON). Funciona para uma pessoa usando o painel, mas **não serve para um SaaS com loja pública**:
   - um comprador não pode ver só os produtos sem receber o bloco inteiro (custos, clientes, financeiro);
   - um aviso de pagamento do Mercado Pago/Stripe não tem como marcar "pago" em um pedido sem regravar tudo;
   - duas pessoas ou dois aparelhos salvando juntos: o segundo **perde a alteração** (o sistema recarrega a versão da nuvem e só avisa);
   - o banco não valida nada: qualquer membro pode gravar valores, pedidos pagos ou histórico financeiro arbitrários.
3. **Preços e totais são calculados só no navegador.** Na loja, o cliente consegue alterar o valor do pedido antes de enviar. O prompt exige cálculo no servidor — hoje não existe servidor.
4. **Contas dos compradores são de demonstração**: ficam no `localStorage` do aparelho (senha com hash PBKDF2, mas no navegador). Não funcionam em outro aparelho e não existem para a confeitaria.
5. **Pagamento online não existe.** "Mercado Pago" é só um texto: o link é mandado à mão pelo WhatsApp. Não há OAuth, Stripe, webhooks nem status de pagamento confirmado.
6. **Planos:** o banco tem `plan` = `basico | loja | completo`, sem preços, sem assinatura, sem histórico de cobrança e **sem nenhuma permissão aplicada** (o painel ainda mostra tudo para todos).

### 4.2 Importantes

7. **Status de pagamento e de produção estão misturados.** O pedido tem um único status (`orcamento, confirmado, em_producao, pronto, entregue, cancelado`); o pagamento é deduzido dos lançamentos (pago/parcial/a receber). Faltam: *aguardando confirmação*, *saiu para entrega*, *recusado*, *reembolsado*.
8. **Número do pedido** é calculado no navegador (`maior número + 1`): dois aparelhos podem gerar o mesmo número.
9. **Fotos dos produtos são guardadas dentro dos dados** (imagem em texto base64 no JSON). Isso incha cada salvamento e o banco. Devem ir para o Storage.
10. **Loja única:** não há endereço por confeitaria (`/loja/nome-da-confeitaria`), nem logo/banner/horário por loja.
11. **Entrega e retirada:** horários fixos 9h–18h no código; não há dias de funcionamento, feriados, capacidade por dia, nem bloqueio de datas fechadas.
12. **Estoque pode ficar negativo** e excluir uma produção não devolve o estoque (é avisado, mas não há movimentação registrada).
13. **Sem papéis reais:** existe `owner`/`staff` no banco, mas nenhuma regra diferencia os dois.
14. **Proteção contra senhas vazadas** desligada no Supabase (alerta do próprio Supabase).
15. **E-mails do login** usam o servidor de e-mail padrão do Supabase, que tem limite baixo de envios por hora — não serve para produção sem um serviço de e-mail próprio.

### 4.3 Desempenho, acessibilidade e manutenção

16. **JavaScript principal de 1,47 MB (431 kB compactado)**: todas as telas do painel, gráficos e o Supabase carregam de uma vez. No celular, a primeira abertura é lenta. Precisa dividir por rota.
17. **Código morto:** `shop/Hero3D.tsx` e as bibliotecas `three`/`@react-three/fiber` não são mais usadas. Imagens duplicadas em `public/auth` e `public/loja`; vídeo de 1,8 MB na loja.
18. **Acessibilidade:** boa base (rótulos, foco visível, `prefers-reduced-motion` respeitado, imagens com `alt`). Falta revisão completa de contraste nas cores personalizadas da loja e navegação por teclado no quadro de pedidos (hoje há botão alternativo, ok).
19. **Testes:** só cobrem cálculos. Não há testes de salvamento, permissões, checkout nem testes ponta a ponta.
20. **Lint:** 20 avisos `react-refresh` (arquivos que exportam componentes e funções juntos) — sem impacto em produção.
21. **Trabalho não salvo:** há ~35 arquivos alterados/novos de três sessões **sem commit**. Antes de qualquer mudança grande é preciso criar o ponto de restauração.

## 5. Dados fictícios e dados só no navegador

| Item | Onde fica hoje |
|---|---|
| Dados de exemplo (insumos e fichas marcados "exemplo") | Carregados só quando a pessoa pede; removíveis — ok |
| Dados do painel | Nuvem (bloco JSON) — ok para uso, inadequado para SaaS |
| Loja: produtos, pedidos, clientes | **Navegador** (`docegestao:db`) |
| Contas dos compradores e sessão | **Navegador** (`docegestao:loja:contas`) |
| Carrinho | Navegador — ok, mas deve ser separado por loja |
| Preferências (visão lista/quadro, mascote) | Navegador — ok |

## 6. O que reaproveitar, refatorar e construir

**Reaproveitar sem mudar:** `lib/pricing.ts`, `lib/cake.ts`, `lib/orders.ts` (regras), `lib/format.ts`, `lib/theme.ts`, componentes de UI (`ui.tsx`, `motion.tsx`), busca rápida, quadro de pedidos, editores de ficha e de bolo, telas de login, `DashboardPreview` (serve para a landing).

**Refatorar:**
- `store/store.tsx`: manter a mesma interface `useStore()` usada por todas as telas, mas trocar o "bloco único" por tabelas reais. Assim as telas mudam pouco.
- Pedidos: separar `status_pagamento` e `status_producao`.
- Loja: passar a ler do banco por `slug` da confeitaria e gravar pedidos via servidor.
- Divisão do código por rota e remoção do 3D morto.

**Construir:** landing page, planos e assinaturas, controle de acesso por plano no banco, Configurações → Pagamentos (Mercado Pago e Stripe), checkout com cálculo no servidor e webhooks, contas de comprador reais, URLs por loja, agenda de entrega/retirada, central de mensagens (Plus), Storage de fotos, documentação.

## 7. Arquitetura proposta (resumo da Fase 2)

- **Continua Vite + React** (não vale reescrever em Next.js: o painel já existe e funciona bem como app de página única).
- **Supabase** como base única para todas as confeitarias: Postgres com `tenant_id` + **RLS** em todas as tabelas, Auth para donos e compradores, **Storage** para fotos, **Realtime** para mensagens e pedidos novos.
- **Supabase Edge Functions** para tudo que exige segredo ou confiança: criar pedido com preço calculado no servidor, OAuth do Mercado Pago e Stripe Connect, criação de pagamento, **webhooks** com verificação de assinatura e idempotência, e o futuro gateway de assinaturas. Os tokens das contas conectadas ficam só no servidor (Supabase Vault).
- **Vercel** apenas para servir o site (um projeto só, todas as lojas em `/loja/:slug`).
- **Planos em tabela** (`plans`: código, nome, preço, recursos) + `subscriptions` + `billing_events`, com `product_code = 'cakeboss'` para o futuro painel financeiro central. Permissões verificadas por função no banco (`has_feature(tenant, 'loja')`), nunca só no front.
- **Assinatura do CakeBoss:** estrutura completa com estado explícito "cobrança não configurada"; planos de teste só por concessão administrativa marcada como teste.

## 8. Pontos que dependem de você

1. **Credenciais de teste (sandbox)** para a Fase 9: um aplicativo de desenvolvedor no Mercado Pago (para o "Conectar Mercado Pago" das confeitarias) e uma conta Stripe em modo teste com Connect. São credenciais de teste do CakeBoss, não a sua conta de recebimento.
2. **Stripe para confeitarias brasileiras:** é preciso confirmar na documentação atual da Stripe se o Connect atende contas conectadas no Brasil no modelo que queremos; se não atender, o Mercado Pago fica como único gateway e a Stripe fica preparada.
3. **Custos de produção a confirmar nas regras atuais:** o plano gratuito da Vercel não permite uso comercial (precisa do Pro); o plano gratuito do Supabase pausa projetos parados e não tem backup diário (para vender, o Pro é o recomendado); um serviço de e-mail (ex.: Resend) para os e-mails de login.
4. **Páginas legais** (Termos de Uso e Política de Privacidade/LGPD) precisam dos dados da sua empresa (razão social, CNPJ, contato).
5. **Ordem das fases** — ver abaixo.

## 9. Ordem recomendada

O prompt coloca o banco (Fase 7) depois do redesign do painel e da loja. Recomendo **antecipar a base de dados**, porque a loja por confeitaria, o checkout e os pagamentos dependem dela, e redesenhar telas em cima do modelo antigo seria retrabalho:

1. **Ponto de restauração** (commit do estado atual em uma branch própria).
2. **Fase 2** — arquitetura detalhada e modelo de dados (documento + migrações revisadas antes de aplicar).
3. **Fase 3** — design system (as três skills).
4. **Fase 4** — landing page com os três planos (não depende do banco; pode correr em paralelo).
5. **Fase 7 → 8** — banco multi-tenant, migração dos dados atuais, permissões e planos.
6. **Fases 5 e 6** — painel e loja redesenhados já sobre o banco novo.
7. **Fases 9 → 10 → 11** — pagamentos, checkout, mensagens.
8. **Fases 12 e 13** — refinamento e testes.

Cada fase termina com commit próprio, testes e verificação no navegador, e cada módulo será classificado como *Implementado e testado*, *Aguardando credenciais*, *Parcial* ou *Pendente*.
