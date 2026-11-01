import type { Recipe } from '@cakeboss/domain/types';

const ART: [RegExp, string, string][] = [
  [/bolo/i, '🎂', 'from-amber-200 via-orange-50 to-rose-200'],
  [/brownie/i, '🟫', 'from-amber-300 via-orange-100 to-stone-200'],
  [/brigadeiro|trufa|bombom|chocolate/i, '🍫', 'from-amber-200 via-orange-100 to-rose-100'],
  [/cupcake/i, '🧁', 'from-rose-200 via-orange-50 to-amber-100'],
  [/torta|pie/i, '🥧', 'from-yellow-100 via-amber-100 to-orange-200'],
  [/cookie|biscoito/i, '🍪', 'from-orange-200 via-amber-100 to-yellow-100'],
  [/donut|rosquinha/i, '🍩', 'from-rose-200 via-orange-100 to-amber-100'],
  [/pudim|flan/i, '🍮', 'from-amber-200 via-yellow-100 to-orange-100'],
];

/** Illustration (emoji + gradient) used while a product has no photo. */
export const artFor = (r: Recipe): [string, string] => {
  const hit = ART.find(([re]) => re.test(`${r.name} ${r.category}`));
  return hit ? [hit[1], hit[2]] : ['🍬', 'from-orange-100 via-amber-50 to-rose-100'];
};

/** Product name as customers see it (without the "(exemplo)" tag of sample data). */
export const cleanName = (name: string) => name.replace(/\s*\(exemplo\)/i, '');
