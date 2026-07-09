import type { KosherCategory } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { getKosherMeta } from '@/lib/kosher';
import { cn } from '@/lib/utils';

interface KosherBadgeProps {
  category?: KosherCategory;
  className?: string;
}

/** Colored badge for a recipe's kosher classification (meat / dairy / pareve). */
export function KosherBadge({ category, className }: KosherBadgeProps) {
  const meta = getKosherMeta(category);
  if (!meta) return null;

  return (
    <Badge variant="outline" className={cn(meta.badgeClass, className)} title={meta.description}>
      {meta.label}
    </Badge>
  );
}
