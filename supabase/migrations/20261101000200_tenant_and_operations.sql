-- CakeBoss · Fase 7 · Dados da confeitaria e da operação, uma linha por registro
-- Toda tabela de dados tem workspace_id (o "tenant") e chave (workspace_id, id).
-- Os ids continuam sendo texto gerado pelo app (os dados atuais já usam esse formato).

-- ---------------------------------------------------------------------------
-- Confeitaria: perfil comercial e endereço da loja
-- ---------------------------------------------------------------------------
alter table public.workspaces
  add column slug text unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,58}[a-z0-9])?$'),
  add column owner_name text,
  add column phone text,
  add column document text check (document is null or document ~ '^[0-9]{11}$|^[0-9]{14}$'),
  add column address jsonb,
  add column logo_path text,
  add column opening_hours jsonb not null default '{}'::jsonb,
  add column business_info text;

-- palavras que não podem virar endereço de loja
create table private.reserved_slugs (slug text primary key);
insert into private.reserved_slugs values ('entrar'), ('criar-conta'), ('finalizar'), ('conheca'), ('admin'), ('api'), ('planos'), ('loja'), ('conta'), ('suporte'), ('cakeboss');

alter table public.workspace_members drop constraint workspace_members_role_check;
alter table public.workspace_members add constraint workspace_members_role_check check (role in ('owner', 'admin', 'staff'));

-- configurações gerais do painel (custos operacionais, mensagens, mascote, cores…): um documento por confeitaria
create table public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Insumos e estoque
-- ---------------------------------------------------------------------------
create table public.ingredients (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null,
  unit text not null check (unit in ('g', 'kg', 'ml', 'l', 'un')),
  package_qty numeric(14,3) not null default 0,
  package_price numeric(12,2) not null default 0,
  supplier text not null default '',
  stock numeric(14,3) not null default 0,
  min_stock numeric(14,3) not null default 0,
  price_history jsonb not null default '[]'::jsonb,
  sample boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table public.materials (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null,
  kind text not null check (kind in ('embalagem', 'adesivo', 'outro')),
  package_qty numeric(14,3) not null default 0,
  package_price numeric(12,2) not null default 0,
  supplier text not null default '',
  stock numeric(14,3) not null default 0,
  min_stock numeric(14,3) not null default 0,
  price_history jsonb not null default '[]'::jsonb,
  sample boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

-- cada entrada e saída de estoque (compra, produção, ajuste, estorno)
create table public.stock_movements (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  item_kind text not null check (item_kind in ('ingrediente', 'material')),
  item_id text not null,
  delta numeric(14,3) not null,
  reason text not null check (reason in ('compra', 'producao', 'pedido', 'ajuste', 'estorno')),
  ref_id text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (workspace_id, id)
);
create index stock_movements_item_idx on public.stock_movements(workspace_id, item_kind, item_id, created_at desc);

create table public.purchases (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  date timestamptz not null,
  kind text not null check (kind in ('ingrediente', 'material')),
  item_id text not null,
  item_name text not null,
  packages numeric(12,3) not null,
  package_qty numeric(14,3) not null,
  unit text not null,
  price_per_package numeric(12,2) not null,
  total numeric(12,2) not null,
  supplier text not null default '',
  stock_added numeric(14,3) not null,
  transaction_id text,
  primary key (workspace_id, id)
);
create index purchases_date_idx on public.purchases(workspace_id, date desc);

-- ---------------------------------------------------------------------------
-- Catálogo e fichas técnicas
-- ---------------------------------------------------------------------------
create table public.categories (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  name text not null,
  sort integer not null default 0,
  primary key (workspace_id, id),
  unique (workspace_id, name)
);

create table public.recipes (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null,
  category text not null default '',
  -- composição de um lote (rendimento, ingredientes, materiais, equipamentos…): privada da confeitaria
  composition jsonb not null,
  sale_price numeric(12,2),
  target_margin_pct numeric(6,2) not null default 30,
  price_snapshot jsonb,
  sample boolean not null default false,
  -- vitrine
  store_visible boolean not null default true,
  store_description text,
  store_image_path text,
  store_options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table public.cake_products (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  name text not null,
  visible boolean not null default true,
  image_path text,
  -- tamanhos, massas, recheios, coberturas e margem (formato do app)
  config jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table public.simulations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  name text not null,
  recipe_id text,
  composition jsonb not null,
  params jsonb not null,
  unit_cost numeric(12,4),
  profit_margin_pct numeric(8,2),
  created_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table public.productions (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  recipe_id text not null,
  recipe_name text not null,
  quantity numeric(12,3) not null,
  date timestamptz not null,
  cost jsonb not null,
  sale_price numeric(12,2),
  stock_deducted boolean not null default false,
  primary key (workspace_id, id)
);
create index productions_date_idx on public.productions(workspace_id, date desc);

-- ---------------------------------------------------------------------------
-- Clientes (da confeitaria) e compradores (contas da loja, valem em várias lojas)
-- ---------------------------------------------------------------------------
create table public.shoppers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  phone text not null check (phone ~ '^[0-9]{10,13}$'),
  default_address jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  name text not null,
  phone text not null default '',
  email text,
  address jsonb,
  notes text not null default '',
  -- preenchido quando o cliente comprou pela loja com uma conta de comprador
  shopper_id uuid references public.shoppers(user_id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  unique (workspace_id, shopper_id)
);

-- ---------------------------------------------------------------------------
-- Pedidos: status de produção e de pagamento são independentes
-- ---------------------------------------------------------------------------
create table public.order_counters (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  last_number integer not null default 0
);

create table public.orders (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  number integer not null,
  customer_id text,
  customer_name text not null default '',
  shopper_id uuid references public.shoppers(user_id) on delete set null,
  origin text not null default 'painel' check (origin in ('painel', 'loja')),
  production_status text not null default 'confirmado' check (production_status in
    ('orcamento', 'aguardando', 'confirmado', 'em_preparo', 'pronto', 'saiu_entrega', 'concluido', 'cancelado')),
  -- só o servidor (webhook do gateway) altera; o painel registra pagamentos manuais em transactions
  online_payment_status text not null default 'nao_se_aplica' check (online_payment_status in
    ('nao_se_aplica', 'pendente', 'aprovado', 'recusado', 'reembolsado')),
  payment_method text check (payment_method in ('pix', 'dinheiro', 'credito', 'debito', 'outro')),
  fulfillment_type text not null default 'retirada' check (fulfillment_type in ('retirada', 'entrega')),
  delivery_address jsonb,
  delivery_at timestamptz not null,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0 check (discount >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) not null default 0,
  notes text not null default '',
  cost_frozen_at timestamptz,
  stock_deducted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id),
  unique (workspace_id, number),
  foreign key (workspace_id, customer_id) references public.customers(workspace_id, id) on delete set null (customer_id)
);
create index orders_delivery_idx on public.orders(workspace_id, delivery_at);
create index orders_status_idx on public.orders(workspace_id, production_status, delivery_at);
create index orders_shopper_idx on public.orders(shopper_id, created_at desc) where shopper_id is not null;

create table public.order_items (
  workspace_id uuid not null,
  order_id text not null,
  id text not null default gen_random_uuid()::text,
  recipe_id text,
  cake_product_id text,
  name text not null,
  qty numeric(12,3) not null check (qty > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost numeric(12,4),
  options jsonb,
  components jsonb,
  primary key (workspace_id, id),
  foreign key (workspace_id, order_id) references public.orders(workspace_id, id) on delete cascade
);
create index order_items_order_idx on public.order_items(workspace_id, order_id);

-- número sequencial por confeitaria, atribuído no banco (dois aparelhos nunca repetem)
create or replace function private.assign_order_number()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.number is null or new.number <= 0 then
    insert into public.order_counters (workspace_id, last_number) values (new.workspace_id, 1)
    on conflict (workspace_id) do update set last_number = public.order_counters.last_number + 1
    returning last_number into new.number;
  else
    -- número vindo da migração dos dados antigos: mantém e avança o contador
    insert into public.order_counters (workspace_id, last_number) values (new.workspace_id, new.number)
    on conflict (workspace_id) do update set last_number = greatest(public.order_counters.last_number, new.number);
  end if;
  return new;
end;
$$;
create trigger orders_number before insert on public.orders for each row execute function private.assign_order_number();

-- ---------------------------------------------------------------------------
-- Financeiro e histórico
-- ---------------------------------------------------------------------------
create table public.transactions (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  date timestamptz not null,
  type text not null check (type in ('entrada', 'saida')),
  category text not null,
  description text not null default '',
  amount numeric(12,2) not null check (amount >= 0),
  method text check (method in ('pix', 'dinheiro', 'credito', 'debito', 'outro')),
  order_id text,
  -- 'manual' = lançado no painel; 'gateway' = criado pelo servidor ao confirmar um pagamento online
  source text not null default 'manual' check (source in ('manual', 'gateway')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, id)
);
create index transactions_date_idx on public.transactions(workspace_id, date desc);
create index transactions_order_idx on public.transactions(workspace_id, order_id) where order_id is not null;

create table public.activity_log (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  at timestamptz not null default now(),
  type text not null,
  message text not null,
  detail text,
  actor uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (workspace_id, id)
);
create index activity_log_at_idx on public.activity_log(workspace_id, at desc);
