
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { RecipeList } from '@/components/recipe/RecipeList';
import { RecipeForm } from '@/components/recipe/RecipeForm';
import type { Recipe } from '@/lib/types';
import type { RecipeFormData } from '@/lib/schemas';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle as RecipeSuggestionCardTitle } from '@/components/ui/card'; // Renamed CardTitle to avoid conflict
import { CookingPot, ServerCrash, Search, Lightbulb, Loader2, RefreshCw } from 'lucide-react';
import type { SuggestRecipeBasedOnInputOutput, SuggestedRecipeItem } from '@/ai/flows/suggest-recipe-based-on-input-flow';
import { suggestRecipeBasedOnInput } from '@/ai/flows/suggest-recipe-based-on-input-flow';
import { Badge } from '@/components/ui/badge';


const API_BASE_URL = 'https://us-central1-recipe-rack-ighp8.cloudfunctions.net/app';

export default function HomePageClient() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const { toast } = useToast();
  const [hasMounted, setHasMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  // State for AI Recipe Suggestion
  const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [suggestionResult, setSuggestionResult] = useState<SuggestRecipeBasedOnInputOutput | null>(null);
  const [isSuggestingForPage, setIsSuggestingForPage] = useState(false);


  const processFetchedRecipe = (recipe: any): Recipe => {
    let cuisinesArray: string[] = [];
    if (recipe.cuisines && Array.isArray(recipe.cuisines)) {
      cuisinesArray = recipe.cuisines;
    } else if (typeof recipe.cuisine === 'string' && recipe.cuisine.trim() !== '') {
      cuisinesArray = [recipe.cuisine.trim()];
    }
    
    return {
      ...recipe,
      cuisines: cuisinesArray,
      cuisine: undefined, 
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

  const handleOpenEditForm = useCallback((recipeId: string) => {
    const recipeToEdit = recipes.find(r => r.id === recipeId);
    if (recipeToEdit) {
      setEditingRecipe(recipeToEdit);
      setIsFormOpen(true);
    } else {
      toast({
        title: 'Error',
        description: `Could not find recipe with ID ${recipeId} to edit.`,
        variant: 'destructive',
      });
    }
  }, [recipes, toast]);

  useEffect(() => {
    if (!searchParams || recipes.length === 0 || !hasMounted) return;

    const editId = searchParams.get('editRecipeId');
    if (editId && !isFormOpen) { 
      handleOpenEditForm(editId);
      
      const currentPathname = '/'; 
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete('editRecipeId');
      
      const queryString = newSearchParams.toString();
      const newUrl = queryString ? `${currentPathname}?${queryString}` : currentPathname;
      
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, recipes, router, handleOpenEditForm, isFormOpen, hasMounted]);


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

  const handleOpenSuggestionDialog = () => {
    setSuggestionQuery('');
    setSuggestionResult(null);
    setIsSuggestionDialogOpen(true);
  };

  const handleCloseSuggestionDialog = () => {
    setIsSuggestionDialogOpen(false);
  };

  const handleGetSuggestion = async (options: { preferNew?: boolean } = {}) => {
    if (!suggestionQuery.trim()) {
      toast({ title: "Input Required", description: "Please tell us what you'd like to eat.", variant: "destructive" });
      return;
    }
    setIsSuggestingForPage(true);
    // Do not clear previous results immediately if preferNew is true, to keep the "Try Other Ideas" button visible during loading
    if (!options.preferNew) {
        setSuggestionResult(null); 
    }

    try {
      const existingRecipeInfo = recipes.map(r => ({
        id: r.id,
        title: r.title,
        cuisines: r.cuisines || [],
      }));
      const result = await suggestRecipeBasedOnInput({ 
        userInput: suggestionQuery, 
        existingRecipes: existingRecipeInfo,
        preferNew: !!options.preferNew,
      });
      setSuggestionResult(result);
    } catch (error) {
      console.error("Error getting recipe suggestion:", error);
      toast({ title: "Suggestion Error", description: error instanceof Error ? error.message : "Could not get a suggestion.", variant: "destructive" });
      setSuggestionResult({ suggestions: [], overallReasoning: 'Failed to connect to the suggestion service. Please try again.' });
    } finally {
      setIsSuggestingForPage(false);
    }
  };

  const handleAddSuggestedRecipeToForm = (suggestedItem: SuggestedRecipeItem) => {
    if (!suggestedItem || suggestedItem.type !== 'new' || !suggestedItem.newRecipe) return;
    
    const newRecipeData = suggestedItem.newRecipe;

    const recipeToPreFill: Recipe = {
      id: '', 
      title: newRecipeData.title || 'Untitled Suggested Recipe',
      ingredients: newRecipeData.ingredients && newRecipeData.ingredients.length > 0
        ? newRecipeData.ingredients.map(ing => ({ name: ing.name, quantity: ing.quantity, id: crypto.randomUUID() }))
        : [{ name: '', quantity: '', id: crypto.randomUUID() }],
      instructions: newRecipeData.instructions && newRecipeData.instructions.length > 0
        ? newRecipeData.instructions
        : [''],
      cuisines: newRecipeData.cuisine
        ? newRecipeData.cuisine.split(',').map(tag => tag.trim()).filter(tag => tag)
        : [],
      prepTime: newRecipeData.prepTime || '',
      cookTime: newRecipeData.cookTime || '',
      servingSize: newRecipeData.servingSize || '',
    };

    setEditingRecipe(recipeToPreFill);
    setIsSuggestionDialogOpen(false);
    setIsFormOpen(true);
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
      <Header onAddRecipeClick={handleOpenAddForm} onSuggestRecipeClick={handleOpenSuggestionDialog} />
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
              Ready to fill it with deliciousness? Click "Add Recipe" or "Suggest Recipe" to get started.
            </p>
            <div className="flex gap-4">
                <Button onClick={handleOpenAddForm} size="lg">
                Let's Cook Up Something!
                </Button>
                 <Button onClick={handleOpenSuggestionDialog} size="lg" variant="yellow">
                  <Lightbulb className="mr-2 h-5 w-5" /> Get a Suggestion
                </Button>
            </div>
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

      <Dialog open={isSuggestionDialogOpen} onOpenChange={setIsSuggestionDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Get Recipe Suggestions</DialogTitle>
            <DialogDescription>
              Tell us what you're in the mood for. We'll suggest recipes from your rack or new ideas!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="e.g., A light pasta dish for lunch, something with beef and broccoli, a dessert with berries..."
              value={suggestionQuery}
              onChange={(e) => setSuggestionQuery(e.target.value)}
              rows={3}
              disabled={isSuggestingForPage}
            />
            {isSuggestingForPage && (
              <div className="flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Getting suggestions...
              </div>
            )}
            {suggestionResult && (
              <div className="space-y-4">
                <p className="text-md italic text-muted-foreground bg-accent/10 p-3 rounded-md">
                  <span className="font-semibold">Chef's Note:</span> {suggestionResult.overallReasoning}
                </p>
                {suggestionResult.suggestions.length > 0 ? (
                  <div className="space-y-4">
                    {suggestionResult.suggestions.map((item, index) => (
                      <Card key={index} className="shadow-md">
                        <CardHeader>
                          <RecipeSuggestionCardTitle className="text-xl">
                            {item.type === 'existing' ? item.existingRecipe?.title : item.newRecipe?.title}
                          </RecipeSuggestionCardTitle>
                          <Badge variant={item.type === 'existing' ? 'secondary' : 'default'} className="w-fit">
                            {item.type === 'existing' ? 'From Your Rack' : 'New Idea'}
                          </Badge>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p className="text-sm text-muted-foreground">{item.reasoning}</p>
                          {item.type === 'new' && item.newRecipe && (
                            <div className="text-xs space-y-0.5">
                                {item.newRecipe.cuisine && <p><strong>Cuisine:</strong> {item.newRecipe.cuisine}</p>}
                                {item.newRecipe.prepTime && <p><strong>Prep:</strong> {item.newRecipe.prepTime}</p>}
                                {item.newRecipe.cookTime && <p><strong>Cook:</strong> {item.newRecipe.cookTime}</p>}
                                {item.newRecipe.servingSize && <p><strong>Serves:</strong> {item.newRecipe.servingSize}</p>}
                            </div>
                          )}
                          
                          {item.type === 'existing' && item.existingRecipe?.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                router.push(`/recipe/${item.existingRecipe?.id}`);
                                setIsSuggestionDialogOpen(false);
                              }}
                              className="mt-2"
                            >
                              View This Recipe
                            </Button>
                          )}
                          {item.type === 'new' && (
                            <Button
                              size="sm"
                              onClick={() => handleAddSuggestedRecipeToForm(item)}
                              className="mt-2"
                            >
                              Add this to My Rack
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  !isSuggestingForPage && (
                    <p className="text-sm text-center text-destructive-foreground bg-destructive p-3 rounded-md">{suggestionResult.overallReasoning || "No suggestions could be made with the current input."}</p>
                  )
                )}
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            {suggestionResult && suggestionResult.suggestions.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleGetSuggestion({ preferNew: true })}
                className="w-full sm:w-auto mb-3 sm:mb-0"
                disabled={isSuggestingForPage || !suggestionQuery.trim()}
              >
                {isSuggestingForPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Try Other Ideas
              </Button>
            )}
            <div className="flex flex-col sm:flex-row sm:gap-2 w-full sm:w-auto">
                <Button type="button" variant="ghost" onClick={handleCloseSuggestionDialog} className="w-full sm:w-auto order-2 sm:order-1" disabled={isSuggestingForPage}>
                Cancel
                </Button>
                <Button
                type="button"
                onClick={() => handleGetSuggestion()}
                className="w-full sm:w-auto mb-3 sm:mb-0 order-1 sm:order-2"
                disabled={isSuggestingForPage || !suggestionQuery.trim()}
                >
                {isSuggestingForPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                Get Suggestions
                </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="text-center py-6 border-t border-border text-sm text-muted-foreground">
        <p>&copy; {currentYear} Recipe Rack. Happy Cooking!</p>
      </footer>
    </div>
  );
}
    

    