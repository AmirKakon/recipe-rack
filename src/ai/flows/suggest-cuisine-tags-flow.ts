
'use server';
/**
 * @fileOverview Suggests cuisine/category tags for a recipe from its title + ingredients.
 *
 * - suggestCuisineTags - Suggests tags.
 * - SuggestCuisineTagsInput / SuggestCuisineTagsOutput - I/O types.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestCuisineTagsInputSchema = z.object({
  title: z.string().optional(),
  ingredients: z.string().describe('Ingredients (comma/newline separated).'),
  existingTags: z.string().optional().describe('Comma-separated tags already on the recipe.'),
});
export type SuggestCuisineTagsInput = z.infer<typeof SuggestCuisineTagsInputSchema>;

const SuggestCuisineTagsOutputSchema = z.object({
  cuisines: z.array(z.string()).describe('2-5 concise English cuisine/category tags. Never include "Kosher".'),
});
export type SuggestCuisineTagsOutput = z.infer<typeof SuggestCuisineTagsOutputSchema>;

export async function suggestCuisineTags(input: SuggestCuisineTagsInput): Promise<SuggestCuisineTagsOutput> {
  return suggestCuisineTagsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestCuisineTagsPrompt',
  input: {schema: SuggestCuisineTagsInputSchema},
  output: {schema: SuggestCuisineTagsOutputSchema},
  prompt: `Suggest 2-5 concise English cuisine/category tags for this recipe. Mix cuisine style (e.g. Italian, Middle Eastern, Asian) with dish type (e.g. Dessert, Chicken, Soup, Breakfast, Vegan) as appropriate.
Do NOT include "Kosher". Do not repeat tags already present.

{{#if title}}Title: "{{title}}"{{/if}}
Ingredients: {{ingredients}}
{{#if existingTags}}Already tagged: {{existingTags}}{{/if}}

Respond as JSON matching the schema.`,
});

const suggestCuisineTagsFlow = ai.defineFlow(
  {
    name: 'suggestCuisineTagsFlow',
    inputSchema: SuggestCuisineTagsInputSchema,
    outputSchema: SuggestCuisineTagsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    return output || { cuisines: [] };
  }
);
