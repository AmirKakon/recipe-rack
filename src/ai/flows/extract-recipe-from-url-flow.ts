
'use server';
/**
 * @fileOverview Extracts recipe details from a given URL using AI.
 *
 * - extractRecipeFromUrl - A function that extracts recipe details from a URL.
 * - ExtractRecipeFromUrlInput - The input type.
 * - ExtractRecipeFromUrlOutput - The return type (shares schema with image extraction).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ExtractRecipeFromImageOutputSchema, type ExtractRecipeFromImageOutput } from '@/ai/schemas/recipe-extraction-schemas'; // Re-use the output schema

const ExtractRecipeFromUrlInputSchema = z.object({
  recipeUrl: z.string().url().describe('The URL of the web page containing the recipe.'),
});
export type ExtractRecipeFromUrlInput = z.infer<typeof ExtractRecipeFromUrlInputSchema>;

export type ExtractRecipeFromUrlOutput = ExtractRecipeFromImageOutput;

export async function extractRecipeFromUrl(input: ExtractRecipeFromUrlInput): Promise<ExtractRecipeFromUrlOutput> {
  return extractRecipeFromUrlFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractRecipeFromUrlPrompt',
  input: {schema: ExtractRecipeFromUrlInputSchema},
  output: {schema: ExtractRecipeFromImageOutputSchema}, // Use the same output schema
  prompt: `You are an expert recipe extraction AI. Analyze the content of the web page at the provided URL.
Your task is to fetch the content from "{{recipeUrl}}", identify the main recipe information, and extract its title, ingredients, instructions, cuisine tags, preparation time, cooking time, and serving size.
Respond with a JSON object adhering *strictly* to the schema provided.

- If a piece of information (e.g., cuisine, prep time, or a specific ingredient's quantity) is not found or unclear from the page, use an empty string "" for that string field.
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

Analyze the content from the URL: {{{recipeUrl}}}
`,
});

const extractRecipeFromUrlFlow = ai.defineFlow(
  {
    name: 'extractRecipeFromUrlFlow',
    inputSchema: ExtractRecipeFromUrlInputSchema,
    outputSchema: ExtractRecipeFromImageOutputSchema, // Use the same output schema
  },
  async (input) => {
    // Using Gemini 2.0 Flash, hoping it can handle URL fetching or that Genkit/plugin does.
    const {output} = await prompt(input, { model: 'googleai/gemini-2.0-flash' });
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

