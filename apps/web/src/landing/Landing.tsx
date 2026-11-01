import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { money } from '@cakeboss/domain/format';
import { PLANS, TRIAL_DAYS, planPrice } from '@cakeboss/domain/plans';
import { SAMPLE_QUOTE, landingQuote, type QuoteInput } from './quote';
import { BRAND_DRAFT_KEY } from './draft';
import { BrandLockup, LOGO_SRC } from '../components/BrandMark';
import './landing.css';


/* ---------------------------------------------------------------- the calculator (the live thing) */

type FieldKey = keyof QuoteInput;
const FIELDS: { key: FieldKey; label: string; unit: 'R$' | 'h' | 'min' | '%'; step: number; max: number }[] = [
  { key: 'ingredients', label: 'Ingredientes do bolo', unit: 'R$', step: 0.5, max: 2000 },
  { key: 'packaging', label: 'Caixa, base e fita', unit: 'R$', step: 0.5, max: 500 },
  { key: 'hours', label: 'Seu tempo de preparo', unit: 'h', step: 0.25, max: 48 },
  { key: 'hourly', label: 'Quanto vale sua hora', unit: 'R$', step: 1, max: 500 },
  { key: 'ovenMinutes', label: 'Tempo de forno', unit: 'min', step: 5, max: 600 },
  { key: 'gasCylinder', label: 'Botijão de gás (13 kg)', unit: 'R$', step: 1, max: 400 },
  { key: 'marginPct', label: 'Lucro que você quer', unit: '%', step: 1, max: 80 },
  { key: 'cardFeePct', label: 'Taxa da maquininha', unit: '%', step: 0.1, max: 20 },
];

const SPLIT = [
  { key: 'ingredientes', label: 'Ingredientes', color: '#8a5a3c' },
  { key: 'embalagens', label: 'Embalagem', color: '#c79a74' },
  { key: 'gas', label: 'Gás', color: '#e0b48f' },
  { key: 'maoDeObra', label: 'Sua hora', color: '#2a1a12' },
] as const;

const parse = (s: string) => {
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
const show = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

function Calculator() {
  const [q, setQ] = useState<QuoteInput>(SAMPLE_QUOTE);
  const [text, setText] = useState<Record<FieldKey, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, show(SAMPLE_QUOTE[f.key])])) as Record<FieldKey, string>);
  const r = useMemo(() => landingQuote(q), [q]);
  const valid = q.marginPct + q.cardFeePct < 95 && Number.isFinite(r.suggestedPrice);
  const fee = valid ? r.suggestedPrice * (q.cardFeePct / 100) : 0;
  const profit = valid ? r.suggestedPrice * (q.marginPct / 100) : 0;
  const parts: { label: string; color: string; value: number }[] = [
    ...SPLIT.map((s) => ({ label: s.label, color: s.color, value: r.categories.find((c) => c.key === s.key)?.total ?? 0 })),
    { label: 'Taxa', color: '#f3c7da', value: fee },
    { label: 'Lucro', color: '#db2777', value: profit },
  ];

  const set = (key: FieldKey, raw: string, max: number) => {
    setText((t) => ({ ...t, [key]: raw }));
    const n = parse(raw);
    if (Number.isFinite(n) && n >= 0) setQ((x) => ({ ...x, [key]: Math.min(n, max) }));
  };

  return (
    <div className="calc" data-ui aria-label="Calculadora de preço">
      <div className="calc__head">
        <div>
          <div className="calc__title">Preço sugerido para este bolo</div>
          <div className="calc__price" aria-live="polite">
            {valid ? money(r.suggestedPrice) : '—'}
          </div>
          <div className="calc__min">{valid ? `Abaixo de ${money(r.minPrice)} você paga para trabalhar.` : 'Lucro e taxa somados precisam ficar abaixo de 95%.'}</div>
        </div>
      </div>
      <div className="calc__split" aria-hidden="true">
        {parts.map((p) => (
          <span key={p.label} style={{ flexGrow: Math.max(p.value, 0.0001), background: p.color }} />
        ))}
      </div>
      <div className="calc__legend">
        {parts.map((p) => (
          <span key={p.label}>
            <i style={{ background: p.color }} />
            {p.label} {money(p.value)}
          </span>
        ))}
      </div>
      <div className="calc__grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="calc__field">
            <span>{f.label}</span>
            <span className="calc__input">
              {f.unit === 'R$' && <em>R$</em>}
              <input inputMode="decimal" value={text[f.key]} onChange={(e) => set(f.key, e.target.value, f.max)} onBlur={() => setText((t) => ({ ...t, [f.key]: show(q[f.key]) }))} aria-label={f.label} />
              {f.unit !== 'R$' && <em>{f.unit}</em>}
            </span>
          </label>
        ))}
      </div>
      {valid && (
        <div className="calc__check">
          Custo {money(r.unitCost)} + taxa {money(fee)} + lucro {money(profit)} = {money(r.unitCost + fee + profit)}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- showcase: a ficha técnica becomes a price */

const SAMPLES = [
  {
    id: 'bolo',
    tab: 'Bolo trufado',
    title: 'Bolo trufado, 20 cm',
    media: { kind: 'img' as const, src: '/loja/bolo.jpg', alt: 'Bolo de chocolate trufado com frutas vermelhas sobre um prato de bolo' },
    q: SAMPLE_QUOTE,
    per: 1,
    unit: 'bolo',
  },
  {
    id: 'brownie',
    tab: 'Brownie',
    title: 'Tabuleiro de brownie, 12 pedaços',
    media: { kind: 'img' as const, src: '/loja/brownie.jpg', alt: 'Pedaços de brownie empilhados com calda de chocolate e morangos' },
    q: { ...SAMPLE_QUOTE, ingredients: 32, packaging: 9, hours: 1.5, ovenMinutes: 35, marginPct: 35 },
    per: 12,
    unit: 'pedaço',
  },
  {
    id: 'festa',
    tab: 'Bolo de festa',
    title: 'Bolo de festa de dois andares',
    media: { kind: 'video' as const, src: '/loja/bolo-girando.mp4', poster: '/loja/bolo-girando.jpg', alt: 'Bolo decorado girando sobre o prato' },
    q: { ...SAMPLE_QUOTE, ingredients: 96, packaging: 18, hours: 5, hourly: 18, ovenMinutes: 90, marginPct: 30 },
    per: 1,
    unit: 'bolo',
  },
];

function Showcase() {
  const [id, setId] = useState(SAMPLES[0].id);
  const s = SAMPLES.find((x) => x.id === id)!;
  const r = landingQuote(s.q);
  return (
    <section className="lp-show" aria-labelledby="lp-show-title" id="como-funciona">
      <div className="lp-show__plate">
        <div className="lp-show__photo shutter pearl-both" data-shutter>
          {s.media.kind === 'img' ? (
            <img key={s.id} src={s.media.src} alt={s.media.alt} width={900} height={900} loading="lazy" />
          ) : (
            <video key={s.id} src={s.media.src} poster={s.media.poster} muted loop autoPlay playsInline aria-label={s.media.alt} />
          )}
        </div>
      </div>
      <div className="lp-show__text">
        <div className="lp-tabs" role="tablist" aria-label="Exemplos de ficha técnica">
          {SAMPLES.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === id} aria-controls="lp-show-panel" onClick={() => setId(x.id)}>
              {x.tab}
            </button>
          ))}
        </div>
        <div id="lp-show-panel" role="tabpanel">
          <h2 id="lp-show-title">
            Sua ficha técnica vira preço
          </h2>
          <p className="lp-show__desc" data-rise style={{ ['--i' as string]: 1 }}>
            Cadastre a receita uma vez. Quando o leite condensado sobe, o CakeBoss refaz a conta de todos os doces que usam ele.
          </p>
          <dl className="lp-sheet" aria-label={`Exemplo: ${s.title}`}>
            <dt>{s.title}</dt>
            <dd />
            <dt>Custo por {s.unit}</dt>
            <dd>
              <b>{money(r.unitCost / s.per)}</b>
            </dd>
            <dt>Preço sugerido por {s.unit}</dt>
            <dd>
              <b>{money(r.suggestedPrice / s.per)}</b>
            </dd>
            <dt>Lucro de {s.q.marginPct}%</dt>
            <dd>
              <b>{money((r.suggestedPrice * s.q.marginPct) / 100 / s.per)}</b>
            </dd>
          </dl>
          <p className="lp-sheet" style={{ marginTop: 10 }}>
            Valores de exemplo, calculados com as mesmas contas do sistema.
          </p>
        </div>
        <div className="lp-cells">
          <Link to="/criar-conta">Criar conta</Link>
          <a href="#planos">Ver planos</a>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- the page */

function PipedLine() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const grow = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  return (
    <div className="lp-pipe" aria-hidden="true">
      <svg width="12" height="100%" preserveAspectRatio="none">
        <defs>
          <pattern id="lp-pearls" width="12" height="22" patternUnits="userSpaceOnUse">
            <circle cx="6" cy="11" r="5" fill="#db2777" />
          </pattern>
        </defs>
        <rect width="12" height="100%" fill="#f3d3e2" opacity="0.6" mask="url(#lp-pearl-mask)" />
        <mask id="lp-pearl-mask">
          <rect width="12" height="100%" fill="url(#lp-pearls)" />
        </mask>
      </svg>
      <motion.div style={{ position: 'absolute', inset: 0, transformOrigin: 'top', scaleY: reduce ? 1 : grow }}>
        <svg width="12" height="100%" preserveAspectRatio="none">
          <rect width="12" height="100%" fill="url(#lp-pearls)" />
        </svg>
      </motion.div>
    </div>
  );
}

function useEntrances(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.classList.add('js-lp');
    const targets = el.querySelectorAll<HTMLElement>('[data-rise], [data-shutter]');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
      },
      { rootMargin: '0px 0px -5% 0px' },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [root]);
}

const FAQ = [
  {
    q: 'Preciso pagar para começar?',
    a: `As assinaturas ainda não abriram. Você já pode criar a conta; quando a cobrança começar, escolhe o plano. O Básico terá ${TRIAL_DAYS} dias grátis, com cartão cadastrado.`,
  },
  { q: 'Como vou pagar a assinatura?', a: 'No cartão de crédito, com cobrança mensal automática, ou no Pix, pagando o mês adiantado. O pagamento é feito no checkout do Mercado Pago ou da Stripe.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim. Ao cancelar, o plano continua ativo até o fim do período já pago e não renova mais.' },
  {
    q: 'A loja online fica com parte das minhas vendas?',
    a: 'Não. No Premium e no Plus você conecta a sua conta do Mercado Pago ou da Stripe e o dinheiro cai direto nela. O CakeBoss não cobra comissão; continuam valendo só as taxas do Mercado Pago ou da Stripe.',
  },
  { q: 'O plano Básico tem loja?', a: 'Não. O Básico é o painel de gestão: preço, fichas técnicas, estoque, pedidos e financeiro. A loja começa no Premium.' },
  { q: 'Funciona no celular?', a: 'Sim. O CakeBoss abre no navegador do celular, do tablet e do computador, sem instalar nada.' },
  {
    q: 'Meus dados ficam seguros?',
    a: 'Os dados de cada confeitaria ficam separados e só quem você autoriza acessa. Número de cartão nunca passa pelo CakeBoss: o pagamento acontece no checkout do Mercado Pago ou da Stripe.',
  },
  { q: 'Hoje uso planilha. Dá para passar para cá?', a: 'Você cadastra os ingredientes e as receitas uma vez. Depois, quando um ingrediente muda de preço, o sistema refaz a conta de todos os doces sozinho.' },
];

const STEPS = [
  { time: 'Cinco minutos', note: 'Primeiro, crie a conta e dê nome à sua confeitaria.', grow: 1, bg: '#f3eae3', ink: '#1f1814' },
  { time: 'Uma tarde', note: 'Depois, cadastre ingredientes, embalagens e as receitas dos seus doces.', grow: 3, bg: '#db2777', ink: '#ffffff' },
  { time: 'Todo dia', note: 'Então é só registrar pedidos, produção e vendas, no painel ou pela sua loja.', grow: 6, bg: '#2a1a12', ink: '#fbefe4' },
];


export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [bakery, setBakery] = useState('');
  useEntrances(root);

  useEffect(() => {
    document.title = 'CakeBoss · Gestão e loja para confeitarias';
  }, []);

  const start = (e: FormEvent) => {
    e.preventDefault();
    try {
      if (bakery.trim()) sessionStorage.setItem(BRAND_DRAFT_KEY, bakery.trim());
    } catch {
      /* the name is just not prefilled */
    }
    navigate('/criar-conta');
  };

  return (
    <div className="lp" data-surface="landing" ref={root}>
      <div style={{ position: 'relative' }}>
        <PipedLine />
        <div className="lp-wrap">
          <nav className="lp-nav" aria-label="Principal">
            <Link to="/" className="lp-nav__mark">
              <BrandLockup height={34} />
            </Link>
            <div className="lp-nav__links">
              <a className="lp-link" href="#como-funciona">
                Como funciona
              </a>
              <a className="lp-link" href="#planos">
                Planos
              </a>
              <a className="lp-link" href="#duvidas">
                Dúvidas
              </a>
              <Link className="lp-link" to="/entrar">
                Entrar
              </Link>
            </div>
            <Link className="lp-btn" to="/criar-conta">
              Criar conta
            </Link>
          </nav>

          <header className="lp-hero">
            <div className="lp-hero__text">
              <h1>Quanto custa o seu bolo?</h1>
              <p className="lp-hero__lead">O CakeBoss soma ingredientes, gás, embalagem e a sua hora, sugere o preço certo e organiza pedidos, estoque e loja no mesmo lugar.</p>
              <div className="lp-hero__actions">
                <Link className="lp-btn" to="/criar-conta">
                  Criar conta <ArrowRight size={18} />
                </Link>
                <a className="lp-link" href="#planos">
                  Ver planos e preços
                </a>
              </div>
              <ul className="lp-facts">
                <li>Sem comissão nas vendas da sua loja</li>
                <li>Pix e cartão caem direto na sua conta</li>
                <li>Funciona no celular, sem instalar nada</li>
              </ul>
            </div>
            <div className="lp-hero__stage pearl-top">
              <p className="lp-hero__stage-note">Faça a conta com um bolo seu. É o mesmo cálculo do sistema.</p>
              <Calculator />
            </div>
          </header>
        </div>
      </div>

      <Showcase />

      <div className="lp-wrap" style={{ position: 'relative' }}>
        <section className="lp-feat" aria-labelledby="lp-feat-title">
          <h2 id="lp-feat-title" className="lp-sr">
            Tudo num lugar só
          </h2>
          <p className="lp-feat__statement" data-rise>
            A compra do mercado entra no{' '}
            <span className="lp-nowrap">
              estoque
              <span className="lp-slot">
                <img src="/loja/chocolate.jpg" alt="" width={120} height={64} loading="lazy" />
              </span>
            </span>{' '}
            sozinha. O pedido baixa os ingredientes quando vai para o forno
            <span className="lp-nowrap">
              <span className="lp-slot">
                <img src="/loja/brownie.jpg" alt="" width={120} height={64} loading="lazy" />
              </span>
              .
            </span>{' '}
            O Pix cai no financeiro{' '}
            <span className="lp-nowrap">
              <span className="lp-slot lp-slot--chip">+ R$ 116,11</span>.
            </span>{' '}
            E a sua loja vende sem{' '}
            <span className="lp-nowrap">
              comissão
              <span className="lp-slot">
                <img src="/loja/bolo.jpg" alt="" width={120} height={64} loading="lazy" />
              </span>
              .
            </span>
          </p>
          <div className="lp-feat__after" data-rise style={{ ['--i' as string]: 1 }}>
            <p>Fichas técnicas, estoque, compras, pedidos, produção, clientes, financeiro e loja ligados entre si. Sem planilha e sem copiar número de um lugar para outro.</p>
            <Link className="lp-btn lp-btn--ink" to="/criar-conta">
              Começar agora
            </Link>
          </div>
          <div className="lp-strip">
            <figure className="pearl-top" data-rise>
              <img src="/loja/bolo.jpg" alt="Bolo de chocolate trufado com frutas vermelhas" width={600} height={750} loading="lazy" />
            </figure>
            <figure className="pearl-top" data-rise style={{ ['--i' as string]: 1 }}>
              <img src="/landing/torta-brownie.webp" alt="Torta de brownie com rosetas de ganache e pedaços de brownie, com rosquinhas de brownie ao fundo" width={600} height={750} loading="lazy" />
            </figure>
            <figure className="pearl-top" data-rise style={{ ['--i' as string]: 2 }}>
              <img src="/loja/chocolate.jpg" alt="Chocolate derretido escorrendo de uma colher" width={600} height={750} loading="lazy" style={{ objectPosition: '50% 30%' }} />
            </figure>
            <figure className="pearl-top" data-rise style={{ ['--i' as string]: 3 }}>
              <img src="/loja/brownie.jpg" alt="Pedaços de brownie com calda de chocolate e morangos" width={600} height={750} loading="lazy" />
            </figure>
          </div>
        </section>

        <section className="lp-how" aria-labelledby="lp-how-title">
          <h2 id="lp-how-title" data-rise>
            Do cadastro ao primeiro pedido
          </h2>
          <div className="lp-bar" data-ui aria-hidden="true">
            {STEPS.map((s) => (
              <div key={s.time} className="lp-bar__seg" data-rise style={{ flexGrow: s.grow, flexBasis: 0, minWidth: '12%', background: s.bg, color: s.ink }}>
                <b>{s.time}</b>
              </div>
            ))}
          </div>
          <div className="lp-bar__notes" aria-hidden="true">
            {STEPS.map((s) => (
              <p key={s.time} style={{ flexGrow: s.grow, flexBasis: 0, minWidth: '12%' }}>
                {s.note}
              </p>
            ))}
          </div>
          <ol className="lp-steps" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {STEPS.map((s) => (
              <li key={s.time} className="lp-steps__seg" style={{ background: s.bg, color: s.ink, minHeight: `${72 + s.grow * 18}px` }}>
                <b>{s.time}</b>
                <p>{s.note}</p>
              </li>
            ))}
          </ol>
          {/* screen readers get the steps once, as a list */}
          <ol className="lp-sr">
            {STEPS.map((s) => (
              <li key={s.time}>
                {s.time}: {s.note}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="lp-band pearl-top" aria-hidden="true" />

      <div className="lp-wrap">
        <section className="lp-plans" id="planos" aria-labelledby="lp-plans-title">
          <div className="lp-plans__head">
            <h2 id="lp-plans-title" data-rise>
              Um plano para cada fase da confeitaria
            </h2>
            <p data-rise style={{ ['--i' as string]: 1 }}>
              Comece pelo painel e passe para a loja quando quiser vender online. A troca de plano mantém todos os seus dados.
            </p>
          </div>
          <div className="lp-tiles">
            {PLANS.map((p, i) => (
              <article key={p.code} className="lp-tile pearl-top" data-rise style={{ ['--i' as string]: i }} aria-labelledby={`plan-${p.code}`}>
                {/* the middle plan is the one most bakeries need: own store, no commission */}
                {p.code === 'premium' && <span className="lp-tile__badge">Recomendado para vender online</span>}
                <h3 id={`plan-${p.code}`}>{p.name}</h3>
                <p className="lp-tile__for">{p.forWho}</p>
                <p className="lp-tile__inc">{p.includes}</p>
                <div className="lp-tile__price">
                  {planPrice(p.priceCents)}
                  <small>por mês</small>
                </div>
                <Link className={i === 1 ? 'lp-btn lp-btn--light' : i === 2 ? 'lp-btn' : 'lp-btn lp-btn--ink'} to="/criar-conta">
                  Começar com o {p.name}
                </Link>
              </article>
            ))}
          </div>
          <p className="lp-plans__note">
            As assinaturas abrem em breve. Crie sua conta agora e escolha o plano quando a cobrança começar. O Básico terá {TRIAL_DAYS} dias grátis, com cartão cadastrado; no Pix, o primeiro mês é pago na hora.
          </p>
        </section>

        <section className="lp-faq" id="duvidas" aria-labelledby="lp-faq-title">
          <h2 id="lp-faq-title">Dúvidas</h2>
          <div className="lp-faq__list">
            {FAQ.map((f) => (
              <details key={f.q} name="faq" data-rise>
                <summary>
                  {f.q}
                  <span className="lp-plus" aria-hidden="true" />
                </summary>
                <p className="lp-faq__answer">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-cta" aria-labelledby="lp-cta-title">
          <h2 id="lp-cta-title" className="lp-sr">
            Começar
          </h2>
          <form className="lp-cta__sentence" onSubmit={start}>
            Abrir o painel da{' '}
            <input value={bakery} onChange={(e) => setBakery(e.target.value)} placeholder="sua confeitaria" aria-label="Nome da sua confeitaria" maxLength={120} />{' '}
            <button type="submit">agora</button>
          </form>
          <p className="lp-cta__after">Você cria a conta com e-mail e senha e entra direto no painel, já com esse nome.</p>
        </section>
      </div>

      <footer className="lp-foot pearl-top">
        <div className="lp-wrap">
          <img className="lp-foot__logo" src={LOGO_SRC} alt="CakeBoss" width={1105} height={1071} loading="lazy" />
          <div className="lp-foot__grid">
            <div className="lp-foot__col">
              <b>Produto</b>
              <a className="lp-link" href="#como-funciona">
                Como funciona
              </a>
              <a className="lp-link" href="#planos">
                Planos
              </a>
              <a className="lp-link" href="#duvidas">
                Dúvidas
              </a>
            </div>
            <div className="lp-foot__col">
              <b>Conta</b>
              <Link className="lp-link" to="/entrar">
                Entrar
              </Link>
              <Link className="lp-link" to="/criar-conta">
                Criar conta
              </Link>
              <Link className="lp-link" to="/esqueci-senha">
                Esqueci minha senha
              </Link>
            </div>
            <div className="lp-foot__col" style={{ gridColumn: 'span 6' }}>
              <b>Para confeitarias</b>
              <p>Precificação, pedidos, estoque, financeiro e loja online com pagamento direto na sua conta.</p>
            </div>
          </div>
          <div className="lp-foot__last">
            <span>© {new Date().getFullYear()} CakeBoss</span>
            <Link className="lp-btn" to="/criar-conta" style={{ height: 44, fontSize: 15 }}>
              Criar conta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

