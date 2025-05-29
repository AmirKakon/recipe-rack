
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RecipeView } from '@/components/recipe/RecipeView';
import type { Recipe } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, ServerCrash, Home } from 'lucide-react';

const API_BASE_URL = 'https://us-central1-recipe-rack-ighp8.cloudfunctions.net/app';

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const processFetchedRecipe = (fetchedRecipeData: any): Recipe => {
    let cuisinesArray: string[] = [];
    if (fetchedRecipeData.cuisines && Array.isArray(fetchedRecipeData.cuisines)) {
      cuisinesArray = fetchedRecipeData.cuisines;
    } else if (typeof fetchedRecipeData.cuisine === 'string' && fetchedRecipeData.cuisine.trim() !== '') {
      // Fallback for old data model
      cuisinesArray = [fetchedRecipeData.cuisine.trim()];
    }
    
    return {
      ...fetchedRecipeData,
      cuisines: cuisinesArray,
      cuisine: undefined, // Ensure old cuisine field is not directly used
    } as Recipe;
  };

  const fetchRecipe = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/recipes/get/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Recipe not found.');
        }
        throw new Error(`Failed to fetch recipe: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.status === "Success" && result.data) {
        setRecipe(processFetchedRecipe(result.data));
      } else {
        throw new Error('Recipe data not found in response.');
      }
    } catch (err) {
      console.error("Error fetching recipe:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      toast({
        title: 'Error Fetching Recipe',
        description: errorMessage,
        variant: 'destructive',
      });
      setRecipe(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchRecipe();
  }, [fetchRecipe]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <p className="text-xl text-muted-foreground">Loading recipe details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <ServerCrash size={64} className="text-destructive mb-6" strokeWidth={1.5} />
        <h2 className="text-3xl font-semibold text-destructive mb-3">Oops! Something went wrong.</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-md">
          {error}
        </p>
        <div className="flex space-x-4">
          <Button onClick={() => router.push('/')} variant="outline" size="lg">
            <Home className="mr-2 h-5 w-5" /> Go Home
          </Button>
          <Button onClick={fetchRecipe} size="lg">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <h2 className="text-3xl font-semibold text-foreground mb-3">Recipe Not Found</h2>
        <p className="text-lg text-muted-foreground mb-8">
          The recipe you are looking for does not exist or could not be loaded.
        </p>
        <Button onClick={() => router.push('/')} variant="outline" size="lg">
          <Home className="mr-2 h-5 w-5" /> Go Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 sm:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <Button variant="outline" onClick={() => router.push('/')} className="shadow-sm">
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Recipe List
          </Button>
        </div>
        <RecipeView recipe={recipe} />
      </div>
    </div>
  );
}
