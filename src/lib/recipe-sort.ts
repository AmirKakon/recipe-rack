import type { Recipe } from '@/lib/types';

export type SortOption = 'title' | 'recent' | 'prep' | 'rating';

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'recent', label: 'Recently added' },
  { value: 'prep', label: 'Prep time' },
  { value: 'rating', label: 'Top rated' },
];

/**
 * Extracts a total minute count from a free-text prep time (e.g. "1 hr 15 mins",
 * "20 minutes", "45m"). Returns Infinity when nothing parseable is found so those
 * recipes sort last.
 */
export const parsePrepMinutes = (prepTime?: string): number => {
  if (!prepTime) return Infinity;
  const text = prepTime.toLowerCase();
  let minutes = 0;
  let matched = false;

  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/);
  if (hourMatch) {
    minutes += parseFloat(hourMatch[1]) * 60;
    matched = true;
  }
  const minMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)/);
  if (minMatch) {
    minutes += parseFloat(minMatch[1]);
    matched = true;
  }
  // Bare number with no unit -> assume minutes.
  if (!matched) {
    const bare = text.match(/(\d+(?:\.\d+)?)/);
    if (bare) {
      minutes = parseFloat(bare[1]);
      matched = true;
    }
  }
  return matched ? minutes : Infinity;
};

export const sortRecipes = (recipes: Recipe[], sortBy: SortOption): Recipe[] => {
  const copy = [...recipes];
  switch (sortBy) {
    case 'recent':
      return copy.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    case 'prep':
      return copy.sort((a, b) => parsePrepMinutes(a.prepTime) - parsePrepMinutes(b.prepTime));
    case 'rating':
      return copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case 'title':
    default:
      return copy.sort((a, b) => a.title.localeCompare(b.title));
  }
};
