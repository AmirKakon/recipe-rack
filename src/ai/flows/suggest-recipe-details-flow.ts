
'use server';
/**
 * @fileOverview Suggests prep time, cook time, and serving size for a recipe.
 *
 * - suggestRecipeDetails - A function that suggests these details.
 * - SuggestRecipeDetailsInput - The input type.
 * - SuggestRecipeDetailsOutput - The return type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestRecipeDetailsInputSchema = z.object({
  title: z.string().describe('The title of the recipe.'),
  ingredients: z.string().describe('A comma-separated list of main ingredients.'),
  instructions: z.string().describe('The cooking instructions, concatenated into a single string if provided as an array.'),
});
export type SuggestRecipeDetailsInput = z.infer<typeof SuggestRecipeDetailsInputSchema>;

const SuggestRecipeDetailsOutputSchema = z.object({
  suggestedPrepTime: z.string().describe('A suggested preparation time (e.g., "20 minutes", "1 hour"). Use "" if a suggestion cannot be confidently made or if input is insufficient.'),
  suggestedCookTime: z.string().describe('A suggested cooking time (e.g., "45 minutes", "2 hours"). Use "" if a suggestion cannot be confidently made or if input is insufficient.'),
  suggestedServingSize: z.string().describe('A suggested number of servings (e.g., "4 servings", "6-8 people"). Use "" if a suggestion cannot be confidently made or if input is insufficient.'),
});
export type SuggestRecipeDetailsOutput = z.infer<typeof SuggestRecipeDetailsOutputSchema>;

export async function suggestRecipeDetails(input: SuggestRecipeDetailsInput): Promise<SuggestRecipeDetailsOutput> {
  return suggestRecipeDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestRecipeDetailsPrompt',
  input: {schema: SuggestRecipeDetailsInputSchema},
  output: {schema: SuggestRecipeDetailsOutputSchema},
  prompt: `You are an expert culinary assistant. Based on the provided recipe title, ingredients, and instructions, please suggest a reasonable preparation time, cooking time, and serving size.

Recipe Title: {{{title}}}
Ingredients: {{{ingredients}}}
Instructions: {{{instructions}}}

Provide your suggestions in the following JSON format. If you cannot confidently suggest a value for any field due to insufficient information or ambiguity, use an empty string "" for that specific field. Do not make up values if unsure. Your response MUST strictly adhere to this JSON structure:
{
  "suggestedPrepTime": "string",
  "suggestedCookTime": "string",
  "suggestedServingSize": "string"
}
`,
});

const suggestRecipeDetailsFlow = ai.defineFlow(
  {
    name: 'suggestRecipeDetailsFlow',
    inputSchema: SuggestRecipeDetailsInputSchema,
    outputSchema: SuggestRecipeDetailsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    // Ensure a valid object matching the schema is always returned, even if the AI fails or returns null
    return output || { suggestedPrepTime: '', suggestedCookTime: '', suggestedServingSize: '' };
  }
);

