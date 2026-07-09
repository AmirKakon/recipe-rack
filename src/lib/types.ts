
export interface Ingredient {
  id: string;
  name: string;
  quantity: string;
}

// Kosher dietary classification. Meat and dairy may not be mixed; pareve is neutral.
export type KosherCategory = 'meat' | 'dairy' | 'pareve';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

// One assignment of a recipe to a day + meal slot in the weekly planner.
export interface MealPlanEntry {
  date: string; // YYYY-MM-DD
  mealType: MealType;
  recipeId: string;
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
  kosherCategory?: KosherCategory; // meat / dairy / pareve
  isFavorite?: boolean;
  createdAt?: number; // epoch ms, set on create; used for "recently added" sort
  imageUrl?: string; // Firebase Storage download URL for the recipe photo
  rating?: number; // 1-5 star rating
  notes?: string; // free-text family cooking notes
  nutrition?: { calories?: string; protein?: string; carbs?: string; fat?: string }; // AI-estimated, per serving
}

