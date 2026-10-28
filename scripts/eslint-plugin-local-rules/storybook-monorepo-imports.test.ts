import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const rule = require('./storybook-monorepo-imports.js');

function lint(fileName: string, specifier: string): string[] {
  const messages: string[] = [];
  const visitor = rule.create({
    getPhysicalFilename: () => fileName,
    report: ({ message }: { message: string }) => messages.push(message),
  });
  visitor.ImportDeclaration({ source: { value: specifier } });
  return messages;
}

const CORE = '/repo/code/core/src/a.ts';
const UI = '/repo/code/lib/ui/src/a.ts';
const MANAGER = '/repo/code/lib/manager/src/a.ts';
const PRODUCT = '/repo/code/lib/storybook/src/a.ts';
const OPEN_SERVICE = '/repo/code/lib/open-service/src/a.ts';
const ADDON = '/repo/code/addons/docs/src/a.ts';
const FRAMEWORK = '/repo/code/frameworks/react-vite/src/node/index.ts';
const BUILDER = '/repo/code/builders/builder-vite/src/build.ts';

describe('storybook-monorepo-imports', () => {
  it.each([
    { name: 'core -> core', file: CORE, specifier: '@storybook/core/test', errors: 0 },
    { name: 'ui -> core', file: UI, specifier: '@storybook/core/internal/types', errors: 0 },
    { name: 'ui -> ui', file: UI, specifier: '@storybook/ui/theming', errors: 0 },
    { name: 'manager -> core', file: MANAGER, specifier: '@storybook/core/test', errors: 0 },
    { name: 'manager -> ui', file: MANAGER, specifier: '@storybook/ui/theming', errors: 0 },
    {
      name: 'manager -> manager',
      file: MANAGER,
      specifier: '@storybook/manager/manager-api',
      errors: 0,
    },
    { name: 'product -> storybook', file: PRODUCT, specifier: 'storybook/test', errors: 0 },
    { name: 'product -> core', file: PRODUCT, specifier: '@storybook/core/test', errors: 0 },
    {
      name: 'product -> manager',
      file: PRODUCT,
      specifier: '@storybook/manager/manager-api',
      errors: 0,
    },
    {
      name: 'open-service -> core',
      file: OPEN_SERVICE,
      specifier: '@storybook/core/open-service',
      errors: 0,
    },
    { name: 'open-service -> unrelated', file: OPEN_SERVICE, specifier: 'pathe', errors: 0 },
    {
      name: 'product -> open-service',
      file: PRODUCT,
      specifier: '@storybook/open-service',
      errors: 0,
    },
    { name: 'addon -> storybook', file: ADDON, specifier: 'storybook/internal/types', errors: 0 },
    { name: 'addon -> unrelated', file: ADDON, specifier: '@storybook/react', errors: 0 },
    {
      name: 'framework -> core',
      file: FRAMEWORK,
      specifier: '@storybook/core/internal/instance',
      errors: 0,
    },
    {
      name: 'builder -> core',
      file: BUILDER,
      specifier: '@storybook/core/internal/types',
      errors: 0,
    },
    { name: 'framework -> storybook', file: FRAMEWORK, specifier: 'storybook/test', errors: 0 },
    { name: 'core -> ui', file: CORE, specifier: '@storybook/ui/theming', errors: 1 },
    {
      name: 'core -> manager',
      file: CORE,
      specifier: '@storybook/manager/manager-api',
      errors: 1,
    },
    { name: 'ui -> manager', file: UI, specifier: '@storybook/manager/manager-api', errors: 1 },
    { name: 'core -> storybook', file: CORE, specifier: 'storybook/test', errors: 1 },
    { name: 'ui -> storybook', file: UI, specifier: 'storybook/theming', errors: 1 },
    { name: 'manager -> storybook root', file: MANAGER, specifier: 'storybook', errors: 1 },
    {
      name: 'addon -> core root',
      file: ADDON,
      specifier: '@storybook/core',
      errors: 0,
    },
    { name: 'addon -> ui', file: ADDON, specifier: '@storybook/ui/theming', errors: 1 },
    { name: 'framework -> ui', file: FRAMEWORK, specifier: '@storybook/ui/theming', errors: 1 },
    {
      name: 'builder -> manager',
      file: BUILDER,
      specifier: '@storybook/manager/manager-api',
      errors: 1,
    },
    {
      name: 'open-service -> storybook root',
      file: OPEN_SERVICE,
      specifier: 'storybook',
      errors: 1,
    },
    {
      name: 'open-service -> storybook',
      file: OPEN_SERVICE,
      specifier: 'storybook/internal/instance',
      errors: 1,
    },
    {
      name: 'open-service -> ui',
      file: OPEN_SERVICE,
      specifier: '@storybook/ui/theming',
      errors: 1,
    },
    {
      name: 'open-service -> manager',
      file: OPEN_SERVICE,
      specifier: '@storybook/manager/manager-api',
      errors: 1,
    },
    {
      name: 'addon -> manager',
      file: ADDON,
      specifier: '@storybook/manager/manager-api',
      errors: 1,
    },
  ])('$name', ({ file, specifier, errors }) => {
    expect(lint(file, specifier)).toHaveLength(errors);
  });
});
