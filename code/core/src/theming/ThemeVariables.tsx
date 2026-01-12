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
    if (typeof value === 'number' && !/(animation|opacity|weight)/.test(name)) {
      rule += 'px';
    }
    return acc.concat(rule);
  }, []);

export const ThemeVariables = React.memo(function ThemeVariables() {
  const { animation, code, ...theme } = useTheme();
  const variables = getVariables(theme);

  return (
    <Global
      styles={css`
        :root {
          ${variables.join(';\n')}
        }
      `}
    />
  );
});
