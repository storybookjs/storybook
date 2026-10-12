import type { DocgenError } from 'storybook/internal/types';

import { mkdirSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import typescript from '@typescript/typescript6';
import { join } from 'pathe';
import { dirSync, type DirResult } from 'tmp';

import type { CemTag } from '../manifest/cem-manager.ts';
import { loadGenerator, type GeneratorAdapter } from './generator.ts';
import { GeneratorManager } from './generator-manager.ts';
import { GeneratorProject } from './generator-project.ts';
import { SourceManager } from './source-manager.ts';

vi.mock('./generator-project.ts', { spy: true });

const REPO_ROOT = process.cwd();

let generator: GeneratorAdapter;
let temp: DirResult;
let managers: SourceManager[];

beforeEach(async () => {
  const loaded = await loadGenerator();
  expect(loaded).toBeDefined();
  generator = loaded!;
  temp = dirSync({ unsafeCleanup: true });
  managers = [];
  vi.spyOn(process, 'cwd').mockReturnValue(temp.name);
  symlinkSync(join(REPO_ROOT, 'node_modules'), join(temp.name, 'node_modules'), 'dir');
});

afterEach(() => {
  for (const manager of managers) {
    manager.dispose();
  }
  temp.removeCallback();
  vi.restoreAllMocks();
});

const createManager = (previewFilePath?: string): SourceManager => {
  const manager = new SourceManager(typescript, generator, previewFilePath);
  managers.push(manager);
  return manager;
};

const file = (path: string, contents: string): string => {
  const absolutePath = join(temp.name, path);
  mkdirSync(join(absolutePath, '..'), { recursive: true });
  writeFileSync(absolutePath, contents);
  return absolutePath;
};

const tsconfig = (include: string[] = ['**/*.ts', '**/*.js']): void => {
  file(
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        allowJs: true,
        experimentalDecorators: true,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        skipLibCheck: true,
        target: 'ES2022',
      },
      include,
    })
  );
};

const story = (tag: string, imports: string = ''): string =>
  file(
    'input.stories.ts',
    `${imports}
     export default { title: 'Fixture', component: '${tag}' };`
  );

const litElement = (tag: string, className: string, body: string = ''): string => `
  import { LitElement, html } from 'lit';
  import { customElement, property } from 'lit/decorators.js';

  @customElement('${tag}')
  export class ${className} extends LitElement {
    ${body}
    render() {
      return html\`\`;
    }
  }
`;

const hasDeclaration = (result: CemTag | DocgenError): result is CemTag => 'declaration' in result;

describe('SourceManager', () => {
  it.each([
    [
      'story imports a Lit TS element',
      () => {
        tsconfig();
        const elementPath = file(
          'x-card.ts',
          litElement(
            'x-card',
            'XCard',
            `
              /** Card label. */
              @property({ attribute: 'label' })
              label = 'Hello';
            `
          )
        );
        const storyPath = story('x-card', "import './x-card.ts';");
        return { tag: 'x-card', storyPath, elementPath, expectedAttribute: 'label' };
      },
    ],
    [
      'story imports a vanilla JS element with a tsconfig',
      () => {
        tsconfig();
        const elementPath = file(
          'js-card.js',
          `
            export class JsCard extends HTMLElement {}
            customElements.define('js-card', JsCard);
          `
        );
        const storyPath = story('js-card', "import './js-card.js';");
        return { tag: 'js-card', storyPath, elementPath, expectedAttribute: undefined };
      },
    ],
    [
      'story imports a vanilla JS element without a tsconfig',
      () => {
        const elementPath = file(
          'plain-card.js',
          `
            export class PlainCard extends HTMLElement {}
            customElements.define('plain-card', PlainCard);
          `
        );
        const storyPath = story('plain-card', "import './plain-card.js';");
        return { tag: 'plain-card', storyPath, elementPath, expectedAttribute: undefined };
      },
    ],
    [
      'story imports an element from a sibling folder without a tsconfig',
      () => {
        const elementPath = file(
          'elements/shared/twin-card.js',
          `
            export class TwinCard extends HTMLElement {}
            customElements.define('twin-card', TwinCard);
          `
        );
        const storyPath = file(
          'stories/shared/input.stories.js',
          `import '../../elements/shared/twin-card.js';
           export default { title: 'Fixture', component: 'twin-card' };`
        );
        return { tag: 'twin-card', storyPath, elementPath, expectedAttribute: undefined };
      },
    ],
  ])('%s', async (_name, setup) => {
    const { tag, storyPath, elementPath, expectedAttribute } = setup();
    const result = await createManager().find(tag, { storyFilePath: storyPath });

    expect(result).toMatchObject({
      manifestPath: elementPath.slice(temp.name.length + 1),
    });
    expect(hasDeclaration(result)).toBe(true);
    if (hasDeclaration(result) && expectedAttribute) {
      expect(result.declaration.attributes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            description: 'Card label.',
            name: expectedAttribute,
          }),
        ])
      );
    }
  });
  it('scans only the story folder when no tsconfig covers it', async () => {
    file(
      'elements/scan-card.js',
      "customElements.define('scan-card', class extends HTMLElement {});"
    );
    const storyPath = file(
      'stories/input.stories.js',
      `import '../elements/scan-card.js';
       export default { title: 'Fixture', component: 'scan-card' };`
    );
    const generate = vi.spyOn(generator, 'generate');

    await createManager().find('scan-card', { storyFilePath: storyPath });

    expect(generate.mock.calls[0][0]).toBe(join(temp.name, 'stories', 'tsconfig.json'));
  });
  it('uses the declaration module as the manifest path when another module defines the tag', async () => {
    tsconfig();
    const cardPath = file(
      'card.js',
      `
        export class CardElement extends HTMLElement {}
      `
    );
    file(
      'index.js',
      `
        import { CardElement } from './card.js';
        customElements.define('index-card', CardElement);
      `
    );
    const storyPath = story('index-card', "import './index.js';");

    await expect(
      createManager().find('index-card', { storyFilePath: storyPath })
    ).resolves.toMatchObject({
      manifestPath: cardPath.slice(temp.name.length + 1),
    });
  });
  it('flattens members from a base class in another file', async () => {
    tsconfig();
    file(
      'base.js',
      `
        export class BaseCard extends HTMLElement {
          /** Base label. */
          baseLabel = '';
        }
      `
    );
    const elementPath = file(
      'child-card.js',
      `
        import { BaseCard } from './base.js';

        export class ChildCard extends BaseCard {}
        customElements.define('child-card', ChildCard);
      `
    );
    const storyPath = story('child-card', "import './child-card.js';");

    const result = await createManager().find('child-card', { storyFilePath: storyPath });

    expect(result).toMatchObject({ manifestPath: elementPath.slice(temp.name.length + 1) });
    expect(hasDeclaration(result)).toBe(true);
    if (hasDeclaration(result)) {
      expect(result.declaration.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            inheritedFrom: expect.objectContaining({ name: 'BaseCard' }),
            name: 'baseLabel',
          }),
        ])
      );
    }
  });
  it('finds elements imported by the preview file', async () => {
    tsconfig();
    const elementPath = file('preview-card.ts', litElement('preview-card', 'PreviewCard'));
    const storyPath = story('preview-card');
    const previewPath = file('preview.ts', "import './preview-card.ts';");

    await expect(
      createManager(previewPath).find('preview-card', { storyFilePath: storyPath })
    ).resolves.toMatchObject({
      manifestPath: elementPath.slice(temp.name.length + 1),
    });
  });
  it('prefilters tsconfig roots by the tag literal', async () => {
    tsconfig();
    const elementPath = file('loose-card.ts', litElement('loose-card', 'LooseCard'));
    const storyPath = story('loose-card');

    await expect(
      createManager().find('loose-card', { storyFilePath: storyPath })
    ).resolves.toMatchObject({
      manifestPath: elementPath.slice(temp.name.length + 1),
    });
  });
  it('refreshes inferred member types when an imported declaration file changes', async () => {
    tsconfig();
    const declarationPath = file('value.d.ts', 'export declare function getValue(): string;');
    file(
      'typed-card.ts',
      `import { getValue } from './value.js';
      export class TypedCard extends HTMLElement { value = getValue(); }
      customElements.define('typed-card', TypedCard);`
    );
    const storyPath = story('typed-card', "import './typed-card.ts';");
    const manager = createManager();

    await expect(manager.find('typed-card', { storyFilePath: storyPath })).resolves.toMatchObject({
      declaration: {
        members: expect.arrayContaining([
          expect.objectContaining({ name: 'value', type: { text: 'string' } }),
        ]),
      },
    });

    writeFileSync(declarationPath, 'export declare function getValue(): number;');
    const changed = statSync(declarationPath);
    const mtime = new Date(changed.mtimeMs + 10);
    utimesSync(declarationPath, mtime, mtime);

    await expect(manager.find('typed-card', { storyFilePath: storyPath })).resolves.toMatchObject({
      declaration: {
        members: expect.arrayContaining([
          expect.objectContaining({ name: 'value', type: { text: 'number' } }),
        ]),
      },
    });
  });
  it('reports the story path for an unknown tag', async () => {
    tsconfig();
    const storyPath = story('missing-card');

    await expect(
      createManager().find('missing-card', { storyFilePath: storyPath })
    ).resolves.toMatchObject({
      name: 'tag-not-found',
      message: expect.stringContaining('input.stories.ts'),
    });
  });
  it('picks up an edited element on the next lookup', async () => {
    tsconfig();
    const elementPath = file(
      'refresh-card.ts',
      litElement(
        'refresh-card',
        'RefreshCard',
        `
          @property({ attribute: 'first' })
          first = '';
        `
      )
    );
    const storyPath = story('refresh-card', "import './refresh-card.ts';");
    const manager = createManager();

    await expect(manager.find('refresh-card', { storyFilePath: storyPath })).resolves.toMatchObject(
      {
        declaration: {
          attributes: expect.arrayContaining([expect.objectContaining({ name: 'first' })]),
        },
      }
    );

    writeFileSync(
      elementPath,
      litElement(
        'refresh-card',
        'RefreshCard',
        `
          @property({ attribute: 'first' })
          first = '';

          @property({ attribute: 'second' })
          second = '';
        `
      )
    );
    const changed = statSync(elementPath);
    const mtime = new Date(changed.mtimeMs + 10);
    utimesSync(elementPath, mtime, mtime);

    await expect(manager.find('refresh-card', { storyFilePath: storyPath })).resolves.toMatchObject(
      {
        declaration: {
          attributes: expect.arrayContaining([expect.objectContaining({ name: 'second' })]),
        },
      }
    );
  });
  it('resolves reused tags in the current story project', async () => {
    for (const name of ['FirstCard', 'SecondCard']) {
      file(
        `${name}/tsconfig.json`,
        JSON.stringify({ compilerOptions: { allowJs: true }, include: ['*.js'] })
      );
      file(
        `${name}/card.js`,
        `export class ${name} extends HTMLElement {}
        customElements.define('shared-card', ${name});`
      );
      file(
        `${name}/input.stories.js`,
        "import './card.js'; export default { component: 'shared-card' };"
      );
    }
    const manager = createManager();

    for (const name of ['FirstCard', 'SecondCard', 'FirstCard']) {
      await expect(
        manager.find('shared-card', { storyFilePath: join(temp.name, name, 'input.stories.js') })
      ).resolves.toMatchObject({ declaration: { name }, manifestPath: `${name}/card.js` });
    }
  });
  it('picks up an edited base class on the next lookup', async () => {
    tsconfig();
    const basePath = file('base.js', 'export class Base extends HTMLElement { first = ""; }');
    file(
      'child.js',
      `import { Base } from './base.js';
      export class Child extends Base {}
      customElements.define('cached-child', Child);`
    );
    const storyPath = story('cached-child', "import './child.js';");
    const manager = createManager();
    await manager.find('cached-child', { storyFilePath: storyPath });

    writeFileSync(basePath, 'export class Base extends HTMLElement { second = ""; }');
    const changed = statSync(basePath);
    const mtime = new Date(changed.mtimeMs + 10);
    utimesSync(basePath, mtime, mtime);

    await expect(manager.find('cached-child', { storyFilePath: storyPath })).resolves.toMatchObject(
      {
        declaration: {
          members: expect.arrayContaining([expect.objectContaining({ name: 'second' })]),
        },
      }
    );
  });

  it('regenerates from the remembered element root on a second lookup', async () => {
    tsconfig();
    const elementPath = file('remembered-card.ts', litElement('remembered-card', 'RememberedCard'));
    const storyPath = story('remembered-card', "import './remembered-card.ts';");
    const manager = createManager();

    await manager.find('remembered-card', { storyFilePath: storyPath });
    vi.mocked(GeneratorProject.prototype.createManifestForRoots).mockClear();
    await manager.find('remembered-card', { storyFilePath: storyPath });

    expect(GeneratorProject.prototype.createManifestForRoots).toHaveBeenCalledTimes(1);
    expect(GeneratorProject.prototype.createManifestForRoots).toHaveBeenCalledWith([elementPath]);
  });

  it('matches a JavaScript story to a tsconfig that does not set allowJs', () => {
    const configPath = file(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler' } })
    );
    const storyPath = file('input.stories.js', "export default { component: 'js-story-card' };");
    const manager = new GeneratorManager(typescript, generator);

    try {
      expect(manager.getProjectForFile(storyPath).configFileName).toBe(configPath);
    } finally {
      manager.dispose();
    }
  });

  it('does not regenerate when a story asks again for a tag that missed', async () => {
    tsconfig();
    const storyPath = story('library-card');
    const manager = createManager();
    const generations = (): number =>
      vi.mocked(GeneratorProject.prototype.createManifestForRoots).mock.calls.length;

    await manager.find('library-card', { storyFilePath: storyPath });
    const afterFirstMiss = generations();
    await manager.find('library-card', { storyFilePath: storyPath });

    expect(generations()).toBe(afterFirstMiss);
  });

  it('does not rescan files that mention a tag another story already missed', async () => {
    tsconfig();
    const mentionPath = file('mention.ts', "export const tag = 'library-card';");
    const firstStoryPath = story('library-card');
    const secondStoryPath = file(
      'second.stories.ts',
      "export default { title: 'Second', component: 'library-card' };"
    );
    const manager = createManager();
    const generationsFromMention = (): number =>
      vi
        .mocked(GeneratorProject.prototype.createManifestForRoots)
        .mock.calls.filter(([roots]) => roots.includes(mentionPath)).length;

    await manager.find('library-card', { storyFilePath: firstStoryPath });
    await manager.find('library-card', { storyFilePath: secondStoryPath });

    expect(generationsFromMention()).toBe(1);
  });

  it('finds a tag defined after an earlier miss once the watcher reports the new file', async () => {
    tsconfig();
    const storyPath = story('late-card');
    const manager = createManager();
    await expect(manager.find('late-card', { storyFilePath: storyPath })).resolves.toMatchObject({
      name: 'tag-not-found',
    });

    file('late-card.ts', litElement('late-card', 'LateCard'));

    await vi.waitFor(
      async () => {
        await expect(
          manager.find('late-card', { storyFilePath: storyPath })
        ).resolves.toMatchObject({ declaration: { name: 'LateCard' } });
      },
      { timeout: 5000, interval: 100 }
    );
  });
});
