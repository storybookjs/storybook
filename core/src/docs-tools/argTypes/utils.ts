import type { PropSummaryValue } from './docgen';

export const MAX_TYPE_SUMMARY_LENGTH = 90;
export const MAX_DEFAULT_VALUE_SUMMARY_LENGTH = 50;

export function isTooLongForTypeSummary(value: string): boolean {
  return value.length > MAX_TYPE_SUMMARY_LENGTH;
}

export function isTooLongForDefaultValueSummary(value: string): boolean {
  return value.length > MAX_DEFAULT_VALUE_SUMMARY_LENGTH;
}

export function createSummaryValue(summary?: string, detail?: string): PropSummaryValue {
  if (summary === detail) {
    return { summary };
  }
  return { summary, detail };
}

export const normalizeNewlines = (string: string) => string.replace(/\\r\\n/g, '\\n');
