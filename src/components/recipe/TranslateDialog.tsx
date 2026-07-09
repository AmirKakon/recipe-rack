'use client';

import { useEffect, useState } from 'react';
import type { Recipe } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { translateRecipe, type TranslateRecipeOutput } from '@/ai/flows/translate-recipe-flow.ts';

type Lang = 'Hebrew' | 'English';

const hasHebrew = (s: string) => /[֐-׿]/.test(s);

const normalizeInstructions = (instructions: Recipe['instructions']): string[] =>
  Array.isArray(instructions) ? instructions : typeof instructions === 'string' && instructions ? [instructions] : [];

interface TranslateDialogProps {
  recipe: Recipe;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TranslateDialog({ recipe, open, onOpenChange }: TranslateDialogProps) {
  const { toast } = useToast();
  const defaultTarget: Lang = hasHebrew(`${recipe.title} ${normalizeInstructions(recipe.instructions).join(' ')}`) ? 'English' : 'Hebrew';
  const [target, setTarget] = useState<Lang>(defaultTarget);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslateRecipeOutput | null>(null);

  const run = async (lang: Lang) => {
    setTarget(lang);
    setLoading(true);
    setResult(null);
    try {
      const out = await translateRecipe({
        title: recipe.title,
        ingredients: (recipe.ingredients || []).map((i) => ({ name: i.name, quantity: i.quantity || '' })),
        instructions: normalizeInstructions(recipe.instructions),
        targetLanguage: lang,
      });
      setResult(out);
    } catch (error) {
      console.error('Error translating recipe:', error);
      toast({ title: 'Translation Error', description: error instanceof Error ? error.message : 'Could not translate.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Auto-translate to the sensible default when opened.
  useEffect(() => {
    if (open && !result && !loading) run(defaultTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dir = target === 'Hebrew' ? 'rtl' : 'ltr';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Translate Recipe</DialogTitle>
          <DialogDescription>AI translation — your saved recipe isn&apos;t changed.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button variant={target === 'Hebrew' ? 'default' : 'outline'} size="sm" onClick={() => run('Hebrew')} disabled={loading}>
            עברית
          </Button>
          <Button variant={target === 'English' ? 'default' : 'outline'} size="sm" onClick={() => run('English')} disabled={loading}>
            English
          </Button>
        </div>

        {loading && (
          <p className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Translating…
          </p>
        )}

        {result && !loading && (
          <div dir={dir} className="space-y-4">
            <h3 className="text-xl font-bold text-foreground">{result.title}</h3>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Ingredients</h4>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {result.ingredients.map((ing, i) => (
                  <li key={i}>
                    <span className="text-foreground">{ing.name}</span>
                    {ing.quantity ? `: ${ing.quantity}` : ''}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Instructions</h4>
              <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
                {result.instructions.map((step, i) => (
                  <li key={i} className="leading-relaxed whitespace-pre-wrap">{step}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
