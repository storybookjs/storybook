import { resolve } from 'node:path';

import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';

import { getEnvConfig } from 'storybook/internal/common';
import {
  buildDevStandalone,
  buildStaticStandalone,
  withTelemetry,
} from 'storybook/internal/core-server';

import { Architect } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { schema } from '@angular-devkit/core';
import * as pkg from 'empathic/package';

import buildSchema from '../../build-schema.json';
import startSchema from '../../start-schema.json';
import { resolveTsconfig } from '../find-tsconfig.ts';
import buildHandler from './build-storybook/index.ts';
import startHandler from './start-storybook/index.ts';

vi.mock('storybook/internal/core-server', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });
vi.mock('empathic/package', { spy: true });
vi.mock('../find-tsconfig.ts', { spy: true });

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
    vi.mocked(withTelemetry).mockImplementation((_event, _options, callback) => callback());
    vi.mocked(getEnvConfig).mockReturnValue(undefined);
    vi.mocked(pkg.up).mockReturnValue(undefined);
    vi.mocked(resolveTsconfig).mockReturnValue(resolve('tsconfig.json'));
    vi.mocked(buildStaticStandalone).mockResolvedValue(undefined);
    vi.mocked(buildDevStandalone).mockResolvedValue({
      port: 6006,
      address: 'http://localhost:6006',
      networkAddress: 'http://localhost:6006',
    });

    const registry = new schema.CoreSchemaRegistry();
    registry.addPostTransform(schema.transforms.addUndefinedDefaults);
    host = new TestingArchitectHost();
    assert(schema.isJsonSchema(builderSchema));
    host.addBuilder(builderName, handler, '', builderSchema);
    architect = new Architect(host, registry);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { statsJson: statsDirectory, expected: statsDirectory },
    { statsJson: './false', expected: './false' },
    { statsJson: 'true', expected: 'true' },
    { statsJson: 'false', expected: 'false' },
    { statsJson: '123', expected: '123' },
    { statsJson: '', expected: true },
    { statsJson: false, expected: false },
    { statsJson: undefined, expected: false },
  ])('forwards parsed stats options %j', async ({ statsJson, expected }) => {
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
    { configured: 'false', statsJson: false, expected: false },
    { configured: 'true', statsJson: '', expected: true },
    { configured: true, statsJson: 'false', expected: 'false' },
    { configured: false, statsJson: 'true', expected: 'true' },
  ])('overrides configured stats options %j', async ({ configured, statsJson, expected }) => {
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
