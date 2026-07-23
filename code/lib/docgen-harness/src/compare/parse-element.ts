/** Framework-neutral scanning for a snippet's root element and its attribute names. */

export function parseRootElement(
  block: string
): { attrText: string; childContent: string | undefined } | undefined {
  const openStart = block.search(/<[A-Za-z]/);
  if (openStart === -1) {
    return undefined;
  }
  const nameMatch = /^<([\w-]+)/.exec(block.slice(openStart));
  if (nameMatch === null) {
    return undefined;
  }
  let i = openStart + nameMatch[0].length;
  let quote: string | undefined;
  while (i < block.length && (quote !== undefined || block[i] !== '>')) {
    if (quote !== undefined) {
      if (block[i] === quote) {
        quote = undefined;
      }
    } else if (block[i] === '"' || block[i] === "'") {
      quote = block[i];
    }
    i += 1;
  }
  if (i >= block.length) {
    return undefined;
  }
  const selfClosing = block[i - 1] === '/';
  const attrText = block.slice(openStart + nameMatch[0].length, selfClosing ? i - 1 : i);
  if (selfClosing) {
    return { attrText, childContent: undefined };
  }
  const closeIndex = block.lastIndexOf(`</${nameMatch[1]}>`);
  return { attrText, childContent: closeIndex > i ? block.slice(i + 1, closeIndex) : undefined };
}

/**
 * Splits an open tag's attribute text into raw attribute names, skipping single- or double-quoted
 * values and tolerating spaces around `=` - value content and formatting must never read as
 * attribute names.
 */
export function parseAttributeNames(attrText: string): string[] {
  const names: string[] = [];
  let i = 0;
  while (i < attrText.length) {
    while (i < attrText.length && /\s/.test(attrText[i])) {
      i += 1;
    }
    if (i >= attrText.length) {
      break;
    }
    const start = i;
    while (i < attrText.length && !/[\s=]/.test(attrText[i])) {
      i += 1;
    }
    const rawName = attrText.slice(start, i);
    let j = i;
    while (j < attrText.length && (attrText[j] === ' ' || attrText[j] === '\t')) {
      j += 1;
    }
    if (attrText[j] === '=') {
      j += 1;
      while (j < attrText.length && (attrText[j] === ' ' || attrText[j] === '\t')) {
        j += 1;
      }
      const quote = attrText[j];
      if (quote === '"' || quote === "'") {
        j += 1;
        while (j < attrText.length && attrText[j] !== quote) {
          j += 1;
        }
        j += 1;
      } else {
        while (j < attrText.length && !/\s/.test(attrText[j])) {
          j += 1;
        }
      }
      i = j;
    }
    if (rawName !== '') {
      names.push(rawName);
    }
  }
  return names;
}
