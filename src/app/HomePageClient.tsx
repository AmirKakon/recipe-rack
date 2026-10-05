
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { RecipeList } from '@/components/recipe/RecipeList';
import { RecipeForm } from '@/components/recipe/RecipeForm';
import { ShoppingListDialog } from '@/components/recipe/ShoppingListDialog';
import { HolidayBanner } from '@/components/recipe/HolidayBanner';
import type { Recipe, KosherCategory } from '@/lib/types';
import type { RecipeFormData } from '@/lib/schemas';
import { KOSHER_CATEGORIES } from '@/lib/kosher';
import { safeUUID } from '@/lib/utils';
import { SORT_OPTIONS, sortRecipes, type SortOption } from '@/lib/recipe-sort';
import { deleteRecipe, updateRecipe } from '@/lib/recipes-api';
import { useRecipeCache, useRecipes } from '@/hooks/use-recipes';
import { useSaveRecipe } from '@/hooks/use-save-recipe';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle as RecipeSuggestionCardTitle } from '@/components/ui/card'; // Renamed CardTitle to avoid conflict
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CookingPot, ServerCrash, Search, Lightbulb, Loader2, RefreshCw, Star, SlidersHorizontal } from 'lucide-react';
import type { SuggestRecipeBasedOnInputOutput, SuggestedRecipeItem } from '@/ai/flows/suggest-recipe-based-on-input-flow';
import { suggestRecipeBasedOnInput } from '@/ai/flows/suggest-recipe-based-on-input-flow';
import { Badge } from '@/components/ui/badge';

const NO_RECIPES: Recipe[] = [];
const SHOW_FILTERS_KEY = 'recipe-rack:show-filters';

export default function HomePageClient() {
  const { data: recipes = NO_RECIPES, isPending, error: recipesError, refetch: refetchRecipes, isRefetching } = useRecipes();
  const { upsertRecipe, removeRecipe } = useRecipeCache();
  const { saveRecipe, isSaving } = useSaveRecipe();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recipePendingDelete, setRecipePendingDelete] = useState<Recipe | null>(null);
  const { toast } = useToast();
  const [hasMounted, setHasMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorLoading = recipes.length === 0 && recipesError ? recipesError.message : null;

  // Filters live in the URL so Back/Forward and refresh restore exactly what the user was looking at.
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');
  const kosherParam = searchParams.get('kosher');
  const kosherFilter: KosherCategory | 'all' = KOSHER_CATEGORIES.some((c) => c.value === kosherParam)
    ? (kosherParam as KosherCategory)
    : 'all';
  const selectedCuisine = searchParams.get('tag');
  const favoritesOnly = searchParams.get('fav') === '1';
  const shabbatOnly = searchParams.get('shabbat') === '1';
  const sortParam = searchParams.get('sort');
  const sortBy: SortOption = SORT_OPTIONS.some((o) => o.value === sortParam) ? (sortParam as SortOption) : 'title';
  const [showFilters, setShowFilters] = useState(() => {
    try {
      return sessionStorage.getItem(SHOW_FILTERS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggleShowFilters = () => {
    setShowFilters((open) => {
      try {
        sessionStorage.setItem(SHOW_FILTERS_KEY, open ? '0' : '1');
      } catch {
        // Storage can be unavailable (private mode); the panel just won't stay open across pages.
      }
      return !open;
    });
  };

  const updateFilters = useCallback((changes: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(changes).forEach(([key, value]) => (value ? params.set(key, value) : params.delete(key)));
    const query = params.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    updateFilters({ q: value || null });
  };
  const setKosherFilter = (value: KosherCategory | 'all') => updateFilters({ kosher: value === 'all' ? null : value });
  const setSortBy = (value: SortOption) => updateFilters({ sort: value === 'title' ? null : value });

  // State for AI Recipe Suggestion
  const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [suggestionResult, setSuggestionResult] = useState<SuggestRecipeBasedOnInputOutput | null>(null);
  const [isSuggestingForPage, setIsSuggestingForPage] = useState(false);

  const [isShoppingListOpen, setIsShoppingListOpen] = useState(false);


  useEffect(() => {
    setHasMounted(true);
  }, []);

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
    const saved = await saveRecipe(recipeFormData, recipeIdToUpdate);
    if (saved) handleCloseForm();
  };

  const handleConfirmDelete = async () => {
    const recipe = recipePendingDelete;
    if (!recipe) return;
    setRecipePendingDelete(null);
    removeRecipe(recipe.id);
    try {
      await deleteRecipe(recipe.id);
      toast({ title: 'Recipe Deleted', description: `"${recipe.title}" has been removed.` });
    } catch (error) {
      upsertRecipe(recipe);
      toast({
        title: 'Delete Error',
        description: error instanceof Error ? error.message : 'Could not delete the recipe.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleFavorite = useCallback(async (recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const updated = { ...recipe, isFavorite: !recipe.isFavorite };
    upsertRecipe(updated);
    try {
      await updateRecipe(updated);
    } catch (error) {
      upsertRecipe(recipe);
      toast({
        title: 'Could not update favorite',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [recipes, upsertRecipe, toast]);

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

  const handleHolidaySuggest = (queryHint: string) => {
    const query = `recipe ideas for ${queryHint}`;
    setSuggestionQuery(query);
    setSuggestionResult(null);
    setIsSuggestionDialogOpen(true);
    handleGetSuggestion({ query });
  };

  const handleGetSuggestion = async (options: { preferNew?: boolean; query?: string } = {}) => {
    const effectiveQuery = (options.query ?? suggestionQuery).trim();
    if (!effectiveQuery) {
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
        userInput: effectiveQuery,
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
        ? newRecipeData.ingredients.map(ing => ({ name: ing.name, quantity: ing.quantity, id: safeUUID() }))
        : [{ name: '', quantity: '', id: safeUUID() }],
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


  const allCuisines = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach(r => (r.cuisines || []).forEach(tag => tag.trim() && set.add(tag.trim())));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    const filtered = recipes.filter(recipe => {
      const matchesSearch =
        !searchTerm ||
        recipe.title.toLowerCase().includes(lowercasedSearchTerm) ||
        (recipe.cuisines && recipe.cuisines.some(tag => tag.toLowerCase().includes(lowercasedSearchTerm)));
      const matchesKosher = kosherFilter === 'all' || recipe.kosherCategory === kosherFilter;
      const matchesCuisine = !selectedCuisine || (recipe.cuisines || []).includes(selectedCuisine);
      const matchesFavorite = !favoritesOnly || !!recipe.isFavorite;
      const matchesShabbat = !shabbatOnly || (recipe.cuisines || []).some(tag => /shabb?at|shabbos/i.test(tag));
      return matchesSearch && matchesKosher && matchesCuisine && matchesFavorite && matchesShabbat;
    });
    return sortRecipes(filtered, sortBy);
  }, [recipes, searchTerm, kosherFilter, selectedCuisine, favoritesOnly, shabbatOnly, sortBy]);

  const isFiltering = searchTerm.trim() !== '' || kosherFilter !== 'all' || selectedCuisine !== null || favoritesOnly || shabbatOnly;

  // Count of active filters (excludes the always-visible search box and sort).
  const activeFilterCount =
    (kosherFilter !== 'all' ? 1 : 0) +
    (selectedCuisine ? 1 : 0) +
    (favoritesOnly ? 1 : 0) +
    (shabbatOnly ? 1 : 0);

  const clearFilters = () => {
    setSearchTerm('');
    updateFilters({ q: null, kosher: null, tag: null, fav: null, shabbat: null });
  };

  const handleToggleCuisineFilter = useCallback((tag: string) => {
    updateFilters({ tag: selectedCuisine === tag ? null : tag });
  }, [selectedCuisine, updateFilters]);

  const currentYear = useMemo(() => (hasMounted ? new Date().getFullYear().toString() : '...'), [hasMounted]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header onAddRecipeClick={handleOpenAddForm} onSuggestRecipeClick={handleOpenSuggestionDialog} onShoppingListClick={() => setIsShoppingListOpen(true)} />
      <main className="flex-grow container mx-auto px-4 py-8">
        <HolidayBanner onGetIdeas={handleHolidaySuggest} />
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search recipes..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 shadow-sm"
                aria-label="Search recipes by title or cuisine tags"
              />
            </div>
            <Button
              type="button"
              variant={showFilters ? 'default' : 'outline'}
              onClick={toggleShowFilters}
              aria-expanded={showFilters}
              className="shrink-0"
            >
              <SlidersHorizontal className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="space-y-3 rounded-lg border border-border bg-card/50 p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground mr-1 w-16 sm:w-auto">Kosher:</span>
                <Button
                  type="button"
                  size="sm"
                  variant={kosherFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setKosherFilter('all')}
                >
                  All
                </Button>
                {KOSHER_CATEGORIES.map((cat) => (
                  <Button
                    key={cat.value}
                    type="button"
                    size="sm"
                    variant={kosherFilter === cat.value ? 'default' : 'outline'}
                    onClick={() => setKosherFilter(cat.value)}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>

              {allCuisines.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground mr-1">Cuisine:</span>
                  {allCuisines.map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedCuisine === tag ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => handleToggleCuisineFilter(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant={favoritesOnly ? 'default' : 'outline'}
                  onClick={() => updateFilters({ fav: favoritesOnly ? null : '1' })}
                >
                  <Star className={`mr-1.5 h-4 w-4 ${favoritesOnly ? 'fill-current' : ''}`} />
                  Favorites
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={shabbatOnly ? 'default' : 'outline'}
                  onClick={() => updateFilters({ shabbat: shabbatOnly ? null : '1' })}
                >
                  🕯️ Shabbat
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Sort:</span>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="w-44 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isFiltering && (
                  <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {isPending && !errorLoading && (
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
        {errorLoading && (
          <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-lg shadow-md">
            <ServerCrash size={64} className="text-destructive mb-6" strokeWidth={1.5} />
            <h2 className="text-3xl font-semibold text-destructive mb-3">Oops! Something went wrong.</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-md">
              {errorLoading}
            </p>
            <Button onClick={() => refetchRecipes()} size="lg" variant="outline" disabled={isRefetching}>
              Try Again
            </Button>
          </div>
        )}
        {!isPending && !errorLoading && filteredRecipes.length === 0 && recipes.length > 0 && isFiltering && (
          <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-lg shadow-md">
            <Search size={64} className="text-primary mb-6" strokeWidth={1.5} />
            <h2 className="text-3xl font-semibold text-foreground mb-3">No Recipes Found</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-md">
              No recipes match your current filters. Try a different search or kosher filter.
            </p>
            <Button onClick={clearFilters} size="lg" variant="outline">
              Clear Filters
            </Button>
          </div>
        )}
        {!isPending && !errorLoading && recipes.length === 0 && !searchTerm && (
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
            onDeleteRecipe={(id) => setRecipePendingDelete(recipes.find((r) => r.id === id) ?? null)}
            onEditRecipe={handleOpenEditForm}
            onToggleFavorite={handleToggleFavorite}
            onCuisineClick={handleToggleCuisineFilter}
            selectedCuisine={selectedCuisine}
          />
        )}
      </main>
      <RecipeForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSaveRecipe}
        recipeToEdit={editingRecipe}
        isSaving={isSaving}
      />

      <ShoppingListDialog
        recipes={recipes}
        open={isShoppingListOpen}
        onOpenChange={setIsShoppingListOpen}
      />

      <AlertDialog open={!!recipePendingDelete} onOpenChange={(open) => !open && setRecipePendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this recipe?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{recipePendingDelete?.title}&quot; will be permanently removed from your rack.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    

    