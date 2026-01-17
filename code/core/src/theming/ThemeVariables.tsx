import React from 'react';

import { Global, css, useTheme } from '.';

// Recursively get all the variables from the theme (drilling down into nested objects), return an array of strings.
const getVariables = (theme: object, prefix = '--sb'): string[] =>
  Object.entries(theme).reduce<string[]>((acc, [key, value]) => {
    if (value === undefined || typeof value === 'function') {
      return acc;
    }

    const name = `${prefix}-${key}`;
    if (typeof value === 'object') {
      return acc.concat(getVariables(value, name));
    }

    let rule = `${name}: ${value}`;
    if (typeof value === 'number' && !/(opacity|weight)/.test(name)) {
      rule += 'px';
    }
    return acc.concat(`${rule};`);
  }, []);

export const ThemeVariables = React.memo(function ThemeVariables({
  rootSelector = ':root',
}: {
  rootSelector?: string;
}) {
  const { animation, base, code, ...theme } = useTheme();
  const variables = getVariables(theme).join('\n');

  return (
    <Global
      styles={css`
        ${rootSelector} {
          ${variables}
        }
      `}
    />
  );
});
