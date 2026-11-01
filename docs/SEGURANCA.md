# Revisão de segurança · 01/11/2026

## O que foi verificado

| Item | Resultado |
|---|---|
| Dependências do app (`npm audit --omit=dev`) | 0 vulnerabilidades |
| Segredos no repositório (chaves de serviço, tokens do Mercado Pago/Stripe, chaves privadas) | nenhum; `.env.local` fica fora do Git, só a chave publicável vai para o navegador |
| Isolamento entre confeitarias (RLS) | 10 testes de isolamento no Postgres local (`supabase/tests`) passando; cada tabela filtra por confeitaria |
| Funções de cobrança | só a chave de serviço (Edge Function) chama `billing_prepare_checkout`, `billing_attach`, `billing_start_trial`, `billing_apply`; app e visitantes não conseguem |
| Avisos do gateway | assinatura HMAC conferida, aviso com mais de 10 min recusado, estado relido na API do Mercado Pago, cada evento aplicado uma vez só |
| Cabeçalhos do site (Vercel) | CSP (só scripts do próprio site; conexões só com o Supabase do projeto), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` |
| Login | bloqueio por senha errada (3 → 30 min, 6 em 24 h → 24 h) por e-mail e rede, migração `…1100_login_lockout.sql` |

## Avisos do Supabase que são esperados

- Funções `security definer` chamáveis por quem está logado (`choose_plan`, `create_workspace`, `my_workspace_access`…): cada uma confere por dentro se a pessoa é membro ou gestora da confeitaria.
- `get_store` e `slug_available` abertas a visitantes: devolvem só a vitrine pública e se um endereço está livre.
- `order_counters` e `platform_admins` sem políticas: ninguém acessa pela API, de propósito.

## Pendências (precisam do dono do projeto)

1. **Aplicar a migração `20261101001100_login_lockout.sql`** no Supabase. Sem ela o app entra normalmente, só sem o bloqueio.
2. **Supabase → Authentication → URL Configuration:** Site URL e Redirect URLs com `https://cakeboss-studio.vercel.app`.
3. **Proteção contra senhas vazadas** (Authentication → Passwords): disponível a partir do plano Pro.
4. **Bloqueio de login no próprio servidor de autenticação** (Password Verification Hook): só nos planos Team/Enterprise. No plano grátis o bloqueio vale para quem usa o app; o Supabase continua limitando tentativas por IP.
5. **Remover `save_workspace_data`** (gravação antiga em bloco) aplicando `supabase/migrations/later/20261101000900_retire_blob.sql` quando todas as contas já estiverem nas tabelas novas.
6. Recomendado: ativar CAPTCHA no login (Authentication → Attack Protection) antes de divulgar o site.
