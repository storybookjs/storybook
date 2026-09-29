import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * The React harnesses measure the renderer's own extraction code, so they load modules out of
 * `@storybook/react`'s source rather than its published surface - `componentManifest/` is not in the
 * exports map, and `files` excludes `src/**` outright.
 *
 * That reach is deliberate, but it anchors on the resolved package instead of a path relative to
 * this file. `@storybook/docgen-harness` declares `@storybook/react`, so the coupling is recorded in
 * the workspace graph rather than living only in a `../../../` that nothing checks, and either tree
 * can move without the failure surfacing as a missing file inside an unrelated import.
 */
const require = createRequire(import.meta.url);

let cachedDir: string | undefined;

function componentManifestDir(): string {
  if (cachedDir) {
    return cachedDir;
  }
  const packageRoot = dirname(require.resolve('@storybook/react/package.json'));
  const dir = join(packageRoot, 'src', 'componentManifest');
  if (!existsSync(dir)) {
    throw new Error(
      `@storybook/react resolved to ${packageRoot}, which has no src/componentManifest. The React ` +
        `harnesses read the renderer's source, so they need the workspace checkout rather than a ` +
        `published copy.`
    );
  }
  cachedDir = dir;
  return dir;
}

export async function loadReactRendererModule<T>(relativePath: string): Promise<T> {
  const url = pathToFileURL(join(componentManifestDir(), relativePath)).href;
  try {
    return (await import(url)) as T;
  } catch (err) {
    throw rendererModuleError(relativePath, err);
  }
}

/**
 * The renderer's source imports `storybook/internal/*`, which resolves to `code/core`'s build
 * output. When that is missing, Node names a path the harness never mentioned, so the one thing the
 * reader needs - compile core first - is what the message leaves out.
 *
 * Exported because that redirect is the point of this module rather than an implementation detail:
 * if the match stops recognising the failure, the harness goes back to reporting the unhelpful
 * error and nothing else would notice.
 */
export function rendererModuleError(relativePath: string, err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/storybook[/\\]dist[/\\]/.test(message)) {
    return new Error(
      `loading ${relativePath} from the React renderer needs storybook's build output, which is ` +
        `missing. Run \`yarn nx compile core\` and try again.\n  cause: ${message}`
    );
  }
  return err instanceof Error ? err : new Error(message);
}

export interface ComponentRefLike {
  componentName: string;
  importName: string;
  localImportName: string;
  importId: string;
  isPackage: boolean;
  path: string;
}

export interface StoryRefLike {
  storyPath: string;
  component: ComponentRefLike;
}
