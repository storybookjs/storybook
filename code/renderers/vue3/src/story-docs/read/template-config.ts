/**
 * Reads a transformable template-render object out of a story's render function.
 *
 * The read step decides only whether the story's markup can be transformed at all and what it is;
 * `../transform/template.ts` performs the transformation.
 */
import { types as t } from 'storybook/internal/babel';
import {
  keyOf,
  propertyValue,
  unwrapExpression,
  type ImportBinding,
} from 'storybook/internal/csf-tools';

import { importStatementForBinding } from '../shared/primitives.ts';
import { readForwardableSetup, type ForwardableSetup } from './forward-setup.ts';

export interface TemplateRenderConfig {
  /** Static Vue template string returned from the render function. */
  template: string;
  /** Component tag name to import statement. */
  componentImports: Map<string, string>;
  /** Setup statements to forward into the snippet's script. */
  setup?: ForwardableSetup;
}

export type TemplateRenderResolution =
  | { kind: 'config'; config: TemplateRenderConfig }
  | { kind: 'bail'; warning: string }
  /** Not a transformable template render object; the h-tree path may still resolve it. */
  | { kind: 'skip' };

export interface ReadTemplateRenderConfigOptions {
  /** Meta component identifier from CSF meta.component. */
  componentName?: string;
  /** Import statement for the meta component, after any `@import` override. */
  componentImportStatement?: string;
  /** Render-function parameter the setup body closes over as the story args. */
  argsParam?: string;
  /** Story file source backing the render object, for forwarding setup statements. */
  source?: string;
}

const SETUP_PROPERTY = 'setup';

const TEMPLATE_UNREADABLE_WARNING =
  'No static snippet: the `template` could not be read statically.';
const COMPONENTS_UNREADABLE_WARNING =
  'No static snippet: the `components` map could not be read statically.';

/** Read a transformable template-render object without resolving the render function itself. */
export function readTemplateRenderConfig(
  renderObject: t.ObjectExpression,
  importBindings: Map<string, ImportBinding>,
  options: ReadTemplateRenderConfigOptions = {}
): TemplateRenderResolution {
  if (!hasOnlySupportedRenderProperties(renderObject)) {
    return { kind: 'skip' };
  }

  const templateProperty = propertyValue(renderObject, 'template');
  if (!templateProperty) {
    return { kind: 'skip' };
  }
  const template = staticTemplateSource(templateProperty);
  if (template === undefined) {
    return { kind: 'bail', warning: TEMPLATE_UNREADABLE_WARNING };
  }

  let setup: ForwardableSetup | undefined;
  const setupProp = setupProperty(renderObject);
  if (setupProp) {
    const resolution = readForwardableSetup(setupProp, {
      argsParam: options.argsParam,
      importBindings,
      source: options.source ?? '',
    });
    // A setup returning a render closure wins over the template at runtime.
    if (resolution.kind === 'render-closure') {
      return { kind: 'skip' };
    }
    if (resolution.kind === 'bail') {
      return resolution;
    }
    setup = resolution.setup;
  }

  const componentImports = readComponentImports(
    propertyValue(renderObject, 'components'),
    importBindings,
    options
  );
  if (!componentImports) {
    return { kind: 'bail', warning: COMPONENTS_UNREADABLE_WARNING };
  }

  return { kind: 'config', config: { template, componentImports, setup } };
}

// '<MyButton />' or `<MyButton />` without substitutions
function staticTemplateSource(node: t.Node | undefined): string | undefined {
  if (t.isStringLiteral(node)) {
    return node.value;
  }
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked;
  }
  return undefined;
}

// { components: { Button }, setup: () => ({ args }), template: '<Button />' }
function hasOnlySupportedRenderProperties(renderObject: t.ObjectExpression): boolean {
  return renderObject.properties.every((property) => {
    // { ...baseRender, template: '<Button />' }
    if (t.isSpreadElement(property)) {
      return false;
    }

    const key = keyOf(property);
    // `inheritAttrs` only tunes runtime attribute fallthrough; the markup stays faithful without it.
    return (
      key === 'components' || key === SETUP_PROPERTY || key === 'template' || key === 'inheritAttrs'
    );
  });
}

// { Button, 'my-button': Button }
function readComponentImports(
  value: t.Node | undefined,
  importBindings: Map<string, ImportBinding>,
  options: ReadTemplateRenderConfigOptions
): Map<string, string> | undefined {
  const componentImports = new Map<string, string>();
  if (options.componentName && options.componentImportStatement) {
    componentImports.set(options.componentName, options.componentImportStatement);
  }
  if (!value) {
    return componentImports;
  }
  if (!t.isObjectExpression(value)) {
    return undefined;
  }

  for (const property of value.properties) {
    if (!t.isObjectProperty(property)) {
      return undefined;
    }

    const tagName = keyOf(property);
    const component = unwrapExpression(property.value);
    if (!tagName || !t.isIdentifier(component)) {
      return undefined;
    }

    const importStatement =
      component.name === options.componentName
        ? options.componentImportStatement
        : importStatementForBinding(component.name, importBindings.get(component.name));
    if (!importStatement) {
      return undefined;
    }

    componentImports.set(tagName, importStatement);
  }

  return componentImports;
}

// setup() { return { args }; }
function setupProperty(
  renderObject: t.ObjectExpression
): t.ObjectMethod | t.ObjectProperty | undefined {
  return renderObject.properties.find((property): property is t.ObjectMethod | t.ObjectProperty => {
    if (!t.isObjectMethod(property) && !t.isObjectProperty(property)) {
      return false;
    }
    return keyOf(property) === SETUP_PROPERTY;
  });
}
