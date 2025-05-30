
import { z } from 'genkit';

export const ExtractedIngredientSchema = z.object({
  id: z.string().optional().describe("A unique identifier for the ingredient, if available or extracted. If not found, this can be omitted."),
  name: z.string().describe('The name of the ingredient. Use "" if not found/unclear.'),
  quantity: z.string().describe('The quantity or amount of the ingredient. Use "" if not found/unclear.'),
});

export const ExtractRecipeFromImageOutputSchema = z.object({
  title: z.string().describe('The extracted title of the recipe. Use "" if not found/unclear.'),
  ingredients: z.array(ExtractedIngredientSchema).describe("An array of extracted ingredient objects. Each object *must* have 'name' (string) and 'quantity' (string) fields. Provide an empty array [] if no ingredients are found or if they cannot be clearly identified as a list of items with quantities."),
  instructions: z.array(z.string()).describe('An array of extracted instruction strings. Each string is a single step. Provide an empty array [] if no instructions are found or if they cannot be clearly identified as a sequence of steps.'),
  cuisine: z.string().describe('A comma-separated string of 1-3 relevant cuisine tags. Use "" if not found/unclear.'),
  prepTime: z.string().describe('The estimated preparation time (e.g., "20 minutes", "1 hour"). Use "" if not found/unclear.'),
  cookTime: z.string().describe('The estimated cooking time (e.g., "45 minutes", "2 hours"). Use "" if not found/unclear.'),
  servingSize: z.string().describe('The number of servings the recipe makes (e.g., "4 servings", "6-8 people"). Use "" if not found/unclear.'),
});
export type ExtractRecipeFromImageOutput = z.infer<typeof ExtractRecipeFromImageOutputSchema>;

