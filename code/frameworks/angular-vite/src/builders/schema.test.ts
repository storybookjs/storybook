import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CLIOptions } from 'storybook/internal/types';

import {
  addSchemaOptionsToCommand,
  parseJsonSchemaToOptions,
} from '@angular/cli/src/command-builder/utilities/json-schema.js';
import { schema } from '@angular-devkit/core';
import yargs from 'yargs/yargs';

import buildSchema from '../../build-schema.json';
import startSchema from '../../start-schema.json';
import { normalizeStatsJson } from './utils/standalone-options.ts';

const statsDirectory = resolve('storybook stats');

describe.each([
  { name: 'build', builderSchema: buildSchema },
  { name: 'start', builderSchema: startSchema },
])('$name builder CLI options', ({ builderSchema }) => {
  it.each([
    { args: [`--stats-json=${statsDirectory}`], expected: statsDirectory },
    { args: ['--stats-json', statsDirectory], expected: statsDirectory },
    { args: ['--stats-json=./false'], expected: './false' },
    { args: ['--stats-json'], expected: true },
    { args: ['--stats-json=true'], expected: true },
    { args: ['--stats-json=false'], expected: false },
    { args: ['--no-stats-json'], expected: false },
    { args: [], expected: undefined },
  ])('passes $args to Storybook as $expected', async ({ args, expected }) => {
    const options = await parseJsonSchemaToOptions(new schema.CoreSchemaRegistry(), builderSchema);
    const parser = yargs().exitProcess(false);
    addSchemaOptionsToCommand(parser, options, false);
    const statsJson = parser.parseSync(args)['stats-json'] as CLIOptions['statsJson'];

    expect(normalizeStatsJson(statsJson)).toBe(expected);
  });
});

it.each([true, false])('preserves the programmatic statsJson value %s', (statsJson) => {
  expect(normalizeStatsJson(statsJson)).toBe(statsJson);
});
