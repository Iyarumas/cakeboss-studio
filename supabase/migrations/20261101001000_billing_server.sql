-- CakeBoss · Fase 8 · Cobrança das assinaturas pelo servidor
-- O app escolhe o plano (choose_plan); a Edge Function `billing` abre o checkout do gateway e recebe os avisos dele.
-- Tudo continua DESLIGADO enquanto private.billing_settings.enabled = false.

-- Como a assinatura é paga: cartão (cobrança mensal automática) ou Pix (paga um mês por vez)
alter table public.subscriptions add column payment_method text check (payment_method in ('card', 'pix'));

-- Pago, mas o período venceu: o acesso fica mais 3 dias (renovação do cartão atrasa, Pix do mês seguinte) e depois para.
create or replace function private.workspace_features(ws uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.features
      from public.subscriptions s
      join public.plans p on p.code = s.plan_code
     where s.workspace_id = ws
       and (
         (s.status in ('active', 'past_due') and (s.current_period_end is null or s.current_period_end + interval '3 days' > now()))
         or (s.status = 'test_grant' and (s.grant_expires_at is null or s.grant_expires_at > now()))
         or (s.status = 'trialing' and s.trial_ends_at > now())
       )
     order by s.created_at desc
     limit 1
  ), array[]::text[]);
$$;

-- O painel só precisa saber se a cobrança está aberta e quantos dias tem o teste (nada de credenciais)
create or replace function public.billing_info()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('enabled', b.enabled, 'trial_days', b.trial_days) from private.billing_settings b;
$$;
revoke all on function public.billing_info() from public, anon;
grant execute on function public.billing_info() to authenticated;

-- ---------------------------------------------------------------------------
-- Funções só do servidor (Edge Function com a chave de serviço). Ninguém do app as chama.
-- ---------------------------------------------------------------------------

-- Lê a configuração da cobrança (a Edge Function confere antes de falar com o gateway)
create or replace function public.billing_settings_for_server()
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(b) from private.billing_settings b;
$$;

-- Prepara o checkout: confere que quem pediu é gestor e que a assinatura está aguardando pagamento.
create or replace function public.billing_prepare_checkout(ws uuid, uid uuid, method text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.subscriptions%rowtype;
  billing private.billing_settings%rowtype;
  trial boolean;
begin
  select * into billing from private.billing_settings;
  if not billing.enabled then return jsonb_build_object('status', 'billing_not_configured'); end if;
  if method not in ('card', 'pix') then raise exception 'forma de pagamento inválida' using errcode = '22023'; end if;
  if not exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = uid and m.role in ('owner', 'admin')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.subscriptions where workspace_id = ws and status = 'pending_payment' order by created_at desc limit 1;
  if not found then raise exception 'nenhum plano aguardando pagamento' using errcode = 'P0001'; end if;
  update public.subscriptions set payment_method = method, provider = billing.provider, updated_at = now() where id = s.id;
  -- teste só no Básico, só no cartão, só se a confeitaria nunca teve teste
  trial := method = 'card' and s.plan_code = 'basico' and billing.trial_days > 0
           and not exists (select 1 from public.subscriptions x where x.workspace_id = ws and x.trial_ends_at is not null);
  return jsonb_build_object('status', 'pending_payment', 'subscription_id', s.id, 'plan', s.plan_code, 'price_cents', s.price_cents,
                            'provider', billing.provider, 'mode', billing.mode, 'trial_days', case when trial then billing.trial_days else 0 end,
                            'email', (select u.email from auth.users u where u.id = uid),
                            'plan_name', (select p.name from public.plans p where p.code = s.plan_code));
end;
$$;

-- Guarda o id que o gateway deu à assinatura (cartão) para ligar os avisos seguintes a ela
create or replace function public.billing_attach(sub uuid, prov text, provider_sub_id text)
returns void language sql security definer set search_path = '' as $$
  update public.subscriptions set provider = prov, provider_subscription_id = provider_sub_id, updated_at = now()
   where id = sub and status = 'pending_payment';
$$;

-- Teste grátis do Básico, depois que o gateway confirmou o cartão
create or replace function public.billing_start_trial(sub uuid, prov text, card_fingerprint text, provider_sub_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  select workspace_id into ws from public.subscriptions where id = sub;
  if ws is null then return false; end if;
  return private.start_trial(ws, prov, card_fingerprint, provider_sub_id);
end;
$$;

-- Aplica um aviso do gateway JÁ CONFERIDO na API dele (nunca o corpo do aviso cru).
-- Idempotente: o mesmo evento (provider, event_id) só vale uma vez.
create or replace function public.billing_apply(sub uuid, prov text, event_id text, new_status text, period_end timestamptz,
                                                 amount_cents integer, transaction_id text, kind text, detail jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  s public.subscriptions%rowtype;
  billing private.billing_settings%rowtype;
begin
  select * into billing from private.billing_settings;
  if not billing.enabled then raise exception 'cobrança desligada' using errcode = 'P0001'; end if;
  if new_status not in ('active', 'past_due', 'canceled', 'expired', 'pending_payment') then raise exception 'estado inválido' using errcode = '22023'; end if;
  select * into s from public.subscriptions where id = sub for update;
  if not found then return false; end if;

  begin
    insert into public.billing_events (subscription_id, workspace_id, kind, status, amount_cents, provider, provider_event_id, provider_transaction_id, detail)
    values (s.id, s.workspace_id, kind,
            case when new_status = 'active' and amount_cents is not null then 'approved'
                 when new_status = 'past_due' then 'rejected' else 'info' end,
            amount_cents, prov, event_id, transaction_id, coalesce(detail, '{}'::jsonb));
  exception when unique_violation then
    return false; -- já aplicado
  end;

  update public.subscriptions set
    status = new_status,
    provider = prov,
    current_period_start = case when new_status = 'active' and amount_cents is not null then now() else current_period_start end,
    current_period_end = coalesce(period_end, current_period_end),
    canceled_at = case when new_status = 'canceled' then now() else canceled_at end,
    updated_at = now()
   where id = s.id;
  return true;
end;
$$;

revoke all on function public.billing_settings_for_server(), public.billing_prepare_checkout(uuid, uuid, text), public.billing_attach(uuid, text, text),
  public.billing_start_trial(uuid, text, text, text), public.billing_apply(uuid, text, text, text, timestamptz, integer, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.billing_settings_for_server(), public.billing_prepare_checkout(uuid, uuid, text), public.billing_attach(uuid, text, text),
  public.billing_start_trial(uuid, text, text, text), public.billing_apply(uuid, text, text, text, timestamptz, integer, text, text, jsonb)
  to service_role;
