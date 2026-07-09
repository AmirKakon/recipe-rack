const { app } = require("../../../setup");
const MealPlanService = require("../../Services/MealPlan");

// Get the meal plan
app.get("/api/mealplan", async (req, res) => {
  try {
    const data = await MealPlanService.getMealPlan();
    return res.status(200).send({ status: "Success", data });
  } catch (error) {
    console.error("Error getting meal plan:", error);
    res.status(500).send("Error getting meal plan");
  }
});

// Replace the meal plan
app.put("/api/mealplan", async (req, res) => {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries)) {
      return res.status(400).send("Missing or invalid entries");
    }
    const saved = await MealPlanService.setMealPlan(entries);
    return saved
      ? res.status(200).send({ status: "Success", msg: "Meal plan saved" })
      : res.status(400).send({ status: "Failed", msg: "Meal plan failed to save" });
  } catch (error) {
    console.error("Error saving meal plan:", error);
    res.status(500).send("Error saving meal plan");
  }
});

module.exports = { app };
