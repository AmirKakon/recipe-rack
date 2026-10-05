'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RecipeView } from '@/components/recipe/RecipeView';
import { RecipeForm } from '@/components/recipe/RecipeForm';
import { CookMode } from '@/components/recipe/CookMode';
import type { Recipe } from '@/lib/types';
import type { RecipeFormData } from '@/lib/schemas';
import { RecipeNotFoundError } from '@/lib/recipes-api';
import { useRecipe } from '@/hooks/use-recipes';
import { useSaveRecipe } from '@/hooks/use-save-recipe';
import { useHasInAppHistory } from '@/components/providers/AppProviders';
import { ArrowLeft, Loader2, ServerCrash, Home, Pencil, ChefHat, Printer } from 'lucide-react';

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const hasInAppHistory = useHasInAppHistory();

  const { data: recipe, isPending, error, refetch, isRefetching } = useRecipe(id);
  const { saveRecipe, isSaving } = useSaveRecipe();
  const [isCookModeOpen, setIsCookModeOpen] = useState(false);
  const [recipeBeingEdited, setRecipeBeingEdited] = useState<Recipe | null>(null);

  const goBack = () => (hasInAppHistory ? router.back() : router.push('/'));

  const handleSave = async (formData: RecipeFormData, recipeIdToUpdate?: string) => {
    const saved = await saveRecipe(formData, recipeIdToUpdate);
    if (saved) setRecipeBeingEdited(null);
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <p className="text-xl text-muted-foreground">Loading recipe details...</p>
      </div>
    );
  }

  if (!recipe) {
    const notFound = error instanceof RecipeNotFoundError;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <ServerCrash size={64} className="text-destructive mb-6" strokeWidth={1.5} />
        <h2 className="text-3xl font-semibold text-foreground mb-3">
          {notFound ? 'Recipe Not Found' : 'Oops! Something went wrong.'}
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-md">
          {notFound ? 'This recipe does not exist or was deleted.' : error?.message}
        </p>
        <div className="flex space-x-4">
          <Button onClick={() => router.push('/')} variant="outline" size="lg">
            <Home className="mr-2 h-5 w-5" /> Go Home
          </Button>
          {!notFound && (
            <Button onClick={() => refetch()} size="lg" disabled={isRefetching}>
              Try Again
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 sm:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-wrap gap-3 print:hidden">
          <Button variant="outline" onClick={goBack} className="shadow-sm">
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back
          </Button>
          <Button variant="default" onClick={() => setRecipeBeingEdited(recipe)} className="shadow-sm">
            <Pencil className="mr-2 h-5 w-5" />
            Edit Recipe
          </Button>
          <Button variant="yellow" onClick={() => setIsCookModeOpen(true)} className="shadow-sm">
            <ChefHat className="mr-2 h-5 w-5" />
            Cook Mode
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="shadow-sm">
            <Printer className="mr-2 h-5 w-5" />
            Print
          </Button>
        </div>
        <RecipeView key={recipe.id} recipe={recipe} />
      </div>
      {isCookModeOpen && <CookMode recipe={recipe} onClose={() => setIsCookModeOpen(false)} />}
      <RecipeForm
        isOpen={!!recipeBeingEdited}
        onClose={() => setRecipeBeingEdited(null)}
        onSave={handleSave}
        recipeToEdit={recipeBeingEdited}
        isSaving={isSaving}
      />
    </div>
  );
}
