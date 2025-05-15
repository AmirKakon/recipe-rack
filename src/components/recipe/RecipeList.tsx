
'use client';

import type { Recipe } from '@/lib/types';
import { RecipeCard } from './RecipeCard';

interface RecipeListProps {
  recipes: Recipe[];
  onDeleteRecipe: (recipeId: string) => void;
}

export function RecipeList({ recipes, onDeleteRecipe }: RecipeListProps) {
  // The parent component (HomePage) already handles the empty state for recipes.
  // This component will only be rendered when recipes.length > 0.
  // Thus, the original empty check here was redundant.

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 md:p-8">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} onDelete={onDeleteRecipe} />
      ))}
    </div>
  );
}
