
'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Recipe } from '@/lib/types';
import { Pencil, Trash2 } from 'lucide-react'; // Added Pencil
import { Badge } from '@/components/ui/badge';

interface RecipeCardProps {
  recipe: Recipe;
  onDelete: (recipeId: string) => void;
  onEdit: (recipeId: string) => void; // New prop for editing
}

export function RecipeCard({ recipe, onDelete, onEdit }: RecipeCardProps) {
  // Ensure instructions are always an array to handle old data formats
  const instructionsArray = Array.isArray(recipe.instructions)
    ? recipe.instructions
    : typeof recipe.instructions === 'string' && recipe.instructions.trim() !== ''
    ? [recipe.instructions] // Wrap old string in an array
    : [];

  return (
    <Card className="flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg overflow-hidden">
      <CardHeader className="p-6 bg-card">
        <div className="flex justify-between items-start">
          <CardTitle className="text-2xl font-bold tracking-tight text-card-foreground">{recipe.title}</CardTitle>
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
          {instructionsArray.length > 0 ? (
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              {instructionsArray.map((step, index) => (
                <li key={index} className="leading-relaxed whitespace-pre-wrap">
                  {step}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No instructions provided.</p>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-6 border-t bg-card flex gap-2"> {/* Added flex and gap for multiple buttons */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(recipe.id)}
          className="w-full"
          aria-label={`Edit recipe ${recipe.title}`}
        >
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
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
