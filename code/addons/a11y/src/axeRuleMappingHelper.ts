import { combinedRulesMap } from './AccessibilityRuleMaps';
import type { EnhancedResult } from './types';

export const getTitleForAxeResult = (axeResult: EnhancedResult): string =>
  combinedRulesMap[axeResult.id]?.title || axeResult.id;

export const getFriendlySummaryForAxeResult = (axeResult: EnhancedResult): string | undefined =>
  combinedRulesMap[axeResult.id]?.friendlySummary || axeResult.description;
