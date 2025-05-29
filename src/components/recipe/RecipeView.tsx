
'use client';

import type { Recipe } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

interface RecipeViewProps {
  recipe: Recipe;
}

export function RecipeView({ recipe }: RecipeViewProps) {
  const instructionsArray = Array.isArray(recipe.instructions)
    ? recipe.instructions
    : typeof recipe.instructions === 'string' && recipe.instructions.trim() !== ''
    ? [recipe.instructions]
    : [];

  return (
    <div className="bg-card p-6 sm:p-8 rounded-lg shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start mb-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-2 sm:mb-0">
          {recipe.title}
        </h1>
      </div>

      {recipe.cuisines && recipe.cuisines.length > 0 && (
        <div className="mb-6 pb-6 border-b border-border">
          <h2 className="text-xl font-semibold mb-2 text-foreground">Cuisine Tags:</h2>
          <div className="flex flex-wrap gap-2">
            {recipe.cuisines.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-sm px-3 py-1">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {!recipe.cuisines || recipe.cuisines.length === 0 && (
         <div className="mb-6 pb-6 border-b border-border"></div>
      )}


      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-3 text-foreground">Ingredients:</h2>
        {recipe.ingredients && recipe.ingredients.length > 0 ? (
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient.id} className="text-base">
                <span className="font-medium text-foreground">{ingredient.name}</span>: {ingredient.quantity}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No ingredients listed.</p>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-3 text-foreground">Instructions:</h2>
        {instructionsArray.length > 0 ? (
          <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
            {instructionsArray.map((step, index) => (
              <li key={index} className="text-base leading-relaxed whitespace-pre-wrap">
                {step}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground">No instructions provided.</p>
        )}
      </div>
    </div>
  );
}
