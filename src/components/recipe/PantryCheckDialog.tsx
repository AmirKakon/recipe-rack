'use client';

import { useEffect, useState } from 'react';
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
import { Loader2, Check, ShoppingCart, Sparkles, PackageSearch } from 'lucide-react';
import { getQrganizeInventory, addToQrganizeShoppingList, type InventoryItem } from '@/app/actions/qrganize';
import { suggestIngredientAlternative, type SuggestIngredientAlternativeOutput } from '@/ai/flows/suggest-ingredient-alternative-flow.ts';

interface PantryCheckDialogProps {
  recipe: Recipe;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const norm = (s: string) => (s || '').trim().toLowerCase();

// A recipe ingredient is "on hand" if any inventory name overlaps it.
const isInInventory = (ingredientName: string, inventory: InventoryItem[]): boolean => {
  const ing = norm(ingredientName);
  if (ing.length < 3) return false;
  return inventory.some((inv) => {
    const item = norm(inv.name);
    return item.length >= 3 && (item.includes(ing) || ing.includes(item));
  });
};

interface AltState {
  loading: boolean;
  result?: SuggestIngredientAlternativeOutput;
  added?: boolean;
}

export function PantryCheckDialog({ recipe, open, onOpenChange }: PantryCheckDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [alts, setAlts] = useState<Record<string, AltState>>({});

  useEffect(() => {
    if (!open) return;
    setAlts({});
    setLoading(true);
    setError(null);
    getQrganizeInventory()
      .then((res) => {
        setConfigured(res.configured);
        setInventory(res.data);
        if (res.error) setError(res.error);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load inventory.'))
      .finally(() => setLoading(false));
  }, [open]);

  const ingredientNames = (recipe.ingredients || []).map((i) => i.name).filter((n) => n && n.trim());
  const have = ingredientNames.filter((n) => isInInventory(n, inventory));
  const missing = ingredientNames.filter((n) => !isInInventory(n, inventory));

  const checkAlternative = async (ingredient: string) => {
    setAlts((p) => ({ ...p, [ingredient]: { ...p[ingredient], loading: true } }));
    try {
      const result = await suggestIngredientAlternative({ ingredient, inventory: inventory.map((i) => i.name) });
      setAlts((p) => ({ ...p, [ingredient]: { loading: false, result } }));
    } catch (e) {
      setAlts((p) => ({ ...p, [ingredient]: { loading: false } }));
      toast({ title: 'Could not check alternatives', description: e instanceof Error ? e.message : 'Try again.', variant: 'destructive' });
    }
  };

  const addToShopping = async (ingredient: string) => {
    try {
      const res = await addToQrganizeShoppingList(ingredient);
      if (res.error) throw new Error(res.error);
      setAlts((p) => ({ ...p, [ingredient]: { ...(p[ingredient] || { loading: false }), added: true } }));
      toast({ title: 'Added to QRganize', description: `"${ingredient}" ${res.data.created ? 'created and ' : ''}added to your shopping list.` });
    } catch (e) {
      toast({ title: 'Could not add to shopping list', description: e instanceof Error ? e.message : 'Try again.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5" /> Pantry Check
          </DialogTitle>
          <DialogDescription>What you have vs. what you&apos;re missing, from your QRganize inventory.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking your inventory…</p>
        ) : !configured ? (
          <p className="text-sm text-muted-foreground">
            QRganize isn&apos;t connected. Set <code>QRGANIZE_UUID</code> in the environment to enable pantry checks.
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">On hand ({have.length})</h3>
              {have.length ? (
                <ul className="space-y-1">
                  {have.map((n, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 shrink-0 text-green-600" /> {n}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">None of the ingredients matched your inventory.</p>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Missing ({missing.length})</h3>
              {missing.length ? (
                <ul className="space-y-3">
                  {missing.map((n, i) => {
                    const alt = alts[n];
                    return (
                      <li key={i} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">{n}</span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => checkAlternative(n)} disabled={alt?.loading}>
                              {alt?.loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                              Check for alternative
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => addToShopping(n)} disabled={alt?.added}>
                              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" /> {alt?.added ? 'Added' : 'Shopping list'}
                            </Button>
                          </div>
                        </div>
                        {alt?.result && (
                          <div className="mt-2 space-y-1 text-sm">
                            {alt.result.inStock.length > 0 ? (
                              alt.result.inStock.map((s, j) => (
                                <p key={j} className="text-green-700">
                                  ✅ You have <span className="font-semibold">{s.item}</span>
                                  {s.note ? ` — ${s.note}` : ''}
                                </p>
                              ))
                            ) : (
                              <p className="text-muted-foreground">Nothing in your inventory substitutes this.</p>
                            )}
                            {alt.result.others.length > 0 && (
                              <p className="text-xs text-muted-foreground">Other options: {alt.result.others.join(', ')}</p>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">You have everything! 🎉</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
