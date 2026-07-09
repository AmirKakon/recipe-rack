'use client';

import { useMemo, useState } from 'react';
import type { Recipe } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { KosherBadge } from '@/components/recipe/KosherBadge';
import { Search } from 'lucide-react';

interface RecipePickerDialogProps {
  recipes: Recipe[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (recipe: Recipe) => void;
  title?: string;
}

/** A searchable single-select list of recipes. */
export function RecipePickerDialog({ recipes, open, onOpenChange, onPick, title }: RecipePickerDialogProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? recipes.filter((r) => r.title.toLowerCase().includes(q)) : recipes;
  }, [recipes, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title || 'Add a recipe'}</DialogTitle>
          <DialogDescription>Choose a recipe to add to this slot.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search recipes…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" autoFocus />
        </div>
        <div className="mt-2 flex-1 overflow-y-auto rounded-md border divide-y">
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { onPick(r); onOpenChange(false); setSearch(''); }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
            >
              <span>{r.title}</span>
              <KosherBadge category={r.kosherCategory} />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">No recipes match &quot;{search}&quot;.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
