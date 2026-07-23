import type { Framework, Violation } from './types.ts';

export interface CompareSnippetInput {
  framework: Framework;
  args: Record<string, unknown>;
  baseline: string;
  candidate: string;
}

/**
 * Compares which names a snippet represents, never how it formats them: represented-name sets are
 * insensitive to attribute order, whitespace, quote style, and hoisted-vs-inline values by
 * construction. A name represented in the baseline but not the candidate is a violation; a
 * candidate-only representation is an improvement; a declared arg absent from both sides is an
 * accepted delta the committed baseline encodes (e.g. Vue drops function args). Value fidelity is
 * reviewed through the snapshot diff, not compared here.
 */
export function compareSnippet(input: CompareSnippetInput): Violation[] {
  const baselineNames = representedNames(input.framework, input.baseline);
  if (baselineNames === undefined) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(
      'The baseline snippet has no parsable root element; every committed baseline has one'
    );
  }
  const candidateNames = representedNames(input.framework, input.candidate) ?? new Set<string>();
  const violations: Violation[] = [];
  for (const name of [...baselineNames].sort()) {
    if (!candidateNames.has(name)) {
      violations.push({
        arg: name,
        kind: 'lost-representation',
        message: 'represented in the baseline snippet but not in the candidate',
      });
    }
  }
  return violations;
}

const representedNames = (framework: Framework, snippet: string): Set<string> | undefined =>
  framework === 'vue3' ? vueRepresentedNames(snippet) : angularRepresentedNames(snippet);

/**
 * Angular snippets are a single element; `[input]` and `(output)` attributes are the grammar.
 * Attributes are parsed structurally rather than regexed over the whole string, so binding-shaped
 * text inside an attribute VALUE can never count as representation, and quote style or spacing
 * around `=` cannot fail the comparison.
 */
function angularRepresentedNames(snippet: string): Set<string> | undefined {
  const root = parseRootElement(snippet);
  if (root === undefined) {
    return undefined;
  }
  const names = new Set<string>();
  for (const rawName of parseAttributeNames(root.attrText)) {
    const bound = /^\[([\w$.-]+)\]$/.exec(rawName) ?? /^\(([\w$.-]+)\)$/.exec(rawName);
    if (bound) {
      names.add(bound[1]);
    }
  }
  return names;
}

/**
 * Scans the <template> block only - a hoisted const in <script setup> whose name collides with a
 * declared prop must not count as representation. Returns undefined when no template block or root
 * element can be found (unparsable for the baseline side is a corpus break, reported by the
 * caller).
 */
function vueRepresentedNames(snippet: string): Set<string> | undefined {
  const open = snippet.indexOf('<template>');
  const close = snippet.lastIndexOf('</template>');
  if (open === -1 || close === -1 || close < open) {
    return undefined;
  }
  const block = snippet.slice(open + '<template>'.length, close);
  const root = parseRootElement(block);
  if (root === undefined) {
    return undefined;
  }
  const names = new Set<string>();
  for (const rawName of parseAttributeNames(root.attrText)) {
    const mapped = mapVueAttribute(rawName);
    if (mapped !== undefined) {
      names.add(mapped);
    }
  }
  for (const match of block.matchAll(/<template\s+#([\w$-]+)/g)) {
    names.add(match[1]);
  }
  if (root.childContent !== undefined) {
    const withoutNamedSlots = root.childContent.replace(/<template\s+#[\s\S]*?<\/template>/g, '');
    if (/\S/.test(withoutNamedSlots)) {
      names.add('default');
    }
  }
  return names;
}

function parseRootElement(
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
function parseAttributeNames(attrText: string): string[] {
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

const mapVueAttribute = (rawName: string): string | undefined => {
  if (rawName === 'v-model') {
    return 'modelValue';
  }
  if (rawName.startsWith('v-model:')) {
    return rawName.slice('v-model:'.length);
  }
  if (rawName.startsWith(':')) {
    return rawName.slice(1);
  }
  if (rawName.startsWith('v-') || rawName.startsWith('@') || rawName.startsWith('#')) {
    return undefined;
  }
  return rawName;
};
