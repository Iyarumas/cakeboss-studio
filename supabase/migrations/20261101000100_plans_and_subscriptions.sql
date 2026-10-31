-- CakeBoss · Fase 7/8 · Planos, assinaturas e permissões por plano
-- Não destrutiva: workspaces.plan só é removida na migração 20261101000900, depois da cópia para subscriptions.

-- ---------------------------------------------------------------------------
-- Produto SaaS (preparação para o futuro painel financeiro central)
-- ---------------------------------------------------------------------------
create table public.saas_products (
  code text primary key check (code ~ '^[a-z0-9_-]{2,40}$'),
  name text not null
);
insert into public.saas_products (code, name) values ('cakeboss', 'CakeBoss');

-- ---------------------------------------------------------------------------
-- Planos: preços e recursos num lugar só. Mudar preço = um UPDATE, sem tocar no código.
-- ---------------------------------------------------------------------------
create table public.plans (
  code text primary key check (code ~ '^[a-z0-9_]{2,30}$'),
  product_code text not null default 'cakeboss' references public.saas_products(code),
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'BRL',
  interval text not null default 'month' check (interval in ('month', 'year')),
  features text[] not null,
  sort integer not null default 0,
  active boolean not null default true
);

insert into public.plans (code, name, price_cents, features, sort) values
  ('basico',  'Básico',  3990,  array['gestao'], 1),
  ('premium', 'Premium', 7990,  array['gestao', 'loja', 'pagamentos_online'], 2),
  ('plus',    'Plus',    12990, array['gestao', 'loja', 'pagamentos_online', 'mensagens', 'relatorios_avancados'], 3);

alter table public.plans enable row level security;
alter table public.saas_products enable row level security;
-- vitrine de preços é pública (landing page)
create policy "planos são públicos" on public.plans for select to anon, authenticated using (active);
create policy "produtos são públicos" on public.saas_products for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Administradores da plataforma (o dono do CakeBoss). Só via SQL/painel do Supabase.
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- sem policies: nenhum usuário lê ou escreve pela API

-- ---------------------------------------------------------------------------
-- Assinaturas
--   billing_not_configured: plano escolhido, mas o CakeBoss ainda não cobra (sem acesso pago)
--   pending_payment:       aguardando o gateway confirmar
--   active / past_due / canceled / expired: estados do gateway
--   test_grant:            concessão administrativa explícita (teste ou cortesia), nunca "paga"
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_code text not null default 'cakeboss' references public.saas_products(code),
  plan_code text not null references public.plans(code),
  status text not null check (status in ('billing_not_configured', 'pending_payment', 'active', 'past_due', 'canceled', 'expired', 'test_grant')),
  provider text check (provider in ('mercadopago', 'stripe')),
  provider_subscription_id text,
  price_cents integer not null,
  currency text not null default 'BRL',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  -- mudança de plano agendada para a próxima renovação (downgrade)
  scheduled_plan_code text references public.plans(code),
  grant_reason text,
  granted_by uuid references auth.users(id) on delete set null,
  grant_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint test_grant_has_reason check (status <> 'test_grant' or (grant_reason is not null and granted_by is not null)),
  unique (provider, provider_subscription_id)
);
-- uma assinatura corrente por confeitaria
create unique index subscriptions_one_current on public.subscriptions(workspace_id) where status not in ('canceled', 'expired');
create index subscriptions_workspace_idx on public.subscriptions(workspace_id, created_at desc);

-- Cobranças e eventos de assinatura (histórico; base do futuro painel financeiro central)
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  product_code text not null default 'cakeboss' references public.saas_products(code),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  kind text not null check (kind in ('charge', 'refund', 'renewal', 'upgrade', 'downgrade', 'cancel', 'grant', 'status_change')),
  status text not null check (status in ('pending', 'approved', 'rejected', 'refunded', 'info')),
  amount_cents integer,
  currency text not null default 'BRL',
  provider text check (provider in ('mercadopago', 'stripe')),
  provider_event_id text,
  provider_transaction_id text,
  occurred_at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb,
  unique (provider, provider_event_id)
);
create index billing_events_subscription_idx on public.billing_events(subscription_id, occurred_at desc);
create index billing_events_product_idx on public.billing_events(product_code, occurred_at desc);

alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;

-- ---------------------------------------------------------------------------
-- Funções de autorização (schema private: fora da API, usadas pelas policies)
-- ---------------------------------------------------------------------------
create or replace function private.member_role(ws uuid)
returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.workspace_members m where m.workspace_id = ws and m.user_id = (select auth.uid());
$$;

create or replace function private.is_manager(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.member_role(ws) in ('owner', 'admin'), false);
$$;

-- Recursos liberados pela assinatura corrente. Sem assinatura válida: nenhum recurso pago.
create or replace function private.workspace_features(ws uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.features
      from public.subscriptions s
      join public.plans p on p.code = s.plan_code
     where s.workspace_id = ws
       and (
         s.status in ('active', 'past_due')
         or (s.status = 'test_grant' and (s.grant_expires_at is null or s.grant_expires_at > now()))
       )
     order by s.created_at desc
     limit 1
  ), array[]::text[]);
$$;

create or replace function private.has_feature(ws uuid, feature text)
returns boolean language sql stable security definer set search_path = '' as $$
  select feature = any(private.workspace_features(ws));
$$;

revoke all on function private.member_role(uuid), private.is_manager(uuid), private.workspace_features(uuid), private.has_feature(uuid, text) from public, anon;
grant execute on function private.member_role(uuid), private.is_manager(uuid), private.workspace_features(uuid), private.has_feature(uuid, text) to authenticated;

-- membros veem a assinatura e as cobranças da própria confeitaria; ninguém escreve pela API
create policy "membros leem assinatura" on public.subscriptions for select to authenticated using ((select private.is_member(workspace_id)));
create policy "gestores leem cobranças" on public.billing_events for select to authenticated using ((select private.is_manager(workspace_id)));

-- O painel pergunta "o que posso usar?" por aqui (o banco continua conferindo em cada policy)
create or replace function public.my_workspace_access(ws uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when not private.is_member(ws) then null else jsonb_build_object(
    'role', private.member_role(ws),
    'features', to_jsonb(private.workspace_features(ws)),
    'subscription', (
      select jsonb_build_object('plan', s.plan_code, 'status', s.status, 'period_end', s.current_period_end,
                                'cancel_at_period_end', s.cancel_at_period_end, 'is_grant', s.status = 'test_grant',
                                'grant_expires_at', s.grant_expires_at, 'scheduled_plan', s.scheduled_plan_code)
        from public.subscriptions s where s.workspace_id = ws and s.status not in ('canceled', 'expired')
       order by s.created_at desc limit 1)
  ) end;
$$;
revoke all on function public.my_workspace_access(uuid) from public, anon;
grant execute on function public.my_workspace_access(uuid) to authenticated;

-- Escolha de plano pelo dono. Enquanto não houver gateway de assinaturas, a escolha fica registrada
-- como 'billing_not_configured' e NÃO libera recursos pagos. A ativação real vem só do servidor.
create or replace function public.choose_plan(ws uuid, plan text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  p public.plans%rowtype;
  cur public.subscriptions%rowtype;
begin
  if not private.is_manager(ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into p from public.plans where code = plan and active;
  if not found then raise exception 'plano inválido' using errcode = '22023'; end if;
  select * into cur from public.subscriptions where workspace_id = ws and status not in ('canceled', 'expired') order by created_at desc limit 1;
  if found and cur.status in ('active', 'past_due', 'test_grant', 'pending_payment') then
    -- upgrade/downgrade de assinatura paga passam pelo gateway (Edge Function billing)
    raise exception 'troca de plano precisa do sistema de cobrança' using errcode = 'P0001';
  end if;
  if found then
    update public.subscriptions set plan_code = p.code, price_cents = p.price_cents, updated_at = now() where id = cur.id;
  else
    insert into public.subscriptions (workspace_id, plan_code, status, price_cents) values (ws, p.code, 'billing_not_configured', p.price_cents);
  end if;
  insert into public.billing_events (subscription_id, workspace_id, kind, status, amount_cents, detail)
  select id, ws, 'status_change', 'info', p.price_cents, jsonb_build_object('plano_escolhido', p.code, 'cobranca', 'nao_configurada')
    from public.subscriptions where workspace_id = ws and status = 'billing_not_configured';
  return 'billing_not_configured';
end;
$$;
revoke all on function public.choose_plan(uuid, text) from public, anon;
grant execute on function public.choose_plan(uuid, text) to authenticated;
