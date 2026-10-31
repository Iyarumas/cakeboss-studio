-- CakeBoss · Fases 6, 10 e 15 · Loja pública por confeitaria, entrega/retirada e agenda

create table public.store_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  enabled boolean not null default false,
  display_name text,
  description text,
  banner_path text,
  accent text,
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  phone text,
  pickup_enabled boolean not null default true,
  pickup_address text,
  delivery_enabled boolean not null default false,
  -- antecedência mínima em horas entre o pedido e a entrega/retirada
  lead_hours integer not null default 48 check (lead_hours between 0 and 24 * 60),
  -- até quantos dias à frente o cliente pode agendar
  max_days_ahead integer not null default 60 check (max_days_ahead between 1 and 365),
  -- por dia da semana (0 = domingo): lista de horários oferecidos, ex. {"1": ["09:00", "14:00"]}
  weekly_slots jsonb not null default '{}'::jsonb,
  closed_dates date[] not null default '{}',
  -- null = sem limite
  capacity_per_day integer check (capacity_per_day is null or capacity_per_day > 0),
  capacity_per_slot integer check (capacity_per_slot is null or capacity_per_slot > 0),
  updated_at timestamptz not null default now()
);

create table public.delivery_zones (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  city text not null,
  district text,
  fee numeric(12,2) not null check (fee >= 0),
  active boolean not null default true,
  primary key (workspace_id, id)
);

-- ---------------------------------------------------------------------------
-- Leitura pública da loja: só campos de vitrine, nunca custos, clientes ou financeiro.
-- Uma chamada traz tudo que a página precisa (menos idas ao banco).
-- ---------------------------------------------------------------------------
create or replace function public.get_store(store_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  ws public.workspaces%rowtype;
  st public.store_settings%rowtype;
begin
  select * into ws from public.workspaces where slug = lower(store_slug);
  if not found then return null; end if;
  select * into st from public.store_settings where workspace_id = ws.id;
  if not found or not st.enabled or not private.has_feature(ws.id, 'loja') then return null; end if;
  return jsonb_build_object(
    'id', ws.id,
    'slug', ws.slug,
    'name', coalesce(st.display_name, ws.name),
    'logo_path', ws.logo_path,
    'banner_path', st.banner_path,
    'description', st.description,
    'accent', st.accent,
    'whatsapp', st.whatsapp,
    'phone', st.phone,
    'opening_hours', ws.opening_hours,
    'pickup', jsonb_build_object('enabled', st.pickup_enabled, 'address', st.pickup_address),
    'delivery', jsonb_build_object('enabled', st.delivery_enabled,
      'zones', coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'city', z.city, 'district', z.district, 'fee', z.fee) order by z.city)
                           from public.delivery_zones z where z.workspace_id = ws.id and z.active), '[]'::jsonb)),
    'schedule', jsonb_build_object('lead_hours', st.lead_hours, 'max_days_ahead', st.max_days_ahead,
                                   'weekly_slots', st.weekly_slots, 'closed_dates', to_jsonb(st.closed_dates)),
    -- pagamento online só aparece se houver gateway conectado e ativo
    'online_payment', coalesce((select jsonb_build_object('provider', c.provider, 'methods', c.methods)
                                  from public.payment_connections c
                                 where c.workspace_id = ws.id and c.status = 'connected' and c.is_default
                                   and private.has_feature(ws.id, 'pagamentos_online') limit 1), 'null'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'category', r.category,
                              'price', r.sale_price, 'description', r.store_description, 'image_path', r.store_image_path,
                              'options', r.store_options, 'unit_label', r.composition->>'unitLabel') order by r.category, r.name)
                            from public.recipes r
                           where r.workspace_id = ws.id and r.store_visible and r.sale_price > 0 and not r.sample), '[]'::jsonb),
    'cakes', coalesce((select jsonb_agg(private.public_cake(c)) from public.cake_products c where c.workspace_id = ws.id and c.visible), '[]'::jsonb)
  );
end;
$$;

-- Bolo montado sem expor as fichas: só nomes, tamanhos e o preço já calculado de cada combinação
-- é feito pelo servidor no checkout; a vitrine recebe os nomes e o preço "a partir de" guardado em config.
create or replace function private.public_cake(c public.cake_products)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'image_path', c.image_path,
    'description', c.config->>'description',
    'max_recheios', c.config->'maxRecheios',
    'sizes', (select jsonb_agg(jsonb_build_object('id', s->>'id', 'name', s->>'name', 'price', s->'publicPrice')) from jsonb_array_elements(c.config->'sizes') s),
    'massas', (select jsonb_agg(jsonb_build_object('id', x->>'id', 'name', x->>'name')) from jsonb_array_elements(c.config->'massas') x),
    'recheios', (select jsonb_agg(jsonb_build_object('id', x->>'id', 'name', x->>'name', 'extra', x->'publicExtra')) from jsonb_array_elements(c.config->'recheios') x),
    'coberturas', (select jsonb_agg(jsonb_build_object('id', x->>'id', 'name', x->>'name', 'extra', x->'publicExtra')) from jsonb_array_elements(c.config->'coberturas') x)
  );
$$;

revoke all on function public.get_store(text) from public;
grant execute on function public.get_store(text) to anon, authenticated;

-- Slug: sugestão a partir do nome e verificação de disponibilidade (sem revelar dados de outras lojas)
create or replace function public.slug_available(candidate text)
returns boolean language sql stable security definer set search_path = '' as $$
  select candidate ~ '^[a-z0-9]([a-z0-9-]{1,58}[a-z0-9])?$'
     and not exists (select 1 from private.reserved_slugs r where r.slug = candidate)
     and not exists (select 1 from public.workspaces w where w.slug = candidate);
$$;
revoke all on function public.slug_available(text) from public;
grant execute on function public.slug_available(text) to authenticated;

alter table public.store_settings enable row level security;
alter table public.delivery_zones enable row level security;
