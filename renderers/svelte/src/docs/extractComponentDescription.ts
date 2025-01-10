type Component = any;

export function extractComponentDescription(component?: Component): string {
  if (!component) {
    return '';
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { __docgen = {} } = component;
  return __docgen.description;
}
