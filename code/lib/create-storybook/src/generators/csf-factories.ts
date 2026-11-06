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
    case SupportedFramework.ASTRO:
      return true;
    // on-device RN is not in this enum; its generator skips this helper and stays CSF3 until @storybook/react-native 11 is what init installs
    // no definePreview, and no tracker for adding it
    case SupportedFramework.EMBER:
    // no definePreview, and no tracker for adding it
    case SupportedFramework.HTML_VITE:
    // no definePreview, and no tracker for adding it
    case SupportedFramework.PREACT_VITE:
    // no definePreview, and no tracker for adding it
    case SupportedFramework.SERVER_WEBPACK5:
    // no definePreview, and no tracker for adding it
    case SupportedFramework.HTML_RSBUILD:
    // https://github.com/nuxt-modules/storybook/issues/1097 — re-exports Vue definePreview; still no ./node defineMain
    case SupportedFramework.NUXT:
    // https://github.com/literalpie/storybook-framework-qwik/issues/96 — no factories yet
    case SupportedFramework.QWIK:
    // already ships definePreview; blocked on exporting defineMain from ./node
    case SupportedFramework.SOLID:
      return false;
    default: {
      const exhaustive: never = framework;
      return exhaustive;
    }
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
