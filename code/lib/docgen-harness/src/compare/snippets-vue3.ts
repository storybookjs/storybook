import { parseAttributeNames, parseRootElement } from './parse-element.ts';

// A named slot is `<template #name>` or its `v-slot:name` long form.
const NAMED_SLOT = /<template\s+(?:#|v-slot:)([\w$-]+)/g;

// Every `<template>` boundary inside the root element's children, open or close.
const TEMPLATE_BOUNDARY = /<template(\s[^>]*?)?\/?>|<\/template>/g;

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
  for (const match of block.matchAll(NAMED_SLOT)) {
    names.add(match[1]);
  }
  if (root.childContent !== undefined && /\S/.test(withoutNamedSlots(root.childContent))) {
    names.add('default');
  }
  return names;
}

/**
 * Named-slot blocks nest whenever a slot renders a component with slots of its own, so their end
 * has to be found by depth. Stopping at the first `</template>` leaves the outer closing tag
 * behind, and that residue reads as default-slot content the snippet never had.
 */
function withoutNamedSlots(childContent: string): string {
  let kept = '';
  let cursor = 0;
  let blockStart = -1;
  let depth = 0;
  for (const match of childContent.matchAll(TEMPLATE_BOUNDARY)) {
    const selfClosing = match[0].endsWith('/>');
    const isOpen = !match[0].startsWith('</');
    if (blockStart === -1) {
      if (isOpen && /^\s*(?:#|v-slot:)/.test(match[1] ?? '')) {
        blockStart = match.index;
        // A self-closing named slot is a block that closes on the same tag.
        depth = selfClosing ? 0 : 1;
      }
    } else if (!selfClosing) {
      depth += isOpen ? 1 : -1;
    }
    if (blockStart !== -1 && depth === 0) {
      kept += childContent.slice(cursor, blockStart);
      cursor = match.index + match[0].length;
      blockStart = -1;
    }
  }
  // An open tag that never closes is template-shaped text, not a block - keep the whole remainder
  // rather than swallowing real default content behind it.
  return kept + childContent.slice(cursor);
}

const mapVueAttribute = (fullName: string): string | undefined => {
  // Modifiers (`v-model.number`, `:count.camel`, `@save.stop`) never change the name being bound.
  const rawName = /^[:@]|^v-/.test(fullName) ? fullName.split('.')[0] : fullName;
  if (rawName === 'v-model') {
    return 'modelValue';
  }
  if (rawName.startsWith('v-model:')) {
    return rawName.slice('v-model:'.length);
  }
  if (rawName.startsWith(':')) {
    return rawName.slice(1);
  }
  if (rawName.startsWith('v-bind:')) {
    return rawName.slice('v-bind:'.length);
  }
  // Event bindings map to their bare event name - Vue argTypes key events that way.
  if (rawName.startsWith('@')) {
    return rawName.slice(1);
  }
  if (rawName.startsWith('v-on:')) {
    return rawName.slice('v-on:'.length);
  }
  if (rawName.startsWith('v-') || rawName.startsWith('#')) {
    return undefined;
  }
  return rawName;
};
