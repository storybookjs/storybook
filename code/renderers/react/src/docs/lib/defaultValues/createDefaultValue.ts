import {
  createSummaryValue,
  isTooLongForDefaultValueSummary,
  type PropDefaultValue,
} from 'storybook/internal/docs-tools';

import { FUNCTION_CAPTION, ELEMENT_CAPTION } from '../captions';
import type {
  InspectionFunction,
  InspectionResult,
  InspectionElement,
  InspectionIdentifiableInferedType,
} from '../inspection';
import { InspectionType, inspectValue } from '../inspection';
import { isHtmlTag } from '../isHtmlTag';
import { generateCode } from '../generateCode';
import { generateObject } from './generateObject';
import { generateArray } from './generateArray';
import { getPrettyIdentifier } from './prettyIdentifier';

function generateFunc({ inferredType, ast }: InspectionResult): PropDefaultValue {
  const { identifier } = inferredType as InspectionFunction;

  if (identifier != null) {
    return createSummaryValue(
      getPrettyIdentifier(inferredType as InspectionIdentifiableInferedType),
      generateCode(ast)
    );
  }

  const prettyCaption = generateCode(ast, true);

  return !isTooLongForDefaultValueSummary(prettyCaption)
    ? createSummaryValue(prettyCaption)
    : createSummaryValue(FUNCTION_CAPTION, generateCode(ast));
}

// All elements are JSX elements.
// JSX elements are not supported by escodegen.
function generateElement(
  defaultValue: string,
  inspectionResult: InspectionResult
): PropDefaultValue {
  const { inferredType } = inspectionResult;
  const { identifier } = inferredType as InspectionElement;

  if (identifier != null) {
    if (!isHtmlTag(identifier)) {
      const prettyIdentifier = getPrettyIdentifier(
        inferredType as InspectionIdentifiableInferedType
      );

      return createSummaryValue(prettyIdentifier, defaultValue);
    }
  }

  return !isTooLongForDefaultValueSummary(defaultValue)
    ? createSummaryValue(defaultValue)
    : createSummaryValue(ELEMENT_CAPTION, defaultValue);
}

export function createDefaultValue(defaultValue: string): PropDefaultValue | null {
  try {
    const inspectionResult = inspectValue(defaultValue);

    switch (inspectionResult.inferredType.type) {
      case InspectionType.OBJECT:
        return generateObject(inspectionResult);
      case InspectionType.FUNCTION:
        return generateFunc(inspectionResult);
      case InspectionType.ELEMENT:
        return generateElement(defaultValue, inspectionResult);
      case InspectionType.ARRAY:
        return generateArray(inspectionResult);
      default:
        return null;
    }
  } catch (e) {
    console.error(e);
  }

  return null;
}
