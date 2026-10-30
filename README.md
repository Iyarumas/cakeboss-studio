<p align="center">
  <img src="docs/banner.svg" alt="CakeBoss Studio — gestão de confeitaria e loja online" width="100%">
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=flat-square">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white&style=flat-square">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white&style=flat-square">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square">
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-3D-000000?logo=threedotjs&logoColor=white&style=flat-square">
  <img alt="Testes" src="https://img.shields.io/badge/testes-34%20passando-059669?style=flat-square">
</p>

<p align="center">
  <b>Sistema de gestão para confeitaria artesanal + loja online para os clientes.</b><br>
  Descubra quanto custa cada bolo de verdade, defina o preço com segurança e receba pedidos pela loja.
</p>

---

## ✨ Destaques

| | |
|---|---|
| 🧮 **Assistente de Precificação** | Custo real de cada produto — ingredientes, embalagens, gás, energia, água, mão de obra e custos fixos — com margem, preço mínimo e preço sugerido em tempo real. |
| 🎂 **Bolos de aniversário montados** | O cliente escolhe tamanho, massa, recheios e cobertura; o preço sai das fichas técnicas de cada parte. Com 2 recheios, 3 camadas de massa. |
| 🛍️ **Loja online com 3D** | Cardápio com bolo em 3D que gira ao rolar a página, fotos, sabores e tamanhos, frete por cidade e regras de pagamento. |
| 📦 **Estoque que se cuida** | Compras somam ao estoque, a produção desconta sozinha e um aviso aparece quando algo está acabando. |
| 🧁 **Mascotes** | Docinho, Brigadinho e Mila andam pelos espaços vazios da tela, avisam pedidos novos e dão dicas — um ou dois, cada um cuidando de uma área. |

## 🍰 Funcionalidades

<details open>
<summary><b>Gestão da confeitaria</b></summary>

- **Dashboard** com indicadores, prévia de preço, próximos pedidos, estoque baixo e atividade recente.
- **Custos operacionais**: gás por botijão (preço e tamanho) ou por boleto do gás encanado, energia, água, valor da hora de trabalho, custos fixos rateados por hora e taxas de venda.
- **Ingredientes, embalagens e adesivos** com custo por grama/ml/unidade, histórico de preços e estoque mínimo.
- **Compras**: “comprei 50 caixas de leite condensado” → estoque, custo e financeiro atualizados de uma vez.
- **Fichas técnicas** com rendimento, tempo de preparo, equipamentos e perdas.
- **Produções** com custo histórico gravado e baixa no estoque.
- **Pedidos** do orçamento à entrega, com custo congelado na confirmação, pagamentos (parcial/total) e taxa do cartão lançada automaticamente.
- **Clientes** com ficha completa: total comprado, ticket médio, lucro gerado, frequência e produtos favoritos.
- **Financeiro**: entradas, saídas, saldo, valores a receber e lucro dos pedidos entregues.
- **WhatsApp**: mensagens prontas (pedido confirmado, pronto, lembrete de Pix…) preenchidas com os dados do pedido.
</details>

<details>
<summary><b>Assistente de Precificação</b></summary>

- Montagem do produto, composição dos custos (gráfico de rosca + barras animadas com a origem de cada valor) e painel de preço e lucro.
- **Preço e margem ligados**: digite o preço e veja a margem — ou escolha a margem e veja o preço.
- Margem de lucro, margem de contribuição, **lucro sobre o custo** e markup lado a lado.
- **Simulador de cenários**: ingrediente mais caro, desconto, outro fornecedor, embalagem mais barata… sem alterar os dados oficiais.
- Aplicar preço à ficha técnica só com confirmação, com histórico.
</details>

<details>
<summary><b>Loja online (<code>/loja</code>)</b></summary>

- Cardápio com fotos, janela do produto com zoom e **prévia do valor** conforme sabores e tamanhos.
- **Monte seu bolo**: o bolo vai se formando em camadas na tela enquanto o cliente escolhe.
- Cadastro do cliente (nome completo, WhatsApp, e-mail, endereço) que cai direto em **Clientes**.
- Vendas apenas para **Navegantes e cidades vizinhas**, com frete por cidade.
- **Entrega**: só Pix ou cartão de crédito, pagos antes da produção. **Retirada**: Pix, cartão ou dinheiro.
- Pedidos chegam em **Pedidos** com a etiqueta *loja* — e os mascotes comemoram.
</details>

## 🧠 Como o preço é calculado

```text
custo direto     = ingredientes + embalagens/adesivos + gás + energia + água + mão de obra + perdas
custo unitário   = custo da produção ÷ unidades aproveitáveis
rateio fixo      = custos fixos do mês ÷ horas produtivas × horas de preparo   (nunca contado duas vezes)
preço mínimo     = custo unitário ÷ (1 − taxas de venda)
preço sugerido   = custo unitário ÷ (1 − taxas de venda − margem desejada)

bolo montado     = (N + 1) camadas de massa + N recheios + cobertura + extras do tamanho
                   (quantidades de cada parte definidas pela confeiteira para cada tamanho)
```

As regras ficam em [`src/lib/pricing.ts`](src/lib/pricing.ts) e [`src/lib/cake.ts`](src/lib/cake.ts), cobertas por testes.

## 🚀 Como rodar

Requer [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install
npm run dev
```

| | Endereço |
|---|---|
| Área da confeitaria | `http://localhost:5173/` |
| Loja dos clientes | `http://localhost:5173/loja` |

> Os dados ficam no navegador **e no endereço exato** (incluindo a porta). Use sempre o mesmo endereço e faça backups em **Configurações → Dados**.

```bash
npm test        # testes (Vitest)
npm run build   # versão de produção em dist/
npm run lint
```

## 🗂️ Estrutura

```text
src/
├─ lib/          regras de negócio: preços, pedidos, loja, bolos montados, WhatsApp
├─ store/        dados (navegador), ações e dados de exemplo
├─ components/   interface compartilhada, gráficos, editores, mascotes
├─ pages/        telas da área da confeitaria
├─ shop/         loja online (cena 3D, produto, bolo montado, carrinho, checkout)
└─ layout/       menu lateral e estrutura
```

## 🛣️ Próximos passos

- [ ] Banco de dados na nuvem (Supabase) para clientes comprarem do próprio celular
- [ ] Login com Google
- [ ] Pagamento pelo **Mercado Pago** (Pix com QR Code e cartão dentro da loja)
- [ ] Contato de suporte em [`src/config.ts`](src/config.ts)

> **Modo demonstração:** hoje a loja funciona de ponta a ponta, mas cadastros e pedidos ficam salvos apenas no navegador onde foram feitos.

## 🧰 Tecnologias

React 19 · TypeScript · Vite · Tailwind CSS · Motion · Recharts · React Three Fiber / Three.js · Lucide · Vitest

---

<p align="center">Feito com 💖 para quem transforma açúcar em sorriso. · Projeto privado — todos os direitos reservados.</p>
