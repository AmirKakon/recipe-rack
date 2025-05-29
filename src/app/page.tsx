
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { RecipeList } from '@/components/recipe/RecipeList';
import { RecipeForm } from '@/components/recipe/RecipeForm';
import type { Recipe } from '@/lib/types';
import type { RecipeFormData } from '@/lib/schemas';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { CookingPot, ServerCrash } from 'lucide-react';

const API_BASE_URL = 'https://us-central1-recipe-rack-ighp8.cloudfunctions.net/app';

export default function HomePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const { toast } = useToast();
  const [hasMounted, setHasMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);

  const fetchRecipes = useCallback(async () => {
    setIsLoading(true);
    setErrorLoading(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/recipes/getAll`);
      if (!response.ok) {
        throw new Error(`Failed to fetch recipes: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.status === "Success" && result.data && Array.isArray(result.data.recipes)) {
        setRecipes(result.data.recipes);
      } else {
        // Handle cases where backend returns success but recipes array is missing or not an array
        console.warn("Fetched recipes data is not in the expected format:", result.data);
        setRecipes([]); // Set to empty array to avoid errors
        // Optionally, you could throw an error here as well or set an error state
        // throw new Error("Recipe data from server was not in the expected format.");
      }
    } catch (error) {
      console.error("Error fetching recipes:", error);
      setErrorLoading(error instanceof Error ? error.message : "An unknown error occurred while fetching recipes.");
      setRecipes([]); // Clear recipes on error
      toast({
        title: 'Error Fetching Recipes',
        description: error instanceof Error ? error.message : "Could not load recipes from the server.",
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setHasMounted(true);
    fetchRecipes();
  }, [fetchRecipes]);

  const handleOpenAddForm = () => {
    setEditingRecipe(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (recipeId: string) => {
    const recipeToEdit = recipes.find(r => r.id === recipeId);
    if (recipeToEdit) {
      setEditingRecipe(recipeToEdit);
      setIsFormOpen(true);
    } else {
      toast({
        title: 'Error',
        description: 'Could not find the recipe to edit.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveRecipe = async (recipeData: RecipeFormData, recipeIdToUpdate?: string) => {
    setIsLoading(true); // Indicate loading state for save operation
    try {
      let response;
      let successMessage = '';

      // Ensure ingredients have IDs if they don't already (for new ingredients within an existing or new recipe)
      // The backend services for create/update currently expect the full ingredient objects.
      const processedRecipeData = {
        ...recipeData,
        ingredients: recipeData.ingredients.map(ing => ({
          id: ing.id || crypto.randomUUID(), // Assign ID if new
          name: ing.name,
          quantity: ing.quantity,
        })),
      };


      if (recipeIdToUpdate) {
        // Editing existing recipe
        response = await fetch(`${API_BASE_URL}/api/recipes/update/${recipeIdToUpdate}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(processedRecipeData), // Send processed data
        });
        successMessage = `"${processedRecipeData.title}" has been successfully updated.`;
      } else {
        // Adding new recipe
        response = await fetch(`${API_BASE_URL}/api/recipes/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(processedRecipeData), // Send processed data
        });
        successMessage = `"${processedRecipeData.title}" has been successfully added.`;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save recipe and parse error.' }));
        throw new Error(errorData.message || `Failed to save recipe: ${response.statusText}`);
      }

      await response.json(); // Process the response, e.g. to get new ID if needed, though we re-fetch
      toast({
        title: recipeIdToUpdate ? 'Recipe Updated!' : 'Recipe Added!',
        description: successMessage,
      });
      await fetchRecipes(); // Re-fetch all recipes to update the list
    } catch (error) {
      console.error("Error saving recipe:", error);
      toast({
        title: 'Save Error',
        description: error instanceof Error ? error.message : "Could not save the recipe.",
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false); // Clear loading state for save operation
      // Closing the form should happen regardless of success/failure if the operation attempted
      // handleCloseForm(); // Moved to RecipeForm's onSubmit or onClose logic handling
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    const recipeToDelete = recipes.find(r => r.id === recipeId);
    if (!recipeToDelete) return;

    setIsLoading(true); // Indicate loading for delete
    try {
      const response = await fetch(`${API_BASE_URL}/api/recipes/delete/${recipeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete recipe and parse error.' }));
        throw new Error(errorData.message || `Failed to delete recipe: ${response.statusText}`);
      }
      
      await response.json();
      toast({
        title: 'Recipe Deleted',
        description: `"${recipeToDelete.title}" has been removed.`,
      });
      await fetchRecipes(); // Re-fetch to update list
    } catch (error) {
      console.error("Error deleting recipe:", error);
      toast({
        title: 'Delete Error',
        description: error instanceof Error ? error.message : "Could not delete the recipe.",
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false); // Clear loading for delete
    }
  };
  
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingRecipe(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header onAddRecipeClick={handleOpenAddForm} />
      <main className="flex-grow container mx-auto px-0 sm:px-4 py-8">
        {isLoading && recipes.length === 0 && !errorLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 md:p-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card rounded-lg shadow-md p-6 animate-pulse">
                <div className="h-8 bg-muted rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/3 mb-6"></div>
                <div className="h-4 bg-muted rounded w-full mb-2"></div>
                <div className="h-4 bg-muted rounded w-full mb-2"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </div>
            ))}
          </div>
        )}
        {!isLoading && errorLoading && (
          <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-lg shadow-md m-4 md:m-8">
            <ServerCrash size={64} className="text-destructive mb-6" strokeWidth={1.5} />
            <h2 className="text-3xl font-semibold text-destructive mb-3">Oops! Something went wrong.</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-md">
              {errorLoading}
            </p>
            <Button onClick={fetchRecipes} size="lg" variant="outline">
              Try Again
            </Button>
          </div>
        )}
        {!isLoading && !errorLoading && recipes.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-lg shadow-md m-4 md:m-8">
            <CookingPot size={64} className="text-primary mb-6" strokeWidth={1.5} />
            <h2 className="text-3xl font-semibold text-foreground mb-3">Your Recipe Rack is Empty!</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-md">
              Ready to fill it with deliciousness? Click "Add Recipe" to get started.
            </p>
            <Button onClick={handleOpenAddForm} size="lg">
              Let's Cook Up Something!
            </Button>
          </div>
        )}
        {!errorLoading && recipes.length > 0 && (
          <RecipeList 
            recipes={recipes} 
            onDeleteRecipe={handleDeleteRecipe}
            onEditRecipe={handleOpenEditForm}
          />
        )}
      </main>
      <RecipeForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSaveRecipe}
        recipeToEdit={editingRecipe}
        isSaving={isLoading && isFormOpen} // Pass a saving prop to RecipeForm if it needs to disable buttons etc.
      />
      <footer className="text-center py-6 border-t border-border text-sm text-muted-foreground">
        <p>&copy; {hasMounted ? new Date().getFullYear() : '...'} Recipe Rack. Happy Cooking!</p>
      </footer>
    </div>
  );
}
