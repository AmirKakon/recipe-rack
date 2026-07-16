
'use client';

import type { Recipe } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, Trash2, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { KosherBadge } from '@/components/recipe/KosherBadge';
import { StarRating } from '@/components/recipe/StarRating';
import { cn } from '@/lib/utils';

interface RecipeListProps {
  recipes: Recipe[];
  onDeleteRecipe: (recipeId: string) => void;
  onEditRecipe: (recipeId: string) => void;
  onToggleFavorite: (recipeId: string) => void;
  onCuisineClick: (tag: string) => void;
  selectedCuisine: string | null;
}

export function RecipeList({ recipes, onDeleteRecipe, onEditRecipe, onToggleFavorite, onCuisineClick, selectedCuisine }: RecipeListProps) {
  const router = useRouter();

  if (recipes.length === 0) {
    return null;
  }

  const handleRowClick = (recipeId: string) => {
    router.push(`/recipe/${recipeId}`);
  };

  const Thumb = ({ recipe }: { recipe: Recipe }) =>
    recipe.imageUrl ? (
      <div className="relative h-10 w-10 shrink-0 rounded-md overflow-hidden border">
        <Image src={recipe.imageUrl} alt="" fill className="object-cover" sizes="40px" />
      </div>
    ) : null;

  const Tags = ({ recipe }: { recipe: Recipe }) =>
    recipe.cuisines && recipe.cuisines.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {recipe.cuisines.map((tag, index) => (
          <Badge
            key={index}
            variant={selectedCuisine === tag ? 'default' : 'secondary'}
            className="cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onCuisineClick(tag); }}
          >
            {tag}
          </Badge>
        ))}
      </div>
    ) : (
      <span className="text-sm text-muted-foreground">N/A</span>
    );

  const Actions = ({ recipe }: { recipe: Recipe }) => (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(recipe.id); }}
        className={cn('h-8 w-8', recipe.isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground hover:text-yellow-500')}
        aria-label={recipe.isFavorite ? `Unfavorite ${recipe.title}` : `Favorite ${recipe.title}`}
        aria-pressed={!!recipe.isFavorite}
      >
        <Star className={cn('h-4 w-4', recipe.isFavorite && 'fill-current')} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onEditRecipe(recipe.id); }}
        className="text-blue-600 hover:text-blue-700 h-8 w-8"
        aria-label={`Edit recipe ${recipe.title}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onDeleteRecipe(recipe.id); }}
        className="text-destructive hover:text-red-700 h-8 w-8"
        aria-label={`Delete recipe ${recipe.title}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="space-y-3 md:hidden">
        {recipes.map((recipe) => (
          <div
            key={recipe.id}
            onClick={() => handleRowClick(recipe.id)}
            className="cursor-pointer rounded-lg border bg-card p-4 shadow-sm active:bg-muted/50"
          >
            <div className="flex items-start gap-3">
              <Thumb recipe={recipe} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-primary">{recipe.title}</span>
                  <KosherBadge category={recipe.kosherCategory} />
                </div>
                {recipe.rating ? <StarRating value={recipe.rating} readOnly size={14} className="mt-1" /> : null}
                <div className="mt-2">
                  <Tags recipe={recipe} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-1 border-t border-border pt-2">
              <Actions recipe={recipe} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden rounded-lg border shadow-md overflow-hidden bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%] font-semibold text-card-foreground text-base">Title</TableHead>
              <TableHead className="w-[40%] font-semibold text-card-foreground text-base">Cuisine Tags</TableHead>
              <TableHead className="text-right font-semibold text-card-foreground text-base w-[20%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipes.map((recipe) => (
              <TableRow key={recipe.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleRowClick(recipe.id)}>
                <TableCell className="font-medium text-card-foreground py-3 align-middle">
                  <div className="flex items-center gap-3">
                    <Thumb recipe={recipe} />
                    <span className="hover:underline text-primary">{recipe.title}</span>
                    <KosherBadge category={recipe.kosherCategory} />
                    {recipe.rating ? <StarRating value={recipe.rating} readOnly size={14} /> : null}
                  </div>
                </TableCell>
                <TableCell className="py-3 align-middle">
                  <Tags recipe={recipe} />
                </TableCell>
                <TableCell className="text-right py-3 align-middle whitespace-nowrap">
                  <Actions recipe={recipe} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
