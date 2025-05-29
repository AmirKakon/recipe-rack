
'use client';

import type { Recipe } from '@/lib/types';
import { RecipeCard } from './RecipeCard';

interface RecipeListProps {
  recipes: Recipe[];
  onDeleteRecipe: (recipeId: string) => void;
  onEditRecipe: (recipeId: string) => void; // New prop for edit handler
}

export function RecipeList({ recipes, onDeleteRecipe, onEditRecipe }: RecipeListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 md:p-8">
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          onDelete={onDeleteRecipe}
          onEdit={onEditRecipe} // Pass onEditRecipe handler
        />
      ))}
    </div>
  );
}
