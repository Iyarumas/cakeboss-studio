-- CakeBoss · Fase 7 · Copia os dados atuais (bloco JSON em workspace_data) para as tabelas novas.
-- Não apaga nada: workspace_data continua guardado como cópia de segurança até a migração 0900.

-- endereço da loja não pode usar palavras reservadas
create or replace function private.check_slug()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.slug is not null and exists (select 1 from private.reserved_slugs r where r.slug = new.slug) then
    raise exception 'endereço reservado' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger workspaces_slug before insert or update of slug on public.workspaces for each row execute function private.check_slug();

-- slug a partir do nome: "Doces da Lê" → "doces-da-le" (com sufixo se já existir)
create or replace function private.slugify(input text)
returns text language plpgsql stable set search_path = '' as $$
declare
  base text := trim(both '-' from regexp_replace(lower(translate(coalesce(input, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', '-', 'g'));
  candidate text;
  n integer := 1;
begin
  base := left(coalesce(nullif(base, ''), 'confeitaria'), 50);
  if char_length(base) < 3 then base := base || '-doces'; end if;
  candidate := base;
  while exists (select 1 from public.workspaces w where w.slug = candidate) or exists (select 1 from private.reserved_slugs r where r.slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end;
$$;

-- Leitura segura de números vindos do JSON antigo
create or replace function private.num(v jsonb, fallback numeric default 0)
returns numeric language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric else fallback end;
$$;

create or replace function private.ts(v jsonb)
returns timestamptz language plpgsql immutable set search_path = '' as $$
begin
  return (v #>> '{}')::timestamptz;
exception when others then
  return null;
end;
$$;

-- Copia um bloco antigo para as tabelas (idempotente: registros já existentes são ignorados)
create or replace function private.import_workspace_blob(ws uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d jsonb;
  s jsonb;
  st jsonb;
  counts jsonb;
begin
  select data into d from public.workspace_data where workspace_id = ws;
  if d is null then return null; end if;
  s := coalesce(d->'settings', '{}'::jsonb);
  st := s->'store';

  update public.workspaces set
    slug = coalesce(slug, private.slugify(name)),
    owner_name = coalesce(owner_name, nullif(s->>'ownerName', ''))
   where id = ws;

  insert into public.workspace_settings (workspace_id, settings) values (ws, s - 'store')
  on conflict (workspace_id) do nothing;

  insert into public.store_settings (workspace_id, enabled, display_name, tagline, logo_path, description, whatsapp, pickup_address, delivery_enabled, lead_hours, accent)
  values (ws, coalesce((st->>'enabled')::boolean, false), nullif(trim(coalesce(st->>'storeName', '')), ''), nullif(trim(coalesce(st->>'tagline', '')), ''), nullif(st->>'logo', ''), nullif(st->>'about', ''),
          nullif(regexp_replace(coalesce(st->>'whatsapp', ''), '[^0-9]', '', 'g'), ''),
          nullif(st->>'pickupAddress', ''),
          exists (select 1 from jsonb_array_elements(coalesce(st->'zones', '[]')) z where jsonb_typeof(z->'fee') = 'number'),
          greatest(0, coalesce((st->>'leadDays')::int, 2)) * 24,
          coalesce(s->>'accentShop', s->>'accentAdmin'))
  on conflict (workspace_id) do nothing;

  insert into public.delivery_zones (workspace_id, id, city, fee)
  select ws, z->>'id', z->>'city', (z->>'fee')::numeric
    from jsonb_array_elements(coalesce(st->'zones', '[]')) z
   where jsonb_typeof(z->'fee') = 'number' and coalesce(z->>'city', '') <> ''
  on conflict do nothing;

  insert into public.promotions (workspace_id, id, name, kind, value, recipe_ids, starts_on, ends_on, active, created_at)
  select ws, x->>'id', left(x->>'name', 60), x->>'kind', (x->>'value')::numeric,
         coalesce(array(select jsonb_array_elements_text(x->'recipeIds')), '{}'),
         nullif(x->>'startsOn', '')::date, nullif(x->>'endsOn', '')::date, coalesce((x->>'active')::boolean, true), coalesce(private.ts(x->'createdAt'), now())
    from jsonb_array_elements(coalesce(st->'promotions', '[]')) x
   where x->>'kind' in ('percent', 'off') and jsonb_typeof(x->'value') = 'number' and (x->>'value')::numeric > 0
     and (x->>'kind' <> 'percent' or (x->>'value')::numeric < 100)
  on conflict do nothing;

  insert into public.ingredients (workspace_id, id, name, unit, package_qty, package_price, supplier, stock, min_stock, price_history, sample, updated_at)
  select ws, x->>'id', x->>'name', x->>'unit', private.num(x->'packageQty'), private.num(x->'packagePrice'), coalesce(x->>'supplier', ''),
         private.num(x->'stock'), private.num(x->'minStock'), coalesce(x->'priceHistory', '[]'), coalesce((x->>'sample')::boolean, false), coalesce(private.ts(x->'updatedAt'), now())
    from jsonb_array_elements(coalesce(d->'ingredients', '[]')) x
  on conflict do nothing;

  insert into public.materials (workspace_id, id, name, kind, package_qty, package_price, supplier, stock, min_stock, price_history, sample, updated_at)
  select ws, x->>'id', x->>'name', coalesce(x->>'kind', 'outro'), private.num(x->'packageQty'), private.num(x->'packagePrice'), coalesce(x->>'supplier', ''),
         private.num(x->'stock'), private.num(x->'minStock'), coalesce(x->'priceHistory', '[]'), coalesce((x->>'sample')::boolean, false), coalesce(private.ts(x->'updatedAt'), now())
    from jsonb_array_elements(coalesce(d->'materials', '[]')) x
  on conflict do nothing;

  -- a foto antiga (imagem em texto) é mantida como está; o app a envia para o Storage na próxima edição
  insert into public.recipes (workspace_id, id, name, category, composition, sale_price, target_margin_pct, price_snapshot, sample,
                              store_visible, store_description, store_image_path, store_options, created_at, updated_at)
  select ws, x->>'id', x->>'name', coalesce(x->>'category', ''),
         jsonb_build_object('yield', x->'yield', 'unitLabel', x->'unitLabel', 'prepMinutes', x->'prepMinutes', 'wastePct', x->'wastePct',
                            'waterLiters', x->'waterLiters', 'ingredients', x->'ingredients', 'materials', x->'materials',
                            'equipment', x->'equipment', 'otherCosts', x->'otherCosts'),
         case when jsonb_typeof(x->'salePrice') = 'number' then (x->>'salePrice')::numeric end,
         private.num(x->'targetMarginPct', 30), x->'priceSnapshot', coalesce((x->>'sample')::boolean, false),
         coalesce((x->>'storeVisible')::boolean, true), x->>'storeDescription', nullif(x->>'storeImage', ''), coalesce(x->'storeOptions', '[]'),
         coalesce(private.ts(x->'createdAt'), now()), coalesce(private.ts(x->'updatedAt'), now())
    from jsonb_array_elements(coalesce(d->'recipes', '[]')) x
  on conflict do nothing;

  insert into public.cake_products (workspace_id, id, name, visible, image_path, config)
  select ws, x->>'id', x->>'name', coalesce((x->>'visible')::boolean, true), nullif(x->>'image', ''), x - 'image'
    from jsonb_array_elements(coalesce(st->'cakes', '[]')) x
  on conflict do nothing;

  insert into public.simulations (workspace_id, id, name, recipe_id, composition, params, unit_cost, profit_margin_pct, created_at)
  select ws, x->>'id', x->>'name', x->>'recipeId', x->'composition', x->'params', private.num(x->'unitCost'), private.num(x->'profitMarginPct'), coalesce(private.ts(x->'createdAt'), now())
    from jsonb_array_elements(coalesce(d->'simulations', '[]')) x
  on conflict do nothing;

  insert into public.productions (workspace_id, id, recipe_id, recipe_name, quantity, date, cost, sale_price, stock_deducted)
  select ws, x->>'id', x->>'recipeId', x->>'recipeName', private.num(x->'quantity'), coalesce(private.ts(x->'date'), now()), x->'cost',
         case when jsonb_typeof(x->'salePrice') = 'number' then (x->>'salePrice')::numeric end, coalesce((x->>'stockDeducted')::boolean, false)
    from jsonb_array_elements(coalesce(d->'productions', '[]')) x
  on conflict do nothing;

  insert into public.purchases (workspace_id, id, date, kind, item_id, item_name, packages, package_qty, unit, price_per_package, total, supplier, stock_added, transaction_id)
  select ws, x->>'id', coalesce(private.ts(x->'date'), now()), x->>'kind', x->>'itemId', x->>'itemName', private.num(x->'packages'), private.num(x->'packageQty'),
         x->>'unit', private.num(x->'pricePerPackage'), private.num(x->'total'), coalesce(x->>'supplier', ''), private.num(x->'stockAdded'), x->>'transactionId'
    from jsonb_array_elements(coalesce(d->'purchases', '[]')) x
  on conflict do nothing;

  insert into public.customers (workspace_id, id, name, phone, email, address, notes, created_at)
  select ws, x->>'id', x->>'name', coalesce(x->>'phone', ''), x->>'email', x->'address', coalesce(x->>'notes', ''), coalesce(private.ts(x->'createdAt'), now())
    from jsonb_array_elements(coalesce(d->'customers', '[]')) x
  on conflict do nothing;

  -- status antigo → status de produção novo
  insert into public.orders (workspace_id, id, number, customer_id, customer_name, origin, production_status, payment_method,
                             fulfillment_type, delivery_address, delivery_at, subtotal, discount, delivery_fee, total, notes,
                             cost_frozen_at, stock_deducted, created_at, updated_at)
  select ws, o->>'id', (o->>'number')::int,
         case when exists (select 1 from jsonb_array_elements(coalesce(d->'customers', '[]')) c where c->>'id' = o->>'customerId') then o->>'customerId' end,
         coalesce(o->>'customerName', ''),
         case when o->>'origin' = 'loja' then 'loja' else 'painel' end,
         case o->>'status' when 'orcamento' then 'orcamento' when 'confirmado' then 'confirmado' when 'em_producao' then 'em_preparo'
                           when 'pronto' then 'pronto' when 'entregue' then 'concluido' when 'cancelado' then 'cancelado' else 'confirmado' end,
         o#>>'{payment,method}',
         coalesce(o#>>'{fulfillment,type}', 'retirada'), o#>'{fulfillment,address}',
         coalesce(private.ts(o->'deliveryAt'), now()),
         t.subtotal, private.num(o->'discount'), private.num(o->'deliveryFee'),
         greatest(0, t.subtotal - private.num(o->'discount') + private.num(o->'deliveryFee')),
         coalesce(o->>'notes', ''), private.ts(o->'costFrozenAt'), coalesce((o->>'stockDeducted')::boolean, false),
         coalesce(private.ts(o->'createdAt'), now()), coalesce(private.ts(o->'updatedAt'), now())
    from jsonb_array_elements(coalesce(d->'orders', '[]')) o
    cross join lateral (select coalesce(sum(private.num(i->'qty') * private.num(i->'unitPrice')), 0) as subtotal
                          from jsonb_array_elements(coalesce(o->'items', '[]')) i) t
  on conflict do nothing;

  insert into public.order_items (workspace_id, order_id, id, recipe_id, name, qty, unit_price, unit_cost, components)
  select ws, o->>'id', coalesce(i->>'id', gen_random_uuid()::text), i->>'recipeId', i->>'name', greatest(private.num(i->'qty', 1), 0.001),
         greatest(private.num(i->'unitPrice'), 0), case when jsonb_typeof(i->'unitCost') = 'number' then (i->>'unitCost')::numeric end, i->'components'
    from jsonb_array_elements(coalesce(d->'orders', '[]')) o
    cross join lateral jsonb_array_elements(coalesce(o->'items', '[]')) i
  on conflict do nothing;

  insert into public.transactions (workspace_id, id, date, type, category, description, amount, method, order_id, source, created_at)
  select ws, x->>'id', coalesce(private.ts(x->'date'), now()), x->>'type', x->>'category', coalesce(x->>'description', ''), abs(private.num(x->'amount')),
         x->>'method', x->>'orderId', 'manual', coalesce(private.ts(x->'createdAt'), now())
    from jsonb_array_elements(coalesce(d->'transactions', '[]')) x
  on conflict do nothing;

  insert into public.activity_log (workspace_id, id, at, type, message, detail, actor)
  select ws, x->>'id', coalesce(private.ts(x->'at'), now()), coalesce(x->>'type', 'sistema'), x->>'message', x->>'detail', null
    from jsonb_array_elements(coalesce(d->'history', '[]')) x
  on conflict do nothing;

  select jsonb_build_object(
    'receitas', (select count(*) from public.recipes where workspace_id = ws),
    'pedidos', (select count(*) from public.orders where workspace_id = ws),
    'clientes', (select count(*) from public.customers where workspace_id = ws),
    'lancamentos', (select count(*) from public.transactions where workspace_id = ws)) into counts;
  insert into private.audit_log (workspace_id, action, entity, detail) values (ws, 'import', 'workspace_data', counts);
  return counts;
end;
$$;
revoke all on function private.import_workspace_blob(uuid) from public, anon, authenticated;

-- Assinatura das confeitarias que já existem: concessão administrativa explícita (não é pagamento)
insert into public.subscriptions (workspace_id, plan_code, status, price_cents, grant_reason, granted_by)
select w.id,
       case w.plan when 'loja' then 'premium' when 'completo' then 'plus' else 'basico' end,
       'test_grant', p.price_cents,
       'Conta criada antes da cobrança existir (migração 20261101). Revisar quando a cobrança for ativada.',
       w.owner_id
  from public.workspaces w
  join public.plans p on p.code = case w.plan when 'loja' then 'premium' when 'completo' then 'plus' else 'basico' end
 where not exists (select 1 from public.subscriptions s where s.workspace_id = w.id);

select private.import_workspace_blob(workspace_id) from public.workspace_data;

-- marca de quando o bloco foi copiado
alter table public.workspace_data add column imported_at timestamptz;
update public.workspace_data set imported_at = now();

-- Nova criação de confeitaria: já nasce com slug, configurações e loja desligada.
-- Sem plano pago: a pessoa escolhe o plano em seguida (choose_plan).
create or replace function public.create_workspace(ws_name text, initial_data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ws uuid;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if char_length(trim(coalesce(ws_name, ''))) not between 1 and 120 then raise exception 'nome inválido' using errcode = '22023'; end if;
  if exists (select 1 from public.workspaces w where w.owner_id = uid) then raise exception 'workspace already exists' using errcode = 'P0001'; end if;
  insert into public.workspaces (name, owner_id, slug, owner_name)
  values (trim(ws_name), uid, private.slugify(ws_name), nullif(trim(coalesce(initial_data #>> '{settings,ownerName}', '')), ''))
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, uid, 'owner');
  insert into public.workspace_data (workspace_id, data, updated_by, imported_at) values (ws, coalesce(initial_data, '{}'::jsonb), uid, null);
  insert into public.workspace_settings (workspace_id, settings) values (ws, coalesce(initial_data->'settings', '{}'::jsonb) - 'store');
  insert into public.store_settings (workspace_id) values (ws);
  return ws;
end;
$$;
