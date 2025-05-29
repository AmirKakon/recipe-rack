
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { RecipeList } from '@/components/recipe/RecipeList';
import { RecipeForm } from '@/components/recipe/RecipeForm';
import type { Recipe } from '@/lib/types';
import type { RecipeFormData } from '@/lib/schemas';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CookingPot, ServerCrash, Search } from 'lucide-react';

const API_BASE_URL = 'https://us-central1-recipe-rack-ighp8.cloudfunctions.net/app';

export default function HomePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const { toast } = useToast();
  const [hasMounted, setHasMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const processFetchedRecipe = (recipe: any): Recipe => {
    let cuisinesArray: string[] = [];
    if (recipe.cuisines && Array.isArray(recipe.cuisines)) {
      cuisinesArray = recipe.cuisines;
    } else if (typeof recipe.cuisine === 'string' && recipe.cuisine.trim() !== '') {
      // Fallback for old data model: convert single cuisine string to array
      cuisinesArray = [recipe.cuisine.trim()];
    }
    
    return {
      ...recipe,
      cuisines: cuisinesArray,
      cuisine: undefined, // Ensure old cuisine field is not directly used
      prepTime: recipe.prepTime || undefined,
      cookTime: recipe.cookTime || undefined,
      servingSize: recipe.servingSize || undefined,
    } as Recipe;
  };
  
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
        setRecipes(result.data.recipes.map(processFetchedRecipe));
      } else {
        console.warn("Fetched recipes data is not in the expected format:", result.data);
        setRecipes([]);
      }
    } catch (error) {
      console.error("Error fetching recipes:", error);
      setErrorLoading(error instanceof Error ? error.message : "An unknown error occurred while fetching recipes.");
      setRecipes([]);
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

  const handleSaveRecipe = async (recipeFormData: RecipeFormData, recipeIdToUpdate?: string) => {
    setIsLoading(true);
    try {
      let response;
      let successMessage = '';

      const cuisineTagsArray = recipeFormData.cuisine 
        ? recipeFormData.cuisine.split(',').map(tag => tag.trim()).filter(tag => tag) 
        : [];

      const payloadForBackend = {
        ...recipeFormData,
        ingredients: recipeFormData.ingredients.map(ing => ({
          id: ing.id || crypto.randomUUID(),
          name: ing.name,
          quantity: ing.quantity,
        })),
        cuisines: cuisineTagsArray,
        cuisine: undefined, 
        prepTime: recipeFormData.prepTime || '',
        cookTime: recipeFormData.cookTime || '',
        servingSize: recipeFormData.servingSize || '',
      };

      if (recipeIdToUpdate) {
        response = await fetch(`${API_BASE_URL}/api/recipes/update/${recipeIdToUpdate}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadForBackend),
        });
        successMessage = `"${payloadForBackend.title}" has been successfully updated.`;
      } else {
        response = await fetch(`${API_BASE_URL}/api/recipes/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadForBackend),
        });
        successMessage = `"${payloadForBackend.title}" has been successfully added.`;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save recipe and parse error.' }));
        throw new Error(errorData.message || `Failed to save recipe: ${response.statusText}`);
      }

      await response.json(); 
      toast({
        title: recipeIdToUpdate ? 'Recipe Updated!' : 'Recipe Added!',
        description: successMessage,
      });
      await fetchRecipes(); 
      handleCloseForm(); 
    } catch (error) {
      console.error("Error saving recipe:", error);
      toast({
        title: 'Save Error',
        description: error instanceof Error ? error.message : "Could not save the recipe. Ensure all fields are correct.",
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    const recipeToDelete = recipes.find(r => r.id === recipeId);
    if (!recipeToDelete) return;

    setIsLoading(true);
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
      await fetchRecipes();
    } catch (error) {
      console.error("Error deleting recipe:", error);
      toast({
        title: 'Delete Error',
        description: error instanceof Error ? error.message : "Could not delete the recipe.",
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingRecipe(null);
  };

  const filteredRecipes = useMemo(() => {
    if (!searchTerm) {
      return recipes;
    }
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    return recipes.filter(recipe =>
      recipe.title.toLowerCase().includes(lowercasedSearchTerm) ||
      (recipe.cuisines && recipe.cuisines.some(tag => tag.toLowerCase().includes(lowercasedSearchTerm)))
    );
  }, [recipes, searchTerm]);

  const currentYear = useMemo(() => (hasMounted ? new Date().getFullYear().toString() : '...'), [hasMounted]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header onAddRecipeClick={handleOpenAddForm} />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search recipes by title or cuisine tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-md pl-10 shadow-sm"
              aria-label="Search recipes by title or cuisine tags"
            />
          </div>
        </div>

        {isLoading && recipes.length === 0 && !errorLoading && (
           <div className="space-y-4 py-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-card rounded-lg shadow-md p-4 animate-pulse">
                <div className="h-6 bg-muted rounded w-full mb-2"></div>
                <div className="flex justify-between items-center">
                    <div className="h-5 bg-muted rounded w-1/4"></div>
                    <div className="flex gap-2">
                        <div className="h-8 w-16 bg-muted rounded"></div>
                        <div className="h-8 w-16 bg-muted rounded"></div>
                    </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!isLoading && errorLoading && (
          <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-lg shadow-md">
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
        {!isLoading && !errorLoading && filteredRecipes.length === 0 && recipes.length > 0 && searchTerm && (
          <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-lg shadow-md">
            <Search size={64} className="text-primary mb-6" strokeWidth={1.5} />
            <h2 className="text-3xl font-semibold text-foreground mb-3">No Recipes Found</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-md">
              No recipes match your search term "{searchTerm}" for title or cuisine tags. Try a different search.
            </p>
            <Button onClick={() => setSearchTerm('')} size="lg" variant="outline">
              Clear Search
            </Button>
          </div>
        )}
        {!isLoading && !errorLoading && recipes.length === 0 && !searchTerm && (
          <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-lg shadow-md">
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
        {!errorLoading && filteredRecipes.length > 0 && (
          <RecipeList 
            recipes={filteredRecipes} 
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
        isSaving={isLoading && isFormOpen}
      />
      <footer className="text-center py-6 border-t border-border text-sm text-muted-foreground">
        <p>&copy; {currentYear} Recipe Rack. Happy Cooking!</p>
      </footer>
    </div>
  );
}

