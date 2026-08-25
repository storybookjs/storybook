import { traverse, types as t, type NodePath } from 'storybook/internal/babel';
import {
  keyOf,
  propertyValue,
  unwrapExpression,
  type ImportBinding,
} from 'storybook/internal/csf-tools';

import { importStatementForBinding } from './render-primitives.ts';

export interface TemplateRenderConfig {
  template: string;
  componentImports: Map<string, string>;
  setupBlock?: SetupBlock;
}

export interface ReadTemplateRenderConfigOptions {
  componentName?: string;
  componentImportStatement?: string;
}

export interface SetupBlock {
  /** Absolute source offset the sliced statements start at, for rebasing args-ref edits. */
  start: number;
  /** Absolute source offset the sliced statements end at. */
  end: number;
  /** Author setup statements, sliced verbatim without the trailing return. */
  source: string;
  /** Identifiers the body declares, for collision checks and template bindings. */
  bindings: string[];
  /** Same-name imports the body references. */
  imports: ImportBinding[];
  /** `args.<name>` member reads to substitute, as absolute source ranges. */
  argsRefs: { start: number; end: number; name: string }[];
}

type SetupAnalysis = Pick<SetupBlock, 'argsRefs' | 'bindings' | 'imports'> & {
  returnStatement: t.ReturnStatement;
};

export const ARGS_NAME = 'args';
const SETUP_PROPERTY = 'setup';
const EMPTY_SETUP_BLOCK: SetupBlock = {
  argsRefs: [],
  bindings: [],
  end: 0,
  imports: [],
  source: '',
  start: 0,
};

export function readTemplateRenderConfig(
  renderObject: t.ObjectExpression,
  source: string,
  importBindings: Map<string, ImportBinding>,
  options: ReadTemplateRenderConfigOptions = {}
): TemplateRenderConfig | undefined {
  if (!hasOnlySupportedRenderProperties(renderObject)) {
    return undefined;
  }

  const template = staticTemplateSource(propertyValue(renderObject, 'template'));
  if (template === undefined) {
    return undefined;
  }

  const setup = setupProperty(renderObject);
  const componentImports = readComponentImports(
    propertyValue(renderObject, 'components'),
    importBindings,
    options
  );
  if (!componentImports) {
    return undefined;
  }

  const setupBlock = setup ? readSetupBlock(setup, source, importBindings) : undefined;
  if (
    (setup && !setupBlock) ||
    (setupBlock && setupImportsCollideWithComponentImports(setupBlock, componentImports))
  ) {
    return undefined;
  }

  return { template, componentImports, setupBlock };
}

function staticTemplateSource(node: t.Node | undefined): string | undefined {
  if (t.isStringLiteral(node)) {
    return node.value;
  }
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked;
  }
  return undefined;
}

function hasOnlySupportedRenderProperties(renderObject: t.ObjectExpression): boolean {
  return renderObject.properties.every((property) => {
    if (t.isSpreadElement(property)) {
      return false;
    }

    const key = keyOf(property);
    return (
      key === 'components' || key === SETUP_PROPERTY || key === 'template' || key === 'inheritAttrs'
    );
  });
}

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

function setupProperty(
  renderObject: t.ObjectExpression
): t.ObjectMethod | t.ObjectProperty | undefined {
  return renderObject.properties.find(
    (property): property is t.ObjectMethod | t.ObjectProperty =>
      (t.isObjectMethod(property) || t.isObjectProperty(property)) &&
      keyOf(property) === SETUP_PROPERTY
  );
}

function readSetupBlock(
  setup: t.ObjectMethod | t.ObjectProperty,
  source: string,
  importBindings: Map<string, ImportBinding>
): SetupBlock | undefined {
  const setupFunction = setupFunctionNode(setup);
  if (!setupFunction || setupFunction.params.length > 0) {
    return undefined;
  }

  if (t.isExpression(setupFunction.body)) {
    return t.isObjectExpression(setupFunction.body) &&
      validSetupReturnObject(setupFunction.body, new Set())
      ? EMPTY_SETUP_BLOCK
      : undefined;
  }

  const analysis = analyzeSetup(setup, importBindings);
  if (!analysis) {
    return undefined;
  }

  const argument = analysis.returnStatement.argument
    ? unwrapExpression(analysis.returnStatement.argument)
    : undefined;
  const returned = t.isObjectExpression(argument) ? argument : undefined;
  if (!returned || !validSetupReturnObject(returned, new Set(analysis.bindings))) {
    return undefined;
  }

  return {
    ...sliceSetupBlock(source, setupFunction.body, analysis.returnStatement),
    argsRefs: analysis.argsRefs,
    bindings: analysis.bindings,
    imports: analysis.imports,
  };
}

function setupFunctionNode(setup: t.ObjectMethod | t.ObjectProperty): t.Function | undefined {
  if (t.isObjectMethod(setup)) {
    return setup;
  }

  const value = unwrapExpression(setup.value);
  return t.isFunction(value) ? value : undefined;
}

function analyzeSetup(
  setup: t.ObjectMethod | t.ObjectProperty,
  importBindings: Map<string, ImportBinding>
): SetupAnalysis | undefined {
  let setupPath: NodePath<t.Function> | undefined;
  const ownReturns: t.ReturnStatement[] = [];
  const imports = new Map<string, ImportBinding>();
  const argsRefs: SetupBlock['argsRefs'] = [];
  let invalid = false;
  const wrapped = t.file(t.program([t.expressionStatement(t.objectExpression([setup]))]));

  traverse(wrapped, {
    Function(path) {
      setupPath ??= path as NodePath<t.Function>;
    },
    ReturnStatement(path) {
      if (path.getFunctionParent() === setupPath) {
        ownReturns.push(path.node);
      }
    },
    ReferencedIdentifier(path) {
      if (!setupPath || invalid || path.scope.hasBinding(path.node.name)) {
        return;
      }
      if (isInsideReturn(path, ownReturns[0])) {
        return;
      }

      const { name } = path.node;
      if (name === ARGS_NAME) {
        if (!isAllowedArgsObject(path)) {
          invalid = true;
          path.stop();
        }
        return;
      }

      const binding = importBindings.get(name);
      if (!binding || binding.importName !== name) {
        invalid = true;
        path.stop();
        return;
      }
      imports.set(name, binding);
    },
    MemberExpression(path) {
      if (!setupPath || invalid || !isUnboundArgsObject(path.node.object, path.scope)) {
        return;
      }
      if (
        path.node.computed ||
        !t.isIdentifier(path.node.property) ||
        !isMemberRead(path) ||
        path.node.start == null ||
        path.node.end == null
      ) {
        invalid = true;
        path.stop();
        return;
      }
      argsRefs.push({ end: path.node.end, name: path.node.property.name, start: path.node.start });
    },
    OptionalMemberExpression(path) {
      if (setupPath && !invalid && isUnboundArgsObject(path.node.object, path.scope)) {
        invalid = true;
        path.stop();
      }
    },
  });

  if (invalid || !setupPath || ownReturns.length !== 1) {
    return undefined;
  }

  const body = setupPath.node.body;
  const statements = t.isBlockStatement(body) ? body.body : [];
  const [returnStatement] = ownReturns;
  if (returnStatement !== statements.at(-1)) {
    return undefined;
  }
  const bindings = Object.keys(setupPath.scope.bindings);
  if (bindings.includes(ARGS_NAME)) {
    return undefined;
  }

  return {
    argsRefs,
    bindings,
    imports: Array.from(imports.values()),
    returnStatement,
  };
}

function setupImportsCollideWithComponentImports(
  setupBlock: SetupBlock,
  componentImports: Map<string, string>
): boolean {
  return setupBlock.imports.some((binding) => componentImports.has(binding.importName));
}

function validSetupReturnObject(
  returned: t.ObjectExpression,
  declared: ReadonlySet<string>
): boolean {
  return returned.properties.every((property) => {
    if (!t.isObjectProperty(property) || property.computed) {
      return false;
    }

    const key = keyOf(property);
    if (key == null || (key !== ARGS_NAME && !declared.has(key))) {
      return false;
    }

    const value = unwrapExpression(property.value);
    return property.shorthand && t.isIdentifier(value, { name: key });
  });
}

function sliceSetupBlock(
  source: string,
  body: t.BlockStatement,
  returnStatement: t.ReturnStatement
): Pick<SetupBlock, 'end' | 'source' | 'start'> {
  const rawStart = body.start == null ? 0 : body.start + 1;
  const raw = source.slice(rawStart, returnStatement.start ?? rawStart);
  const leading = /^(?:[ \t]*(?:\r?\n|$))*/.exec(raw)?.[0] ?? '';
  const trimmedStart = rawStart + leading.length;
  const blockSource = raw.slice(leading.length).replace(/(?:\r?\n[ \t]*)+$/, '');
  return { end: trimmedStart + blockSource.length, source: blockSource, start: trimmedStart };
}

function isAllowedArgsObject(path: NodePath<t.Identifier | t.JSXIdentifier>): boolean {
  const parent = path.parentPath;
  return parent.isMemberExpression() && parent.node.object === path.node && !parent.node.computed;
}

function isUnboundArgsObject(
  object: t.Expression | t.Super,
  scope: NodePath['scope']
): object is t.Identifier {
  return t.isIdentifier(object, { name: ARGS_NAME }) && !scope.hasBinding(ARGS_NAME);
}

function isMemberRead(path: NodePath<t.MemberExpression>): boolean {
  const parent = path.parentPath;
  if (parent.isAssignmentExpression() && parent.node.left === path.node) {
    return false;
  }
  if (parent.isUpdateExpression() && parent.node.argument === path.node) {
    return false;
  }
  return !(parent.isUnaryExpression() && parent.node.operator === 'delete');
}

function isInsideReturn(path: NodePath, returnStatement: t.ReturnStatement | undefined): boolean {
  return !!returnStatement && !!path.findParent((parent) => parent.node === returnStatement);
}
