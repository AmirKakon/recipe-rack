
'use server';
/**
 * @fileOverview Translates a recipe's text between English and Hebrew.
 *
 * - translateRecipe - Translates title, ingredients, and instructions.
 * - TranslateRecipeInput / TranslateRecipeOutput - I/O types.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecipeIngredientSchema = z.object({ name: z.string(), quantity: z.string() });

const TranslateRecipeInputSchema = z.object({
  title: z.string(),
  ingredients: z.array(RecipeIngredientSchema),
  instructions: z.array(z.string()),
  targetLanguage: z.enum(['Hebrew', 'English']),
});
export type TranslateRecipeInput = z.infer<typeof TranslateRecipeInputSchema>;

const TranslateRecipeOutputSchema = z.object({
  title: z.string(),
  ingredients: z.array(RecipeIngredientSchema),
  instructions: z.array(z.string()),
});
export type TranslateRecipeOutput = z.infer<typeof TranslateRecipeOutputSchema>;

export async function translateRecipe(input: TranslateRecipeInput): Promise<TranslateRecipeOutput> {
  return translateRecipeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'translateRecipePrompt',
  input: {schema: TranslateRecipeInputSchema},
  output: {schema: TranslateRecipeOutputSchema},
  prompt: `Translate the following recipe into {{targetLanguage}}. Translate the title, each ingredient name, and each instruction step. Keep quantities/numbers/units as-is (translate unit words like "cup" naturally). Preserve the same number and order of ingredients and instructions. Use natural culinary phrasing.

Title: {{title}}
Ingredients:
{{#each ingredients}}
- {{name}} | {{quantity}}
{{/each}}
Instructions:
{{#each instructions}}
- {{this}}
{{/each}}

Respond as JSON matching the schema (same array lengths).`,
});

const translateRecipeFlow = ai.defineFlow(
  {
    name: 'translateRecipeFlow',
    inputSchema: TranslateRecipeInputSchema,
    outputSchema: TranslateRecipeOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    return output || { title: input.title, ingredients: input.ingredients, instructions: input.instructions };
  }
);
