
export interface Ingredient {
  id: string;
  name: string;
  quantity: string;
}

// Kosher dietary classification. Meat and dairy may not be mixed; pareve is neutral.
export type KosherCategory = 'meat' | 'dairy' | 'pareve';

export interface Recipe {
  id: string;
  title: string;
  ingredients: Ingredient[];
  instructions: string[];
  cuisine?: string; // Kept for potential backward compatibility during fetch
  cuisines?: string[]; // New field for cuisine tags
  prepTime?: string;
  cookTime?: string;
  servingSize?: string;
  kosherCategory?: KosherCategory; // meat / dairy / pareve
}

