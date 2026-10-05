import type { Recipe } from '@/lib/types';

export const RECIPE_API_BASE_URL = 'https://us-central1-recipe-rack-ighp8.cloudfunctions.net/app';

export class RecipeNotFoundError extends Error {
  constructor(id: string) {
    super(`Recipe not found: ${id}`);
    this.name = 'RecipeNotFoundError';
  }
}

export function normalizeRecipe(raw: any): Recipe {
  let cuisines: string[] = [];
  if (Array.isArray(raw.cuisines)) {
    cuisines = raw.cuisines;
  } else if (typeof raw.cuisine === 'string' && raw.cuisine.trim() !== '') {
    cuisines = [raw.cuisine.trim()];
  }
  return {
    ...raw,
    cuisines,
    cuisine: undefined,
    prepTime: raw.prepTime || undefined,
    cookTime: raw.cookTime || undefined,
    servingSize: raw.servingSize || undefined,
  } as Recipe;
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.message || body?.msg || `${fallback}: ${response.statusText}`;
}

export async function fetchRecipes(): Promise<Recipe[]> {
  const response = await fetch(`${RECIPE_API_BASE_URL}/api/recipes/getAll`);
  if (!response.ok) throw new Error(`Failed to fetch recipes: ${response.statusText}`);
  const result = await response.json();
  return Array.isArray(result?.data?.recipes) ? result.data.recipes.map(normalizeRecipe) : [];
}

export async function fetchRecipe(id: string): Promise<Recipe> {
  const response = await fetch(`${RECIPE_API_BASE_URL}/api/recipes/get/${id}`);
  if (response.status === 404) throw new RecipeNotFoundError(id);
  if (!response.ok) throw new Error(`Failed to fetch recipe: ${response.statusText}`);
  const result = await response.json();
  if (result?.status !== 'Success' || !result.data) throw new RecipeNotFoundError(id);
  return normalizeRecipe(result.data);
}

export async function createRecipe(fields: Omit<Recipe, 'id'>): Promise<string> {
  const response = await fetch(`${RECIPE_API_BASE_URL}/api/recipes/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to save recipe'));
  const result = await response.json();
  return result.id;
}

// The update endpoint requires title/ingredients/instructions on every call and merges
// the rest, so partial changes are sent on top of the current recipe's required fields.
export async function updateRecipe(recipe: Recipe, changes: Partial<Recipe> = {}): Promise<void> {
  const { id, cuisine, ...current } = { ...recipe, ...changes };
  const response = await fetch(`${RECIPE_API_BASE_URL}/api/recipes/update/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...current,
      ingredients: current.ingredients || [],
      instructions: current.instructions || [],
      cuisines: current.cuisines || [],
    }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to update recipe'));
}

export async function deleteRecipe(id: string): Promise<void> {
  const response = await fetch(`${RECIPE_API_BASE_URL}/api/recipes/delete/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to delete recipe'));
}
