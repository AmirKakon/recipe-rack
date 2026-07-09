'use client';

import { useState } from 'react';
import type { Recipe } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight } from 'lucide-react';
import { suggestSubstitutions, type SuggestSubstitutionsOutput } from '@/ai/flows/suggest-substitutions-flow.ts';

type Goal = 'pareve' | 'dairy-free' | 'meat-free';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'pareve', label: 'Make Pareve' },
  { value: 'dairy-free', label: 'Dairy-free' },
  { value: 'meat-free', label: 'Meat-free' },
];

interface KosherSwapDialogProps {
  recipe: Recipe;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KosherSwapDialog({ recipe, open, onOpenChange }: KosherSwapDialogProps) {
  const { toast } = useToast();
  const [loadingGoal, setLoadingGoal] = useState<Goal | null>(null);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [result, setResult] = useState<SuggestSubstitutionsOutput | null>(null);

  const run = async (goal: Goal) => {
    setLoadingGoal(goal);
    setActiveGoal(goal);
    setResult(null);
    try {
      const ingredients = recipe.ingredients
        .map((i) => (i.quantity ? `${i.name} (${i.quantity})` : i.name))
        .join('\n');
      const out = await suggestSubstitutions({ title: recipe.title, ingredients, goal });
      setResult(out);
    } catch (error) {
      console.error('Error getting substitutions:', error);
      toast({
        title: 'Substitution Error',
        description: error instanceof Error ? error.message : 'Could not get substitutions.',
        variant: 'destructive',
      });
    } finally {
      setLoadingGoal(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Kosher Swaps</DialogTitle>
          <DialogDescription>
            Get AI ingredient substitutions to make &quot;{recipe.title}&quot; fit a dietary goal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 py-2">
          {GOALS.map((g) => (
            <Button
              key={g.value}
              type="button"
              variant={activeGoal === g.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => run(g.value)}
              disabled={loadingGoal !== null}
            >
              {loadingGoal === g.value && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {g.label}
            </Button>
          ))}
        </div>

        {loadingGoal && (
          <p className="text-sm text-muted-foreground">Finding kosher-friendly swaps…</p>
        )}

        {result && !loadingGoal && (
          <div className="space-y-3">
            <p className="text-sm italic text-muted-foreground bg-accent/10 p-3 rounded-md">{result.summary}</p>
            {result.substitutions.length > 0 && (
              <ul className="space-y-3">
                {result.substitutions.map((s, i) => (
                  <li key={i} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-foreground line-through decoration-destructive/60">{s.ingredient}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-primary">{s.substitute}</span>
                    </div>
                    {s.note && <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Suggestions only — review before cooking. Your saved recipe isn&apos;t changed.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
