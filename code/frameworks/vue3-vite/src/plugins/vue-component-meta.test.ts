import { beforeEach, describe, expect, it, vi } from 'vitest';

import { stat } from 'node:fs/promises';
import { getProjectRoot } from 'storybook/internal/common';
import { createCheckerByJson, TypeMeta } from 'vue-component-meta';

vi.mock('vue-component-meta', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('vue-docgen-api', { spy: true });
vi.mock('node:fs/promises', { spy: true });

const mockChecker = {
  getExportNames: vi.fn(),
  getComponentMeta: vi.fn(),
  updateFile: vi.fn(),
};

function makeComponentMeta() {
  return {
    type: TypeMeta.Class,
    props: [{ name: 'modelValue', schema: 'string' }],
    events: [],
    slots: [],
    exposed: [],
  };
}

async function getTransformHandler() {
  const { vueComponentMeta } = await import('./vue-component-meta.ts');
  const plugin = await vueComponentMeta();

  const handler =
    typeof plugin.transform === 'function'
      ? plugin.transform
      : (plugin.transform as { handler: (...args: unknown[]) => unknown }).handler;

  return handler as (src: string, id: string) => Promise<{ code: string } | undefined>;
}

describe('vue-component-meta plugin', () => {
  let transform: Awaited<ReturnType<typeof getTransformHandler>>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Only mock what's actually called: createCheckerByJson, getProjectRoot, stat
    // createChecker, readFile, parseMulti are never reached in these tests
    vi.mocked(createCheckerByJson).mockReturnValue(
      mockChecker as unknown as ReturnType<typeof createCheckerByJson>
    );
    vi.mocked(getProjectRoot).mockReturnValue('/fake-project');
    vi.mocked(stat).mockRejectedValue(new Error('ENOENT'));

    mockChecker.getExportNames.mockReturnValue(['Tab']);
    mockChecker.getComponentMeta.mockReturnValue(makeComponentMeta());

    transform = await getTransformHandler();
  });

  describe('barrel file substring matching (issue #34521)', () => {
    it('should NOT inject __docgenInfo for export names that are substrings of barrel re-export paths (star case)', async () => {
      // Barrel file: export * from './Tabs'
      // The checker resolves "Tab" as an export name (re-exported from Tabs module),
      // but "Tab" is not a local binding — it only appears as a substring of "./Tabs"
      const barrelSrc = `export * from './Tabs';\n`;
      const barrelId = '/project/src/components/index.ts';
      const result = await transform(barrelSrc, barrelId);

      expect(result?.code ?? '').not.toContain('__docgenInfo');
    });

    it('should NOT inject __docgenInfo for export names that are substrings of barrel re-export paths (single line case)', async () => {
      const barrelSrc = `export { Tabs, Tab } from './Tabs';\n`;
      const barrelId = '/project/src/components/index.ts';
      const result = await transform(barrelSrc, barrelId);

      expect(result?.code ?? '').not.toContain('__docgenInfo');
    });

    it('should NOT inject __docgenInfo for export names that are substrings of barrel re-export paths (multi line case)', async () => {
      const barrelSrc = `export {\nTabs,\nTab,\n} from './Tabs';\n`;
      const barrelId = '/project/src/components/index.ts';
      const result = await transform(barrelSrc, barrelId);

      expect(result?.code ?? '').not.toContain('__docgenInfo');
    });

    it('should inject __docgenInfo for export names that are actual local bindings', async () => {
      const src = `import { defineComponent } from 'vue';\nexport const Tab = defineComponent({});\n`;
      const id = '/project/src/components/Tab.ts';
      const result = await transform(src, id);

      expect(result).toBeDefined();
      expect(result!.code).toContain('Tab.__docgenInfo');
    });

    it('should inject __docgenInfo for the full name even when a substring name exists in the path', async () => {
      // "Tabs" is defined locally; "Tab" is only a substring — only "Tabs" should get docgen
      const src = `export * from './Tab';\nexport const Tabs = defineComponent({});\n`;
      const id = '/project/src/components/index.ts';

      mockChecker.getExportNames.mockReturnValue(['Tab', 'Tabs']);

      const result = await transform(src, id);

      expect(result).toBeDefined();
      expect(result!.code).toContain('Tabs.__docgenInfo');
      expect(result!.code).not.toContain('Tab.__docgenInfo');
    });
  });

  describe('default export local binding', () => {
    it('should inject __docgenInfo onto _sfc_main for a compiled SFC default export', async () => {
      // vite-plugin-vue compiles an SFC to a local `_sfc_main` binding that is default-exported
      // indirectly via the `_export_sfc` helper — the binding is local even though the default
      // export is an inline call expression rather than `export default _sfc_main`.
      const src = [
        `import _export_sfc from 'plugin-vue:export-helper';`,
        `const _sfc_main = { name: 'Tab' };`,
        `function _sfc_render() {}`,
        `export default /*@__PURE__*/_export_sfc(_sfc_main, [['render', _sfc_render]]);`,
      ].join('\n');
      const id = '/project/src/components/Tab.vue';

      mockChecker.getExportNames.mockReturnValue(['default']);

      const result = await transform(src, id);

      expect(result).toBeDefined();
      expect(result!.code).toContain('_sfc_main.__docgenInfo');
    });

    it('should inject __docgenInfo when a production SFC imports its default export', async () => {
      const src = [
        `import _sfc_main from './Tab.vue?vue&type=script&setup=true&lang.ts';`,
        `export default _sfc_main;`,
      ].join('\n');
      const id = '/project/src/components/Tab.vue';

      mockChecker.getExportNames.mockReturnValue(['default']);

      const result = await transform(src, id);

      expect(result).toBeDefined();
      expect(result!.code).toContain('_sfc_main.__docgenInfo');
    });

    it('should not inject __docgenInfo when an SFC default export has no _sfc_main import', async () => {
      const src = `export default { name: 'Tab' };\n`;
      const id = '/project/src/components/Tab.vue';

      mockChecker.getExportNames.mockReturnValue(['default']);

      const result = await transform(src, id);

      expect(result).toBeDefined();
      expect(result?.code ?? '').not.toContain('__docgenInfo');
    });

    it('should not inject __docgenInfo when _sfc_main is imported from a non-virtual module', async () => {
      const src = [`import _sfc_main from './shared-component';`, `export default _sfc_main;`].join(
        '\n'
      );
      const id = '/project/src/components/Tab.vue';

      mockChecker.getExportNames.mockReturnValue(['default']);

      const result = await transform(src, id);

      expect(result).toBeDefined();
      expect(result?.code ?? '').not.toContain('__docgenInfo');
    });

    it('should NOT inject __docgenInfo when the default export is an inline expression with no local binding', async () => {
      const src = `import { defineComponent } from 'vue';\nexport default defineComponent({});\n`;
      const id = '/project/src/components/Tab.ts';

      mockChecker.getExportNames.mockReturnValue(['default']);

      const result = await transform(src, id);

      expect(result?.code ?? '').not.toContain('__docgenInfo');
    });
  });

  describe('re-export detection', () => {
    it('should skip named re-exports like "export { Tab } from ..."', async () => {
      const result = await transform(
        `export { Tab } from './Tab.vue';\n`,
        '/project/src/components/index.ts'
      );

      expect(result?.code ?? '').not.toContain('__docgenInfo');
    });

    it('should skip wildcard re-exports like "export * from \'./Tab\'"', async () => {
      const result = await transform(
        `export * from './Tab';\n`,
        '/project/src/components/index.ts'
      );

      expect(result?.code ?? '').not.toContain('__docgenInfo');
    });
  });
});
