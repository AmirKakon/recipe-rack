
'use server';
/**
 * @fileOverview Estimates per-serving nutrition for a recipe from its ingredients.
 * These are rough AI estimates, not medical/nutritional advice.
 *
 * - estimateNutrition - Estimates nutrition.
 * - EstimateNutritionInput / EstimateNutritionOutput - I/O types.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EstimateNutritionInputSchema = z.object({
  title: z.string().optional(),
  ingredients: z.string().describe('Ingredients with quantities (one per line or comma-separated).'),
  servingSize: z.string().optional().describe('e.g. "4 servings".'),
});
export type EstimateNutritionInput = z.infer<typeof EstimateNutritionInputSchema>;

const EstimateNutritionOutputSchema = z.object({
  calories: z.string().describe('Estimated calories per serving, e.g. "320 kcal".'),
  protein: z.string().describe('Estimated protein per serving, e.g. "12 g".'),
  carbs: z.string().describe('Estimated carbs per serving, e.g. "40 g".'),
  fat: z.string().describe('Estimated fat per serving, e.g. "9 g".'),
});
export type EstimateNutritionOutput = z.infer<typeof EstimateNutritionOutputSchema>;

export async function estimateNutrition(input: EstimateNutritionInput): Promise<EstimateNutritionOutput> {
  return estimateNutritionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'estimateNutritionPrompt',
  input: {schema: EstimateNutritionInputSchema},
  output: {schema: EstimateNutritionOutputSchema},
  prompt: `Estimate the approximate nutrition PER SERVING for this recipe based on its ingredients. These are rough estimates.
If a serving size is given, divide totals accordingly; otherwise assume a sensible number of servings.

{{#if title}}Title: "{{title}}"{{/if}}
Ingredients:
{{ingredients}}
{{#if servingSize}}Serving size: {{servingSize}}{{/if}}

Return calories, protein, carbs, and fat per serving, each as a short string with units. Respond as JSON matching the schema.`,
});

const estimateNutritionFlow = ai.defineFlow(
  {
    name: 'estimateNutritionFlow',
    inputSchema: EstimateNutritionInputSchema,
    outputSchema: EstimateNutritionOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    return output || { calories: '', protein: '', carbs: '', fat: '' };
  }
);
