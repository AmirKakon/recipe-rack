
'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { RecipeList } from '@/components/recipe/RecipeList';
import { RecipeForm } from '@/components/recipe/RecipeForm';
import type { Recipe } from '@/lib/types';
import type { RecipeFormData } from '@/lib/schemas';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { CookingPot } from 'lucide-react';

export default function HomePage() {
  const [recipes, setRecipes] = useLocalStorage<Recipe[]>('recipes', []);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null); // State for current recipe being edited
  const { toast } = useToast();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleOpenAddForm = () => {
    setEditingRecipe(null); // Clear any recipe being edited
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

  const handleSaveRecipe = (recipeData: RecipeFormData, recipeIdToUpdate?: string) => {
    if (recipeIdToUpdate) {
      // Editing existing recipe
      setRecipes(prevRecipes =>
        prevRecipes.map(recipe => {
          if (recipe.id === recipeIdToUpdate) {
            return {
              ...recipe, // Preserve original ID
              title: recipeData.title,
              // Map ingredients, preserving existing IDs or generating new ones for new ingredients
              ingredients: recipeData.ingredients.map(ing => ({
                id: ing.id || crypto.randomUUID(), // Use existing ID if present, else new
                name: ing.name,
                quantity: ing.quantity,
              })),
              instructions: recipeData.instructions,
              cuisine: recipeData.cuisine,
            };
          }
          return recipe;
        })
      );
      toast({
        title: 'Recipe Updated!',
        description: `"${recipeData.title}" has been successfully updated.`,
      });
    } else {
      // Adding new recipe
      const newRecipe: Recipe = {
        id: crypto.randomUUID(),
        title: recipeData.title,
        // New ingredients will get new IDs
        ingredients: recipeData.ingredients.map(ing => ({
            id: crypto.randomUUID(), // Always generate new ID for ingredients of a new recipe
            name: ing.name,
            quantity: ing.quantity,
        })),
        instructions: recipeData.instructions,
        cuisine: recipeData.cuisine,
      };
      setRecipes(prevRecipes => [...prevRecipes, newRecipe]);
      toast({
        title: 'Recipe Added!',
        description: `"${newRecipe.title}" has been successfully added to your rack.`,
      });
    }
  };

  const handleDeleteRecipe = (recipeId: string) => {
    const recipeToDelete = recipes.find(r => r.id === recipeId);
    setRecipes(prevRecipes => prevRecipes.filter(recipe => recipe.id !== recipeId));
    if (recipeToDelete) {
      toast({
        title: 'Recipe Deleted',
        description: `"${recipeToDelete.title}" has been removed.`,
        variant: 'destructive'
      });
    }
  };
  
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingRecipe(null); // Clear editing state when form is closed
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header onAddRecipeClick={handleOpenAddForm} /> {/* Changed to handleOpenAddForm */}
      <main className="flex-grow container mx-auto px-0 sm:px-4 py-8">
        {hasMounted && recipes.length === 0 && (
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
        {hasMounted && recipes.length > 0 && (
          <RecipeList 
            recipes={recipes} 
            onDeleteRecipe={handleDeleteRecipe}
            onEditRecipe={handleOpenEditForm} // Pass edit handler
          />
        )}
         {!hasMounted && ( 
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 md:p-8">
            {[1,2,3].map(i => (
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
      </main>
      <RecipeForm
        isOpen={isFormOpen}
        onClose={handleCloseForm} // Use unified close handler
        onSave={handleSaveRecipe} // Use unified save handler
        recipeToEdit={editingRecipe} // Pass the recipe to edit, or null for new
      />
      <footer className="text-center py-6 border-t border-border text-sm text-muted-foreground">
        <p>&copy; {hasMounted ? new Date().getFullYear() : '...'} Recipe Rack. Happy Cooking!</p>
      </footer>
    </div>
  );
}
