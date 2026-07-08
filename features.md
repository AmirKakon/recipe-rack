# Recipe Rack — Feature & Improvement Ideas

A brainstorm of UX, feature, and AI improvements for Recipe Rack. Focus is on **user experience and capabilities** (not security/infra). Ideas are grounded in the current codebase and prioritized by impact vs. effort.

## Where we are today

**Current features**
- Recipe CRUD (create / edit / delete / view) backed by Firestore via Cloud Functions
- Text search by title or cuisine tags
- 5 AI flows (Gemini 2.0 Flash via Genkit):
  1. Suggest recipe **name** from ingredients + cuisine
  2. Suggest recipe **details** (prep/cook/servings)
  3. **Suggest up to 3 recipes** from user input (existing or new, kosher-aware) + "Try Other Ideas"
  4. **Extract recipe from image/PDF**
  5. **Extract recipe from URL**

**Current data model** (`src/lib/types.ts`)
```ts
Recipe { id, title, ingredients[], instructions[], cuisine? (legacy), cuisines?[], prepTime?, cookTime?, servingSize? }
```

**Notable gaps that unlock most of the ideas below**
- No recipe **photo/image** field — recipes are text-only
- No **dietary classification** (meat / dairy / pareve) — surprising given the kosher focus
- No **favorites, ratings, or notes**
- No **meal planning**, **shopping list**, or **pantry** concept
- Search is substring-only (no semantic/tag filtering UI)
- No auth / multi-user (fine for a single family, but limits sharing)

---

## 1. Quick UX wins (low effort, high polish)

| Idea | Why | Notes |
|------|-----|-------|
| **Recipe photos** | Text-only recipes feel sparse; photos drive engagement | Add `imageUrl` to `Recipe`; upload to Firebase Storage. Can pair with AI image generation (§4) |
| **Servings scaler** | "Recipe serves 4, I need 8" is a daily need | Parse quantities and multiply; show a `x1 / x2 / x3` toggle on the recipe view |
| **Cook Mode / step-by-step view** | Hands-busy cooking needs big text + no screen sleep | Full-screen instruction stepper, `wake lock` API, tap-to-advance |
| **Inline step timers** | Instructions like "bake 20 min" should be tappable | Regex-detect durations in `instructions[]`, render a start-timer button |
| **Print / PDF-friendly view** | People still print recipes for the kitchen | A `@media print` stylesheet on the recipe detail page |
| **Favorites / pinning** | Fast access to go-to recipes | `isFavorite` boolean + a filter chip |
| **Tag/cuisine filter chips** | Search is text-only today; clicking a tag to filter is faster | Derive chips from `cuisines[]`, toggle to filter the list |
| **Sort controls** | Only sorted by title today | Sort by recently added, prep time, cook time |
| **Empty-state → guided first recipe** | Onboarding warmth | The empty state exists; add a "scan a recipe photo to start" CTA |
| **Optimistic UI + skeletons on save** | Saves currently block with a spinner and refetch all | Update local state optimistically instead of full `fetchRecipes()` |

---

## 2. Core feature additions (the roadmap)

### 2a. Meal planning
A weekly calendar where recipes are dragged onto days/meals. This is the single biggest "sticky" feature for a family app.
- Data: `MealPlan { weekOf, entries: [{ date, mealType, recipeId }] }`
- AI tie-in: "plan a week of dinners, dairy-free, ~30 min each" → auto-fills the calendar (see §4)

### 2b. Shopping list generator
Select recipes (or a week's plan) → aggregate + de-duplicate ingredients into a checklist.
- Merge like items ("2 eggs" + "3 eggs" → "5 eggs") — a great AI/normalization task
- Group by store aisle (produce / dairy / pantry)
- Shareable / checkable list; export to notes or Reminders

### 2c. Pantry / "what can I cook?"
Track what's on hand; suggest recipes you can make now (or "with 2 more ingredients").
- Powers a new AI flow: **cook-from-pantry** suggestions
- Feeds the shopping list ("what's missing for this recipe")

### 2d. Ratings, reviews & cooking notes
Per-recipe star rating + free-text notes ("used less salt", "kids loved it", "doubled it").
- Family members' notes accumulate over time — high emotional value
- Feeds AI: "suggest recipes similar to ones we rated 5 stars"

### 2e. Collections / cookbooks
Group recipes into named collections ("Shabbat dinners", "Quick lunches", "Rosh Hashana").
- Just a `collections[]` tag or a separate collection entity

### 2f. Import & export
- Export a recipe (or the whole rack) to JSON / printable PDF / shareable link
- Import from more formats: paste text, multiple photos (multi-page), other apps' JSON

### 2g. Semantic search
Replace substring search with embeddings so "quick weeknight chicken" matches recipes even without those exact words.
- Store embeddings per recipe (Genkit + a vector index or Firestore vector search)

---

## 3. Kosher-first features (the real differentiator) 🕎

The app is built for a kosher-keeping family but the kosher logic only lives inside one AI prompt. Making kosher a **first-class, structured concept** is the strongest product angle and mostly under-served by mainstream recipe apps.

| Feature | Description |
|---------|-------------|
| **Meat / Dairy / Pareve classification** | Add `kosherCategory: 'meat' \| 'dairy' \| 'pareve'` to every recipe. Show a colored badge. AI can auto-classify from ingredients. This is arguably the #1 missing data field. |
| **Meat/dairy conflict warnings** | Warn if a recipe or a meal-plan slot mixes meat + dairy; suggest pareve substitutions (butter→margarine, cream→pareve cream) |
| **Passover (Pesach) mode** | Flag/filter recipes as chametz-free; toggle kitniyot for Ashkenazi vs. Sephardi custom; a dedicated Passover collection |
| **Shabbat-friendly filter** | Surface make-ahead / blech / warming-drawer-friendly recipes (no cooking on Shabbat); "prep Friday, serve Saturday" grouping |
| **Jewish holiday awareness** | Using the Hebrew calendar, proactively suggest themed recipes (apples & honey for Rosh Hashana, latkes/sufganiyot for Hanukkah, hamantaschen for Purim) |
| **Kosher substitution assistant** | AI flow: "make this recipe pareve" or "make this meat recipe dairy-free" with kosher-aware swaps |
| **Hechsher/ingredient notes** | Optional note fields for certification-sensitive ingredients |

> Suggestion: the Hebrew-calendar holiday awareness could reuse a library like `@hebcal/core` (no external API needed) to drive seasonal suggestions.

---

## 4. Deeper AI integrations

Current flows are one-shot. There's room for richer, more agentic AI.

| Idea | Model capability | Notes |
|------|------------------|-------|
| **Weekly meal-plan generation** | Structured output | "5 dinners, kosher, 2 dairy 3 meat, under 40 min" → fills the planner |
| **Smart shopping-list normalization** | Reasoning | Merge/scale/aisle-group ingredients from multiple recipes |
| **Recipe image generation** | Imagen / Gemini image | Auto-generate an appetizing photo for text-only recipes |
| **Nutrition estimation** | Structured output | Approximate calories/macros per serving from ingredients (label clearly as an estimate) |
| **Ingredient substitutions** | Reasoning | Allergy-, kosher-, or availability-driven swaps ("no eggs", "make it pareve") |
| **Conversational cooking assistant** | Multi-turn + voice | Hands-free "what's the next step?", "how much flour?", set timers by voice |
| **Auto-tagging & auto-classification** | Structured output | On save, auto-suggest `cuisines[]` and `kosherCategory` |
| **Recipe translation** | Multilingual | English ⇄ Hebrew recipe view (very relevant for the family + your Hebrew use) |
| **Wine / side-dish pairing** | Reasoning | Kosher-wine-aware pairing suggestions |
| **Leftover / batch ideas** | Reasoning | "I have leftover roast chicken" → next-day recipe ideas |

**Genkit-specific upgrades**
- Add **streaming** to suggestions so results appear token-by-token instead of a spinner
- Add **tool/function calling** so a single conversational flow can search the rack, add recipes, and build a plan
- Add **evals** for the kosher constraint (regression-test that suggestions never mix meat + dairy)

---

## 5. MCP layer — expose Recipe Rack to any AI assistant

Wrap the existing Cloud Functions / Genkit flows in a **Model Context Protocol (MCP) server** so Recipe Rack becomes a tool other assistants (Claude Desktop, Claude Code, etc.) can use. The backend logic already exists — MCP is a thin adapter over the REST API + flows.

### Why
- Manage recipes from wherever you already talk to an AI: *"add my grandmother's kugel to the rack"*, *"plan next week's dinners"*, *"what can I make with chicken and rice tonight?"*
- Turns a single-purpose web app into a reusable capability
- Natural fit for your AI-SDLC / tooling-adoption work — a clean, demoable MCP example

### Proposed MCP tools
| Tool | Maps to |
|------|---------|
| `list_recipes` / `search_recipes` | `GET /api/recipes/getAll` + filter |
| `get_recipe` | fetch by id |
| `create_recipe` / `update_recipe` / `delete_recipe` | existing REST endpoints |
| `suggest_recipes` | `suggestRecipeBasedOnInput` flow |
| `extract_recipe_from_url` / `_from_image` | existing extraction flows |
| `plan_week` | new meal-plan flow (§4) |
| `generate_shopping_list` | new normalization flow (§2b) |
| `classify_kosher` | new classification flow (§3) |

### MCP resources
- Expose recipes as MCP **resources** (`recipe://{id}`) so an assistant can read them as context
- Expose the current week's meal plan and shopping list as resources

### Shape
- A small Node/TypeScript MCP server (`@modelcontextprotocol/sdk`) living alongside `functions/`, calling the same services
- Auth via a simple API key/token (kept out of scope here per the "not security" focus, but noted)

---

## 6. Suggested data-model evolution

Most features above need a few additive fields (all optional → backward-compatible with the existing `processFetchedRecipe` normalization):

```ts
interface Recipe {
  // existing
  id; title; ingredients[]; instructions[]; cuisines?[]; prepTime?; cookTime?; servingSize?;

  // proposed additions
  imageUrl?: string;
  kosherCategory?: 'meat' | 'dairy' | 'pareve';
  isFavorite?: boolean;
  rating?: number;              // 1–5
  notes?: string;               // family cooking notes
  collections?: string[];       // "Shabbat", "Passover", ...
  sourceUrl?: string;           // where it was imported from
  createdAt?; updatedAt?;       // enable "recently added" sort
  nutrition?: { calories?; protein?; carbs?; fat? };  // AI-estimated
  embedding?: number[];         // for semantic search
}

// new entities
interface MealPlanEntry { date; mealType: 'breakfast'|'lunch'|'dinner'; recipeId; }
interface ShoppingListItem { name; quantity; aisle?; checked; recipeIds[]; }
```

---

## 7. Suggested prioritization

**Phase 1 — polish & foundations (highest ROI):**
1. Recipe photos + AI image generation
2. Meat/Dairy/Pareve classification (data field + badge + auto-classify)
3. Favorites + tag-filter chips + sort
4. Cook Mode + step timers

**Phase 2 — the sticky loop:**
5. Meal planner
6. Shopping list generator
7. Ratings & notes

**Phase 3 — differentiation & reach:**
8. Kosher power features (Passover/Shabbat/holiday awareness, substitutions)
9. Semantic search + conversational assistant
10. MCP server

---

*Generated as a planning artifact — nothing here is implemented yet. Happy to spec out any single item in detail or start building.*
