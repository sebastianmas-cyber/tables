import type { TrainingRound } from './types';

const NUM_ROUNDS = 8;

/**
 * Generates a CO2 tolerance table.
 * Constant hold time, decreasing recovery time.
 * @param personalBestInSeconds The user's personal best breath-hold time in seconds.
 * @returns An array of training rounds.
 */
export function generateCo2Table(personalBestInSeconds: number): TrainingRound[] {
  const table: TrainingRound[] = [];
  // Use a slightly lower percentage for more accessible tables.
  const holdTime = Math.max(30, Math.round(personalBestInSeconds * 0.60));
  // Start with a longer recovery and decrease it.
  const startPrepTime = holdTime + 75;
  const decreaseStep = 15;

  for (let i = 1; i <= NUM_ROUNDS; i++) {
    const prepTime = Math.max(30, startPrepTime - ((i-1) * decreaseStep));
    table.push({
      round: i,
      prep: prepTime,
      hold: holdTime,
    });
  }

  return table;
}

/**
 * Generates an O2 tolerance table.
 * Increasing hold time, constant recovery time.
 * @param personalBestInSeconds The user's personal best breath-hold time in seconds.
 * @returns An array of training rounds.
 */
export function generateO2Table(personalBestInSeconds: number): TrainingRound[] {
  const table: TrainingRound[] = [];
  const startHoldTime = Math.max(45, Math.round(personalBestInSeconds * 0.5));
  const recoveryTime = 120; // 2 minutes
  const holdIncrement = 10;

  for (let i = 1; i <= NUM_ROUNDS; i++) {
    table.push({
      round: i,
      prep: recoveryTime,
      hold: startHoldTime + ((i-1) * holdIncrement),
    });
  }
  
  return table;
}
