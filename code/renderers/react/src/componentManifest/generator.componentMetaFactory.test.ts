import { afterEach, describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import { cleanup, createTempProject } from './componentMeta/test-helpers.ts';
import { manifests } from './generator.ts';

// End-to-end through the real manifest generator (the layer that emits the user-visible
// "No component file found" error) with the React Component Meta engine. Uses a real on-disk
// project because the engine resolves types via a real TypeScript LanguageService.

type ManifestOptions = Parameters<typeof manifests>[1];

interface ManifestComponent {
  name?: string;
  error?: { name: string; message: string };
  reactComponentMeta?: {
    props?: Record<
      string,
      { required?: boolean; type?: { name: string; value?: Array<{ value: string }> } }
    >;
  };
}

const presets = {
  apply: async (key: string, fallback: unknown) =>
    key === 'features'
      ? { experimentalReactComponentMeta: true }
      : key === 'typescript'
        ? {}
        : fallback,
};

describe('manifests() with experimentalReactComponentMeta', () => {
  let projectDir: string | undefined;

  afterEach(() => {
    vi.restoreAllMocks();
    if (projectDir) {
      cleanup(projectDir);
      projectDir = undefined;
    }
  });

  it('resolves an args-only CSF factory story instead of erroring', async () => {
    const { projectDir: dir } = createTempProject({
      'MyComponent.tsx': dedent`
        import React from 'react';
        interface MyComponentProps {
          /** The content to render */
          children: React.ReactNode;
          /** Visual emphasis */
          emphasis?: 'low' | 'high';
        }
        export function MyComponent({ children, emphasis }: MyComponentProps) {
          return <div data-emphasis={emphasis}>{children}</div>;
        }
      `,
      'MyComponent.stories.tsx': dedent`
        import preview from '#.storybook/preview';
        import { MyComponent } from './MyComponent';
        const meta = preview.meta({ title: 'MyComponent', component: MyComponent });
        export const ArgsOnly = meta.story({ args: { children: 'Hello' } });
      `,
    });
    projectDir = dir;
    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    const manifestEntries = [
      {
        type: 'story',
        subtype: 'story',
        id: 'mycomponent--args-only',
        name: 'Args Only',
        title: 'MyComponent',
        importPath: 'MyComponent.stories.tsx',
        tags: [],
      },
    ];

    const result = await manifests(undefined, {
      manifestEntries,
      watch: false,
      presets,
    } as unknown as ManifestOptions);

    const components = Object.values(result?.components?.components ?? {}) as ManifestComponent[];
    const component = components.find((c) => c?.name === 'MyComponent');

    expect(component).toBeDefined();
    // The reported symptom: no "No component file found" error is surfaced.
    expect(component?.error).toBeUndefined();
    expect(component?.reactComponentMeta?.props?.children?.required).toBe(true);
    expect(component?.reactComponentMeta?.props?.emphasis).toMatchObject({
      type: { name: 'enum', value: [{ value: '"low"' }, { value: '"high"' }] },
    });
  }, 30000);
});
