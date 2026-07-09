// Normalizes cuisine/category tags to consistent Title Case, keeping small
// connector words lowercase and preserving short acronyms (BBQ, USA).

const SMALL_WORDS = new Set(['and', 'or', 'of', 'the', 'with', 'in', 'a', 'an', 'to', 'for', 'on']);

// Capitalizes a single word, title-casing each hyphenated part (e.g. "high-protein" -> "High-Protein").
const capitalize = (word: string): string =>
  word
    .split('-')
    .map((part) => {
      if (/^[A-Z]{2,4}$/.test(part)) return part; // acronym, e.g. BBQ
      const lower = part.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('-');

export const normalizeTag = (raw: string): string => {
  const text = (raw || '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  return text
    .split(' ')
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return capitalize(word);
    })
    .join(' ');
};

/** Normalizes a list of tags and removes case-insensitive duplicates (order preserved). */
export const normalizeTags = (tags: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    const key = tag.toLowerCase();
    if (tag && !seen.has(key)) {
      seen.add(key);
      out.push(tag);
    }
  }
  return out;
};
