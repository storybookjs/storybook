import { describe, expect, it } from 'vitest';

import type { Template } from './sandbox-templates.ts';
import { docgenServerTemplates, enablesDocgenServer } from './sandbox-templates.ts';

const template = (mainConfig: Template['modifications']): Template =>
  ({ modifications: mainConfig }) as Template;

const bothFeatures = { experimentalDocgenServer: true, componentsManifest: true };

describe('enablesDocgenServer', () => {
  it('accepts features declared as an object', () => {
    expect(enablesDocgenServer(template({ mainConfig: { features: bothFeatures } }))).toBe(true);
  });

  it('accepts features declared as a function, which several templates use', () => {
    expect(enablesDocgenServer(template({ mainConfig: () => ({ features: bothFeatures }) }))).toBe(
      true
    );
  });

  it('requires both features, since experimentalDocgenServer alone writes no snapshots', () => {
    expect(
      enablesDocgenServer(
        template({ mainConfig: { features: { experimentalDocgenServer: true } } })
      )
    ).toBe(false);
    expect(
      enablesDocgenServer(template({ mainConfig: { features: { componentsManifest: true } } }))
    ).toBe(false);
  });

  it('rejects a template with no main config modifications', () => {
    expect(enablesDocgenServer({} as Template)).toBe(false);
  });

  it('rejects rather than throws when a mainConfig function reads the generated config', () => {
    // Most function-form templates call into the `ConfigFile` they are handed. They are not docgen
    // server templates, and probing them must not take the whole derivation down.
    const readsConfig = template({
      mainConfig: (config) => ({ stories: config.getFieldValue(['stories']) as string[] }),
    });

    expect(() => enablesDocgenServer(readsConfig)).not.toThrow();
    expect(enablesDocgenServer(readsConfig)).toBe(false);
  });
});

describe('docgenServerTemplates', () => {
  it('lists the templates that enable server docgen', () => {
    expect(docgenServerTemplates()).toContain('angular-vite/docgen-server-ts');
  });

  it('leaves out the stable Angular template, which still guards browser docgen', () => {
    expect(docgenServerTemplates()).not.toContain('angular-vite/default-ts');
  });
});
