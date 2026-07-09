'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Recipe } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Timer, ListChecks, AlarmClockCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CookModeProps {
  recipe: Recipe;
  onClose: () => void;
}

interface DetectedTimer {
  seconds: number;
  label: string;
}

/** Finds durations mentioned in a step, e.g. "cook 25 minutes", "1 hour", "30 sec". */
const detectTimers = (text: string): DetectedTimer[] => {
  const results: DetectedTimer[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    let seconds = value;
    if (unit.startsWith('h')) seconds = value * 3600;
    else if (unit.startsWith('m')) seconds = value * 60;
    if (seconds > 0) results.push({ seconds: Math.round(seconds), label: `${m[1]} ${m[2]}` });
  }
  // De-duplicate identical durations.
  return results.filter((t, i) => results.findIndex((o) => o.seconds === t.seconds) === i);
};

const formatClock = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const beep = () => {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    // Three short pulses.
    [0.15, 0.35, 0.55].forEach((t) => {
      gain.gain.setValueAtTime(0.15, ctx.currentTime + t);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t + 0.12);
    });
    osc.stop(ctx.currentTime + 0.75);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    /* audio not available — ignore */
  }
};

export function CookMode({ recipe, onClose }: CookModeProps) {
  const steps = useMemo(
    () =>
      (Array.isArray(recipe.instructions)
        ? recipe.instructions
        : typeof recipe.instructions === 'string'
        ? [recipe.instructions]
        : []
      ).filter((s) => s && s.trim()),
    [recipe.instructions]
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [timerDone, setTimerDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback((seconds: number) => {
    clearTimer();
    setTimerDone(false);
    setRemaining(seconds);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearTimer();
          setTimerDone(true);
          beep();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer]);

  const goTo = useCallback(
    (next: number) => {
      setStepIndex((prev) => Math.min(Math.max(next, 0), Math.max(steps.length - 1, 0)));
    },
    [steps.length]
  );

  // Keep the screen awake while cooking.
  useEffect(() => {
    let sentinel: any = null;
    let released = false;
    const request = async () => {
      try {
        sentinel = await (navigator as any).wakeLock?.request('screen');
      } catch {
        /* wake lock unsupported or denied — ignore */
      }
    };
    request();
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !released) request();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release?.().catch(() => {});
    };
  }, []);

  // Clean up any running timer on unmount.
  useEffect(() => clearTimer, [clearTimer]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goTo(stepIndex + 1);
      else if (e.key === 'ArrowLeft') goTo(stepIndex - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepIndex, goTo, onClose]);

  const currentStep = steps[stepIndex] ?? '';
  const timers = useMemo(() => detectTimers(currentStep), [currentStep]);
  const progress = steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Cook Mode</p>
          <h2 className="truncate text-lg font-semibold text-foreground">{recipe.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowIngredients((v) => !v)}>
            <ListChecks className="mr-2 h-4 w-4" />
            Ingredients
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Exit cook mode">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Body */}
      <div className="relative flex flex-1 flex-col overflow-y-auto">
        {showIngredients && (
          <div className="border-b border-border bg-secondary/30 px-4 py-4 sm:px-6">
            <h3 className="mb-2 text-lg font-semibold text-foreground">Ingredients</h3>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              {recipe.ingredients.map((ing) => (
                <li key={ing.id}>
                  <span className="font-medium text-foreground">{ing.name}</span>
                  {ing.quantity ? `: ${ing.quantity}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          {steps.length === 0 ? (
            <p className="text-xl text-muted-foreground">This recipe has no instructions to cook through.</p>
          ) : (
            <>
              <p className="mb-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Step {stepIndex + 1} of {steps.length}
              </p>
              <p className="max-w-3xl text-2xl leading-relaxed text-foreground sm:text-3xl">{currentStep}</p>

              {timers.length > 0 && (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  {timers.map((t, i) => (
                    <Button key={i} variant="secondary" size="lg" onClick={() => startTimer(t.seconds)}>
                      <Timer className="mr-2 h-5 w-5" />
                      Start {t.label} timer
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Active timer */}
        {remaining !== null && (
          <div
            className={cn(
              'sticky bottom-0 flex items-center justify-center gap-4 border-t border-border px-4 py-4 sm:px-6',
              timerDone ? 'bg-primary text-primary-foreground' : 'bg-card'
            )}
          >
            {timerDone ? (
              <span className="flex items-center gap-2 text-2xl font-bold">
                <AlarmClockCheck className="h-7 w-7" /> Time&apos;s up!
              </span>
            ) : (
              <span className="flex items-center gap-2 text-3xl font-bold tabular-nums text-foreground">
                <Timer className="h-6 w-6 text-primary" /> {formatClock(remaining)}
              </span>
            )}
            <Button
              variant={timerDone ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => {
                clearTimer();
                setRemaining(null);
                setTimerDone(false);
              }}
            >
              Dismiss
            </Button>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6">
        <Button variant="outline" size="lg" onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0}>
          <ChevronLeft className="mr-2 h-5 w-5" />
          Previous
        </Button>
        {stepIndex < steps.length - 1 ? (
          <Button size="lg" onClick={() => goTo(stepIndex + 1)}>
            Next
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        ) : (
          <Button size="lg" onClick={onClose}>
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
