-- CakeBoss · Aplicar SÓ depois que o app novo (tabelas) estiver publicado e conferido.
-- Fica fora de supabase/migrations de propósito para não ser aplicada por engano.

-- o app antigo não grava mais o bloco único
revoke execute on function public.save_workspace_data(uuid, jsonb, integer) from authenticated;
drop function public.save_workspace_data(uuid, jsonb, integer);

-- o plano agora vem de subscriptions
alter table public.workspaces drop column plan;

-- workspace_data fica como cópia de segurança por 90 dias; depois:
-- drop table public.workspace_data;
