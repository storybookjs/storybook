// This plugin is a direct port of https://github.com/IanVS/vite-plugin-turbosnap
import { createHash } from 'node:crypto';
import { relative } from 'node:path';

import type { BuilderStats, Options } from 'storybook/internal/types';

// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';
import type { Plugin } from 'vite';

import { getPreviewConfigHash } from '../transform-iframe-html.ts';
import { createHashNormalizer } from '../utils/normalize-for-hash.ts';
import {
  SB_VIRTUAL_FILES,
  getOriginalVirtualModuleId,
  getResolvedVirtualModuleId,
} from '../virtual-file-names.ts';

/*
 * Reason, Module are copied from chromatic types
 * https://github.com/chromaui/chromatic-cli/blob/145a5e295dde21042e96396c7e004f250d842182/bin-src/types.ts#L265-L276
 */
interface Reason {
  moduleName: string;
}
interface Module {
  id: string | number;
  name: string;
  modules?: Array<Pick<Module, 'name'>>;
  reasons?: Reason[];
  // Hash of the transformed output, so changes in the build config that change the output are visible
  hash?: string;
}

type WebpackStatsPluginOptions = {
  workingDir: string;
  options: Options;
};

const CSS_LANGS_RE = /\.(?:css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
// Vite and Rolldown name an emitted asset by a reference id that does not depend on its content
const ASSET_REFERENCE_RE =
  /__VITE_ASSET__([\w$]+)__|import\.meta\.ROLL(?:UP|DOWN)_FILE_URL_([\w$]+)/g;

function sha256(content: string | Uint8Array) {
  return createHash('sha256').update(content).digest('hex');
}

const PROPERTY_ACCESS_RE = /^\s*\??\.\s*([\w$]+)/;

function parseJsonObject(text: string | undefined): Record<string, unknown> | undefined {
  try {
    const value = text === undefined ? undefined : JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strips off query params added by rollup/vite to ids, to make paths compatible for comparison with
 * git.
 */
function stripQueryParams(filePath: string): string {
  return filePath.split('?')[0];
}

/** We only care about user code and the node_modules it depends on. Not vite files, or (most) virtual files. */
function isUserCode(moduleName: string) {
  if (!moduleName) {
    return false;
  }

  // keep Storybook's virtual files because they import the story files, so they are essential to the module graph
  if (Object.values(SB_VIRTUAL_FILES).includes(getOriginalVirtualModuleId(moduleName))) {
    return true;
  }

  return Boolean(
    !moduleName.startsWith('vite/') &&
    !moduleName.startsWith('\0') &&
    moduleName !== 'react/jsx-runtime'
  );
}

export type WebpackStatsPlugin = Plugin & { storybookGetStats: () => BuilderStats };

export function pluginWebpackStats({
  workingDir,
  options,
}: WebpackStatsPluginOptions): WebpackStatsPlugin {
  /** Convert an absolute path name to a path relative to the vite root, with a starting `./` */
  function normalize(filename: string) {
    // Do not try to resolve virtual files
    if (filename.startsWith('virtual:')) {
      // We have to append a forward slash because otherwise we break turbosnap.
      // As soon as the chromatic-cli supports `virtual:` id's without a starting forward slash,
      // we can remove adding the forward slash here
      // Reference: https://github.com/chromaui/chromatic-cli/blob/v11.25.2/node-src/lib/getDependentStoryFiles.ts#L53
      return `/${filename}`;
    }
    // ! Maintain backwards compatibility with the old virtual file names
    // ! to ensure that the stats file doesn't change between the versions
    // ! Turbosnap is also only compatible with the old virtual file names
    // ! the old virtual file names did not start with the obligatory \0 character
    if (Object.values(SB_VIRTUAL_FILES).includes(getOriginalVirtualModuleId(filename))) {
      // We have to append a forward slash because otherwise we break turbosnap.
      // As soon as the chromatic-cli supports `virtual:` id's without a starting forward slash,
      // we can remove adding the forward slash here
      // Reference: https://github.com/chromaui/chromatic-cli/blob/v11.25.2/node-src/lib/getDependentStoryFiles.ts#L53
      return `/${getOriginalVirtualModuleId(filename)}`;
    }

    // Otherwise, we need them in the format `./path/to/file.js`.
    else {
      const relativePath = relative(workingDir, stripQueryParams(filename));
      // This seems hacky, got to be a better way to add a `./` to the start of a path.
      return `./${slash(relativePath)}`;
    }
  }

  /** Helper to create Reason objects out of a list of string paths */
  function createReasons(importers?: readonly string[]): Reason[] {
    return (importers || []).map((i) => ({ moduleName: normalize(i) }));
  }

  /** Helper function to build a `Module` given a filename and list of files that import it */
  function createStatsMapModule(filename: string, importers?: readonly string[]): Module {
    return {
      id: filename,
      name: filename,
      reasons: createReasons(importers),
    };
  }

  const statsMap = new Map<string, Module>();
  // Module code still holds absolute import ids, which the bundler makes relative later
  const normalizeForHash = createHashNormalizer();
  const compiledCssById = new Map<string, string>();
  // Query variants of one file (`a.css`, `a.css?inline`) share a stats module, so it gets one hash per id
  const outputHashesByModule = new Map<string, Map<string, string>>();
  const codeWithAssetsById = new Map<string, string>();
  const defineValues = new Map<string, string>();
  let defineKeysRe: RegExp | undefined;
  let previewConfigHash: string | undefined;

  // Rolldown replaces `define` keys after `moduleParsed`, so the code alone misses their values
  function getUsedDefines(code: string) {
    const used = new Map<string, string | undefined>();
    for (const match of defineKeysRe ? code.matchAll(defineKeysRe) : []) {
      const key = match[0];
      const value = defineValues.get(key);
      const end = match.index + key.length;
      const property = PROPERTY_ACCESS_RE.exec(code.slice(end, end + 200))?.[1];
      // Reading one property of an object define, like `import.meta.env.UNSET`, uses only that value
      const object = property ? parseJsonObject(value) : undefined;
      if (property && object) {
        used.set(`${key}.${property}`, JSON.stringify(object[property]));
      } else {
        used.set(key, value);
      }
    }
    return [...used]
      .sort()
      .map(([key, value]) => `\n${key}=${value}`)
      .join('');
  }

  function setOutputHash(id: string, code: string) {
    const moduleName = normalize(id);
    const hashesById = outputHashesByModule.get(moduleName) ?? new Map<string, string>();
    hashesById.set(id, sha256(code));
    outputHashesByModule.set(moduleName, hashesById);
  }

  function getModuleHash(name: string) {
    const hashes = [...(outputHashesByModule.get(name)?.values() ?? [])].sort();
    return hashes.length > 1 ? sha256(hashes.join('')) : hashes[0];
  }

  return {
    name: 'storybook:rollup-plugin-webpack-stats',
    configResolved(config) {
      const envDefines = Object.entries(config.env).map(([key, value]) => [
        `import.meta.env.${key}`,
        value,
      ]);
      for (const [key, value] of [...envDefines, ...Object.entries(config.define ?? {})]) {
        defineValues.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
      const keys = [...defineValues.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
      defineKeysRe = keys.length
        ? new RegExp(`(?<![\\w$.])(?:${keys.join('|')})(?![\\w$])`, 'g')
        : undefined;
    },
    // Without `enforce`, this runs after `vite:css` compiles a stylesheet and before `vite:css-post`
    // empties its module code in builds
    transform(code, id) {
      if (CSS_LANGS_RE.test(id) && isUserCode(id)) {
        compiledCssById.set(id, code);
      }
    },
    moduleParsed: function (mod) {
      if (!isUserCode(mod.id)) {
        return;
      }
      const moduleCode = (compiledCssById.get(mod.id) ?? '') + (mod.code ?? '');
      const code = normalizeForHash(moduleCode) + getUsedDefines(moduleCode);
      compiledCssById.delete(mod.id);
      if (code.search(ASSET_REFERENCE_RE) !== -1) {
        codeWithAssetsById.set(mod.id, code);
      } else {
        setOutputHash(mod.id, code);
      }

      mod.importedIds
        .concat(mod.dynamicallyImportedIds)
        .filter((name) => isUserCode(name))
        .forEach((depIdUnsafe) => {
          const depId = normalize(depIdUnsafe);
          if (!statsMap.has(depId)) {
            statsMap.set(depId, createStatsMapModule(depId, [mod.id]));
            return;
          }
          const m = statsMap.get(depId);
          if (!m) {
            return;
          }
          m.reasons = (m.reasons ?? [])
            .concat(createReasons([mod.id]))
            .filter((r) => r.moduleName !== depId);
          statsMap.set(depId, m);
        });
    },

    async generateBundle(_, bundle) {
      for (const [id, code] of codeWithAssetsById) {
        const codeWithAssetHashes = code.replace(
          ASSET_REFERENCE_RE,
          (placeholder, viteReferenceId?: string, rollupReferenceId?: string) => {
            const asset = bundle[this.getFileName(viteReferenceId ?? rollupReferenceId ?? '')];
            return asset?.type === 'asset' ? sha256(asset.source) : placeholder;
          }
        );
        setOutputHash(id, codeWithAssetHashes);
      }
      previewConfigHash = await getPreviewConfigHash(options);
    },

    storybookGetStats() {
      const modules = Array.from(statsMap.values(), (m) => ({ ...m, hash: getModuleHash(m.name) }));
      const stats = { previewConfigHash, modules };
      return { ...stats, toJson: () => stats };
    },
  };
}
