export interface Ingredient {
  id: string;
  name: string;
  quantity: string;
}

export interface Recipe {
  id: string;
  title: string;
  ingredients: Ingredient[];
  instructions: string[]; // Changed from string to string[]
  cuisine?: string;
}
