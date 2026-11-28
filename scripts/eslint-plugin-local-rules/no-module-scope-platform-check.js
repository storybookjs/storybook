// @ts-nocheck

// Reads at module scope of what the Windows test probe (scripts/ci/os-probe/probe.ts) traps at run
// time: `process.platform`, `os.platform()`, `os.type()`, `os.EOL`, `path.sep` and
// `path.delimiter`. A call to a helper that reads them, such as `const isWin = isWindows()`, is not
// caught.

const OS_MODULES = new Set(['os', 'node:os']);
const PATH_MODULES = new Set(['path', 'node:path']);
const OS_CALLS = new Set(['platform', 'type']);
const OS_VALUES = new Set(['EOL']);
const PATH_VALUES = new Set(['sep', 'delimiter']);

const propertyName = (node) =>
  !node.computed && node.property.type === 'Identifier' ? node.property.name : undefined;

/** Code inside a function, or in an instance field, runs after the module has loaded. */
const isDeferred = (node) => {
  for (let current = node.parent; current; current = current.parent) {
    switch (current.type) {
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return true;
      case 'PropertyDefinition':
      case 'AccessorProperty':
        if (!current.static && current.value && current !== node) {
          return true;
        }
        break;
    }
  }
  return false;
};

const isCallee = (node) => node.parent?.type === 'CallExpression' && node.parent.callee === node;

module.exports = {
  meta: {
    type: /** @type {const} */ ('problem'),
    docs: {
      description: 'Disallow reading the platform at module scope',
      category: 'Possible Errors',
      recommended: true,
      url: 'https://github.com/storybookjs/storybook/blob/next/scripts/ci/os-probe/probe.ts',
    },
    messages: {
      moduleScope:
        'Read the platform inside a function, not at module scope. The Windows unit test selection (scripts/ci/os-probe/probe.ts) only sees platform checks that run while a test runs, so a test that depends on this value would be skipped on Windows.',
    },
    schema: [],
  },
  create(context) {
    const osObjects = new Set();
    const pathObjects = new Set();
    // Local name of a named import, to the name it imports.
    const osNames = new Map();
    const pathNames = new Map();

    const report = (node) => {
      if (!isDeferred(node)) {
        context.report({ node, messageId: 'moduleScope' });
      }
    };

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        const isOs = OS_MODULES.has(source);
        if (!isOs && !PATH_MODULES.has(source)) {
          return;
        }
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportSpecifier') {
            const imported = specifier.imported.name ?? specifier.imported.value;
            (isOs ? osNames : pathNames).set(specifier.local.name, imported);
          } else {
            (isOs ? osObjects : pathObjects).add(specifier.local.name);
          }
        }
      },
      MemberExpression(node) {
        const name = propertyName(node);
        if (node.object.type !== 'Identifier' || !name) {
          return;
        }
        const object = node.object.name;
        if (
          (object === 'process' && name === 'platform') ||
          (osObjects.has(object) && OS_CALLS.has(name) && isCallee(node)) ||
          (osObjects.has(object) && OS_VALUES.has(name)) ||
          (pathObjects.has(object) && PATH_VALUES.has(name))
        ) {
          report(node);
        }
      },
      Identifier(node) {
        const parent = node.parent;
        if (
          parent?.type === 'ImportSpecifier' ||
          (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) ||
          (parent?.type === 'Property' && parent.key === node && !parent.computed)
        ) {
          return;
        }
        const osName = osNames.get(node.name);
        const pathName = pathNames.get(node.name);
        if (
          (osName && OS_CALLS.has(osName) && isCallee(node)) ||
          (osName && OS_VALUES.has(osName)) ||
          (pathName && PATH_VALUES.has(pathName))
        ) {
          report(node);
        }
      },
      // `const { platform } = process`
      VariableDeclarator(node) {
        if (
          node.init?.type === 'Identifier' &&
          node.init.name === 'process' &&
          node.id.type === 'ObjectPattern' &&
          node.id.properties.some(
            (property) =>
              property.type === 'Property' &&
              property.key.type === 'Identifier' &&
              property.key.name === 'platform'
          )
        ) {
          report(node);
        }
      },
    };
  },
};
