# CakeBoss — Design system

Fase 3 · 01/11/2026 · Fonte dos fatos de produto: `PRODUCT.md`. Tokens no código: `src/index.css`, `tailwind.config.js`, `src/design/motion.ts`, `src/lib/theme.ts`.

Skills usadas: **Impeccable** (contexto de produto, modos por superfície, piso de acabamento), **Taste Skill** (estilo de tela de app sorteado: *Framed sheet*, seed 1096956277), **UI UX Pro Max** (consulta de sistema; a sugestão escura/azul-marinho com fonte mono foi descartada por contrariar a marca, e a de chocolate e creme confirmou os neutros), **Emil Kowalski** (movimento).

---

## 1. Um mundo, três superfícies

O mundo visual sai do **logo**: chocolate, creme, cereja — e do **rosa da marca**, mantido por decisão do proprietário. O rosa é o acento; chocolate e creme tingem os neutros.

| Superfície | Modo | O que manda | Tipografia |
|---|---|---|---|
| **Painel** (`/painel`) | Operar | Clareza, ritmo de trabalho, dados em primeiro plano. Cor nos dados, não na moldura. | Figtree em tudo |
| **Landing do CakeBoss** (`/`) | Persuadir | Uma ideia tirada do ofício (Fase 4, com sorteio de direção da Taste Skill e concept-seed do Impeccable). | Bricolage Grotesque (títulos) + Figtree |
| **Loja de cada confeitaria** (`/loja/:slug`) | Persuadir/Experiência | As fotos e a marca da confeitaria lideram; o CakeBoss some. | Bricolage + Figtree, cor da confeitaria |

O atributo `data-surface="landing" | "shop"` liga a voz de títulos (Bricolage) só nas superfícies que vendem.

## 2. Cor

Valores em `src/index.css` (formato `R G B`, para o Tailwind aplicar transparência).

| Papel | Claro | Escuro | Uso |
|---|---|---|---|
| `bg` (moldura) | `#F6F3EF` | `#120E0C` | Menu lateral, barra do topo, fundo da página |
| `surface` (folha) | `#FFFFFF` | `#1B1613` | Área de trabalho e cartões |
| `subtle` | `#F8F6F3` | `#221C18` | Um degrau de tom dentro da folha |
| `line` / `divider` | `#E9E4DF` / `#F1EDE9` | `#3A302A` / `#2C241F` | Bordas de 1px; separação por tom antes de linha |
| `ink` | `#1F1814` | `#F4EEE9` | Texto (chocolate escuro) |
| `muted` | `#6E625B` | `#B3A69C` | Texto secundário |
| `pink` (preenchimento) | `#DB2777` | `#D6337F` | Botão principal, seleção, série principal dos gráficos |
| `pink-ink` (texto) | `#BE185D` | `#F0609F` | Rosa usado como texto — `text-pink` aponta para cá automaticamente |
| `pink-deep` | `#9D174D` | `#9D174D` | Fim do degradê do botão "Ver loja dos clientes" (exceção pedida pelo proprietário) |
| `lilac` → **cacau** | `#8A5A3C` | `#D2A07E` | Segunda cor da marca (nome antigo mantido até a Fase 5) |
| `profit` / `loss` / `warn` | `#1E7B4F` / `#C4242A` / `#92400E` | `#4ADE9A` / `#F87171` / `#F5B544` | Significado, nunca decoração |

Contrastes medidos: texto 17,5:1 · secundário 5,9:1 · branco sobre rosa 4,6:1 · rosa-texto sobre o próprio tom claro ≥ 4,5:1 · escuro: texto 15,6:1, rosa-texto 5,9:1, branco sobre rosa 4,5:1.

**Regras**
- **Cor vai nos dados, não na moldura** (Taste: menos de 3% de pixels coloridos no painel). Moldura e menu são neutros; o rosa marca a ação principal, a seleção e a série principal.
- Verde, vermelho e âmbar só dizem bom, ruim e atenção.
- Sem violeta ou índigo (o antigo lilás virou cacau). Sem degradês, exceto o botão "Ver loja dos clientes".
- **Cor por confeitaria:** `src/lib/theme.ts` gera `--pink`, `--pink-ink`, `--pink-soft`, `--pink-deep` e cacau para qualquer cor escolhida, já corrigidos para contraste no claro e no escuro.

## 3. Tipografia

- **Figtree** (variável, embutida no app): toda a interface do painel, um só tipo. Corpo 14px, título de tela 22px, seção 16px, número de destaque 28px, rótulo 12px. Números com `tabular-nums`. Frases em caixa normal, sem rótulos em caixa alta espaçada.
- **Bricolage Grotesque** (variável, tamanho óptico): títulos da landing e da loja. Tracking −0,02em.
- No máximo dois tipos por superfície.

## 4. Forma e profundidade

- **Painel em "folha emoldurada":** o menu e a barra do topo dividem a mesma moldura tingida, sem linha entre eles; o trabalho fica numa folha branca com borda de 1px e cantos de 16px (`rounded-sheet`). A estrutura da casca é implementada na Fase 5.
- Raios: cartão 10px (`rounded-card`), controles 8px (`rounded-control`), folha 16px. Botões: um único formato em todo o produto.
- **Sem sombra no que está parado** (`shadow-card` agora é `none`). Sombra só no que flutua: menus, diálogos, avisos (`shadow-pop`).
- Nada de ícone dentro de quadradinho colorido em indicador, nada de sparkline enfeite, nada de cartões idênticos em fila (a Fase 5 troca os indicadores do Dashboard por números tipográficos).

## 5. Movimento

Tokens em `src/design/motion.ts` (JS) e em variáveis CSS (`--ease-out`, `--dur-fast`…).

| Token | Valor | Uso |
|---|---|---|
| `ease.out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Entradas e respostas |
| `ease.inOut` | `cubic-bezier(0.77, 0, 0.175, 1)` | Algo atravessando a tela |
| `ease.drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Gavetas e folhas |
| `dur.press` / `fast` / `base` / `slow` | 120 / 160 / 220 / 320 ms | Clique, troca de estado, entrada, layout |
| `spring.snappy` | 0,3 s, bounce 0,08 | Abas, indicadores |
| `spring.gentle` | 0,45 s, bounce 0,12 | Modais, gavetas, cartões que mudam de lugar |
| `spring.playful` | 0,5 s, bounce 0,28 | Carrinho, celebração (raro) |

Regras (Emil Kowalski + Impeccable): o que se abre pelo teclado muitas vezes por dia (busca Ctrl+K) **não anima**; interface abaixo de 300 ms; saída mais rápida que entrada; só `transform` e `opacity`; nunca começar de `scale(0)`; botões afundam para `scale(0.97)` ao clicar; `prefers-reduced-motion` mantém fades e tira deslocamentos (`MotionConfig reducedMotion="user"`). Momentos autorais (`dur.showcase`) só na landing e na loja.

## 6. Superfícies do navegador

Seleção de texto, cursor de digitação, anel de foco e barras de rolagem usam a paleta (`src/index.css`).

## 7. O que ainda falta (por fase)

- **Fase 4 — Landing:** direção própria sorteada (Taste `draw.mjs` + Impeccable `concept-seed`), com os três planos e preços.
- **Fase 5 — Painel:** casca *Framed sheet*, indicadores como texto, tabelas sem listras, renomear `lilac` → `cacau`, menus ocultos por plano.
- **Fase 6 — Loja:** tema da confeitaria (já existe `shopTheme` quente) + cor escolhida, fotos em destaque.
- Revisar o aviso do Impeccable sobre fontes muito usadas: Figtree e Bricolage foram escolhidas antes desta fase e ficam por decisão de continuidade da marca.
