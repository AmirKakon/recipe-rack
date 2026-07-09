'use client';

import { useEffect, useState } from 'react';
import { getUpcomingHoliday, type HolidayInfo } from '@/lib/holidays';
import { Button } from '@/components/ui/button';
import { PartyPopper, Sparkles } from 'lucide-react';

interface HolidayBannerProps {
  onGetIdeas: (queryHint: string, holidayName: string) => void;
}

export function HolidayBanner({ onGetIdeas }: HolidayBannerProps) {
  // Computed after mount to avoid SSR/client date hydration mismatches.
  const [holiday, setHoliday] = useState<HolidayInfo | null>(null);
  useEffect(() => {
    setHoliday(getUpcomingHoliday());
  }, []);

  if (!holiday) return null;

  const when =
    holiday.daysUntil === 0 ? 'today' : holiday.daysUntil === 1 ? 'tomorrow' : `in ${holiday.daysUntil} days`;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-3">
        <PartyPopper className="h-6 w-6 shrink-0 text-primary" />
        <p className="text-sm sm:text-base text-foreground">
          <span className="font-semibold">{holiday.name}</span> is {when}. Planning the menu?
        </p>
      </div>
      <Button variant="yellow" onClick={() => onGetIdeas(holiday.queryHint, holiday.name)}>
        <Sparkles className="mr-2 h-4 w-4" />
        {holiday.name} recipe ideas
      </Button>
    </div>
  );
}
