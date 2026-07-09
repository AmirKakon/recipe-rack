const { app, functions } = require("./setup");

// app routes
require("./Routes/Controllers/Recipes");
require("./Routes/Controllers/MealPlan");

// Export the main app
exports.app = functions.https.onRequest(app);
