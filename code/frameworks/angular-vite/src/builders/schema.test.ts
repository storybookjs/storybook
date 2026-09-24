import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDevStandalone, buildStaticStandalone } from 'storybook/internal/core-server';
import type { CLIOptions } from 'storybook/internal/types';

import {
  addSchemaOptionsToCommand,
  parseJsonSchemaToOptions,
} from '@angular/cli/src/command-builder/utilities/json-schema.js';
import { Architect } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { schema } from '@angular-devkit/core';
import yargs from 'yargs/yargs';

import buildSchema from '../../build-schema.json';
import startSchema from '../../start-schema.json';
import buildHandler from './build-storybook/index.ts';
import startHandler from './start-storybook/index.ts';

vi.mock('storybook/internal/core-server', () => ({
  buildStaticStandalone: vi.fn(),
  buildDevStandalone: vi.fn(),
  withTelemetry: (_event: unknown, _options: unknown, callback: () => Promise<unknown>) =>
    callback(),
}));

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getEnvConfig: vi.fn(),
}));

vi.mock('storybook/internal/telemetry', () => ({
  addToGlobalContext: vi.fn(),
}));

vi.mock('empathic/package', () => ({
  up: (): null => null,
}));

vi.mock('../find-tsconfig.ts', () => ({
  resolveTsconfig: () => resolve('tsconfig.json'),
}));

const statsDirectory = resolve('storybook stats');

describe.each([
  {
    name: 'build-storybook',
    builderSchema: buildSchema,
    handler: buildHandler,
    standalone: buildStaticStandalone,
  },
  {
    name: 'start-storybook',
    builderSchema: startSchema,
    handler: startHandler,
    standalone: buildDevStandalone,
  },
])('$name stats options', ({ name, builderSchema, handler, standalone }) => {
  const builderName = `@storybook/angular-vite:${name}`;
  const target = { project: 'test-project', target: name };
  let architect: Architect;
  let host: TestingArchitectHost;

  beforeEach(() => {
    vi.stubEnv('STORYBOOK_ANGULAR_BUILDER_OPTIONS_JSON', undefined);
    vi.mocked(buildStaticStandalone).mockResolvedValue(undefined);
    vi.mocked(buildDevStandalone).mockResolvedValue({
      port: 6006,
      address: 'http://localhost:6006',
      networkAddress: 'http://localhost:6006',
    });

    const registry = new schema.CoreSchemaRegistry();
    registry.addPostTransform(schema.transforms.addUndefinedDefaults);
    host = new TestingArchitectHost();
    host.addBuilder(builderName, handler, '', builderSchema);
    architect = new Architect(host, registry);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { args: [`--stats-json=${statsDirectory}`], expected: statsDirectory },
    { args: ['--stats-json', statsDirectory], expected: statsDirectory },
    { args: ['--stats-json=./false'], expected: './false' },
    { args: ['--stats-json=true'], expected: 'true' },
    { args: ['--stats-json', 'true'], expected: 'true' },
    { args: ['--stats-json=false'], expected: 'false' },
    { args: ['--stats-json', 'false'], expected: 'false' },
    { args: ['--stats-json=123'], expected: '123' },
    { args: ['--stats-json'], expected: true },
    { args: ['--no-stats-json'], expected: false },
    { args: [], expected: false },
  ])('forwards CLI arguments $args as $expected', async ({ args, expected }) => {
    const options = await parseJsonSchemaToOptions(new schema.CoreSchemaRegistry(), builderSchema);
    const parser = yargs().exitProcess(false);
    addSchemaOptionsToCommand(parser, options, false);
    const statsJson = parser.parseSync(args)['stats-json'] as CLIOptions['statsJson'];
    host.addTarget(target, builderName, {});

    const run = await architect.scheduleTarget(
      target,
      statsJson === undefined ? {} : { statsJson }
    );
    try {
      expect((await run.result).success).toBe(true);
      expect(standalone).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ statsJson: expected })
      );
    } finally {
      await run.stop();
    }
  });

  it.each([true, false, 'true', 'false', './false', statsDirectory])(
    'preserves configured statsJson %j',
    async (statsJson) => {
      host.addTarget(target, builderName, { statsJson });

      const run = await architect.scheduleTarget(target);
      try {
        expect((await run.result).success).toBe(true);
        expect(standalone).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ statsJson }));
      } finally {
        await run.stop();
      }
    }
  );

  it.each([
    { configured: 'false', args: ['--no-stats-json'], expected: false },
    { configured: 'true', args: ['--stats-json'], expected: true },
    { configured: true, args: ['--stats-json=false'], expected: 'false' },
    { configured: false, args: ['--stats-json=true'], expected: 'true' },
  ])('overrides configured $configured with $args', async ({ configured, args, expected }) => {
    const options = await parseJsonSchemaToOptions(new schema.CoreSchemaRegistry(), builderSchema);
    const parser = yargs().exitProcess(false);
    addSchemaOptionsToCommand(parser, options, false);
    const statsJson = parser.parseSync(args)['stats-json'] as string | boolean;
    host.addTarget(target, builderName, { statsJson: configured });

    const run = await architect.scheduleTarget(target, { statsJson });
    try {
      expect((await run.result).success).toBe(true);
      expect(standalone).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ statsJson: expected })
      );
    } finally {
      await run.stop();
    }
  });
});
