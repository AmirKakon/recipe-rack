'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Recipe } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ListPlus, Copy, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateShoppingList, type GenerateShoppingListOutput } from '@/ai/flows/generate-shopping-list-flow.ts';

const STORAGE_KEY = 'recipe-rack-shopping-list';

interface StoredList {
  result: GenerateShoppingListOutput;
  checked: Record<string, boolean>;
}

interface ShoppingListDialogProps {
  recipes: Recipe[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const itemKey = (aisle: string, name: string) => `${aisle}::${name}`;

export function ShoppingListDialog({ recipes, open, onOpenChange }: ShoppingListDialogProps) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<'select' | 'list'>('select');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerateShoppingListOutput | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Load any saved list when the dialog opens.
  useEffect(() => {
    if (!open) return;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const stored = JSON.parse(raw) as StoredList;
        if (stored?.result?.groups?.length) {
          setResult(stored.result);
          setChecked(stored.checked || {});
          setPhase('list');
          return;
        }
      }
    } catch {
      /* ignore malformed storage */
    }
    setPhase('select');
  }, [open]);

  const persist = (res: GenerateShoppingListOutput, chk: Record<string, boolean>) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ result: res, checked: chk }));
    } catch {
      /* ignore quota errors */
    }
  };

  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? recipes.filter((r) => r.title.toLowerCase().includes(q)) : recipes;
  }, [recipes, search]);

  const toggleRecipe = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = async () => {
    const chosen = recipes.filter((r) => selectedIds.has(r.id));
    if (chosen.length === 0) {
      toast({ title: 'No recipes selected', description: 'Pick at least one recipe.', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    try {
      const out = await generateShoppingList({
        recipes: chosen.map((r) => ({
          title: r.title,
          ingredients: (r.ingredients || []).map((i) => ({ name: i.name, quantity: i.quantity || '' })),
        })),
      });
      setResult(out);
      setChecked({});
      setPhase('list');
      persist(out, {});
    } catch (error) {
      console.error('Error generating shopping list:', error);
      toast({ title: 'Could not build the list', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleChecked = (key: string) => {
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (result) persist(result, next);
      return next;
    });
  };

  const startNewList = () => {
    setPhase('select');
    setSelectedIds(new Set());
    setResult(null);
    setChecked({});
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const totals = useMemo(() => {
    if (!result) return { total: 0, done: 0 };
    let total = 0;
    let done = 0;
    for (const g of result.groups) {
      for (const it of g.items) {
        total++;
        if (checked[itemKey(g.aisle, it.name)]) done++;
      }
    }
    return { total, done };
  }, [result, checked]);

  const handleCopy = async () => {
    if (!result) return;
    const lines: string[] = [];
    for (const g of result.groups) {
      lines.push(g.aisle);
      for (const it of g.items) lines.push(`  - ${it.name}${it.quantity ? ` (${it.quantity})` : ''}`);
      lines.push('');
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n').trim());
      toast({ title: 'Copied to clipboard' });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Shopping List</DialogTitle>
          <DialogDescription>
            {phase === 'select'
              ? 'Pick the recipes you want to shop for and we’ll build a combined list.'
              : `${totals.done}/${totals.total} items checked off.`}
          </DialogDescription>
        </DialogHeader>

        {phase === 'select' ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter recipes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[45vh] overflow-y-auto rounded-md border divide-y">
              {filteredRecipes.map((r) => (
                <label key={r.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleRecipe(r.id)} />
                  <span className="text-sm">{r.title}</span>
                </label>
              ))}
              {filteredRecipes.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground">No recipes match &quot;{search}&quot;.</p>
              )}
            </div>
            <DialogFooter className="sm:justify-between">
              <span className="text-sm text-muted-foreground self-center">{selectedIds.size} selected</span>
              <Button onClick={handleGenerate} disabled={isGenerating || selectedIds.size === 0}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListPlus className="mr-2 h-4 w-4" />}
                {isGenerating ? 'Building…' : 'Build Shopping List'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-5">
              {result?.groups.map((group) => (
                <div key={group.aisle}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.aisle}</h3>
                  <ul className="space-y-1.5">
                    {group.items.map((item) => {
                      const key = itemKey(group.aisle, item.name);
                      const isChecked = !!checked[key];
                      return (
                        <li key={key}>
                          <label className="flex items-start gap-3 cursor-pointer">
                            <Checkbox checked={isChecked} onCheckedChange={() => toggleChecked(key)} className="mt-1" />
                            <span className={cn('text-sm', isChecked && 'line-through text-muted-foreground')}>
                              <span className="font-medium text-foreground">{item.name}</span>
                              {item.quantity ? ` — ${item.quantity}` : ''}
                              {item.recipes?.length ? (
                                <span className="block text-xs text-muted-foreground">for: {item.recipes.join(', ')}</span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {result && result.groups.length === 0 && (
                <p className="text-sm text-muted-foreground">No items were produced. Try different recipes.</p>
              )}
            </div>
            <DialogFooter className="sm:justify-between gap-2">
              <Button variant="outline" onClick={startNewList}>New list</Button>
              <Button variant="secondary" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
