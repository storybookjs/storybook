// @ts-nocheck

const FS_MODULES = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises']);

const FS_WRITES = new Set([
  'appendFile',
  'appendFileSync',
  'copyFile',
  'copyFileSync',
  'cp',
  'cpSync',
  'createWriteStream',
  'rename',
  'renameSync',
  'rm',
  'rmSync',
  'rmdir',
  'rmdirSync',
  'unlink',
  'unlinkSync',
  'writeFile',
  'writeFileSync',
]);

// Package manager subcommands that change the project, its dependencies or its config.
const COMMAND_WRITES = new Set([
  'add',
  'dedupe',
  'init',
  'install',
  'link',
  'remove',
  'uninstall',
  'unlink',
  'up',
  'update',
  'upgrade',
]);
const CONFIG_WRITES = new Set(['delete', 'set', 'unset']);

const COMMAND_RUNNERS = new Set(['executeCommand', 'executeCommandSync', 'runInternalCommand']);

const nameOf = (node) => {
  if (!node) {
    return undefined;
  }
  if (node.type === 'Identifier') {
    return node.name;
  }
  return node.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined;
};

const stringAt = (array, index) =>
  array?.type === 'ArrayExpression' ? nameOf(array.elements[index]) : undefined;

const changesProject = (subcommand, next) =>
  COMMAND_WRITES.has(subcommand) || (subcommand === 'config' && CONFIG_WRITES.has(next));

// The subcommand and its first argument of `runInternalCommand('config', ['set', …])` or
// `executeCommand({ command: 'pnpm', args: ['config', 'set', …] })`.
const commandOf = (call) => {
  const [first, second] = call.arguments;
  if (first?.type === 'ObjectExpression') {
    const args = first.properties.find(
      (property) => property.type === 'Property' && nameOf(property.key) === 'args'
    )?.value;
    return [stringAt(args, 0), stringAt(args, 1)];
  }
  return [nameOf(first), stringAt(second, 0)];
};

const isEffectsCall = (node) =>
  node.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  nameOf(node.callee.object) === 'effects' &&
  ['runCommand', 'runStep'].includes(nameOf(node.callee.property));

module.exports = {
  meta: {
    type: /** @type {const} */ ('problem'),
    docs: {
      description:
        'Require CLI code to change project files and run project commands through effects',
      category: 'Possible Errors',
      recommended: true,
      url: 'https://github.com/storybookjs/storybook/blob/next/.agents/guidelines/code-authoring.md',
    },
    messages: {
      fsWrite:
        'Write and remove project files through `effects` from `storybook/internal/common`, so a dry run stages the change and lists it. A write that is not a project change, such as a cache, disables this rule with a reason.',
      command:
        'Run a command that changes the project inside `effects.runCommand`, so a dry run records it instead of running it.',
    },
    schema: [],
  },
  create(context) {
    // Local names of `fs` modules and of their `promises` namespace.
    const fsNamespaces = new Set();

    const isFsNamespace = (node) =>
      (node.type === 'Identifier' && fsNamespaces.has(node.name)) ||
      (node.type === 'MemberExpression' &&
        nameOf(node.property) === 'promises' &&
        isFsNamespace(node.object));

    return {
      ImportDeclaration(node) {
        if (!FS_MODULES.has(node.source.value) || node.importKind === 'type') {
          return;
        }
        let writes = false;
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportSpecifier') {
            const imported = nameOf(specifier.imported);
            if (imported === 'promises') {
              fsNamespaces.add(specifier.local.name);
            } else if (FS_WRITES.has(imported) && specifier.importKind !== 'type') {
              writes = true;
            }
          } else {
            fsNamespaces.add(specifier.local.name);
          }
        }
        if (writes) {
          context.report({ node, messageId: 'fsWrite' });
        }
      },
      MemberExpression(node) {
        if (FS_WRITES.has(nameOf(node.property)) && isFsNamespace(node.object)) {
          context.report({ node, messageId: 'fsWrite' });
        }
      },
      CallExpression(node) {
        const callee = node.callee.type === 'MemberExpression' ? node.callee.property : node.callee;
        if (!COMMAND_RUNNERS.has(nameOf(callee))) {
          return;
        }
        const [subcommand, next] = commandOf(node);
        if (!changesProject(subcommand, next)) {
          return;
        }
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (isEffectsCall(parent)) {
            return;
          }
        }
        context.report({ node, messageId: 'command' });
      },
    };
  },
};
