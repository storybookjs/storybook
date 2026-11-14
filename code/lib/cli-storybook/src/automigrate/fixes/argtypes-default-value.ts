import { HandledError } from 'storybook/internal/common';
import {
  type CsfMutationDiagnostic,
  type CsfObject,
  type CsfPath,
  type ESTree as E,
  type ESTreeNode,
  isTSWrapper,
  locationOf,
  staticKey,
  walk,
} from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import { describeDiagnostic, failsFile } from '../helpers/edit-parsed-file.ts';
import type { Fix } from '../types.ts';

/**
 * Fields whose `defaultValue` is not the deprecated `argTypes.<name>.defaultValue`: the docs table
 * keeps `table.defaultValue`, and `args`, `globalTypes` and `parameters` never hold an argType. An
 * arg may still be named so, as in `argTypes: { table: { defaultValue: 1 } }`.
 */
const NOT_AN_ARG_TYPE = new Set(['table', 'args', 'globalTypes', 'parameters']);

type Parents = Map<ESTreeNode, ESTreeNode | null>;

// The node that holds `node` as a value, past `as`, `satisfies` and parentheses.
const holderOf = (node: ESTreeNode, parents: Parents) => {
  let holder = parents.get(node);
  while (holder && (isTSWrapper(holder) || holder.type === 'ParenthesizedExpression')) {
    holder = parents.get(holder);
  }
  return holder;
};

const memberName = (node: ESTreeNode | null | undefined) =>
  node?.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier'
    ? node.property.name
    : undefined;

/**
 * Whether `object` is an argTypes object, whose own keys name args: `argTypes: {…}`, `X.argTypes =
 * {…}`, or `const argTypes = {…}`.
 */
const isArgTypes = (object: ESTreeNode | null, parents: Parents) => {
  if (object?.type !== 'ObjectExpression') {
    return false;
  }
  const holder = holderOf(object, parents);
  return (
    (holder?.type === 'Property' && staticKey(holder) === 'argTypes') ||
    (holder?.type === 'AssignmentExpression' &&
      memberName(holder.left as ESTreeNode) === 'argTypes') ||
    (holder?.type === 'VariableDeclarator' &&
      holder.id.type === 'Identifier' &&
      holder.id.name === 'argTypes')
  );
};

// Where a `defaultValue` sits, such as `base.defaultValue` or `argTypes.label.make(…).defaultValue`.
const pathOf = (property: ESTreeNode, parents: Parents, code: string) => {
  const segments: string[] = [];
  let child = property;
  for (let node = parents.get(property); node; child = node, node = parents.get(node)) {
    if (node.type === 'Property' && node.value === child) {
      segments.unshift(staticKey(node) ?? '[…]');
    } else if (node.type === 'CallExpression' && node.callee !== child) {
      segments.unshift(`${code.slice(node.callee.start, node.callee.end)}(…)`);
    } else if (node.type === 'VariableDeclarator') {
      segments.unshift(code.slice(node.id.start, node.id.end));
      break;
    } else if (node.type === 'AssignmentExpression') {
      segments.unshift(code.slice(node.left.start, node.left.end));
      break;
    } else if (
      !['ObjectExpression', 'ArrayExpression', 'SpreadElement', 'ParenthesizedExpression'].includes(
        node.type
      ) &&
      !isTSWrapper(node)
    ) {
      break;
    }
  }
  return [...segments, 'defaultValue'].join('.');
};

interface Candidate {
  path: string;
  line: number;
  start: number;
}

/**
 * The `defaultValue` properties in a file that may be a deprecated `argTypes.<name>.defaultValue`:
 * every object property with that key, except under the fields that cannot hold an argType, except
 * in destructuring patterns, and except an arg named `defaultValue`. One in a helper or a story the
 * editor cannot read counts too, so the file is reported when the edit cannot reach it.
 */
const candidatesIn = (program: E.Program, code: string): Candidate[] => {
  const parents: Parents = new Map();
  const found: Candidate[] = [];
  walk(program as ESTreeNode, (node, parent) => {
    parents.set(node, parent);
    if (node.type !== 'Property' || parent?.type === 'ObjectPattern') {
      return;
    }
    // An arg's name, whatever it is, is not a field of the argType.
    if (isArgTypes(parent, parents)) {
      return;
    }
    const key = staticKey(node);
    if (key && NOT_AN_ARG_TYPE.has(key)) {
      return false;
    }
    if (key === 'defaultValue') {
      found.push({
        path: pathOf(node, parents, code),
        line: locationOf(code, node.start, node.end).start.line,
        start: node.start,
      });
    }
  });
  return found;
};

const argName = (property: E.ObjectProperty): string | undefined => {
  if (property.key.type === 'Identifier' && !property.computed) {
    return property.key.name;
  }
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value;
  }
  return undefined;
};

interface Plan {
  removals: { object: CsfObject; path: CsfPath }[];
  // Why the editor could not read an argType, or `argTypes` itself.
  unread: CsfMutationDiagnostic[];
  // Whether an argType may come from elsewhere: a spread, a computed key, or `argTypes` that is not
  // an object literal.
  opaque: boolean;
}

/** Read every `argTypes.<name>.defaultValue` of `object` before any edit moves the lines. */
const plan = (object: CsfObject, into: Plan) => {
  const argTypes = object.inspect(['argTypes']);
  if (argTypes.kind === 'unreadable') {
    into.unread.push(argTypes.diagnostic);
    return;
  }
  if (argTypes.kind !== 'value') {
    return;
  }
  if (argTypes.node.type !== 'ObjectExpression') {
    into.opaque = true;
    return;
  }
  for (const property of argTypes.node.properties) {
    const name = property.type === 'Property' ? argName(property) : undefined;
    if (!name) {
      into.opaque = true;
      continue;
    }
    const path = ['argTypes', name, 'defaultValue'];
    const found = object.inspect(path);
    if (found.kind === 'value') {
      into.removals.push({ object, path });
    } else if (found.kind === 'unreadable') {
      into.unread.push(found.diagnostic);
    }
  }
};

/**
 * Migrate one parsed file. A file without a `defaultValue` that may belong to an argType has nothing
 * to migrate, so the objects the editor cannot read in it are not reported. After the edit, a
 * `defaultValue` left in place fails the file when it may reach an argType the editor could not
 * read; one that cannot is not an argType's.
 */
const migrate = (
  file: {
    program: E.Program;
    editor: { code: string };
    mutationDiagnostics: readonly CsfMutationDiagnostic[];
  },
  objects: () => readonly CsfObject[]
) => {
  const before = candidatesIn(file.program, file.editor.code);
  if (before.length === 0) {
    return;
  }
  const diagnosticsBefore = file.mutationDiagnostics.length;
  const found: Plan = { removals: [], unread: [], opaque: false };
  objects().forEach((object) => plan(object, found));
  found.removals.forEach(({ object, path }) => object.remove(path));

  // A refused edit, or a story the editor could not discover, fails the file through its own
  // diagnostic, which `editParsedFile` throws.
  if (file.mutationDiagnostics.slice(diagnosticsBefore).some(failsFile)) {
    return;
  }
  const left = candidatesIn(file.program, file.editor.code);
  if (left.length === 0 || (found.unread.length === 0 && !found.opaque)) {
    return;
  }

  // The file is left unchanged, so name each `defaultValue` with its line before the edit.
  const unmatched = [...before];
  const leftBefore = left.map(({ path }) => {
    const index = unmatched.findIndex((candidate) => candidate.path === path);
    return index === -1 ? undefined : unmatched.splice(index, 1)[0];
  });
  const named = left
    .map(({ path }, index) => {
      const original = leftBefore[index];
      return original ? `\`${path}\` (line ${original.line})` : `\`${path}\``;
    })
    .join(', ');
  // Only the reasons of the argTypes that hold what is left: the others did not keep it in place.
  const reasons = found.unread.filter(({ loc }) =>
    leftBefore.some(
      (candidate) =>
        candidate && loc && candidate.start >= loc.start.index && candidate.start < loc.end.index
    )
  );
  throw new HandledError(
    reasons.length > 0
      ? [`${named} is left in place`, ...new Set(reasons.map(describeDiagnostic))].join('; ')
      : `${named} is left in place: it may reach an argType the migration could not read, through a variable, a spread or a helper. If it does, remove it by hand`
  );
};

export const argtypesDefaultValue: Fix = {
  id: 'argtypes-default-value',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#argtypes-defaultvalue-removed',

  prompt() {
    return `Remove deprecated ${picocolors.cyan('argTypes.<name>.defaultValue')}? It no longer sets an arg. Use ${picocolors.cyan('args')} or ${picocolors.cyan('table.defaultValue')}.`;
  },

  transform: () => [
    {
      filter: { kind: ['preview', 'story'], code: 'defaultValue' },
      editConfig: (config) => migrate(config, () => [config]),
      editCsf: (csf) => migrate(csf, () => csf.objects()),
    },
  ],
};
