import {
  type PropDef,
  TypeSystem,
  extractComponentProps,
  hasDocgen,
} from 'storybook/internal/docs-tools';

import { isMemo } from './docs/lib/componentTypes';
import { enhancePropTypesProps } from './docs/propTypes/handleProp';
import { enhanceTypeScriptProps } from './docs/typeScript/handleProp';

// FIXME
type Component = any;

export interface PropDefMap {
  [p: string]: PropDef;
}

function getPropDefs(component: Component, section: string): PropDef[] {
  let processedComponent = component;

  if (!hasDocgen(component) && !component.propTypes && isMemo(component)) {
    processedComponent = component.type;
  }

  const extractedProps = extractComponentProps(processedComponent, section);
  if (extractedProps.length === 0) {
    return [];
  }

  switch (extractedProps[0].typeSystem) {
    case TypeSystem.JAVASCRIPT:
      return enhancePropTypesProps(extractedProps, component);
    case TypeSystem.TYPESCRIPT:
      return enhanceTypeScriptProps(extractedProps);
    default:
      return extractedProps.map((x) => x.propDef);
  }
}

export const extractProps = (component: Component) => ({
  rows: getPropDefs(component, 'props'),
});
