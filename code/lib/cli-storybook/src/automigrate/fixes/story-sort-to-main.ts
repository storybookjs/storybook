import { HandledError } from 'storybook/internal/common';
import { traverse, types as t } from 'storybook/internal/babel';
import { type ConfigFile, type CsfValue, loadConfig } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

interface StorySortToMainOptions {
  // A statically readable value inlines into main; undefined fails the migration with the
  // readable-value message.
  storySort: CsfValue | undefined;
  // A self-contained comparator function node moves as its AST.
  comparator?: t.Expression;
  // How the transform removes the preview property: through the config editor, through direct
  // export surgery when the editor refuses mixed default and named exports, or through the
  // program scan when the editor's export map shadowed the export that owns storySort.
  removal: 'editor' | 'removeField' | 'scan';
}

const storySortPath = ['parameters', 'options', 'storySort'];

const fail = (reason: string): never => {
  throw new HandledError(
    `Cannot automigrate storySort: ${reason}. Storybook no longer reads parameters.options.storySort from the preview. Move it to storySorts in the main config manually and remove the preview property.`
  );
};

const firstProblem = (config: ConfigFile) => config.mutationDiagnostics[0]?.message;

// storySorts accepts comparator functions, but `getValue` cannot read them. A function whose
// references are all bound inside itself (its own params and locals) moves as its AST node;
// anything reaching into the preview module would break main and is refused instead.
const movableFunction = (node: t.Node | undefined): t.Expression | undefined => {
  if (!t.isArrowFunctionExpression(node) && !t.isFunctionExpression(node)) {
    return undefined;
  }
  const bound = new Set<string>(['undefined', 'NaN', 'Infinity']);
  const bindParams = (fn: t.Function): void => {
    fn.params.forEach((param) => {
      if (t.isIdentifier(param)) {
        bound.add(param.name);
      } else {
        bound.clear();
      }
    });
  };
  const collectBindings = (
    fn: t.ArrowFunctionExpression | t.FunctionExpression | t.FunctionDeclaration
  ): void => {
    if ('id' in fn && fn.id) {
      bound.add(fn.id.name);
    }
    bindParams(fn);
  };
  // Traversal visits the root's children before the root's own handler, so bind the root
  // explicitly and collect every nested binding in a first pass before checking references.
  collectBindings(node);
  traverse(node, {
    noScope: true,
    ArrowFunctionExpression: ({ node: fn }) => collectBindings(fn),
    FunctionExpression: ({ node: fn }) => collectBindings(fn),
    FunctionDeclaration: ({ node: fn }) => collectBindings(fn),
    VariableDeclarator: ({ node: declarator }) => {
      if (t.isIdentifier(declarator.id)) {
        bound.add(declarator.id.name);
      } else {
        bound.clear();
      }
    },
  });
  if (bound.size === 0) {
    return undefined;
  }
  let movable = true;
  traverse(node, {
    noScope: true,
    // Type annotations ride along with the moved function and are erased at runtime.
    TSTypeAnnotation: (path) => path.skip(),
    Identifier: ({ node: identifier, parent }) => {
      const isAccess =
        (t.isMemberExpression(parent) && parent.property === identifier && !parent.computed) ||
        (t.isObjectProperty(parent) &&
          parent.key === identifier &&
          !parent.computed &&
          !parent.shorthand) ||
        (t.isClassProperty(parent) && parent.key === identifier && !parent.computed);
      if (!isAccess && !bound.has(identifier.name)) {
        movable = false;
      }
    },
  });
  return movable ? node : undefined;
};

const propertyName = (property: t.ObjectProperty): string | undefined => {
  if (t.isIdentifier(property.key)) {
    return property.key.name;
  }
  if (t.isStringLiteral(property.key)) {
    return property.key.value;
  }
  return undefined;
};

const unwrapTs = (node: t.Node): t.Node => {
  if (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node)) {
    return unwrapTs(node.expression);
  }
  return node;
};

// Follows a top-level variable to its initializer, mirroring how the config editor resolves
// `export default someConfig` declarations.
const resolveTopLevelValue = (node: t.Node, program: t.Program): t.Node | undefined => {
  const unwrapped = unwrapTs(node);
  if (!t.isIdentifier(unwrapped)) {
    return unwrapped;
  }
  for (const statement of program.body) {
    if (!t.isVariableDeclaration(statement)) {
      continue;
    }
    for (const declarator of statement.declarations) {
      if (
        t.isIdentifier(declarator.id) &&
        declarator.id.name === unwrapped.name &&
        declarator.init
      ) {
        return unwrapTs(declarator.init);
      }
    }
  }
  return undefined;
};

const findNamedProperty = (node: t.Node | undefined, name: string): t.ObjectProperty | undefined =>
  t.isObjectExpression(node)
    ? node.properties.find(
        (property): property is t.ObjectProperty =>
          t.isObjectProperty(property) && !property.computed && propertyName(property) === name
      )
    : undefined;

interface ScannedStorySort {
  // The storySort property as written in the preview, for identity-based removal.
  property: t.ObjectProperty;
  // The options properties holding it.
  properties: t.ObjectExpression['properties'];
}

// The config editor's export map is keyed by property name with last-parse-wins semantics: a
// default export that also defines `parameters` shadows a named `export const parameters`
// parsed earlier, even when only the named one carries storySort. Scan the program directly
// for the export that owns storySort instead.
const scanStorySort = (program: t.Program): ScannedStorySort | undefined => {
  const candidates: ScannedStorySort[] = [];
  const consider = (configObject: t.Node | undefined) => {
    const optionsProperty = findNamedProperty(configObject, 'options');
    if (!t.isObjectExpression(optionsProperty?.value)) {
      return;
    }
    const properties = optionsProperty.value.properties;
    const storySortIndex = properties.findIndex(
      (property): property is t.ObjectProperty =>
        t.isObjectProperty(property) && propertyName(property) === 'storySort'
    );
    if (storySortIndex < 0) {
      return;
    }
    // A spread or computed key after storySort can override it at runtime, so the sort the
    // user wrote may not be the one that ran; such shapes stay with the manual instructions.
    const overridden = properties
      .slice(storySortIndex + 1)
      .some((property) => !t.isObjectProperty(property) || property.computed);
    if (overridden) {
      return;
    }
    candidates.push({
      property: properties[storySortIndex] as t.ObjectProperty,
      properties,
    });
  };
  program.body.forEach((statement) => {
    if (t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration)) {
      statement.declaration.declarations.forEach((declarator) => {
        if (
          t.isVariableDeclarator(declarator) &&
          t.isIdentifier(declarator.id) &&
          declarator.id.name === 'parameters' &&
          declarator.init
        ) {
          consider(resolveTopLevelValue(declarator.init, program));
        }
      });
    }
    if (t.isExportDefaultDeclaration(statement)) {
      consider(resolveTopLevelValue(statement.declaration, program));
    }
  });
  // Both exports carrying a storySort is a genuine conflict the editor resolves by its own
  // merge order; only scan results that are unambiguous get migrated.
  return candidates.length === 1 ? candidates[0] : undefined;
};

// Conservative static reader for scanned storySort values: literals, plain arrays, and plain
// objects only; anything dynamic fails the migration with the manual instructions instead.
const readStaticValue = (node: t.Node): CsfValue | undefined => {
  if (t.isNullLiteral(node)) {
    return null;
  }
  if (t.isStringLiteral(node) || t.isBooleanLiteral(node) || t.isNumericLiteral(node)) {
    return node.value;
  }
  if (t.isArrayExpression(node)) {
    const elements: CsfValue[] = [];
    for (const element of node.elements) {
      if (!element) {
        return undefined;
      }
      const value = readStaticValue(element);
      if (value === undefined) {
        return undefined;
      }
      elements.push(value);
    }
    return elements;
  }
  if (t.isObjectExpression(node)) {
    const object: Record<string, CsfValue> = {};
    for (const property of node.properties) {
      // Methods parse as ObjectMethod, a different node type than ObjectProperty, so the
      // isObjectProperty guard already excludes them.
      if (!t.isObjectProperty(property) || property.computed) {
        return undefined;
      }
      const key = propertyName(property);
      if (key === undefined) {
        return undefined;
      }
      const value = readStaticValue(property.value);
      if (value === undefined) {
        return undefined;
      }
      object[key] = value;
    }
    return object;
  }
  return undefined;
};

const removeScannedStorySort = (preview: ConfigFile): void => {
  const scanned = scanStorySort(preview._ast.program);
  if (!scanned) {
    // The scan that captured storySort cannot miss on the same source; treat a miss as a no-op
    // rather than failing after main was already edited.
    return;
  }
  scanned.properties.splice(scanned.properties.indexOf(scanned.property), 1);
};

export const storySortToMain: Fix<StorySortToMainOptions> = {
  id: 'story-sort-to-main',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#storysort-in-the-preview-replaced-by-storysorts-in-main',

  async check({ files, previewConfigPath }) {
    if (!previewConfigPath) {
      return null;
    }
    const source = await files.read(previewConfigPath);
    if (!source.includes('storySort')) {
      return null;
    }
    const preview = loadConfig(source, previewConfigPath).parse();
    // Plain values come from the config editor; comparator functions (and storySort defined in
    // a named export) come from the exports map or the editor root as AST nodes.
    let storySort = preview.getValue(storySortPath);
    let comparator =
      storySort === undefined || storySort === null
        ? (movableFunction(preview.getFieldNode(storySortPath)) ??
          movableFunction(preview.get(storySortPath)))
        : undefined;
    // When the editor walk misses, a later default export has shadowed the named parameters
    // export; the program scan owns capture and removal for that shape.
    const walkMissed = (storySort === undefined || storySort === null) && comparator === undefined;
    if (walkMissed) {
      const scanned = scanStorySort(preview._ast.program);
      if (scanned) {
        if (
          t.isArrowFunctionExpression(scanned.property.value) ||
          t.isFunctionExpression(scanned.property.value)
        ) {
          comparator = movableFunction(scanned.property.value);
        } else {
          storySort = readStaticValue(scanned.property.value);
        }
      }
    }
    const removal = walkMissed
      ? 'scan'
      : preview.remove(storySortPath).ok
        ? 'editor'
        : 'removeField';
    return { storySort, comparator, removal };
  },

  prompt: () =>
    `Move ${picocolors.cyan('parameters.options.storySort')} from preview to ${picocolors.cyan('storySorts')} in main?`,

  transform: ({ result: { storySort, comparator, removal } }) => [
    {
      filter: { kind: ['main'] },
      editConfig: (main) => {
        if (main.get(['storySorts'])) {
          fail('The main config already defines storySorts');
        }
        if (comparator === undefined) {
          if (storySort === null || typeof storySort !== 'object') {
            fail('storySort must be a statically readable object, array, or comparator function');
          }
          main.set(['storySorts'], [storySort]);
        } else {
          main.set(['storySorts'], t.arrayExpression([t.cloneNode(comparator, true)]));
        }
        const mainProblem = firstProblem(main);
        if (mainProblem) {
          fail(mainProblem);
        }
      },
    },
    {
      filter: { kind: ['preview'], code: 'storySort' },
      editConfig: (preview) =>
        removal === 'scan'
          ? removeScannedStorySort(preview)
          : removal === 'removeField'
            ? // Reach the export that owns storySort directly; the editor cannot mutate mixed
              // default and named exports, but the property itself is unambiguous.
              preview.removeField(storySortPath)
            : preview.remove(storySortPath),
    },
  ],
};
