'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Recipe } from '@/lib/types';
import { fetchRecipe, fetchRecipes } from '@/lib/recipes-api';

export const recipeKeys = {
  all: ['recipes'] as const,
  detail: (id: string) => ['recipe', id] as const,
};

export function useRecipes() {
  return useQuery({ queryKey: recipeKeys.all, queryFn: fetchRecipes });
}

// Seeds the detail view from the list cache so opening a recipe renders instantly,
// then refreshes that single recipe in the background.
export function useRecipe(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: recipeKeys.detail(id),
    queryFn: () => fetchRecipe(id),
    enabled: !!id,
    initialData: () => queryClient.getQueryData<Recipe[]>(recipeKeys.all)?.find((r) => r.id === id),
    initialDataUpdatedAt: () => queryClient.getQueryState(recipeKeys.all)?.dataUpdatedAt,
  });
}

export function useRecipeCache() {
  const queryClient = useQueryClient();

  const upsertRecipe = useCallback(
    (recipe: Recipe) => {
      queryClient.setQueryData<Recipe[]>(recipeKeys.all, (prev) => {
        if (!prev) return prev;
        return prev.some((r) => r.id === recipe.id)
          ? prev.map((r) => (r.id === recipe.id ? recipe : r))
          : [...prev, recipe];
      });
      queryClient.setQueryData(recipeKeys.detail(recipe.id), recipe);
    },
    [queryClient]
  );

  const removeRecipe = useCallback(
    (id: string) => {
      queryClient.setQueryData<Recipe[]>(recipeKeys.all, (prev) => prev?.filter((r) => r.id !== id));
      queryClient.removeQueries({ queryKey: recipeKeys.detail(id) });
    },
    [queryClient]
  );

  return { upsertRecipe, removeRecipe };
}
