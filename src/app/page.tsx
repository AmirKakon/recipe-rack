
'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { RecipeList } from '@/components/recipe/RecipeList';
import { RecipeForm } from '@/components/recipe/RecipeForm';
import type { Recipe, Ingredient } from '@/lib/types';
import type { RecipeFormData } from '@/lib/schemas';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button'; // For placeholder if no recipes
import { CookingPot } from 'lucide-react'; // Example icon

export default function HomePage() {
  const [recipes, setRecipes] = useLocalStorage<Recipe[]>('recipes', []);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  // Ensure recipes are loaded on client mount. useLocalStorage handles this.

  const handleAddRecipe = (recipeData: RecipeFormData) => {
    const newRecipe: Recipe = {
      id: crypto.randomUUID(),
      title: recipeData.title,
      ingredients: recipeData.ingredients.map(ing => ({ ...ing, id: crypto.randomUUID() })),
      instructions: recipeData.instructions,
      cuisine: recipeData.cuisine,
    };
    setRecipes((prevRecipes) => [...prevRecipes, newRecipe]);
    toast({
      title: 'Recipe Added!',
      description: `"${newRecipe.title}" has been successfully added to your rack.`,
    });
  };

  const handleDeleteRecipe = (recipeId: string) => {
    const recipeToDelete = recipes.find(r => r.id === recipeId);
    setRecipes((prevRecipes) => prevRecipes.filter((recipe) => recipe.id !== recipeId));
    if (recipeToDelete) {
      toast({
        title: 'Recipe Deleted',
        description: `"${recipeToDelete.title}" has been removed.`,
        variant: 'destructive'
      });
    }
  };
  
  // Hydration guard for initial render
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);


  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header onAddRecipeClick={() => setIsFormOpen(true)} />
      <main className="flex-grow container mx-auto px-0 sm:px-4 py-8">
        {hasMounted && recipes.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-lg shadow-md m-4 md:m-8">
            <CookingPot size={64} className="text-primary mb-6" strokeWidth={1.5} />
            <h2 className="text-3xl font-semibold text-foreground mb-3">Your Recipe Rack is Empty!</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-md">
              Ready to fill it with deliciousness? Click "Add Recipe" to get started.
            </p>
            <Button onClick={() => setIsFormOpen(true)} size="lg">
              Let's Cook Up Something!
            </Button>
          </div>
        )}
        {hasMounted && recipes.length > 0 && (
          <RecipeList recipes={recipes} onDeleteRecipe={handleDeleteRecipe} />
        )}
         {!hasMounted && ( // Skeleton or loading state for SSR/initial load
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
        onClose={() => setIsFormOpen(false)}
        onSave={handleAddRecipe}
      />
      <footer className="text-center py-6 border-t border-border text-sm text-muted-foreground">
        <p>&copy; {hasMounted ? new Date().getFullYear() : '...'} Recipe Rack. Happy Cooking!</p>
      </footer>
    </div>
  );
}
