'use client';

import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { Recipe } from '@/lib/types';
import { recipeKeys } from '@/hooks/use-recipes';

const STORAGE_KEY = 'recipe-rack:recipes:v1';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredRecipes {
  savedAt: number;
  recipes: Recipe[];
}

function readStoredRecipes(): StoredRecipes | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredRecipes;
    if (!Array.isArray(stored?.recipes) || Date.now() - stored.savedAt > MAX_AGE_MS) return null;
    return stored;
  } catch {
    return null;
  }
}

function writeStoredRecipes(recipes: Recipe[], savedAt: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt, recipes }));
  } catch {
    // Quota exceeded or storage disabled: the app still works, it just loads from the network.
  }
}

// Restores the last-seen recipe list after mount (not during render, so statically
// rendered pages hydrate cleanly), then always revalidates: a stored copy may be recent
// enough to look "fresh" to react-query, but it was not fetched in this session.
export function usePersistedRecipes(queryClient: QueryClient) {
  useEffect(() => {
    const stored = readStoredRecipes();
    if (stored && !queryClient.getQueryData(recipeKeys.all)) {
      queryClient.setQueryData(recipeKeys.all, stored.recipes, { updatedAt: stored.savedAt });
      queryClient.invalidateQueries({ queryKey: recipeKeys.all }, { cancelRefetch: false });
    }

    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.query.queryKey[0] !== recipeKeys.all[0]) return;
      const { data, dataUpdatedAt } = event.query.state;
      if (Array.isArray(data)) writeStoredRecipes(data, dataUpdatedAt);
    });
  }, [queryClient]);
}
