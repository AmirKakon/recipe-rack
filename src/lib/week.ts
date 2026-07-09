// Week/date helpers for the meal planner. Weeks start on Sunday.

export interface WeekDay {
  date: string; // YYYY-MM-DD
  dayName: string; // e.g. "Sun"
  dayNumber: number; // day of month
  isToday: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const toDateKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Sunday (00:00) of the week `offsetWeeks` away from the current week. */
export const getWeekStart = (offsetWeeks = 0): Date => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - now.getDay() + offsetWeeks * 7);
  return now;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const getWeekDays = (offsetWeeks = 0): WeekDay[] => {
  const start = getWeekStart(offsetWeeks);
  const todayKey = toDateKey(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      date: toDateKey(d),
      dayName: DAY_NAMES[d.getDay()],
      dayNumber: d.getDate(),
      isToday: toDateKey(d) === todayKey,
    };
  });
};

/** A short human label for the week range, e.g. "Jul 6 – Jul 12". */
export const getWeekLabel = (offsetWeeks = 0): string => {
  const start = getWeekStart(offsetWeeks);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
};
