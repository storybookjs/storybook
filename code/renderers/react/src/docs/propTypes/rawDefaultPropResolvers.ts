import { createSummaryValue } from 'storybook/internal/docs-tools';

import { ELEMENT_CAPTION, FUNCTION_CAPTION } from '../lib';
import type { TypeResolver } from '../lib/defaultValues';
import { createTypeResolvers, extractFunctionName } from '../lib/defaultValues';
import {
  getPrettyElementIdentifier,
  getPrettyFuncIdentifier,
} from '../lib/defaultValues/prettyIdentifier';
import type { InspectionFunction } from '../lib/inspection';
import { inspectValue } from '../lib/inspection';

const funcResolver: TypeResolver = (rawDefaultProp, { name, type }) => {
  const isElement = type?.summary === 'element' || type?.summary === 'elementType';

  const funcName = extractFunctionName(rawDefaultProp, name);
  if (funcName != null) {
    // Try to display the name of the component. The body of the component is omitted since the code has been transpiled.
    if (isElement) {
      return createSummaryValue(getPrettyElementIdentifier(funcName));
    }

    const { hasParams } = inspectValue(rawDefaultProp.toString())
      .inferredType as InspectionFunction;

    return createSummaryValue(getPrettyFuncIdentifier(funcName, hasParams));
  }

  return createSummaryValue(isElement ? ELEMENT_CAPTION : FUNCTION_CAPTION);
};

export const rawDefaultPropTypeResolvers = createTypeResolvers({
  function: funcResolver,
});
