import type { ReactNode } from 'react';
import { Boxes, Calculator, Cake, ClipboardList, CreditCard, Factory, Flame, LayoutDashboard, Package, ScrollText, Settings, ShoppingBag, ShoppingCart, Store, Users, Wallet, Wheat } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  highlight?: boolean;
  /** extra words the command palette matches on */
  keywords?: string;
}

// daily work (orders, customers, money) comes first; set-up screens further down
export const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Visão geral', items: [{ to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} />, keywords: 'inicio resumo painel' }] },
  {
    group: 'Vendas',
    items: [
      { to: '/pedidos', label: 'Pedidos', icon: <ShoppingBag size={18} />, keywords: 'encomendas entregas orcamentos' },
      { to: '/clientes', label: 'Clientes', icon: <Users size={18} /> },
      { to: '/financeiro', label: 'Financeiro', icon: <Wallet size={18} />, keywords: 'dinheiro caixa entradas saidas pagamentos' },
      { to: '/loja-online', label: 'Loja online', icon: <Store size={18} />, keywords: 'cardapio site frete' },
    ],
  },
  {
    group: 'Produção',
    items: [
      { to: '/fichas', label: 'Fichas técnicas', icon: <ClipboardList size={18} />, keywords: 'receitas produtos' },
      { to: '/fichas?aba=bolos', label: 'Bolos de aniversário', icon: <Cake size={18} />, keywords: 'massa recheio cobertura tamanhos' },
      { to: '/producoes', label: 'Produções', icon: <Factory size={18} /> },
      { to: '/estoque', label: 'Estoque', icon: <Boxes size={18} /> },
      { to: '/ingredientes', label: 'Ingredientes', icon: <Wheat size={18} />, keywords: 'insumos' },
      { to: '/materiais', label: 'Embalagens e adesivos', icon: <Package size={18} />, keywords: 'materiais caixas' },
      { to: '/compras', label: 'Compras', icon: <ShoppingCart size={18} />, keywords: 'mercado fornecedor' },
    ],
  },
  {
    group: 'Ferramentas',
    items: [
      { to: '/assistente', label: 'Assistente de Precificação', icon: <Calculator size={18} />, highlight: true, keywords: 'preco margem lucro custo' },
      { to: '/custos', label: 'Custos operacionais', icon: <Flame size={18} />, keywords: 'gas energia agua mao de obra fixos' },
    ],
  },
  {
    group: 'Sistema',
    items: [
      { to: '/historico', label: 'Histórico', icon: <ScrollText size={18} />, keywords: 'atividade log' },
      { to: '/configuracoes', label: 'Configurações', icon: <Settings size={18} />, keywords: 'backup tema whatsapp' },
      { to: '/plano', label: 'Plano e assinatura', icon: <CreditCard size={18} />, keywords: 'assinatura cobranca mensalidade pagamento pix cartao' },
    ],
  },
];
