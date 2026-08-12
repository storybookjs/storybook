import { buildImportStatements, type ImportBinding } from 'storybook/internal/csf-tools';

/**
 * Import statement binding a component tag, or `undefined` when no statement can name it.
 *
 * A namespace binding has no importable member to alias, so it yields no statement rather than an
 * import the snippet could not compile against.
 */
export function importStatementForBinding(
  localName: string,
  binding: ImportBinding | undefined
): string | undefined {
  if (!binding || binding.importName === '*') {
    return undefined;
  }

  return buildImportStatements({
    refs: [
      {
        importId: binding.importId,
        importName: binding.importName,
        localImportName: localName,
      },
    ],
  }).join('\n');
}

export function slotSortKey(name: string): string {
  return name === 'default' ? '' : name;
}

export function wrapSlotContent(name: string, content: string): string {
  return name === 'default' ? content : `<template #${name}>\n${indent(content)}\n</template>`;
}

export function isVueExpressionAttribute(name: string): boolean {
  return name.startsWith(':') || name.startsWith('@') || name.startsWith('v-');
}

export function indent(source: string): string {
  return source
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}
