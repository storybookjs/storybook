import { HandledError } from 'storybook/internal/common';
import {
  type CsfMutationDiagnostic,
  type CsfObject,
  type ESTree as E,
  type ESTreeNode,
  locationOf,
  staticKey,
  walk,
} from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

const argName = (property: E.ObjectProperty): string | undefined => {
  if (property.key.type === 'Identifier' && !property.computed) {
    return property.key.name;
  }
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value;
  }
  return undefined;
};

/**
 * Fields whose `defaultValue` is not the deprecated `argTypes.<name>.defaultValue`: the docs table
 * keeps `table.defaultValue`, and `args`, `globalTypes` and `parameters` never hold an argType.
 */
const NOT_AN_ARG_TYPE = new Set(['table', 'args', 'globalTypes', 'parameters']);

/**
 * The `defaultValue` properties in a file that may be a deprecated `argTypes.<name>.defaultValue`:
 * every object property with that key, except under the fields that cannot hold an argType, and
 * except in destructuring patterns. One that sits in a helper or a story the editor cannot read
 * counts too, so the file is reported when the edit cannot reach it.
 */
const argTypeDefaultValues = (program: E.Program) => {
  const found: E.ObjectProperty[] = [];
  walk(program as ESTreeNode, (node, parent) => {
    if (node.type !== 'Property' || parent?.type === 'ObjectPattern') {
      return;
    }
    const key = staticKey(node);
    if (key && NOT_AN_ARG_TYPE.has(key)) {
      return false;
    }
    if (key === 'defaultValue') {
      found.push(node as E.ObjectProperty);
    }
  });
  return found;
};

const describe = ({ message, loc }: CsfMutationDiagnostic) =>
  loc ? `line ${loc.start.line}: ${message}` : message;

/**
 * Remove every `argTypes.<name>.defaultValue` the editor can read. An argType it cannot read, such
 * as a helper call or a spread, is skipped with its reason: whether it held a `defaultValue` is
 * decided afterwards, from what is left in the file.
 */
const strip = (object: CsfObject, unread: CsfMutationDiagnostic[]) => {
  const argTypes = object.inspect(['argTypes']);
  if (argTypes.kind === 'unreadable') {
    unread.push(argTypes.diagnostic);
  }
  if (argTypes.kind !== 'value' || argTypes.node.type !== 'ObjectExpression') {
    return;
  }
  for (const property of argTypes.node.properties) {
    if (property.type !== 'Property') {
      continue;
    }
    const name = argName(property);
    if (!name) {
      continue;
    }
    const path = ['argTypes', name, 'defaultValue'];
    const found = object.inspect(path);
    if (found.kind === 'value') {
      object.remove(path);
    } else if (found.kind === 'unreadable') {
      unread.push(found.diagnostic);
    }
  }
};

/**
 * Migrate one parsed file. A file without a `defaultValue` that may belong to an argType has nothing
 * to migrate, so the objects the editor cannot read in it are not reported. A file that still has
 * one after the edit is reported, with where it is and why the editor could not reach it.
 */
const migrate = (
  file: {
    program: E.Program;
    editor: { code: string };
    mutationDiagnostics: readonly CsfMutationDiagnostic[];
  },
  objects: () => readonly CsfObject[]
) => {
  if (argTypeDefaultValues(file.program).length === 0) {
    return;
  }
  const diagnosticsBefore = file.mutationDiagnostics.length;
  const unread: CsfMutationDiagnostic[] = [];
  objects().forEach((object) => strip(object, unread));
  const left = argTypeDefaultValues(file.program);
  // A refused edit, or a story the editor could not discover, fails the file through its own
  // diagnostic. Without one, what is left is a `defaultValue` the edits could not reach.
  if (left.length === 0 || file.mutationDiagnostics.length > diagnosticsBefore) {
    return;
  }
  const lines = [
    ...new Set(
      left.map((property) => locationOf(file.editor.code, property.start, property.end).start.line)
    ),
  ];
  // Only the reasons of the argTypes that hold what is left: the others did not keep it in place.
  const reasons = unread.filter(
    ({ loc }) => loc && lines.some((line) => line >= loc.start.line && line <= loc.end.line)
  );
  const where = `${lines.length === 1 ? 'line' : 'lines'} ${lines.join(', ')}`;
  throw new HandledError(
    reasons.length > 0
      ? [`${where}: \`defaultValue\` is left in place`, ...reasons.map(describe)].join('; ')
      : `${where}: \`defaultValue\` is left in place, outside any argType the migration could read. If it reaches one through a variable, a spread or a helper, remove it by hand`
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
