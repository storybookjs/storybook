import { extname } from 'pathe';

import { logger } from 'storybook/internal/node-logger';
import { parseWithOxc } from 'storybook/internal/oxc-parser';

import { profiler } from '../profiling.ts';
import type { ImportEdge, ImportParser, ImportParserContext } from './types.ts';

/**
 * Dispatches a file to the correct {@link ImportParser} based on its extension. The
 * registry is built once at change-detection startup from {@link builtinImportParsers}
 * plus any contributions from the `experimental_importParsers` preset key.
 *
 * Registration is last-wins on collision (plugin extensions override built-in
 * extensions). Lookup is case-insensitive and uses `path.extname` — compound
 * extensions like `.svelte.ts` match only the last segment (`.ts`).
 */
export class ParserRegistry {
  private byExtension = new Map<string, ImportParser['parse']>();
  private context: ImportParserContext;

  constructor(opts: {
    defaultParsers: readonly ImportParser[];
    pluginParsers: readonly ImportParser[];
  }) {
    this.context = { parseScriptWithOxc: this.parseScriptWithOxc.bind(this) };
    for (const p of opts.defaultParsers) {
      this.register(p);
    }
    for (const p of opts.pluginParsers) {
      this.register(p);
    }
  }

  private register(plugin: ImportParser): void {
    for (const ext of plugin.extensions) {
      const lower = ext.toLowerCase();
      if (this.byExtension.has(lower)) {
        logger.debug(`ParserRegistry: ${lower} parser overridden`);
      }
      this.byExtension.set(lower, plugin.parse);
    }
  }

  parserFor(filePath: string): ImportParser['parse'] | undefined {
    return this.byExtension.get(extname(filePath).toLowerCase());
  }

  /**
   * Returns `null` when no parser claims the extension — callers interpret this as
   * "opaque leaf, do not walk into".
   */
  async parse(filePath: string, source: string): Promise<ImportEdge[] | null> {
    const fn = this.parserFor(filePath);
    if (!fn) {
      return null;
    }
    if (profiler.enabled) {
      profiler.recordParse(extname(filePath).toLowerCase());
    }
    return fn({ filePath, source }, this.context);
  }

  private async parseScriptWithOxc(source: string, virtualFilePath: string): Promise<ImportEdge[]> {
    return parseWithOxc(virtualFilePath, source);
  }
}
