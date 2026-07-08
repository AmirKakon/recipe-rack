
'use server';
/**
 * @fileOverview Extracts recipe details from a TikTok video link using AI.
 *
 * Strategy: TikTok videos cannot be read directly by the model, but most food
 * TikToks write the recipe in the post caption. We fetch that caption via
 * TikTok's public oEmbed endpoint and let the model extract the recipe from it.
 *
 * - extractRecipeFromTiktok - Extracts recipe details from a TikTok URL.
 * - ExtractRecipeFromTiktokInput - The input type.
 * - ExtractRecipeFromTiktokOutput - The return type (shares schema with image extraction).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ExtractRecipeFromImageOutputSchema, type ExtractRecipeFromImageOutput } from '@/ai/schemas/recipe-extraction-schemas'; // Re-use the output schema

const ExtractRecipeFromTiktokInputSchema = z.object({
  videoUrl: z.string().url().describe('The URL of the TikTok video containing the recipe.'),
});
export type ExtractRecipeFromTiktokInput = z.infer<typeof ExtractRecipeFromTiktokInputSchema>;

export type ExtractRecipeFromTiktokOutput = ExtractRecipeFromImageOutput;

const emptyResult: ExtractRecipeFromImageOutput = {
  title: '',
  ingredients: [],
  instructions: [],
  cuisine: '',
  prepTime: '',
  cookTime: '',
  servingSize: '',
};

interface TiktokOembed {
  title?: string;
  author_name?: string;
}

/**
 * Fetches the TikTok post's caption (and author) via the public oEmbed endpoint.
 * The oEmbed `title` field carries the full caption text, which is where food
 * creators usually write the recipe.
 */
async function fetchTiktokCaption(videoUrl: string): Promise<{ caption: string; author: string }> {
  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;

  let response: Response;
  try {
    response = await fetch(oembedUrl, {
      headers: { Accept: 'application/json' },
    });
  } catch (cause) {
    throw new Error('Could not reach TikTok to read this video. Please check the link and try again.', { cause });
  }

  if (!response.ok) {
    throw new Error(
      `TikTok did not return this video's details (status ${response.status}). Make sure the link is a public TikTok video URL.`
    );
  }

  const data = (await response.json()) as TiktokOembed;
  const caption = (data.title ?? '').trim();

  if (!caption) {
    throw new Error(
      "This TikTok has no readable caption, so there's no recipe text to extract. Try a video whose caption contains the recipe."
    );
  }

  return { caption, author: (data.author_name ?? '').trim() };
}

export async function extractRecipeFromTiktok(
  input: ExtractRecipeFromTiktokInput
): Promise<ExtractRecipeFromTiktokOutput> {
  return extractRecipeFromTiktokFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractRecipeFromTiktokPrompt',
  input: {
    schema: z.object({
      caption: z.string(),
      author: z.string(),
    }),
  },
  output: {schema: ExtractRecipeFromImageOutputSchema}, // Use the same output schema
  prompt: `You are an expert recipe extraction AI. Below is the caption of a TikTok cooking video{{#if author}} by "{{author}}"{{/if}}.
Food creators usually write the ingredients and steps in the caption, but it may also contain hashtags, emojis, links, and promotional text that are NOT part of the recipe. Ignore anything that is not part of the recipe.
Your task is to extract the title, ingredients, instructions, cuisine tags, preparation time, cooking time, and serving size.
Respond with a JSON object adhering *strictly* to the schema provided.

- If a piece of information (e.g., cuisine, prep time, or a specific ingredient's quantity) is not found or unclear from the caption, use an empty string "" for that string field.
- For arrays (ingredients, instructions): if no items are found or they are unclear, provide an empty array [].
- Do not omit any fields from the main JSON structure. All specified fields (title, ingredients, instructions, cuisine, prepTime, cookTime, servingSize) must be present.

Detailed Extraction Guidelines:
- **title**: The name of the dish. If the caption has no clear title, infer a concise one from the dish being made, otherwise use "".
- **ingredients**: An array of objects. Each object *must* contain a "name" (string) and "quantity" (string) field. The "id" field should be omitted.
    - If no ingredients are clearly identifiable, provide an empty array: [].
    - If an individual ingredient's name or quantity is unclear, use "" for that specific field within its object.
- **instructions**: An array of strings. Each string represents a single, complete step of the recipe.
    - If no step-by-step instructions are clearly identifiable, provide an empty array: [].
    - Ensure each element in the array is a distinct step.
- **cuisine**: A comma-separated string of 1-3 relevant cuisine tags (e.g., "Italian, Quick, Dinner"). If none is apparent, use "".
- **prepTime**: The preparation time (e.g., "20 mins"). Use "" if not stated.
- **cookTime**: The cooking time (e.g., "1 hr 15 mins"). Use "" if not stated.
- **servingSize**: The number of servings (e.g., "Serves 4"). Use "" if not stated.

TikTok caption:
"""
{{caption}}
"""
`,
});

const extractRecipeFromTiktokFlow = ai.defineFlow(
  {
    name: 'extractRecipeFromTiktokFlow',
    inputSchema: ExtractRecipeFromTiktokInputSchema,
    outputSchema: ExtractRecipeFromImageOutputSchema, // Use the same output schema
  },
  async (input) => {
    const {caption, author} = await fetchTiktokCaption(input.videoUrl);
    const {output} = await prompt({caption, author}, { model: 'googleai/gemini-2.0-flash' });
    return output || emptyResult;
  }
);
