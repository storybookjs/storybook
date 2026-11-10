import { describe, expect, it } from 'vitest';

import { resolve } from 'pathe';
import { dedent } from 'ts-dedent';

import { loadSvelteCsf } from './svelte-csf-file.ts';

// A real directory, so the project's `svelte/compiler` resolves from it
const id = resolve(__dirname, 'Button.stories.svelte');

describe('loadSvelteCsf', () => {
  it('finds the meta, the stories, their attributes and the stories they extend', async () => {
    const code = dedent`
      <script module lang="ts">
        import { defineMeta } from '@storybook/sveltekit';
        const { Story: S } = defineMeta({ title: 'Button' });
      </script>

      <script>
        let count = 0;
      </script>

      <S name="Base" parameters={{ layout: 'centered' }} />
      <S name="Child" extend="Base" {...rest} />
      <S name="Grandchild" extend={'Child'} />
      <S name="A" extend="B" />
      <S name="B" extend="A" />
      <Story name="Not this meta's" />
    `;
    const file = await loadSvelteCsf(code, id);

    expect(file.lang).toBe('ts');
    expect(file.meta?.storyName).toBe('S');
    expect(file.meta?.object?.properties).toHaveLength(1);
    expect(file.stories.map(({ name, ancestors }) => [name, ancestors])).toEqual([
      ['Base', []],
      ['Child', ['Base']],
      ['Grandchild', ['Child', 'Base']],
      ['A', ['B']],
      ['B', ['A']],
    ]);
    expect(file.stories.map(({ spreads }) => spreads)).toEqual([false, true, false, false, false]);

    const parameters = file.stories[0].attributes.get('parameters')!;
    expect(
      code.slice(parameters.toFile(parameters.node.start), parameters.toFile(parameters.node.end))
    ).toBe("{ layout: 'centered' }");
    const { module, instance } = file;
    expect(code.slice(module!.toFile(0), module!.toFile(module!.editor.code.length))).toBe(
      module!.editor.code
    );
    expect(instance!.editor.code.trim()).toBe('let count = 0;');
  });

  it('reads `preview.meta()` only from a preview file', async () => {
    const meta = async (source: string) =>
      (
        await loadSvelteCsf(
          dedent`
            <script module>
              import preview from '${source}';
              const { Story } = preview.meta({});
            </script>
          `,
          id
        )
      ).meta;

    expect(await meta('#.storybook/preview')).toBeDefined();
    expect(await meta('../.storybook/preview.ts')).toBeDefined();
    expect(await meta('./theme')).toBeUndefined();
  });

  it('puts the edits back and keeps the rest of the file as written', async () => {
    const code = dedent`
      <script module>
        import { defineMeta } from '@storybook/sveltekit';
        const { Story } = defineMeta({});
      </script>

      <Story name="Shorthand" {beforeEach} />
      <Story
        name="Own lines"
        parameters={{ a: 1 }}
        tags={['x']}
      />
      <Story name="Same line" parameters={{ a: 1 }} />
      <Story name="Removed"  parameters={{ a: 1 }} />
    `;
    const file = await loadSvelteCsf(code, id);
    const [shorthand, ownLines, sameLine, removed] = file.stories;
    const { editor, node } = shorthand.attributes.get('beforeEach')!;
    editor.edits.overwrite(node.start, node.end, '[setup, beforeEach]');
    file.module!.editor.edits.appendLeft(file.module!.editor.code.length, '  const x = 1;\n');
    ownLines.attributes.get('parameters')!.insertAfter('beforeEach', '() => {\n  setup();\n}');
    sameLine.attributes.get('parameters')!.replaceWith('beforeEach', '() => {\n  setup();\n}');
    removed.attributes.get('parameters')!.remove();

    expect(file.toString()).toBe(dedent`
      <script module>
        import { defineMeta } from '@storybook/sveltekit';
        const { Story } = defineMeta({});
        const x = 1;
      </script>

      <Story name="Shorthand" beforeEach={[setup, beforeEach]} />
      <Story
        name="Own lines"
        parameters={{ a: 1 }}
        beforeEach={() => {
          setup();
        }}
        tags={['x']}
      />
      <Story name="Same line" beforeEach={() => {
        setup();
      }} />
      <Story name="Removed" />
    `);
    expect(file.markup()).not.toContain('defineMeta');
    expect(file.markup()).toContain('beforeEach={[setup, beforeEach]}');
  });

  it('finds a pattern outside the parsed code and the HTML comments', async () => {
    const code = dedent`
      <script module>
        import { defineMeta } from '@storybook/sveltekit';
        const { Story } = defineMeta({ parameters: { key: 1 } });
      </script>

      <!-- key -->
      <Story name="A" parameters={{ key: 2 }} />
      <p>key</p>
    `;
    const file = await loadSvelteCsf(code, id);

    expect(file.unparsed(/\bkey\b/g)).toEqual([code.lastIndexOf('key')]);
  });
});
