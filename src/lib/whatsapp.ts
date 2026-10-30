import { money } from './format';
import type { MessageTemplate, Order } from './types';

export const TEMPLATE_VARS: { key: string; label: string; scope: 'pedido' | 'geral' }[] = [
  { key: 'cliente', label: 'primeiro nome do cliente', scope: 'geral' },
  { key: 'confeitaria', label: 'nome da confeitaria', scope: 'geral' },
  { key: 'pix', label: 'chave Pix', scope: 'geral' },
  { key: 'pedido', label: 'número do pedido', scope: 'pedido' },
  { key: 'itens', label: 'lista de itens', scope: 'pedido' },
  { key: 'total', label: 'total do pedido', scope: 'pedido' },
  { key: 'falta_pagar', label: 'quanto falta pagar', scope: 'pedido' },
  { key: 'entrega', label: 'data e hora da entrega', scope: 'pedido' },
];

export const defaultTemplates = (): MessageTemplate[] => [
  {
    id: 'tpl-orcamento',
    name: 'Orçamento',
    scope: 'pedido',
    text: 'Olá, {cliente}! Segue o orçamento do seu pedido:\n{itens}\n\nTotal: {total}\nEntrega: {entrega}\n\nPosso confirmar? 😊',
  },
  {
    id: 'tpl-confirmado',
    name: 'Pedido confirmado',
    scope: 'pedido',
    text: 'Oi, {cliente}! Seu pedido #{pedido} está confirmado ✅\n{itens}\n\nEntrega: {entrega}\nTotal: {total}',
  },
  {
    id: 'tpl-pagamento',
    name: 'Lembrete de pagamento',
    scope: 'pedido',
    text: 'Oi, {cliente}! Para garantir o pedido #{pedido}, falta pagar {falta_pagar}.\nChave Pix: {pix}\n\nQualquer dúvida, é só chamar!',
  },
  {
    id: 'tpl-pronto',
    name: 'Pedido pronto',
    scope: 'pedido',
    text: 'Oi, {cliente}! Seu pedido #{pedido} está pronto 🎂\nPodemos combinar a retirada/entrega?',
  },
  {
    id: 'tpl-obrigado',
    name: 'Agradecimento',
    scope: 'geral',
    text: 'Oi, {cliente}! Obrigada pela preferência 💕\nSe puder, conta pra gente o que achou. Até a próxima!\n{confeitaria}',
  },
];

/** Brazilian phone → digits with country code (55) for wa.me; returns '' when it can't be a valid number. */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 && d.length <= 13 ? d : '';
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

const deliveryFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function orderVars(order: Order, totals: { total: number; remaining: number }): Record<string, string> {
  return {
    pedido: String(order.number),
    itens: order.items.map((i) => `• ${i.qty}× ${i.name}`).join('\n'),
    total: money(totals.total),
    falta_pagar: money(totals.remaining),
    entrega: deliveryFmt.format(new Date(order.deliveryAt)).replace(',', ''),
  };
}

/** Replaces {variables}; unknown or empty ones are left visible so the user notices before sending. */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] ? vars[k] : m));
}

export const missingVars = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

export const waLink = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
