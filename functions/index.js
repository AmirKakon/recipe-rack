const { app, functions } = require("./setup");

// app routes
require("./Routes/Controllers/Recipes");
require("./Routes/Controllers/MealPlan");
require("./Routes/Controllers/Mcp");

// Export the main app
exports.app = functions.https.onRequest(app);
