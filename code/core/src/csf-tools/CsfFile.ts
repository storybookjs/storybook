import { readFile, writeFile } from 'node:fs/promises';

import {
  isExportStory,
  storyNameFromExport,
  toId,
  toTestId,
} from 'storybook/internal/csf/csf-utils';
import { logger } from 'storybook/internal/node-logger';
import type {
  ComponentAnnotations,
  IndexInput,
  IndexInputStats,
  IndexedCSFFile,
  StoryAnnotations,
} from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { Tag } from '../shared/constants/tags.ts';
import type { PrintResultType } from './PrintResultType.ts';
import { type CsfMutationDiagnostic, type CsfObject, type CsfObjectOptions } from './CsfObject.ts';
import { discoverCsfObjects } from './CsfObjectDiscovery.ts';
import {
  type E,
  type Node,
  type SourceLocation,
  identifierKey,
  isFunction,
  isIdentifier,
  isRegExpLiteral,
  isStringLiteral,
  locationOf,
  unwrapExpression,
} from './estree/ast.ts';
import { SourceEditor, appendStatement } from './estree/editor.ts';
import { generateUid } from './estree/scope.ts';
import { findVarInitialization } from './findVarInitialization.ts';

type CsfMutationState = {
  diagnostics: CsfMutationDiagnostic[];
  changed: boolean;
};

const mutationStates = new WeakMap<CsfFile, CsfMutationState>();

const PREVIEW_FILE_REGEX = /\/preview(.(js|jsx|mjs|ts|tsx))?$/;
export const isValidPreviewPath = (filepath: string) => PREVIEW_FILE_REGEX.test(filepath);

type StaticIdentifierMemberCall = E.CallExpression & {
  callee: E.StaticMemberExpression & { object: E.IdentifierReference; property: E.IdentifierName };
};

type CsfFactoryCall = E.CallExpression & {
  callee: E.StaticMemberExpression & { property: E.IdentifierName };
};

export const isCanonicalCsf2BindCall = (
  node: Node | null | undefined
): node is StaticIdentifierMemberCall =>
  node?.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  !node.callee.computed &&
  node.callee.object.type === 'Identifier' &&
  isIdentifier(node.callee.property, 'bind') &&
  (node.arguments.length === 0 ||
    (node.arguments.length === 1 &&
      node.arguments[0].type === 'ObjectExpression' &&
      node.arguments[0].properties.length === 0));

/** Receiver of a `.type<T>()` chain, which returns its receiver: `meta` for `meta.type<T>()`. */
export const withoutTypeCalls = (object: Node): Node =>
  object.type === 'CallExpression' &&
  object.arguments.length === 0 &&
  object.callee.type === 'MemberExpression' &&
  !object.callee.computed &&
  isIdentifier(object.callee.property, 'type')
    ? withoutTypeCalls(object.callee.object)
    : object;

export const isCsfFactoryCall = (node: Node | null | undefined): node is CsfFactoryCall =>
  node?.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  !node.callee.computed &&
  withoutTypeCalls(node.callee.object).type === 'Identifier' &&
  node.callee.property.type === 'Identifier' &&
  (node.callee.property.name === 'story' || node.callee.property.name === 'extend');

/** Identifier a CSF factory call is made on: `meta` in `meta.type<T>().story()`. */
export const csfFactoryReceiver = (node: CsfFactoryCall): E.IdentifierReference =>
  withoutTypeCalls(node.callee.object) as E.IdentifierReference;

function parseIncludeExclude(prop: Node) {
  if (prop.type === 'ArrayExpression') {
    return prop.elements.map((e) => {
      if (isStringLiteral(e)) {
        return e.value;
      }
      throw new Error(`Expected string literal: ${e}`);
    });
  }

  if (isStringLiteral(prop)) {
    return new RegExp(prop.value);
  }

  if (isRegExpLiteral(prop)) {
    return new RegExp(prop.regex.pattern, prop.regex.flags);
  }

  throw new Error(`Unknown include/exclude: ${prop}`);
}

function parseTags(prop: Node | null | undefined) {
  if (prop?.type !== 'ArrayExpression') {
    throw new Error('CSF: Expected tags array');
  }

  return prop.elements.map((e) => {
    if (isStringLiteral(e)) {
      return e.value;
    }
    throw new Error(`CSF: Expected tag to be string literal`);
  }) as Tag[];
}

function parseTestTags(optionsNode: Node | null | undefined, program: E.Program) {
  if (!optionsNode) {
    return [] as string[];
  }

  let node: Node | null = optionsNode;
  if (node.type === 'Identifier') {
    node = findVarInitialization(node.name, program);
  }

  if (node?.type === 'ObjectExpression') {
    const tagsProp = node.properties.find(
      (property): property is E.ObjectProperty =>
        property.type === 'Property' && identifierKey(property) === 'tags' && !property.method
    );

    if (tagsProp) {
      let tagsNode: Node | null = tagsProp.value;
      if (tagsNode.type === 'Identifier') {
        tagsNode = findVarInitialization(tagsNode.name, program);
      }
      return parseTags(tagsNode);
    }
  }

  return [] as string[];
}

/** Anything an error can point at: a node with a location, or nothing. */
export type Located = { loc?: SourceLocation | null } | null | undefined;

const formatLocation = (node: Located, fileName?: string) => {
  let loc = '';
  if (node?.loc) {
    const { line, column } = node.loc.start;
    loc = `(line ${line}, col ${column})`;
  }
  return `${fileName || ''} ${loc}`.trim();
};

export const isModuleMock = (importPath: string) => MODULE_MOCK_REGEX.test(importPath);

const isArgsStory = (init: Node, isTopLevel: boolean, csf: CsfFile) => {
  let storyFn: Node | null = init;
  // export const Foo = Bar.bind({})
  if (isTopLevel && isCanonicalCsf2BindCall(init)) {
    const boundIdentifier = init.callee.object.name;
    const template = findVarInitialization(boundIdentifier, csf._program);
    if (template) {
      csf._templates[boundIdentifier] = template;
      storyFn = template;
    }
  }
  if (storyFn?.type === 'ArrowFunctionExpression' || storyFn?.type === 'FunctionDeclaration') {
    return storyFn.params.length > 0;
  }
  return false;
};

const parseExportsOrder = (init: Node | null) => {
  if (init?.type === 'ArrayExpression') {
    return init.elements.map((item) => {
      if (isStringLiteral(item)) {
        return item.value;
      }
      throw new Error(`Expected string literal named export: ${item}`);
    });
  }
  throw new Error(`Expected array of string literals: ${init}`);
};

const sortExports = (exportByName: Record<string, any>, order: string[]) => {
  return order.reduce(
    (acc, name) => {
      const namedExport = exportByName[name];

      if (namedExport) {
        acc[name] = namedExport;
      }
      return acc;
    },
    {} as Record<string, any>
  );
};

const hasMount = (play: Node | undefined) => {
  if (
    play?.type === 'ArrowFunctionExpression' ||
    play?.type === 'FunctionDeclaration' ||
    // Object methods are stored as their function expression.
    play?.type === 'FunctionExpression'
  ) {
    const [arg] = play.params;
    if (arg?.type === 'ObjectPattern') {
      return arg.properties.some(
        (prop) => prop.type === 'Property' && identifierKey(prop) === 'mount'
      );
    }
  }
  return false;
};

const MODULE_MOCK_REGEX = /^[.\/#].*\.mock($|\.[^.]*$)/i;

export interface CsfOptions {
  fileName?: string;
  makeTitle: (userTitle: string) => string;
  /**
   * If an inline meta is detected e.g. `export default { title: 'foo' }` it will be transformed
   * into a constant format e.g. `const _meta = { title: 'foo' }; export default _meta;`
   */
  transformInlineMeta?: boolean;
}

export class NoMetaError extends Error {
  constructor(message: string, ast: Located, fileName?: string) {
    const msg = message.trim();
    super(dedent`
      CSF: ${msg} ${formatLocation(ast, fileName)}

      More info: https://storybook.js.org/docs/writing-stories?ref=error#default-export
    `);
    this.name = this.constructor.name;
  }
}

export class MultipleMetaError extends Error {
  constructor(message: string, ast: Located, fileName?: string) {
    super(dedent`
      CSF: ${message} ${formatLocation(ast, fileName)}

      More info: https://storybook.js.org/docs/writing-stories?ref=error#default-export
    `);
    this.name = this.constructor.name;
  }
}

export class MixedFactoryError extends Error {
  constructor(message: string, ast: Located, fileName?: string) {
    super(dedent`
      CSF: ${message} ${formatLocation(ast, fileName)}

      More info: https://storybook.js.org/docs/writing-stories?ref=error#default-export
    `);
    this.name = this.constructor.name;
  }
}

export class BadMetaError extends Error {
  constructor(message: string, ast: Located, fileName?: string) {
    super(dedent`
      CSF: ${message} ${formatLocation(ast, fileName)}

      More info: https://storybook.js.org/docs/writing-stories?ref=error#default-export
    `);
    this.name = this.constructor.name;
  }
}

export interface StaticMeta extends Pick<
  ComponentAnnotations,
  'id' | 'title' | 'includeStories' | 'excludeStories' | 'tags'
> {
  component?: string;
}

export interface StaticStory extends Pick<StoryAnnotations, 'name' | 'parameters' | 'tags'> {
  id: string;
  localName?: string;
  __stats: IndexInputStats;
}

export interface StoryTest {
  node: Node;
  function: Node;
  name: string;
  id: string;
  tags: string[];
  parent: { node: Node | undefined };
}

export class CsfFile {
  _editor: SourceEditor;

  _options: CsfOptions;

  _rawComponentPath?: string;

  _componentImportSpecifier?: E.ImportSpecifier | E.ImportDefaultSpecifier;

  _meta?: StaticMeta;

  _stories: Record<string, StaticStory> = {};

  _metaAnnotations: Record<string, Node> = {};

  _storyExports: Record<string, E.VariableDeclarator | E.Function> = {};

  /** The `export` statement of each story (the declaration for `export { X as Y }`). */
  _storyStatements: Record<string, E.ExportNamedDeclaration | Node> = {};

  _metaStatement: Node | undefined;

  _metaNode: E.ObjectExpression | undefined;

  _metaVariableName: string | undefined;

  _metaIsFactory: boolean | undefined;

  _metaFactoryCall: E.CallExpression | undefined;

  /**
   * True when the CSF factory configuration could not be resolved to an object literal in this
   * file, so `_metaNode` is a stand-in that is not part of the AST. Writes to it are discarded.
   */
  _metaNodeIsSynthetic: boolean | undefined;

  _storyAnnotations: Record<string, Record<string, Node>> = {};

  _templates: Record<string, Node> = {};

  _namedExportsOrder?: string[];

  imports: string[];

  _tests: StoryTest[] = [];

  constructor(code: string, options: CsfOptions) {
    this._editor = new SourceEditor(code, options.fileName);
    this._options = options;
    this.imports = [];
    mutationStates.set(this, { diagnostics: [], changed: false });
  }

  get _program(): E.Program {
    return this._editor.program;
  }

  get _code(): string {
    return this._editor.code;
  }

  /** Source location of a node in the current source, for error messages and diagnostics. */
  _loc(node: Node | { start: number; end: number } | undefined): Located {
    const span = node as { start?: number; end?: number } | undefined;
    return typeof span?.start === 'number' && typeof span.end === 'number'
      ? { loc: locationOf(this._editor.code, span.start, span.end) }
      : undefined;
  }

  /**
   * Read diagnostics from object discovery, reads, and mutations. Check them before writing
   * because a file can contain both successful edits and unsupported targets.
   *
   * @example
   * ```ts
   * const [story] = csf.objects({ meta: false });
   * story.set(['args', 'old'], 1);
   * story.set(['args', 'current'], 2);
   * story.rename(['args', 'old'], 'current');
   * csf.mutationDiagnostics.map(({ code }) => code); // ['occupied-destination']
   * ```
   */
  get mutationDiagnostics(): readonly CsfMutationDiagnostic[] {
    return [...mutationStates.get(this)!.diagnostics];
  }

  /**
   * Report whether any object editor has changed this story file.
   *
   * @example
   * ```ts
   * csf.changed; // false, before any edits
   * const [story] = csf.objects({ meta: false });
   * story.set(['args', 'disabled'], true);
   * csf.changed; // true
   * ```
   */
  get changed() {
    return mutationStates.get(this)!.changed;
  }

  /**
   * Discover editors for the meta and stories, including CSF2 parameter assignments. Unsupported
   * targets are skipped and reported in `mutationDiagnostics`.
   *
   * @example
   * ```ts
   * const csf = loadCsf('export default {}; export const Primary = {};', {
   *   makeTitle: () => 'Example',
   * }).parse();
   * const [story] = csf.objects({ meta: false });
   * story.set(['args', 'disabled'], true);
   * story.getValue(['args']); // { disabled: true }
   * csf.changed; // true
   * ```
   */
  objects(options: CsfObjectOptions = {}): readonly CsfObject[] {
    const state = mutationStates.get(this)!;
    return discoverCsfObjects(
      this,
      options,
      (diagnostic) => state.diagnostics.push(diagnostic),
      () => {
        state.changed = true;
      }
    );
  }

  /**
   * Append a statement after the file's code, for CSF enrichers. It is printed by `formatCsf`
   * together with every other pending edit.
   */
  _appendStatement(code: string) {
    appendStatement(this._editor, code);
  }

  /** Applies pending source edits and parses the result again, refreshing every field. */
  _commit() {
    if (!this._editor.commit()) {
      return;
    }
    this._reset();
    this.parse();
  }

  _reset() {
    this._rawComponentPath = undefined;
    this._componentImportSpecifier = undefined;
    this._meta = undefined;
    this._stories = {};
    this._metaAnnotations = {};
    this._storyExports = {};
    this._storyStatements = {};
    this._metaStatement = undefined;
    this._metaNode = undefined;
    this._metaVariableName = undefined;
    this._metaIsFactory = undefined;
    this._metaFactoryCall = undefined;
    this._metaNodeIsSynthetic = undefined;
    this._storyAnnotations = {};
    this._templates = {};
    this._namedExportsOrder = undefined;
    this.imports = [];
    this._tests = [];
  }

  _parseTitle(value: Node) {
    const node =
      value.type === 'Identifier' ? findVarInitialization(value.name, this._program) : value;
    if (isStringLiteral(node)) {
      return node.value;
    }
    if (node?.type === 'TSSatisfiesExpression' && isStringLiteral(node.expression)) {
      return node.expression.value;
    }

    throw new Error(dedent`
      CSF: unexpected dynamic title ${formatLocation(this._loc(node ?? undefined), this._options.fileName)}

      More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#string-literal-titles
    `);
  }

  _parseMeta(declaration: E.ObjectExpression, program: E.Program) {
    if (this._metaNode) {
      throw new MultipleMetaError(
        'multiple meta objects',
        this._loc(declaration),
        this._options.fileName
      );
    }
    this._metaNode = declaration;
    const meta: StaticMeta = {};
    for (const p of declaration.properties) {
      const key = identifierKey(p);
      if (p.type !== 'Property' || key === undefined) {
        continue;
      }
      this._metaAnnotations[key] = p.value;

      if (key === 'title') {
        meta.title = this._parseTitle(p.value);
      } else if (key === 'includeStories' || key === 'excludeStories') {
        (meta as any)[key] = parseIncludeExclude(p.value);
      } else if (key === 'component') {
        const n = p.value;
        if (n.type === 'Identifier') {
          const id = n.name;
          const importStmt = program.body.find(
            (stmt): stmt is E.ImportDeclaration =>
              stmt.type === 'ImportDeclaration' &&
              stmt.specifiers.some((spec) => spec.local.name === id)
          );
          if (importStmt) {
            // Example: `import { ComponentImport } from './path-to-component'`
            // const meta = { component: ComponentImport };
            // Sets:
            // - _rawComponentPath = './path-to-component'
            // - _componentImportSpecifier = ComponentImport
            const specifier = importStmt.specifiers.find((spec) => spec.local.name === id);
            if (specifier) {
              this._rawComponentPath = importStmt.source.value;
              if (
                specifier.type === 'ImportSpecifier' ||
                specifier.type === 'ImportDefaultSpecifier'
              ) {
                this._componentImportSpecifier = specifier;
              }
            }
          }
        }
        meta.component = this._editor.source(p.value);
      } else if (key === 'tags') {
        let node: Node | null = p.value;
        if (node.type === 'Identifier') {
          node = findVarInitialization(node.name, this._program);
        }
        meta.tags = parseTags(node);
      } else if (key === 'id') {
        if (isStringLiteral(p.value)) {
          meta.id = p.value.value;
        } else {
          throw new Error(`Unexpected component id: ${p.value}`);
        }
      }
    }
    this._meta = meta;
  }

  getStoryExport(key: string): Node {
    let node: Node | null = this._storyExports[key];
    node = node?.type === 'VariableDeclarator' ? node.init : node;
    if (isCanonicalCsf2BindCall(node)) {
      node = this._templates[node.callee.object.name];
    }
    return node as Node;
  }

  _metaObjectFrom(decl: Node | null | undefined): E.ObjectExpression | undefined {
    if (decl?.type === 'ObjectExpression') {
      // export default { ... };
      return decl;
    }
    if (
      // export default { ... } as Meta<...>
      // export default { ... } satisfies Meta<...>
      (decl?.type === 'TSAsExpression' || decl?.type === 'TSSatisfiesExpression') &&
      decl.expression.type === 'ObjectExpression'
    ) {
      return decl.expression;
    }
    if (
      // export default { ... } satisfies Meta as Meta<...>
      decl?.type === 'TSAsExpression' &&
      decl.expression.type === 'TSSatisfiesExpression' &&
      decl.expression.expression.type === 'ObjectExpression'
    ) {
      return decl.expression.expression;
    }
    return undefined;
  }

  _visitExportDefault(node: E.ExportDefaultDeclaration) {
    const isVariableReference = node.declaration.type === 'Identifier';

    let decl: Node | null | undefined;
    if (
      this._options.transformInlineMeta &&
      !isVariableReference &&
      node.declaration.type !== 'FunctionDeclaration' &&
      node.declaration.type !== 'ClassDeclaration' &&
      node.declaration.type !== 'TSInterfaceDeclaration'
    ) {
      /**
       * Transform inline default exports into a constant declaration as it is needed for the
       * Vitest plugin to compose stories using CSF1 through CSF3 should not be needed at all once
       * we move to CSF4 entirely
       *
       * `export default {};`
       *
       * Becomes
       *
       * `const _meta = {}; export default _meta;`
       */
      const metaName = generateUid(this._editor.scopes, 'meta');
      this._metaVariableName = metaName;
      const declaration = node.declaration as Node & { start: number; end: number };
      this._editor.edits.overwrite(node.start, declaration.start, `const ${metaName} = `);
      this._editor.edits.appendLeft(node.end, `\nexport default ${metaName};`);
      this._metaStatement = node;
      decl = declaration;
    } else if (isVariableReference) {
      // const meta = { ... };
      // export default meta;
      const variableName = (node.declaration as E.IdentifierReference).name;
      this._metaVariableName = variableName;
      const statement = this._program.body.find(
        (candidate): candidate is E.VariableDeclaration =>
          candidate.type === 'VariableDeclaration' &&
          candidate.declarations.some((d) => isIdentifier(d.id, variableName))
      );
      this._metaStatement = statement;
      decl = statement?.declarations.find((d) => isIdentifier(d.id, variableName))?.init;
    } else {
      this._metaStatement = node;
      decl = node.declaration;
    }

    const metaNode = this._metaObjectFrom(decl);
    if (metaNode) {
      this._parseMeta(metaNode, this._program);
    }

    if (this._metaStatement && !this._metaNode) {
      throw new NoMetaError(
        'default export must be an object',
        this._loc(this._metaStatement),
        this._options.fileName
      );
    }
  }

  _visitExportNamed(node: E.ExportNamedDeclaration, isTopLevel: boolean) {
    const { declaration } = node;
    let declarations: (E.VariableDeclarator | E.Function)[] | undefined;
    if (declaration?.type === 'VariableDeclaration') {
      declarations = declaration.declarations;
    } else if (declaration?.type === 'FunctionDeclaration') {
      declarations = [declaration];
    }
    if (declarations) {
      // export const X = ...;
      for (const decl of declarations) {
        const id = decl.id;
        if (id?.type !== 'Identifier') {
          continue;
        }
        const exportName = id.name;
        if (exportName === '__namedExportsOrder' && decl.type === 'VariableDeclarator') {
          this._namedExportsOrder = parseExportsOrder(decl.init);
          continue;
        }

        // Determine the story node, unwrapping TS expressions
        let storyNode: Node | null | undefined;
        if (decl.type === 'VariableDeclarator') {
          const init = decl.init;
          if (init?.type === 'TSAsExpression' && init.expression.type === 'TSSatisfiesExpression') {
            // { ... } satisfies Meta<...> as Meta<...>
            storyNode = init.expression.expression;
          } else if (init?.type === 'TSAsExpression' || init?.type === 'TSSatisfiesExpression') {
            // { ... } as Meta<...>
            // { ... } satisfies Meta<...>
            storyNode = init.expression;
          } else {
            storyNode = init;
          }
        } else {
          storyNode = decl;
        }

        // Check if this is a factory story (meta.story() or meta.extend())
        let storyIsFactory = false;
        if (isCsfFactoryCall(storyNode)) {
          storyIsFactory = true;
          storyNode = storyNode.arguments[0] as Node | undefined;
        }

        // Skip non-factory exports in factory files
        if (this._metaIsFactory && !storyIsFactory) {
          continue;
        }

        if (!this._metaIsFactory && storyIsFactory) {
          if (this._metaNode) {
            throw new MixedFactoryError(
              'expected non-factory story',
              this._loc(storyNode ?? undefined),
              this._options.fileName
            );
          } else {
            throw new BadMetaError(
              'meta() factory must be imported from .storybook/preview configuration',
              this._loc(storyNode ?? undefined),
              this._options.fileName
            );
          }
        }

        // Now we know this is a valid story, register it
        this._storyExports[exportName] = decl;
        this._storyStatements[exportName] = node;
        let name = storyNameFromExport(exportName);
        if (this._storyAnnotations[exportName]) {
          logger.warn(`Unexpected annotations for "${exportName}" before story declaration`);
        } else {
          this._storyAnnotations[exportName] = {};
        }

        const parameters: { [key: string]: any } = {};
        if (storyNode?.type === 'ObjectExpression') {
          parameters.__isArgsStory = true; // assume default render is an args story
          // CSF3 object export
          for (const p of storyNode.properties) {
            const key = identifierKey(p);
            if (p.type !== 'Property' || key === undefined) {
              continue;
            }
            if (p.method) {
              this._storyAnnotations[exportName][key] = p.value;
              continue;
            }
            if (key === 'render') {
              parameters.__isArgsStory = isArgsStory(p.value, isTopLevel, this);
            } else if (key === 'name' && isStringLiteral(p.value)) {
              name = p.value.value;
            } else if (key === 'storyName' && isStringLiteral(p.value)) {
              logger.warn(
                `Unexpected usage of "storyName" in "${exportName}". Please use "name" instead.`
              );
            } else if (key === 'parameters' && p.value.type === 'ObjectExpression') {
              const idProperty = p.value.properties.find(
                (property): property is E.ObjectProperty =>
                  property.type === 'Property' && identifierKey(property) === '__id'
              );
              if (idProperty) {
                parameters.__id = (idProperty.value as E.StringLiteral).value;
              }
            }
            this._storyAnnotations[exportName][key] = p.value;
          }
        } else {
          parameters.__isArgsStory = storyNode ? isArgsStory(storyNode, isTopLevel, this) : false;
        }
        this._stories[exportName] = {
          id: 'FIXME',
          name,
          parameters,
          __stats: {
            factory: storyIsFactory,
          },
        };
      }
    } else if (node.specifiers.length > 0) {
      // export { X as Y }
      for (const specifier of node.specifiers) {
        if (specifier.local.type !== 'Identifier') {
          continue;
        }
        const exportName =
          specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : (specifier.exported as E.StringLiteral).value;
        const localName = specifier.local.name;
        const decl = isTopLevel ? findVarInitialization(localName, this._program) : specifier.local;

        if (exportName === 'default') {
          this._metaVariableName = localName;
          const metaNode = this._metaObjectFrom(decl);
          if (metaNode && isTopLevel) {
            this._parseMeta(metaNode, this._program);
          }
        } else {
          const annotations = {} as Record<string, Node>;
          const storyNode = decl;
          if (storyNode?.type === 'ObjectExpression') {
            for (const p of storyNode.properties) {
              const key = identifierKey(p);
              if (p.type === 'Property' && key !== undefined) {
                annotations[key] = p.value;
              }
            }
          }
          this._storyAnnotations[exportName] = annotations;
          this._storyStatements[exportName] = decl as Node;
          this._stories[exportName] = {
            id: 'FIXME',
            name: exportName,
            localName,
            parameters: {},
            __stats: {},
          };
        }
      }
    }
  }

  _visitExpressionStatement(node: E.ExpressionStatement, isTopLevel: boolean) {
    const { expression } = node;
    // B.storyName = 'some string';
    if (
      isTopLevel &&
      expression.type === 'AssignmentExpression' &&
      expression.left.type === 'MemberExpression' &&
      expression.left.object.type === 'Identifier' &&
      expression.left.property.type === 'Identifier'
    ) {
      const exportName = expression.left.object.name;
      const annotationKey = expression.left.property.name;
      const annotationValue = expression.right;

      // v1-style annotation
      // A.story = { parameters: ..., decorators: ... }

      if (this._storyAnnotations[exportName]) {
        if (annotationKey === 'story' && annotationValue.type === 'ObjectExpression') {
          for (const prop of annotationValue.properties) {
            const key = identifierKey(prop);
            if (prop.type === 'Property' && key !== undefined) {
              this._storyAnnotations[exportName][key] = prop.value;
            }
          }
        } else {
          this._storyAnnotations[exportName][annotationKey] = annotationValue;
        }
      }

      if (annotationKey === 'storyName' && isStringLiteral(annotationValue)) {
        const storyName = annotationValue.value;
        const story = this._stories[exportName];

        if (story) {
          story.name = storyName;
        }
      }
    }
    // B.test('foo', () => {})
    // B.test('foo', context, () => {})
    if (
      expression.type === 'CallExpression' &&
      expression.callee.type === 'MemberExpression' &&
      expression.callee.object.type === 'Identifier' &&
      expression.callee.property.type === 'Identifier' &&
      expression.callee.property.name === 'test' &&
      expression.arguments.length >= 2 &&
      isStringLiteral(expression.arguments[0])
    ) {
      const exportName = expression.callee.object.name;
      const testName = expression.arguments[0].value;
      const testFunction =
        expression.arguments.length === 2 ? expression.arguments[1] : expression.arguments[2];
      const testArguments = expression.arguments.length === 2 ? null : expression.arguments[1];
      const tags = parseTestTags(testArguments, this._program);

      this._tests.push({
        function: testFunction,
        name: testName,
        node: expression,
        // can't set id because meta title isn't available yet
        // so it's set later on
        id: 'FIXME',
        tags,
        parent: { node: this._storyStatements[exportName] },
      });

      // TODO: fix this when stories fail
      this._stories[exportName].__stats.tests = true;
    }
  }

  _visitCallExpression(node: E.CallExpression, ancestors: Node[]) {
    const { callee } = node;
    if (isIdentifier(callee, 'storiesOf')) {
      throw new Error(dedent`
        Unexpected \`storiesOf\` usage: ${formatLocation(this._loc(node), this._options.fileName)}.

        SB8 does not support \`storiesOf\`.
      `);
    }
    if (
      callee.type === 'MemberExpression' &&
      isIdentifier(callee.property, 'meta') &&
      !callee.computed
    ) {
      // Find the root object for factory pattern:
      // - preview.meta() => preview
      // - preview.type().meta() => preview
      let rootObject: Node = callee.object;
      if (rootObject.type === 'CallExpression' && rootObject.callee.type === 'MemberExpression') {
        rootObject = rootObject.callee.object;
      }

      if (rootObject.type === 'Identifier') {
        const configCandidate = this._editor.scopes.bindingOf(rootObject);
        const configParent = configCandidate?.declaration;
        if (configParent?.type === 'ImportDeclaration') {
          if (isValidPreviewPath(configParent.source.value)) {
            this._metaIsFactory = true;
            this._metaFactoryCall = node;
            const metaDeclarator = ancestors.findLast(
              (ancestor): ancestor is E.VariableDeclarator => ancestor.type === 'VariableDeclarator'
            );

            // find the name of the meta variable declaration
            // e.g. const foo = preview.meta({ ... });
            // otherwise fallback to meta
            this._metaVariableName =
              metaDeclarator?.id.type === 'Identifier' ? metaDeclarator.id.name : 'meta';
            const [argument] = node.arguments;
            const argumentBinding =
              argument?.type === 'Identifier' ? this._editor.scopes.bindingOf(argument) : undefined;
            const argumentNode =
              argumentBinding?.constant && argumentBinding.node.type === 'VariableDeclarator'
                ? argumentBinding.node.init
                : argument;
            const unwrappedArgument = argumentNode && unwrapExpression(argumentNode as Node);
            if (unwrappedArgument?.type === 'ObjectExpression') {
              this._parseMeta(unwrappedArgument, this._program);
            } else {
              this._metaNodeIsSynthetic = true;
              this._parseMeta(
                { type: 'ObjectExpression', properties: [], start: node.start, end: node.start },
                this._program
              );
            }
          } else if (rootObject.name === 'preview') {
            // Only throw if the variable is named "preview" - this indicates
            // the user is trying to use CSF Factories but with a wrong import path.
            // Other .meta() calls (e.g., Zod v4's .meta()) are silently ignored.
            throw new BadMetaError(
              'meta() factory must be imported from .storybook/preview configuration',
              this._loc(configParent),
              this._options.fileName
            );
          }
        }
      }
    }
  }

  parse() {
    const visit = (node: Node, ancestors: Node[]) => {
      const parent = ancestors.at(-1);
      const isTopLevel = parent?.type === 'Program';
      switch (node.type) {
        case 'ImportDeclaration':
          this.imports.push(node.source.value);
          return;
        case 'ExportDefaultDeclaration':
          this._visitExportDefault(node);
          break;
        case 'ExportNamedDeclaration':
          this._visitExportNamed(node, isTopLevel);
          break;
        case 'ExpressionStatement':
          this._visitExpressionStatement(node, isTopLevel);
          break;
        case 'CallExpression':
          this._visitCallExpression(node, ancestors);
          break;
      }
      ancestors.push(node);
      for (const child of childNodes(node)) {
        visit(child, ancestors);
      }
      ancestors.pop();
    };
    visit(this._program, []);

    if (!this._meta) {
      // Point at the start of the file, like Babel's `File` node; OXC's program starts at its first statement.
      throw new NoMetaError(
        'missing default export',
        this._loc({ start: 0, end: 0 }),
        this._options.fileName
      );
    }

    // default export can come at any point in the file, so we do this post processing last
    const entries = Object.entries(this._stories);
    this._meta.title = this._options.makeTitle(this._meta?.title as string);
    if (this._metaAnnotations.play) {
      this._meta.tags = [...(this._meta.tags || []), Tag.PLAY_FN];
    }
    this._stories = entries.reduce(
      (acc, [key, story]) => {
        if (!isExportStory(key, this._meta as StaticMeta)) {
          return acc;
        }
        const id =
          story.parameters?.__id ??
          toId((this._meta?.id || this._meta?.title) as string, storyNameFromExport(key));
        const parameters: Record<string, any> = { ...story.parameters, __id: id };

        const { includeStories } = this._meta || {};
        if (
          key === '__page' &&
          (entries.length === 1 || (Array.isArray(includeStories) && includeStories.length === 1))
        ) {
          parameters.docsOnly = true;
        }
        acc[key] = { ...story, id, parameters };
        const storyAnnotations = this._storyAnnotations[key];
        const { tags, play } = storyAnnotations;
        if (tags) {
          const node =
            tags.type === 'Identifier' ? findVarInitialization(tags.name, this._program) : tags;
          acc[key].tags = parseTags(node);
        }
        if (play) {
          acc[key].tags = [...(acc[key].tags || []), Tag.PLAY_FN];
        }
        const stats = acc[key].__stats;
        ['play', 'render', 'loaders', 'beforeEach', 'globals', 'tags'].forEach((annotation) => {
          stats[annotation as keyof IndexInputStats] =
            !!storyAnnotations[annotation] || !!this._metaAnnotations[annotation];
        });
        const storyExport = this.getStoryExport(key);
        stats.storyFn = !!(
          storyExport?.type === 'ArrowFunctionExpression' ||
          storyExport?.type === 'FunctionDeclaration'
        );
        stats.mount = hasMount(storyAnnotations.play ?? this._metaAnnotations.play);
        stats.moduleMock = !!this.imports.find((fname) => isModuleMock(fname));

        const storyNode = this._storyStatements[key];
        const storyTests = this._tests.filter((t) => t.parent.node === storyNode);
        if (storyTests.length > 0) {
          // TODO: [test-syntax] if we want to add a tag for the story that contains tests, this is the place for it
          // acc[key].tags = [...(acc[key].tags || []), 'story-with-tests'];

          stats.tests = true;
          storyTests.forEach((test) => {
            test.id = toTestId(id, test.name);
          });
        }

        return acc;
      },
      {} as Record<string, StaticStory>
    );

    Object.keys(this._storyExports).forEach((key) => {
      if (!isExportStory(key, this._meta as StaticMeta)) {
        delete this._storyExports[key];
        delete this._storyAnnotations[key];
        delete this._storyStatements[key];
      }
    });

    if (this._namedExportsOrder) {
      const unsortedExports = Object.keys(this._storyExports);
      this._storyExports = sortExports(this._storyExports, this._namedExportsOrder);
      this._stories = sortExports(this._stories, this._namedExportsOrder);

      const sortedExports = Object.keys(this._storyExports);
      if (unsortedExports.length !== sortedExports.length) {
        throw new Error(
          `Missing exports after sort: ${unsortedExports.filter(
            (key) => !sortedExports.includes(key)
          )}`
        );
      }
    }

    return this as CsfFile & IndexedCSFFile;
  }

  public get meta() {
    return this._meta;
  }

  public get stories() {
    return Object.values(this._stories);
  }

  public getStoryTests(story: string | Node) {
    const storyNode = typeof story === 'string' ? this._storyStatements[story] : story;
    if (!storyNode) {
      return [];
    }
    return this._tests.filter((t) => t.parent.node === storyNode);
  }

  public get indexInputs(): IndexInput[] {
    const { fileName } = this._options;
    if (!fileName) {
      throw new Error(
        dedent`Cannot automatically create index inputs with CsfFile.indexInputs because the CsfFile instance was created without a the fileName option.
        Either add the fileName option when creating the CsfFile instance, or create the index inputs manually.`
      );
    }

    const index: IndexInput[] = [];

    Object.entries(this._stories).map(([exportName, story]) => {
      // don't remove any duplicates or negations -- tags will be combined in the index
      const tags = [...(this._meta?.tags ?? []), ...(story.tags ?? [])];
      const storyInput = {
        rawComponentPath: this._rawComponentPath,
        exportName,
        title: this.meta?.title,
        metaId: this.meta?.id,
        tags,
        __id: story.id,
        __stats: story.__stats,
      };

      const tests = this.getStoryTests(exportName);
      const hasTests = tests.length > 0;

      index.push({
        ...storyInput,
        type: 'story',
        subtype: 'story',
        name: story.name,
      });

      if (hasTests) {
        tests.forEach((test) => {
          index.push({
            ...storyInput,
            // TODO implementent proper title => path behavior in `transformStoryIndexToStoriesHash`
            // title: `${storyInput.title}/${story.name}`,
            type: 'story',
            subtype: 'test',
            name: test.name,
            parent: story.id,
            parentName: story.name,
            tags: [
              ...storyInput.tags,
              // this tag comes before test tags so users can invert if they like
              `!${Tag.AUTODOCS}`,
              ...test.tags,
              // this tag comes after test tags so users can't change it
              Tag.TEST_FN,
            ],
            __id: test.id,
          });
        });
      }
    });

    return index;
  }
}

/** Children in source order; type annotations are skipped since CSF never reads them. */
const childNodes = (node: Node): Node[] => {
  const result: Node[] = [];
  for (const key in node) {
    if (
      key === 'parent' ||
      key === 'typeAnnotation' ||
      key === 'returnType' ||
      key === 'typeParameters' ||
      key === 'typeArguments'
    ) {
      continue;
    }
    const value = (node as any)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && typeof item.type === 'string') {
          result.push(item);
        }
      }
    } else if (value && typeof value === 'object' && typeof value.type === 'string') {
      result.push(value);
    }
  }
  return result.sort((a: any, b: any) => a.start - b.start);
};

export const loadCsf = (code: string, options: CsfOptions) => new CsfFile(code, options);

export interface FormatCsfOptions {
  sourceMaps?: boolean;
}

/**
 * Print the file with its pending edits. With `sourceMaps`, returns the code and a hi-res source map
 * from the loaded code to the output.
 */
export const formatCsf = (
  csf: CsfFile,
  options: FormatCsfOptions = { sourceMaps: false }
): { code: string; map: ReturnType<SourceEditor['edits']['generateMap']> } | string => {
  const code = csf._editor.toString();
  if (!options.sourceMaps) {
    return code;
  }
  return {
    code,
    map: csf._editor.edits.generateMap({
      hires: true,
      source: csf._options.fileName,
      includeContent: true,
    }),
  };
};

/** Print the file with its pending edits; untouched code is preserved byte for byte. */
export const printCsf = (csf: CsfFile): PrintResultType => {
  // Written files always use LF line endings, whatever the input used.
  const code = csf._editor.toString().replace(/\r\n?/g, '\n');
  return { code, toString: () => code };
};

export const readCsf = async (fileName: string, options: CsfOptions) => {
  const code = (await readFile(fileName, 'utf-8')).toString();
  return loadCsf(code, { ...options, fileName });
};

export const writeCsf = async (csf: CsfFile, fileName?: string) => {
  const fname = fileName || csf._options.fileName;

  if (!fname) {
    throw new Error('Please specify a fileName for writeCsf');
  }
  await writeFile(fileName as string, printCsf(csf).code);
};

export { isFunction };
