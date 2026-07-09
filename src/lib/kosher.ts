import type { KosherCategory } from '@/lib/types';

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
