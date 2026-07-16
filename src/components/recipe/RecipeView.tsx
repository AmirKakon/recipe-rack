
'use client';

import { useState } from 'react';
import type { Recipe } from '@/lib/types';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { KosherBadge } from '@/components/recipe/KosherBadge';
import { KosherSwapDialog } from '@/components/recipe/KosherSwapDialog';
import { TranslateDialog } from '@/components/recipe/TranslateDialog';
import { PantryCheckDialog } from '@/components/recipe/PantryCheckDialog';
import { StarRating } from '@/components/recipe/StarRating';
import { useToast } from '@/hooks/use-toast';
import { scaleQuantity, SCALE_FACTORS } from '@/lib/scale';
import { detectKosherConflict } from '@/lib/kosher';
import { estimateNutrition } from '@/ai/flows/estimate-nutrition-flow.ts';
import { Clock, UtensilsIcon, Users, AlertTriangle, Replace, Loader2, Languages, Activity, PackageSearch } from 'lucide-react'; // Added icons

const API_BASE_URL = 'https://us-central1-recipe-rack-ighp8.cloudfunctions.net/app';

interface RecipeViewProps {
  recipe: Recipe;
}

export function RecipeView({ recipe }: RecipeViewProps) {
  const [scale, setScale] = useState(1);
  const [swapOpen, setSwapOpen] = useState(false);
  const [pantryOpen, setPantryOpen] = useState(false);

  const conflict = detectKosherConflict(recipe.ingredients || []);

  const instructionsArray = Array.isArray(recipe.instructions)
    ? recipe.instructions
    : typeof recipe.instructions === 'string' && recipe.instructions.trim() !== ''
    ? [recipe.instructions]
    : [];

  const { toast } = useToast();
  const [rating, setRating] = useState(recipe.rating ?? 0);
  const [notes, setNotes] = useState(recipe.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [nutrition, setNutrition] = useState(recipe.nutrition);
  const [estimatingNutrition, setEstimatingNutrition] = useState(false);

  // Persist a partial change by re-sending the full recipe (the update endpoint
  // validates title/ingredients/instructions and only changes provided fields).
  const persist = async (overrides: Partial<Recipe>) => {
    const payload = {
      title: recipe.title,
      ingredients: recipe.ingredients || [],
      instructions: instructionsArray,
      cuisines: recipe.cuisines || [],
      prepTime: recipe.prepTime || '',
      cookTime: recipe.cookTime || '',
      servingSize: recipe.servingSize || '',
      kosherCategory: recipe.kosherCategory,
      isFavorite: recipe.isFavorite,
      createdAt: recipe.createdAt,
      imageUrl: recipe.imageUrl,
      rating,
      notes,
      nutrition,
      ...overrides,
    };
    const res = await fetch(`${API_BASE_URL}/api/recipes/update/${recipe.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Update failed: ${res.statusText}`);
    await res.json();
  };

  const handleRate = async (value: number) => {
    const prev = rating;
    setRating(value); // optimistic
    try {
      await persist({ rating: value });
    } catch (error) {
      setRating(prev);
      toast({ title: 'Could not save rating', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await persist({ notes });
      toast({ title: 'Notes saved' });
    } catch (error) {
      toast({ title: 'Could not save notes', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleEstimateNutrition = async () => {
    setEstimatingNutrition(true);
    try {
      const ingredients = (recipe.ingredients || [])
        .map((i) => (i.quantity ? `${i.name} (${i.quantity})` : i.name))
        .join('\n');
      const result = await estimateNutrition({ title: recipe.title, ingredients, servingSize: recipe.servingSize });
      setNutrition(result);
      await persist({ nutrition: result });
      toast({ title: 'Nutrition estimated' });
    } catch (error) {
      toast({ title: 'Could not estimate nutrition', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setEstimatingNutrition(false);
    }
  };

  return (
    <div className="bg-card p-6 sm:p-8 rounded-lg shadow-xl">
      {recipe.imageUrl && (
        <div className="relative w-full aspect-video mb-6 rounded-lg overflow-hidden border border-border">
          <Image
            src={recipe.imageUrl}
            alt={recipe.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start mb-6 pb-6 border-b border-border gap-3">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-2 sm:mb-0">
          {recipe.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <KosherBadge category={recipe.kosherCategory} className="text-sm px-3 py-1" />
          <Button variant="outline" size="sm" onClick={() => setSwapOpen(true)} className="print:hidden">
            <Replace className="mr-2 h-4 w-4" />
            Kosher Swaps
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTranslateOpen(true)} className="print:hidden">
            <Languages className="mr-2 h-4 w-4" />
            Translate
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPantryOpen(true)} className="print:hidden">
            <PackageSearch className="mr-2 h-4 w-4" />
            Pantry Check
          </Button>
        </div>
      </div>

      {conflict.hasConflict && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">This recipe mixes meat and dairy</p>
            <p className="text-muted-foreground mt-1">
              Contains meat ({conflict.meatItems.join(', ')}) and dairy ({conflict.dairyItems.join(', ')}), which isn&apos;t kosher.
              Use <span className="font-medium">Kosher Swaps</span> to make it dairy-free or meat-free.
            </p>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pb-8 border-b border-border">
        {recipe.prepTime && (
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Prep Time</p>
              <p className="font-semibold text-foreground">{recipe.prepTime}</p>
            </div>
          </div>
        )}
        {recipe.cookTime && (
          <div className="flex items-center space-x-2">
            <UtensilsIcon className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Cook Time</p>
              <p className="font-semibold text-foreground">{recipe.cookTime}</p>
            </div>
          </div>
        )}
        {recipe.servingSize && (
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Serving Size</p>
              <p className="font-semibold text-foreground">{recipe.servingSize}</p>
            </div>
          </div>
        )}
      </div>

      {recipe.cuisines && recipe.cuisines.length > 0 && (
        <div className="mb-8 pb-8 border-b border-border">
          <h2 className="text-xl font-semibold mb-3 text-foreground">Cuisine Tags:</h2>
          <div className="flex flex-wrap gap-2">
            {recipe.cuisines.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-sm px-3 py-1">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {(!recipe.cuisines || recipe.cuisines.length === 0) && (!recipe.prepTime && !recipe.cookTime && !recipe.servingSize) && (
         // Only render an empty border bottom if neither cuisines nor time/servings are present
         <div className="mb-8 pb-8 border-b border-border"></div>
      )}


      <div className={`mb-8 pb-8 border-b border-border ${!nutrition ? 'print:hidden' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xl font-semibold text-foreground">
            Nutrition <span className="text-sm font-normal text-muted-foreground">(estimated, per serving)</span>
          </h2>
          <Button variant="outline" size="sm" onClick={handleEstimateNutrition} disabled={estimatingNutrition} className="print:hidden">
            {estimatingNutrition ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
            {nutrition ? 'Re-estimate' : 'Estimate'}
          </Button>
        </div>
        {nutrition ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Calories', value: nutrition.calories },
              { label: 'Protein', value: nutrition.protein },
              { label: 'Carbs', value: nutrition.carbs },
              { label: 'Fat', value: nutrition.fat },
            ].map((m) => (
              <div key={m.label} className="rounded-md border bg-secondary/30 p-3 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</p>
                <p className="font-semibold text-foreground">{m.value || '—'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground print:hidden">No estimate yet — tap Estimate for a rough per-serving breakdown.</p>
        )}
      </div>

      <div className="mb-8 pb-8 border-b border-border space-y-5 print:hidden">
        <div>
          <h2 className="text-xl font-semibold mb-2 text-foreground">Your Rating</h2>
          <StarRating value={rating} onChange={handleRate} size={28} />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2 text-foreground">Cooking Notes</h2>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Family notes — e.g. 'the kids loved it', 'used less salt', 'doubled the sauce'…"
            className="text-base"
          />
          <Button
            size="sm"
            className="mt-2"
            onClick={handleSaveNotes}
            disabled={savingNotes || notes === (recipe.notes ?? '')}
          >
            {savingNotes && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Notes
          </Button>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-2xl font-semibold text-foreground">Ingredients:</h2>
          <div className="flex items-center gap-1 print:hidden">
            <span className="text-sm text-muted-foreground mr-1">Scale:</span>
            {SCALE_FACTORS.map((f) => (
              <Button
                key={f.value}
                type="button"
                size="sm"
                variant={scale === f.value ? 'default' : 'outline'}
                onClick={() => setScale(f.value)}
                aria-pressed={scale === f.value}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
        {recipe.ingredients && recipe.ingredients.length > 0 ? (
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient.id} className="text-base">
                <span className="font-medium text-foreground">{ingredient.name}</span>: {scaleQuantity(ingredient.quantity, scale)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No ingredients listed.</p>
        )}
        {scale !== 1 && (
          <p className="mt-2 text-sm text-muted-foreground italic print:hidden">
            Quantities scaled {SCALE_FACTORS.find((f) => f.value === scale)?.label} from the original.
          </p>
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

      <KosherSwapDialog recipe={recipe} open={swapOpen} onOpenChange={setSwapOpen} />
      <TranslateDialog recipe={recipe} open={translateOpen} onOpenChange={setTranslateOpen} />
      <PantryCheckDialog recipe={recipe} open={pantryOpen} onOpenChange={setPantryOpen} />
    </div>
  );
}

