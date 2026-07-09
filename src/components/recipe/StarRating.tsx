'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: number; // icon size in pixels
  className?: string;
}

/** 1–5 star rating. Interactive when onChange is provided, otherwise read-only. */
export function StarRating({ value, onChange, readOnly = false, size = 20, className }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const interactive = !readOnly && !!onChange;
  const shown = hover || value;

  return (
    <div className={cn('flex items-center gap-0.5', className)} role={interactive ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= shown;
        const StarEl = (
          <Star
            size={size}
            className={cn(filled ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/40')}
          />
        );
        if (!interactive) return <span key={star}>{StarEl}</span>;
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange!(star === value ? 0 : star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="transition-transform hover:scale-110"
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            aria-checked={star === value}
            role="radio"
          >
            {StarEl}
          </button>
        );
      })}
    </div>
  );
}
