import type { ComponentRef } from './getComponentImports.ts';

export function findExactComponentMatch(
  components: ComponentRef[],
  componentName: string | undefined
) {
  if (!componentName) {
    return undefined;
  }

  return components.find((component) => component.componentName === componentName);
}
