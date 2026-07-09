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
| `get_recipe` | Get one recipe with full details. |
| `create_recipe` | Add a new recipe. |
| `update_recipe` | Update an existing recipe. |
| `delete_recipe` | Delete a recipe. |
| `get_meal_plan` | Read the weekly meal plan (with recipe titles). |
| `set_meal_plan` | Replace the weekly meal plan. |

## Setup

```bash
cd mcp-server
npm install
```

By default it targets the production API. Override with the
`RECIPE_RACK_API_URL` environment variable if needed.

## Configure in Claude Code

```bash
claude mcp add recipe-rack -- node /absolute/path/to/recipe-rack/mcp-server/index.js
```

## Configure in Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "recipe-rack": {
      "command": "node",
      "args": ["/absolute/path/to/recipe-rack/mcp-server/index.js"]
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
