# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Donas de confeitaria**, em dois perfis atendidos igualmente:
  - a **confeiteira autônoma**, que produz em casa, sozinha ou com ajuda, vende por encomenda e combina tudo pelo WhatsApp;
  - a **pequena confeitaria** com ponto físico e equipe de 2 a 10 pessoas.
  Usam o painel no dia a dia para precificar, organizar pedidos e produção, controlar estoque e dinheiro — muitas vezes pelo celular, entre uma fornada e outra.
- **Funcionárias** da confeitaria, com acesso limitado (sem excluir registros, sem mexer em plano ou pagamentos).
- **Compradores** das lojas virtuais: escolhem doces, montam bolos, pagam e acompanham o pedido; a mesma conta vale em várias lojas.
- **Visitantes da landing page**: confeiteiras avaliando se vale assinar.

## Product Purpose

O CakeBoss é um SaaS de gestão para confeitarias, com loja virtual própria para cada uma. Existe para que a confeiteira saiba **quanto custa e quanto lucra** com cada produto e organize o negócio inteiro sem planilhas. Sucesso: preços que pagam todos os custos, pedidos e produção sob controle, e vendas online recebidas direto na conta da confeitaria.

## Positioning

- **Preço certo de verdade:** o custo de cada produto inclui ingredientes, embalagens, gás (botijão ou encanado), energia, água, mão de obra, custos fixos rateados, perdas e taxas — e o sistema sugere o preço.
- **Tudo num lugar só:** fichas técnicas, estoque, compras, pedidos, produção, clientes, financeiro e loja conectados (a compra entra no estoque e no financeiro; o pedido baixa o estoque ao entrar em produção).
- **Loja própria sem comissão:** a confeitaria vende no próprio endereço `/loja/<nome>` e recebe pelo Mercado Pago ou Stripe na conta dela; o CakeBoss não fica com parte das vendas.
- **Feito para confeitaria:** bolo montado por camadas (massa, recheios, cobertura por tamanho), fichas técnicas e a linguagem do ofício, não um ERP genérico.

## Operating Context

- Encomendas com data e horário de entrega ou retirada; antecedência mínima; entrega por cidade com taxa.
- Comunicação com clientes pelo WhatsApp (mensagens prontas); central de mensagens no plano Plus.
- Uso alternado entre computador (planejamento, financeiro) e celular (pedidos do dia, produção).
- Região inicial: Navegantes (SC) e cidades vizinhas; produto pensado para todo o Brasil (português, R$, Pix).

## Capabilities and Constraints

- Planos: **Básico R$ 39,90/mês** (gestão), **Premium R$ 79,90/mês** (+ loja, checkout online), **Plus R$ 129,90/mês** (+ central de mensagens, relatórios avançados). Teste grátis só do Básico, 3 dias, com cartão cadastrado.
- A cobrança das assinaturas do CakeBoss está **desligada** até o proprietário configurar o gateway; nada pode aparecer como pago sem confirmação real.
- O Básico não tem loja pública.
- Stack existente: Vite + React 19 + TypeScript + Tailwind 3 + Motion for React + Recharts + lucide-react; Supabase; publicação na Vercel.
- Indefinido: como funcionarão as conversas automáticas com clientes; se o Stripe Connect atende confeitarias brasileiras.

## Brand Commitments

- Nome **CakeBoss**.
- **Logo atual** (fatia de bolo de chocolate com cereja, gráfico e moedas; escrita "CakeBoss" em chocolate e creme): `public/brand/cakeboss-logo.webp`, `cakeboss-logo-transparent.webp`, `cakeboss-mark.webp`.
- **Rosa como cor da marca** (`#DB2777` hoje) — mantido por decisão do proprietário.
- Cada confeitaria pode escolher a cor do próprio painel e da própria loja.
- Voz: português do Brasil, direto e caloroso, termos do ofício (ficha técnica, recheio, cobertura, encomenda).

## Evidence on Hand

- Fotos de doces em `public/loja/` (bolo, brownie, chocolate, bolo girando em vídeo) — fornecidas pelo proprietário; a foto do chocolate veio com marca d'água "Meta AI" e deve ser trocada por foto própria antes do lançamento.
- O sistema real (painel, pedidos, precificação) pode ser mostrado como demonstração.
- **Não existem** depoimentos, clientes, números de uso, logos de parceiros ou imprensa — não inventar.

## Product Principles

1. **O número tem que estar certo.** Custo, preço, lucro e pagamento nunca são aproximados nem simulados como se fossem reais.
2. **O dia da confeiteira vem primeiro.** O que precisa ser feito hoje (entregas, produção, pagamentos pendentes) aparece antes de qualquer análise.
3. **Ofício, não planilha.** Telas falam a língua da confeitaria e mostram o produto (o bolo, a receita), não tabelas genéricas.
4. **Cada confeitaria é dona da própria marca e do próprio dinheiro.** Loja com a cara dela, pagamentos na conta dela.
5. **Funciona no celular.** Toda tarefa do dia a dia precisa ser possível com uma mão, entre uma fornada e outra.

## Accessibility & Inclusion

- Contraste WCAG AA, foco visível, navegação por teclado, `prefers-reduced-motion` respeitado.
- Público amplo, nem sempre familiarizado com tecnologia: rótulos visíveis, linguagem simples, alvos de toque de 44px.
