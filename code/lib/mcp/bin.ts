/**
 * Development harness: the docs tools of this package over a stdio transport, which is easier to
 * drive by hand than the HTTP handler. Run it from this directory:
 *   node bin.ts --manifestsDir ./fixtures/default
 *
 * `@storybook/mcp` is a library and ships no executable, so this file is not published and there is
 * no `node_modules` path to invoke. Consumers wanting a stdio server build one from the exported
 * tool registrations — see the recipe in README.md.
 */
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { StdioTransport } from '@tmcp/transport-stdio';
import pkgJson from './package.json' with { type: 'json' };
import {
  addGetDocumentationTool,
  addGetStoryDocumentationTool,
  addListAllDocumentationTool,
} from './src/tools/register.ts';
import { DOCS_TOOLSET_INSTRUCTIONS as serverInstructions } from 'storybook/internal/toolsets-docs';
import type { StorybookContext } from './src/types.ts';
import { parseArgs } from 'node:util';
import * as fs from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';

function resolveManifestFile(base: string, rel: string): string {
  const resolvedBase = resolve(base);
  const resolved = resolve(resolvedBase, rel);
  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + sep)) {
    throw new Error(`Refusing to read manifest outside base: ${rel}`);
  }
  return resolved;
}

const adapter = new ValibotJsonSchemaAdapter();
const server = new McpServer(
  {
    name: pkgJson.name,
    version: pkgJson.version,
    description: pkgJson.description,
  },
  {
    adapter,
    instructions: serverInstructions,
    capabilities: {
      tools: { listChanged: true },
    },
  }
).withContext<StorybookContext>();

await addListAllDocumentationTool(server);
await addGetStoryDocumentationTool(server);
await addGetDocumentationTool(server);

const transport = new StdioTransport(server);
const args = parseArgs({
  options: {
    manifestsDir: {
      type: 'string',
      default: './fixtures/default',
    },
  },
});

transport.listen({
  manifestProvider: async (_request, path) => {
    const { manifestsDir } = args.values;
    const isRemote = manifestsDir.startsWith('http://') || manifestsDir.startsWith('https://');

    // Top-level manifests (`./manifests/<name>.json`) live in `manifestsDir`; split/ref
    // payloads (`./services/<service>/<id>.json`) live in a sibling `services/` directory.
    const normalized = path.replace(/^\.?\//, '');
    const { base, rel } = normalized.startsWith('manifests/')
      ? { base: manifestsDir, rel: normalized.slice('manifests/'.length) }
      : {
          base: isRemote ? manifestsDir.replace(/\/[^/]+\/?$/, '') : dirname(manifestsDir),
          rel: normalized,
        };

    if (isRemote) {
      const res = await fetch(`${base.replace(/\/$/, '')}/${rel}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch manifest (${res.status}) from ${res.url}`);
      }
      return await res.text();
    }
    return await fs.readFile(resolveManifestFile(base, rel), 'utf-8');
  },
});
