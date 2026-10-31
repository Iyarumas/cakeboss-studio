-- Imitação mínima do Supabase para testar as migrações num Postgres comum (Docker).
-- NÃO aplicar no Supabase de verdade.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create schema extensions;
grant usage on schema public, auth, storage to anon, authenticated, service_role;

create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/'); $$;

create publication supabase_realtime;

alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- ===== Estado atual do projeto cakeboss-studio (migrações já aplicadas em 31/10) =====
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  plan text not null default 'basico' check (plan in ('basico', 'loja', 'completo'))
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create table public.workspace_data (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_data enable row level security;
create schema private;
grant usage on schema private to authenticated;
create function private.is_member(ws uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = (select auth.uid()));
$$;
create policy "members read their workspaces" on public.workspaces for select to authenticated using ((select private.is_member(id)));
create policy "owner renames workspace" on public.workspaces for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "users read own memberships" on public.workspace_members for select to authenticated using (user_id = (select auth.uid()));
create policy "members read data" on public.workspace_data for select to authenticated using ((select private.is_member(workspace_id)));
create function public.save_workspace_data(ws uuid, new_data jsonb, expected_version integer) returns integer language plpgsql security definer set search_path = '' as $$
begin return null; end; $$;
create function public.create_workspace(ws_name text, initial_data jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
begin return null; end; $$;
revoke update on public.workspaces from authenticated, anon;
grant update (name) on public.workspaces to authenticated;

-- Dados de teste: duas confeitarias e um comprador
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste'),
  ('33333333-3333-3333-3333-333333333333', 'comprador@teste'),
  ('44444444-4444-4444-4444-444444444444', 'func@teste');
insert into public.workspaces (id, name, owner_id, plan) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Doces da Ana', '11111111-1111-1111-1111-111111111111', 'loja'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Bolos da Bia', '22222222-2222-2222-2222-222222222222', 'basico');
insert into public.workspace_members values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'owner', now()),
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'staff', now());
insert into public.workspace_data (workspace_id, data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '{
     "version": 1,
     "settings": {"businessName": "Doces da Ana", "ownerName": "Ana", "store": {"enabled": true, "whatsapp": "(47) 99999-0001", "leadDays": 2, "zones": [{"id": "z1", "city": "Navegantes", "fee": 10}, {"id": "z2", "city": "Penha", "fee": null}]}},
     "ingredients": [{"id": "i1", "name": "Leite condensado", "unit": "g", "packageQty": 395, "packagePrice": 7.5, "supplier": "", "stock": 790, "minStock": 395, "priceHistory": [], "updatedAt": "2026-10-01T10:00:00Z"}],
     "materials": [],
     "recipes": [{"id": "r1", "name": "Brigadeiro", "category": "Docinhos", "yield": 25, "unitLabel": "un", "prepMinutes": 40, "wastePct": 0, "waterLiters": 0, "ingredients": [{"ingredientId": "i1", "qty": 395, "unit": "g"}], "materials": [], "equipment": [], "otherCosts": [], "salePrice": 3.5, "targetMarginPct": 30, "priceSnapshot": null, "createdAt": "2026-10-01T10:00:00Z", "updatedAt": "2026-10-01T10:00:00Z"}],
     "customers": [{"id": "c1", "name": "Carla", "phone": "47999990003", "notes": "", "createdAt": "2026-10-01T10:00:00Z"}],
     "orders": [{"id": "o1", "number": 7, "customerId": "c1", "customerName": "Carla", "items": [{"id": "it1", "recipeId": "r1", "name": "Brigadeiro", "qty": 50, "unitPrice": 3.5, "unitCost": 1.2}], "deliveryAt": "2026-11-02T14:00:00Z", "status": "em_producao", "discount": 5, "deliveryFee": 10, "notes": "", "costFrozenAt": "2026-10-30T10:00:00Z", "stockDeducted": true, "createdAt": "2026-10-30T10:00:00Z", "updatedAt": "2026-10-30T10:00:00Z"}],
     "transactions": [{"id": "t1", "date": "2026-10-30T10:00:00Z", "type": "entrada", "category": "Vendas", "description": "Pedido #7", "amount": 80, "method": "pix", "orderId": "o1", "createdAt": "2026-10-30T10:00:00Z"}],
     "purchases": [], "simulations": [], "productions": [],
     "history": [{"id": "h1", "at": "2026-10-30T10:00:00Z", "type": "pedido", "message": "Pedido criado"}]
   }'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '{"version": 1, "settings": {"businessName": "Bolos da Bia"}, "recipes": [], "orders": [], "customers": []}');
