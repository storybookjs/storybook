import {
  type PropDefaultValue,
  createSummaryValue,
  isTooLongForDefaultValueSummary,
} from 'storybook/internal/docs-tools';

import { OBJECT_CAPTION } from '../captions';
import { generateObjectCode } from '../generateCode';
import type { InspectionArray, InspectionResult } from '../inspection';

export function generateObject({ inferredType, ast }: InspectionResult): PropDefaultValue {
  const { depth } = inferredType as InspectionArray;

  if (depth === 1) {
    const compactObject = generateObjectCode(ast, true);

    if (!isTooLongForDefaultValueSummary(compactObject)) {
      return createSummaryValue(compactObject);
    }
  }

  return createSummaryValue(OBJECT_CAPTION, generateObjectCode(ast));
}
