import { formatTime } from '@/lib/utils';
import type { TrainingPhase } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TimerDisplayProps {
  phase: TrainingPhase | 'finished';
  timeRemaining: number;
  currentRound: number;
  totalRounds: number;
}

export function TimerDisplay({
  phase,
  timeRemaining,
  currentRound,
  totalRounds,
}: TimerDisplayProps) {
  const isEnding = timeRemaining <= 3 && timeRemaining > 0;
  const phaseText =
    phase === 'finished'
      ? 'Session Complete'
      : `${phase.charAt(0).toUpperCase() + phase.slice(1)}`;

  return (
    <div className="w-full flex flex-col items-center justify-center p-8 bg-card rounded-lg shadow-2xl border">
      <p className="text-lg sm:text-xl text-muted-foreground">
        {phase !== 'finished'
          ? `Round ${currentRound} / ${totalRounds}`
          : 'Well done!'}
      </p>
      <p className="text-2xl sm:text-3xl font-semibold text-accent capitalize mb-4">
        {phaseText}
      </p>
      <div
        className={cn(
          'text-8xl sm:text-9xl font-mono tabular-nums text-primary transition-all duration-500 ease-in-out',
          isEnding && 'scale-110 text-destructive animate-pulse'
        )}
      >
        {formatTime(timeRemaining)}
      </div>
    </div>
  );
}
