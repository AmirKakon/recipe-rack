
export interface Ingredient {
  id: string;
  name: string;
  quantity: string;
}

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
}

