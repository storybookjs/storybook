import { HandledError } from 'storybook/internal/common';
import {
  type ConfigFile,
  type ESTree as E,
  type ESTreeNode as Node,
  type SourceEditor,
  loadConfig,
  loadCsf,
  locationOf,
  objectList,
  objectProperty,
  removeFromList,
  removeStatement,
  staticKey,
  unwrapExpression,
  walk,
} from 'storybook/internal/csf-tools';

import {
  type ObjectSite,
  addInlineFalseToMeta,
  editObjectSite,
  findObjectSite,
  hasAutodocs,
  prependToBeforeEach,
  setsInline,
  SPREAD_PROBLEM,
  spreadsBeforeEach,
  tagsOf,
} from './edit-levels.ts';
import {
  MockImports,
  findImport,
  isTestFnBinding,
  aliasedImports,
  readsName,
} from './mock-imports.ts';
import {
  type LevelMocks,
  type MergedKeys,
  type MockExport,
  type Problem,
  type ReadContext,
  KEY,
  MOCK_EXPORTS,
  canBePlainObject,
  keepSpies,
  mergeKeys,
  noMergedKeys,
  objectValue,
  readMocks,
  recordMerged,
} from './mock-statements.ts';
import { printMocks, printStatements } from './print-mocks.ts';

export const MIGRATION_LINK =
  'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#sveltekit-sveltekit_experimental-parameters-removed';

// What the preview sets, which the old parameters merged into every story.
export interface PreviewMocks {
  merged: MergedKeys;
  autodocs: boolean;
  setsMocks: boolean;
}

export const noPreviewMocks = (): PreviewMocks => ({
  merged: noMergedKeys(),
  autodocs: false,
  setsMocks: false,
});

// Throw one error that lists every problem with its line, so the runner reports the file.
export const failWith = (code: string, problems: Problem[]): never => {
  const reasons = [...problems]
    .sort((a, b) => a.index - b.index)
    .map(({ index, message }) => `line ${locationOf(code, index, index).start.line}: ${message}`);
  throw new HandledError(
    `Could not migrate \`${KEY}\`, so this file is unchanged. ${[...new Set(reasons)].join(' ')} Migrate it by hand: ${MIGRATION_LINK}`
  );
};

const isKey = (node: Node) => node.type === 'Property' && staticKey(node) === KEY;

const isKeyAccess = (node: Node) =>
  node.type === 'MemberExpression' &&
  (node.computed
    ? node.property.type === 'Literal' && node.property.value === KEY
    : node.property.type === 'Identifier' && node.property.name === KEY);

// What code that already sets the mocks sets, so the old parameters of the levels inside it merge
// with it: code that a person migrated by hand, or that an earlier run wrote, such as a migrated
// preview whose stories files the run reported.
export const migratedKeys = (editor: SourceEditor, node: Node | undefined): MergedKeys => {
  const keys = noMergedKeys();
  if (!node) {
    return keys;
  }
  const locals = new Map<string, MockExport>();
  for (const name of Object.keys(MOCK_EXPORTS) as MockExport[]) {
    const local = findImport(editor, [MOCK_EXPORTS[name]], name)?.specifier.local.name;
    if (local) {
      locals.set(local, name);
    }
  }
  if (locals.size === 0) {
    return keys;
  }
  const mockOf = (target: Node): MockExport | undefined => {
    const value = unwrapExpression(target);
    if (value.type === 'Identifier') {
      return locals.get(value.name);
    }
    return value.type === 'CallExpression' &&
      value.callee.type === 'Identifier' &&
      locals.get(value.callee.name) === 'mocked' &&
      value.arguments[0]
      ? mockOf(value.arguments[0])
      : undefined;
  };
  walk(node, (child) => {
    if (child.type === 'CallExpression') {
      const { callee } = child;
      if (callee.type === 'Identifier' && locals.get(callee.name) === 'setAfterNavigate') {
        keys.afterNavigate = true;
      }
      if (
        callee.type === 'MemberExpression' &&
        !callee.computed &&
        callee.property.type === 'Identifier' &&
        callee.property.name.startsWith('mock')
      ) {
        const mock = mockOf(callee.object);
        if (mock === 'link') {
          keys.hrefs = true;
        } else if (mock && (MOCK_EXPORTS[mock] === '$app/navigation' || mock === 'formAction')) {
          keys.functions.push(mock);
        }
      }
      const [target] = child.arguments;
      const mock = target && mockOf(target);
      if (
        callee.type === 'MemberExpression' &&
        isKeyAccessOf(callee, 'Object', 'assign') &&
        (mock === 'page' || mock === 'navigating')
      ) {
        keys.values.push(`${mock}.*`);
      }
    }
    if (
      child.type === 'AssignmentExpression' &&
      child.left.type === 'MemberExpression' &&
      !child.left.computed &&
      child.left.property.type === 'Identifier'
    ) {
      const mock = mockOf(child.left.object);
      if (mock === 'page' || mock === 'navigating') {
        const path = `${mock}.${child.left.property.name}`;
        keys.assigned.push(path);
        if (objectValue(child.right) || canBePlainObject(child.right)) {
          recordMerged(keys, child.right, path);
        }
      }
    }
  });
  return keys;
};

const isKeyAccessOf = (node: E.MemberExpression, object: string, property: string) =>
  !node.computed &&
  node.object.type === 'Identifier' &&
  node.object.name === object &&
  node.property.type === 'Identifier' &&
  node.property.name === property;

const INHERITED_BEFORE_EACH =
  'The preview exports a `beforeEach` from another module, which the new `beforeEach` would replace.';

// Report each `sveltekit_experimental` of a program that is not one of `sites`: one in a variable
// or a helper, or a read of the parameter.
export const findUnmigrated = (
  program: Node,
  sites: ReadonlySet<Node>,
  toFile: (index: number) => number = (index) => index
): Problem[] => {
  const problems: Problem[] = [];
  walk(program, (node, parent) => {
    if (isKey(node) && !sites.has(node)) {
      problems.push({
        index: toFile(node.start),
        message:
          parent?.type === 'ObjectPattern'
            ? `Reads \`${KEY}\` from the parameters, which no longer have it. Assert on the mocks from their modules instead, for example \`expect(goto)\`.`
            : `\`${KEY}\` is not in the \`parameters\` object literal of a story, the meta or the preview, but in a shared variable or a helper function, so the fix can't tell which stories use it.`,
      });
    } else if (isKeyAccess(node)) {
      problems.push({
        index: toFile(node.start),
        message: `Reads \`parameters.${KEY}\`, which no longer exists. Assert on the mocks from their modules instead, for example \`expect(goto)\`.`,
      });
    }
  });
  return problems;
};

// The `ReadContext` of code in `editor`, whose free names are the module-level bindings of
// `module`: the same editor in a CSF file, the `<script module>` for a Svelte attribute.
export const readContext = (
  editor: SourceEditor,
  module: SourceEditor,
  outer: MergedKeys
): ReadContext => {
  const moduleBinding = (identifier: Node) => {
    if (editor === module) {
      const binding = module.scopes.bindingOf(identifier);
      return binding?.scope === module.scopes.program ? binding : undefined;
    }
    return editor.scopes.bindingOf(identifier)
      ? undefined
      : module.scopes.program.bindings.get((identifier as E.IdentifierReference).name);
  };
  return {
    outer,
    isTestFn: (identifier) => isTestFnBinding(moduleBinding(identifier)),
    moduleFunction: (identifier) => {
      const binding = moduleBinding(identifier);
      if (binding?.node.type === 'FunctionDeclaration') {
        return binding.node;
      }
      const init =
        binding?.kind === 'const' && binding.node.type === 'VariableDeclarator' && binding.node.init
          ? unwrapExpression(binding.node.init)
          : undefined;
      return init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression'
        ? init
        : undefined;
    },
    importOf: (identifier) => {
      const binding = moduleBinding(identifier);
      if (binding?.kind !== 'import' || binding.node.type !== 'ImportSpecifier') {
        return undefined;
      }
      const { imported } = binding.node;
      return {
        module: (binding.declaration as E.ImportDeclaration).source.value,
        name: imported.type === 'Identifier' ? imported.name : imported.value,
      };
    },
    moduleDeclarator: (identifier) => {
      const binding = moduleBinding(identifier);
      return binding?.kind === 'const' &&
        binding.node.type === 'VariableDeclarator' &&
        binding.declaration &&
        module.parentOf(binding.declaration)?.type === 'Program'
        ? binding.node
        : undefined;
    },
  };
};

// The module-level names that a new import must not take, except the spies it replaces.
export const takenNames = (editor: SourceEditor, spies: E.VariableDeclarator[]) => {
  const freed = new Set(spies.map((spy) => (spy.id as E.BindingIdentifier).name));
  return [...editor.scopes.program.bindings.keys(), ...editor.scopes.tsDeclarationNames].filter(
    (name) => !freed.has(name)
  );
};

export const styleOf = (editor: SourceEditor) => ({
  quote: editor.quote,
  semicolons: editor.semicolons,
  indent: editor.indent,
});

// A story that spreads one whose mocks move into its `beforeEach`, and has a `beforeEach` of its own
const spreadsOfLevels = (
  editor: SourceEditor,
  stories: Iterable<E.ObjectExpression>,
  levels: Set<Node>
): Problem[] =>
  [...stories].flatMap((story) => {
    const parameters = objectProperty(story, 'parameters');
    // Its own parameters replaced the spread one's, unless they spread `X.parameters`
    const replacesParameters = (name: string) => {
      const params = parameters && objectValue(parameters.value);
      return (
        !!parameters &&
        !levels.has(story) &&
        !params?.properties.some((member) => {
          const argument = member.type === 'SpreadElement' && unwrapExpression(member.argument);
          return (
            !!argument &&
            argument.type === 'MemberExpression' &&
            isKeyAccessOf(argument, name, 'parameters')
          );
        })
      );
    };
    return objectProperty(story, 'beforeEach') || parameters
      ? story.properties.flatMap((member) => {
          const binding =
            member.type === 'SpreadElement' && member.argument.type === 'Identifier'
              ? editor.scopes.bindingOf(member.argument)
              : undefined;
          const init =
            binding?.node.type === 'VariableDeclarator' && binding.node.init
              ? unwrapExpression(binding.node.init)
              : undefined;
          if (!init || !levels.has(init)) {
            return [];
          }
          if (objectProperty(story, 'beforeEach')) {
            return [
              {
                index: member.start,
                message: `Spreads \`${binding!.name}\`, whose \`${KEY}\` moves into its \`beforeEach\`, which this story's own \`beforeEach\` replaces.`,
              },
            ];
          }
          return replacesParameters(binding!.name)
            ? [
                {
                  index: member.start,
                  message: `Spreads \`${binding!.name}\`, whose \`${KEY}\` moves into its \`beforeEach\`, but sets its own \`parameters\`, which replaced that \`${KEY}\`.`,
                },
              ]
            : [];
        })
      : [];
  });

// `Story.beforeEach = …` after the object, which would replace the `beforeEach` that the fix writes
const assignedBeforeEach = (editor: SourceEditor, levels: Set<Node>): Problem[] => {
  const problems: Problem[] = [];
  walk(editor.program, (node) => {
    const target = node.type === 'AssignmentExpression' ? node.left : undefined;
    if (
      target?.type !== 'MemberExpression' ||
      target.computed ||
      target.property.type !== 'Identifier' ||
      target.property.name !== 'beforeEach' ||
      target.object.type !== 'Identifier'
    ) {
      return;
    }
    const binding = editor.scopes.bindingOf(target.object);
    const init =
      binding?.node.type === 'VariableDeclarator' && binding.node.init
        ? unwrapExpression(binding.node.init)
        : undefined;
    if (init && levels.has(init)) {
      problems.push({
        index: node.start,
        message: `Assigns \`${binding!.name}.beforeEach\`, which would replace the \`beforeEach\` that the mocks move into.`,
      });
    }
  });
  return problems;
};

// The object of the story that `Base.extend(object)` extends
const extendedStory = (editor: SourceEditor, object: Node): Node | undefined => {
  const call = editor.parentOf(object);
  const callee = call?.type === 'CallExpression' ? call.callee : undefined;
  if (
    callee?.type !== 'MemberExpression' ||
    callee.computed ||
    callee.property.type !== 'Identifier' ||
    callee.property.name !== 'extend' ||
    callee.object.type !== 'Identifier'
  ) {
    return undefined;
  }
  const binding = editor.scopes.bindingOf(callee.object);
  const init =
    binding?.node.type === 'VariableDeclarator' && binding.node.init
      ? unwrapExpression(binding.node.init)
      : undefined;
  const argument = init?.type === 'CallExpression' ? init.arguments[0] : undefined;
  return argument && unwrapExpression(argument);
};

interface ObjectLevel {
  kind: 'meta' | 'story';
  site: ObjectSite;
  mocks: LevelMocks;
}

// Migrate the `sveltekit_experimental` parameters of a CSF stories file, or `null` for none.
export const migrateCsfStories = (code: string, id: string, preview: PreviewMocks) => {
  const csf = loadCsf(code, { fileName: id, makeTitle: (title) => title || id }).parse();
  const { editor } = csf;
  const objects = csf.objects();
  const meta = objects.find(({ target }) => target.kind === 'meta')?.node;
  const storyNodes = new Set(
    objects.flatMap(({ target, node }) => (target.kind === 'story' && node ? [node] : []))
  );
  const storyCount = csf.stories.length;

  const levels: ObjectLevel[] = [];
  const metaSite = meta && findObjectSite(meta);
  let outer = preview.merged;
  if (metaSite) {
    const mocks = readMocks(editor, metaSite.sveltekit.value, readContext(editor, editor, outer));
    levels.push({ kind: 'meta', site: metaSite, mocks });
    outer = mergeKeys(outer, mocks.merged);
  }
  outer = mergeKeys(outer, migratedKeys(editor, meta && objectProperty(meta, 'beforeEach')?.value));
  // A story of `Base.extend({…})` merges its parameters with the ones of `Base` and its parents
  const merged = new Map<Node, MergedKeys>();
  for (const node of storyNodes) {
    let storyOuter = outer;
    for (let parent = extendedStory(editor, node); parent; parent = extendedStory(editor, parent)) {
      storyOuter = mergeKeys(storyOuter, merged.get(parent) ?? noMergedKeys());
    }
    const site = findObjectSite(node);
    if (site) {
      const mocks = readMocks(
        editor,
        site.sveltekit.value,
        readContext(editor, editor, storyOuter)
      );
      levels.push({ kind: 'story', site, mocks });
      merged.set(node, mocks.merged);
    }
  }

  const problems = [
    ...levels.flatMap(({ mocks }) => mocks.problems),
    ...findUnmigrated(editor.program, new Set(levels.map(({ site }) => site.sveltekit))),
    ...levels
      .filter(({ site, mocks }) => spreadsBeforeEach(site.object) && mocks.ops.length > 0)
      .map(({ site }) => ({ index: site.object.start, message: SPREAD_PROBLEM })),
    ...spreadsOfLevels(editor, storyNodes, new Set(levels.map(({ site }) => site.object))),
    ...assignedBeforeEach(editor, new Set(levels.map(({ site }) => site.object))),
  ];
  if (problems.length > 0) {
    failWith(code, problems);
  }
  if (levels.length === 0) {
    return null;
  }

  const implemented = new Set([
    ...preview.merged.functions,
    ...levels.flatMap(({ mocks }) => mocks.merged.functions),
  ]);
  const kept = new Set([...implemented, ...aliasedImports(editor)]);
  levels.forEach(({ mocks }) => keepSpies(mocks, kept));
  const spies = levels.flatMap(({ mocks }) => mocks.spies);
  const imports = new MockImports(editor, takenNames(editor, spies));
  const style = styleOf(editor);
  const printed = levels.map((level) => printMocks(editor, level.mocks, imports.local, style));
  const inlineFalse =
    !!meta &&
    storyCount >= 2 &&
    printed.some((statements) => statements.length > 0) &&
    hasAutodocs(meta, preview.autodocs) &&
    !setsInline(meta);
  const semicolon = style.semicolons ? ';' : '';
  levels.forEach((level, index) =>
    editObjectSite(editor, level.site, printed[index], {
      inlineFalse: inlineFalse && level.kind === 'meta',
      semicolon,
    })
  );
  if (inlineFalse && !metaSite) {
    addInlineFalseToMeta(editor, meta);
  }
  imports.apply(
    spies,
    levels.map(({ site }) => site.sveltekit),
    (name) => readsName(printed.flat(), name)
  );
  return editor.toString();
};

interface NamedSite {
  // The `export const parameters = {…}` statement, when the parameters are declared in one
  statement?: E.ExportNamedDeclaration;
  params: E.ObjectExpression;
  sveltekit: E.ObjectProperty;
}

type PreviewLevel = { config: ConfigFile; mocks: LevelMocks } & (
  | { kind: 'object'; site: ObjectSite }
  | { kind: 'named'; site: NamedSite }
);

// The preview's site: in its object, or in `export const parameters` and the like
const findPreviewSite = (config: ConfigFile) => {
  if (config.node) {
    const site = findObjectSite(config.node);
    return site && { kind: 'object' as const, site };
  }
  const field = config.getFieldNode(['parameters']);
  const params = field && unwrapExpression(field);
  const sveltekit = params?.type === 'ObjectExpression' ? objectProperty(params, KEY) : undefined;
  if (!sveltekit) {
    return undefined;
  }
  const declaration = config.editor.statementOf(params!);
  const statement = declaration && config.editor.parentOf(declaration);
  const site: NamedSite = {
    // Only a statement that declares nothing else can go as a whole
    statement:
      statement?.type === 'ExportNamedDeclaration' &&
      declaration?.type === 'VariableDeclaration' &&
      declaration.declarations.length === 1
        ? statement
        : undefined,
    params: params as E.ObjectExpression,
    sveltekit,
  };
  return { kind: 'named' as const, site };
};

const readPreviewLevel = (config: ConfigFile): PreviewLevel | undefined => {
  const { editor } = config;
  const found = findPreviewSite(config);
  const problems = findUnmigrated(editor.program, new Set(found ? [found.site.sveltekit] : []));
  if (!found) {
    return problems.length > 0 ? failWith(editor.code, problems) : undefined;
  }
  const mocks = readMocks(
    editor,
    found.site.sveltekit.value,
    readContext(editor, editor, noMergedKeys())
  );
  mocks.problems.push(...problems);
  if (mocks.ops.length > 0) {
    if (found.kind === 'object' && spreadsBeforeEach(found.site.object)) {
      mocks.problems.push({ index: found.site.object.start, message: SPREAD_PROBLEM });
    }
    const inherits = editor.program.body.some(
      (statement) =>
        statement.type === 'ExportAllDeclaration' ||
        // `export { beforeEach } from './setup'`, or an imported `beforeEach` exported again
        (statement.type === 'ExportNamedDeclaration' &&
          statement.specifiers.some(
            (specifier) =>
              (specifier.exported.type === 'Identifier'
                ? specifier.exported.name
                : specifier.exported.value) === 'beforeEach'
          ))
    );
    if (found.kind === 'named' && !config.getFieldNode(['beforeEach']) && inherits) {
      mocks.problems.push({ index: found.site.sveltekit.start, message: INHERITED_BEFORE_EACH });
    }
  }
  return { config, mocks, ...found };
};

// What a preview's `sveltekit_experimental` sets, for the stories files that it applies to. A
// preview that doesn't parse sets nothing here; its own hook reports it.
export const readPreviewMocks = (code: string | undefined, id: string): PreviewMocks => {
  if (!code) {
    return noPreviewMocks();
  }
  try {
    const config = loadConfig(code, id).parse();
    const level = code.includes(KEY) ? readPreviewLevel(config) : undefined;
    return {
      merged: mergeKeys(
        level?.mocks.merged ?? noMergedKeys(),
        migratedKeys(config.editor, config.editor.program)
      ),
      autodocs: tagsOf(config.getFieldNode(['tags'])).includes('autodocs'),
      setsMocks: (level?.mocks.ops.length ?? 0) > 0,
    };
  } catch {
    return noPreviewMocks();
  }
};

// Migrate the `sveltekit_experimental` parameters of `.storybook/preview`, or `null` for none.
export const migratePreview = (code: string, id: string) => {
  const level = readPreviewLevel(loadConfig(code, id).parse());
  if (!level) {
    return null;
  }
  const { config, mocks } = level;
  const { editor } = config;
  if (mocks.problems.length > 0) {
    failWith(code, mocks.problems);
  }
  keepSpies(mocks, new Set([...mocks.merged.functions, ...aliasedImports(editor)]));
  const imports = new MockImports(editor, takenNames(editor, mocks.spies));
  const style = styleOf(editor);
  const statements = printMocks(editor, mocks, imports.local, style);
  const semicolon = style.semicolons ? ';' : '';
  if (level.kind === 'object') {
    editObjectSite(editor, level.site, statements, { inlineFalse: false, semicolon });
  } else {
    editNamedPreview(config, level.site, statements, semicolon);
  }
  imports.apply(mocks.spies, [level.site.sveltekit], (name) => readsName(statements, name));
  return editor.toString();
};

const editNamedPreview = (
  config: ConfigFile,
  { statement, params, sveltekit }: NamedSite,
  statements: string[],
  semicolon: string
) => {
  const { editor } = config;
  const beforeEach = config.getFieldNode(['beforeEach']);
  const added = `export function beforeEach() {\n${printStatements(statements, editor.indent)}\n}`;
  if (statements.length > 0 && beforeEach) {
    prependToBeforeEach(editor, beforeEach, statements, { semicolon, step: editor.indent });
  }
  const empty = params.properties.length === 1;
  if (statement && empty && statements.length > 0 && !beforeEach) {
    editor.edits.overwrite(statement.start, statement.end, added);
    return;
  }
  if (statement && empty) {
    removeStatement(editor, statement);
    return;
  }
  removeFromList(editor, objectList(editor, params), [sveltekit]);
  if (statements.length > 0 && !beforeEach) {
    const end = (statement ?? editor.statementOf(params)!).end;
    editor.edits.appendLeft(end, `\n\n${added}`);
  }
};
