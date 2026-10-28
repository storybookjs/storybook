import {
  defineAddon,
  defineBuilder,
  defineFramework,
  defineRenderer,
} from 'storybook/internal/instance';

import * as v from 'valibot';

import { defineService } from '@storybook/core/open-service';

export const projectService = defineService({
  id: 'fixture/project',
  initialState: { name: '' },
  queries: {},
  commands: {
    name: {
      input: v.void(),
      output: v.string(),
      handler: async (_input, context) => context.self.state.name,
    },
  },
});

export const projectAddon = defineAddon<{ name: string }>(({ name }) => ({
  meta: { name: 'fixture-project' },
  setup(storybook): void {
    storybook.registerService({ ...projectService, initialState: { name } });
  },
}));

export const framework = defineFramework(() => ({
  meta: { name: 'fixture-framework' },
  builder: defineBuilder(() => ({
    meta: { name: 'fixture-builder' },
    setup(): void {},
    async dev(_storybook, { router }) {
      router.get('/iframe.html', (_request, response) => {
        response.end('<!doctype html><title>Fixture preview</title>');
      });
      return { bail: async (): Promise<void> => {} };
    },
    async build(): Promise<void> {
      throw new Error('The dev fixture does not support static builds.');
    },
    changeDetectionAdapter(storybook) {
      return {
        getResolveConfig: async () => ({ projectRoot: storybook.workingDir }),
        onFileChange: () => (): void => {},
      };
    },
  }))(),
  renderer: defineRenderer(() => ({
    meta: { name: 'fixture-renderer' },
    setup(): void {},
  }))(),
  setup(): void {},
}));
