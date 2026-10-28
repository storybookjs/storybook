// @ts-nocheck

/** Lower packages, ordered by layer: core <- ui <- manager. `storybook` sits above all of them. */
const LAYERS = ['core', 'ui', 'manager'];
const LOWER_PACKAGE_DIRS = { core: 'core', ui: 'lib/ui', manager: 'lib/manager' };
const PRODUCT_DIR = 'lib/storybook';
/** `@storybook/open-service` sits on core alone, so it installs without `storybook`. */
const OPEN_SERVICE_DIR = 'lib/open-service';
/** Frameworks, renderers, builders and addons import their Node-side APIs from `@storybook/core/*`. */
const CORE_CONSUMER_DIRS = ['frameworks', 'renderers', 'builders', 'presets', 'addons'];

/**
 * @returns {{ kind: 'layer', rank: number } | { kind: 'product' } | { kind: 'core-consumer' } | {
 *   kind: 'open-service';
 * } | { kind: 'outside' }}
 */
function locate(fileName) {
  const normalized = fileName.replace(/\\/g, '/');
  if (normalized.includes(`/code/${PRODUCT_DIR}/`)) {
    return { kind: 'product' };
  }
  if (normalized.includes(`/code/${OPEN_SERVICE_DIR}/`)) {
    return { kind: 'open-service' };
  }
  if (CORE_CONSUMER_DIRS.some((dir) => normalized.includes(`/code/${dir}/`))) {
    return { kind: 'core-consumer' };
  }
  for (const [name, dir] of Object.entries(LOWER_PACKAGE_DIRS)) {
    if (normalized.includes(`/code/${dir}/`)) {
      return { kind: 'layer', rank: LAYERS.indexOf(name) };
    }
  }
  return { kind: 'outside' };
}

/** @returns {string | undefined} the lower package named by the specifier, if any */
function lowerPackageOf(specifier) {
  const match = /^@storybook\/(core|ui|manager)(?:\/|$)/.exec(specifier);
  return match?.[1];
}

function isProductSpecifier(specifier) {
  return specifier === 'storybook' || specifier.startsWith('storybook/');
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure the imports-paths of packages in the monorepo is correct',
      category: 'Best Practices',
      recommended: true,
      url: 'https://github.com/storybookjs/storybook/blob/next/code/core/src/instance/README.md',
    },
  },
  create(context) {
    return {
      ImportDeclaration: (node) => {
        const specifier = node.source.value;
        const location = locate(context.getPhysicalFilename());
        const lower = lowerPackageOf(specifier);

        if (location.kind === 'product') {
          return;
        }

        if (location.kind === 'open-service') {
          if (isProductSpecifier(specifier) || (lower && lower !== 'core')) {
            context.report({
              node,
              message: `@storybook/open-service cannot import from \`${specifier}\`. Import from @storybook/core/* only.`,
            });
          }
          return;
        }

        if (location.kind === 'outside' || location.kind === 'core-consumer') {
          if (lower && !(location.kind === 'core-consumer' && lower === 'core')) {
            context.report({
              node,
              message: `Cannot import from @storybook/${lower} in this package. Use the \`storybook\` package (e.g. storybook/internal/*) instead.`,
            });
          }
          return;
        }

        if (isProductSpecifier(specifier)) {
          context.report({
            node,
            message: `Cannot import from \`storybook\` inside @storybook/${LAYERS[location.rank]}. Import from @storybook/${LAYERS[location.rank]}/* or a lower package instead.`,
          });
          return;
        }

        if (lower && LAYERS.indexOf(lower) > location.rank) {
          context.report({
            node,
            message: `@storybook/${LAYERS[location.rank]} cannot import from @storybook/${lower}. Direction is core <- ui <- manager <- storybook.`,
          });
        }
      },
    };
  },
};
