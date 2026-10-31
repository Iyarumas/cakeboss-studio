/**
 * The CakeBoss plans as shown to visitors. The database table `plans` is the source of truth for what
 * each plan unlocks (supabase/migrations/…0100); these are the same values for the public pages until
 * the landing reads them from the database. Change a price in both places.
 */
export interface PlanInfo {
  code: 'basico' | 'premium' | 'plus';
  name: string;
  priceCents: number;
  /** who it is for, one sentence */
  forWho: string;
  /** what it includes, as a short paragraph */
  includes: string;
}

export const PLANS: PlanInfo[] = [
  {
    code: 'basico',
    name: 'Básico',
    priceCents: 3990,
    forWho: 'Para organizar a confeitaria e cobrar o preço certo.',
    includes: 'Painel, fichas técnicas e precificação, ingredientes e estoque, pedidos, financeiro e relatórios básicos.',
  },
  {
    code: 'premium',
    name: 'Premium',
    priceCents: 7990,
    forWho: 'Para vender na sua própria loja online.',
    includes: 'Tudo do Básico, mais loja com a sua marca, cardápio, carrinho, checkout com Mercado Pago ou Stripe, entrega e retirada.',
  },
  {
    code: 'plus',
    name: 'Plus',
    priceCents: 12990,
    forWho: 'Para atender clientes sem sair do sistema.',
    includes: 'Tudo do Premium, mais central de mensagens ligada aos pedidos, histórico de atendimento e relatórios avançados.',
  },
];

export const TRIAL_DAYS = 3;

export const planPrice = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
