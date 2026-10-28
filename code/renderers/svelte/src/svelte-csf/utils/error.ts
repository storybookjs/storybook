import url from 'node:url';

import { unwrapExpression } from 'storybook/internal/csf-tools';
import { StorybookError } from 'storybook/internal/server-errors';

import { SVELTE_CSF_FRAMEWORK_IMPORT_SOURCES } from '../constants.ts';
import type { SvelteAST } from '../parser/ast.ts';

const [SVELTE_VITE_IMPORT_SOURCE, SVELTEKIT_IMPORT_SOURCE] = SVELTE_CSF_FRAMEWORK_IMPORT_SOURCES;

const CATEGORY = {
  parserExtractSvelte: 'SVELTE_CSF_PARSER_EXTRACT_SVELTE',
  parserExtractCompiled: 'SVELTE_CSF_PARSER_EXTRACT_COMPILED',
  parserAnalyseDefineMeta: 'SVELTE_CSF_PARSER_ANALYSE_DEFINE_META',
  parserAnalyseStory: 'SVELTE_CSF_PARSER_ANALYSE_STORY',
} as const;

export abstract class StorybookSvelteCSFError extends StorybookError {
  // Users import `defineMeta` from their framework. The messages name both frameworks.
  public static importSource = SVELTE_VITE_IMPORT_SOURCE;
  public static sveltekitImportSource = SVELTEKIT_IMPORT_SOURCE;
  public static importSourcesText = SVELTE_CSF_FRAMEWORK_IMPORT_SOURCES.map(
    (source) => `"${source}"`
  ).join(' or ');

  public static readonly CATEGORY = CATEGORY;

  declare readonly category: (typeof CATEGORY)[keyof typeof CATEGORY];

  constructor(
    props: ConstructorParameters<typeof StorybookError>[0] & {
      category: (typeof CATEGORY)[keyof typeof CATEGORY];
    }
  ) {
    super(props);
  }
}

export function filepathURL(filename: string | undefined) {
  return filename ? url.pathToFileURL(filename) : '<path not specified>';
}

// Unlike `getLiteralValueFromAttribute`, this doesn't throw, because it only builds a message
export function storyNameFromAttribute(component: SvelteAST.Component | undefined) {
  if (!component) {
    return '<UnnamedComponent>';
  }

  const attributes = ['name', 'exportName'].flatMap((name) =>
    component.attributes.filter(
      (attribute): attribute is SvelteAST.Attribute =>
        attribute.type === 'Attribute' && attribute.name === name
    )
  );

  for (const attribute of attributes) {
    if (attribute.value === true) {
      continue;
    }

    if (!Array.isArray(attribute.value)) {
      const expression = unwrapExpression(attribute.value.expression);

      return 'value' in expression ? expression.value : undefined;
    }

    if (attribute.value[0].type === 'Text') {
      return attribute.value[0].data;
    }

    const expression = unwrapExpression(attribute.value[0].expression);

    if (expression.type === 'Literal' && typeof expression.value === 'string') {
      return expression.value;
    }
  }
}

export function quickStoryRawCodeIdentifier(component: SvelteAST.Component | undefined) {
  return `<Story name="${storyNameFromAttribute(component)}" />`;
}
