import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import rule from './no-untracked-service-state-key-check.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { sourceType: 'module', parserOptions: { lang: 'ts' } },
});

const untracked = [{ messageId: 'untracked' }];

ruleTester.run('no-untracked-service-state-key-check', rule, {
  valid: [
    'const payload = ctx.self.state.components[input.id];',
    'const payload = getOwn(ctx.self.state.components, input.id);',
    'const ids = Object.keys(ctx.self.state.components);',
    'const found = Object.hasOwn(manifest.components, id);',
    'ctx.self.setState((state) => { if (!(id in state.components)) state.components[id] = payload; });',
    'function find(manifest, id) { const { components } = manifest; return Object.hasOwn(components, id); }',
    'function find(ctx, id) { const { components } = ctx.self.state; return getOwn(components, id); }',
    'function find(ctx, id) { const { ...snapshot } = ctx.self.state.components; return Object.hasOwn(snapshot, id); }',
    'const handler = (input, { self: { state: { ...snapshot } } }) => Object.hasOwn(snapshot, input.id);',
    'const handler = (input, { manifest: { state } }) => input.id in state.components;',
    'const found = Object.hasOwn(manifest.components ?? {}, id);',
  ],
  invalid: [
    {
      code: 'const payload = Object.hasOwn(ctx.self.state.components, input.id) ? ctx.self.state.components[input.id] : undefined;',
      errors: untracked,
    },
    {
      code: 'const payload = input.id in ctx.self.state.components ? ctx.self.state.components[input.id] : undefined;',
      errors: untracked,
    },
    { code: 'if (!(input.entryId in ctx.self.state)) load();', errors: untracked },
    { code: 'const found = ctx.self.state.components.hasOwnProperty(id);', errors: untracked },
    {
      code: 'const found = Object.prototype.hasOwnProperty.call(ctx.self.state.components, id);',
      errors: untracked,
    },
    { code: 'const found = Reflect.has(ctx.self.state.components, id);', errors: untracked },
    {
      code: 'const found = Object.getOwnPropertyDescriptor(ctx.self.state.components, id);',
      errors: untracked,
    },
    { code: 'const found = hasOwn(ctx.self.state.components, id);', errors: untracked },
    { code: 'const found = Object.hasOwn(ctx.self?.state.components!, id);', errors: untracked },
    {
      code: 'const handler = (input, { self }) => input.id in self.state.components;',
      errors: untracked,
    },
    {
      code: 'function find(ctx, id) { const { components } = ctx.self.state; return Object.hasOwn(components, id); }',
      errors: untracked,
    },
    {
      code: 'function find(ctx, id) { const state = ctx.self.state; return id in state.components; }',
      errors: untracked,
    },
    {
      code: 'function find(ctx, id) { const { state } = ctx.self; return id in state.components; }',
      errors: untracked,
    },
    {
      code: 'const handler = (input, { self: { state } }) => input.id in state.components;',
      errors: untracked,
    },
    {
      code: 'const handler = (input, { self: { state: { components } } }) => Object.hasOwn(components, input.id);',
      errors: untracked,
    },
    {
      code: 'function find(ctx, id) { const { self: { state } } = ctx; return id in state.components; }',
      errors: untracked,
    },
    {
      code: 'function find(ctx, id) { const { ...snapshot } = ctx.self.state; return Object.hasOwn(snapshot.components, id); }',
      errors: untracked,
    },
    {
      code: 'const found = Object.hasOwn((ctx.self.state as State).components, id);',
      errors: untracked,
    },
    {
      code: 'const found = id in (ctx.self.state.components satisfies object);',
      errors: untracked,
    },
    { code: 'const found = Object.hasOwn(ctx.self!.state!.components!, id);', errors: untracked },
    {
      code: 'const found = Object.hasOwn(ctx.self.state.components ?? {}, id);',
      errors: untracked,
    },
    {
      code: 'const found = id in (cached ? ctx.self.state.components : {});',
      errors: untracked,
    },
  ],
});
