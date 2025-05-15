export interface Ingredient {
  id: string;
  name: string;
  quantity: string;
}

export interface Recipe {
  id: string;
  title: string;
  ingredients: Ingredient[];
  instructions: string;
  cuisine?: string;
}
