import type { ExtractedProp, PropDef } from 'storybook/internal/docs-tools';

import { createDefaultValue, createDefaultValueFromRawDefaultProp } from '../lib/defaultValues';

export function enhanceTypeScriptProp(extractedProp: ExtractedProp, rawDefaultProp?: any): PropDef {
  const { propDef } = extractedProp;

  const { defaultValue } = extractedProp.docgenInfo;
  if (defaultValue != null && defaultValue.value != null) {
    const newDefaultValue = createDefaultValue(defaultValue.value);
    if (newDefaultValue != null) {
      propDef.defaultValue = newDefaultValue;
    }
  } else if (rawDefaultProp != null) {
    const newDefaultValue = createDefaultValueFromRawDefaultProp(rawDefaultProp, propDef);

    if (newDefaultValue != null) {
      propDef.defaultValue = newDefaultValue;
    }
  }

  return propDef;
}

export function enhanceTypeScriptProps(extractedProps: ExtractedProp[]): PropDef[] {
  return extractedProps.map((prop) => enhanceTypeScriptProp(prop));
}
