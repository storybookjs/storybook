import { expect, test, type Locator, type Page } from '@playwright/test';
import process from 'process';

import { SbPage } from './util.ts';

/** A Controls panel interaction, keyed by the Playwright action it performs. */
type ControlInput =
  | { fill: string }
  | { check: true }
  | { click: true }
  | { selectOption: string[] };

/** What the edited `<demo-wc-counter>` shows, on the host or on a shadow part. */
type CounterOutput =
  | { attribute: string; value: string }
  | { lightDomText: string }
  | { part: string; text: string | RegExp }
  | { part: string; attribute: string; value: string }
  | { part: string; css: string; value: string };

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME;

const COUNTER_TITLE = 'stories/renderers/web-components_lit-vite-default-ts/demo-wc-counter';

const TABLE_CATEGORIES = [
  'attributes',
  'properties',
  'events',
  'methods',
  'slots',
  'css shadow parts',
  'css states',
  'css custom properties',
];

const CONTROL_KINDS: { arg: string; kind: string; selector: string }[] = [
  { arg: 'count', kind: 'number', selector: 'input[type="number"]#control-count' },
  { arg: 'disabled', kind: 'boolean', selector: 'input[type="checkbox"]#control-disabled' },
  { arg: 'label', kind: 'text', selector: 'textarea#control-label' },
  { arg: 'size', kind: 'radio', selector: 'input[type="radio"][name="control-size"]' },
  { arg: 'tone', kind: 'select', selector: 'select#control-tone:not([multiple])' },
  { arg: 'badges', kind: 'multi-select', selector: 'select#control-badges[multiple]' },
  { arg: 'deadline', kind: 'date', selector: 'input[type="date"]#control-deadline-date' },
  {
    arg: '--demo-wc-counter-accent',
    kind: 'color',
    selector: '#control---demo-wc-counter-accent[placeholder="Choose color..."]',
  },
  {
    arg: '--demo-wc-counter-badge-opacity',
    kind: 'number',
    selector: 'input[type="number"]#control---demo-wc-counter-badge-opacity',
  },
  { arg: 'default-slot', kind: 'text', selector: 'textarea#control-default-slot' },
  { arg: 'value-part', kind: 'text', selector: 'textarea#control-value-part' },
  { arg: 'at-max-state', kind: 'text', selector: 'textarea#control-at-max-state' },
];

const NO_CONTROL_ROWS: { arg: string; reason: string; row: RegExp }[] = [
  { arg: 'count-changed', reason: 'event', row: /^count-changed/ },
  { arg: 'increment', reason: 'method', row: /^increment/ },
  { arg: 'atMax', reason: 'readonly property', row: /^atMax/ },
];

const CONTROL_EDITS: {
  arg: string;
  control: string;
  input: ControlInput;
  expected: CounterOutput;
}[] = [
  {
    arg: 'count',
    control: '#control-count',
    input: { fill: '7' },
    expected: { part: 'value', text: '7 stars' },
  },
  {
    arg: 'disabled',
    control: 'label[aria-label="disabled"]',
    input: { click: true },
    expected: { attribute: 'disabled', value: '' },
  },
  {
    arg: 'label',
    control: '#control-label',
    input: { fill: 'Vote' },
    expected: { part: 'button', attribute: 'aria-label', value: 'Vote' },
  },
  {
    arg: 'size',
    control: 'input[name="control-size"][value="large"]',
    input: { check: true },
    expected: { attribute: 'size', value: 'large' },
  },
  {
    arg: 'tone',
    control: 'select#control-tone',
    input: { selectOption: ['danger'] },
    expected: { attribute: 'tone', value: 'danger' },
  },
  {
    arg: 'badges',
    control: 'select#control-badges',
    input: { selectOption: ['hot'] },
    expected: { part: 'badge', text: 'hot' },
  },
  {
    arg: 'deadline',
    control: '#control-deadline-date',
    input: { fill: '2027-01-15' },
    // The date control keeps the local time of day, so the UTC day can shift by one.
    expected: { part: 'deadline', text: /^2027-01-1[456]$/ },
  },
  {
    arg: 'default-slot',
    control: '#control-default-slot',
    input: { fill: 'Votes' },
    expected: { lightDomText: 'Votes' },
  },
  {
    arg: 'value-part',
    control: '#control-value-part',
    input: { fill: 'color: rgb(0, 0, 255);' },
    expected: { part: 'value', css: 'color', value: 'rgb(0, 0, 255)' },
  },
  {
    arg: '--demo-wc-counter-accent',
    control: '#control---demo-wc-counter-accent',
    input: { fill: 'rgb(0, 128, 0)' },
    expected: { part: 'button', css: 'background-color', value: 'rgb(0, 128, 0)' },
  },
  {
    arg: '--demo-wc-counter-badge-opacity',
    control: '#control---demo-wc-counter-badge-opacity',
    input: { fill: '0.25' },
    expected: { part: 'badge', css: 'opacity', value: '0.25' },
  },
];

const DOCS_ROWS: { row: RegExp; expected: string }[] = [
  { row: /count-changed/, expected: 'Fires after the count changes' },
  { row: /--demo-wc-counter-accent/, expected: 'rgb(0, 95, 204)' },
  { row: /at-max/, expected: 'Set while the count has reached max' },
];

test.describe('Web Components docgen server', () => {
  test.skip(
    templateName !== 'lit-vite/default-ts',
    'Only lit-vite/default-ts runs the Web Components docgen server'
  );

  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test('Controls panel groups args by manifest category', async ({ page }) => {
    const { panel } = await openControls(page);

    for (const category of TABLE_CATEGORIES) {
      await expect(
        panel.getByRole('button', { name: `Hide ${category} items` }).first()
      ).toBeVisible();
    }
  });

  for (const { arg, kind, selector } of CONTROL_KINDS) {
    test(`${arg} renders a ${kind} control`, async ({ page }) => {
      const { panel } = await openControls(page);

      await expect(panel.locator(selector).first()).toBeVisible();
    });
  }

  test('tone lists its 6 options plus the empty choice', async ({ page }) => {
    const { panel } = await openControls(page);

    await expect(panel.locator('select#control-tone option')).toHaveCount(7);
  });

  test('unit renders an object editor', async ({ page }) => {
    const { panel } = await openControls(page);

    await expect(panel.getByRole('row', { name: /^unit/ }).locator('.rejt-tree')).toBeVisible();
  });

  for (const { arg, reason, row } of NO_CONTROL_ROWS) {
    test(`${arg} (${reason}) renders no control`, async ({ page }) => {
      const { panel } = await openControls(page);

      const control = panel.getByRole('row', { name: row }).locator('td').last();
      await expect(control).toContainText('-');
      await expect(control.locator('input, select, textarea')).toHaveCount(0);
    });
  }

  for (const { arg, control, input, expected } of CONTROL_EDITS) {
    test(`editing ${arg} with ${JSON.stringify(input)} updates the element`, async ({ page }) => {
      const { panel, counter } = await openControls(page);

      await applyInput(panel.locator(control), input);
      await expect(() => assertOutput(counter, expected)).toPass({ timeout: 10_000 });
    });
  }

  test('event args log to the Actions panel', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory(COUNTER_TITLE, 'events');
    await sbPage.viewAddonPanel('Actions');

    await sbPage.previewRoot().locator('demo-wc-counter [part="button"]').click();

    await expect(
      sbPage.panelContent().locator('span', { hasText: 'count-changed-event:' })
    ).toBeVisible();
  });

  for (const { row, expected } of DOCS_ROWS) {
    test(`docs ArgTypes row ${row} shows "${expected}"`, async ({ page }) => {
      const sbPage = new SbPage(page, expect);
      await sbPage.deepLinkToStory(storybookUrl, COUNTER_TITLE, 'docs');

      const argsTable = sbPage.previewRoot().locator('.docblock-argstable').first();
      await expect(argsTable.getByRole('row', { name: row })).toContainText(expected);
    });
  }
});

async function openControls(page: Page): Promise<{ panel: Locator; counter: Locator }> {
  const sbPage = new SbPage(page, expect);
  await sbPage.navigateToStory(COUNTER_TITLE, 'all-categories');
  await sbPage.viewAddonPanel('Controls');

  return {
    panel: sbPage.panelContent(),
    counter: sbPage.previewRoot().locator('demo-wc-counter'),
  };
}

async function applyInput(control: Locator, input: ControlInput): Promise<void> {
  if ('fill' in input) {
    await control.fill(input.fill);
  } else if ('check' in input) {
    await control.check();
  } else if ('click' in input) {
    await control.click();
  } else {
    await control.selectOption(input.selectOption);
  }
}

async function assertOutput(counter: Locator, expected: CounterOutput): Promise<void> {
  if ('lightDomText' in expected) {
    await expect(counter).toContainText(expected.lightDomText);
    return;
  }
  if (!('part' in expected)) {
    await expect(counter).toHaveAttribute(expected.attribute, expected.value);
    return;
  }

  const part = counter.locator(`[part="${expected.part}"]`);
  if ('text' in expected) {
    await expect(part).toHaveText(expected.text);
  } else if ('css' in expected) {
    await expect(part).toHaveCSS(expected.css, expected.value);
  } else {
    await expect(part).toHaveAttribute(expected.attribute, expected.value);
  }
}
