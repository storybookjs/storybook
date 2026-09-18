import type { ExtractedProp, PropDef } from 'storybook/internal/docs-tools';

import { createDefaultValue, createDefaultValueFromRawDefaultProp } from '../lib/defaultValues';
import { createType } from './createType';
import { rawDefaultPropTypeResolvers } from './rawDefaultPropResolvers';
import { keepOriginalDefinitionOrder } from './sortProps';

type Component = any;

export function enhancePropTypesProp(extractedProp: ExtractedProp, rawDefaultProp?: any): PropDef {
  const { propDef } = extractedProp;

  const newtype = createType(extractedProp);
  if (newtype != null) {
    propDef.type = newtype;
  }

  const { defaultValue } = extractedProp.docgenInfo;
  if (defaultValue != null && defaultValue.value != null) {
    const newDefaultValue = createDefaultValue(defaultValue.value);

    if (newDefaultValue != null) {
      propDef.defaultValue = newDefaultValue;
    }
  } else if (rawDefaultProp != null) {
    const newDefaultValue = createDefaultValueFromRawDefaultProp(
      rawDefaultProp,
      propDef,
      rawDefaultPropTypeResolvers
    );

    if (newDefaultValue != null) {
      propDef.defaultValue = newDefaultValue;
    }
  }

  return propDef;
}

export function enhancePropTypesProps(
  extractedProps: ExtractedProp[],
  component: Component
): PropDef[] {
  const rawDefaultProps = component.defaultProps != null ? component.defaultProps : {};
  const enhancedProps = extractedProps.map((x) =>
    enhancePropTypesProp(x, rawDefaultProps[x.propDef.name])
  );

  return keepOriginalDefinitionOrder(enhancedProps, component);
}
