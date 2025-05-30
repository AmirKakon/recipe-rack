
'use server';
/**
 * @fileOverview Suggests up to 3 recipes based on user input, considering existing recipes.
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
  preferNew: z.boolean().optional().default(false).describe('If true, the AI should prioritize suggesting new recipes rather than existing ones.'),
});
export type SuggestRecipeBasedOnInputInput = z.infer<typeof SuggestRecipeBasedOnInputInputSchema>;

const SuggestedIngredientSchema = z.object({
    name: z.string().describe("Name of the ingredient."),
    quantity: z.string().describe("Quantity of the ingredient. Use '' if not applicable or unsure."),
});

const NewRecipeDetailsSchema = z.object({
  title: z.string().describe("Title for the new recipe. Use '' if not applicable."),
  ingredients: z.array(SuggestedIngredientSchema).describe("Ingredients for the new recipe. Empty array if not applicable or if ingredients cannot be clearly identified."),
  instructions: z.array(z.string()).describe("List of instruction strings for the new recipe. Each string is a single step. Empty array if not applicable or if instructions cannot be clearly identified."),
  cuisine: z.string().describe("Comma-separated cuisine tags for the new recipe (e.g., 'Italian, Quick'). Use '' if not applicable. Do not include 'Kosher' as a tag here."),
  prepTime: z.string().describe("Suggested prep time for the new recipe (e.g., '20 minutes'). Use '' if not applicable."),
  cookTime: z.string().describe("Suggested cook time for the new recipe (e.g., '45 minutes'). Use '' if not applicable."),
  servingSize: z.string().describe("Suggested serving size for the new recipe (e.g., '4 servings'). Use '' if not applicable."),
});

const ExistingRecipeSuggestionSchema = z.object({
  id: z.string().describe("ID of the existing recipe."),
  title: z.string().describe("Title of the existing recipe."),
});

const SuggestedRecipeItemSchema = z.object({
  type: z.enum(['existing', 'new']).describe("Type of suggestion: 'existing' or 'new'."),
  reasoning: z.string().describe("Reasoning for this specific suggestion. This must always be populated."),
  existingRecipe: ExistingRecipeSuggestionSchema.optional().describe("Details if it's an existing recipe suggestion. Present only if type is 'existing'."),
  newRecipe: NewRecipeDetailsSchema.optional().describe("Details if it's a new recipe suggestion. Present only if type is 'new'."),
});
export type SuggestedRecipeItem = z.infer<typeof SuggestedRecipeItemSchema>;

const SuggestRecipeBasedOnInputOutputSchema = z.object({
  suggestions: z.array(SuggestedRecipeItemSchema).describe("An array of up to 3 recipe suggestions. Can be empty if no suitable suggestions are found."),
  overallReasoning: z.string().describe("A brief overall explanation for the set of suggestions provided, or why no suggestions could be made if the 'suggestions' array is empty. This must always be populated, even if no suggestions are made.")
});
export type SuggestRecipeBasedOnInputOutput = z.infer<typeof SuggestRecipeBasedOnInputOutputSchema>;


export async function suggestRecipeBasedOnInput(input: SuggestRecipeBasedOnInputInput): Promise<SuggestRecipeBasedOnInputOutput> {
  return suggestRecipeBasedOnInputFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestRecipeBasedOnInputPrompt',
  input: {schema: SuggestRecipeBasedOnInputInputSchema},
  output: {schema: SuggestRecipeBasedOnInputOutputSchema},
  prompt: `You are a helpful culinary assistant. The user wants recipe suggestions based on their input. These suggestions are for a Jewish family that keeps kosher.
User's request: "{{userInput}}"
Prioritize new recipes if 'preferNew' is true: {{preferNew}}

Consider these existing recipes first (unless 'preferNew' is true):
{{#if existingRecipes.length}}
{{#each existingRecipes}}
- Title: "{{title}}", ID: "{{id}}"{{#if cuisines.length}}, Cuisines: {{#each cuisines}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}
{{/each}}
{{else}}
- No existing recipes provided.
{{/if}}

Your task is to provide up to 3 diverse recipe suggestions. Each suggestion can be either an existing recipe from the list above or a completely new recipe idea.

Output Format:
Respond with a JSON object adhering *strictly* to the schema. The main object should have two keys:
1.  'suggestions': An array of suggestion items. Each item must be an object with the following fields:
    *   'type': String, either "existing" or "new".
    *   'reasoning': String, a brief explanation for *this specific suggestion*. Must always be populated.
    *   'existingRecipe': (Only if 'type' is "existing") An object with 'id' and 'title' of the matched existing recipe.
    *   'newRecipe': (Only if 'type' is "new") An object with 'title', 'ingredients' (array of {name, quantity}), 'instructions' (array of strings), 'cuisine' (comma-separated tags), 'prepTime', 'cookTime', and 'servingSize'. Ensure 'ingredients' and 'instructions' are empty arrays if none can be determined for a new idea, rather than null or omitting the field. For other string fields in newRecipe, use "" if a value cannot be determined.
2.  'overallReasoning': String, a brief overall summary of the suggestions or why no suggestions could be made. Must always be populated.

Guidelines:
-   If 'preferNew' is true, focus on generating new recipe ideas even if there are potential existing matches.
-   If not 'preferNew', first check if any "existingRecipes" are a strong match for "{{userInput}}". If so, include them.
-   Then, fill the remaining slots (up to 3 total suggestions) with new recipe ideas based on "{{userInput}}".
-   **Important for newRecipe suggestions:** All *new* recipe suggestions *must* be kosher-friendly, suitable for a Jewish family that observes kosher dietary laws. This means:
    *   No pork or shellfish.
    *   Meat and dairy ingredients should not be mixed in the same dish or recipe.
    *   If suggesting a meat dish, ensure no dairy is included in its ingredients or preparation.
    *   If suggesting a dairy dish, ensure no meat is included.
    *   Pareve (neutral) dishes are also welcome.
    *   Clearly state in the 'reasoning' for a new recipe that it has been designed to be kosher-friendly.
-   If you cannot make any sensible suggestions (e.g., input is too vague), return an empty 'suggestions' array and explain why in 'overallReasoning'.
-   Each suggestion item in the 'suggestions' array must have its own 'reasoning'.
-   Do not make up existing recipe IDs or titles; only use those provided.
-   For 'newRecipe.ingredients', each object must have 'name' and 'quantity'.
-   For 'newRecipe.instructions', each element must be a string representing a step.
-   For 'newRecipe.cuisine' tags, list relevant culinary styles (e.g., 'Italian', 'Asian', 'Quick'). Do not include 'Kosher' as a cuisine tag, as all new suggestions are inherently kosher-friendly.

Example of a 'suggestions' item for an existing recipe:
{ "type": "existing", "reasoning": "This existing pasta dish matches your request for something quick and Italian.", "existingRecipe": { "id": "xyz123", "title": "Quick Tomato Pasta" } }

Example of a 'suggestions' item for a new recipe (kosher-friendly):
{ "type": "new", "reasoning": "A fresh idea for a kosher-friendly chicken stir-fry. This recipe avoids dairy and uses only kosher ingredients.", "newRecipe": { "title": "Chicken and Veggie Stir-fry", "ingredients": [{"name": "Chicken Breast", "quantity": "1 lb"}, {"name": "Broccoli", "quantity": "1 head"}], "instructions": ["Cut chicken...", "Stir-fry veggies..."], "cuisine": "Asian, Stir-fry", "prepTime": "15 mins", "cookTime": "20 mins", "servingSize": "2 servings" } }
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
        suggestions: [],
        overallReasoning: 'An unexpected error occurred, and no suggestions could be generated. Please try again.',
    };
  }
);
    
