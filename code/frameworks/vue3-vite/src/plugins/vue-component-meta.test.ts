import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TypeMeta } from 'vue-component-meta';

// Minimal mock meta to simulate a non-empty component
function makeComponentMeta(overrides: Record<string, unknown> = {}) {
  return {
    type: TypeMeta.Class,
    props: [{ name: 'modelValue', schema: 'string' }],
    events: [],
    slots: [],
    exposed: [],
    ...overrides,
  };
}

const mockChecker = {
  getExportNames: vi.fn(),
  getComponentMeta: vi.fn(),
  updateFile: vi.fn(),
};

vi.mock('vue-component-meta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-component-meta')>();
  return {
    ...actual,
    createChecker: () => mockChecker,
    createCheckerByJson: () => mockChecker,
  };
});

vi.mock('storybook/internal/common', () => ({
  getProjectRoot: () => '/fake-project',
}));

vi.mock('vue-docgen-api', () => ({
  parseMulti: () => [],
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('{}'),
  stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
}));

async function getTransformHandler() {
  const { vueComponentMeta } = await import('./vue-component-meta.ts');
  const plugin = await vueComponentMeta();

  const transform =
    typeof plugin.transform === 'function'
      ? plugin.transform
      : (plugin.transform as { handler: Function }).handler;

  return transform as (src: string, id: string) => Promise<{ code: string } | undefined>;
}

describe('vue-component-meta plugin', () => {
  let transform: Awaited<ReturnType<typeof getTransformHandler>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    transform = await getTransformHandler();
  });

  describe('barrel file substring matching (issue #34521)', () => {
    it('should NOT inject __docgenInfo for export names that are substrings of barrel re-export paths', async () => {
      // Barrel file: export * from './Tabs'
      // The checker resolves "Tab" as an export name (re-exported from Tabs module),
      // but "Tab" is not a local binding — it only appears as a substring of "./Tabs"
      const barrelSrc = `export * from './Tabs';\n`;
      const barrelId = '/project/src/components/index.ts';

      mockChecker.getExportNames.mockReturnValue(['Tab']);
      mockChecker.getComponentMeta.mockReturnValue(makeComponentMeta());

      const result = await transform(barrelSrc, barrelId);

      // Should not inject __docgenInfo because "Tab" is not a real local binding
      expect(result?.code ?? '').not.toContain('__docgenInfo');
    });

    it('should inject __docgenInfo for export names that are actual local bindings', async () => {
      const src = `import { defineComponent } from 'vue';\nexport const Tab = defineComponent({});\n`;
      const id = '/project/src/components/Tab.ts';

      mockChecker.getExportNames.mockReturnValue(['Tab']);
      mockChecker.getComponentMeta.mockReturnValue(makeComponentMeta());

      const result = await transform(src, id);

      expect(result).toBeDefined();
      expect(result!.code).toContain('Tab.__docgenInfo');
    });

    it('should inject __docgenInfo for the full name even when a substring name exists in the path', async () => {
      // "Tabs" is defined locally; "Tab" is only a substring — only "Tabs" should get docgen
      const src = `export * from './Tab';\nexport const Tabs = defineComponent({});\n`;
      const id = '/project/src/components/index.ts';

      mockChecker.getExportNames.mockReturnValue(['Tab', 'Tabs']);
      mockChecker.getComponentMeta.mockReturnValue(makeComponentMeta());

      const result = await transform(src, id);

      expect(result).toBeDefined();
      expect(result!.code).toContain('Tabs.__docgenInfo');
      expect(result!.code).not.toContain('Tab.__docgenInfo');
    });
  });

  describe('re-export detection', () => {
    it('should skip named re-exports like "export { Tab } from ..."', async () => {
      const src = `export { Tab } from './Tab.vue';\n`;
      const id = '/project/src/components/index.ts';

      mockChecker.getExportNames.mockReturnValue(['Tab']);
      mockChecker.getComponentMeta.mockReturnValue(makeComponentMeta());

      const result = await transform(src, id);

      expect(result?.code ?? '').not.toContain('__docgenInfo');
    });

    it('should skip wildcard re-exports like "export * from \'./Tab\'"', async () => {
      const src = `export * from './Tab';\n`;
      const id = '/project/src/components/index.ts';

      mockChecker.getExportNames.mockReturnValue(['Tab']);
      mockChecker.getComponentMeta.mockReturnValue(makeComponentMeta());

      const result = await transform(src, id);

      expect(result?.code ?? '').not.toContain('__docgenInfo');
    });
  });
});
