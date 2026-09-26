import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { babelParse, generate } from 'storybook/internal/babel';

import { updateConfigFile } from '../../code/addons/vitest/src/updateVitestFile.ts';

const [directory, framework, mode = 'single'] = process.argv.slice(2);
assert(directory && ['vue3', 'svelte'].includes(framework));
const plugin = framework === 'vue3' ? '@vitejs/plugin-vue' : '@sveltejs/vite-plugin-svelte';
const extension = framework === 'vue3' ? 'vue' : 'svelte';
await mkdir(join(directory, '.storybook'), { recursive: true });
await writeFile(
  join(directory, '.storybook/main.js'),
  `export default { stories: ['../*.stories.js'], addons: [], framework: '@storybook/${framework}-vite', core: { disableTelemetry: true } };`
);
await writeFile(join(directory, '.storybook/preview.js'), 'export default {};');
await writeFile(join(directory, 'label.js'), "export default 'Ready';");
await writeFile(
  join(directory, `Button.${extension}`),
  framework === 'vue3'
    ? `<script setup>import label from 'fixture-label';</script><template><button>{{ label }}</button></template>`
    : `<script>import label from 'fixture-label';</script><button>{label}</button>`
);
await writeFile(
  join(directory, 'Button.stories.js'),
  `import Button from './Button.${extension}';
import { expect } from 'storybook/test';
export default { title: 'Framework', component: Button };
export const Primary = { play: async ({ canvas }) => { await expect(canvas.getByRole('button')).toHaveTextContent('Ready'); } };`
);
await writeFile(
  join(directory, 'unit-only-setup.js'),
  `throw new Error('Unit setup leaked into the Storybook project');`
);
const target = babelParse(`import { defineConfig } from 'vitest/config';
import ${framework === 'vue3' ? 'frameworkPlugin' : '{ svelte as frameworkPlugin }'} from '${plugin}';
export default defineConfig({
  plugins: [frameworkPlugin()],
  optimizeDeps: { include: ${JSON.stringify(framework === 'vue3' ? ['vue'] : ['svelte', 'svelte/internal/client', 'svelte/internal/flags/legacy'])} },
  resolve: { alias: { 'fixture-label': ${JSON.stringify(resolve(directory, 'label.js'))} } },
  test: { ${mode === 'existing' ? "projects: [{ extends: true, test: { name: 'unit', setupFiles: ['./unit-only-setup.js'] } }]" : "name: 'unit', setupFiles: ['./unit-only-setup.js']"} }
});`);
const source = babelParse(
  (
    await readFile(
      new URL('../../code/addons/vitest/templates/vitest.config.4.template.ts', import.meta.url),
      'utf8'
    )
  ).replace('CONFIG_DIR', '.storybook')
);
assert(updateConfigFile(source, target));
await writeFile(join(directory, 'vitest.config.mjs'), generate(target).code);
