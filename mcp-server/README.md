# Recipe Rack MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes your Recipe Rack
collection and weekly meal plan as tools, so Claude (Desktop or Code) can read
and manage your recipes conversationally — e.g. *"add my grandmother's kugel"*,
*"what pareve desserts do I have?"*, or *"plan chicken for Tuesday dinner"*.

It talks to the existing Recipe Rack Cloud Functions REST API — no separate
database or credentials required.

## Tools

| Tool | Description |
|------|-------------|
| `list_recipes` | List all recipes (id, title, kosher category, cuisines). |
| `search_recipes` | Filter recipes by text query and/or kosher category. |
| `get_recipe` | Get one recipe with full details (incl. rating, notes, nutrition). |
| `create_recipe` | Add a new recipe (cuisine tags auto-normalized to Title Case). |
| `update_recipe` | Update an existing recipe (cuisine tags auto-normalized). |
| `delete_recipe` | Delete a recipe. |
| `get_meal_plan` | Read the weekly meal plan (with recipe titles). |
| `set_meal_plan` | Replace the weekly meal plan. |
| `suggest_recipes` | AI: suggest up to 3 kosher-friendly recipes for a request. |
| `classify_kosher` | AI: classify ingredients as meat / dairy / pareve. |
| `generate_shopping_list` | AI: consolidated, aisle-grouped shopping list from recipe ids. |

## Setup

```bash
cd mcp-server
npm install
```

- By default it targets the production API. Override with the
  `RECIPE_RACK_API_URL` environment variable if needed.
- The **AI tools** (`suggest_recipes`, `classify_kosher`, `generate_shopping_list`)
  require a `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) environment variable. The
  data tools work without it.

## Configure in Claude Code

```bash
claude mcp add recipe-rack -e GEMINI_API_KEY=your_key -- node /absolute/path/to/recipe-rack/mcp-server/index.js
```

(Omit `-e GEMINI_API_KEY=...` if you only need the non-AI data tools.)

## Configure in Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "recipe-rack": {
      "command": "node",
      "args": ["/absolute/path/to/recipe-rack/mcp-server/index.js"],
      "env": { "GEMINI_API_KEY": "your_key" }
    }
  }
}
```

## Notes

- The server communicates over stdio (standard for local MCP servers).
- **Behind a TLS-intercepting corporate proxy?** If HTTPS calls fail with a
  self-signed-certificate error, point Node at your corporate root CA via
  `NODE_EXTRA_CA_CERTS=/path/to/corp-root-ca.pem` in the server's `env`
  (do **not** disable TLS verification).
