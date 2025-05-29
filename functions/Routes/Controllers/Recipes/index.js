const { app } = require("../../../setup");
const RecipeService = require("../../Services/Recipes");

// Create a recipe
app.post("/api/recipes/create", async (req, res) => {
    try {
        const recipeData = req.body;
    
        // Basic validation (you might want more robust validation)
        if (!recipeData.title || !Array.isArray(recipeData.ingredients) || !Array.isArray(recipeData.instructions)) {
          return res.status(400).send("Missing or invalid required fields");
        }
        const result = await RecipeService.createRecipe(recipeData);
    
        res.status(200).send({ id: result.recipeId });
      } catch (error) {
        console.error("Error adding recipe:", error);
        res.status(500).send("Error adding recipe");
      }
});

// Get a single recipe
app.get("/api/recipes/get/:id",  async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
        return res.status(400).send("Missing or invalid required fields");
      }
    const recipe = await RecipeService.getRecipe(id);

    return res.status(200).send({ status: "Success", data: recipe });
  } catch (error) {
    console.error("Error getting recipe:", error);
    res.status(500).send("Error getting recipe");
  }
});

// Get all recipes
app.get("/api/recipes/getAll",  async (req, res) => {
  try {
    const recipes = await RecipeService.getAllRecipes();

    return res.status(200).send({
      status: "Success",
      data: recipes,
    });
  } catch (error) {
    console.error("Error getting all recipes:", error);
    res.status(500).send("Error getting all recipes");
  }
});

// Update a recipe
app.put("/api/recipes/update/:id",  async (req, res) => {
  try {
    const recipeData = req.body;
    const id = req.params.id;
    
    // Basic validation (you might want more robust validation)
    if (!id || !recipeData.title || !Array.isArray(recipeData.ingredients) || !Array.isArray(recipeData.instructions)) {
        return res.status(400).send("Missing or invalid required fields");
    }

    const updated = await RecipeService.updateRecipe({id, ...recipeData});
    return updated ?
      res.status(200).send({ status: "Success", msg: "Recipe Updated" }) :
      res
        .status(400)
        .send({ status: "Failed", msg: "Recipe failed to updated" });
      } catch (error) {
        console.error("Error updating recipe:", error);
        res.status(500).send("Error updating recipe");
      }
});

// Delete a recipe
app.delete("/api/recipes/delete/:id",  async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
        return res.status(400).send("Missing or invalid required fields");
    }

    const deleted = await RecipeService.deleteRecipe(id);
    return deleted ?
      res.status(200).send({ status: "Success", msg: "Recipe Deleted" }) :
      res
        .status(400)
        .send({ status: "Failed", msg: "Recipe failed to delete" });
      } catch (error) {
        console.error("Error deleting recipe:", error);
        res.status(500).send("Error deleting recipe");
      }
});

module.exports = { app };