# CakeBoss — Arquitetura (Fase 2)

Data: 01/11/2026 · Branch `saas` · Ponto de restauração: tag `restauracao-fase1`

Este documento define **como o CakeBoss vai funcionar por dentro** para atender várias confeitarias com segurança. As migrações do banco estão escritas em `supabase/migrations/` e **ainda não foram aplicadas** no Supabase de verdade — foram testadas num banco local descartável (ver "Como foi testado").

---

## 1. Visão geral

```
                ┌────────────── Vercel (1 projeto, site estático) ──────────────┐
 Visitante  ──▶ │  /            landing page do CakeBoss                         │
 Confeitaria ─▶ │  /painel/...  painel da confeitaria (login)                    │
 Comprador  ──▶ │  /loja/:slug  loja de cada confeitaria (mesmo código p/ todas) │
                └──────────────────────────────┬────────────────────────────────┘
                                               │ supabase-js (chave publicável)
                ┌──────────────────────────────▼────────────────────────────────┐
                │ Supabase (1 projeto para todas as confeitarias)                │
                │  Postgres + RLS · Auth · Storage (fotos) · Realtime            │
                │  Edge Functions: checkout, pagamentos, webhooks, assinaturas   │
                └──────────────┬─────────────────────────────┬──────────────────┘
                               │                             │
                  Mercado Pago / Stripe            Gateway de assinaturas do
                  (conta de CADA confeitaria)      CakeBoss (desconfigurado)
```

- **Um app, um banco, um projeto na Vercel.** Nada é duplicado por cliente; o que separa as confeitarias é o `workspace_id` em cada linha e as regras de acesso do banco.
- **Continua Vite + React.** O painel já é um app de página única que funciona bem; reescrever em outro framework seria só custo.
- **Tudo que exige confiança roda no servidor** (Edge Functions do Supabase): cálculo do preço no checkout, criação do pagamento, tokens das contas conectadas, webhooks e assinaturas. O navegador só tem a chave publicável.

## 2. Contas e papéis

| Quem | Como entra | O que acessa |
|---|---|---|
| **Dona** (`owner`) | Supabase Auth | Tudo da própria confeitaria, inclusive plano e pagamentos |
| **Administrador** (`admin`) | Supabase Auth, convidado | Igual à dona, menos transferir a confeitaria |
| **Funcionária** (`staff`) | Supabase Auth, convidada | Usa o painel; não exclui registros, não mexe em loja, plano nem pagamentos |
| **Comprador** | Supabase Auth (e-mail/senha ou Google) | Só o próprio perfil, pedidos, pagamentos e conversas — em qualquer loja |
| **Administrador da plataforma** | Tabela `platform_admins` (só via SQL) | Concessões de teste de plano; nunca pela API pública |

A mesma pessoa pode ser dona de uma confeitaria e compradora em outra: o que define o acesso é a participação (`workspace_members`) ou o perfil de comprador (`shoppers`), nunca um campo enviado pelo navegador.

## 3. Modelo de dados

Arquivos: `supabase/migrations/20261101000100` a `…0800`.

| Área | Tabelas |
|---|---|
| Confeitaria | `workspaces` (+ slug, responsável, telefone, CPF/CNPJ, endereço, logo, horários), `workspace_members`, `workspace_settings` |
| Planos e assinaturas | `saas_products`, `plans`, `subscriptions`, `billing_events`, `platform_admins` |
| Insumos e estoque | `ingredients`, `materials`, `stock_movements`, `purchases` |
| Catálogo | `categories`, `recipes` (ficha técnica + dados de vitrine), `cake_products`, `simulations`, `productions` |
| Clientes | `customers` (da confeitaria), `shoppers` (contas da loja, valem em todas as lojas) |
| Pedidos | `orders`, `order_items`, `order_counters` |
| Financeiro | `transactions`, `activity_log` |
| Loja | `store_settings` (agenda, retirada, entrega, capacidade), `delivery_zones` |
| Pagamentos das lojas | `payment_connections`, `payments`, `private.payment_credentials`, `private.payment_events`, `private.oauth_states` |
| Atendimento (Plus) | `conversations`, `messages`, `notifications` |
| Segurança | `private.audit_log` |

Decisões:
- **Chave `(workspace_id, id)`** em todas as tabelas de dados. Os ids continuam texto, como no app atual, então a migração não precisa renomear referências dentro das fichas técnicas.
- **Composição da ficha técnica e opções da vitrine em `jsonb`** dentro da própria linha: são editadas sempre juntas e nunca consultadas por partes. O resto vira coluna.
- **Dinheiro em `numeric(12,2)`**, igual ao que o app já calcula (os centavos ficam exatos no banco).
- **Fotos no Storage** (`store-media/<workspace_id>/…`), nunca dentro das tabelas.
- **Indicadores do dashboard são calculados a partir dos lançamentos e pedidos** já existentes; não há tabelas de "cópia" para gráficos.

### Pedidos: produção e pagamento separados

- `production_status`: `orcamento`, `aguardando` (pedido da loja esperando a confeitaria aceitar), `confirmado`, `em_preparo`, `pronto`, `saiu_entrega`, `concluido`, `cancelado`.
- `online_payment_status`: `nao_se_aplica`, `pendente`, `aprovado`, `recusado`, `reembolsado` — **só o servidor altera** (webhook do gateway).
- Pagamentos manuais (dinheiro, Pix direto) continuam como lançamentos em `transactions`. "Pago / parcial / a receber" no painel = pagamentos online aprovados + lançamentos manuais do pedido.
- Pagar um pedido nunca muda a produção sozinho.
- O **número do pedido** é dado pelo banco (`order_counters`), sem repetição entre aparelhos.
- Pedidos da loja: preço, itens, taxa e desconto não podem ser alterados no painel depois de criados.

Conversão dos status atuais: `em_producao → em_preparo`, `entregue → concluido`; os demais mantêm o nome.

## 4. Segurança (RLS)

Toda tabela tem Row Level Security. As funções de checagem ficam no schema `private` (fora da API):

- `private.is_member(ws)`, `private.member_role(ws)`, `private.is_manager(ws)` — participação e papel de quem está logado.
- `private.workspace_features(ws)` / `private.has_feature(ws, recurso)` — recursos liberados pela **assinatura corrente**.

Regras principais:
- Membros leem e gravam só a própria confeitaria; gravar exige o recurso `gestao` (todos os planos pagos).
- Excluir: só dona/administrador. Movimentações de estoque e histórico: só acrescentar.
- `plan`, assinatura, número do pedido, status de pagamento online e lançamentos `source = 'gateway'` **não podem ser gravados pelo navegador** (sem permissão de coluna ou sem policy).
- Publicar a loja exige o recurso `loja`; mensagens exigem `mensagens`.
- Compradores veem só os próprios pedidos, itens, pagamentos e conversas.
- A vitrine pública sai de **uma função**, `get_store(slug)`, que devolve só campos de vitrine (nada de custos, fichas, clientes ou financeiro), e só se a loja estiver ligada e o plano permitir.

## 5. Planos e assinaturas

| Plano | Preço | Recursos |
|---|---|---|
| Básico | R$ 39,90/mês | `gestao` |
| Premium | R$ 79,90/mês | `gestao`, `loja`, `pagamentos_online` |
| Plus | R$ 129,90/mês | + `mensagens`, `relatorios_avancados` |

- Preços e recursos ficam **só na tabela `plans`**. Mudar um preço é um `UPDATE`; o app e a landing leem de lá.
- Estados da assinatura: `trialing`, `billing_not_configured`, `pending_payment`, `active`, `past_due`, `canceled`, `expired`, `test_grant`.
- **Teste grátis (decidido em 01/11):** a primeira escolha de plano de cada confeitaria abre **14 dias de teste** do plano escolhido (`trialing`). Dá para trocar de plano durante o teste sem mudar a data de fim. É uma vez por confeitaria e nunca aparece como pago. Ao vencer, os recursos pagos param (os dados continuam guardados e visíveis) até haver assinatura paga.
- **Cobrança do CakeBoss desconfigurada (decisão do proprietário):** depois do teste, `choose_plan` registra o plano escolhido como `billing_not_configured`, que **não libera recursos pagos** e nunca aparece como pago. A ativação real só acontece quando a Edge Function de cobrança receber a confirmação do gateway, depois de você configurar suas credenciais.
- **Testes de plano:** só por concessão administrativa (`test_grant`), com motivo e autor obrigatórios, feita por quem está em `platform_admins`. Não existe caminho público para isso.
- **Upgrade/downgrade:** upgrade cobra a diferença pelo gateway; downgrade fica agendado (`scheduled_plan_code`) para a renovação. Cancelamento: `cancel_at_period_end`.
- **Futuro painel financeiro central:** `saas_products.code = 'cakeboss'` + `subscriptions` + `billing_events` (valor, status, provedor, id da transação, reembolsos, cancelamentos, datas). Sem exposição pública; quando for feito, será uma API administrativa autenticada. Os recebimentos das confeitarias (`payments`) ficam em tabelas separadas e nunca se misturam com a receita do CakeBoss.

## 6. Pagamentos das lojas

- **Mercado Pago (recomendado):** OAuth do Mercado Pago. A confeitaria clica em "Conectar", autoriza no site do Mercado Pago e volta; a Edge Function troca o código por tokens e guarda **no Supabase Vault**. Os pagamentos são criados com o token da própria confeitaria, então o dinheiro cai na conta dela. Sem comissão (`marketplace_fee` zero).
- **Stripe:** Stripe Connect com contas conectadas. **Pendente de verificação:** se o Connect atende confeitarias brasileiras no modelo desejado. Se não atender, a Stripe fica pronta mas desativada.
- **Fluxo do pagamento:** checkout (servidor) → cria pedido `aguardando` + pagamento `pendente` → comprador paga no checkout oficial do gateway (Pix/cartão; nenhum dado de cartão passa pelo CakeBoss) → webhook com assinatura verificada → consulta o pagamento no provedor → grava uma vez só (chave única em `payment_events`) → pedido `aprovado` + lançamento `gateway` no financeiro + aviso em tempo real no painel.
- **Sem gateway conectado:** a loja funciona, mas o checkout não oferece pagamento online (`get_store` devolve `online_payment: null`); o painel mostra o aviso e o caminho para conectar.
- Modo **teste** (sandbox) e **produção** separados por conexão (`mode`).

## 7. Checkout no servidor

Edge Function `checkout`, chamada pelo comprador logado:

1. Encontra a loja pelo slug e confere plano e loja ligada.
2. Lê produtos, opções, bolos e zonas **do banco** — preços enviados pelo navegador são ignorados.
3. Calcula subtotal, taxa de entrega e total com as mesmas regras de `src/lib/shop.ts` e `src/lib/cake.ts` (o código é compartilhado com a função).
4. Valida a data/horário contra a agenda: antecedência, dias fechados, horários da semana e capacidade.
5. Cria cliente (vinculado ao comprador), pedido, itens e, se for pagamento online, a preferência no gateway.
6. Devolve o link do checkout oficial ou a confirmação (retirada com pagamento na loja).

O carrinho fica no navegador **separado por loja** (`cakeboss:carrinho:<slug>`).

## 8. Como o app muda (sem reescrever as telas)

Hoje todas as telas usam `useStore()` sobre um objeto `DB` em memória. Isso continua:

- **Carga:** ao abrir, o app busca as tabelas da confeitaria e monta o mesmo `DB`.
- **Gravação por diferença:** cada ação continua alterando o `DB` em memória; uma camada de sincronização compara antes/depois e grava **só as linhas que mudaram** (insert/update/delete), em lote, com repetição em caso de falha de rede.
- **Tempo real:** pedidos e pagamentos novos chegam pelo Realtime e entram no `DB` sem recarregar.
- **Conflitos:** a unidade de conflito passa a ser a linha, não a confeitaria inteira — dois aparelhos editando coisas diferentes não se atrapalham mais.
- **Transição:** as migrações copiam o bloco atual para as tabelas e mantêm `workspace_data` como cópia de segurança. O arquivo `migrations/later/…0900` (remover o bloco e a coluna `plan`) só é aplicado depois que o app novo estiver publicado e conferido.

> Atenção: a migração 0700 copia os dados **no momento em que é aplicada**. Por isso ela deve ser aplicada junto com a publicação da camada de sincronização (Fase 7), não antes.

## 9. Hospedagem e custos

| Serviço | Uso | Observação |
|---|---|---|
| Vercel | Site estático, subdomínio `.vercel.app` | Uso comercial exige plano pago (confirmar regras atuais) |
| Supabase | Banco, Auth, Storage, Realtime, Edge Functions | Plano gratuito pausa projetos parados e não tem backup diário; para vender, o Pro é o recomendado |
| E-mail (ex.: Resend) | E-mails de login e avisos | O servidor de e-mail padrão do Supabase tem limite baixo por hora |
| Mercado Pago / Stripe | Pagamentos | Taxas do gateway ficam com cada confeitaria |

Economia: um projeto de cada; consultas por índice começando em `workspace_id`; vitrine numa única chamada; paginação de pedidos e lançamentos por período; fotos comprimidas antes do envio (limite de 3 MB); retenção de 400 dias para a auditoria. **Limites por plano** (fotos, produtos, membros) ficam preparados para configuração, mas nenhum foi definido sem a sua aprovação.

## 10. Como foi testado

- `supabase/tests/00_supabase_stub.sql` imita o mínimo do Supabase (papéis, `auth.uid()`, Storage) num Postgres 17 em Docker, com o estado atual do projeto e duas confeitarias de teste.
- `supabase/tests/10_isolation_test.sql` roda 10 verificações — **todas passaram**:
  1. migração dos dados antigos (números, totais, status, slug, plano → concessão);
  2. uma confeitaria não lê dados da outra;
  3. nem grava, mesmo informando o `workspace_id` da outra;
  4. ninguém muda o próprio plano, aprova pagamento online, cria assinatura ou lançamento de gateway;
  5. pedido do painel recebe número do banco;
  6. Básico não publica loja;
  7. funcionária não exclui nem mexe em pagamentos;
  8. vitrine pública não expõe fichas, custos ou clientes, e não oferece pagamento online sem gateway;
  9. comprador vê só os próprios pedidos;
  10. conta nova ganha 14 dias de teste uma vez só; vencido o teste e sem cobrança, nada pago fica liberado nem é gravado, e o teste nunca vira "pago".

Para repetir:

```bash
docker run -d --name cakeboss-pgtest -e POSTGRES_PASSWORD=teste postgres:17-alpine
cat supabase/tests/00_supabase_stub.sql supabase/migrations/2026110100*.sql | docker exec -i cakeboss-pgtest psql -U postgres -v ON_ERROR_STOP=1 -q
docker exec -i cakeboss-pgtest psql -U postgres -q < supabase/tests/10_isolation_test.sql
docker rm -f cakeboss-pgtest
```

## 11. Decisões que dependem de você

1. ~~Acesso de quem acaba de criar conta~~ — **decidido: teste grátis de 14 dias** (seção 5).
2. **Contas que já existem** (a sua e a da sua esposa): a migração dá uma concessão explícita do plano equivalente (`loja → Premium`). Se quiser outro plano para elas, é só dizer.
3. **Stripe no Brasil** — confirmar antes da Fase 9.
4. **Credenciais de teste** do Mercado Pago (aplicativo de desenvolvedor) para a Fase 9.
5. **Plano de hospedagem** (Vercel/Supabase pagos) antes de abrir para clientes reais.
