import { SandboxBaselineError } from '../error.ts';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

import { z } from 'zod';

import { normalizePaths } from '../read-static-docgen.ts';
import { stableStringify } from '../stable-stringify.ts';
import type { CapturedComponents, CaptureMetadata } from './types.ts';

import { argTypesSchema } from './arg-types-schema.ts';
const componentSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().optional(),
  argTypes: argTypesSchema,
  stories: z.record(z.object({ snippet: z.string().nullable() })),
});
const metadataSchema = z.object({
  engine: z.enum(['legacy', 'server']),
  storybookVersion: z.string().min(1),
  repo: z.string().min(1),
  sha: z.string().min(1),
  capturedAt: z.string().datetime(),
});

export function readCapture(directory: string) {
  const metadata = metadataSchema.parse(
    JSON.parse(readFileSync(join(directory, 'capture.json'), 'utf8'))
  );
  const components: CapturedComponents = {};
  for (const file of readdirSync(directory)
    .filter((name) => name.endsWith('.json') && name !== 'capture.json')
    .sort()) {
    const component = componentSchema.parse(
      JSON.parse(readFileSync(join(directory, file), 'utf8'))
    );
    if (file !== `${component.id}.json`)
      throw new SandboxBaselineError(`Capture id does not match filename: ${file}`);
    components[component.id] = component;
  }
  if (!Object.keys(components).length)
    throw new SandboxBaselineError(`Empty capture: ${directory}`);
  return { metadata, components };
}

export function writeCapture(
  directory: string,
  components: CapturedComponents,
  metadata: CaptureMetadata,
  root: string
) {
  if (!Object.keys(components).length)
    throw new SandboxBaselineError('Refusing to write an empty capture');
  for (const id of Object.keys(components)) {
    if (!id || id === '.' || id === '..' || /[\\/\0:*?"<>|]/.test(id) || id === 'capture') {
      throw new SandboxBaselineError(`Unsafe component id: ${id}`);
    }
  }
  mkdirSync(directory, { recursive: true });
  if (readdirSync(directory).length)
    throw new SandboxBaselineError(`Capture output must be empty: ${directory}`);
  for (const [id, component] of Object.entries(components)) {
    writeFileSync(
      join(directory, `${id}.json`),
      stableStringify(
        JSON.parse(
          JSON.stringify(component, (_key, value: unknown) =>
            typeof value === 'string'
              ? normalizePaths(value, root).replaceAll('<sandbox>', '<root>')
              : value
          )
        )
      ) + '\n'
    );
  }
  writeFileSync(join(directory, 'capture.json'), stableStringify(metadata) + '\n');
}

export function captureMetadata(
  staticDir: string,
  engine: CaptureMetadata['engine']
): CaptureMetadata {
  const cwd = dirname(staticDir);
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const project = z
    .object({
      devDependencies: z.record(z.string()).optional(),
      dependencies: z.record(z.string()).optional(),
    })
    .parse(JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')));
  const installed = z
    .object({ version: z.string() })
    .parse(
      JSON.parse(
        readFileSync(
          createRequire(join(cwd, 'package.json')).resolve('storybook/package.json'),
          'utf8'
        )
      )
    );
  if (!(project.devDependencies?.storybook || project.dependencies?.storybook))
    throw new SandboxBaselineError('Project must declare its Storybook version');
  return {
    engine,
    storybookVersion: installed.version,
    repo: git('config', '--get', 'remote.origin.url'),
    sha: git('rev-parse', 'HEAD'),
    capturedAt: new Date().toISOString(),
  };
}
