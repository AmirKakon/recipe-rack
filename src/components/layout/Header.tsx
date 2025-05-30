
'use client';

import { Button } from '@/components/ui/button';
import { PlusCircle, Utensils, Lightbulb } from 'lucide-react';

interface HeaderProps {
  onAddRecipeClick: () => void;
  onSuggestRecipeClick?: () => void;
}

export function Header({ onAddRecipeClick, onSuggestRecipeClick }: HeaderProps) {
  return (
    <header className="py-4 px-4 md:px-8 border-b border-border sticky top-0 bg-background/80 backdrop-blur-md z-10">
      <div className="container mx-auto flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <Utensils className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Recipe Rack</h1>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {onSuggestRecipeClick && (
            <Button onClick={onSuggestRecipeClick} variant="outline" size="lg" className="w-full sm:w-auto">
              <Lightbulb className="mr-2 h-5 w-5" />
              Suggest Recipe
            </Button>
          )}
          <Button onClick={onAddRecipeClick} variant="default" size="lg" className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Recipe
          </Button>
        </div>
      </div>
    </header>
  );
}

    