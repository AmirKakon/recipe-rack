'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Recipe } from '@/lib/types';
import type { RecipeFormData } from '@/lib/schemas';
import { normalizeTags } from '@/lib/tags';
import { safeUUID } from '@/lib/utils';
import { createRecipe, updateRecipe } from '@/lib/recipes-api';
import { recipeKeys, useRecipeCache } from '@/hooks/use-recipes';
import { useToast } from '@/hooks/use-toast';

function toRecipeFields(formData: RecipeFormData) {
  return {
    title: formData.title,
    ingredients: formData.ingredients.map((ing) => ({
      id: ing.id || safeUUID(),
      name: ing.name,
      quantity: ing.quantity,
    })),
    instructions: formData.instructions,
    cuisines: normalizeTags(formData.cuisine ? formData.cuisine.split(',') : []),
    prepTime: formData.prepTime || '',
    cookTime: formData.cookTime || '',
    servingSize: formData.servingSize || '',
    kosherCategory: formData.kosherCategory,
    imageUrl: formData.imageUrl || '',
  };
}

export function useSaveRecipe() {
  const queryClient = useQueryClient();
  const { upsertRecipe } = useRecipeCache();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const saveRecipe = useCallback(
    async (formData: RecipeFormData, recipeIdToUpdate?: string): Promise<Recipe | null> => {
      setIsSaving(true);
      const fields = toRecipeFields(formData);
      try {
        let saved: Recipe;
        if (recipeIdToUpdate) {
          const existing =
            queryClient.getQueryData<Recipe>(recipeKeys.detail(recipeIdToUpdate)) ??
            queryClient.getQueryData<Recipe[]>(recipeKeys.all)?.find((r) => r.id === recipeIdToUpdate);
          saved = { ...existing, ...fields, id: recipeIdToUpdate };
          await updateRecipe(saved);
        } else {
          const createdAt = Date.now();
          const id = await createRecipe({ ...fields, createdAt });
          saved = { ...fields, id, createdAt, isFavorite: false };
        }
        upsertRecipe(saved);
        toast({
          title: recipeIdToUpdate ? 'Recipe Updated!' : 'Recipe Added!',
          description: `"${saved.title}" has been successfully ${recipeIdToUpdate ? 'updated' : 'added'}.`,
        });
        return saved;
      } catch (error) {
        console.error('Error saving recipe:', error);
        toast({
          title: 'Save Error',
          description: error instanceof Error ? error.message : 'Could not save the recipe. Ensure all fields are correct.',
          variant: 'destructive',
        });
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [queryClient, upsertRecipe, toast]
  );

  return { saveRecipe, isSaving };
}
