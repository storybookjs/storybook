import {
  ELEMENT_NODE,
  TEXT_NODE,
  parse,
  renderSync,
  walkSync,
  type ElementNode,
  type Node as HtmlNode,
  type TextNode,
} from 'ultrahtml';

import { types as t } from 'storybook/internal/babel';
import { keyOf, propertyValue, type ImportBinding } from 'storybook/internal/csf-tools';

import { importStatementForBinding, indent, isVueExpressionAttribute } from './ast-utils.ts';
import type { ClassifiedArg } from './classify-args.ts';
import { unwrapValue } from './classify-value.ts';
import {
  createRenderContext,
  partitionArgsByRole,
  type RenderContext,
  renderEventArg,
  renderInlinePrimitiveValue,
  renderPreparedSfcSnippet,
  renderPropLikeArg,
  renderPropValue,
  renderSlotContent,
  type RenderedProp,
} from './render-sfc.ts';

export interface TemplateRenderConfig {
  /** Static Vue template string returned from the render function. */
  template: string;
  /** Component tag name to import statement. */
  componentImports: Map<string, string>;
}

export interface TransformTemplateInput {
  /** Static Vue template markup from a render object. */
  template: string;
  /** Merged and classified CSF args for the story. */
  args: ClassifiedArg[];
  /** Component tag name to import statement from the render object's components map. */
  componentImports: Map<string, string>;
}

export interface TransformTemplateResult {
  /** Vue SFC snippet for the docs payload. */
  snippet: string;
  /** Import statements for components actually used by the transformed template. */
  imports: string[];
}

type MutableElementNode = ElementNode & {
  attributes: Record<string, string>;
  children: HtmlNode[];
};

const ARGS_NAME = 'args';
/**
 * This marker is used to indicate that an attribute was rendered without a value, so that it can be removed from the final SFC snippet
 * For example, `<Button disabled />` is rendered as `<Button disabled="__STORYBOOK_VUE_STORY_DOCS_BARE_ATTRIBUTE__" />` and then transformed into `<Button disabled />`
 * It's a limitation of ultrahtml
 */
const BARE_ATTRIBUTE_MARKER = '__STORYBOOK_VUE_STORY_DOCS_BARE_ATTRIBUTE__';
const ARGS_IDENTIFIER_REGEXP = /(^|[^\w$])args([^\w$]|$)/;
const ARGS_MEMBER_REGEXP = /^args\.([A-Za-z_$][\w$]*)$/;
const SETUP_PROPERTY = 'setup';

/** Read a transformable template-render object without resolving the render function itself. */
export function readTemplateRenderConfig(
  renderObject: t.ObjectExpression,
  importBindings: Map<string, ImportBinding>
): TemplateRenderConfig | undefined {
  if (!hasOnlySupportedRenderProperties(renderObject)) {
    return undefined;
  }

  const template = propertyValue(renderObject, 'template');
  if (!t.isStringLiteral(template)) {
    return undefined;
  }

  const setup = setupProperty(renderObject);
  if (setup && !isTrivialSetup(setup)) {
    return undefined;
  }

  const componentImports = readComponentImports(
    propertyValue(renderObject, 'components'),
    importBindings
  );
  return componentImports ? { template: template.value, componentImports } : undefined;
}

/** Transform supported template-render markup into a static SFC snippet. */
export function transformTemplate(
  input: TransformTemplateInput
): TransformTemplateResult | undefined {
  const ast = parse(input.template) as HtmlNode;
  const ctx = createRenderContext(input.args);
  const argsByName = new Map(input.args.map((arg) => [arg.name, arg]));
  const usedImports = new Set<string>();
  let unsupported = false;

  walkSync(ast, (node) => {
    if (unsupported) {
      return;
    }

    if (isTextNode(node)) {
      const replaced = replaceTextInterpolations(node.value, argsByName);
      if (replaced === undefined) {
        unsupported = true;
        return;
      }
      node.value = replaced;
      return;
    }

    if (!isElementNode(node)) {
      return;
    }

    const componentImport = input.componentImports.get(node.name);
    if (componentImport) {
      usedImports.add(componentImport);
    }

    unsupported = !transformElementAttributes(node, argsByName, ctx);
  });

  if (unsupported) {
    return undefined;
  }

  const templateCode = collapseChildlessComponents(
    renderSync(ast).replaceAll(`="${BARE_ATTRIBUTE_MARKER}"`, '')
  );
  return {
    snippet: renderPreparedSfcSnippet({ templateCode, ctx }),
    imports: Array.from(usedImports),
  };
}

/**
 * Serialization expands every childless element into a tag pair, which rewrites the author's
 * markup. Only components collapse back, so native elements keep valid HTML.
 *
 * @example `<Button label="Hi"></Button>` → `<Button label="Hi" />`
 */
function collapseChildlessComponents(markup: string): string {
  return markup.replace(
    /<([A-Z][\w.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)><\/\1>/g,
    (_match, tag: string, attributes: string) => `<${tag}${attributes.trimEnd()} />`
  );
}

// { components: { Button }, setup: () => ({ args }), template: '<Button />' }
function hasOnlySupportedRenderProperties(renderObject: t.ObjectExpression): boolean {
  return renderObject.properties.every((property) => {
    // { ...baseRender, template: '<Button />' }
    if (t.isSpreadElement(property)) {
      return false;
    }

    const key = keyOf(property);
    return key === 'components' || key === SETUP_PROPERTY || key === 'template';
  });
}

// { Button, 'my-button': Button }
function readComponentImports(
  value: t.Node | undefined,
  importBindings: Map<string, ImportBinding>
): Map<string, string> | undefined {
  const componentImports = new Map<string, string>();
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
    const component = unwrapValue(property.value);
    if (!tagName || !t.isIdentifier(component)) {
      return undefined;
    }

    const binding = importBindings.get(component.name);
    if (!binding || binding.importName === '*') {
      return undefined;
    }

    componentImports.set(tagName, importStatementForBinding(component.name, binding));
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

// setup: () => ({ args })
function isTrivialSetup(setup: t.ObjectMethod | t.ObjectProperty): boolean {
  const returned = setupReturnObject(setup);
  if (!returned || returned.properties.length !== 1) {
    return false;
  }

  const [property] = returned.properties;
  if (!t.isObjectProperty(property) || keyOf(property) !== ARGS_NAME) {
    return false;
  }

  const value = unwrapValue(property.value);
  return t.isIdentifier(value, { name: ARGS_NAME });
}

/**
 * Deliberately stricter than csf-tools' `returnedObjectExpression`: a block body must contain
 * exactly the return statement, since any extra statement could affect what the template renders.
 *
 * @example `setup() { return { args }; }` or `setup: () => ({ args })`
 */
function setupReturnObject(
  setup: t.ObjectMethod | t.ObjectProperty
): t.ObjectExpression | undefined {
  if (t.isObjectMethod(setup)) {
    return objectReturnedFromBlock(setup.body);
  }

  const value = unwrapValue(setup.value);
  if (!t.isArrowFunctionExpression(value) && !t.isFunctionExpression(value)) {
    return undefined;
  }

  if (t.isObjectExpression(value.body)) {
    return value.body;
  }
  return t.isBlockStatement(value.body) ? objectReturnedFromBlock(value.body) : undefined;
}

// () => { return { args }; }
function objectReturnedFromBlock(block: t.BlockStatement): t.ObjectExpression | undefined {
  if (block.body.length !== 1) {
    return undefined;
  }

  const [statement] = block.body;
  return t.isReturnStatement(statement) && t.isObjectExpression(statement.argument)
    ? statement.argument
    : undefined;
}

// <Button v-bind="args" :label="args.label" />
function transformElementAttributes(
  node: MutableElementNode,
  argsByName: Map<string, ClassifiedArg>,
  ctx: RenderContext
): boolean {
  const attributes = node.attributes;

  for (const [name, value] of Object.entries({ ...attributes })) {
    const attributeValue = typeof value === 'string' ? value.trim() : '';

    // <Button v-bind="args" />
    if (name === 'v-bind' && attributeValue === ARGS_NAME) {
      delete attributes[name];
      if (!expandArgsBinding(node, [...argsByName.values()], ctx)) {
        return false;
      }
      continue;
    }

    const boundProp = boundPropName(name);
    // <Button :label="args.label" />
    if (boundProp && attributeValue) {
      const argName = exactArgsMemberName(attributeValue);
      if (argName) {
        const arg = argsByName.get(argName);
        if (!arg || arg.role === 'slot') {
          return false;
        }

        delete attributes[name];
        const rendered = renderPropValue(
          { attributeName: boundProp, variableName: argName, value: arg.value, plan: arg.plan },
          ctx
        );
        applyRenderedAttribute(attributes, rendered);
        continue;
      }
    }

    // <Button @click="args.onClick()" />
    if (isVueExpressionAttribute(name) && valueReferencesArgs(attributeValue)) {
      return false;
    }
  }

  return true;
}

// <Button v-bind="args" /> -> <Button label="Hello">Default slot</Button>
function expandArgsBinding(
  node: MutableElementNode,
  args: ClassifiedArg[],
  ctx: RenderContext
): boolean {
  const partitioned = partitionArgsByRole(args);
  const props = partitioned.props.map((arg) => renderPropLikeArg(arg, ctx));
  const events = partitioned.events.map((arg) => renderEventArg(arg, ctx));

  for (const prop of [...props, ...events]) {
    applyRenderedAttribute(node.attributes, prop);
  }

  const slotNodes = partitioned.slots.flatMap((slot) => renderSlotNodes(slot, node, ctx));
  if (slotNodes.length === 0) {
    return true;
  }

  // <Button v-bind="args">Existing content</Button>
  if (hasRenderedChildren(node)) {
    return false;
  }

  node.children = slotNodes;
  return true;
}

// <p>{{ args.label }}</p> -> <p>Hello</p>
function replaceTextInterpolations(
  value: string,
  argsByName: Map<string, ClassifiedArg>
): string | undefined {
  let unsupported = false;
  const replaced = value.replace(/{{([\s\S]*?)}}/g, (match, expression: string) => {
    const trimmedExpression = expression.trim();
    const argName = exactArgsMemberName(trimmedExpression);
    if (!argName) {
      if (valueReferencesArgs(trimmedExpression)) {
        unsupported = true;
      }
      return match;
    }

    const arg = argsByName.get(argName);
    const rendered = arg ? renderInlinePrimitiveValue(arg.value) : undefined;
    if (rendered === undefined) {
      unsupported = true;
      return match;
    }
    return rendered;
  });

  return unsupported ? undefined : replaced;
}

// header: 'Hello' -> <template #header>Hello</template>
function renderSlotNodes(
  arg: ClassifiedArg,
  parent: MutableElementNode,
  ctx: RenderContext
): HtmlNode[] {
  const content = renderSlotContent(arg, ctx);

  if (arg.name === 'default') {
    return parseFragment(content, parent);
  }

  const node: MutableElementNode = {
    attributes: { [`#${arg.name}`]: BARE_ATTRIBUTE_MARKER },
    children: [],
    loc: parent.loc,
    name: 'template',
    parent,
    type: ELEMENT_NODE,
  };
  node.children = parseFragment(`\n${indent(content)}\n`, node);
  return [node];
}

// '<strong>Hello</strong>' -> [ElementNode]
function parseFragment(value: string, parent: MutableElementNode): HtmlNode[] {
  const parsed = parse(value) as HtmlNode;
  const children = 'children' in parsed && Array.isArray(parsed.children) ? parsed.children : [];
  for (const child of children) {
    assignParent(child, parent);
  }
  return children;
}

function assignParent(node: HtmlNode, parent: HtmlNode): void {
  node.parent = parent;
  if ('children' in node) {
    for (const child of node.children) {
      assignParent(child, node);
    }
  }
}

// 'disabled' -> { disabled: BARE_ATTRIBUTE_MARKER }
function applyRenderedAttribute(attributes: Record<string, string>, prop: RenderedProp): void {
  attributes[prop.attrName] = prop.value ?? BARE_ATTRIBUTE_MARKER;
}

// ':label' or 'v-bind:label' -> 'label'
function boundPropName(name: string): string | undefined {
  if (name.startsWith(':') && name.length > 1) {
    return staticBoundPropName(name.slice(1));
  }

  if (name.startsWith('v-bind:') && name.length > 'v-bind:'.length) {
    return staticBoundPropName(name.slice('v-bind:'.length));
  }

  return undefined;
}

// '[dynamic]' or 'label.trim' -> undefined
function staticBoundPropName(name: string): string | undefined {
  return name.startsWith('[') || name.includes('.') ? undefined : name;
}

// 'args.label' -> 'label'
function exactArgsMemberName(value: string): string | undefined {
  return ARGS_MEMBER_REGEXP.exec(value)?.[1];
}

function hasRenderedChildren(node: MutableElementNode): boolean {
  return node.children.some((child) => {
    if (isTextNode(child)) {
      return child.value.trim() !== '';
    }
    return true;
  });
}

function isElementNode(node: HtmlNode): node is MutableElementNode {
  return node.type === ELEMENT_NODE;
}

function isTextNode(node: HtmlNode): node is TextNode {
  return node.type === TEXT_NODE;
}

function valueReferencesArgs(value: string): boolean {
  return ARGS_IDENTIFIER_REGEXP.test(value);
}
