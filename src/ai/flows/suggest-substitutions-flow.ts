
'use server';
/**
 * @fileOverview Suggests kosher-aware ingredient substitutions to reach a goal
 * (make a recipe pareve, dairy-free, or meat-free).
 *
 * - suggestSubstitutions - Suggests substitutions for a recipe.
 * - SuggestSubstitutionsInput - The input type.
 * - SuggestSubstitutionsOutput - The return type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestSubstitutionsInputSchema = z.object({
  title: z.string().optional().describe('The recipe title.'),
  ingredients: z.string().describe('The recipe ingredients (one per line or comma-separated).'),
  goal: z.enum(['pareve', 'dairy-free', 'meat-free']).describe('The dietary transformation goal.'),
});
export type SuggestSubstitutionsInput = z.infer<typeof SuggestSubstitutionsInputSchema>;

const SubstitutionSchema = z.object({
  ingredient: z.string().describe('The original ingredient being replaced.'),
  substitute: z.string().describe('The kosher-friendly replacement (with quantity guidance if relevant).'),
  note: z.string().describe('A brief note on the swap or how it affects the dish. Use "" if none.'),
});
export type Substitution = z.infer<typeof SubstitutionSchema>;

const SuggestSubstitutionsOutputSchema = z.object({
  substitutions: z.array(SubstitutionSchema).describe('The list of suggested substitutions. Empty if none are needed.'),
  summary: z.string().describe('A short overall summary — including if the recipe already meets the goal.'),
});
export type SuggestSubstitutionsOutput = z.infer<typeof SuggestSubstitutionsOutputSchema>;

export async function suggestSubstitutions(
  input: SuggestSubstitutionsInput
): Promise<SuggestSubstitutionsOutput> {
  return suggestSubstitutionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestSubstitutionsPrompt',
  input: {schema: SuggestSubstitutionsInputSchema},
  output: {schema: SuggestSubstitutionsOutputSchema},
  prompt: `You are a kosher culinary assistant helping a family that keeps kosher.
Goal: transform the recipe to be "{{goal}}".
- "pareve": neither meat nor dairy — replace both any meat and any dairy with pareve alternatives.
- "dairy-free": remove all dairy (so the dish becomes pareve and can be served with meat) while keeping the dish's character. Do not add meat.
- "meat-free": remove all meat/poultry, replacing with vegetarian/pareve alternatives. Do not add dairy unless the dish is already dairy.

Recipe title: "{{title}}"
Ingredients:
{{ingredients}}

Instructions:
- Only suggest substitutions for ingredients that conflict with the goal. Leave everything else alone.
- Prefer common, kosher-friendly substitutes (e.g. butter -> margarine or coconut oil; milk -> soy/almond/oat milk; cream -> coconut cream or pareve creamer; heavy cream in savory -> cashew cream; ground beef -> plant-based mince or lentils/mushrooms).
- Give practical quantity guidance where it differs from a 1:1 swap.
- If the recipe already meets the goal, return an empty 'substitutions' array and say so in 'summary'.
- Keep 'note' brief; use "" if there's nothing useful to add.

Respond strictly as JSON matching the schema.`,
});

const suggestSubstitutionsFlow = ai.defineFlow(
  {
    name: 'suggestSubstitutionsFlow',
    inputSchema: SuggestSubstitutionsInputSchema,
    outputSchema: SuggestSubstitutionsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    return output || { substitutions: [], summary: 'Could not generate substitutions. Please try again.' };
  }
);
