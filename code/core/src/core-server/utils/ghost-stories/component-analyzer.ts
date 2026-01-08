const COMPLEXITY_CONFIG = {
  /** Weight applied to non-empty lines */
  locWeight: 1,
  /** Imports can be cheap, so they get a lower weight */
  importWeight: 0.5,
  /**
   * Defines what raw complexity value should map to the upper bound of a "simple" file For instance
   * 30 LOC + 4 imports = 32. This would result in a score of 0.3
   */
  simpleBaseline: 32,
  simpleScore: 0.3,
};

/**
 * Simple analyzer which gives a score to a component based on its complexity. In the future, it
 * will be replaced with a thorough check that analyzes many complexity factors like auth usage,
 * theming usage, context usage, imports breakdown, etc. but for now this will do.
 */
export const getComponentComplexity = (fileContent: string): number => {
  const lines = fileContent.split('\n');

  const nonEmptyLines = lines.filter((line) => line.trim() !== '').length;

  const importCount = lines.filter((line) => line.trim().startsWith('import')).length;

  const rawComplexity =
    nonEmptyLines * COMPLEXITY_CONFIG.locWeight + importCount * COMPLEXITY_CONFIG.importWeight;

  /** Normalize against the "simple" baseline and what score is considered to be simple. */
  const normalizedScore =
    rawComplexity / (COMPLEXITY_CONFIG.simpleBaseline / COMPLEXITY_CONFIG.simpleScore);

  return Math.min(normalizedScore, 1);
};
