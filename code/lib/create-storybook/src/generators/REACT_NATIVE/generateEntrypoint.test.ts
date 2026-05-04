import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { SupportedLanguage } from 'storybook/internal/types';

import { describe, expect, it } from 'vitest';

import { generateReactNativeEntrypoint, getEntrypointTemplatePath } from './generateEntrypoint.ts';

describe('generateReactNativeEntrypoint', () => {
  it('resolves Expo template path when expo variant is requested', () => {
    const templatePath = getEntrypointTemplatePath('expo');

    expect(path.basename(templatePath)).toMatchInlineSnapshot(`"index.expo.js"`);
  });

  it('generates .rnstorybook/index.ts for TypeScript projects', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'sb-rn-entry-ts-'));

    try {
      const result = await generateReactNativeEntrypoint({
        language: SupportedLanguage.TYPESCRIPT,
        cwd,
      });
      const outputPath = path.join(cwd, '.rnstorybook', 'index.ts');
      const output = await readFile(outputPath, 'utf-8');

      expect(path.relative(cwd, result.targetPath)).toMatchInlineSnapshot(
        `".rnstorybook/index.ts"`
      );
      expect(output).toMatchInlineSnapshot(`
        "import { AppRegistry } from 'react-native';
        import AsyncStorage from '@react-native-async-storage/async-storage';

        import { view } from './storybook.requires';

        /**
         * This file is user-editable.
         *
         * Use it as your React Native Storybook entrypoint and wrap \`StorybookUIRoot\`
         * with application decorators/providers (theme, i18n, state, navigation, etc).
         */
        const StorybookUIRoot = view.getStorybookUI({
          shouldPersistSelection: true,
          storage: {
            getItem: AsyncStorage.getItem,
            setItem: AsyncStorage.setItem,
          },
        });

        AppRegistry.registerComponent('main', () => StorybookUIRoot);

        export default StorybookUIRoot;
        "
      `);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('generates .rnstorybook/index.js for JavaScript projects', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'sb-rn-entry-js-'));

    try {
      const result = await generateReactNativeEntrypoint({
        language: SupportedLanguage.JAVASCRIPT,
        cwd,
      });
      const outputPath = path.join(cwd, '.rnstorybook', 'index.js');
      const output = await readFile(outputPath, 'utf-8');

      expect(path.relative(cwd, result.targetPath)).toMatchInlineSnapshot(
        `".rnstorybook/index.js"`
      );
      expect(output).toMatchInlineSnapshot(`
        "import { AppRegistry } from 'react-native';
        import AsyncStorage from '@react-native-async-storage/async-storage';

        import { view } from './storybook.requires';

        /**
         * This file is user-editable.
         *
         * Use it as your React Native Storybook entrypoint and wrap \`StorybookUIRoot\`
         * with application decorators/providers (theme, i18n, state, navigation, etc).
         */
        const StorybookUIRoot = view.getStorybookUI({
          shouldPersistSelection: true,
          storage: {
            getItem: AsyncStorage.getItem,
            setItem: AsyncStorage.setItem,
          },
        });

        AppRegistry.registerComponent('main', () => StorybookUIRoot);

        export default StorybookUIRoot;
        "
      `);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('generates Expo-specific entrypoint contents for expo projects', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'sb-rn-entry-expo-'));

    try {
      const result = await generateReactNativeEntrypoint({
        language: SupportedLanguage.TYPESCRIPT,
        templateVariant: 'expo',
        cwd,
      });
      const outputPath = path.join(cwd, '.rnstorybook', 'index.ts');
      const output = await readFile(outputPath, 'utf-8');

      expect(path.relative(cwd, result.targetPath)).toMatchInlineSnapshot(
        `".rnstorybook/index.ts"`
      );
      expect(output).toMatchInlineSnapshot(`
        "import { registerRootComponent } from 'expo';
        import AsyncStorage from '@react-native-async-storage/async-storage';

        import { view } from './storybook.requires';

        /**
         * This file is user-editable.
         *
         * Use it as your React Native Storybook entrypoint and wrap \`StorybookUIRoot\`
         * with application decorators/providers (theme, i18n, state, navigation, etc).
         */
        const StorybookUIRoot = view.getStorybookUI({
          shouldPersistSelection: true,
          storage: {
            getItem: AsyncStorage.getItem,
            setItem: AsyncStorage.setItem,
          },
        });

        registerRootComponent(StorybookUIRoot);
        "
      `);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('overwrites existing target index file on rerun', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'sb-rn-entry-overwrite-'));
    const targetPath = path.join(cwd, '.rnstorybook', 'index.js');

    try {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, 'export default function Old() {};\n', 'utf-8');

      await generateReactNativeEntrypoint({
        language: SupportedLanguage.JAVASCRIPT,
        cwd,
      });
      const output = await readFile(targetPath, 'utf-8');

      expect(output).toMatchInlineSnapshot(`
        "import { AppRegistry } from 'react-native';
        import AsyncStorage from '@react-native-async-storage/async-storage';

        import { view } from './storybook.requires';

        /**
         * This file is user-editable.
         *
         * Use it as your React Native Storybook entrypoint and wrap \`StorybookUIRoot\`
         * with application decorators/providers (theme, i18n, state, navigation, etc).
         */
        const StorybookUIRoot = view.getStorybookUI({
          shouldPersistSelection: true,
          storage: {
            getItem: AsyncStorage.getItem,
            setItem: AsyncStorage.setItem,
          },
        });

        AppRegistry.registerComponent('main', () => StorybookUIRoot);

        export default StorybookUIRoot;
        "
      `);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('keeps sibling extension file when generating target extension', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'sb-rn-entry-sibling-'));
    const tsPath = path.join(cwd, '.rnstorybook', 'index.ts');

    try {
      await mkdir(path.dirname(tsPath), { recursive: true });
      await writeFile(tsPath, '// sibling\n', 'utf-8');

      await generateReactNativeEntrypoint({
        language: SupportedLanguage.JAVASCRIPT,
        cwd,
      });

      const sibling = await readFile(tsPath, 'utf-8');
      const jsPath = path.join(cwd, '.rnstorybook', 'index.js');
      const generated = await readFile(jsPath, 'utf-8');

      expect(sibling).toMatchInlineSnapshot(`
        "// sibling
        "
      `);
      expect(generated).toMatchInlineSnapshot(`
        "import { AppRegistry } from 'react-native';
        import AsyncStorage from '@react-native-async-storage/async-storage';

        import { view } from './storybook.requires';

        /**
         * This file is user-editable.
         *
         * Use it as your React Native Storybook entrypoint and wrap \`StorybookUIRoot\`
         * with application decorators/providers (theme, i18n, state, navigation, etc).
         */
        const StorybookUIRoot = view.getStorybookUI({
          shouldPersistSelection: true,
          storage: {
            getItem: AsyncStorage.getItem,
            setItem: AsyncStorage.setItem,
          },
        });

        AppRegistry.registerComponent('main', () => StorybookUIRoot);

        export default StorybookUIRoot;
        "
      `);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('does not modify existing storybook.requires file', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'sb-rn-entry-requires-'));
    const requiresPath = path.join(cwd, '.rnstorybook', 'storybook.requires.ts');
    const originalRequires = 'export const view = {};\n';

    try {
      await mkdir(path.dirname(requiresPath), { recursive: true });
      await writeFile(requiresPath, originalRequires, 'utf-8');

      await generateReactNativeEntrypoint({
        language: SupportedLanguage.TYPESCRIPT,
        cwd,
      });

      const requiresOutput = await readFile(requiresPath, 'utf-8');
      expect(requiresOutput).toMatchInlineSnapshot(`
        "export const view = {};
        "
      `);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
