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

// --- Tag normalization (kept in sync with the web app's src/lib/tags.ts) ---
const SMALL_WORDS = new Set(['and', 'or', 'of', 'the', 'with', 'in', 'a', 'an', 'to', 'for', 'on']);
const capitalizeWord = (word) =>
  word
    .split('-')
    .map((part) => {
      if (/^[A-Z]{2,4}$/.test(part)) return part;
      const lower = part.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('-');
const normalizeTag = (raw) => {
  const text = (raw || '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  return text
    .split(' ')
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word.toLowerCase()) ? word.toLowerCase() : capitalizeWord(word)))
    .join(' ');
};
const normalizeTags = (tags) => {
  const seen = new Set();
  const out = [];
  for (const raw of tags || []) {
    const tag = normalizeTag(raw);
    const key = tag.toLowerCase();
    if (tag && !seen.has(key)) {
      seen.add(key);
      out.push(tag);
    }
  }
  return out;
};

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
  notes: r.notes || '',
  nutrition: r.nutrition || null,
  imageUrl: r.imageUrl || null,
  isFavorite: !!r.isFavorite,
});

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

// Calls Gemini directly (structured JSON output) for the AI tools.
async function callGemini(prompt, responseSchema) {
  if (!GEMINI_API_KEY) {
    throw new Error('AI tools require a GEMINI_API_KEY environment variable on the MCP server.');
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini request failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content.');
  return JSON.parse(text);
}

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
const nutritionSchema = z.object({
  calories: z.string().optional(),
  protein: z.string().optional(),
  carbs: z.string().optional(),
  fat: z.string().optional(),
});

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
    description: 'Create a new recipe. Cuisine tags are normalized to Title Case automatically.',
    inputSchema: {
      title: z.string(),
      ingredients: z.array(ingredientSchema).min(1),
      instructions: z.array(z.string()).min(1),
      cuisines: z.array(z.string()).optional(),
      kosherCategory: z.enum(['meat', 'dairy', 'pareve']).optional(),
      prepTime: z.string().optional(),
      cookTime: z.string().optional(),
      servingSize: z.string().optional(),
      rating: z.number().min(1).max(5).optional(),
      notes: z.string().optional(),
      nutrition: nutritionSchema.optional(),
    },
  },
  guard(async (args) => {
    const payload = { ...args, cuisines: normalizeTags(args.cuisines || []), createdAt: Date.now() };
    const result = await api('/api/recipes/create', { method: 'POST', body: JSON.stringify(payload) });
    return ok({ created: true, id: result.id });
  })
);

server.registerTool(
  'update_recipe',
  {
    description: 'Update an existing recipe. title, ingredients and instructions are required by the backend. Cuisine tags are normalized to Title Case.',
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
      rating: z.number().min(1).max(5).optional(),
      notes: z.string().optional(),
      nutrition: nutritionSchema.optional(),
    },
  },
  guard(async ({ id, cuisines, ...fields }) => {
    const payload = { ...fields, ...(cuisines ? { cuisines: normalizeTags(cuisines) } : {}) };
    await api(`/api/recipes/update/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
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

server.registerTool(
  'suggest_recipes',
  {
    description: 'Suggest up to 3 kosher-friendly recipes for a request, drawing from existing recipes and/or new ideas.',
    inputSchema: {
      query: z.string().describe("What the user wants, e.g. 'a quick dairy-free dinner with chicken'."),
      preferNew: z.boolean().optional().describe('Prefer brand-new ideas over existing recipes.'),
    },
  },
  guard(async ({ query, preferNew }) => {
    const all = await api('/api/recipes/getAll');
    const existing = (all?.data?.recipes || []).map((r) => `- ${r.title} (id: ${r.id})${Array.isArray(r.cuisines) && r.cuisines.length ? ` [${r.cuisines.join(', ')}]` : ''}`).join('\n');
    const prompt = `You are a culinary assistant for a Jewish family that keeps kosher. Suggest up to 3 recipes for this request: "${query}".
${preferNew ? 'Prefer brand-new ideas.' : 'Prefer matching existing recipes first, then fill with new ideas.'}
All NEW suggestions must be kosher-friendly (no pork/shellfish; never mix meat and dairy).
Existing recipes:\n${existing || '(none)'}\n
For each suggestion: set type "existing" (include its id and title) or "new" (include a title). Always include reasoning. Also give an overallReasoning.`;
    const schema = {
      type: 'OBJECT',
      properties: {
        suggestions: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              type: { type: 'STRING', enum: ['existing', 'new'] },
              title: { type: 'STRING' },
              id: { type: 'STRING' },
              reasoning: { type: 'STRING' },
            },
            required: ['type', 'title', 'reasoning'],
          },
        },
        overallReasoning: { type: 'STRING' },
      },
      required: ['suggestions', 'overallReasoning'],
    };
    return ok(await callGemini(prompt, schema));
  })
);

server.registerTool(
  'classify_kosher',
  {
    description: 'Classify a recipe as meat, dairy, or pareve from its ingredients (fish and eggs are pareve).',
    inputSchema: { title: z.string().optional(), ingredients: z.string() },
  },
  guard(async ({ title, ingredients }) => {
    const prompt = `Classify this recipe as kosher "meat" (contains meat/poultry), "dairy" (contains milk/cheese/etc and no meat), or "pareve" (neither; fish and eggs are pareve). If both meat and dairy appear, choose "meat".
${title ? `Title: ${title}\n` : ''}Ingredients: ${ingredients}`;
    const schema = {
      type: 'OBJECT',
      properties: { category: { type: 'STRING', enum: ['meat', 'dairy', 'pareve'] }, reasoning: { type: 'STRING' } },
      required: ['category', 'reasoning'],
    };
    return ok(await callGemini(prompt, schema));
  })
);

server.registerTool(
  'generate_shopping_list',
  {
    description: 'Build a consolidated, aisle-grouped shopping list from the given recipe ids.',
    inputSchema: { recipeIds: z.array(z.string()).min(1) },
  },
  guard(async ({ recipeIds }) => {
    const all = await api('/api/recipes/getAll');
    const chosen = (all?.data?.recipes || []).filter((r) => recipeIds.includes(r.id));
    if (chosen.length === 0) throw new Error('None of the given recipe ids were found.');
    const text = chosen
      .map((r) => `"${r.title}"\n${(r.ingredients || []).map((i) => `  - ${i.name}${i.quantity ? ` (${i.quantity})` : ''}`).join('\n')}`)
      .join('\n');
    const prompt = `Build one consolidated grocery shopping list from these recipes. Merge duplicate ingredients (sum compatible units, e.g. "2 eggs"+"3 eggs" => "5 eggs"; otherwise combine like "2 cups + 1 lb"). Group items by supermarket aisle (Produce, Meat & Fish, Dairy & Eggs, Bakery, Pantry & Dry Goods, Spices & Seasonings, Frozen, Beverages, Other). For each item list the recipe titles that need it. Omit plain water.\n\n${text}`;
    const schema = {
      type: 'OBJECT',
      properties: {
        groups: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              aisle: { type: 'STRING' },
              items: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' },
                    quantity: { type: 'STRING' },
                    recipes: { type: 'ARRAY', items: { type: 'STRING' } },
                  },
                  required: ['name', 'quantity', 'recipes'],
                },
              },
            },
            required: ['aisle', 'items'],
          },
        },
      },
      required: ['groups'],
    };
    return ok(await callGemini(prompt, schema));
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
