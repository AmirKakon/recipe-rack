'use client';

import type { Recipe } from '@/lib/types';
import { RecipeCard } from './RecipeCard';

interface RecipeListProps {
  recipes: Recipe[];
  onDeleteRecipe: (recipeId: string) => void;
}

export function RecipeList({ recipes, onDeleteRecipe }: RecipeListProps) {
  if (recipes.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-xl text-muted-foreground">No recipes yet. Add your first one!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 md:p-8">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} onDelete={onDeleteRecipe} />
      ))}
    </div>
  );
}
