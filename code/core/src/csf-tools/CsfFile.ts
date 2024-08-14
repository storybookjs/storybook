/* eslint-disable no-underscore-dangle */
import { readFile, writeFile } from 'node:fs/promises';

import type {
  ComponentAnnotations,
  IndexInput,
  IndexInputStats,
  IndexedCSFFile,
  StoryAnnotations,
  Tag,
} from '@storybook/core/types';
import { isExportStory, storyNameFromExport, toId } from '@storybook/csf';

// @ts-expect-error File is not yet exposed, see https://github.com/babel/babel/issues/11350#issuecomment-644118606
import { File as BabelFileClass } from '@babel/core';
import bg, { type GeneratorOptions } from '@babel/generator';
import bt from '@babel/traverse';
import * as t from '@babel/types';
import * as recast from 'recast';
import type { Options } from 'recast';
import { dedent } from 'ts-dedent';

import type { PrintResultType } from './PrintResultType';
import { babelParse } from './babelParse';
import { findVarInitialization } from './findVarInitialization';

// @ts-expect-error (needed due to it's use of `exports.default`)
const traverse = (bt.default || bt) as typeof bt;
// @ts-expect-error (needed due to it's use of `exports.default`)
const generate = (bg.default || bg) as typeof bg;

const logger = console;

// We add this BabelFile as a temporary workaround to deal with a BabelFileClass "ImportEquals should have a literal source" issue in no link mode with tsup
interface BabelFile {
  ast: t.File;
  opts: any;
  hub: any;
  metadata: object;
  path: any;
  scope: any;
  inputMap: object | null;
  code: string;
}

function parseIncludeExclude(prop: t.Node) {
  if (t.isArrayExpression(prop)) {
    return prop.elements.map((e) => {
      if (t.isStringLiteral(e)) return e.value;
      throw new Error(`Expected string literal: ${e}`);
    });
  }

  if (t.isStringLiteral(prop)) return new RegExp(prop.value);

  if (t.isRegExpLiteral(prop)) return new RegExp(prop.pattern, prop.flags);

  throw new Error(`Unknown include/exclude: ${prop}`);
}

function parseTags(prop: t.Node) {
  if (!t.isArrayExpression(prop)) {
    throw new Error('CSF: Expected tags array');
  }

  return prop.elements.map((e) => {
    if (t.isStringLiteral(e)) return e.value;
    throw new Error(`CSF: Expected tag to be string literal`);
  }) as Tag[];
}

const formatLocation = (node: t.Node, fileName?: string) => {
  const { line, column } = node.loc?.start || {};
  return `${fileName || ''} (line ${line}, col ${column})`.trim();
};

export const isModuleMock = (importPath: string) => MODULE_MOCK_REGEX.test(importPath);

const isArgsStory = (init: t.Node, parent: t.Node, csf: CsfFile) => {
  let storyFn: t.Node = init;
  // export const Foo = Bar.bind({})
  if (t.isCallExpression(init)) {
    const { callee, arguments: bindArguments } = init;
    if (
      t.isProgram(parent) &&
      t.isMemberExpression(callee) &&
      t.isIdentifier(callee.object) &&
      t.isIdentifier(callee.property) &&
      callee.property.name === 'bind' &&
      (bindArguments.length === 0 ||
        (bindArguments.length === 1 &&
          t.isObjectExpression(bindArguments[0]) &&
          bindArguments[0].properties.length === 0))
    ) {
      const boundIdentifier = callee.object.name;
      const template = findVarInitialization(boundIdentifier, parent);
      if (template) {
        csf._templates[boundIdentifier] = template;
        storyFn = template;
      }
    }
  }
  if (t.isArrowFunctionExpression(storyFn)) {
    return storyFn.params.length > 0;
  }
  if (t.isFunctionDeclaration(storyFn)) {
    return storyFn.params.length > 0;
  }
  return false;
};

const parseExportsOrder = (init: t.Expression) => {
  if (t.isArrayExpression(init)) {
    return (init.elements as t.Expression[]).map((item) => {
      if (t.isStringLiteral(item)) {
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
      if (namedExport) acc[name] = namedExport;
      return acc;
    },
    {} as Record<string, any>
  );
};

const hasMount = (play: t.Node | undefined) => {
  if (t.isArrowFunctionExpression(play) || t.isFunctionDeclaration(play)) {
    const params = play.params;
    if (params.length >= 1) {
      const [arg] = params;
      if (t.isObjectPattern(arg)) {
        return !!arg.properties.find((prop) => {
          if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
            return prop.key.name === 'mount';
          }
        });
      }
    }
  }
  return false;
};

const MODULE_MOCK_REGEX = /^[.\/#].*\.mock($|\.[^.]*$)/i;

export interface CsfOptions {
  fileName?: string;
  makeTitle: (userTitle: string) => string;
  /**
   * If an inline meta is detected e.g. `export default { title: 'foo' }`
   * it will be transformed into a constant format e.g. `export const _meta = { title: 'foo' }; export default _meta;`
   */
  transformInlineMeta?: boolean;
}

export class NoMetaError extends Error {
  constructor(message: string, ast: t.Node, fileName?: string) {
    super(dedent`
      CSF: ${message} ${formatLocation(ast, fileName)}

      More info: https://storybook.js.org/docs/react/writing-stories#default-export
    `);
    this.name = this.constructor.name;
  }
}

export interface StaticMeta
  extends Pick<
    ComponentAnnotations,
    'id' | 'title' | 'includeStories' | 'excludeStories' | 'tags'
  > {
  component?: string;
}

export interface StaticStory extends Pick<StoryAnnotations, 'name' | 'parameters' | 'tags'> {
  id: string;
  __stats: IndexInputStats;
}

export class CsfFile {
  _ast: t.File;

  _file: BabelFile;

  _options: CsfOptions;

  _rawComponentPath?: string;

  _meta?: StaticMeta;

  _stories: Record<string, StaticStory> = {};

  _metaAnnotations: Record<string, t.Node> = {};

  _storyExports: Record<string, t.VariableDeclarator | t.FunctionDeclaration> = {};

  _metaStatement: t.Statement | undefined;

  _metaNode: t.Expression | undefined;

  _metaVariableName: string | undefined;

  _storyStatements: Record<string, t.ExportNamedDeclaration | t.Expression> = {};

  _storyAnnotations: Record<string, Record<string, t.Node>> = {};

  _templates: Record<string, t.Expression> = {};

  _namedExportsOrder?: string[];

  imports: string[];

  /**
   * @deprecated use `_options.fileName` instead
   */
  get _fileName() {
    return this._options.fileName;
  }

  /**
   * @deprecated use `_options.makeTitle` instead
   */
  get _makeTitle() {
    return this._options.makeTitle;
  }

  constructor(ast: t.File, options: CsfOptions, file: BabelFile) {
    this._ast = ast;
    this._file = file;
    this._options = options;
    this.imports = [];
  }

  _parseTitle(value: t.Node) {
    const node = t.isIdentifier(value)
      ? findVarInitialization(value.name, this._ast.program)
      : value;
    if (t.isStringLiteral(node)) {
      return node.value;
    }
    if (t.isTSSatisfiesExpression(node) && t.isStringLiteral(node.expression)) {
      return node.expression.value;
    }

    throw new Error(dedent`
      CSF: unexpected dynamic title ${formatLocation(node, this._options.fileName)}

      More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#string-literal-titles
    `);
  }

  _parseMeta(declaration: t.ObjectExpression, program: t.Program) {
    const meta: StaticMeta = {};
    (declaration.properties as t.ObjectProperty[]).forEach((p) => {
      if (t.isIdentifier(p.key)) {
        this._metaAnnotations[p.key.name] = p.value;

        if (p.key.name === 'title') {
          meta.title = this._parseTitle(p.value);
        } else if (['includeStories', 'excludeStories'].includes(p.key.name)) {
          (meta as any)[p.key.name] = parseIncludeExclude(p.value);
        } else if (p.key.name === 'component') {
          const n = p.value;
          if (t.isIdentifier(n)) {
            const id = n.name;
            const importStmt = program.body.find(
              (stmt) =>
                t.isImportDeclaration(stmt) &&
                stmt.specifiers.find((spec) => spec.local.name === id)
            ) as t.ImportDeclaration;
            if (importStmt) {
              const { source } = importStmt;
              if (t.isStringLiteral(source)) {
                this._rawComponentPath = source.value;
              }
            }
          }
          const { code } = recast.print(p.value, {});
          meta.component = code;
        } else if (p.key.name === 'tags') {
          let node = p.value;
          if (t.isIdentifier(node)) {
            node = findVarInitialization(node.name, this._ast.program);
          }
          meta.tags = parseTags(node);
        } else if (p.key.name === 'id') {
          if (t.isStringLiteral(p.value)) {
            meta.id = p.value.value;
          } else {
            throw new Error(`Unexpected component id: ${p.value}`);
          }
        }
      }
    });
    this._meta = meta;
  }

  getStoryExport(key: string) {
    let node = this._storyExports[key] as t.Node;
    node = t.isVariableDeclarator(node) ? (node.init as t.Node) : node;
    if (t.isCallExpression(node)) {
      const { callee, arguments: bindArguments } = node;
      if (
        t.isMemberExpression(callee) &&
        t.isIdentifier(callee.object) &&
        t.isIdentifier(callee.property) &&
        callee.property.name === 'bind' &&
        (bindArguments.length === 0 ||
          (bindArguments.length === 1 &&
            t.isObjectExpression(bindArguments[0]) &&
            bindArguments[0].properties.length === 0))
      ) {
        const { name } = callee.object;
        node = this._templates[name];
      }
    }
    return node;
  }

  parse() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    traverse(this._ast, {
      ExportDefaultDeclaration: {
        enter(path) {
          const { node, parent } = path;
          const isVariableReference = t.isIdentifier(node.declaration) && t.isProgram(parent);

          if (
            self._options.transformInlineMeta &&
            !isVariableReference &&
            t.isExpression(node.declaration)
          ) {
            const metaId = path.scope.generateUidIdentifier('meta');
            self._metaVariableName = metaId.name;
            const nodes = [
              t.variableDeclaration('const', [t.variableDeclarator(metaId, node.declaration)]),
              t.exportDefaultDeclaration(metaId),
            ];

            // Preserve sourcemaps location
            nodes.forEach((_node: t.Node) => (_node.loc = path.node.loc));
            path.replaceWithMultiple(nodes);
          }

          let metaNode: t.ObjectExpression | undefined;
          let decl;
          if (isVariableReference) {
            // const meta = { ... };
            // export default meta;
            const variableName = (node.declaration as t.Identifier).name;
            self._metaVariableName = variableName;
            const isVariableDeclarator = (declaration: t.VariableDeclarator) =>
              t.isIdentifier(declaration.id) && declaration.id.name === variableName;

            self._metaStatement = self._ast.program.body.find(
              (topLevelNode) =>
                t.isVariableDeclaration(topLevelNode) &&
                topLevelNode.declarations.find(isVariableDeclarator)
            );
            decl = ((self?._metaStatement as t.VariableDeclaration)?.declarations || []).find(
              isVariableDeclarator
            )?.init;
          } else {
            self._metaStatement = node;
            decl = node.declaration;
          }

          if (t.isObjectExpression(decl)) {
            // export default { ... };
            metaNode = decl;
          } else if (
            // export default { ... } as Meta<...>
            (t.isTSAsExpression(decl) || t.isTSSatisfiesExpression(decl)) &&
            t.isObjectExpression(decl.expression)
          ) {
            metaNode = decl.expression;
          }

          if (!self._meta && metaNode && t.isProgram(parent)) {
            self._metaNode = metaNode;
            self._parseMeta(metaNode, parent);
          }

          if (self._metaStatement && !self._metaNode) {
            throw new NoMetaError(
              'default export must be an object',
              self._metaStatement,
              self._options.fileName
            );
          }
        },
      },
      ExportNamedDeclaration: {
        enter({ node, parent }) {
          let declarations;
          if (t.isVariableDeclaration(node.declaration)) {
            declarations = node.declaration.declarations.filter((d) => t.isVariableDeclarator(d));
          } else if (t.isFunctionDeclaration(node.declaration)) {
            declarations = [node.declaration];
          }
          if (declarations) {
            // export const X = ...;
            declarations.forEach((decl: t.VariableDeclarator | t.FunctionDeclaration) => {
              if (t.isIdentifier(decl.id)) {
                const { name: exportName } = decl.id;
                if (exportName === '__namedExportsOrder' && t.isVariableDeclarator(decl)) {
                  self._namedExportsOrder = parseExportsOrder(decl.init as t.Expression);
                  return;
                }
                self._storyExports[exportName] = decl;
                self._storyStatements[exportName] = node;
                let name = storyNameFromExport(exportName);
                if (self._storyAnnotations[exportName]) {
                  logger.warn(
                    `Unexpected annotations for "${exportName}" before story declaration`
                  );
                } else {
                  self._storyAnnotations[exportName] = {};
                }
                let storyNode;
                if (t.isVariableDeclarator(decl)) {
                  storyNode =
                    t.isTSAsExpression(decl.init) || t.isTSSatisfiesExpression(decl.init)
                      ? decl.init.expression
                      : decl.init;
                } else {
                  storyNode = decl;
                }
                const parameters: { [key: string]: any } = {};
                if (t.isObjectExpression(storyNode)) {
                  parameters.__isArgsStory = true; // assume default render is an args story
                  // CSF3 object export
                  (storyNode.properties as t.ObjectProperty[]).forEach((p) => {
                    if (t.isIdentifier(p.key)) {
                      if (p.key.name === 'render') {
                        parameters.__isArgsStory = isArgsStory(
                          p.value as t.Expression,
                          parent,
                          self
                        );
                      } else if (p.key.name === 'name' && t.isStringLiteral(p.value)) {
                        name = p.value.value;
                      } else if (p.key.name === 'storyName' && t.isStringLiteral(p.value)) {
                        logger.warn(
                          `Unexpected usage of "storyName" in "${exportName}". Please use "name" instead.`
                        );
                      } else if (p.key.name === 'parameters' && t.isObjectExpression(p.value)) {
                        const idProperty = p.value.properties.find(
                          (property) =>
                            t.isObjectProperty(property) &&
                            t.isIdentifier(property.key) &&
                            property.key.name === '__id'
                        ) as t.ObjectProperty | undefined;
                        if (idProperty) {
                          parameters.__id = (idProperty.value as t.StringLiteral).value;
                        }
                      }

                      self._storyAnnotations[exportName][p.key.name] = p.value;
                    }
                  });
                } else {
                  parameters.__isArgsStory = isArgsStory(storyNode as t.Node, parent, self);
                }
                self._stories[exportName] = {
                  id: 'FIXME',
                  name,
                  parameters,
                  __stats: {},
                };
              }
            });
          } else if (node.specifiers.length > 0) {
            // export { X as Y }
            node.specifiers.forEach((specifier) => {
              if (t.isExportSpecifier(specifier) && t.isIdentifier(specifier.exported)) {
                const { name: exportName } = specifier.exported;
                const decl = t.isProgram(parent)
                  ? findVarInitialization(specifier.local.name, parent)
                  : specifier.local;

                if (exportName === 'default') {
                  let metaNode: t.ObjectExpression | undefined;

                  if (t.isObjectExpression(decl)) {
                    // export default { ... };
                    metaNode = decl;
                  } else if (
                    // export default { ... } as Meta<...>
                    t.isTSAsExpression(decl) &&
                    t.isObjectExpression(decl.expression)
                  ) {
                    metaNode = decl.expression;
                  }

                  if (!self._meta && metaNode && t.isProgram(parent)) {
                    self._parseMeta(metaNode, parent);
                  }
                } else {
                  self._storyAnnotations[exportName] = {};
                  self._storyStatements[exportName] = decl;
                  self._stories[exportName] = {
                    id: 'FIXME',
                    name: exportName,
                    parameters: {},
                    __stats: {},
                  };
                }
              }
            });
          }
        },
      },
      ExpressionStatement: {
        enter({ node, parent }) {
          const { expression } = node;
          // B.storyName = 'some string';
          if (
            t.isProgram(parent) &&
            t.isAssignmentExpression(expression) &&
            t.isMemberExpression(expression.left) &&
            t.isIdentifier(expression.left.object) &&
            t.isIdentifier(expression.left.property)
          ) {
            const exportName = expression.left.object.name;
            const annotationKey = expression.left.property.name;
            const annotationValue = expression.right;

            // v1-style annotation
            // A.story = { parameters: ..., decorators: ... }

            if (self._storyAnnotations[exportName]) {
              if (annotationKey === 'story' && t.isObjectExpression(annotationValue)) {
                (annotationValue.properties as t.ObjectProperty[]).forEach((prop) => {
                  if (t.isIdentifier(prop.key)) {
                    self._storyAnnotations[exportName][prop.key.name] = prop.value;
                  }
                });
              } else {
                self._storyAnnotations[exportName][annotationKey] = annotationValue;
              }
            }

            if (annotationKey === 'storyName' && t.isStringLiteral(annotationValue)) {
              const storyName = annotationValue.value;
              const story = self._stories[exportName];
              if (!story) return;
              story.name = storyName;
            }
          }
        },
      },
      CallExpression: {
        enter({ node }) {
          const { callee } = node;
          if (t.isIdentifier(callee) && callee.name === 'storiesOf') {
            throw new Error(dedent`
              Unexpected \`storiesOf\` usage: ${formatLocation(node, self._options.fileName)}.

              SB8 does not support \`storiesOf\`. 
            `);
          }
        },
      },
      ImportDeclaration: {
        enter({ node }) {
          const { source } = node;
          if (t.isStringLiteral(source)) {
            self.imports.push(source.value);
          } else {
            throw new Error('CSF: unexpected import source');
          }
        },
      },
    });

    if (!self._meta) {
      throw new NoMetaError('missing default export', self._ast, self._options.fileName);
    }

    // default export can come at any point in the file, so we do this post processing last
    const entries = Object.entries(self._stories);
    self._meta.title = this._options.makeTitle(self._meta?.title as string);
    if (self._metaAnnotations.play) {
      self._meta.tags = [...(self._meta.tags || []), 'play-fn'];
    }
    self._stories = entries.reduce(
      (acc, [key, story]) => {
        if (!isExportStory(key, self._meta as StaticMeta)) {
          return acc;
        }
        const id =
          story.parameters?.__id ??
          toId((self._meta?.id || self._meta?.title) as string, storyNameFromExport(key));
        const parameters: Record<string, any> = { ...story.parameters, __id: id };

        const { includeStories } = self._meta || {};
        if (
          key === '__page' &&
          (entries.length === 1 || (Array.isArray(includeStories) && includeStories.length === 1))
        ) {
          parameters.docsOnly = true;
        }
        acc[key] = { ...story, id, parameters };
        const storyAnnotations = self._storyAnnotations[key];
        const { tags, play } = storyAnnotations;
        if (tags) {
          const node = t.isIdentifier(tags)
            ? findVarInitialization(tags.name, this._ast.program)
            : tags;
          acc[key].tags = parseTags(node);
        }
        if (play) {
          acc[key].tags = [...(acc[key].tags || []), 'play-fn'];
        }
        const stats = acc[key].__stats;
        ['play', 'render', 'loaders', 'beforeEach', 'globals'].forEach((annotation) => {
          stats[annotation as keyof IndexInputStats] =
            !!storyAnnotations[annotation] || !!self._metaAnnotations[annotation];
        });
        const storyExport = self.getStoryExport(key);
        stats.storyFn = !!(
          t.isArrowFunctionExpression(storyExport) || t.isFunctionDeclaration(storyExport)
        );
        stats.mount = hasMount(storyAnnotations.play ?? self._metaAnnotations.play);
        stats.moduleMock = !!self.imports.find((fname) => isModuleMock(fname));

        return acc;
      },
      {} as Record<string, StaticStory>
    );

    Object.keys(self._storyExports).forEach((key) => {
      if (!isExportStory(key, self._meta as StaticMeta)) {
        delete self._storyExports[key];
        delete self._storyAnnotations[key];
        delete self._storyStatements[key];
      }
    });

    if (self._namedExportsOrder) {
      const unsortedExports = Object.keys(self._storyExports);
      self._storyExports = sortExports(self._storyExports, self._namedExportsOrder);
      self._stories = sortExports(self._stories, self._namedExportsOrder);

      const sortedExports = Object.keys(self._storyExports);
      if (unsortedExports.length !== sortedExports.length) {
        throw new Error(
          `Missing exports after sort: ${unsortedExports.filter(
            (key) => !sortedExports.includes(key)
          )}`
        );
      }
    }

    return self as CsfFile & IndexedCSFFile;
  }

  public get meta() {
    return this._meta;
  }

  public get stories() {
    return Object.values(this._stories);
  }

  public get indexInputs(): IndexInput[] {
    const { fileName } = this._options;
    if (!fileName) {
      throw new Error(
        dedent`Cannot automatically create index inputs with CsfFile.indexInputs because the CsfFile instance was created without a the fileName option.
        Either add the fileName option when creating the CsfFile instance, or create the index inputs manually.`
      );
    }

    return Object.entries(this._stories).map(([exportName, story]) => {
      // don't remove any duplicates or negations -- tags will be combined in the index
      const tags = [...(this._meta?.tags ?? []), ...(story.tags ?? [])];
      return {
        type: 'story',
        importPath: fileName,
        rawComponentPath: this._rawComponentPath,
        exportName,
        name: story.name,
        title: this.meta?.title,
        metaId: this.meta?.id,
        tags,
        __id: story.id,
        __stats: story.__stats,
      };
    });
  }
}

/**
 * Using new babel.File is more powerful and give access to API such as buildCodeFrameError
 */
export const babelParseFile = ({
  code,
  filename = '',
  ast,
}: {
  code: string;
  filename?: string;
  ast?: t.File;
}): BabelFile => {
  return new BabelFileClass({ filename }, { code, ast: ast ?? babelParse(code) });
};

export const loadCsf = (code: string, options: CsfOptions) => {
  const ast = babelParse(code);
  const file = babelParseFile({ code, filename: options.fileName, ast });
  return new CsfFile(ast, options, file);
};

export const formatCsf = (
  csf: CsfFile,
  options: GeneratorOptions & { inputSourceMap?: any } = { sourceMaps: false },
  code?: string
) => {
  const result = generate(csf._ast, options, code);
  if (options.sourceMaps) {
    return result;
  }
  return result.code;
};

/**
 * Use this function, if you want to preserve styles. Uses recast under the hood.
 */
export const printCsf = (csf: CsfFile, options: Options = {}): PrintResultType => {
  return recast.print(csf._ast, options);
};

export const readCsf = async (fileName: string, options: CsfOptions) => {
  const code = (await readFile(fileName, 'utf-8')).toString();
  return loadCsf(code, { ...options, fileName });
};

export const writeCsf = async (csf: CsfFile, fileName?: string) => {
  const fname = fileName || csf._options.fileName;
  if (!fname) throw new Error('Please specify a fileName for writeCsf');
  await writeFile(fileName as string, printCsf(csf).code);
};
