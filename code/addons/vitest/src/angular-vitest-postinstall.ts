import {
  type ESTree as E,
  SourceEditor,
  arrayList,
  prependToList,
  walk,
} from 'storybook/internal/csf-tools';

/**
 * Auto-wiring for the `@storybook/angular-vite` standalone-vitest options bridge.
 *
 * `storybookAngularVitest()` must live in the SAME nested `plugins` array as the addon's
 * `storybookTest()` call (`test.projects[].plugins` in the config templates, or a workspace entry's
 * `plugins`) — never as a top-level sibling — so that the env var it sets synchronously is in place
 * before `storybookTest`'s inline `presets.apply('viteFinal')` reads it. The generic
 * `updateConfigFile` merge only matches top-level keys, so this module performs a targeted source
 * edit instead.
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
 * bare `storybookTest`.
 */
export function collectStorybookTestLocalNames(program: E.Program): Set<string> {
  const names = new Set<string>([STORYBOOK_TEST_PLUGIN_CALL]);
  for (const node of program.body) {
    if (node.type === 'ImportDeclaration' && node.source.value === STORYBOOK_TEST_PLUGIN_SOURCE) {
      node.specifiers.forEach((specifier) => names.add(specifier.local.name));
    }
  }
  return names;
}

const hasAngularVitestImport = (program: E.Program) =>
  program.body.some(
    (node) =>
      node.type === 'ImportDeclaration' &&
      node.source.value === ANGULAR_VITEST_IMPORT_SOURCE &&
      node.specifiers.some(
        (specifier) =>
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name === ANGULAR_VITEST_PLUGIN_CALL
      )
  );

const isCallTo = (node: E.Node | null, names: Set<string>) =>
  node?.type === 'CallExpression' &&
  node.callee.type === 'Identifier' &&
  names.has(node.callee.name);

/**
 * Locates the `plugins` array that contains a (possibly aliased) `storybookTest()` call and, if it
 * is not already present, prepends `storybookAngularVitest({})` so the bridge runs before the
 * addon's plugin. Also ensures the import. Edits are left pending on the editor so callers can
 * inject into an already-merged config before printing it once.
 *
 * Returns `false` when no such locatable array exists (e.g. `...storybookTest()` spread or other
 * exotic shapes) — the caller then falls back to the manual-setup guidance.
 */
export function injectAngularVitestIntoEditor(editor: SourceEditor): boolean {
  const { program } = editor;
  const localNames = collectStorybookTestLocalNames(program);

  let pluginsArray: E.ArrayExpression | undefined;
  walk(program, (node, parent) => {
    if (pluginsArray) {
      return false;
    }
    if (parent?.type === 'ArrayExpression' && isCallTo(node, localNames)) {
      pluginsArray = parent;
    }
  });
  if (!pluginsArray) {
    return false;
  }

  const bridge = new Set([ANGULAR_VITEST_PLUGIN_CALL]);
  if (!pluginsArray.elements.some((element) => isCallTo(element, bridge))) {
    prependToList(
      editor,
      arrayList(pluginsArray),
      [
        `// Forwards Angular build options (styles, assets, zoneless, …) into standalone vitest runs\n${ANGULAR_VITEST_PLUGIN_CALL}({})`,
      ],
      ''
    );
  }

  if (!hasAngularVitestImport(program)) {
    const statement = `import { ${ANGULAR_VITEST_PLUGIN_CALL} } from ${editor.quote}${ANGULAR_VITEST_IMPORT_SOURCE}${editor.quote};`;
    const lastImport = program.body.findLast((node) => node.type === 'ImportDeclaration');
    if (lastImport) {
      editor.edits.appendLeft(lastImport.end, `\n${statement}`);
    } else {
      editor.edits.appendLeft(program.body[0].start, `${statement}\n`);
    }
  }
  return true;
}

/**
 * String-in / string-out convenience over {@link injectAngularVitestIntoEditor} for the fresh-create
 * and re-read paths. Returns `null` when the content cannot be parsed or no locatable plugins array
 * is found.
 */
export function injectAngularVitestIntoConfig(content: string): string | null {
  let editor: SourceEditor;
  try {
    editor = new SourceEditor(content);
  } catch {
    return null;
  }
  return injectAngularVitestIntoEditor(editor) ? editor.toString() : null;
}
