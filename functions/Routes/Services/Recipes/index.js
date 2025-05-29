const { db, logger } = require("../../../setup");

const recipesDB = "recipes";

// Create a recipe
const createRecipe = async (recipeData) => {
  let itemRef = null;

  if (recipeData.id) {
    await db
      .collection(recipesDB)
      .doc(String(recipeData.id))
      .set(recipeData);
    itemRef = db.collection(recipesDB).doc(String(recipeData.id));
  } else {
    itemRef = await db.collection(recipesDB).add(recipeData);
  }

  return {
    recipeId: itemRef.id,
  };
};

// Get a single recipe
const getRecipe = async (id) => {
  const doc = await db.collection(recipesDB).doc(id).get();

  if (!doc.exists) {
    throw new NotFoundError(`No recipe found with id: ${id}`);
  }

  return { id: doc.id, ...doc.data() };
};

// Get all recipes
const getAllRecipes = async () => {
  const snapshot = await db.collection(recipesDB).get();

  if (snapshot.empty) {
    logger.info("Get all recipes | No recipes found");
    return { recipes: [] };
  }

  return {
    recipes: snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };
};

// Update a recipe
const updateRecipe = async (recipeData) => {
  try {
    await db.collection(recipesDB).doc(recipeData.id).update(recipeData);
    return true;
  } catch (error) {
    logger.error(`Failed to update recipe: ${recipeData.id}`, error);
    return false;
  }
};

// Delete a recipe
const deleteRecipe = async (id) => {
  try {
    const batch = db.batch();

    const docRef = db.collection(recipesDB).doc(id);
    if (!(await docRef.get()).exists) {
      throw new NotFoundError("Recipe not found");
    }

    batch.delete(docRef);
    await batch.commit();

    return true;
  } catch (error) {
    logger.error(`Failed to delete recipe: ${id}`, error);
    return false;
  }
};

module.exports = {
  createRecipe,
  getRecipe,
  getAllRecipes,
  updateRecipe,
  deleteRecipe,
};