import { uniq } from 'es-toolkit/array';

const DELIMITERS = new Map([
  ['(', ')'],
  ['[', ']'],
  ['{', '}'],
  ['<', '>'],
]);

export const getSummaryItems = (summary: string) => {
  if (!summary) {
    return [summary];
  }

  const summaryItems: string[] = [];
  const closingDelimiters: string[] = [];
  let itemStart = 0;
  let quote: '"' | "'" | '`' | undefined;
  let isEscaped = false;

  for (let index = 0; index < summary.length; index += 1) {
    const character = summary[index];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (character === '\\') {
      isEscaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }

    const closingDelimiter = DELIMITERS.get(character);
    if (closingDelimiter) {
      closingDelimiters.push(closingDelimiter);
      continue;
    }

    if (character === '?' && closingDelimiters.length === 0) {
      return [summary];
    }

    if (character === '>' && summary[index - 1] === '=') {
      if (closingDelimiters.length === 0) {
        return [summary];
      }
      continue;
    }

    if (character === ')' || character === ']' || character === '}' || character === '>') {
      if (closingDelimiters.at(-1) !== character) {
        return [summary];
      }
      closingDelimiters.pop();
      continue;
    }

    if (
      character === '|' &&
      closingDelimiters.length === 0 &&
      summary[index - 1] !== '|' &&
      summary[index + 1] !== '|'
    ) {
      summaryItems.push(summary.slice(itemStart, index).trim());
      itemStart = index + 1;
    }
  }

  if (quote || closingDelimiters.length > 0) {
    return [summary];
  }

  summaryItems.push(summary.slice(itemStart).trim());

  return uniq(summaryItems);
};
