
'use client';

import type { Recipe } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation'; // Import useRouter

interface RecipeListProps {
  recipes: Recipe[];
  onDeleteRecipe: (recipeId: string) => void;
  onEditRecipe: (recipeId: string) => void;
}

export function RecipeList({ recipes, onDeleteRecipe, onEditRecipe }: RecipeListProps) {
  const router = useRouter(); // Initialize router

  if (recipes.length === 0) {
    return null; 
  }

  const handleRowClick = (recipeId: string) => {
    router.push(`/recipe/${recipeId}`);
  };

  return (
    <div className="rounded-lg border shadow-md overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60%] font-semibold text-card-foreground text-base">Title</TableHead>
            <TableHead className="text-right font-semibold text-card-foreground text-base">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipes.map((recipe) => (
            <TableRow
              key={recipe.id}
              className="hover:bg-muted/50 cursor-pointer" // Add cursor-pointer
              onClick={() => handleRowClick(recipe.id)} // Add onClick for the row
            >
              <TableCell className="font-medium text-card-foreground py-3 align-middle">
                {/* Display title, can be styled to look like a link */}
                <span className="hover:underline text-primary">{recipe.title}</span>
              </TableCell>
              <TableCell className="text-right py-3 align-middle">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { // Add stopPropagation
                    e.stopPropagation();
                    onEditRecipe(recipe.id);
                  }}
                  className="text-blue-600 hover:text-blue-700 mr-2 h-8 w-8"
                  aria-label={`Edit recipe ${recipe.title}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { // Add stopPropagation
                    e.stopPropagation();
                    onDeleteRecipe(recipe.id);
                  }}
                  className="text-destructive hover:text-red-700 h-8 w-8"
                  aria-label={`Delete recipe ${recipe.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
