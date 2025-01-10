import type { PropDef } from 'storybook/internal/docs-tools';

type Component = any;

// react-docgen doesn't returned the props in the order they were defined in the "propTypes" object of the component.
// This function re-order them by their original definition order.
export function keepOriginalDefinitionOrder(
  extractedProps: PropDef[],
  component: Component
): PropDef[] {
  const { propTypes } = component;

  if (propTypes != null) {
    return Object.keys(propTypes)
      .map((x) => extractedProps.find((y) => y.name === x))
      .filter(Boolean) as PropDef[];
  }

  return extractedProps;
}
