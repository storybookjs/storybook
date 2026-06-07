import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearRegistry } from '../../service-registry.ts';
import { registerPreviewDocgenService } from './preview.ts';

vi.mock('storybook/internal/client-logger', { spy: true });

describe('preview docgen service', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('exposes custom argTypes before server extraction lands', async () => {
    const service = registerPreviewDocgenService();

    await service.commands.setCustomArgTypes({
      storyId: 'button--primary',
      metaArgTypes: { label: { description: 'from meta' } },
      storyArgTypes: { label: { control: 'text' } },
    });

    expect(service.queries.getDocgen({ id: 'button' })).toEqual({
      id: 'button',
      name: '',
      path: '',
      jsDocTags: {},
      stories: [],
      customArgTypes: {
        meta: { label: { description: 'from meta' } },
        stories: { 'button--primary': { label: { control: 'text' } } },
      },
    });
  });

  it('includes project argTypes on every component query result', async () => {
    const service = registerPreviewDocgenService();

    await service.commands.setProjectCustomArgTypes({
      argTypes: { theme: { control: 'color' } },
    });
    await service.commands.setCustomArgTypes({
      storyId: 'button--primary',
      storyArgTypes: { label: { control: 'text' } },
    });

    expect(service.queries.getDocgen({ id: 'button' })?.customArgTypes).toEqual({
      project: { theme: { control: 'color' } },
      stories: { 'button--primary': { label: { control: 'text' } } },
    });
  });

  it('merges custom argTypes across multiple stories for one component', async () => {
    const service = registerPreviewDocgenService();

    await service.commands.setCustomArgTypes({
      storyId: 'button--primary',
      storyArgTypes: { label: { control: 'text' } },
    });
    await service.commands.setCustomArgTypes({
      storyId: 'button--secondary',
      storyArgTypes: { disabled: { control: 'boolean' } },
    });

    expect(service.queries.getDocgen({ id: 'button' })?.customArgTypes?.stories).toEqual({
      'button--primary': { label: { control: 'text' } },
      'button--secondary': { disabled: { control: 'boolean' } },
    });
  });
});
