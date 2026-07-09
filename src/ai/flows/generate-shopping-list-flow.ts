
'use server';
/**
 * @fileOverview Consolidates ingredients from selected recipes into an
 * aisle-grouped shopping list, merging duplicates.
 *
 * - generateShoppingList - Builds a shopping list from recipes.
 * - GenerateShoppingListInput - The input type.
 * - GenerateShoppingListOutput - The return type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecipeInputSchema = z.object({
  title: z.string(),
  ingredients: z.array(z.object({ name: z.string(), quantity: z.string() })),
});

const GenerateShoppingListInputSchema = z.object({
  recipes: z.array(RecipeInputSchema).describe('The recipes to build a combined shopping list from.'),
});
export type GenerateShoppingListInput = z.infer<typeof GenerateShoppingListInputSchema>;

const ShoppingItemSchema = z.object({
  name: z.string().describe('The consolidated ingredient name.'),
  quantity: z.string().describe('The combined quantity needed across all recipes (use "" if not applicable).'),
  recipes: z.array(z.string()).describe('Titles of the recipes this item is needed for.'),
});

const ShoppingGroupSchema = z.object({
  aisle: z.string().describe('The supermarket aisle/section this group belongs to.'),
  items: z.array(ShoppingItemSchema),
});

const GenerateShoppingListOutputSchema = z.object({
  groups: z.array(ShoppingGroupSchema).describe('Shopping items grouped by aisle.'),
});
export type GenerateShoppingListOutput = z.infer<typeof GenerateShoppingListOutputSchema>;
export type ShoppingGroup = z.infer<typeof ShoppingGroupSchema>;
export type ShoppingItem = z.infer<typeof ShoppingItemSchema>;

export async function generateShoppingList(
  input: GenerateShoppingListInput
): Promise<GenerateShoppingListOutput> {
  return generateShoppingListFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateShoppingListPrompt',
  input: {schema: GenerateShoppingListInputSchema},
  output: {schema: GenerateShoppingListOutputSchema},
  prompt: `You are a helpful kitchen assistant. Build a single consolidated grocery shopping list from the recipes below.

Recipes:
{{#each recipes}}
- "{{title}}"
{{#each ingredients}}
    * {{name}}{{#if quantity}} — {{quantity}}{{/if}}
{{/each}}
{{/each}}

Rules:
- Merge the same ingredient across recipes into ONE item. When quantities share compatible units, sum them (e.g. "2 eggs" + "3 eggs" => "5 eggs"). When units differ, combine into a clear string (e.g. "2 cups + 1 lb"). If no quantity is meaningful, use "".
- For each consolidated item, list the titles of the recipes that need it in 'recipes'.
- Group items by supermarket aisle. Use these aisle names where they fit: "Produce", "Meat & Fish", "Dairy & Eggs", "Bakery", "Pantry & Dry Goods", "Spices & Seasonings", "Frozen", "Beverages", "Other".
- Omit plain tap water. Keep everything else a shopper would need to buy.
- Order groups in a sensible shopping order and items alphabetically within each group.

Respond strictly as JSON matching the schema.`,
});

const generateShoppingListFlow = ai.defineFlow(
  {
    name: 'generateShoppingListFlow',
    inputSchema: GenerateShoppingListInputSchema,
    outputSchema: GenerateShoppingListOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    return output || { groups: [] };
  }
);
