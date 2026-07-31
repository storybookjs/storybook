import { beforeEach, describe, expect, it, vi } from 'vitest';

// Redirect node:fs → memfs so component resolution reads from a virtual filesystem.
vi.mock('node:fs', async () => {
  const { fs } = await import('memfs');
  return { ...fs, default: fs };
});

import { resolveAngularStoryComponent } from './resolveAngularComponents.ts';
import { ROOT, setupMemfsMocks } from './memfs-test-setup.ts';

beforeEach(() => {
  setupMemfsMocks();
});

describe('resolveAngularStoryComponent', () => {
  it('resolves meta.component to its named import and absolute path', async () => {
    const result = await resolveAngularStoryComponent({
      storyPath: `${ROOT}/src/button/button.stories.ts`,
      title: 'Components/Button',
    });

    expect(result.componentName).toBe('ButtonComponent');
    expect(result.component?.componentName).toBe('ButtonComponent');
    expect(result.component?.importSpecifier).toBe('./button.component');
    expect(result.component?.path).toBe(`${ROOT}/src/button/button.component.ts`);
  });

  it('leaves component undefined when the story has no meta.component', async () => {
    setupMemfsMocks({
      [`${ROOT}/src/no-meta/story.stories.ts`]: `
        export default { title: 'Components/NoMeta' };
        export const Primary = {};
      `,
    });

    const result = await resolveAngularStoryComponent({
      storyPath: `${ROOT}/src/no-meta/story.stories.ts`,
      title: 'Components/NoMeta',
    });

    expect(result.componentName).toBeUndefined();
    expect(result.component).toBeUndefined();
  });

  it('leaves the resolved path undefined when the import specifier is not a relative path', async () => {
    setupMemfsMocks({
      [`${ROOT}/src/pkg/story.stories.ts`]: `
        import { WidgetComponent } from '@my-org/widgets';
        export default { title: 'Components/Widget', component: WidgetComponent };
        export const Primary = {};
      `,
    });

    const result = await resolveAngularStoryComponent({
      storyPath: `${ROOT}/src/pkg/story.stories.ts`,
      title: 'Components/Widget',
    });

    expect(result.componentName).toBe('WidgetComponent');
    expect(result.component?.importSpecifier).toBe('@my-org/widgets');
    expect(result.component?.path).toBeUndefined();
  });

  it('leaves the resolved path undefined when the component file does not exist on disk', async () => {
    setupMemfsMocks({
      [`${ROOT}/src/missing/story.stories.ts`]: `
        import { GoneComponent } from './gone.component';
        export default { title: 'Components/Gone', component: GoneComponent };
        export const Primary = {};
      `,
    });

    const result = await resolveAngularStoryComponent({
      storyPath: `${ROOT}/src/missing/story.stories.ts`,
      title: 'Components/Gone',
    });

    expect(result.component?.importSpecifier).toBe('./gone.component');
    expect(result.component?.path).toBeUndefined();
  });

  it('resolves an aliased named import to its original local name', async () => {
    setupMemfsMocks({
      [`${ROOT}/src/aliased/aliased.component.ts`]: `export class RealComponent {}`,
      [`${ROOT}/src/aliased/story.stories.ts`]: `
        import { RealComponent as AliasedComponent } from './aliased.component';
        export default { title: 'Components/Aliased', component: AliasedComponent };
        export const Primary = {};
      `,
    });

    const result = await resolveAngularStoryComponent({
      storyPath: `${ROOT}/src/aliased/story.stories.ts`,
      title: 'Components/Aliased',
    });

    expect(result.component?.importSpecifier).toBe('./aliased.component');
    expect(result.component?.path).toBe(`${ROOT}/src/aliased/aliased.component.ts`);
  });
});
