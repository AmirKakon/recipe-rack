# Recipe Rack — Features & Roadmap

A family recipe app for a kosher-keeping household: Next.js (Firebase App Hosting) + Cloud Functions/Firestore/Storage, with Gemini (`gemini-2.5-flash` via Genkit) for the AI features and an MCP layer so AI assistants can use it too.

- **Live app:** https://studio--recipe-rack-ighp8.us-central1.hosted.app/
- **Hosted MCP endpoint:** `https://us-central1-recipe-rack-ighp8.cloudfunctions.net/app/mcp`

This doc has three parts: **[what's shipped](#-shipped-features)**, **[how it's wired](#how-its-wired)**, and **[what's still open](#-backlog--not-built-yet)**.

---

## ✅ Shipped features

### Browsing & finding recipes
- **Recipe list** — table on desktop, stacked cards on mobile, with photo thumbnails, kosher badge, star rating and cuisine tags.
- **Search + collapsible filters** — the search bar is always visible; a **Filters** button expands kosher (meat/dairy/pareve), cuisine-tag chips, ⭐ Favorites, 🕯️ Shabbat and sort. A badge on the button shows how many filters are active.
- **Sorting** — title (A–Z), recently added, prep time, top rated.
- **Favorites** — star any recipe from the list; filter to favorites only.
- **Clickable tags** — tap a cuisine tag on a recipe to filter by it.
- **Normalized tags** — tags are stored in consistent Title Case (all existing recipes were migrated).

### Fast, intuitive navigation
- **Shared recipe cache** — the list, recipe pages and planner share one cache. Opening a recipe or going **Back** is instant, with a quiet background refresh instead of a full reload.
- **Back restores where you were** — search and filters live in the URL (e.g. `?q=cook&kosher=pareve`), so Back, refresh and shared links keep them; scroll position and the open/closed Filters panel are restored too.
- **Instant cold start** — the recipe list is saved on the device (~0.7 KB per recipe, expires after 30 days), so a fresh open shows recipes immediately and then refreshes from the server.
- **Auto-refresh on return** — switching back to the app re-checks for recipes added by other family members.
- **Edit in place** — "Edit Recipe" opens the form on the recipe page instead of bouncing to the list.
- **Optimistic updates** — favorites, ratings, notes, saves and deletes update the screen immediately and roll back if the server call fails.
- **Delete confirmation** — deleting asks first (it used to be one accidental tap away).

### Adding recipes
- **Manual form** with ingredients/steps editing, reordering and validation.
- **Recipe photos** — upload a photo; it's resized in the browser and stored in Firebase Storage.
- **Scan Recipe**, three ways:
  - **Photos / PDFs** — multiple files are treated as pages of the *same* recipe (e.g. ingredients on one photo, steps on another). Photos are downscaled before sending, so full-size phone photos work.
  - **Web link** — the server downloads the page and extracts from its schema.org recipe data (or the page text as a fallback). Tested on Allrecipes, BBC Good Food, Serious Eats, Tori Avey and food.com. Some sites (e.g. kosher.com) block automated access; users are told to use a photo instead.
  - **TikTok link** — extracts the recipe from the video caption.
  - All three show a clear, specific error when something goes wrong (blocked site, no caption, no recipe found).
- **AI helpers in the form** — suggest a title, suggest prep/cook time and servings, suggest cuisine tags, auto-classify kosher category.
- **AI recipe suggestions** — "Suggest Recipe" proposes up to 3 kosher-friendly ideas, mixing existing recipes and new ones, with **Try Other Ideas** and **Add this to My Rack**.

### Viewing & cooking
- **Servings scaler** — ½× / 1× / 2× / 3×, with fraction-aware quantities.
- **Cook Mode** — full-screen step-by-step view that keeps the screen awake, with **timers detected from the instruction text** ("bake 20 minutes" → a start-timer button) and an alert when a timer finishes.
- **Print view** — clean, print-friendly recipe page.
- **Ratings & family notes** — 1–5 stars and free-text notes per recipe.
- **Nutrition estimate** — AI-estimated calories/protein/carbs/fat per serving (labelled as an estimate).
- **Translate** — view a recipe in Hebrew ⇄ English.

### Kosher-first 🕎
- **Meat / Dairy / Pareve** on every recipe: a colored badge, AI auto-classify, and a filter. All existing recipes were backfilled.
- **Meat + dairy conflict warning** — flags recipes whose ingredients mix meat and dairy.
- **Kosher Swaps** — AI suggests kosher-aware substitutions (e.g. make a recipe pareve).
- **Jewish holiday awareness** — a banner for the upcoming holiday (via `@hebcal/core`) with a one-tap "recipe ideas" suggestion.
- **Shabbat filter** — recipes tagged for Shabbat.
- All AI suggestions are constrained to kosher rules (no pork/shellfish, never mixing meat and dairy).

### Planning & shopping
- **Weekly meal planner** — breakfast/lunch/dinner per day, previous/next week, pick recipes from the rack; saved to the backend.
- **Shopping list generator** — pick recipes (or use the week's plan) → AI-merged list, grouped by supermarket aisle, with checkboxes and copy-to-clipboard.

### QRganize integration (home inventory)
- **Pantry Check** on a recipe — matches its ingredients against the QRganize inventory to show what you have and what's missing.
- **Check for alternative** — for a missing ingredient, AI suggests kosher-aware substitutes and highlights those already in stock (e.g. "out of butter, but you have margarine").
- **Add to QRganize shopping list** — one tap per missing ingredient.

### MCP — use Recipe Rack from Claude and other AI assistants
- **Hosted MCP server** (Streamable HTTP, no install) — 8 tools: `list_recipes`, `search_recipes`, `get_recipe`, `create_recipe`, `update_recipe`, `delete_recipe`, `get_meal_plan`, `set_meal_plan`.
- **Local MCP server** (`mcp-server/`, stdio) — the same 8 tools plus AI tools that need a Gemini key: `suggest_recipes`, `classify_kosher`, `generate_shopping_list`, `import_recipe_from_url` (web page or TikTok → recipe, returned unsaved for review).
- Both servers:
  - **Partial updates** — send only what changes (e.g. `isFavorite: true` or a `rating`); everything else is kept.
  - Full field support: favorites, rating, notes, nutrition, kosher category.
  - `favoritesOnly` search, and tag normalization identical to the web app.
- See [`mcp-server/README.md`](mcp-server/README.md) for setup (Claude Code, Claude Desktop, MCP Inspector, Postman).

### Reliability & compatibility fixes
- Full-size phone photos failed to scan ("Body exceeded 1 MB limit") → downscaled before sending, and the server-action body limit raised to 20 MB.
- Web-link scan guessed recipes from the URL text (the model can't browse) → now downloads the page.
- Scan errors were hidden behind a generic message in production → real reasons are shown.
- A missing recipe crashed the API (an undefined error type) and returned 500 → returns a proper 404, which the "Recipe Not Found" page relies on.
- Mobile layout fixes (no horizontal overflow; action buttons wrap).
- Older-browser support for IDs and URL validation (`crypto.randomUUID`, `URL.canParse` fallbacks).
- Next.js upgraded 15.2.3 → 15.5.7 (CVE fix); Gemini moved from the retired 2.0 Flash to 2.5 Flash.

---

## How it's wired

**Data model** (`src/lib/types.ts`)
```ts
Recipe {
  id; title; ingredients: { id, name, quantity }[]; instructions: string[];
  cuisines?: string[]; prepTime?; cookTime?; servingSize?;
  kosherCategory?: 'meat' | 'dairy' | 'pareve';
  isFavorite?; rating?: 1–5; notes?; imageUrl?; createdAt?: epoch ms;
  nutrition?: { calories?; protein?; carbs?; fat? };
}
MealPlanEntry { date: 'YYYY-MM-DD'; mealType: 'breakfast' | 'lunch' | 'dinner'; recipeId }
```

**Deploys**
- **Web app** — Firebase App Hosting backend `studio`; every push to `master` auto-deploys.
- **Cloud Functions** (REST API + hosted MCP) — deployed manually: `firebase deploy --only functions` (use `FUNCTIONS_DISCOVERY_TIMEOUT=60` if the deploy times out while analyzing the code).

**Secrets** (never committed; `.env.local` locally, App Hosting Secret Manager in prod)
- `GEMINI_API_KEY` — must be a key with paid/quota access (the AI Studio "Default Gemini Key" has no quota outside AI Studio).
- `QRGANIZE_UUID` — treat like an access token.

**Security notes**
- The web-link scan fetches user-supplied URLs server-side. It only allows http(s), refuses hosts resolving to private/loopback/link-local addresses (re-checked on every redirect), caps downloads at 3 MB, and times out after 15 s.
- The REST API and hosted MCP are open (no auth), as is QRganize's API.

**Local development**
- Use webpack dev (`npx next dev -p 9002`); `npm run dev` (Turbopack) breaks on Genkit.
- Behind the corporate VPN, outbound HTTPS from local Node (scans, the MCP) fails certificate checks. Point Node at the corporate root CA with `NODE_EXTRA_CA_CERTS` rather than disabling TLS. Production is unaffected.

---

## 🔲 Backlog — not built yet

### Product
| Idea | Why |
|---|---|
| **Collections / cookbooks** ("Shabbat dinners", "Rosh Hashana") | Group recipes beyond tags |
| **Passover (Pesach) mode** | Chametz-free flag and filter, kitniyot toggle for Ashkenazi/Sephardi custom |
| **Import & export** | Export to JSON/PDF/share link; import pasted text or other apps' formats |
| **Source link on imported recipes** (`sourceUrl`) | Keep a link back to where a scanned recipe came from |
| **Semantic search** | "quick weeknight chicken" should match without exact words (embeddings) |
| **Custom / manual Cook Mode timer** | Timers only appear when a step mentions a duration today |
| **Cache the meal plan** like recipes | The planner still fetches the plan on every visit |
| **Accounts / sharing** | Currently a single shared family rack, no auth |

### AI
| Idea | Why |
|---|---|
| **Weekly meal-plan generation** | "5 dinners, 2 dairy 3 meat, under 40 min" → fills the planner |
| **AI recipe photos** | Generate an image for text-only recipes |
| **Conversational / voice cooking assistant** | Hands-free "what's next?", "how much flour?" |
| **Cook from pantry / soon-to-expire** | Suggest recipes from QRganize stock |
| **Wine & side-dish pairing**, **leftover ideas** | Kosher-wine-aware pairings; "leftover roast chicken" → next-day ideas |
| **Streaming suggestions** | Show results as they arrive instead of a spinner |
| **Kosher evals** | Regression tests that suggestions never mix meat and dairy |

### MCP
| Idea | Why |
|---|---|
| **AI tools on the hosted MCP** | Needs the Gemini key as a Functions secret; today they're local-only |
| **MCP resources** (`recipe://{id}`, current meal plan) | Let assistants read recipes as context |
| **Auth on the hosted endpoint** | It's open, like the REST API |

### QRganize
| Idea | Status |
|---|---|
| Have vs. need + check for alternative + add missing item to shopping list | ✅ Shipped (Pantry Check) |
| **Send the whole shopping list to QRganize** | 🔲 Today it's one ingredient at a time from Pantry Check |
| **Cook from what I have / soon-to-expire** | 🔲 Not built |
| **Quantity-aware stock** | 🔲 QRganize items have `quantity: 0` and no expiry dates, so "have it" currently means "in the catalog" |

### Known limitations
- **iPhone HEIC photos** — photo upload uses the browser's image decoder; if an iPhone photo fails, set Camera → Formats → **Most Compatible**. (An earlier fix broke uploads on Android and iPhone and was reverted.)
- **Very old browsers** (e.g. an old tablet's Chrome) are not supported.
- **Sites that block bots** (e.g. kosher.com) can't be scanned by link — use a photo or screenshot.
