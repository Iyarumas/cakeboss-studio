-- CakeBoss · Bloqueio por senha errada
--   3 erros → 30 minutos sem poder entrar
--   mais 3 erros depois disso (6 em 24 h) → 24 horas sem poder entrar
-- A contagem é por e-mail E por rede (IP): quem erra a senha de outra pessoa de outro lugar não bloqueia o acesso dela.
-- O e-mail fica guardado só como hash. Entrar com sucesso zera a contagem daquela rede.
-- Observação: no plano grátis do Supabase o login não passa por um gancho do servidor; este bloqueio vale para o app.
-- O Supabase continua com o próprio limite de tentativas por IP.

create table private.login_failures (
  email_hash text not null,
  ip text not null,
  failed_at timestamptz not null default now()
);
create index login_failures_lookup on private.login_failures (email_hash, ip, failed_at desc);

create or replace function private.login_key(email text)
returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(lower(trim(coalesce(email, ''))), 'UTF8')), 'hex');
$$;

-- IP de quem chamou, como o PostgREST repassa (primeiro endereço do x-forwarded-for)
create or replace function private.request_ip()
returns text language sql stable set search_path = '' as $$
  select coalesce(nullif(trim(split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1)), ''), 'desconhecido');
$$;

-- Até quando está bloqueado (null = liberado)
create or replace function private.login_locked_until(key text, ip text)
returns timestamptz language plpgsql stable set search_path = '' as $$
declare
  n integer;
  last_fail timestamptz;
begin
  select count(*), max(failed_at) into n, last_fail
    from private.login_failures f
   where f.email_hash = key and f.ip = login_locked_until.ip and f.failed_at > now() - interval '24 hours';
  if n > 5 and last_fail + interval '24 hours' > now() then return last_fail + interval '24 hours'; end if;
  -- the 3rd mistake locks for 30 minutes; afterwards there are 3 more tries before the 24-hour lock
  if n between 3 and 5 and n % 3 = 0 and last_fail + interval '30 minutes' > now() then return last_fail + interval '30 minutes'; end if;
  return null;
end;
$$;

-- Antes de tentar: está bloqueado?
create or replace function public.login_lock_status(email text)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select private.login_locked_until(private.login_key(email), private.request_ip());
$$;

-- Depois de errar a senha: registra e devolve até quando ficou bloqueado
create or replace function public.login_failed(email text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  key text := private.login_key(email);
  ip text := private.request_ip();
  locked timestamptz := private.login_locked_until(key, ip);
begin
  -- já bloqueado: não conta de novo (não prolonga o bloqueio a cada clique)
  if locked is not null then return locked; end if;
  insert into private.login_failures (email_hash, ip) values (key, ip);
  delete from private.login_failures where failed_at < now() - interval '2 days';
  return private.login_locked_until(key, ip);
end;
$$;

-- Depois de entrar: zera a contagem do próprio e-mail nesta rede (só quem está logado com aquele e-mail)
create or replace function public.login_succeeded()
returns void language sql security definer set search_path = '' as $$
  delete from private.login_failures
   where email_hash = private.login_key(auth.jwt() ->> 'email') and ip = private.request_ip();
$$;

revoke all on function public.login_lock_status(text), public.login_failed(text), public.login_succeeded() from public;
grant execute on function public.login_lock_status(text), public.login_failed(text) to anon, authenticated;
grant execute on function public.login_succeeded() to authenticated;
