
'use server';
/**
 * @fileOverview Classifies a recipe as meat / dairy / pareve from its ingredients.
 *
 * - classifyKosherCategory - Infers the kosher category for a recipe.
 * - ClassifyKosherCategoryInput - The input type.
 * - ClassifyKosherCategoryOutput - The return type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ClassifyKosherCategoryInputSchema = z.object({
  title: z.string().optional().describe('The recipe title, if available.'),
  ingredients: z.string().describe('The recipe ingredients (comma-separated or newline-separated).'),
});
export type ClassifyKosherCategoryInput = z.infer<typeof ClassifyKosherCategoryInputSchema>;

const ClassifyKosherCategoryOutputSchema = z.object({
  category: z.enum(['meat', 'dairy', 'pareve']).describe("The kosher category: 'meat', 'dairy', or 'pareve'."),
  reasoning: z.string().describe('A brief explanation of why this category was chosen.'),
});
export type ClassifyKosherCategoryOutput = z.infer<typeof ClassifyKosherCategoryOutputSchema>;

export async function classifyKosherCategory(
  input: ClassifyKosherCategoryInput
): Promise<ClassifyKosherCategoryOutput> {
  return classifyKosherCategoryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'classifyKosherCategoryPrompt',
  input: {schema: ClassifyKosherCategoryInputSchema},
  output: {schema: ClassifyKosherCategoryOutputSchema},
  prompt: `You are a kosher dietary expert. Classify the following recipe into exactly one kosher category based on its ingredients.

Categories:
- "meat" (fleishig): contains any meat or poultry (beef, lamb, chicken, turkey, etc.) or meat-derived ingredients (e.g. chicken stock, beef gelatin).
- "dairy" (milchig): contains any milk-based ingredient (milk, cheese, butter, cream, yogurt, etc.) and NO meat.
- "pareve": contains neither meat nor dairy. Fish, eggs, fruits, vegetables, grains, legumes, and plant oils are all pareve.

Important rules:
- Fish (e.g. salmon, tuna) is PAREVE, not meat.
- Eggs are PAREVE.
- If a recipe somehow lists both meat and dairy, classify it as "meat" (meat takes precedence) and note the conflict in the reasoning.
- Base the decision only on the ingredients provided; do not assume unlisted ingredients.

{{#if title}}Recipe title: "{{title}}"{{/if}}
Ingredients:
{{ingredients}}

Respond with a JSON object matching the schema: a 'category' ("meat" | "dairy" | "pareve") and a brief 'reasoning'.`,
});

const classifyKosherCategoryFlow = ai.defineFlow(
  {
    name: 'classifyKosherCategoryFlow',
    inputSchema: ClassifyKosherCategoryInputSchema,
    outputSchema: ClassifyKosherCategoryOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    return output || { category: 'pareve', reasoning: 'Could not determine a category; defaulted to pareve.' };
  }
);
