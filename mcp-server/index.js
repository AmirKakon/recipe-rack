#!/usr/bin/env node
/**
 * Recipe Rack MCP server.
 *
 * Exposes the Recipe Rack recipe collection and weekly meal plan as MCP tools
 * so an MCP client (Claude Desktop / Claude Code) can read and manage them.
 * Talks to the existing Cloud Functions REST API.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_BASE_URL = process.env.RECIPE_RACK_API_URL || 'https://us-central1-recipe-rack-ighp8.cloudfunctions.net/app';

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${options.method || 'GET'} ${path} failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`);
  }
  return res.json();
}

const normalizeRecipe = (r) => ({
  id: r.id,
  title: r.title,
  kosherCategory: r.kosherCategory || null,
  cuisines: Array.isArray(r.cuisines) ? r.cuisines : r.cuisine ? [r.cuisine] : [],
  ingredients: r.ingredients || [],
  instructions: Array.isArray(r.instructions) ? r.instructions : r.instructions ? [r.instructions] : [],
  prepTime: r.prepTime || '',
  cookTime: r.cookTime || '',
  servingSize: r.servingSize || '',
  rating: r.rating || null,
});

const ok = (data) => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] });

/** Wraps a handler so thrown errors become MCP tool errors instead of crashing. */
const guard = (fn) => async (args) => {
  try {
    return await fn(args);
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
  }
};

const ingredientSchema = z.object({ name: z.string(), quantity: z.string().default('') });

const server = new McpServer({ name: 'recipe-rack', version: '1.0.0' });

server.registerTool(
  'list_recipes',
  { description: 'List all recipes (id, title, kosher category, cuisine tags).' },
  guard(async () => {
    const result = await api('/api/recipes/getAll');
    const recipes = (result?.data?.recipes || []).map((r) => ({
      id: r.id,
      title: r.title,
      kosherCategory: r.kosherCategory || null,
      cuisines: Array.isArray(r.cuisines) ? r.cuisines : [],
    }));
    return ok({ count: recipes.length, recipes });
  })
);

server.registerTool(
  'search_recipes',
  {
    description: 'Search recipes by a text query (title/cuisine) and/or kosher category.',
    inputSchema: {
      query: z.string().optional().describe('Text to match in title or cuisine tags.'),
      kosherCategory: z.enum(['meat', 'dairy', 'pareve']).optional(),
    },
  },
  guard(async ({ query, kosherCategory }) => {
    const result = await api('/api/recipes/getAll');
    const q = (query || '').toLowerCase();
    const recipes = (result?.data?.recipes || [])
      .filter((r) => {
        const cuisines = Array.isArray(r.cuisines) ? r.cuisines : [];
        const matchesQuery = !q || r.title.toLowerCase().includes(q) || cuisines.some((t) => t.toLowerCase().includes(q));
        const matchesKosher = !kosherCategory || r.kosherCategory === kosherCategory;
        return matchesQuery && matchesKosher;
      })
      .map((r) => ({ id: r.id, title: r.title, kosherCategory: r.kosherCategory || null, cuisines: Array.isArray(r.cuisines) ? r.cuisines : [] }));
    return ok({ count: recipes.length, recipes });
  })
);

server.registerTool(
  'get_recipe',
  { description: 'Get a single recipe with full details.', inputSchema: { id: z.string() } },
  guard(async ({ id }) => {
    const result = await api(`/api/recipes/get/${encodeURIComponent(id)}`);
    return ok(normalizeRecipe(result.data));
  })
);

server.registerTool(
  'create_recipe',
  {
    description: 'Create a new recipe.',
    inputSchema: {
      title: z.string(),
      ingredients: z.array(ingredientSchema).min(1),
      instructions: z.array(z.string()).min(1),
      cuisines: z.array(z.string()).optional(),
      kosherCategory: z.enum(['meat', 'dairy', 'pareve']).optional(),
      prepTime: z.string().optional(),
      cookTime: z.string().optional(),
      servingSize: z.string().optional(),
    },
  },
  guard(async (args) => {
    const payload = { ...args, cuisines: args.cuisines || [], createdAt: Date.now() };
    const result = await api('/api/recipes/create', { method: 'POST', body: JSON.stringify(payload) });
    return ok({ created: true, id: result.id });
  })
);

server.registerTool(
  'update_recipe',
  {
    description: 'Update an existing recipe. title, ingredients and instructions are required by the backend.',
    inputSchema: {
      id: z.string(),
      title: z.string(),
      ingredients: z.array(ingredientSchema).min(1),
      instructions: z.array(z.string()).min(1),
      cuisines: z.array(z.string()).optional(),
      kosherCategory: z.enum(['meat', 'dairy', 'pareve']).optional(),
      prepTime: z.string().optional(),
      cookTime: z.string().optional(),
      servingSize: z.string().optional(),
    },
  },
  guard(async ({ id, ...fields }) => {
    await api(`/api/recipes/update/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(fields) });
    return ok({ updated: true, id });
  })
);

server.registerTool(
  'delete_recipe',
  { description: 'Delete a recipe by id.', inputSchema: { id: z.string() } },
  guard(async ({ id }) => {
    await api(`/api/recipes/delete/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return ok({ deleted: true, id });
  })
);

server.registerTool(
  'get_meal_plan',
  { description: 'Get the weekly meal plan (entries of date, mealType, recipeId), enriched with recipe titles.' },
  guard(async () => {
    const [plan, recipes] = await Promise.all([api('/api/mealplan'), api('/api/recipes/getAll')]);
    const titleById = new Map((recipes?.data?.recipes || []).map((r) => [r.id, r.title]));
    const entries = (plan?.data?.entries || []).map((e) => ({ ...e, recipeTitle: titleById.get(e.recipeId) || '(unknown)' }));
    return ok({ count: entries.length, entries });
  })
);

server.registerTool(
  'set_meal_plan',
  {
    description: 'Replace the entire weekly meal plan with the provided entries.',
    inputSchema: {
      entries: z.array(
        z.object({
          date: z.string().describe('YYYY-MM-DD'),
          mealType: z.enum(['breakfast', 'lunch', 'dinner']),
          recipeId: z.string(),
        })
      ),
    },
  },
  guard(async ({ entries }) => {
    await api('/api/mealplan', { method: 'PUT', body: JSON.stringify({ entries }) });
    return ok({ saved: true, count: entries.length });
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so it doesn't corrupt the stdio JSON-RPC stream.
  console.error('Recipe Rack MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
