'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Recipe } from '@/lib/types';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RecipeCardProps {
  recipe: Recipe;
  onDelete: (recipeId: string) => void;
}

export function RecipeCard({ recipe, onDelete }: RecipeCardProps) {
  return (
    <Card className="flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg overflow-hidden">
      <CardHeader className="p-6 bg-card">
        <div className="flex justify-between items-start">
          <CardTitle className="text-2xl font-bold text-primary-foreground tracking-tight">{recipe.title}</CardTitle>
          {recipe.cuisine && <Badge variant="secondary" className="ml-2 shrink-0">{recipe.cuisine}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="p-6 flex-grow">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-foreground">Ingredients:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient.id}>
                <span className="font-medium text-foreground">{ingredient.name}</span>: {ingredient.quantity}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2 text-foreground">Instructions:</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
            {recipe.instructions}
          </p>
        </div>
      </CardContent>
      <CardFooter className="p-6 border-t bg-card">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(recipe.id)}
          className="w-full"
          aria-label={`Delete recipe ${recipe.title}`}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
