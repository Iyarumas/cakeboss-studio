import { money, pct, qtyBase, relativeDay } from '../../lib/format';
import { isFirm, isOpen, orderTotals } from '../../lib/orders';
import { gasUnitPrice, laborHourly, priceRecipe, type PricingContext } from '../../lib/pricing';
import type { DB } from '../../lib/types';

export interface Tip {
  id: string;
  level: 'alerta' | 'aviso' | 'dica';
  text: string;
  action?: { label: string; to: string };
  /** which mascot handles it when there are two; undefined = general */
  topic?: 'pedidos' | 'financas';
}

const PAGE_TIPS: Record<string, Tip[]> = {
  '/': [{ id: 'p-dash', level: 'dica', text: 'No card do Assistente aqui no painel você testa um preço rapidinho, sem mudar nada oficial.' }],
  '/assistente': [
    { id: 'p-assist-1', level: 'dica', text: 'Preço e margem estão ligados: digite o preço que você quer cobrar e eu mostro a margem na hora.' },
    { id: 'p-assist-2', level: 'dica', text: 'Em "Simular cenários" você testa um ingrediente mais caro ou um desconto sem mexer na ficha.' },
  ],
  '/ingredientes': [{ id: 'p-ing', level: 'dica', text: 'Use "Registrar compra" quando comprar: o estoque sobe e o custo fica atualizado sozinho.' }],
  '/fichas': [{ id: 'p-fichas', level: 'dica', text: 'Duplicar uma ficha é o jeito mais rápido de criar variações, como outro tamanho de bolo.' }],
  '/pedidos': [{ id: 'p-ped', level: 'dica', text: 'Quando o pedido vai para "Em produção", eu baixo os ingredientes do estoque automaticamente.' }],
  '/clientes': [{ id: 'p-cli', level: 'dica', text: 'Clique no nome do cliente para ver tudo o que ele já comprou e de quanto em quanto tempo pede.' }],
  '/financeiro': [{ id: 'p-fin', level: 'dica', text: 'Lance também as despesas da confeitaria aqui para o saldo do mês ficar certinho.' }],
  '/custos': [{ id: 'p-custos', level: 'dica', text: 'Sem sua hora de trabalho configurada, o preço sugerido sai baixo demais. Não esqueça dela!' }],
};

/** Builds the mascot's messages from the real data — never invented numbers. Most urgent first. */
export function buildTips(db: DB, ctx: PricingContext, pathname: string, name = 'Docinho', now = new Date()): Tip[] {
  const tips: Tip[] = [];

  // orders created in the last 48h (until the user has seen the message, they keep the badge on)
  for (const o of db.orders) {
    if (o.status === 'cancelado' || now.getTime() - new Date(o.createdAt).getTime() > 48 * 3600_000) continue;
    tips.push({
      id: `new-${o.id}`,
      level: 'aviso',
      topic: 'pedidos',
      text: `Chegou pedido novo, eba! 🎉 #${o.number}${o.customerName ? ` de ${o.customerName}` : ''} · ${o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')} · entrega ${relativeDay(o.deliveryAt)}.`,
      action: { label: 'Abrir pedido', to: `/pedidos?pedido=${o.id}` },
    });
  }
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 1);
  soon.setHours(23, 59, 59, 999);

  for (const o of db.orders) {
    if (!isOpen(o.status) || o.status === 'orcamento') continue;
    const when = new Date(o.deliveryAt);
    const who = o.customerName || 'sem cliente';
    if (when < now)
      tips.push({ id: `late-${o.id}`, topic: 'pedidos', level: 'alerta', text: `O pedido #${o.number} (${who}) está atrasado — era para ${relativeDay(o.deliveryAt)}.`, action: { label: 'Abrir pedido', to: `/pedidos?pedido=${o.id}` } });
    else if (when <= soon && o.status === 'confirmado')
      tips.push({ id: `prod-${o.id}`, topic: 'pedidos', level: 'aviso', text: `O pedido #${o.number} (${who}) é para ${relativeDay(o.deliveryAt)} e ainda não entrou em produção.`, action: { label: 'Abrir pedido', to: `/pedidos?pedido=${o.id}` } });
  }

  for (const o of db.orders) {
    if (o.status !== 'entregue') continue;
    const t = orderTotals(o, db.transactions, db.recipes, ctx);
    if (t.remaining > 0.004)
      tips.push({ id: `owed-${o.id}`, topic: 'financas', level: 'aviso', text: `O pedido #${o.number} já foi entregue, mas falta receber ${money(t.remaining)} de ${o.customerName || 'cliente'}.`, action: { label: 'Ver pedido', to: `/pedidos?pedido=${o.id}` } });
  }

  const low = [
    ...db.ingredients.filter((i) => i.minStock > 0 && i.stock <= i.minStock).map((i) => ({ id: i.id, name: i.name, left: qtyBase(Math.max(0, i.stock), i.unit), out: i.stock <= 0 })),
    ...db.materials.filter((m) => m.minStock > 0 && m.stock <= m.minStock).map((m) => ({ id: m.id, name: m.name, left: `${Math.max(0, m.stock)} un`, out: m.stock <= 0 })),
  ];
  for (const x of low.slice(0, 3))
    tips.push({ id: `stock-${x.id}`, topic: 'financas', level: x.out ? 'alerta' : 'aviso', text: x.out ? `Acabou ${x.name}! Melhor comprar antes do próximo pedido.` : `${x.name} está acabando: restam ${x.left}.`, action: { label: 'Registrar compra', to: '/estoque' } });
  if (low.length > 3) tips.push({ id: 'stock-more', topic: 'financas', level: 'aviso', text: `Mais ${low.length - 3} itens estão abaixo do mínimo no estoque.`, action: { label: 'Ver estoque', to: '/estoque' } });

  for (const r of db.recipes) {
    const p = priceRecipe(r, ctx);
    if (r.salePrice != null && r.salePrice > 0 && p.unitProfit < 0)
      tips.push({ id: `loss-${r.id}`, topic: 'financas', level: 'alerta', text: `${r.name} está dando prejuízo: custa ${money(p.unitCost)} e é vendido por ${money(r.salePrice)}.`, action: { label: 'Reprecificar', to: `/assistente?ficha=${r.id}` } });
    else if (r.priceSnapshot && r.priceSnapshot.unitCost > 0) {
      const drift = ((p.unitCost - r.priceSnapshot.unitCost) / r.priceSnapshot.unitCost) * 100;
      if (drift >= 5)
        tips.push({ id: `drift-${r.id}-${Math.round(drift)}`, topic: 'financas', level: 'aviso', text: `O custo de ${r.name} subiu ${pct(drift, 0)} desde que você definiu o preço. Vale revisar.`, action: { label: 'Revisar preço', to: `/assistente?ficha=${r.id}` } });
    }
    if (r.salePrice == null) tips.push({ id: `noprice-${r.id}`, topic: 'financas', level: 'dica', text: `${r.name} ainda não tem preço oficial. Quer que eu ajude a calcular?`, action: { label: 'Precificar', to: `/assistente?ficha=${r.id}` } });
  }

  const s = db.settings;
  if (db.recipes.length && laborHourly(s) <= 0) tips.push({ id: 'cfg-labor', topic: 'financas', level: 'aviso', text: 'Sua hora de trabalho não está configurada, então ela não entra no preço.', action: { label: 'Configurar', to: '/custos' } });
  if (s.equipment.some((e) => e.source === 'gas') && gasUnitPrice(s) <= 0) tips.push({ id: 'cfg-gas', topic: 'financas', level: 'aviso', text: 'Falta o preço do gás nos custos operacionais.', action: { label: 'Configurar', to: '/custos' } });
  if (!db.ingredients.length) tips.push({ id: 'start', level: 'dica', text: `Oi! Eu sou ${name === 'Mila' ? 'a' : 'o'} ${name} 🧁 Vamos começar cadastrando seus ingredientes?`, action: { label: 'Cadastrar', to: '/ingredientes' } });
  if (db.recipes.some((r) => r.sample)) tips.push({ id: 'sample', level: 'dica', text: 'Lembrete: ainda há dados de exemplo. Quando cadastrar os seus, dá para removê-los em Configurações.', action: { label: 'Configurações', to: '/configuracoes' } });

  const firm = db.orders.filter((o) => isFirm(o.status) && new Date(o.deliveryAt) <= soon && new Date(o.deliveryAt) >= new Date(now.toDateString()));
  if (firm.length) tips.push({ id: `soon-${firm.length}`, topic: 'pedidos', level: 'dica', text: `Você tem ${firm.length} entrega${firm.length > 1 ? 's' : ''} entre hoje e amanhã.`, action: { label: 'Ver pedidos', to: '/pedidos' } });

  const key = Object.keys(PAGE_TIPS).find((k) => (k === '/' ? pathname === '/' : pathname.startsWith(k)));
  if (key) tips.push(...PAGE_TIPS[key]);

  if (!tips.length) tips.push({ id: 'ok', level: 'dica', text: 'Tudo em dia por aqui! Se precisar, é só me chamar. 🧁' });

  const rank = { alerta: 0, aviso: 1, dica: 2 };
  return tips.sort((a, b) => rank[a.level] - rank[b.level]);
}
