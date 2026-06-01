import { describe, expect, it } from 'vitest';

import { parseSource } from 'vue-docgen-api';

import { setupPropsDestructureHandler } from './vue-docgen-props-destructure.ts';

const parse = (source: string) =>
  parseSource(source, 'Component.vue', { addScriptHandlers: [setupPropsDestructureHandler] });

const propDefault = (doc: Awaited<ReturnType<typeof parse>>, name: string) =>
  doc.props?.find((prop) => prop.name === name)?.defaultValue;

describe('setupPropsDestructureHandler', () => {
  it('resolves defaults from reactive props destructure, preserving unicode', async () => {
    const doc = await parse(`
      <script setup lang="ts">
      const { label = '你好', size = '大きい', icon = '✨' } = defineProps<{
        label?: string;
        size?: string;
        icon?: string;
      }>();
      </script>
    `);

    expect(propDefault(doc, 'label')).toEqual({ func: false, value: "'你好'" });
    expect(propDefault(doc, 'size')).toEqual({ func: false, value: "'大きい'" });
    expect(propDefault(doc, 'icon')).toEqual({ func: false, value: "'✨'" });
  });

  it('flags function defaults so they are not treated as string literals', async () => {
    const doc = await parse(`
      <script setup lang="ts">
      const { items = () => [] } = defineProps<{ items?: string[] }>();
      </script>
    `);

    expect(propDefault(doc, 'items')).toEqual({ func: true, value: '() => []' });
  });

  it('leaves props without a destructured default untouched', async () => {
    const doc = await parse(`
      <script setup lang="ts">
      const { label = 'hi', size } = defineProps<{ label?: string; size?: string }>();
      </script>
    `);

    expect(propDefault(doc, 'label')).toEqual({ func: false, value: "'hi'" });
    expect(propDefault(doc, 'size')).toBeUndefined();
  });

  it('does not clobber defaults already resolved by withDefaults', async () => {
    const doc = await parse(`
      <script setup lang="ts">
      const props = withDefaults(defineProps<{ label?: string }>(), { label: 'from-withDefaults' });
      </script>
    `);

    expect(propDefault(doc, 'label')).toEqual({ func: false, value: "'from-withDefaults'" });
  });
});
