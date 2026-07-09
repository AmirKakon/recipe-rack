import type { KosherCategory, Ingredient } from '@/lib/types';

interface KosherCategoryMeta {
  value: KosherCategory;
  label: string;
  /** Tailwind classes for the badge (light bg + readable text + border). */
  badgeClass: string;
  description: string;
}

export const KOSHER_CATEGORIES: KosherCategoryMeta[] = [
  {
    value: 'meat',
    label: 'Meat',
    badgeClass: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
    description: 'Contains meat or poultry (fleishig).',
  },
  {
    value: 'dairy',
    label: 'Dairy',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
    description: 'Contains milk, cheese, butter, or other dairy (milchig).',
  },
  {
    value: 'pareve',
    label: 'Pareve',
    badgeClass: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
    description: 'Neither meat nor dairy — neutral (e.g. fish, eggs, produce, grains).',
  },
];

export const getKosherMeta = (category?: KosherCategory): KosherCategoryMeta | undefined =>
  KOSHER_CATEGORIES.find((c) => c.value === category);

// --- Meat + dairy conflict detection -------------------------------------

const MEAT_TERMS = [
  'beef', 'steak', 'chicken', 'poultry', 'turkey', 'lamb', 'veal', 'pork', 'bacon',
  'ham', 'hamburger', 'sausage', 'salami', 'pepperoni', 'brisket', 'meatball',
  'meatballs', 'pastrami', 'prosciutto', 'chorizo', 'duck', 'frankfurter', 'hotdog',
  'hot dog', 'cutlet', 'schnitzel', 'venison', 'goose',
];

const DAIRY_TERMS = [
  'milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'ghee', 'whey', 'casein',
  'custard', 'buttermilk', 'curd', 'ricotta', 'mozzarella', 'parmesan', 'cheddar',
  'mascarpone', 'feta',
];

// Phrases that look meat/dairy but are not.
const NON_MEAT_PHRASES = ['vegan', 'vegetarian', 'meatless', 'plant-based', 'plant based', 'mock', 'tofu', 'seitan', 'beyond', 'impossible', 'veggie', 'imitation'];
const NON_DAIRY_PHRASES = [
  'coconut milk', 'almond milk', 'soy milk', 'oat milk', 'rice milk', 'cashew milk', 'hemp milk',
  'peanut butter', 'almond butter', 'cashew butter', 'sunflower butter', 'seed butter', 'nut butter',
  'cocoa butter', 'butter bean', 'butternut', 'cream of tartar', 'coconut cream', 'non-dairy',
  'dairy free', 'dairy-free', 'vegan', 'plant-based', 'plant based',
];

const containsWord = (text: string, term: string): boolean =>
  new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);

const isMeatIngredient = (name: string): boolean => {
  const n = name.toLowerCase();
  if (NON_MEAT_PHRASES.some((p) => n.includes(p))) return false;
  return MEAT_TERMS.some((t) => containsWord(n, t));
};

const isDairyIngredient = (name: string): boolean => {
  const n = name.toLowerCase();
  if (NON_DAIRY_PHRASES.some((p) => n.includes(p))) return false;
  return DAIRY_TERMS.some((t) => containsWord(n, t));
};

export interface KosherConflict {
  hasConflict: boolean;
  meatItems: string[];
  dairyItems: string[];
}

/**
 * Heuristic check for a meat+dairy mix within one recipe (not kosher).
 * Conservative: excludes common look-alikes (coconut milk, peanut butter, etc.).
 */
export const detectKosherConflict = (ingredients: Pick<Ingredient, 'name'>[]): KosherConflict => {
  const meatItems: string[] = [];
  const dairyItems: string[] = [];
  for (const ing of ingredients) {
    const name = (ing?.name || '').trim();
    if (!name) continue;
    if (isMeatIngredient(name)) meatItems.push(name);
    if (isDairyIngredient(name)) dairyItems.push(name);
  }
  return { hasConflict: meatItems.length > 0 && dairyItems.length > 0, meatItems, dairyItems };
};
