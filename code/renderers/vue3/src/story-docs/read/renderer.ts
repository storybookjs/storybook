/**
 * Decides how a story renders, and reads whatever that decision needs out of the story file.
 *
 * A story renders one of four ways: through a template render object, through an `h()` tree, or —
 * with no render function at all — through the component receiving the args directly. This is the
 * last read step before classification; the resolved {@link StaticStoryRenderer} tells the driver
 * which renderer in `../print/` and `../transform/` to run.
 */
import { types as t, type NodePath } from 'storybook/internal/babel';
import {
  keyOf,
  resolveRenderFunction,
  resolveReturnedObjectExpression,
  returnedExpression,
  returnedExpressionPath,
  unwrapExpression,
  type ImportBinding,
  type ReferenceContext,
  type RenderFunctionPath,
  type RenderResolution,
} from 'storybook/internal/csf-tools';

import type { ForwardableSetup } from './forward-setup.ts';
import { readTemplateRenderConfig, type TemplateRenderConfig } from './template-config.ts';

/** How a story renders, once the story file has been read as far as it can be. */
export type StaticStoryRenderer =
  | { kind: 'bail'; warning: string }
  | { kind: 'h'; argsParam?: string; expression: t.Expression }
  | { kind: 'sfc' }
  | {
      kind: 'template';
      componentImports: TemplateRenderConfig['componentImports'];
      template: string;
      setup?: ForwardableSetup;
    };

export interface ResolveStaticRendererOptions {
  /** Object expression of the story's own config, when it has one. */
  storyConfigPath: NodePath<t.ObjectExpression> | undefined;
  /** Meta object expression, which supplies the render function a story does not declare. */
  metaPath: NodePath<t.ObjectExpression> | undefined;
  /** The story's declaration, for following a `render` reference from where it is written. */
  storyDeclaration: NodePath<t.Node>;
  /** How a `render` reference may be followed out of the story file. */
  references: ReferenceContext;
  /** Import bindings from the CSF module. */
  importBindings: Map<string, ImportBinding>;
  /** Meta component identifier, when one could be read. */
  componentName?: string;
  /** Import statement for the meta component, after any `@import` override. */
  componentImportStatement?: string;
  /** Story file source, for forwarding setup statements verbatim. */
  source: string;
}

/** Undefined when the render function exists but could not be resolved statically. */
export function resolveStaticRenderer(
  options: ResolveStaticRendererOptions
): StaticStoryRenderer | undefined {
  const effectiveRender = resolveEffectiveRender(options);

  if (effectiveRender.kind === 'missing') {
    return { kind: 'sfc' };
  }
  if (effectiveRender.kind !== 'resolved') {
    return undefined;
  }
  return staticRendererForRenderFunction(effectiveRender.path, options);
}

function staticRendererForRenderFunction(
  renderFunction: RenderFunctionPath,
  options: ResolveStaticRendererOptions
): StaticStoryRenderer | undefined {
  const renderObject = resolveReturnedObjectExpression(renderFunction);
  if (renderObject) {
    const resolution = readTemplateRenderConfig(renderObject, options.importBindings, {
      argsParam: argsParameterName(renderFunction.node),
      componentImportStatement: options.componentImportStatement,
      componentName: options.componentName,
      source: options.source,
    });
    if (resolution.kind === 'bail') {
      return { kind: 'bail', warning: resolution.warning };
    }
    if (resolution.kind === 'config') {
      return { kind: 'template', ...resolution.config };
    }

    const setupExpression = setupReturnedRenderExpression(renderObject);
    if (setupExpression) {
      return {
        argsParam: argsParameterName(renderFunction.node),
        expression: setupExpression,
        kind: 'h',
      };
    }
  }

  const hExpression = returnedExpressionPath(renderFunction)?.node;
  return hExpression
    ? {
        argsParam: argsParameterName(renderFunction.node),
        expression: hExpression,
        kind: 'h',
      }
    : undefined;
}

/**
 * The `h()` tree a render object's `setup` returns through its render closure, when nothing else
 * on the object can change what the story renders.
 *
 * @example `render: (args) => ({ setup: () => () => h(C, { label: args.label }) })` -> the `h(...)` call
 */
function setupReturnedRenderExpression(renderObject: t.ObjectExpression): t.Expression | undefined {
  const supported = renderObject.properties.every((property) => {
    if (t.isSpreadElement(property)) {
      return false;
    }
    const key = keyOf(property);
    return key === 'setup' || key === 'components' || key === 'inheritAttrs';
  });
  if (!supported) {
    return undefined;
  }

  const setup = renderObject.properties.find(
    (property) => !t.isSpreadElement(property) && keyOf(property) === 'setup'
  );
  const setupFn = t.isObjectMethod(setup)
    ? setup
    : t.isObjectProperty(setup)
      ? unwrapExpression(setup.value)
      : undefined;
  if (!setupFn || !t.isFunction(setupFn)) {
    return undefined;
  }

  const renderClosure = returnedExpression(setupFn);
  const closure = renderClosure && unwrapExpression(renderClosure);
  // A render closure with parameters would receive values the snippet cannot reproduce.
  if (!closure || !t.isFunction(closure) || closure.params.length > 0) {
    return undefined;
  }

  return returnedExpression(closure);
}

function argsParameterName(renderFunction: RenderFunctionPath['node']): string | undefined {
  const [parameter] = renderFunction.params;
  return t.isIdentifier(parameter) ? parameter.name : undefined;
}

/** A story's own `render` wins over meta's, and a story with neither renders as a plain SFC. */
function resolveEffectiveRender(options: ResolveStaticRendererOptions): RenderResolution {
  const { storyConfigPath, metaPath, storyDeclaration, references } = options;
  const storyRender = resolveRenderFromObjectPath(storyConfigPath, storyDeclaration, references);
  return storyRender.kind !== 'missing'
    ? storyRender
    : resolveRenderFromObjectPath(metaPath, storyDeclaration, references);
}

function resolveRenderFromObjectPath(
  path: NodePath<t.ObjectExpression> | undefined,
  storyDeclaration: NodePath<t.Node>,
  references: ReferenceContext
): RenderResolution {
  try {
    return resolveRenderFunction(path, storyDeclaration, references);
  } catch {
    return { kind: 'unresolved' };
  }
}
