export function splitSummary(summary: string): string[] {
  const items: string[] = [];
  const closingDelimiters: string[] = [];
  let quote: string | undefined;
  let start = 0;

  for (let index = 0; index < summary.length; index++) {
    const character = summary[index];

    if (quote) {
      if (character === '\\') {
        index++;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '`') {
      return [summary];
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    const openingIndex = '([{<'.indexOf(character);
    if (openingIndex !== -1) {
      closingDelimiters.push(')]}>'[openingIndex]);
    } else if (character === '>' && summary[index - 1] === '=') {
      if (closingDelimiters.length === 0) {
        return [summary];
      }
    } else if (')]}>'.includes(character)) {
      if (closingDelimiters.pop() !== character) {
        return [summary];
      }
    } else if (character === '|' && closingDelimiters.length === 0) {
      items.push(summary.slice(start, index).trim());
      start = index + 1;
    }
  }

  if (quote || closingDelimiters.length > 0) {
    return [summary];
  }

  items.push(summary.slice(start).trim());
  return items;
}
