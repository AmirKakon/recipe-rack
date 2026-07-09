'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { MealPlanEntry, MealType, Recipe } from '@/lib/types';
import { getWeekDays, getWeekLabel } from '@/lib/week';
import { RecipePickerDialog } from '@/components/recipe/RecipePickerDialog';
import { ShoppingListDialog } from '@/components/recipe/ShoppingListDialog';
import { KosherBadge } from '@/components/recipe/KosherBadge';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Plus, ShoppingCart, X } from 'lucide-react';

const API_BASE_URL = 'https://us-central1-recipe-rack-ighp8.cloudfunctions.net/app';

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

const processFetchedRecipe = (r: any): Recipe => {
  let cuisines: string[] = [];
  if (Array.isArray(r.cuisines)) cuisines = r.cuisines;
  else if (typeof r.cuisine === 'string' && r.cuisine.trim()) cuisines = [r.cuisine.trim()];
  return { ...r, cuisines } as Recipe;
};

export default function MealPlannerPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [picker, setPicker] = useState<{ date: string; mealType: MealType } | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);

  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [recipesRes, planRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/recipes/getAll`),
          fetch(`${API_BASE_URL}/api/mealplan`),
        ]);
        const recipesJson = await recipesRes.json();
        if (recipesJson?.data?.recipes) setRecipes(recipesJson.data.recipes.map(processFetchedRecipe));
        const planJson = await planRes.json();
        if (Array.isArray(planJson?.data?.entries)) setEntries(planJson.data.entries);
      } catch (error) {
        console.error('Error loading planner:', error);
        toast({ title: 'Error loading planner', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [toast]);

  const persist = useCallback(async (next: MealPlanEntry[]) => {
    const previous = entries;
    setEntries(next); // optimistic
    try {
      const res = await fetch(`${API_BASE_URL}/api/mealplan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: next }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.statusText}`);
      await res.json();
    } catch (error) {
      setEntries(previous); // revert
      toast({ title: 'Could not save plan', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  }, [entries, toast]);

  const entriesFor = (date: string, mealType: MealType) =>
    entries.filter((e) => e.date === date && e.mealType === mealType);

  const addRecipe = (recipe: Recipe) => {
    if (!picker) return;
    persist([...entries, { date: picker.date, mealType: picker.mealType, recipeId: recipe.id }]);
  };

  const removeEntry = (entry: MealPlanEntry) => {
    persist(entries.filter((e) => !(e.date === entry.date && e.mealType === entry.mealType && e.recipeId === entry.recipeId)));
  };

  const weekRecipeIds = useMemo(() => {
    const weekDates = new Set(weekDays.map((d) => d.date));
    return Array.from(new Set(entries.filter((e) => weekDates.has(e.date)).map((e) => e.recipeId)));
  }, [entries, weekDays]);

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Recipes
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Meal Planner</h1>
          </div>
          <Button
            variant="default"
            onClick={() => setShoppingOpen(true)}
            disabled={weekRecipeIds.length === 0}
          >
            <ShoppingCart className="mr-2 h-4 w-4" /> Shop this week
          </Button>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[10rem]">
            <p className="font-semibold text-foreground">{getWeekLabel(weekOffset)}</p>
            {weekOffset !== 0 && (
              <button className="text-xs text-primary hover:underline" onClick={() => setWeekOffset(0)}>Back to this week</button>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading planner…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
            {weekDays.map((day) => (
              <div
                key={day.date}
                className={`rounded-lg border bg-card p-3 shadow-sm ${day.isToday ? 'ring-2 ring-primary' : ''}`}
              >
                <div className="mb-3 border-b border-border pb-2">
                  <p className="text-sm font-semibold text-foreground">{day.dayName}</p>
                  <p className="text-xs text-muted-foreground">{day.dayNumber}</p>
                </div>
                <div className="space-y-3">
                  {MEAL_TYPES.map((meal) => {
                    const slotEntries = entriesFor(day.date, meal.value);
                    return (
                      <div key={meal.value}>
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{meal.label}</p>
                        <div className="space-y-1">
                          {slotEntries.map((entry, i) => {
                            const recipe = recipesById.get(entry.recipeId);
                            return (
                              <div key={i} className="group flex items-center justify-between gap-1 rounded bg-secondary/40 px-2 py-1">
                                <button
                                  className="flex-1 truncate text-left text-xs text-foreground hover:underline"
                                  onClick={() => recipe && router.push(`/recipe/${recipe.id}`)}
                                  title={recipe?.title || 'Unknown recipe'}
                                >
                                  {recipe?.title || 'Unknown recipe'}
                                </button>
                                {recipe?.kosherCategory && <KosherBadge category={recipe.kosherCategory} className="hidden xl:inline-flex" />}
                                <button
                                  onClick={() => removeEntry(entry)}
                                  className="text-muted-foreground hover:text-destructive"
                                  aria-label="Remove"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                          <button
                            onClick={() => setPicker({ date: day.date, mealType: meal.value })}
                            className="flex w-full items-center gap-1 rounded border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RecipePickerDialog
        recipes={recipes}
        open={picker !== null}
        onOpenChange={(o) => { if (!o) setPicker(null); }}
        onPick={addRecipe}
        title={picker ? `Add to ${MEAL_TYPES.find((m) => m.value === picker.mealType)?.label}` : undefined}
      />

      <ShoppingListDialog
        recipes={recipes}
        open={shoppingOpen}
        onOpenChange={setShoppingOpen}
        initialSelectedIds={weekRecipeIds}
      />
    </div>
  );
}
