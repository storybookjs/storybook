import { describe, expect, it } from 'vitest';

import { loadConfig } from 'storybook/internal/csf-tools';

import { ComponentSubtitleMigrationError } from './component-subtitle-transform.ts';
import { transformPreviewSource, transformStorySource } from './component-subtitle.ts';

describe('component-subtitle', () => {
  it('rejects a falsy story subtitle that would hide a migrated meta fallback', () => {
    expect(() =>
      transformStorySource(`
      export default { parameters: { componentSubtitle: 'Inherited' } };
      export const Primary = { parameters: { docs: { subtitle: '' } } };
    `)
    ).toThrow('falsy parameters.docs.subtitle');
  });

  it('rejects a falsy meta subtitle that would hide a migrated preview fallback', () => {
    expect(() =>
      transformStorySource(`export default { parameters: { docs: { subtitle: '' } } };`, {
        subtitleCanWin: false,
        legacySubtitle: true,
      })
    ).toThrow('falsy parameters.docs.subtitle');
  });

  it('migrates local fallbacks consistently across meta and stories', () => {
    const transformed = transformStorySource(`
      export default { parameters: { componentSubtitle: 'Meta' } };
      export const Primary = { parameters: { componentSubtitle: 'Story' } };
    `);
    expect(transformed).not.toContain('componentSubtitle');
    expect(transformed).toContain("subtitle: 'Meta'");
    expect(transformed).toContain("subtitle: 'Story'");
  });

  it('rejects conflicting parameters inherited from a CSF factory story', () => {
    expect(() =>
      transformStorySource(`
      import preview from './preview';
      const meta = preview.meta({});
      export const Base = meta.story({ parameters: { docs: { subtitle: 'Inherited' } } });
      export const Extended = Base.extend({ parameters: { componentSubtitle: 'Legacy' } });
    `)
    ).toThrow('Story inheritance changes parameters');
  });

  it('rejects a falsy subtitle that would hide a migrated base story fallback', () => {
    expect(() =>
      transformStorySource(`
      import preview from './preview';
      const meta = preview.meta({});
      export const Base = meta.story({ parameters: { componentSubtitle: 'Inherited' } });
      export const Extended = Base.extend({ parameters: { docs: { subtitle: '' } } });
    `)
    ).toThrow('Story inheritance changes parameters');
  });

  it('moves a meta componentSubtitle value to docs.subtitle', () => {
    const transformed = transformStorySource(`
        export default {
          component: Button,
          parameters: { componentSubtitle: subtitle }
        };
      `);
    expect(transformed).toContain('subtitle: subtitle');
    expect(transformed).not.toContain('componentSubtitle');
  });

  it('moves a componentSubtitle value from an identifier meta', () => {
    const transformed = transformStorySource(`
      const meta = {
        component: Button,
        parameters: { componentSubtitle: 'Legacy' }
      } satisfies Meta;
      export default meta;
    `);

    expect(transformed).toContain("subtitle: 'Legacy'");
    expect(transformed).not.toContain('componentSubtitle');
  });

  it('migrates a separately exported story through CSF discovery', () => {
    expect(
      transformStorySource(`
        export default { component: Button };
        const Primary = { parameters: { componentSubtitle: 'Legacy' } };
        export { Primary };
      `)
    ).toContain('subtitle:');
  });

  it('adds subtitle to an existing docs object in a story', () => {
    expect(
      transformStorySource(`
        export default { component: Button };
        export const Primary = {
          parameters: {
            componentSubtitle: 'Legacy',
            docs: { source: { type: 'code' } }
          }
        };
      `)
    ).toContain("subtitle: 'Legacy'");
  });

  it('migrates CSF2 story annotations', () => {
    const transformed = transformStorySource(`
        export default { component: Button };
        export const Primary = () => null;
        Primary.parameters = {
          componentSubtitle: 'Legacy'
        };
      `);

    expect(transformed).toContain("subtitle: 'Legacy'");
    expect(transformed).not.toContain('componentSubtitle');
  });

  it('migrates CSF4 story objects', () => {
    const transformed = transformStorySource(`
        import preview from './preview';
        const meta = preview.meta({ component: Button });
        export const Primary = meta.story({
          parameters: { componentSubtitle: 'Legacy' }
        });
      `);

    expect(transformed).toContain("subtitle: 'Legacy'");
    expect(transformed).not.toContain('componentSubtitle');
  });

  it.each([
    ['Current', 'Current'],
    ['', 'Legacy'],
  ])('preserves the old docs.subtitle precedence for %j', (subtitle, expected) => {
    const transformed = transformStorySource(`export default { parameters: {
      componentSubtitle: 'Legacy', docs: { subtitle: ${JSON.stringify(subtitle)} }
    } };`);
    const config = loadConfig(transformed!).parse();
    expect(config.getValue(['parameters', 'docs', 'subtitle'])).toBe(expected);
    expect(config.get(['parameters', 'componentSubtitle'])).toBeUndefined();
  });

  it('migrates preview parameters', () => {
    expect(
      transformPreviewSource(`
        export default {
          parameters: { componentSubtitle: 'Preview subtitle' }
        };
      `)
    ).toContain("subtitle: 'Preview subtitle'");
  });

  it('migrates static computed keys without creating duplicate docs fields', () => {
    const transformed = transformStorySource(`
      export default {
        parameters: {
          ['componentSubtitle']: 'Legacy',
          ['docs']: { ['subtitle']: '' }
        }
      };
    `);

    expect(transformed).not.toContain('componentSubtitle');
    expect(loadConfig(transformed!).parse().getValue(['parameters', 'docs', 'subtitle'])).toBe(
      'Legacy'
    );
    expect(transformed?.match(/\['docs'\]/g)).toHaveLength(1);
  });

  it('ignores componentSubtitle text in a preview comment', () => {
    expect(
      transformPreviewSource(`
        // parameters.componentSubtitle was removed
        export default { parameters: {} };
      `)
    ).toBeNull();
  });

  it('rejects dynamic docs.subtitle precedence', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            componentSubtitle: 'Legacy',
            docs: { subtitle: getSubtitle() }
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a story migration when an inherited subtitle can win', () => {
    expect(() =>
      transformStorySource(`
        export default { parameters: { docs: { subtitle: 'Meta subtitle' } } };
        export const Primary = {
          parameters: { componentSubtitle: 'Story subtitle' }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a meta migration when a preview subtitle can win', () => {
    expect(() =>
      transformStorySource(
        `export default { parameters: { componentSubtitle: 'Meta subtitle' } };`,
        { subtitleCanWin: true, legacySubtitle: false }
      )
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a story migration when meta parameters are indirect', () => {
    expect(() =>
      transformStorySource(`
        const parameters = { docs: { subtitle: 'Meta subtitle' } };
        export default { parameters };
        export const Primary = {
          parameters: { componentSubtitle: 'Story subtitle' }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects side-effectful componentSubtitle expressions', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            componentSubtitle: registerSubtitle(),
            docs: { subtitle: 'Current' }
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('ignores unrelated component props with the same name', () => {
    expect(
      transformStorySource(`
        export default { component: Button };
        export const Primary = { args: { componentSubtitle: 'A component prop' } };
      `)
    ).toBeNull();
  });

  it('reports uninspectable parameters instead of guessing whether a legacy value exists', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: getParameters({ args: { componentSubtitle: 'A component prop' } })
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects spread parameters', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            ...parameters,
            componentSubtitle: 'Legacy'
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a componentSubtitle declared only through a parameters spread', () => {
    expect(() =>
      transformStorySource(`
        const legacyParameters = { componentSubtitle: 'Legacy' };
        export default {
          parameters: { ...legacyParameters }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a componentSubtitle inside a conditional parameters spread', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            ...(enabled ? { componentSubtitle: 'Legacy' } : {})
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects an unresolvable parameters spread containing a structural candidate', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            ...getParameters({ componentSubtitle: 'Legacy' })
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('follows parameter spread aliases and terminates cyclic aliases', () => {
    expect(() =>
      transformStorySource(`
        const legacyParameters = { componentSubtitle: 'Legacy' };
        const parametersAlias = legacyParameters;
        const secondAlias = parametersAlias;
        export default { parameters: { ...secondAlias } };
      `)
    ).toThrow(ComponentSubtitleMigrationError);

    expect(
      transformStorySource(`
        const firstAlias = secondAlias;
        const secondAlias = firstAlias;
        export default { parameters: { ...firstAlias } };
      `)
    ).toBeNull();
  });

  it('rejects componentSubtitle accessors and methods', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            get componentSubtitle() { return 'Legacy'; }
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);

    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            componentSubtitle() { return 'Legacy'; }
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('classifies parameters methods and accessors only when their bodies contain a candidate', () => {
    expect(
      transformStorySource(`
        export default {
          parameters() { return { backgrounds: {} }; }
        };
      `)
    ).toBeNull();

    expect(() =>
      transformStorySource(`
        export default {
          get parameters() {
            return { componentSubtitle: 'Legacy' };
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);

    expect(() =>
      transformStorySource(`
        export default {
          parameters: getParameters({ componentSubtitle: 'Legacy' })
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);

    expect(
      transformStorySource(`
        export default {
          parameters: getParameters({ backgrounds: {} })
        };
      `)
    ).toBeNull();
  });

  it('rejects a docs.subtitle accessor', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            componentSubtitle: 'Legacy',
            docs: {
              get subtitle() { return 'Current'; }
            }
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a story migration when an inherited docs.subtitle is an accessor', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            docs: {
              get subtitle() { return 'Meta subtitle'; }
            }
          }
        };
        export const Primary = {
          parameters: { componentSubtitle: 'Story subtitle' }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('classifies unresolved computed parameters keys only with structural evidence', () => {
    expect(() =>
      transformStorySource(`
        const parameterName = getParameterName();
        export default {
          [parameterName]: { componentSubtitle: 'Legacy' }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);

    expect(
      transformStorySource(`
        const parameterName = getParameterName();
        export default {
          [parameterName]: { backgrounds: {} }
        };
      `)
    ).toBeNull();
  });

  it('rejects a componentSubtitle spread inside a wrapped preview export', () => {
    expect(() =>
      transformPreviewSource(`
        const legacyParameters = { componentSubtitle: 'Legacy' };
        export default definePreview({
          parameters: { ...legacyParameters }
        });
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('migrates a uniquely referenced parameters object', () => {
    expect(
      transformStorySource(`
        const parameters = { componentSubtitle: 'Legacy' };
        export default { parameters };
      `)
    ).toContain('subtitle:');
  });

  it('rejects top-level spread composition that can hide subtitle parameters', () => {
    expect(() =>
      transformStorySource(`
        const base = { parameters: { docs: { subtitle: 'Meta' } } };
        export default { ...base };
        export const Primary = {
          parameters: { componentSubtitle: 'Legacy' }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a conditional root spread containing a structural candidate', () => {
    expect(() =>
      transformStorySource(`
        export default {
          ...(enabled ? { parameters: { componentSubtitle: 'Legacy' } } : {})
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a spread-only direct story export', () => {
    expect(() =>
      transformStorySource(`
        const base = { parameters: { componentSubtitle: 'Legacy' } };
        export default {};
        export const Primary = { ...base };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });
});
