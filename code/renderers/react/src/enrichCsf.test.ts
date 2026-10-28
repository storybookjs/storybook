import { expect, test } from 'vitest';

import { formatCsf, loadCsf } from '@storybook/core/internal/csf-tools';

import { dedent } from 'ts-dedent';

import { createCsfEnricher } from './enrichCsf.ts';

test('should enrich csf with code parameters', async () => {
  const enrichCsf = createCsfEnricher({ experimentalCodeExamples: true });

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
  expect(formatCsf(csf)).toMatchInlineSnapshot(`
    "import preview from '#.storybook/preview';
    import { Button } from './Button';

    const meta = preview.meta({ component: Button })

    export const Primary = meta.story({ args: { primary: true,  label: 'Button' } });
    export const Secondary = meta.story({ args: { label: 'Button' } });
    Primary.input.parameters = { ...Primary.input.parameters, docs: { ...Primary.input.parameters?.docs, source: { code: "const Primary = () => <Button primary label=\\"Button\\" />;\\n", ...Primary.input.parameters?.docs?.source } } };
    Secondary.input.parameters = { ...Secondary.input.parameters, docs: { ...Secondary.input.parameters?.docs, source: { code: "const Secondary = () => <Button label=\\"Button\\" />;\\n", ...Secondary.input.parameters?.docs?.source } } };"
  `);
});

test('should not enrich when experimentalCodeExamples is disabled', async () => {
  const enrichCsf = createCsfEnricher({ experimentalCodeExamples: false });

  const code = dedent`
    import preview from '#.storybook/preview';
    import { Button } from './Button';
    const meta = preview.meta({ component: Button })
    export const Primary = meta.story({ args: { primary: true,  label: 'Button' } });
  `;
  const csf = loadCsf(code, { makeTitle: (x) => x ?? 'title' });
  csf.parse();
  await enrichCsf?.(csf, csf);
  expect(formatCsf(csf)).toMatchInlineSnapshot(`
    "import preview from '#.storybook/preview';
    import { Button } from './Button';
    const meta = preview.meta({ component: Button })
    export const Primary = meta.story({ args: { primary: true,  label: 'Button' } });"
  `);
});
