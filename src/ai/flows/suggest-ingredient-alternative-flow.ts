
'use server';
/**
 * @fileOverview Suggests kosher-friendly substitutes for a single ingredient,
 * highlighting any that are already in the user's inventory.
 *
 * - suggestIngredientAlternative - Suggests alternatives for one ingredient.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestIngredientAlternativeInputSchema = z.object({
  ingredient: z.string().describe('The ingredient the user is missing.'),
  inventory: z.array(z.string()).describe('Item names the user currently has on hand.'),
});
export type SuggestIngredientAlternativeInput = z.infer<typeof SuggestIngredientAlternativeInputSchema>;

const SuggestIngredientAlternativeOutputSchema = z.object({
  inStock: z
    .array(z.object({ item: z.string(), note: z.string() }))
    .describe("Items FROM THE PROVIDED INVENTORY that can substitute the ingredient (kosher-aware). Empty if none fit."),
  others: z
    .array(z.string())
    .describe('General kosher-friendly substitutes for the ingredient that are NOT in the inventory.'),
});
export type SuggestIngredientAlternativeOutput = z.infer<typeof SuggestIngredientAlternativeOutputSchema>;

export async function suggestIngredientAlternative(
  input: SuggestIngredientAlternativeInput
): Promise<SuggestIngredientAlternativeOutput> {
  return suggestIngredientAlternativeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestIngredientAlternativePrompt',
  input: {schema: SuggestIngredientAlternativeInputSchema},
  output: {schema: SuggestIngredientAlternativeOutputSchema},
  prompt: `A kosher-keeping cook is missing "{{ingredient}}" for a recipe. Suggest kosher-friendly substitutes.

Their current inventory (items on hand):
{{#each inventory}}
- {{this}}
{{/each}}

Do two things:
1. 'inStock': pick ONLY items from the inventory list above that would genuinely work as a substitute for "{{ingredient}}". For each, give a short 'note' (e.g. ratio, or a kosher point like "keeps it pareve"). If nothing in the inventory fits, return an empty array.
2. 'others': list 2-4 common kosher-friendly substitutes for "{{ingredient}}" that are NOT in the inventory.

Only pick inventory items that are real culinary substitutes — do not force a match. Respond strictly as JSON matching the schema.`,
});

const suggestIngredientAlternativeFlow = ai.defineFlow(
  {
    name: 'suggestIngredientAlternativeFlow',
    inputSchema: SuggestIngredientAlternativeInputSchema,
    outputSchema: SuggestIngredientAlternativeOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    return output || { inStock: [], others: [] };
  }
);
