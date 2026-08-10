import { buildImportStatements, type ImportBinding } from 'storybook/internal/csf-tools';

export function importStatementForBinding(localName: string, binding: ImportBinding): string {
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
