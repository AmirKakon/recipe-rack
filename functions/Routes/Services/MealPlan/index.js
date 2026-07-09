const { db, logger } = require("../../../setup");

const COLLECTION = "mealPlans";
const DOC_ID = "default"; // Single shared family meal plan.

// Get the meal plan (list of { date, mealType, recipeId } entries).
const getMealPlan = async () => {
  const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!doc.exists) return { entries: [] };
  const data = doc.data() || {};
  return { entries: Array.isArray(data.entries) ? data.entries : [] };
};

// Replace the meal plan with the provided entries.
const setMealPlan = async (entries) => {
  try {
    await db
      .collection(COLLECTION)
      .doc(DOC_ID)
      .set({ entries: Array.isArray(entries) ? entries : [] });
    return true;
  } catch (error) {
    logger.error("Failed to save meal plan", error);
    return false;
  }
};

module.exports = { getMealPlan, setMealPlan };
