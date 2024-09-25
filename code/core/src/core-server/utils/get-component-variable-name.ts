/**
 * Get a valid variable name for a component.
 *
 * @param name The name of the component.
 * @returns A valid variable name.
 */
export const getComponentVariableName = async (name: string) => {
  const camelCase = await import('camelcase');
  const camelCased = camelCase.default(name.replace(/^[^a-zA-Z_$]*/, ''), { pascalCase: true });
  const sanitized = camelCased.replace(/[^a-zA-Z_$]+/, '');
  return sanitized;
};
