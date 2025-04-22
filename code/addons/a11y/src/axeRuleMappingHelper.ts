import { combinedRulesMap } from './AccessibilityRuleMaps';

export const getTitleForAxeId = (axeId: string): string => combinedRulesMap[axeId]?.title || axeId;

export const getFriendlySummaryForAxeId = (axeId: string): string | undefined =>
  combinedRulesMap[axeId]?.friendlySummary;
