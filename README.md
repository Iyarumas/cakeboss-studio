# DoceGestão

Sistema de gestão de confeitaria com loja online para os clientes.

- **Área da confeitaria** (`/`): custos, fichas técnicas, Assistente de Precificação, pedidos, clientes, financeiro, estoque, compras e mascotes.
- **Loja dos clientes** (`/loja`): cardápio com bolo em 3D, cadastro/login, carrinho, frete por cidade e regras de pagamento.

## Como abrir

Precisa do [Node.js](https://nodejs.org) instalado (versão 20 ou mais nova).

Na primeira vez, instale as dependências dentro da pasta `docegestao`:

```bash
npm install
```

Depois, para abrir o sistema:

```bash
npm run dev
```

O terminal mostra um endereço, normalmente `http://localhost:5173`. Abra no navegador:

| O quê | Endereço |
|---|---|
| Área da confeitaria | `http://localhost:5173/` |
| Loja dos clientes | `http://localhost:5173/loja` |

Dentro da área da confeitaria, o botão **“Ver loja dos clientes”** (no fim do menu lateral) abre a loja numa aba nova.

Para parar, aperte `Ctrl + C` no terminal.

## Onde ficam os dados

Hoje tudo fica salvo **no navegador deste computador** (modo demonstração):

- Limpar os dados do navegador apaga tudo — use **Configurações → Dados → Exportar backup** com frequência. Para restaurar, **Importar backup**.
- A loja funciona de ponta a ponta, mas só neste navegador: cadastros e pedidos feitos em outro aparelho não chegam à confeitaria.

## Primeiros passos

1. **Custos operacionais**: preço do botijão (ou boleto do gás), energia, água, sua hora de trabalho e custos fixos.
2. **Ingredientes** e **Embalagens e adesivos**: preço, tamanho da embalagem, estoque e quando avisar que está acabando. Use **Compras** a cada compra.
3. **Fichas técnicas**: a receita de um lote e quanto rende.
4. **Assistente de Precificação**: veja custo, lucro e margem e aplique o preço oficial.
5. **Loja online**: cidades e frete, endereço de retirada, WhatsApp, antecedência, fotos e opções (sabores/tamanhos) dos produtos.
   - **Bolos de aniversário** (em Fichas técnicas → aba “Bolos de aniversário”): crie uma ficha técnica para 1 receita de cada massa, recheio e cobertura; cadastre os tamanhos dizendo quantas receitas cada um leva (massa e recheio por camada, cobertura no bolo todo, extras como caixa). Na loja o cliente monta o bolo e vê a prévia do valor. Com N recheios o bolo tem N + 1 camadas de massa.
6. **Configurações**: chave Pix, mensagens do WhatsApp e mascotes.

## Regras da loja

- Vendas só para Navegantes e cidades vizinhas configuradas em **Loja online** (cidade sem frete preenchido não aparece).
- **Entrega**: só Pix ou cartão de crédito, pagos antes da produção.
- **Retirada**: Pix, cartão ou dinheiro na retirada.
- Dinheiro na entrega só combinando pelo WhatsApp.
- Pedidos da loja chegam em **Pedidos** como “Orçamento” (aguardando confirmação) com a etiqueta **loja**.

## Ainda não feito (precisa de nuvem)

- Banco de dados online (Supabase), para clientes comprarem do próprio celular.
- Login com Google.
- Pagamento pelo Mercado Pago (Pix com QR Code e cartão dentro da loja).
- Contato do suporte: preencher WhatsApp e e-mail em `src/config.ts`.

## Para desenvolvedores

```bash
npm test        # testes dos cálculos (vitest)
npm run build   # versão de produção em dist/
npm run lint
```

React 19 + TypeScript + Vite, Tailwind CSS, Motion, Recharts e React Three Fiber (cena 3D da loja, carregada só em `/loja`). Os cálculos de preço ficam em `src/lib/pricing.ts`.
