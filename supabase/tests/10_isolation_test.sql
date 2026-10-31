-- Testes de isolamento e permissões. Cada bloco falha com exception se a regra não for respeitada.
\set ON_ERROR_STOP on
\set ana '11111111-1111-1111-1111-111111111111'
\set bia '22222222-2222-2222-2222-222222222222'
\set comprador '33333333-3333-3333-3333-333333333333'
\set func '44444444-4444-4444-4444-444444444444'

-- 1. Migração dos dados antigos
do $$ begin
  assert (select count(*) from public.recipes where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1, 'receita não migrou';
  assert (select number from public.orders where id = 'o1') = 7, 'número do pedido mudou';
  assert (select production_status from public.orders where id = 'o1') = 'em_preparo', 'status não foi convertido';
  assert (select total from public.orders where id = 'o1') = 180, 'total errado (175 - 5 + 10)';
  assert (select slug from public.workspaces where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'doces-da-ana', 'slug';
  assert (select plan_code from public.subscriptions where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'premium', 'plano loja → premium';
  assert (select status from public.subscriptions where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'test_grant', 'concessão explícita';
  assert (select count(*) from public.delivery_zones where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1, 'só cidade com taxa vira zona';
  assert (select whatsapp from public.store_settings where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001') = '47999990001', 'whatsapp limpo';
  raise notice 'ok 1: migração dos dados';
end $$;

-- 2. Bia não vê nada da Ana
set role authenticated;
select set_config('request.jwt.claim.sub', :'bia', false);
do $$ begin
  assert (select count(*) from public.recipes) = 0, 'Bia viu receitas da Ana';
  assert (select count(*) from public.orders) = 0, 'Bia viu pedidos da Ana';
  assert (select count(*) from public.customers) = 0, 'Bia viu clientes da Ana';
  assert (select count(*) from public.transactions) = 0, 'Bia viu financeiro da Ana';
  raise notice 'ok 2: isolamento de leitura';
end $$;

-- 3. Bia não consegue gravar na confeitaria da Ana, mesmo informando o workspace_id dela
do $$ begin
  begin
    insert into public.recipes (workspace_id, id, name, composition) values ('aaaaaaaa-0000-0000-0000-000000000001', 'x', 'invasão', '{}');
    raise exception 'FALHOU: Bia gravou receita na Ana';
  exception when insufficient_privilege then null;
  end;
  update public.orders set total = 0 where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  raise notice 'ok 3: isolamento de escrita';
end $$;
reset role;
do $$ begin assert (select total from public.orders where id = 'o1') = 180, 'Bia alterou pedido da Ana'; end $$;

-- 4. Ana não pode mudar o próprio plano nem marcar pagamento online como aprovado
set role authenticated;
select set_config('request.jwt.claim.sub', :'ana', false);
do $$ begin
  begin
    update public.workspaces set plan = 'completo' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise exception 'FALHOU: Ana trocou o plano';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.orders set online_payment_status = 'aprovado' where id = 'o1';
    raise exception 'FALHOU: Ana aprovou pagamento online';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.subscriptions (workspace_id, plan_code, status, price_cents) values ('aaaaaaaa-0000-0000-0000-000000000001', 'plus', 'active', 0);
    raise exception 'FALHOU: Ana criou assinatura ativa';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.transactions (workspace_id, id, date, type, category, amount, source) values ('aaaaaaaa-0000-0000-0000-000000000001', 'fake', now(), 'entrada', 'Vendas', 999, 'gateway');
    raise exception 'FALHOU: Ana criou lançamento de gateway';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok 4: plano e pagamento protegidos';
end $$;

-- 5. Ana usa a gestão normalmente; pedido novo recebe número do banco
do $$ declare n int; begin
  insert into public.orders (workspace_id, id, number, customer_name, delivery_at) values ('aaaaaaaa-0000-0000-0000-000000000001', 'o2', 0, 'Balcão', now() + interval '1 day');
  select number into n from public.orders where id = 'o2';
  assert n = 8, 'número esperado 8, veio ' || n;
  update public.orders set production_status = 'pronto' where id = 'o2';
  raise notice 'ok 5: pedido do painel com número sequencial';
end $$;

-- 6. Recursos por plano: Bia (Básico) não publica loja nem usa mensagens
select set_config('request.jwt.claim.sub', :'bia', false);
do $$ begin
  begin
    update public.store_settings set enabled = true where workspace_id = 'bbbbbbbb-0000-0000-0000-000000000002';
    if (select enabled from public.store_settings where workspace_id = 'bbbbbbbb-0000-0000-0000-000000000002') then
      raise exception 'FALHOU: Básico publicou loja';
    end if;
  exception when insufficient_privilege then null;
  end;
  assert public.my_workspace_access('bbbbbbbb-0000-0000-0000-000000000002')->'features' = '["gestao"]'::jsonb, 'features do básico';
  raise notice 'ok 6: loja bloqueada no Básico';
end $$;

-- 7. Funcionária não exclui nem configura pagamentos
select set_config('request.jwt.claim.sub', :'func', false);
do $$ begin
  delete from public.recipes where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  begin
    perform public.disconnect_payment('aaaaaaaa-0000-0000-0000-000000000001', 'mercadopago');
    raise exception 'FALHOU: funcionária mexeu em pagamentos';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok 7: papel de funcionária';
end $$;
reset role;
do $$ begin assert (select count(*) from public.recipes where workspace_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1, 'funcionária excluiu receita'; end $$;

-- 8. Vitrine pública: Ana (Premium, loja ligada) aparece sem custos; Bia não aparece
set role anon;
do $$ declare s jsonb; begin
  s := public.get_store('doces-da-ana');
  assert s is not null, 'loja da Ana não abriu';
  assert jsonb_array_length(s->'products') = 1, 'produto não apareceu';
  assert not (s::text like '%ingredientId%'), 'vitrine expôs a ficha técnica';
  assert not (s::text like '%Carla%'), 'vitrine expôs cliente';
  assert s->'online_payment' = 'null'::jsonb, 'pagamento online sem gateway conectado';
  assert public.get_store('bolos-da-bia') is null, 'loja do Básico apareceu';
  begin
    perform 1 from public.orders limit 1;
    assert (select count(*) from public.orders) = 0, 'anônimo viu pedidos';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok 8: vitrine pública segura';
end $$;
reset role;

-- 9. Comprador só vê os próprios pedidos
insert into public.shoppers (user_id, name, phone) values (:'comprador', 'Comprador Teste', '47999990009');
update public.orders set shopper_id = :'comprador' where id = 'o1';
set role authenticated;
select set_config('request.jwt.claim.sub', :'comprador', false);
do $$ begin
  assert (select count(*) from public.orders) = 1, 'comprador deveria ver 1 pedido';
  assert (select count(*) from public.order_items) = 1, 'comprador deveria ver os itens';
  assert (select count(*) from public.transactions) = 0, 'comprador viu financeiro';
  assert (select count(*) from public.recipes) = 0, 'comprador viu fichas';
  raise notice 'ok 9: comprador isolado';
end $$;
reset role;

-- 10. Conta nova: teste grátis de 14 dias, uma vez só; depois, sem cobrança, nada pago fica liberado
do $$ declare ws uuid; begin
  insert into auth.users values ('55555555-5555-5555-5555-555555555555', 'nova@teste');
  perform set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
  set local role authenticated;
  ws := public.create_workspace('Doces Novos', '{"settings": {"ownerName": "Nova"}}');
  assert public.my_workspace_access(ws)->'features' = '[]'::jsonb, 'conta sem plano liberou recursos';
  -- Plus não tem teste: fica sem cobrança e sem recursos
  assert public.choose_plan(ws, 'plus') = 'billing_not_configured', 'Plus não deveria ter teste';
  assert public.my_workspace_access(ws)->'features' = '[]'::jsonb, 'Plus sem cobrança liberou recursos';
  reset role;
  delete from public.subscriptions where workspace_id = ws;
  set local role authenticated;
  -- Básico abre o teste
  assert public.choose_plan(ws, 'basico') = 'trialing', 'Básico deveria abrir o teste';
  assert public.my_workspace_access(ws)->'features' = '["gestao"]'::jsonb, 'teste do Básico libera só gestão';
  assert (public.my_workspace_access(ws)#>>'{subscription,trial_ends_at}')::timestamptz between now() + interval '13 days 23 hours' and now() + interval '14 days 1 hour', 'teste de 14 dias';
  -- subir de plano durante o teste exige cobrança
  begin
    perform public.choose_plan(ws, 'premium');
    raise exception 'FALHOU: subiu para Premium no teste';
  exception when raise_exception then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  assert not (public.my_workspace_access(ws)->'features' ? 'loja'), 'Básico em teste liberou loja';
  -- vencimento do teste (simulado pelo servidor)
  reset role;
  update public.subscriptions set trial_ends_at = now() - interval '1 minute' where workspace_id = ws;
  set local role authenticated;
  assert public.my_workspace_access(ws)->'features' = '[]'::jsonb, 'teste vencido continuou liberado';
  assert public.choose_plan(ws, 'premium') = 'billing_not_configured', 'segundo teste não pode existir';
  assert public.my_workspace_access(ws)->'features' = '[]'::jsonb, 'escolha sem cobrança liberou recursos';
  begin
    insert into public.recipes (workspace_id, id, name, composition) values (ws, 'r', 'x', '{}');
    raise exception 'FALHOU: gravou sem plano ativo';
  exception when insufficient_privilege then null;
  end;
  reset role;
  assert not exists (select 1 from public.subscriptions where workspace_id = ws and status in ('active', 'past_due')), 'teste virou pago';
  raise notice 'ok 10: teste grátis de 14 dias, uma vez só, nunca marcado como pago';
end $$;

select 'TODOS OS TESTES PASSARAM' as resultado;
