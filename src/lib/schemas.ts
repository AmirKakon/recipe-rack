
import { z } from 'zod';

export const ingredientSchema = z.object({
  id: z.string().uuid().optional(), // Optional for new ingredients
  name: z.string().min(1, "Ingredient name is required").max(100, "Ingredient name too long"),
  quantity: z.string().min(1, "Quantity is required").max(50, "Quantity description too long"),
});

export const recipeFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(150, "Title too long"),
  ingredients: z.array(ingredientSchema).min(1, "At least one ingredient is required"),
  instructions: z.array(
    z.string()
      .min(1, "Instruction step cannot be empty.")
      .max(1000, "Instruction step is too long (max 1000 characters).")
  ).min(1, "At least one instruction step is required."),
  // 'cuisine' field in form will store comma-separated tags
  cuisine: z.string().max(200, "Cuisine tags string too long (max 200 characters)").optional(), 
});

export type RecipeFormData = z.infer<typeof recipeFormSchema>;
