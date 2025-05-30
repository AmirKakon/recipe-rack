
'use server';
/**
 * @fileOverview Suggests a recipe based on user input, considering existing recipes.
 *
 * - suggestRecipeBasedOnInput - A function that handles the recipe suggestion.
 * - SuggestRecipeBasedOnInputInput - The input type.
 * - SuggestRecipeBasedOnInputOutput - The return type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExistingRecipeInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  cuisines: z.array(z.string()).optional().describe("Cuisine tags of the existing recipe, if any."),
});

const SuggestRecipeBasedOnInputInputSchema = z.object({
  userInput: z.string().describe('The user\'s textual request for a recipe (e.g., "spicy chicken for dinner", "a quick vegetarian lunch").'),
  existingRecipes: z.array(ExistingRecipeInfoSchema).describe('A list of currently available recipes, each with an ID, title, and optional cuisine tags. The AI should consider these first.'),
});
export type SuggestRecipeBasedOnInputInput = z.infer<typeof SuggestRecipeBasedOnInputInputSchema>;

const SuggestedIngredientSchema = z.object({
    name: z.string().describe("Name of the ingredient."),
    quantity: z.string().describe("Quantity of the ingredient. Use '' if not applicable or unsure."),
});

const SuggestRecipeBasedOnInputOutputSchema = z.object({
  suggestionType: z.enum(['existing', 'new', 'none']).describe("Type of suggestion: 'existing' if a matching existing recipe is found from the provided list, 'new' if a new recipe is generated, 'none' if no suitable suggestion can be made based on the input."),
  existingRecipeId: z.string().optional().describe("The ID of the existing recipe, if suggestionType is 'existing'."),
  existingRecipeTitle: z.string().optional().describe("The title of the existing recipe, if suggestionType is 'existing'."),
  newRecipeTitle: z.string().optional().describe("The title for the new recipe suggestion, if suggestionType is 'new'. Use '' if not applicable."),
  newRecipeIngredients: z.array(SuggestedIngredientSchema).optional().describe("List of ingredients for the new recipe, if suggestionType is 'new'. Each ingredient *must* have 'name' (string) and 'quantity' (string) fields. Provide an empty array [] if not applicable or if ingredients cannot be clearly identified."),
  newRecipeInstructions: z.array(z.string()).optional().describe("List of instruction strings for the new recipe, if suggestionType is 'new'. Each string is a single step. Provide an empty array [] if not applicable or if instructions cannot be clearly identified."),
  newRecipeCuisine: z.string().optional().describe("Comma-separated cuisine tags for the new recipe (e.g., 'Italian, Quick'), if suggestionType is 'new'. Use '' if not applicable."),
  newRecipePrepTime: z.string().optional().describe("Suggested prep time for the new recipe (e.g., '20 minutes'), if suggestionType is 'new'. Use '' if not applicable."),
  newRecipeCookTime: z.string().optional().describe("Suggested cook time for the new recipe (e.g., '45 minutes'), if suggestionType is 'new'. Use '' if not applicable."),
  newRecipeServingSize: z.string().optional().describe("Suggested serving size for the new recipe (e.g., '4 servings'), if suggestionType is 'new'. Use '' if not applicable."),
  reasoning: z.string().describe("A brief explanation for why this suggestion was made, or why no suggestion could be made. This should always be populated.")
});
export type SuggestRecipeBasedOnInputOutput = z.infer<typeof SuggestRecipeBasedOnInputOutputSchema>;


export async function suggestRecipeBasedOnInput(input: SuggestRecipeBasedOnInputInput): Promise<SuggestRecipeBasedOnInputOutput> {
  return suggestRecipeBasedOnInputFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestRecipeBasedOnInputPrompt',
  input: {schema: SuggestRecipeBasedOnInputInputSchema},
  output: {schema: SuggestRecipeBasedOnInputOutputSchema},
  prompt: `You are a helpful culinary assistant. The user wants a recipe suggestion.
User's request: "{{userInput}}"

Consider these existing recipes first:
{{#if existingRecipes.length}}
{{#each existingRecipes}}
- Title: "{{title}}", ID: "{{id}}"{{#if cuisines.length}}, Cuisines: {{join cuisines ", "}}{{/if}}
{{/each}}
{{else}}
- No existing recipes provided.
{{/if}}

Your task:
1.  Analyze the user's request: "{{userInput}}".
2.  Check if any of the "existingRecipes" (titles provided above) are a very good match for the user's request.
    - If a strong match is found: Set "suggestionType" to "existing". Populate "existingRecipeId", "existingRecipeTitle" with the matched recipe's details. Provide a "reasoning" explaining why it's a good match. Do NOT populate new recipe fields.
3.  If no strong match is found in existing recipes, OR if the user's request implies they want something new or different:
    - Set "suggestionType" to "new".
    - Generate a NEW recipe concept based on the user's request.
    - Populate "newRecipeTitle", "newRecipeIngredients" (array of {name, quantity}), "newRecipeInstructions" (array of strings), "newRecipeCuisine" (comma-separated tags), "newRecipePrepTime", "newRecipeCookTime", and "newRecipeServingSize".
    - Provide a "reasoning" explaining the new recipe idea.
    - If you generate a new recipe, ensure all 'newRecipe*' fields are populated. Use empty strings or empty arrays for fields if specific details cannot be determined for the new recipe. For ingredients and instructions, if none can be generated, return empty arrays.
4.  If you cannot make any sensible suggestion (neither existing nor new) based on the user's input (e.g., the input is too vague, unrelated to food, or nonsensical):
    - Set "suggestionType" to "none".
    - Provide a "reasoning" explaining why no suggestion could be made (e.g., "The request was a bit too vague, could you provide more details?"). Do NOT populate any other fields.

Respond strictly with a JSON object matching the output schema.
The 'reasoning' field MUST always be populated.
For 'newRecipeIngredients', each object must have 'name' and 'quantity'.
For 'newRecipeInstructions', each element must be a string representing a step.
If suggesting a new recipe, and a field like prepTime cannot be estimated, use an empty string "" for it.
Do not make up existing recipe IDs or titles; only use those provided if making an 'existing' suggestion.
Prioritize suggesting an existing recipe if it's a good fit. Only suggest 'new' if there's no good existing match or the user clearly wants something new.
`,
});

const suggestRecipeBasedOnInputFlow = ai.defineFlow(
  {
    name: 'suggestRecipeBasedOnInputFlow',
    inputSchema: SuggestRecipeBasedOnInputInputSchema,
    outputSchema: SuggestRecipeBasedOnInputOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    // Ensure a valid object matching the schema is always returned
    return output || {
        suggestionType: 'none',
        reasoning: 'An unexpected error occurred, and no suggestion could be generated. Please try again.',
        newRecipeIngredients: [],
        newRecipeInstructions: []
    };
  }
);

    