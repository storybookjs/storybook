import { readdir, readFile, writeFile } from 'node:fs/promises';

import { SupportedFramework } from 'storybook/internal/types';

import { dirname, join, parse, relative, resolve } from 'pathe';

const CLI_STORY_FILE = /\.(stories|story)\.(js|jsx|ts|tsx|mjs|mts|mjsx|mtsx|svelte)$/;
const PREVIEW_IMPORT = /from (['"])[^'"]*\.storybook\/preview\1/g;

export function supportsCsfFactories(framework: SupportedFramework): boolean {
  switch (framework) {
    case SupportedFramework.ANGULAR:
    case SupportedFramework.ANGULAR_VITE:
    case SupportedFramework.NEXTJS:
    case SupportedFramework.NEXTJS_VITE:
    case SupportedFramework.REACT_NATIVE_WEB_VITE:
    case SupportedFramework.REACT_VITE:
    case SupportedFramework.REACT_WEBPACK5:
    case SupportedFramework.SVELTE_VITE:
    case SupportedFramework.SVELTEKIT:
    case SupportedFramework.TANSTACK_REACT:
    case SupportedFramework.VUE3_VITE:
    case SupportedFramework.WEB_COMPONENTS_VITE:
    case SupportedFramework.REACT_RSBUILD:
    case SupportedFramework.VUE3_RSBUILD:
    case SupportedFramework.WEB_COMPONENTS_RSBUILD:
      return true;
    // Preact: https://github.com/storybookjs/storybook/issues/33701
    // Nuxt: https://github.com/nuxt-modules/storybook/issues/1097
    // Qwik: https://github.com/literalpie/storybook-framework-qwik/issues/96
    // Ember, HTML, Server, Solid: no factories tracker yet.
    case SupportedFramework.EMBER:
    case SupportedFramework.HTML_VITE:
    case SupportedFramework.PREACT_VITE:
    case SupportedFramework.SERVER_WEBPACK5:
    case SupportedFramework.HTML_RSBUILD:
    case SupportedFramework.NUXT:
    case SupportedFramework.QWIK:
    case SupportedFramework.SOLID:
      return false;
  }
}

async function collectStoryFiles(directory: string): Promise<string[]> {
  const collected: string[] = [];
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return collected;
  }

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      collected.push(...(await collectStoryFiles(fullPath)));
    } else if (CLI_STORY_FILE.test(entry.name)) {
      collected.push(fullPath);
    }
  }

  return collected;
}

export function previewImportFromStory(storyPath: string, previewConfigPath: string): string {
  const relativePath = relative(dirname(resolve(storyPath)), resolve(previewConfigPath));
  const { dir, name } = parse(relativePath);
  const previewPath = dir ? `${dir}/${name}` : name;
  return previewPath.startsWith('.') ? previewPath : `./${previewPath}`;
}

// Native CSF4 templates ship `../../.storybook/preview` for `src/stories`.
export async function rewriteCopiedStoryPreviewImports({
  destination,
  previewConfigPath,
}: {
  destination: string;
  previewConfigPath: string;
}) {
  const absolutePreviewConfigPath = resolve(previewConfigPath);
  const storyFiles = await collectStoryFiles(destination);

  await Promise.all(
    storyFiles.map(async (filePath) => {
      const source = await readFile(filePath, 'utf8');
      const importPath = previewImportFromStory(filePath, absolutePreviewConfigPath);
      const rewritten = source.replace(PREVIEW_IMPORT, `from '${importPath}'`);

      if (rewritten !== source) {
        await writeFile(filePath, rewritten);
      }
    })
  );
}
