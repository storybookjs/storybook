// Inspired by Vitest fixture implementation:
// https://github.com/vitest-dev/vitest/blob/200a4349a2f85686bc7005dce686d9d1b48b84d2/packages/runner/src/fixture.ts
import { type PreparedStory, type Renderer } from '@storybook/types';

export function mountDestructured<TRenderer extends Renderer>(
  playFunction: PreparedStory<TRenderer>['playFunction']
) {
  return playFunction && getUsedProps(playFunction).includes('mount');
}
export function getUsedProps(fn: Function) {
  const match = fn.toString().match(/[^(]*\(([^)]*)/);
  if (!match) return [];

  const args = splitByComma(match[1]);
  if (!args.length) return [];

  const first = args[0];
  if (!(first.startsWith('{') && first.endsWith('}'))) return [];

  const props = splitByComma(first.slice(1, -1).replace(/\s/g, '')).map((prop) => {
    return prop.replace(/:.*|=.*/g, '');
  });

  return props;
}

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
      if (token) result.push(token);
      start = i + 1;
    }
  }
  const lastToken = s.substring(start).trim();
  if (lastToken) result.push(lastToken);
  return result;
}
