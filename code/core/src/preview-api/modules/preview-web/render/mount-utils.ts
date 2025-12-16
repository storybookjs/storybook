// Inspired by Vitest fixture implementation:
// https://github.com/vitest-dev/vitest/blob/200a4349a2f85686bc7005dce686d9d1b48b84d2/packages/runner/src/fixture.ts
export function mountDestructured(playFunction?: (...args: any[]) => any): boolean {
  return playFunction != null && getUsedProps(playFunction).includes('mount');
}

/**
 * Extracts a list of properties destructured from the argument of a play function, either inline or
 * as the first statement in the body of the function.
 *
 * @param fn - The function to extract the properties from.
 * @returns An array of property names.
 */
export function getUsedProps(fn: (...args: unknown[]) => unknown) {
  const [, args, body] = fn.toString().match(/[^(]*\(([^)]+)\)(?:.*{([^]+)})?/) || [];
  if (!args) {
    return [];
  }

  const [firstArg] = splitByComma(args);
  if (!firstArg) {
    return [];
  }

  const [, destructuredProps] = firstArg.match(/^{([^]+)}$/) || [];
  if (destructuredProps) {
    return splitByComma(destructuredProps).map((prop) => prop.replace(/:.*|=.*/g, ''));
  }

  if (!firstArg.match(/^[^a-z_]|[^0-9a-z_]$/i)) {
    return [];
  }

  const [, destructuredArg] =
    body?.trim()?.match(new RegExp(`^(?:const|let|var)\\s*{([^}]+)}\\s*=\\s*${firstArg};`)) || [];
  if (destructuredArg) {
    return splitByComma(destructuredArg).map((prop) => prop.replace(/:.*|=.*/g, ''));
  }

  return [];
}

/**
 * Splits a string by top-level commas, ignoring commas nested within curly or square brackets.
 *
 * This is useful for parsing function argument lists or destructured object patterns where elements
 * inside nested structures (like { a, b: [x, y], c }) should not be split.
 *
 * @param s - The string to split.
 * @returns An array of substrings split by top-level commas.
 */
function splitByComma(s: string) {
  const result = [];
  const stack = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{' || s[i] === '[') {
      stack.push(s[i] === '{' ? '}' : ']');
    } else if (s[i] === stack[stack.length - 1]) {
      stack.pop();
    } else if (!stack.length && s[i] === ',') {
      const token = s.substring(start, i).trim();

      if (token) {
        result.push(token);
      }
      start = i + 1;
    }
  }
  const lastToken = s.substring(start).trim();

  if (lastToken) {
    result.push(lastToken);
  }
  return result;
}
