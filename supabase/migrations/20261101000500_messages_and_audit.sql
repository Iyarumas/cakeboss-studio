-- CakeBoss · Fases 11 e 20 · Central de mensagens (Plus), notificações e auditoria

create table public.conversations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  shopper_id uuid not null references public.shoppers(user_id) on delete cascade,
  order_id text,
  subject text,
  last_message_at timestamptz not null default now(),
  unread_store integer not null default 0,
  unread_shopper integer not null default 0,
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, order_id) references public.orders(workspace_id, id) on delete set null (order_id)
);
create index conversations_inbox_idx on public.conversations(workspace_id, last_message_at desc);
create index conversations_shopper_idx on public.conversations(shopper_id, last_message_at desc);

create table public.messages (
  workspace_id uuid not null,
  conversation_id text not null,
  id text not null default gen_random_uuid()::text,
  sender text not null check (sender in ('loja', 'cliente')),
  sender_user uuid not null default auth.uid() references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (workspace_id, id),
  foreign key (workspace_id, conversation_id) references public.conversations(workspace_id, id) on delete cascade
);
create index messages_conversation_idx on public.messages(workspace_id, conversation_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  kind text not null,
  title text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

-- Auditoria de ações sensíveis (escrita só por gatilhos/servidor). Retenção: 400 dias (job mensal).
create table private.audit_log (
  id bigint generated always as identity primary key,
  workspace_id uuid,
  actor uuid,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index audit_log_ws_idx on private.audit_log(workspace_id, at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

-- loja (membros, com plano que inclui mensagens) e o próprio comprador
create policy "loja lê conversas" on public.conversations for select to authenticated
  using ((select private.is_member(workspace_id)) and (select private.has_feature(workspace_id, 'mensagens')));
create policy "comprador lê suas conversas" on public.conversations for select to authenticated
  using (shopper_id = (select auth.uid()));
create policy "comprador abre conversa" on public.conversations for insert to authenticated
  with check (shopper_id = (select auth.uid()) and private.has_feature(workspace_id, 'mensagens'));

create policy "loja lê mensagens" on public.messages for select to authenticated
  using ((select private.is_member(workspace_id)) and (select private.has_feature(workspace_id, 'mensagens')));
create policy "comprador lê mensagens" on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.workspace_id = messages.workspace_id and c.id = messages.conversation_id and c.shopper_id = (select auth.uid())));
create policy "loja envia" on public.messages for insert to authenticated
  with check (sender = 'loja' and sender_user = (select auth.uid()) and private.is_member(workspace_id) and private.has_feature(workspace_id, 'mensagens'));
create policy "comprador envia" on public.messages for insert to authenticated
  with check (sender = 'cliente' and sender_user = (select auth.uid())
              and exists (select 1 from public.conversations c where c.workspace_id = messages.workspace_id and c.id = messages.conversation_id and c.shopper_id = (select auth.uid()) and not c.closed));

create policy "cada um lê suas notificações" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "cada um marca como lida" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- contadores de não lidas e data da última mensagem, mantidos pelo banco
create or replace function private.on_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         unread_store = unread_store + case when new.sender = 'cliente' then 1 else 0 end,
         unread_shopper = unread_shopper + case when new.sender = 'loja' then 1 else 0 end
   where workspace_id = new.workspace_id and id = new.conversation_id;
  return new;
end;
$$;
create trigger messages_after_insert after insert on public.messages for each row execute function private.on_message();

-- marcar conversa como lida (cada lado zera o próprio contador)
create or replace function public.mark_conversation_read(ws uuid, conv text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.conversations%rowtype;
begin
  select * into c from public.conversations where workspace_id = ws and id = conv;
  if not found then return; end if;
  if c.shopper_id = (select auth.uid()) then
    update public.conversations set unread_shopper = 0 where workspace_id = ws and id = conv;
    update public.messages set read_at = now() where workspace_id = ws and conversation_id = conv and sender = 'loja' and read_at is null;
  elsif private.is_member(ws) and private.has_feature(ws, 'mensagens') then
    update public.conversations set unread_store = 0 where workspace_id = ws and id = conv;
    update public.messages set read_at = now() where workspace_id = ws and conversation_id = conv and sender = 'cliente' and read_at is null;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.mark_conversation_read(uuid, text) from public, anon;
grant execute on function public.mark_conversation_read(uuid, text) to authenticated;

-- auditoria: mudanças de status de pedido e de pagamento
create or replace function private.audit_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.production_status is distinct from old.production_status or new.online_payment_status is distinct from old.online_payment_status or new.total is distinct from old.total then
    insert into private.audit_log (workspace_id, actor, action, entity, entity_id, detail)
    values (new.workspace_id, auth.uid(), 'update', 'order', new.id, jsonb_build_object(
      'producao', jsonb_build_array(old.production_status, new.production_status),
      'pagamento', jsonb_build_array(old.online_payment_status, new.online_payment_status),
      'total', jsonb_build_array(old.total, new.total)));
  end if;
  return new;
end;
$$;
create trigger orders_audit after update on public.orders for each row execute function private.audit_order();

-- Realtime: pedidos novos e mensagens chegam ao painel sem recarregar
alter publication supabase_realtime add table public.orders, public.messages, public.conversations, public.notifications, public.payments;
