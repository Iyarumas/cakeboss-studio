-- CakeBoss · Fases 9 e 10 · Contas de pagamento das confeitarias (Mercado Pago / Stripe) e pagamentos dos pedidos
-- O dinheiro das vendas vai para a conta conectada da própria confeitaria. Sem comissão da plataforma.

-- Tokens das contas conectadas: schema privado, fora da API. Os valores ficam cifrados no Supabase Vault;
-- aqui guardamos só o id do segredo e a validade.
create table private.payment_credentials (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('mercadopago', 'stripe')),
  access_secret_id uuid,
  refresh_secret_id uuid,
  public_key text,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, provider)
);

-- "state" do OAuth: amarra o retorno do Mercado Pago/Stripe à confeitaria que pediu e expira em 15 min
create table private.oauth_states (
  state text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  user_id uuid not null,
  created_at timestamptz not null default now()
);

-- Pagamentos online dos pedidos (um pedido pode ter tentativas recusadas antes da aprovada)
create table public.payments (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  order_id text not null,
  provider text not null check (provider in ('mercadopago', 'stripe')),
  mode text not null check (mode in ('test', 'live')),
  provider_payment_id text,
  provider_checkout_id text,
  status text not null check (status in ('pendente', 'aprovado', 'recusado', 'reembolsado', 'cancelado')),
  method text,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'BRL',
  status_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, order_id) references public.orders(workspace_id, id) on delete restrict,
  unique (provider, provider_payment_id)
);
create index payments_order_idx on public.payments(workspace_id, order_id);

-- Notificações recebidas dos gateways: a chave única garante processamento uma vez só (idempotência)
create table private.payment_events (
  provider text not null,
  event_id text not null,
  workspace_id uuid,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text,
  primary key (provider, event_id)
);

alter table public.payment_connections enable row level security;
alter table public.payments enable row level security;

create policy "membros veem conexões" on public.payment_connections for select to authenticated using ((select private.is_member(workspace_id)));
create policy "membros veem pagamentos" on public.payments for select to authenticated using ((select private.is_member(workspace_id)));
-- o comprador vê os pagamentos dos próprios pedidos
create policy "comprador vê pagamento do pedido" on public.payments for select to authenticated using (
  exists (select 1 from public.orders o where o.workspace_id = payments.workspace_id and o.id = payments.order_id and o.shopper_id = (select auth.uid()))
);

-- Desconectar é uma ação do gestor; a revogação no provedor e a remoção dos tokens são feitas pela Edge Function
create or replace function public.disconnect_payment(ws uuid, prov text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_manager(ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.payment_connections set status = 'disconnected', is_default = false, updated_at = now() where workspace_id = ws and provider = prov;
end;
$$;
revoke all on function public.disconnect_payment(uuid, text) from public, anon;
grant execute on function public.disconnect_payment(uuid, text) to authenticated;
