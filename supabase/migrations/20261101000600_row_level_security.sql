-- CakeBoss · Fase 7 · Isolamento entre confeitarias (RLS) e permissões por plano
-- Regra geral: só membros da confeitaria leem e escrevem os dados dela. O workspace_id enviado pelo
-- navegador nunca basta: cada policy confere a participação de quem está logado.

alter table public.workspace_settings enable row level security;
alter table public.ingredients enable row level security;
alter table public.materials enable row level security;
alter table public.stock_movements enable row level security;
alter table public.purchases enable row level security;
alter table public.categories enable row level security;
alter table public.recipes enable row level security;
alter table public.cake_products enable row level security;
alter table public.simulations enable row level security;
alter table public.productions enable row level security;
alter table public.shoppers enable row level security;
alter table public.customers enable row level security;
alter table public.order_counters enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.transactions enable row level security;
alter table public.activity_log enable row level security;

-- Tabelas de gestão (recurso 'gestao', presente em todos os planos): membros leem e escrevem
do $$
declare t text;
begin
  foreach t in array array['workspace_settings', 'ingredients', 'materials', 'purchases', 'categories', 'recipes', 'cake_products',
                           'simulations', 'productions', 'customers', 'transactions', 'activity_log', 'stock_movements']
  loop
    execute format('create policy "membros leem" on public.%I for select to authenticated using ((select private.is_member(workspace_id)))', t);
    execute format('create policy "membros criam" on public.%I for insert to authenticated with check ((select private.is_member(workspace_id)) and (select private.has_feature(workspace_id, ''gestao'')))', t);
    execute format('create policy "membros alteram" on public.%I for update to authenticated using ((select private.is_member(workspace_id))) with check ((select private.is_member(workspace_id)) and (select private.has_feature(workspace_id, ''gestao'')))', t);
  end loop;
  -- excluir: só gestores (dona e administradores); financeiro e auditoria de estoque nunca são apagados por funcionários
  foreach t in array array['ingredients', 'materials', 'purchases', 'categories', 'recipes', 'cake_products', 'simulations', 'productions', 'customers', 'transactions']
  loop
    execute format('create policy "gestores excluem" on public.%I for delete to authenticated using ((select private.is_manager(workspace_id)))', t);
  end loop;
end $$;

-- movimentações de estoque e histórico: só acrescentar (sem update/delete pela API)
drop policy "membros alteram" on public.stock_movements;
drop policy "membros alteram" on public.activity_log;

-- lançamentos criados pelo servidor a partir de um pagamento online não podem ser editados no painel
drop policy "membros alteram" on public.transactions;
create policy "membros alteram lançamentos manuais" on public.transactions for update to authenticated
  using ((select private.is_member(workspace_id)) and source = 'manual')
  with check ((select private.is_member(workspace_id)) and source = 'manual');
drop policy "membros criam" on public.transactions;
create policy "membros criam lançamentos manuais" on public.transactions for insert to authenticated
  with check ((select private.is_member(workspace_id)) and source = 'manual' and (select private.has_feature(workspace_id, 'gestao')));
drop policy "gestores excluem" on public.transactions;
create policy "gestores excluem lançamentos manuais" on public.transactions for delete to authenticated
  using ((select private.is_manager(workspace_id)) and source = 'manual');

-- Pedidos: o painel cria e altera; status de pagamento online, número e origem "loja" são do servidor
create policy "membros leem pedidos" on public.orders for select to authenticated using ((select private.is_member(workspace_id)));
create policy "comprador lê seus pedidos" on public.orders for select to authenticated using (shopper_id = (select auth.uid()));
create policy "membros criam pedidos do painel" on public.orders for insert to authenticated
  with check ((select private.is_member(workspace_id)) and origin = 'painel' and online_payment_status = 'nao_se_aplica' and shopper_id is null
              and (select private.has_feature(workspace_id, 'gestao')));
create policy "membros alteram pedidos" on public.orders for update to authenticated
  using ((select private.is_member(workspace_id))) with check ((select private.is_member(workspace_id)));
create policy "gestores excluem pedidos" on public.orders for delete to authenticated
  using ((select private.is_manager(workspace_id)) and online_payment_status in ('nao_se_aplica', 'recusado'));

-- colunas que o navegador nunca altera
revoke update on public.orders from authenticated;
grant update (customer_id, customer_name, production_status, payment_method, fulfillment_type, delivery_address, delivery_at,
              subtotal, discount, delivery_fee, total, notes, cost_frozen_at, stock_deducted, updated_at) on public.orders to authenticated;

-- pedido da loja: o valor foi calculado e cobrado pelo servidor; o painel não muda preço nem itens
create or replace function private.protect_store_order()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.origin = 'loja' and current_user = 'authenticated' and (
       new.subtotal is distinct from old.subtotal or new.total is distinct from old.total
       or new.delivery_fee is distinct from old.delivery_fee or new.discount is distinct from old.discount) then
    raise exception 'valores de pedido da loja não podem ser alterados' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger orders_protect_store before update on public.orders for each row execute function private.protect_store_order();

create policy "membros leem itens" on public.order_items for select to authenticated using ((select private.is_member(workspace_id)));
create policy "comprador lê itens" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.workspace_id = order_items.workspace_id and o.id = order_items.order_id and o.shopper_id = (select auth.uid())));
create policy "membros gerenciam itens do painel" on public.order_items for all to authenticated
  using ((select private.is_member(workspace_id)) and exists (select 1 from public.orders o where o.workspace_id = order_items.workspace_id and o.id = order_items.order_id and o.origin = 'painel'))
  with check ((select private.is_member(workspace_id)) and exists (select 1 from public.orders o where o.workspace_id = order_items.workspace_id and o.id = order_items.order_id and o.origin = 'painel'));

-- Compradores: cada um cuida do próprio perfil
create policy "comprador lê o próprio perfil" on public.shoppers for select to authenticated using (user_id = (select auth.uid()));
create policy "comprador cria o próprio perfil" on public.shoppers for insert to authenticated with check (user_id = (select auth.uid()));
create policy "comprador altera o próprio perfil" on public.shoppers for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- a confeitaria vê o perfil de quem já comprou com ela (LGPD: só o necessário para atender o pedido)
create policy "loja vê seus compradores" on public.shoppers for select to authenticated using (
  exists (select 1 from public.customers c where c.shopper_id = shoppers.user_id and (select private.is_member(c.workspace_id))));
create policy "comprador vê sua ficha na loja" on public.customers for select to authenticated using (shopper_id = (select auth.uid()));

-- Loja: configuração é dos gestores. Montar a loja é livre em qualquer plano; ela só aparece ao público
-- quando o plano inclui loja (conferido em get_store), então o Básico pode deixar tudo pronto.
create policy "membros leem loja" on public.store_settings for select to authenticated using ((select private.is_member(workspace_id)));
create policy "gestores configuram loja" on public.store_settings for all to authenticated
  using ((select private.is_manager(workspace_id))) with check ((select private.is_manager(workspace_id)));
create policy "membros leem zonas" on public.delivery_zones for select to authenticated using ((select private.is_member(workspace_id)));
create policy "gestores editam zonas" on public.delivery_zones for all to authenticated
  using ((select private.is_manager(workspace_id))) with check ((select private.is_manager(workspace_id)));

create policy "membros leem promoções" on public.promotions for select to authenticated using ((select private.is_member(workspace_id)));
create policy "gestores editam promoções" on public.promotions for all to authenticated
  using ((select private.is_manager(workspace_id))) with check ((select private.is_manager(workspace_id)));

-- Perfil da confeitaria: gestores editam nome e dados comerciais (plano e dono nunca)
revoke update on public.workspaces from authenticated;
grant update (name, slug, owner_name, phone, document, address, logo_path, opening_hours, business_info) on public.workspaces to authenticated;
drop policy "owner renames workspace" on public.workspaces;
create policy "gestores editam confeitaria" on public.workspaces for update to authenticated
  using ((select private.is_manager(id))) with check ((select private.is_manager(id)));

-- contador de pedidos: só o gatilho mexe
-- (RLS ligado e sem policies = sem acesso pela API)
