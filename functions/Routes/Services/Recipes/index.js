const { randomUUID } = require("crypto");
const { getStorage } = require("firebase-admin/storage");
const { db, logger, STORAGE_BUCKET } = require("../../../setup");

const recipesDB = "recipes";

// Upload a recipe image (base64) to Storage and return a public download URL.
// Storage is resolved lazily (inside the handler) so module load stays fast.
const uploadRecipeImage = async (base64Data, contentType) => {
  const bucket = getStorage().bucket(STORAGE_BUCKET);
  const buffer = Buffer.from(base64Data, "base64");
  const extension = (contentType && contentType.split("/")[1]) || "jpg";
  const token = randomUUID();
  const filePath = `recipeImages/${randomUUID()}.${extension}`;
  const file = bucket.file(filePath);

  await file.save(buffer, {
    metadata: {
      contentType: contentType || "image/jpeg",
      // A download token makes the object publicly readable via the Firebase URL
      // without needing object ACLs (which uniform bucket-level access disables).
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    filePath
  )}?alt=media&token=${token}`;
};

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
  uploadRecipeImage,
};