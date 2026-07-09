import { HebrewCalendar } from '@hebcal/core';
import { toDateKey } from '@/lib/week';

export interface HolidayInfo {
  name: string;
  date: string; // YYYY-MM-DD
  daysUntil: number;
  queryHint: string; // themed recipe-suggestion prompt
}

// Cooking-relevant Jewish holidays, keyed by @hebcal/core basename.
const HOLIDAY_HINTS: Record<string, { label: string; hint: string }> = {
  'Rosh Hashana': {
    label: 'Rosh Hashanah',
    hint: 'festive Rosh Hashanah dishes — symbolic foods like apples and honey, honey cake, tzimmes, round challah, and sweet dishes for a sweet new year',
  },
  'Yom Kippur': {
    label: 'Yom Kippur',
    hint: 'a Yom Kippur pre-fast meal and an easy break-fast — comforting, not too salty or spicy',
  },
  Sukkot: {
    label: 'Sukkot',
    hint: 'Sukkot dishes — harvest and stuffed vegetables, hearty comforting food to enjoy in the sukkah',
  },
  'Shmini Atzeret': {
    label: 'Shmini Atzeret',
    hint: 'a festive Shmini Atzeret / Simchat Torah holiday meal',
  },
  'Simchat Torah': {
    label: 'Simchat Torah',
    hint: 'a festive Simchat Torah holiday meal',
  },
  Chanukah: {
    label: 'Hanukkah',
    hint: 'Hanukkah foods — fried treats like latkes (potato pancakes) and sufganiyot (jam doughnuts)',
  },
  'Tu BiShvat': {
    label: 'Tu BiShvat',
    hint: 'Tu BiShvat dishes celebrating fruits, nuts, and dried fruits',
  },
  Purim: {
    label: 'Purim',
    hint: 'Purim treats — hamantaschen and festive sweet and savory bites for mishloach manot',
  },
  Pesach: {
    label: 'Passover',
    hint: 'strictly kosher-for-Passover dishes with NO chametz (no leavened grains, wheat flour, bread, or pasta); matzah-based and naturally grain-free dishes are ideal',
  },
  Shavuot: {
    label: 'Shavuot',
    hint: 'dairy Shavuot dishes — cheesecake, blintzes, quiches and creamy bakes',
  },
};

/** Returns the next upcoming cooking-relevant Jewish holiday within a year, or null. */
export function getUpcomingHoliday(): HolidayInfo | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 365);

  let events;
  try {
    events = HebrewCalendar.calendar({ start: today, end, il: false });
  } catch {
    return null;
  }

  for (const ev of events) {
    const meta = HOLIDAY_HINTS[ev.basename()];
    if (!meta) continue;
    const greg = ev.getDate().greg();
    greg.setHours(0, 0, 0, 0);
    if (greg < today) continue;
    const daysUntil = Math.round((greg.getTime() - today.getTime()) / 86_400_000);
    return { name: meta.label, date: toDateKey(greg), daysUntil, queryHint: meta.hint };
  }
  return null;
}
