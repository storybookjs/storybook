import {
  createSummaryValue,
  isTooLongForDefaultValueSummary,
  type PropDefaultValue,
} from 'storybook/internal/docs-tools';

import { OBJECT_CAPTION } from '../captions';
import type { InspectionResult, InspectionArray } from '../inspection';
import { generateObjectCode } from '../generateCode';

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
