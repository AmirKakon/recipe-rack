'use server';
/**
 * @fileOverview Suggests a recipe name based on the provided ingredients and cuisine.
 *
 * - suggestRecipeName - A function that suggests a recipe name.
 * - SuggestRecipeNameInput - The input type for the suggestRecipeName function.
 * - SuggestRecipeNameOutput - The return type for the suggestRecipeName function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestRecipeNameInputSchema = z.object({
  ingredients: z.string().describe('A comma-separated list of ingredients.'),
  cuisine: z.string().describe('The cuisine of the recipe.'),
});
export type SuggestRecipeNameInput = z.infer<typeof SuggestRecipeNameInputSchema>;

const SuggestRecipeNameOutputSchema = z.object({
  recipeName: z.string().describe('A suggested name for the recipe.'),
});
export type SuggestRecipeNameOutput = z.infer<typeof SuggestRecipeNameOutputSchema>;

export async function suggestRecipeName(input: SuggestRecipeNameInput): Promise<SuggestRecipeNameOutput> {
  return suggestRecipeNameFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestRecipeNamePrompt',
  input: {schema: SuggestRecipeNameInputSchema},
  output: {schema: SuggestRecipeNameOutputSchema},
  prompt: `You are a creative recipe name generator. Given the ingredients and cuisine, suggest a creative and appealing name for the recipe.\n\nIngredients: {{{ingredients}}}\nCuisine: {{{cuisine}}}`,
});

const suggestRecipeNameFlow = ai.defineFlow(
  {
    name: 'suggestRecipeNameFlow',
    inputSchema: SuggestRecipeNameInputSchema,
    outputSchema: SuggestRecipeNameOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
