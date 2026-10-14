import { types as t } from 'storybook/internal/babel';
import type {
  ImportBinding,
  ReferenceContext,
  ReferenceModule,
} from 'storybook/internal/csf-tools';
import { collectImportBindings } from 'storybook/internal/csf-tools';

/** A module whose code a template is cut from, and the names it imports. */
export interface TemplateModule {
  bindings: Map<string, ImportBinding>;
  code: string;
}

/** The modules a story imports lit's `html` from. */
export const LIT_SOURCES = [
  'lit',
  'lit-html',
  'lit-element',
  'lit/index.js',
  'lit/html.js',
  'lit-html/lit-html.js',
  'lit-element/lit-element.js',
  '@lion/core',
];

/**
 * A module and its imports, where a module of the project that exports all of lit again, as a
 * design system's base module does with `export * from 'lit'`, counts as lit.
 */
export function templateModule(
  { program, filePath }: ReferenceModule,
  resolve?: ReferenceContext['resolveModule']
): TemplateModule {
  const bindings = collectImportBindings(program);
  for (const [local, binding] of bindings) {
    const module =
      binding.importName === 'html' && !LIT_SOURCES.includes(binding.importId)
        ? resolve?.(filePath, binding.importId)
        : undefined;
    const lit = module?.program.node.body.some(
      (statement) =>
        t.isExportAllDeclaration(statement) && LIT_SOURCES.includes(statement.source.value)
    );
    if (lit) {
      bindings.set(local, { ...binding, importId: 'lit' });
    }
  }
  return { bindings, code: (program.hub as unknown as { file: { code: string } }).file.code };
}
