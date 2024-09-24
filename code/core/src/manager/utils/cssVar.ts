export function cssVar(cssVariable: string, defaultValue?: string): string {
  const cssVariableRegex = /--[\S]*/g;
  if (!cssVariable || !cssVariable.match(cssVariableRegex)) {
    return null;
  }

  let variableValue;

  if (typeof document !== 'undefined' && document.documentElement !== null) {
    variableValue = getComputedStyle(document.documentElement).getPropertyValue(cssVariable);
  }

  if (variableValue) {
    return variableValue.trim();
  } else if (defaultValue) {
    return defaultValue;
  }

  return null;
}
