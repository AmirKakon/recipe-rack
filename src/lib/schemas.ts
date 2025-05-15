import { z } from 'zod';

export const ingredientSchema = z.object({
  id: z.string().uuid().optional(), // Optional for new ingredients
  name: z.string().min(1, "Ingredient name is required").max(100, "Ingredient name too long"),
  quantity: z.string().min(1, "Quantity is required").max(50, "Quantity description too long"),
});

export const recipeFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(150, "Title too long"),
  ingredients: z.array(ingredientSchema).min(1, "At least one ingredient is required"),
  instructions: z.string().min(1, "Instructions are required").max(5000, "Instructions too long"),
  cuisine: z.string().max(50, "Cuisine name too long").optional(),
});

export type RecipeFormData = z.infer<typeof recipeFormSchema>;
