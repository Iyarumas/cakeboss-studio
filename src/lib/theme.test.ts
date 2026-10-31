import { describe, expect, it } from 'vitest';
import { ACCENT_PRESETS, accentCss, contrast, resolveAccent } from './theme';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

describe('cores da marca', () => {
  it('sem escolha usa o rosa padrão', () => {
    expect(resolveAccent(undefined).primary).toBe('#DB2777');
    expect(resolveAccent('qualquer-coisa').primary).toBe('#DB2777');
  });

  it('cor personalizada clara é escurecida até o texto branco ficar legível', () => {
    const r = resolveAccent('#FFD6E8');
    expect(r.adjusted).toBe(true);
    expect(contrast(rgb(r.primary), [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
  });

  it('cor personalizada já escura fica como está', () => {
    const r = resolveAccent('#5B21B6');
    expect(r.adjusted).toBe(false);
    expect(r.primary).toBe('#5B21B6');
  });

  it('todas as cores prontas aguentam texto branco', () => {
    for (const p of ACCENT_PRESETS) expect(contrast(rgb(p.primary), [255, 255, 255]), p.label).toBeGreaterThanOrEqual(4.5);
  });

  it('gera variáveis para o tema claro e o escuro', () => {
    const css = accentCss('menta');
    expect(css).toContain("html[data-theme='dark']");
    expect(css).toMatch(/--pink: 15 118 110/);
  });
});
