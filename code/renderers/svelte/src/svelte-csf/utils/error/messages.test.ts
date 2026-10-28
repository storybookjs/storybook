import { join } from 'pathe';

import { describe, expect, it } from 'vitest';

import { createASTProperty, getSvelteAST, type SvelteAST } from '../../parser/ast.ts';
import * as defineMeta from './parser/analyse/define-meta.ts';
import * as story from './parser/analyse/story.ts';
import * as compiled from './parser/extract/compiled.ts';
import * as svelte from './parser/extract/svelte.ts';

const filename = join(process.cwd(), 'Button.stories.svelte');

const ast = getSvelteAST({
  code: `
    {#snippet template()}{/snippet}
    <Story name="Primary" exportName="PrimaryStory" tags="autodocs" {template} />
    <Story name="Secondary" tags={['autodocs', tag]} />
  `,
});
const [component, componentWithTagsArray] = ast.fragment.nodes.filter(
  (node): node is SvelteAST.Component => node.type === 'Component'
);
const attribute = (node: SvelteAST.Component, name: string) =>
  node.attributes.find(
    (attribute): attribute is SvelteAST.Attribute =>
      attribute.type === 'Attribute' && attribute.name === name
  )!;

const identifierProperty = (name: string) =>
  createASTProperty(name, { type: 'Identifier', name: 'value' });

const cases: [string, () => Error][] = [
  ['MissingModuleTagError', () => new svelte.MissingModuleTagError(filename)],
  [
    'DefaultOrNamespaceImportUsedError',
    () => new svelte.DefaultOrNamespaceImportUsedError(filename),
  ],
  ['MissingDefineMetaImportError', () => new svelte.MissingDefineMetaImportError(filename)],
  [
    'MissingDefineMetaVariableDeclarationError (svelte)',
    () => new svelte.MissingDefineMetaVariableDeclarationError(filename),
  ],
  [
    'NoStoryComponentDestructuredError',
    () =>
      new svelte.NoStoryComponentDestructuredError({ filename, metaFunctionName: 'preview.meta' }),
  ],
  [
    'GetDefineMetaFirstArgumentError',
    () =>
      new svelte.GetDefineMetaFirstArgumentError({
        filename,
        defineMetaVariableDeclaration: undefined as never,
      }),
  ],
  [
    'InvalidStoryTemplateAttributeError',
    () =>
      new svelte.InvalidStoryTemplateAttributeError({
        filename,
        component,
        templateAttribute: attribute(component, 'template'),
      }),
  ],
  [
    'IndexerParseError',
    () => new svelte.IndexerParseError(filename, { cause: new SyntaxError('Unexpected token') }),
  ],
  ['MixedMetaError', () => new svelte.MixedMetaError(filename)],
  ['PreviewNotImportedError', () => new svelte.PreviewNotImportedError(filename)],
  ['MultipleMetaError', () => new svelte.MultipleMetaError(filename)],

  ['MissingImportedDefineMetaError', () => new compiled.MissingImportedDefineMetaError(filename)],
  [
    'MissingDefineMetaVariableDeclarationError (compiled)',
    () => new compiled.MissingDefineMetaVariableDeclarationError(filename),
  ],
  ['NoExportDefaultError', () => new compiled.NoExportDefaultError(filename)],
  ['NoStoryIdentifierFoundError', () => new compiled.NoStoryIdentifierFoundError(filename)],
  [
    'NoStoriesFunctionDeclarationError',
    () => new compiled.NoStoriesFunctionDeclarationError(filename),
  ],
  [
    'NoCompiledStoryPropsObjectExpression',
    () => new compiled.NoCompiledStoryPropsObjectExpression({ filename, node: undefined as never }),
  ],

  [
    'InvalidComponentValueError',
    () =>
      new defineMeta.InvalidComponentValueError({
        filename,
        componentProperty: createASTProperty('component', { type: 'Literal', value: 'Button' }),
      }),
  ],
  [
    'NoDestructuredDefineMetaCallError',
    () =>
      new defineMeta.NoDestructuredDefineMetaCallError({
        filename,
        defineMetaVariableDeclarator: {
          type: 'VariableDeclarator',
          id: { type: 'Identifier', name: 'Story' },
        },
      }),
  ],
  [
    'NoStringLiteralError',
    () => new defineMeta.NoStringLiteralError({ filename, property: identifierProperty('title') }),
  ],
  [
    'NoArrayExpressionError',
    () => new defineMeta.NoArrayExpressionError({ filename, property: identifierProperty('tags') }),
  ],
  [
    'ArrayElementNotStringError',
    () =>
      new defineMeta.ArrayElementNotStringError({
        filename,
        property: createASTProperty('tags', { type: 'ArrayExpression', elements: [] }),
        element: { type: 'Identifier', name: 'tag' },
      }),
  ],
  [
    'InvalidRenderValueError',
    () =>
      new defineMeta.InvalidRenderValueError({
        filename,
        renderProperty: createASTProperty('render', {
          type: 'ArrowFunctionExpression',
          params: [],
          body: { type: 'BlockStatement', body: [] },
          expression: false,
        }),
      }),
  ],

  [
    'AttributeNotStringError',
    () =>
      new story.AttributeNotStringError({
        filename,
        component,
        attribute: attribute(component, 'name'),
      }),
  ],
  [
    'AttributeNotArrayError',
    () =>
      new story.AttributeNotArrayError({
        filename,
        component,
        attribute: attribute(component, 'tags'),
      }),
  ],
  [
    'AttributeNotArrayOfStringsError',
    () =>
      new story.AttributeNotArrayOfStringsError({
        filename,
        component: componentWithTagsArray,
        attribute: attribute(componentWithTagsArray, 'tags'),
        element: { type: 'Identifier', name: 'tag' },
      }),
  ],
  ['NoStoryIdentifierError', () => new story.NoStoryIdentifierError({ filename, component })],
  [
    'InvalidStoryExportNameError',
    () => new story.InvalidStoryExportNameError({ filename, component, value: 'default' }),
  ],
  [
    'DuplicateStoryIdentifiersError',
    () =>
      new story.DuplicateStoryIdentifiersError({
        filename,
        identifiers: { name: 'Primary!', exportName: 'Primary' },
        duplicateIdentifiers: { name: 'Primary', exportName: 'Primary' },
      }),
  ],
  [
    'StoryTemplateAndChildrenError',
    () => new story.StoryTemplateAndChildrenError({ filename, component }),
  ],
  [
    'StoryTemplateAndAsChildError',
    () => new story.StoryTemplateAndAsChildError({ filename, component }),
  ],
  [
    'StoryAsChildWithoutChildrenError',
    () => new story.StoryAsChildWithoutChildrenError({ filename, component }),
  ],
  [
    'StoryExtendWithoutFactoryError',
    () => new story.StoryExtendWithoutFactoryError({ filename, component }),
  ],
  [
    'StoryExtendNotFoundError',
    () =>
      new story.StoryExtendNotFoundError({
        filename,
        component,
        extend: 'PrimaryLarge',
        suggestedName: 'Primary Large',
      }),
  ],
  [
    'StoryExtendUnnamedError',
    () => new story.StoryExtendUnnamedError({ filename, component, extend: 'Primary' }),
  ],
  [
    'StoryExtendDuplicateNameError',
    () => new story.StoryExtendDuplicateNameError({ filename, component, extend: 'Primary' }),
  ],
  [
    'StoryExtendCycleError',
    () =>
      new story.StoryExtendCycleError({
        filename,
        component,
        names: ['Primary', 'Secondary', 'Primary'],
      }),
  ],
];

describe('Svelte CSF errors', () => {
  it('has a case for every error class', () => {
    const classes = [svelte, compiled, defineMeta, story].flatMap((module) =>
      Object.values(module).filter((value) => typeof value === 'function')
    );

    expect(new Set(cases.map(([, createError]) => createError().constructor))).toEqual(
      new Set(classes)
    );
  });

  it.each(cases)('%s', (_, createError) => {
    expect(createError()).toMatchSnapshot();
  });
});
