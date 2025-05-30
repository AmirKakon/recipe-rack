
'use server';
/**
 * @fileOverview Extracts recipe details from an image or PDF using AI.
 *
 * - extractRecipeFromImage - A function that extracts recipe details.
 * - ExtractRecipeFromImageInput - The input type.
 * - ExtractRecipeFromImageOutput - The return type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ExtractRecipeFromImageOutputSchema, type ExtractRecipeFromImageOutput } from '@/ai/schemas/recipe-extraction-schemas';

const ExtractRecipeFromImageInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      "A photo of a recipe (image/*) or a recipe document (application/pdf), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractRecipeFromImageInput = z.infer<typeof ExtractRecipeFromImageInputSchema>;

// The ExtractRecipeFromImageOutputSchema and its type are now imported from '@/ai/schemas/recipe-extraction-schemas'

export async function extractRecipeFromImage(input: ExtractRecipeFromImageInput): Promise<ExtractRecipeFromImageOutput> {
  return extractRecipeFromImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractRecipeFromImagePrompt',
  input: {schema: ExtractRecipeFromImageInputSchema},
  output: {schema: ExtractRecipeFromImageOutputSchema},
  prompt: `You are an expert recipe extraction AI. Analyze the provided image or PDF document of a recipe.
Your task is to extract the title, ingredients, instructions, cuisine tags, preparation time, cooking time, and serving size.
Respond with a JSON object adhering *strictly* to the schema provided.

- If a piece of information (e.g., cuisine, prep time, or a specific ingredient's quantity) is not found or unclear from the file, use an empty string "" for that string field.
- For arrays (ingredients, instructions): if no items are found or they are unclear, provide an empty array [].
- Do not omit any fields from the main JSON structure. All specified fields (title, ingredients, instructions, cuisine, prepTime, cookTime, servingSize) must be present.

Detailed Extraction Guidelines:
- **title**: The main title of the recipe. If not found or illegible, use "".
- **ingredients**: An array of objects. Each object *must* contain a "name" (string) and "quantity" (string) field. The "id" field is optional and should only be included if an identifier is explicitly present in the source for an ingredient; otherwise, omit it.
    - If no ingredients list is clearly identifiable, or if the items are not presented with quantities, provide an empty array: [].
    - If an individual ingredient's name or quantity is unclear, use "" for that specific field within its object.
- **instructions**: An array of strings. Each string represents a single, complete step of the recipe.
    - If no step-by-step instructions are clearly identifiable, provide an empty array: [].
    - Ensure each element in the array is a distinct step.
- **cuisine**: A comma-separated string of 1-3 relevant cuisine tags (e.g., "Italian, Quick, Dinner"). If no cuisine is apparent or suggested, use "".
- **prepTime**: The preparation time (e.g., "20 mins"). Use "" if not explicitly stated or unclear.
- **cookTime**: The cooking time (e.g., "1 hr 15 mins"). Use "" if not explicitly stated or unclear.
- **servingSize**: The number of servings (e.g., "Serves 4", "Makes 12 cookies"). Use "" if not explicitly stated or unclear.

File to analyze:
{{media url=fileDataUri}}`,
});

const extractRecipeFromImageFlow = ai.defineFlow(
  {
    name: 'extractRecipeFromImageFlow',
    inputSchema: ExtractRecipeFromImageInputSchema,
    outputSchema: ExtractRecipeFromImageOutputSchema,
  },
  async input => {
    // Using Gemini 2.0 Flash as it supports multimodal input.
    const {output} = await prompt(input, { model: 'googleai/gemini-2.0-flash' });
    // If output is null/undefined (e.g. model error or schema validation failed upstream in prompt),
    // return a default structure that matches the schema to prevent downstream errors.
    return output || { 
      title: '', 
      ingredients: [], 
      instructions: [], 
      cuisine: '',
      prepTime: '',
      cookTime: '',
      servingSize: ''
    };
  }
);

