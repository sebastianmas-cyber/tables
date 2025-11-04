export type TrainingPhase = 'prep' | 'hold' | 'recovery' | 'finished';

export type TrainingRound = {
  round: number;
  prep: number;
  hold: number;
  recovery: number;
};
