const { app, logger } = require("../../../setup");
const RecipeService = require("../../Services/Recipes");
const MealPlanService = require("../../Services/MealPlan");

// --- Tag normalization (kept in sync with the web app's src/lib/tags.ts) ---
const SMALL_WORDS = new Set(["and", "or", "of", "the", "with", "in", "a", "an", "to", "for", "on"]);
const capitalizeWord = (word) =>
  word
    .split("-")
    .map((part) => {
      if (/^[A-Z]{2,4}$/.test(part)) return part;
      const lower = part.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("-");
const normalizeTag = (raw) => {
  const text = (raw || "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  return text
    .split(" ")
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : capitalizeWord(w)))
    .join(" ");
};
const normalizeTags = (tags) => {
  const seen = new Set();
  const out = [];
  for (const raw of tags || []) {
    const t = normalizeTag(raw);
    const key = t.toLowerCase();
    if (t && !seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
};

const textResult = (data) => ({
  content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
});

// The SDK is ESM-only; load it lazily (and once) from this CommonJS module.
let sdkPromise;
const loadSdk = () =>
  (sdkPromise ||= (async () => {
    const [{ McpServer }, { StreamableHTTPServerTransport }, zodMod] = await Promise.all([
      import("@modelcontextprotocol/sdk/server/mcp.js"),
      import("@modelcontextprotocol/sdk/server/streamableHttp.js"),
      import("zod"),
    ]);
    return { McpServer, StreamableHTTPServerTransport, z: zodMod.z };
  })());

function buildServer(McpServer, z) {
  const server = new McpServer({ name: "recipe-rack", version: "1.0.0" });
  const ingredient = z.object({ name: z.string(), quantity: z.string().default("") });
  const optionalRecipeFields = {
    cuisines: z.array(z.string()).optional(),
    kosherCategory: z.enum(["meat", "dairy", "pareve"]).optional(),
    prepTime: z.string().optional(),
    cookTime: z.string().optional(),
    servingSize: z.string().optional(),
    rating: z.number().min(1).max(5).optional(),
    notes: z.string().optional(),
    nutrition: z
      .object({
        calories: z.string().optional(),
        protein: z.string().optional(),
        carbs: z.string().optional(),
        fat: z.string().optional(),
      })
      .optional(),
    isFavorite: z.boolean().optional(),
  };

  const summarize = (r) => ({
    id: r.id,
    title: r.title,
    kosherCategory: r.kosherCategory || null,
    cuisines: Array.isArray(r.cuisines) ? r.cuisines : [],
    isFavorite: !!r.isFavorite,
  });

  server.registerTool(
    "list_recipes",
    { description: "List all recipes (id, title, kosher category, cuisines)." },
    async () => {
      const { recipes } = await RecipeService.getAllRecipes();
      return textResult({ count: recipes.length, recipes: recipes.map(summarize) });
    }
  );

  server.registerTool(
    "search_recipes",
    {
      description: "Search recipes by text query (title/cuisine), kosher category, and/or favorites.",
      inputSchema: {
        query: z.string().optional(),
        kosherCategory: z.enum(["meat", "dairy", "pareve"]).optional(),
        favoritesOnly: z.boolean().optional(),
      },
    },
    async ({ query, kosherCategory, favoritesOnly }) => {
      const { recipes } = await RecipeService.getAllRecipes();
      const q = (query || "").toLowerCase();
      const filtered = recipes.filter((r) => {
        const cuisines = Array.isArray(r.cuisines) ? r.cuisines : [];
        const matchesQuery = !q || r.title.toLowerCase().includes(q) || cuisines.some((t) => t.toLowerCase().includes(q));
        const matchesKosher = !kosherCategory || r.kosherCategory === kosherCategory;
        const matchesFavorite = !favoritesOnly || !!r.isFavorite;
        return matchesQuery && matchesKosher && matchesFavorite;
      });
      return textResult({ count: filtered.length, recipes: filtered.map(summarize) });
    }
  );

  server.registerTool(
    "get_recipe",
    { description: "Get a single recipe with full details.", inputSchema: { id: z.string() } },
    async ({ id }) => textResult(await RecipeService.getRecipe(id))
  );

  server.registerTool(
    "create_recipe",
    {
      description: "Create a new recipe. Cuisine tags are normalized to Title Case.",
      inputSchema: {
        title: z.string(),
        ingredients: z.array(ingredient).min(1),
        instructions: z.array(z.string()).min(1),
        ...optionalRecipeFields,
      },
    },
    async (args) => {
      const data = { isFavorite: false, ...args, cuisines: normalizeTags(args.cuisines || []), createdAt: Date.now() };
      const { recipeId } = await RecipeService.createRecipe(data);
      return textResult({ created: true, id: recipeId });
    }
  );

  server.registerTool(
    "update_recipe",
    {
      description:
        "Partially update a recipe: send only the fields to change (e.g. just isFavorite or rating); " +
        "everything else is kept. Cuisine tags are normalized.",
      inputSchema: {
        id: z.string(),
        title: z.string().min(1).optional(),
        ingredients: z.array(ingredient).min(1).optional(),
        instructions: z.array(z.string()).min(1).optional(),
        ...optionalRecipeFields,
      },
    },
    async ({ id, cuisines, ...fields }) => {
      const changes = { ...fields, ...(cuisines ? { cuisines: normalizeTags(cuisines) } : {}) };
      if (Object.keys(changes).length === 0) throw new Error("No fields to update were provided.");
      await RecipeService.getRecipe(id);
      const ok = await RecipeService.updateRecipe({ id, ...changes });
      return textResult({ updated: ok, id, changedFields: Object.keys(changes) });
    }
  );

  server.registerTool(
    "delete_recipe",
    { description: "Delete a recipe by id.", inputSchema: { id: z.string() } },
    async ({ id }) => {
      const ok = await RecipeService.deleteRecipe(id);
      return textResult({ deleted: ok, id });
    }
  );

  server.registerTool(
    "get_meal_plan",
    { description: "Get the weekly meal plan, enriched with recipe titles." },
    async () => {
      const [{ entries }, { recipes }] = await Promise.all([MealPlanService.getMealPlan(), RecipeService.getAllRecipes()]);
      const titleById = new Map(recipes.map((r) => [r.id, r.title]));
      return textResult({ count: entries.length, entries: entries.map((e) => ({ ...e, recipeTitle: titleById.get(e.recipeId) || "(unknown)" })) });
    }
  );

  server.registerTool(
    "set_meal_plan",
    {
      description: "Replace the weekly meal plan with the provided entries.",
      inputSchema: {
        entries: z.array(
          z.object({
            date: z.string().describe("YYYY-MM-DD"),
            mealType: z.enum(["breakfast", "lunch", "dinner"]),
            recipeId: z.string(),
          })
        ),
      },
    },
    async ({ entries }) => {
      const ok = await MealPlanService.setMealPlan(entries);
      return textResult({ saved: ok, count: entries.length });
    }
  );

  return server;
}

// Stateless Streamable HTTP MCP endpoint (serverless-friendly): a fresh
// server + transport per request.
app.post("/mcp", async (req, res) => {
  try {
    const { McpServer, StreamableHTTPServerTransport, z } = await loadSdk();
    const server = buildServer(McpServer, z);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      try {
        transport.close();
        server.close();
      } catch {
        /* ignore */
      }
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error("MCP request failed", error);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: String(error?.message || error) }, id: null });
    }
  }
});

// Stateless server: no long-lived GET (SSE) or DELETE sessions.
const methodNotAllowed = (req, res) =>
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless MCP server)." }, id: null });
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

module.exports = { app };
