export type TrainingPhase = 'prep' | 'hold';

export type TrainingRound = {
  round: number;
  prep: number;
  hold: number;
};
