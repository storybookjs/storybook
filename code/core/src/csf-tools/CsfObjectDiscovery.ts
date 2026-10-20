import type { CsfFile } from './CsfFile.ts';
import { csfFactoryReceiver, isCsfFactoryCall, withoutTypeCalls } from './CsfFile.ts';
import {
  type CsfMutationDiagnostic,
  type CsfMutationDiagnosticCode,
  type CsfObject,
  type CsfObjectHost,
  type CsfObjectOptions,
  type CsfObjectTarget,
  createCsfObject,
} from './CsfObject.ts';
import { type MemberInsert, type ObjectRoot, detachedMember, literalRoot } from './ObjectRoot.ts';
import {
  type E,
  type Node,
  type Property,
  isFunction,
  isIdentifier,
  isStringLiteral,
  locationOf,
  outerSpan,
  staticKey,
  unwrapExpression,
} from './estree/ast.ts';
import {
  insertStatementAfter,
  printKey,
  printMemberAccess,
  printMembers,
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

const loc = (csf: CsfFile, node: Node) => ({ loc: locationOf(csf._code, node.start, node.end) });

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
    });
  }
};

const storyBindings = (csf: CsfFile, report: ReportDiagnostic): StoryBinding[] => {
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
            name in csf._stories
          );
        }
      }
    } else if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
      const { name } = declaration.id;
      addQualifiedBinding(csf, declaration, name, name, bindings, report, name in csf._stories);
    }
    for (const specifier of statement.specifiers) {
      if (specifier.local.type !== 'Identifier') {
        continue;
      }
      const exportName = exportedName(specifier.exported);
      if (statement.source) {
        if (exportName !== 'default' && exportName in csf._stories) {
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
        exportName in csf._stories
      );
    }
  }
  const candidates = [...bindings.values()].filter((binding) => binding.exportName in csf._stories);
  const unique = new Map<Node, StoryBinding>();
  for (const candidate of candidates) {
    if (!unique.has(candidate.declaration)) {
      unique.set(candidate.declaration, candidate);
    }
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
  if (csf._metaNode && !csf._metaNodeIsSynthetic) {
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
    return [{ target: { kind: 'meta' }, root: literalRoot(csf.editor, csf._metaNode) }];
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

// The `Story.name = value` statements of a story, found through the references to its binding.
// Any other write to it, such as a nested or a compound one, is a `write` rejection. A reference
// that could share the story, such as an alias or a call that receives it, is a `shared` one: it
// only matters for a story whose assignments are edited, as it could add them to another story.
const assignmentsOf = (csf: CsfFile, binding: StoryBinding) => {
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
      return { assignments, write };
    }
    const name = annotationName(parent);
    if (name === undefined) {
      const write: Rejection = {
        code: 'dynamic-key',
        node: parent.property,
        path: [],
        message: `Cannot mutate ${binding.exportName} because an annotation name is computed at runtime`,
      };
      return { assignments, write };
    }
    if (user.operator !== '=') {
      const write: Rejection = {
        code: 'unsupported-initializer',
        node: user,
        path: [name],
        message: `Cannot mutate ${binding.localName}.${name} because it uses ${user.operator} assignment`,
      };
      return { assignments, write };
    }
    const property = detachedMember(parent.property, user.right, parent.computed, statement);
    assignments.push({ statement, left: parent, property });
  }
  assignments.sort((a, b) => a.statement.start - b.statement.start);
  return { assignments, shared };
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
      const value = texts.some((text) => text.includes('\n'))
        ? printMembers(texts, editor.indent)
        : `{ ${texts.join(', ')} }`;
      const statements = statementsOf(members);
      removeStatements(editor, statements);
      assign([{ key, value, text: '' }], statements);
    },
    take,
    refuseKey: object
      ? undefined
      : (key) =>
          FUNCTION_OWN_KEYS.has(key)
            ? `Cannot add ${binding.localName}.${key} because a function's ${key} cannot be assigned${key === 'name' ? '; set storyName instead' : ''}`
            : undefined,
  };
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

const discoverStories = (
  csf: CsfFile,
  bindings: StoryBinding[],
  report: ReportDiagnostic
): Discovered[] =>
  bindings.flatMap((binding): Discovered[] => {
    const { declaration } = binding;
    const init = declaration.type === 'VariableDeclarator' ? declaration.init : declaration;
    const node = init ? unwrapExpression(init as Node) : undefined;
    if (node && factoryMember(node)) {
      const argument = node.type === 'CallExpression' ? node.arguments[0] : undefined;
      const argumentNode =
        argument && argument.type !== 'SpreadElement' ? unwrapExpression(argument) : undefined;
      if (
        node.type === 'CallExpression' &&
        isFactoryStory(csf, node) &&
        node.arguments.length === 1 &&
        argumentNode?.type === 'ObjectExpression'
      ) {
        return [{ target: storyTarget(binding), root: literalRoot(csf.editor, argumentNode) }];
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
    const { assignments, write, shared } = assignmentsOf(csf, binding);
    const reject = ({ code, node: at, path, message }: Rejection): Discovered[] => {
      report({ code, target: storyTarget(binding), path, message, ...loc(csf, at) });
      return [];
    };
    if (write) {
      return reject(write);
    }
    if (assignments.length === 0 && object) {
      return [{ target: storyTarget(binding), root: literalRoot(csf.editor, object) }];
    }
    if (assignments.length === 0 && !isAnnotatable(node)) {
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

const discover = (
  csf: CsfFile,
  options: CsfObjectOptions,
  report: ReportDiagnostic
): Discovered[] => {
  csf._assertIndexed();
  const includeStories = options.stories ?? true;
  const bindings = includeStories ? storyBindings(csf, report) : [];
  return [
    ...((options.meta ?? true) ? discoverMeta(csf, report) : []),
    ...(includeStories ? discoverStories(csf, bindings, report) : []),
  ];
};

const sameTarget = (a: CsfObjectTarget, b: CsfObjectTarget) =>
  JSON.stringify(a) === JSON.stringify(b);

export const discoverCsfObjects = (
  csf: CsfFile,
  options: CsfObjectOptions,
  report: ReportDiagnostic,
  markChanged: MarkChanged
): readonly CsfObject[] =>
  discover(csf, options, report).map(({ target }) => {
    const host: CsfObjectHost = {
      editor: csf.editor,
      root: () =>
        // Edits re-parse the file, so the object is found again by its target.
        discover(csf, options, () => {}).find((candidate) => sameTarget(candidate.target, target))
          ?.root,
    };
    return createCsfObject(target, host, report, markChanged);
  });
