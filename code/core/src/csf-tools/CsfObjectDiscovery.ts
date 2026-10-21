import type { CsfFile } from './CsfFile.ts';
import {
  INDEXED_CALLEES,
  csfFactoryReceiver,
  indexedPath,
  isCsfFactoryCall,
  withoutTypeCalls,
} from './CsfFile.ts';
import {
  type CsfMutationDiagnostic,
  type CsfMutationDiagnosticCode,
  type CsfMutationTarget,
  type CsfObject,
  type CsfObjectHost,
  type CsfObjectLookup,
  type CsfObjectOptions,
  type CsfObjectTarget,
  createCsfObject,
} from './CsfObject.ts';
import {
  type MemberInsert,
  type ObjectRoot,
  argumentRoot,
  detachedMember,
  literalRoot,
} from './ObjectRoot.ts';
import {
  type E,
  type Node,
  type Property,
  isFunction,
  isIdentifier,
  type ParsedModule,
  type SourceLocation,
  isStringLiteral,
  outerSpan,
  staticKey,
  unwrapExpression,
} from './estree/ast.ts';
import {
  insertStatementAfter,
  locationIn,
  printKey,
  printMemberAccess,
  printObject,
  removeStatements,
} from './estree/editor.ts';
import { placeableValueSource } from './estree/values.ts';
import type { Binding } from './estree/scope.ts';

type ReportDiagnostic = (diagnostic: CsfMutationDiagnostic) => void;
type MarkChanged = () => void;

type StoryBinding = {
  exportName: string;
  localName: string;
  declaration: E.VariableDeclarator | E.Function;
  // The identifier, declaration or specifier that exports it.
  node: Node;
};

// The object an editor works on, before it is wrapped into a `CsfObject`.
type Discovered = { target: CsfObjectTarget; root: ObjectRoot };

// A top-level `Story.name = value` statement, as a member of the story.
type Assignment = {
  statement: E.ExpressionStatement;
  left: E.MemberExpression;
  property: Property;
};

type Rejection = { code: CsfMutationDiagnosticCode; node: Node; path: string[]; message: string };

// The node each diagnostic location was read from, so a repeated diagnostic is located again.
const located = new WeakMap<SourceLocation, Node>();

const loc = (csf: CsfFile, node: Node) => {
  const at = locationIn(csf.editor, node);
  located.set(at, node);
  return { loc: at };
};

const storyTarget = ({ exportName, localName }: StoryBinding): CsfObjectTarget => ({
  kind: 'story',
  exportName,
  localName,
});

const exportedName = (node: E.ModuleExportName) =>
  node.type === 'Identifier' ? node.name : (node as E.StringLiteral).value;

const addQualifiedBinding = (
  csf: CsfFile,
  node: Node,
  exportName: string,
  localName: string,
  bindings: Map<string, StoryBinding>,
  report: ReportDiagnostic,
  isStory: boolean
) => {
  const binding = csf.editor.scopes.program.bindings.get(localName);
  if (
    !binding?.constant ||
    (binding.node.type !== 'VariableDeclarator' && binding.node.type !== 'FunctionDeclaration')
  ) {
    if (isStory) {
      report({
        code: 'ambiguous-binding',
        target: { kind: 'story', exportName, localName },
        path: [],
        message: `Cannot mutate ${exportName} because ${localName} is not a unique constant binding`,
        ...loc(csf, node),
      });
    }
  } else {
    bindings.set(`${localName}:${exportName}`, {
      exportName,
      localName,
      declaration: binding.node as E.VariableDeclarator | E.Function,
      node,
    });
  }
};

// Every export of a story, in source order. Exports of the same declaration share it.
const storyExports = (csf: CsfFile, report: ReportDiagnostic): StoryBinding[] => {
  const bindings = new Map<string, StoryBinding>();
  for (const statement of csf.program.body) {
    if (statement.type !== 'ExportNamedDeclaration' || statement.exportKind === 'type') {
      continue;
    }
    const { declaration } = statement;
    if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === 'Identifier') {
          const { name } = declarator.id;
          addQualifiedBinding(
            csf,
            declarator.id,
            name,
            name,
            bindings,
            report,
            Object.hasOwn(csf._stories, name)
          );
        }
      }
    } else if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
      const { name } = declaration.id;
      addQualifiedBinding(
        csf,
        declaration,
        name,
        name,
        bindings,
        report,
        Object.hasOwn(csf._stories, name)
      );
    }
    for (const specifier of statement.specifiers) {
      if (specifier.local.type !== 'Identifier') {
        continue;
      }
      const exportName = exportedName(specifier.exported);
      if (statement.source) {
        if (exportName !== 'default' && Object.hasOwn(csf._stories, exportName)) {
          report({
            code: 'unsupported-initializer',
            target: { kind: 'story', exportName, localName: specifier.local.name },
            path: [],
            message: `Cannot mutate re-exported story ${exportName} automatically`,
            ...loc(csf, specifier),
          });
        }
        continue;
      }
      if (exportName === 'default') {
        continue;
      }
      addQualifiedBinding(
        csf,
        specifier,
        exportName,
        specifier.local.name,
        bindings,
        report,
        Object.hasOwn(csf._stories, exportName)
      );
    }
  }
  return [...bindings.values()].filter((binding) =>
    Object.hasOwn(csf._stories, binding.exportName)
  );
};

// The first export of each declaration, which edits it for all of its exports. Each other export
// is reported as an alias of it.
const storyBindings = (csf: CsfFile, report: ReportDiagnostic): StoryBinding[] => {
  const unique = new Map<Node, StoryBinding>();
  for (const binding of storyExports(csf, report)) {
    const first = unique.get(binding.declaration);
    if (!first) {
      unique.set(binding.declaration, binding);
      continue;
    }
    report({
      code: 'aliased-story',
      target: storyTarget(binding),
      path: [],
      message: `Cannot mutate ${binding.exportName} without changing ${first.exportName}, which exports the same story`,
      ...loc(csf, binding.node),
    });
  }
  return [...unique.values()];
};

const variableInit = (binding: Binding | undefined) =>
  binding?.constant && binding.node.type === 'VariableDeclarator' ? binding.node.init : undefined;

const factoryMember = (node: Node | null | undefined): 'story' | 'extend' | undefined => {
  const unwrapped = node && unwrapExpression(node);
  if (unwrapped?.type !== 'CallExpression' || unwrapped.callee.type !== 'MemberExpression') {
    return undefined;
  }
  const property = unwrapped.callee.property;
  if (unwrapped.callee.computed || property.type !== 'Identifier') {
    return undefined;
  }
  return property.name === 'story' || property.name === 'extend' ? property.name : undefined;
};

const isFactoryMeta = (csf: CsfFile, name: string, seen = new Set<string>()): boolean => {
  const init = variableInit(csf.editor.scopes.program.bindings.get(name));
  if (seen.has(name) || !csf._metaFactoryCall || !init) {
    return false;
  }
  seen.add(name);
  const initializer = withoutTypeCalls(unwrapExpression(init));
  return (
    initializer === csf._metaFactoryCall ||
    (initializer.type === 'Identifier' && isFactoryMeta(csf, initializer.name, seen))
  );
};

const isFactoryStory = (csf: CsfFile, node: Node, seen = new Set<string>()): boolean => {
  if (!isCsfFactoryCall(node)) {
    return false;
  }
  const receiver = csfFactoryReceiver(node).name;
  if (node.callee.property.name === 'story') {
    return isFactoryMeta(csf, receiver);
  }
  if (seen.has(receiver)) {
    return false;
  }
  seen.add(receiver);
  const initializer = variableInit(csf.editor.scopes.program.bindings.get(receiver));
  return initializer ? isFactoryStory(csf, unwrapExpression(initializer), seen) : false;
};

const factoryMetaConfigurationIsSafe = (csf: CsfFile): boolean => {
  const argument = csf._metaFactoryCall?.arguments[0];
  if (argument?.type !== 'Identifier') {
    return true;
  }
  const binding = csf.editor.scopes.program.bindings.get(argument.name);
  if (
    !binding?.constant ||
    binding.node.type !== 'VariableDeclarator' ||
    binding.declaration?.type !== 'VariableDeclaration' ||
    binding.declaration.kind !== 'const'
  ) {
    return false;
  }
  const initializer = binding.node.init;
  if (!initializer || unwrapExpression(initializer).type !== 'ObjectExpression') {
    return false;
  }
  return binding.references.length === 1 && binding.references[0] === argument;
};

const discoverMeta = (csf: CsfFile, report: ReportDiagnostic): Discovered[] => {
  if (csf._metaIsFactory && csf._metaFactoryCall && !factoryMetaConfigurationIsSafe(csf)) {
    report({
      code: 'unsupported-initializer',
      target: { kind: 'meta' },
      path: [],
      message: 'Cannot mutate CSF factory meta with an identifier-backed configuration',
      ...loc(csf, csf._metaFactoryCall),
    });
    return [];
  }
  const call = csf._metaIsFactory ? csf._metaFactoryCall : undefined;
  const root =
    csf._metaNode && !csf._metaNodeIsSynthetic
      ? literalRoot(csf.editor, csf._metaNode)
      : call?.arguments.length === 0
        ? argumentRoot(csf.editor, call)
        : undefined;
  if (root) {
    const binding = csf._metaVariableName
      ? csf.editor.scopes.program.bindings.get(csf._metaVariableName)
      : undefined;
    if (binding && !binding.constant) {
      report({
        code: 'ambiguous-binding',
        target: { kind: 'meta' },
        path: [],
        message: `Cannot mutate meta because ${csf._metaVariableName} is not a unique constant binding`,
        ...loc(csf, binding.node),
      });
      return [];
    }
    return [{ target: { kind: 'meta' }, root }];
  }
  if (csf._metaIsFactory && csf._metaFactoryCall) {
    report({
      code: 'unsupported-initializer',
      target: { kind: 'meta' },
      path: [],
      message: 'Cannot mutate CSF factory meta automatically; move the field manually',
      ...loc(csf, csf._metaFactoryCall),
    });
  }
  return [];
};

const annotationName = (left: E.MemberExpression) =>
  !left.computed && left.property.type === 'Identifier'
    ? left.property.name
    : left.computed && isStringLiteral(left.property)
      ? left.property.value
      : undefined;

// Where a reference to a story neither writes to it nor lets other code see its annotations.
const NON_SHARING_PARENTS = new Set([
  'ExportSpecifier',
  'TSTypeQuery',
  'JSXOpeningElement',
  'JSXClosingElement',
]);

type StoryAssignments =
  | { ok: true; assignments: Assignment[]; shared?: Rejection }
  | { ok: false; write: Rejection };

// The `Story.name = value` statements of a story, found through the references to its binding.
// Any other write to it, such as a nested or a compound one, is a `write` rejection. A reference
// that could share the story, such as an alias or a call that receives it, is a `shared` one: it
// only matters for a story whose assignments are edited, as it could add them to another story.
const assignmentsOf = (csf: CsfFile, binding: StoryBinding): StoryAssignments => {
  const editor = csf.editor;
  const parentOf = (node: Node) => editor.parentOf(node);
  const assignments: Assignment[] = [];
  let shared: Rejection | undefined;
  const references = editor.scopes.program.bindings.get(binding.localName)?.references ?? [];
  for (const reference of references) {
    // An `export` of the declaration, or a TS declaration of its name, counts as a reference.
    if (reference.type !== 'Identifier' && reference.type !== 'JSXIdentifier') {
      continue;
    }
    const parent = parentOf(reference);
    if (
      parent &&
      (NON_SHARING_PARENTS.has(parent.type) ||
        (parent.type === 'CallExpression' && parent.callee === reference))
    ) {
      continue;
    }
    if (parent?.type !== 'MemberExpression' || parent.object !== reference) {
      shared ??= {
        code: 'ambiguous-binding',
        node: reference,
        path: [],
        message: `Cannot mutate ${binding.exportName} because ${binding.localName} is shared with other code`,
      };
      continue;
    }
    let outer: Node = parent;
    for (
      let next = parentOf(outer);
      next?.type === 'MemberExpression' && next.object === outer;
      next = parentOf(outer)
    ) {
      outer = next;
    }
    const user = parentOf(outer);
    const writes =
      (user?.type === 'AssignmentExpression' && user.left === outer) ||
      user?.type === 'UpdateExpression' ||
      (user?.type === 'UnaryExpression' && user.operator === 'delete');
    if (!writes) {
      continue;
    }
    const statement = parentOf(user);
    if (
      outer !== parent ||
      user.type !== 'AssignmentExpression' ||
      statement?.type !== 'ExpressionStatement' ||
      parentOf(statement)?.type !== 'Program'
    ) {
      const write: Rejection = {
        code: 'ambiguous-binding',
        node: user,
        path: [],
        message: `Cannot mutate ${binding.exportName} because ${binding.localName} is written to outside its top-level annotations`,
      };
      return { ok: false, write };
    }
    const name = annotationName(parent);
    if (name === undefined) {
      const write: Rejection = {
        code: 'dynamic-key',
        node: parent.property,
        path: [],
        message: `Cannot mutate ${binding.exportName} because an annotation name is computed at runtime`,
      };
      return { ok: false, write };
    }
    if (user.operator !== '=') {
      const write: Rejection = {
        code: 'unsupported-initializer',
        node: user,
        path: [name],
        message: `Cannot mutate ${binding.localName}.${name} because it uses ${user.operator} assignment`,
      };
      return { ok: false, write };
    }
    const property = detachedMember(parent.property, user.right, parent.computed, statement);
    assignments.push({ statement, left: parent, property });
  }
  assignments.sort((a, b) => a.statement.start - b.statement.start);
  return { ok: true, assignments, shared };
};

// Own properties of a function that throw when a strict-mode module assigns them.
const FUNCTION_OWN_KEYS = new Set(['name', 'length', 'caller', 'arguments']);

// A story edited as one object: the members of its object literal, if it has one, then its
// `Story.name = value` assignments, which run after it. A missing member goes into the object
// literal, or else into a new assignment after the story's last one.
const storyRoot = (
  csf: CsfFile,
  binding: StoryBinding,
  object: E.ObjectExpression | undefined,
  assignments: Assignment[]
): ObjectRoot => {
  const editor = csf.editor;
  const literal = object && literalRoot(editor, object);
  const byProperty = new Map(assignments.map((assignment) => [assignment.property, assignment]));
  const own = (members: readonly Property[]) => members.filter((member) => !byProperty.has(member));
  const declaration = csf.program.body.find(
    (statement) =>
      statement.start <= binding.declaration.start && binding.declaration.end <= statement.end
  )!;
  // `removed` are statements the same edits remove, which the new ones cannot follow.
  const assign = (members: MemberInsert[], removed: ReadonlySet<Node> = new Set()) => {
    const after =
      assignments.findLast(({ statement }) => !removed.has(statement))?.statement ?? declaration;
    const end = editor.semicolons ? ';' : '';
    for (const { key, value } of members) {
      insertStatementAfter(
        editor,
        after,
        `${binding.localName}${printMemberAccess(key, editor.quote)} = ${value}${end}`
      );
    }
  };
  const statementsOf = (members: readonly Property[]) =>
    new Set<Node>(members.flatMap((member) => byProperty.get(member)?.statement ?? []));
  const remove = (members: Property[]) => {
    const inObject = own(members);
    if (inObject.length > 0) {
      literal!.remove(inObject);
    }
    const statements = statementsOf(members);
    if (statements.size > 0) {
      removeStatements(editor, statements);
    }
  };
  const take = (member: Property, key: string): MemberInsert => {
    const assignment = byProperty.get(member);
    if (!assignment) {
      return literal!.take(member, key);
    }
    const value = placeableValueSource(editor, member);
    return { key, value, text: `${printKey(key, editor.quote)}: ${value}` };
  };
  const append = (members: MemberInsert[]) => (literal ? literal.append(members) : assign(members));
  return {
    properties: [...(object?.properties ?? []), ...assignments.map(({ property }) => property)],
    // Moving an assignment's value moves when it is evaluated.
    detached: assignments.length > 0,
    node: object,
    append,
    prepend: (members) => (literal ? literal.prepend(members) : assign(members)),
    remove,
    replaceValue: (member, text) => {
      const assignment = byProperty.get(member);
      if (!assignment) {
        literal!.replaceValue(member, text);
        return;
      }
      const { start, end } = outerSpan(assignment.property.value);
      editor.edits.overwrite(start, end, text);
    },
    rename: (member, key) => {
      const assignment = byProperty.get(member);
      if (!assignment) {
        literal!.rename(member, key);
        return;
      }
      const { left } = assignment;
      editor.edits.overwrite(
        outerSpan(left.object).end,
        left.end,
        printMemberAccess(key, editor.quote)
      );
    },
    // `CsfObject` refuses a group of members from both the object and the assignments.
    group: (members, key) => {
      if (literal && own(members).length === members.length) {
        literal.group(members, key);
        return;
      }
      const texts = members.map((member) => take(member, staticKey(member)!).text);
      const value = printObject(texts, editor.indent);
      const statements = statementsOf(members);
      removeStatements(editor, statements);
      assign([{ key, value, text: '' }], statements);
    },
    take,
    // Assignments are added after the last one, or after the declaration, and removed with the
    // space after the statement before them.
    members: () => {
      const { body } = csf.program;
      const after = assignments.at(-1)?.statement ?? declaration;
      const next = body.find((statement) => statement.start >= after.end);
      const inLiteral = literal?.members?.() ?? { owner: binding.declaration, keys: [], gaps: [] };
      const before = assignments.map(({ statement }) => {
        const previous = body[body.indexOf(statement) - 1];
        return { start: previous?.end ?? 0, end: statement.start };
      });
      return {
        owner: inLiteral.owner,
        keys: [...inLiteral.keys, ...assignments.map(({ left }) => left.property)],
        gaps: [
          ...inLiteral.gaps,
          ...before,
          ...(literal && assignments.length === 0
            ? []
            : [{ start: after.end, end: next?.start ?? csf._code.length }]),
        ],
      };
    },
    refuseKey: object
      ? undefined
      : (key) =>
          FUNCTION_OWN_KEYS.has(key)
            ? `Cannot add ${binding.localName}.${key} because a function's ${key} cannot be assigned${key === 'name' ? '; set storyName instead' : ''}`
            : undefined,
  };
};

// The story an alias such as `export const Secondary = Primary` shares its object with, through
// other stories that alias it.
const aliasedStory = (csf: CsfFile, stories: StoryBinding[], node: Node | undefined) => {
  const seen = new Set<string>();
  for (let current = node; current?.type === 'Identifier' && !seen.has(current.name);) {
    const { name } = current;
    seen.add(name);
    const story = stories.find(({ localName }) => localName === name);
    if (!story) {
      return undefined;
    }
    const init = variableInit(csf.editor.scopes.program.bindings.get(name));
    current = init ? unwrapExpression(init) : undefined;
    if (current?.type !== 'Identifier') {
      return story;
    }
  }
  return undefined;
};

// A story without an object literal is a function or a bound template, which its assignments
// annotate. Any other value may be shared, so annotating it could change other stories.
const isAnnotatable = (node: Node | undefined) =>
  !!node &&
  (isFunction(node) ||
    (node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      !node.callee.computed &&
      isIdentifier(node.callee.property, 'bind')));

// A write through an alias, such as `B.args = {}` after `export const B = A`, changes the object
// of the story it aliases: for each such story, the first write through one of its aliases.
const writesThroughAliases = (csf: CsfFile, bindings: StoryBinding[]) => {
  const writes = new Map<StoryBinding, { alias: StoryBinding; node: Node }>();
  for (const alias of bindings) {
    const init = alias.declaration.type === 'VariableDeclarator' ? alias.declaration.init : null;
    const node = init ? unwrapExpression(init) : undefined;
    const aliased = node?.type === 'Identifier' ? aliasedStory(csf, bindings, node) : undefined;
    if (!aliased || aliased === alias || writes.has(aliased)) {
      continue;
    }
    const { assignments, write } = assignmentsOf(csf, alias);
    const at = write?.node ?? assignments[0]?.statement;
    if (at) {
      writes.set(aliased, { alias, node: at });
    }
  }
  return writes;
};

const discoverStories = (
  csf: CsfFile,
  bindings: StoryBinding[],
  report: ReportDiagnostic
): Discovered[] => {
  const aliasWrites = writesThroughAliases(csf, bindings);
  return bindings.flatMap((binding): Discovered[] => {
    const { declaration } = binding;
    const aliasWrite = aliasWrites.get(binding);
    if (aliasWrite) {
      // The editor would edit an object that code it does not see changes too.
      report({
        code: 'ambiguous-binding',
        target: storyTarget(binding),
        path: [],
        message: `Cannot mutate ${binding.exportName} because ${aliasWrite.alias.localName}, an alias of it, is written to`,
        ...loc(csf, aliasWrite.node),
      });
      return [];
    }
    const init = declaration.type === 'VariableDeclarator' ? declaration.init : declaration;
    const node = init ? unwrapExpression(init as Node) : undefined;
    if (node && factoryMember(node)) {
      const argument = node.type === 'CallExpression' ? node.arguments[0] : undefined;
      const argumentNode =
        argument && argument.type !== 'SpreadElement' ? unwrapExpression(argument) : undefined;
      if (node.type === 'CallExpression' && isFactoryStory(csf, node)) {
        if (node.arguments.length === 0) {
          return [{ target: storyTarget(binding), root: argumentRoot(csf.editor, node) }];
        }
        if (node.arguments.length === 1 && argumentNode?.type === 'ObjectExpression') {
          return [{ target: storyTarget(binding), root: literalRoot(csf.editor, argumentNode) }];
        }
      }
      report({
        code: 'unsupported-initializer',
        target: storyTarget(binding),
        path: [],
        message: `Cannot mutate CSF factory story ${binding.exportName} because its configuration is not an inline object literal`,
        ...loc(csf, node),
      });
      return [];
    }
    const object = node?.type === 'ObjectExpression' ? node : undefined;
    const found = assignmentsOf(csf, binding);
    const reject = ({ code, node: at, path, message }: Rejection): Discovered[] => {
      report({ code, target: storyTarget(binding), path, message, ...loc(csf, at) });
      return [];
    };
    if (!found.ok) {
      return reject(found.write);
    }
    const { assignments, shared } = found;
    if (assignments.length === 0 && object) {
      return [{ target: storyTarget(binding), root: literalRoot(csf.editor, object) }];
    }
    if (assignments.length === 0 && !isAnnotatable(node)) {
      const aliased = aliasedStory(csf, bindings, node);
      if (aliased) {
        return reject({
          code: 'aliased-story',
          node: node!,
          path: [],
          message: `Cannot mutate story ${binding.exportName} because it is an alias of story ${aliased.exportName}`,
        });
      }
      return reject({
        code: 'unsupported-initializer',
        node: node ?? declaration,
        path: [],
        message: `Cannot mutate story ${binding.exportName} because it is not a story object, function or bound template`,
      });
    }
    if (shared) {
      return reject(shared);
    }
    if (!object && !isAnnotatable(node)) {
      const name = annotationName(assignments[0].left)!;
      return reject({
        code: 'unsupported-initializer',
        node: assignments[0].property.value,
        path: [name],
        message: `Cannot mutate ${binding.localName}.${name} because ${binding.localName} is not a story object, function or bound template`,
      });
    }
    return [{ target: storyTarget(binding), root: storyRoot(csf, binding, object, assignments) }];
  });
};

// What discovery found in a parse: the objects by their targets, and the diagnostics it reported.
type Discovery = {
  objects: Discovered[];
  roots: Map<string, ObjectRoot>;
  diagnostics: CsfMutationDiagnostic[];
};

// Discovery reads only the parse and the index derived from it, so it is kept per parse. A
// commit makes a new parse and a rollback puts back the old one, whose discovery still holds.
const discoveries = new WeakMap<ParsedModule, Map<string, Discovery>>();

const discover = (csf: CsfFile, options: CsfObjectOptions): Discovery => {
  csf._assertIndexed();
  const module = csf.editor._module;
  const byOptions = discoveries.get(module) ?? new Map<string, Discovery>();
  discoveries.set(module, byOptions);
  const key = `${options.meta ?? true}:${options.stories ?? true}`;
  const cached = byOptions.get(key);
  if (cached) {
    return cached;
  }
  const diagnostics: CsfMutationDiagnostic[] = [];
  const report = (diagnostic: CsfMutationDiagnostic) => diagnostics.push(diagnostic);
  const includeStories = options.stories ?? true;
  const bindings = includeStories ? storyBindings(csf, report) : [];
  const objects = [
    ...((options.meta ?? true) ? discoverMeta(csf, report) : []),
    ...(includeStories ? discoverStories(csf, bindings, report) : []),
  ];
  const roots = new Map(objects.map(({ target, root }) => [JSON.stringify(target), root]));
  const discovery = { objects, roots, diagnostics };
  byOptions.set(key, discovery);
  return discovery;
};

// A diagnostic reported again is located in the code as edited now.
const relocated = (csf: CsfFile, diagnostic: CsfMutationDiagnostic): CsfMutationDiagnostic => {
  const node = diagnostic.loc && located.get(diagnostic.loc);
  return node ? { ...diagnostic, ...loc(csf, node) } : diagnostic;
};

const editorOf = (
  csf: CsfFile,
  options: CsfObjectOptions,
  target: CsfObjectTarget,
  report: ReportDiagnostic,
  markChanged: MarkChanged
): CsfObject => {
  const key = JSON.stringify(target);
  const host: CsfObjectHost = {
    editor: csf.editor,
    index: { reads: (path) => indexedPath(target, path), callees: INDEXED_CALLEES },
    // A commit parses the file again, so the object is found again by its target.
    root: () => discover(csf, options).roots.get(key),
  };
  return createCsfObject(target, host, report, markChanged);
};

export const discoverCsfObjects = (
  csf: CsfFile,
  options: CsfObjectOptions,
  report: ReportDiagnostic,
  markChanged: MarkChanged
): readonly CsfObject[] => {
  const { objects, diagnostics } = discover(csf, options);
  diagnostics.forEach((diagnostic) => report(relocated(csf, diagnostic)));
  return objects.map(({ target }) => editorOf(csf, options, target, report, markChanged));
};

// The answer of `objects()` for this one story, so a name is mapped to its object only by
// `discover`. Reports only the diagnostics of this story, as
// no other story was asked for.
export const discoverStory = (
  csf: CsfFile,
  exportName: string,
  report: ReportDiagnostic,
  markChanged: MarkChanged
): CsfObjectLookup | undefined => {
  csf._assertIndexed();
  if (!Object.hasOwn(csf._stories, exportName)) {
    return undefined;
  }
  const isOwn = (target: CsfMutationTarget) =>
    'exportName' in target && target.exportName === exportName;
  const { objects, diagnostics } = discover(csf, { meta: false });
  const found = objects.find(({ target }) => isOwn(target));
  if (found) {
    return { ok: true, object: editorOf(csf, { meta: false }, found.target, report, markChanged) };
  }
  const own = diagnostics.find(({ target }) => isOwn(target));
  const diagnostic: CsfMutationDiagnostic = own
    ? relocated(csf, own)
    : {
        code: 'unsupported-initializer',
        target: {
          kind: 'story',
          exportName,
          localName: csf._stories[exportName].localName ?? exportName,
        },
        path: [],
        message: `Cannot mutate story ${exportName} automatically`,
      };
  report(diagnostic);
  return { ok: false, diagnostic };
};
