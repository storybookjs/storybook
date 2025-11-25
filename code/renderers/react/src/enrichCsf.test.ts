import { expect, test, vi } from 'vitest';

import { generate } from 'storybook/internal/babel';
import { type InterPresetOptions, getPresets } from 'storybook/internal/common';
import { loadCsf } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import { enrichCsf } from './enrichCsf';

vi.mock('my-preset', () => ({
  default: { experimental_enrichCsf: enrichCsf, features: { experimentalCodeExamples: true } },
}));

test('should enrich csf with code parameters', async () => {
  const presets = await getPresets(['my-preset'], { isCritical: true } as InterPresetOptions);
  const enrichCsf = await presets.apply('experimental_enrichCsf');

  const code = dedent`
    import preview from '#.storybook/preview';
    import { Button } from './Button';
    
    const meta = preview.meta({ component: Button })
    
    export const Primary = meta.story({ args: { primary: true,  label: 'Button' } });
    export const Secondary = meta.story({ args: { label: 'Button' } });
  `;
  const csf = loadCsf(code, { makeTitle: (x) => x ?? 'title' });
  csf.parse();
  await enrichCsf?.(csf, csf);
  expect(generate(csf._ast).code).toMatchInlineSnapshot(`
    "import preview from '#.storybook/preview';
    import { Button } from './Button';
    const meta = preview.meta({
      component: Button
    });
    export const Primary = meta.story({
      args: {
        primary: true,
        label: 'Button'
      }
    });
    export const Secondary = meta.story({
      args: {
        label: 'Button'
      }
    });
    Primary.input.parameters = {
      ...Primary.input.parameters,
      docs: {
        ...Primary.input.parameters?.docs,
        source: {
          code: "const Primary = () => <Button primary label=\\"Button\\"></Button>;\\n",
          ...Primary.input.parameters?.docs?.source
        }
      }
    };
    Secondary.input.parameters = {
      ...Secondary.input.parameters,
      docs: {
        ...Secondary.input.parameters?.docs,
        source: {
          code: "const Secondary = () => <Button label=\\"Button\\"></Button>;\\n",
          ...Secondary.input.parameters?.docs?.source
        }
      }
    };"
  `);
});

test('should not enrich when experimentalCodeExamples is disabled', async () => {
  // @ts-expect-error module does not exist
  vi.spyOn((await import('my-preset')).default, 'features', 'get').mockImplementation(() => ({
    experimentalCodeExamples: false,
  }));
  const presets = await getPresets(['my-preset'], { isCritical: true } as InterPresetOptions);
  const enrichCsf = await presets.apply('experimental_enrichCsf');

  const code = dedent`
    import preview from '#.storybook/preview';
    import { Button } from './Button';
    const meta = preview.meta({ component: Button })
    export const Primary = meta.story({ args: { primary: true,  label: 'Button' } });
  `;
  const csf = loadCsf(code, { makeTitle: (x) => x ?? 'title' });
  csf.parse();
  await enrichCsf?.(csf, csf);
  expect(generate(csf._ast).code).toMatchInlineSnapshot(`
    "import preview from '#.storybook/preview';
    import { Button } from './Button';
    const meta = preview.meta({
      component: Button
    });
    export const Primary = meta.story({
      args: {
        primary: true,
        label: 'Button'
      }
    });"
  `);
});
