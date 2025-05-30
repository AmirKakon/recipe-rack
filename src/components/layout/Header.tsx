
'use client';

import { Button } from '@/components/ui/button';
import { PlusCircle, Utensils, Lightbulb } from 'lucide-react';

interface HeaderProps {
  onAddRecipeClick: () => void;
  onSuggestRecipeClick?: () => void;
}

export function Header({ onAddRecipeClick, onSuggestRecipeClick }: HeaderProps) {
  return (
    <header className="py-6 px-4 md:px-8 border-b border-border sticky top-0 bg-background/80 backdrop-blur-md z-10">
      <div className="container mx-auto flex justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <Utensils className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Recipe Rack</h1>
        </div>
        <div className="flex items-center gap-2">
          {onSuggestRecipeClick && (
            <Button onClick={onSuggestRecipeClick} variant="outline" size="lg">
              <Lightbulb className="mr-2 h-5 w-5" />
              Suggest Recipe
            </Button>
          )}
          <Button onClick={onAddRecipeClick} variant="default" size="lg">
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Recipe
          </Button>
        </div>
      </div>
    </header>
  );
}

    