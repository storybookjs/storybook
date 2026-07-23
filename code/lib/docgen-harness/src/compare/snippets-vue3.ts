import { parseAttributeNames, parseRootElement } from './parse-element.ts';

/**
 * Scans the <template> block only - a hoisted const in <script setup> whose name collides with a
 * declared prop must not count as representation. Returns undefined when no template block or root
 * element can be found (unparsable for the baseline side is a corpus break, reported by the
 * caller).
 */
export function vueRepresentedNames(snippet: string): Set<string> | undefined {
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
