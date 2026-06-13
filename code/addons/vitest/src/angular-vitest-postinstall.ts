import {
  type BabelFile,
  babelParse,
  generate,
  traverse,
  types as t,
} from 'storybook/internal/babel';

/**
 * Auto-wiring for the `@storybook/angular-vite` standalone-vitest options bridge.
 *
 * `storybookAngularVitest()` must live in the SAME nested `plugins` array as the addon's
 * `storybookTest()` call (`test.projects[].plugins` in the config templates, or a workspace entry's
 * `plugins`) — never as a top-level sibling — so that the env var it sets synchronously is in place
 * before `storybookTest`'s inline `presets.apply('viteFinal')` reads it. The generic
 * `updateConfigFile` merge only matches top-level keys, so this module performs a targeted AST
 * injection instead.
 *
 * `@storybook/angular-vite/vitest` is referenced as a string literal only — there is no build-time
 * import edge from addon-vitest to the framework package.
 */

export const ANGULAR_VITEST_IMPORT_SOURCE = '@storybook/angular-vite/vitest';
export const ANGULAR_VITEST_PLUGIN_CALL = 'storybookAngularVitest';

const STORYBOOK_TEST_PLUGIN_SOURCE = '@storybook/addon-vitest/vitest-plugin';
const STORYBOOK_TEST_PLUGIN_CALL = 'storybookTest';

/**
 * True if the config already references the Angular bridge — either via its import source or a call
 * to `storybookAngularVitest(`. Used as an idempotency gate independent of `isConfigAlreadySetup`.
 */
export function isAngularVitestAlreadyWired(content: string): boolean {
  return (
    content.includes(ANGULAR_VITEST_IMPORT_SOURCE) ||
    content.includes(`${ANGULAR_VITEST_PLUGIN_CALL}(`)
  );
}

/**
 * Collects the local identifier names that `storybookTest` is imported as, so the locator can find
 * the call even when it was aliased (`import { storybookTest as sbTest }`). Always seeded with the
 * bare `storybookTest`. Mirrors the alias-collection precedent in `postinstall.ts`'s
 * `isConfigAlreadySetup`.
 */
export function collectStorybookTestLocalNames(ast: BabelFile['ast']): Set<string> {
  const names = new Set<string>([STORYBOOK_TEST_PLUGIN_CALL]);

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value !== STORYBOOK_TEST_PLUGIN_SOURCE) {
        return;
      }
      path.node.specifiers.forEach((specifier) => {
        if ('local' in specifier && specifier.local?.name) {
          names.add(specifier.local.name);
        }
      });
    },
  });

  return names;
}

/** Ensures the storybookAngularVitest named import (from the angular-vite/vitest subpath) exists once. */
function ensureImport(ast: BabelFile['ast']): void {
  let hasImport = false;

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value !== ANGULAR_VITEST_IMPORT_SOURCE) {
        return;
      }
      const alreadyImports = path.node.specifiers.some(
        (specifier) =>
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name === ANGULAR_VITEST_PLUGIN_CALL
      );
      if (alreadyImports) {
        hasImport = true;
        path.stop();
      }
    },
  });

  if (hasImport) {
    return;
  }

  const importDecl = t.importDeclaration(
    [
      t.importSpecifier(
        t.identifier(ANGULAR_VITEST_PLUGIN_CALL),
        t.identifier(ANGULAR_VITEST_PLUGIN_CALL)
      ),
    ],
    t.stringLiteral(ANGULAR_VITEST_IMPORT_SOURCE)
  );

  const lastImportIndex = ast.program.body.findLastIndex((n) => n.type === 'ImportDeclaration');
  ast.program.body.splice(lastImportIndex + 1, 0, importDecl);
}

/** Builds the `storybookAngularVitest({})` call with a leading scaffold comment. */
function buildAngularVitestCall(): t.CallExpression {
  const call = t.callExpression(t.identifier(ANGULAR_VITEST_PLUGIN_CALL), [t.objectExpression([])]);
  t.addComment(
    call,
    'leading',
    ' Forwards Angular build options (styles, assets, zoneless, …) into standalone vitest runs',
    true
  );
  return call;
}

/** True if the array already contains a `storybookAngularVitest(...)` call. */
function arrayHasAngularVitest(array: t.ArrayExpression): boolean {
  return array.elements.some(
    (el) =>
      el?.type === 'CallExpression' &&
      el.callee.type === 'Identifier' &&
      el.callee.name === ANGULAR_VITEST_PLUGIN_CALL
  );
}

/**
 * Locates the `plugins` ArrayExpression that contains a (possibly aliased) `storybookTest()` call
 * and, if it is not already present, unshifts `storybookAngularVitest({})` so the bridge runs before
 * the addon's plugin. Also ensures the import. Operates on the AST in place so callers can inject
 * into an already-merged target before a single `generate`.
 *
 * Returns `false` when no such locatable array exists (e.g. `...storybookTest()` spread or other
 * exotic shapes) — the caller then falls back to the manual-setup guidance.
 */
export function injectAngularVitestIntoAst(ast: BabelFile['ast']): boolean {
  const localNames = collectStorybookTestLocalNames(ast);

  let pluginsArray: t.ArrayExpression | null = null;

  traverse(ast, {
    CallExpression(path) {
      if (pluginsArray) {
        path.stop();
        return;
      }
      const { callee } = path.node;
      if (
        callee.type === 'Identifier' &&
        localNames.has(callee.name) &&
        path.parentPath.isArrayExpression()
      ) {
        pluginsArray = path.parentPath.node as t.ArrayExpression;
        path.stop();
      }
    },
  });

  if (!pluginsArray) {
    return false;
  }

  // Cast away the narrowing TS applies inside the visitor closure above.
  const array = pluginsArray as t.ArrayExpression;
  if (!arrayHasAngularVitest(array)) {
    array.elements.unshift(buildAngularVitestCall());
  }

  ensureImport(ast);
  return true;
}

/**
 * String-in / string-out convenience over {@link injectAngularVitestIntoAst} for the fresh-create
 * and re-read paths. Returns `null` when the content cannot be parsed or no locatable plugins array
 * is found.
 */
export function injectAngularVitestIntoConfig(content: string): string | null {
  let ast: BabelFile['ast'];
  try {
    ast = babelParse(content);
  } catch {
    return null;
  }

  if (!injectAngularVitestIntoAst(ast)) {
    return null;
  }

  return generate(ast).code;
}
