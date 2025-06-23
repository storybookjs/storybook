import {
  type PropDefaultValue,
  createSummaryValue,
  isTooLongForDefaultValueSummary,
} from 'storybook/internal/docs-tools';

import { ARRAY_CAPTION } from '../captions';
import { generateArrayCode } from '../generateCode';
import type { InspectionArray, InspectionResult } from '../inspection';

export function generateArray({ inferredType, ast }: InspectionResult): PropDefaultValue {
  const { depth } = inferredType as InspectionArray;

  if (depth <= 2) {
    const compactArray = generateArrayCode(ast, true);

    if (!isTooLongForDefaultValueSummary(compactArray)) {
      return createSummaryValue(compactArray);
    }
  }

  return createSummaryValue(ARRAY_CAPTION, generateArrayCode(ast));
}
