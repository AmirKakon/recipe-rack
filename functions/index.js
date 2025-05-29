const { app, functions } = require("./setup");

// app routes
require("./Routes/Controllers/Recipes");

// Export the main app
exports.app = functions.https.onRequest(app);
