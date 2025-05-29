
'use server';
/**
 * @fileOverview Extracts recipe details from an image using AI.
 *
 * - extractRecipeFromImage - A function that extracts recipe details from an image.
 * - ExtractRecipeFromImageInput - The input type for the extractRecipeFromImage function.
 * - ExtractRecipeFromImageOutput - The return type for the extractRecipeFromImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractRecipeFromImageInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo of a recipe, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractRecipeFromImageInput = z.infer<typeof ExtractRecipeFromImageInputSchema>;

// Output schema designed to be mappable to RecipeFormData, with all fields optional
const ExtractedIngredientSchema = z.object({
  name: z.string().describe('The name of the ingredient.'),
  quantity: z.string().describe('The quantity or amount of the ingredient.'),
});

const ExtractRecipeFromImageOutputSchema = z.object({
  title: z.string().optional().describe('The extracted title of the recipe.'),
  ingredients: z.array(ExtractedIngredientSchema).optional().describe('A list of extracted ingredients with their names and quantities.'),
  instructions: z.array(z.string()).optional().describe('A list of extracted instruction steps.'),
  cuisine: z.string().optional().describe('Comma-separated cuisine tags suggested for the recipe.'),
});
export type ExtractRecipeFromImageOutput = z.infer<typeof ExtractRecipeFromImageOutputSchema>;

export async function extractRecipeFromImage(input: ExtractRecipeFromImageInput): Promise<ExtractRecipeFromImageOutput> {
  return extractRecipeFromImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractRecipeFromImagePrompt',
  input: {schema: ExtractRecipeFromImageInputSchema},
  output: {schema: ExtractRecipeFromImageOutputSchema},
  prompt: `You are an expert recipe analyst. Analyze the provided image of a recipe page or dish.
Extract the following information:
1.  **Title**: The main title of the recipe.
2.  **Ingredients**: A list of ingredients. For each ingredient, provide its name and quantity.
3.  **Instructions**: A list of step-by-step cooking instructions. Each step should be a separate string in an array.
4.  **Cuisine**: Suggest 1-3 relevant cuisine tags for this recipe, comma-separated (e.g., "Italian, Quick, Dinner").

Prioritize accuracy. If some information is not clearly visible or inferable from the image, omit it from the output or provide an empty field where appropriate.

Image to analyze:
{{media url=imageDataUri}}`,
});

const extractRecipeFromImageFlow = ai.defineFlow(
  {
    name: 'extractRecipeFromImageFlow',
    inputSchema: ExtractRecipeFromImageInputSchema,
    outputSchema: ExtractRecipeFromImageOutputSchema,
  },
  async input => {
    // Using Gemini 2.0 Flash as it supports multimodal input
    // and is generally faster for such tasks.
    const {output} = await prompt(input, { model: 'googleai/gemini-2.0-flash' });
    return output || {}; // Ensure we always return an object, even if AI output is null/undefined
  }
);
