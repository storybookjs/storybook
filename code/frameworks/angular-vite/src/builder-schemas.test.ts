import { describe, expect, it } from 'vitest';

import type { JsonObject } from '@angular-devkit/core';
import { schema } from '@angular-devkit/core';

import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const packageRoot = resolve(import.meta.dirname, '..');

const readJson = (relativePath: string) =>
  JSON.parse(readFileSync(resolve(packageRoot, relativePath), 'utf-8'));

const builderSchemaFiles = Object.values(
  readJson('builders.json').builders as Record<string, { schema: string }>
).map(({ schema: schemaPath }) => schemaPath.replace(/^\.\//, ''));

// Mirrors how Angular CLI validates builder options: `CoreSchemaRegistry` plus the deprecation
// provider `architect-base-command-module` installs, so `ng run` behaviour is what gets asserted.
const validateBuilderOptions = async (schemaFile: string, options: JsonObject) => {
  const registry = new schema.CoreSchemaRegistry();
  registry.addPostTransform(schema.transforms.addUndefinedDefaults);
  const deprecations: string[] = [];
  registry.useXDeprecatedProvider((message) => deprecations.push(message));

  const validator = await registry.compile(readJson(schemaFile));
  const { success, errors } = await validator(options);

  return { success, errors: (errors ?? []).map((error) => JSON.stringify(error)), deprecations };
};

describe('builder schemas', () => {
  it('is the pair `builders.json` points at', () => {
    expect(builderSchemaFiles).toEqual(['build-schema.json', 'start-schema.json']);
  });

  it('is the only copy in the package, so nothing can drift from it', () => {
    const strays = readdirSync(join(packageRoot, 'src'), { recursive: true })
      .map(String)
      .filter((entry) => basename(entry) === 'schema.json');

    expect(strays).toEqual([]);
  });

  it.each(builderSchemaFiles)('%s ships in the published files list', (schemaFile) => {
    expect(readJson('package.json').files).toContain(schemaFile);
  });

  it.each(builderSchemaFiles)(
    '%s keeps building a workspace whose target still carries the Compodoc options',
    async (schemaFile) => {
      const { success, errors } = await validateBuilderOptions(schemaFile, {
        compodoc: false,
        compodocArgs: ['-e', 'json'],
      });

      expect(errors).toEqual([]);
      expect(success).toBe(true);
    }
  );

  it.each(builderSchemaFiles)(
    '%s tells that workspace the Compodoc options are dead',
    async (schemaFile) => {
      const { deprecations } = await validateBuilderOptions(schemaFile, {
        compodoc: false,
        compodocArgs: ['-e', 'json'],
      });

      expect(deprecations).toHaveLength(2);
      expect(deprecations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Option "compodoc" is deprecated'),
          expect.stringContaining('Option "compodocArgs" is deprecated'),
        ])
      );
    }
  );

  it.each(builderSchemaFiles)(
    '%s stays quiet about Compodoc for a target that never set it',
    async (schemaFile) => {
      const { success, deprecations } = await validateBuilderOptions(schemaFile, {});

      expect(deprecations).toEqual([]);
      expect(success).toBe(true);
    }
  );

  it.each(builderSchemaFiles)(
    '%s declares the style preprocessor options the preset reads',
    (schemaFile) => {
      const { properties } = readJson(schemaFile);

      expect(Object.keys(properties.stylePreprocessorOptions.properties).sort()).toEqual([
        'includePaths',
        'loadPaths',
        'sass',
      ]);
    }
  );

  it.each(builderSchemaFiles)(
    '%s accepts both `styles` spellings the preset handles',
    async (schemaFile) => {
      const { success, errors } = await validateBuilderOptions(schemaFile, {
        styles: ['src/styles.scss', { input: 'src/theme.scss', bundleName: 'theme' }],
      });

      expect(errors).toEqual([]);
      expect(success).toBe(true);
    }
  );
});
