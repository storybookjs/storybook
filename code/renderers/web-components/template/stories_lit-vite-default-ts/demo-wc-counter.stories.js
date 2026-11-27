import { expect, fn, userEvent, waitFor } from 'storybook/test';

import './demo-wc-counter';

/**
 * Every story uses the default render, which binds each arg by the category its key encodes in the
 * Custom Elements Manifest: attributes and properties, `-event`, `-slot`, `-part`, `-state`, and
 * `--` CSS custom properties.
 */
export default {
  component: 'demo-wc-counter',
  tags: ['autodocs'],
};

export const Attributes = {
  args: { count: 3, step: 2, disabled: true },
  play: async ({ canvasElement }) => {
    const counter = canvasElement.querySelector('demo-wc-counter');
    await counter.updateComplete;

    await expect(counter).toHaveAttribute('count', '3');
    await expect(counter).toHaveAttribute('disabled');
    await expect(counter.shadowRoot.querySelector('[part="value"]')).toHaveTextContent('3 clicks');
    await expect(counter.shadowRoot.querySelector('[part="button"]')).toBeDisabled();
    await expect(counter.shadowRoot.querySelector('[part="button"]')).toHaveTextContent('+2');
  },
};

export const BooleanAttributeOff = {
  args: { disabled: false },
  play: async ({ canvasElement }) => {
    const counter = canvasElement.querySelector('demo-wc-counter');
    await counter.updateComplete;

    await expect(counter).not.toHaveAttribute('disabled');
    await expect(counter.shadowRoot.querySelector('[part="button"]')).toBeEnabled();
  },
};

export const EnumAttribute = {
  args: { size: 'large' },
  play: async ({ canvasElement }) => {
    const counter = canvasElement.querySelector('demo-wc-counter');
    await counter.updateComplete;

    const button = counter.shadowRoot.querySelector('[part="button"]');
    await expect(counter).toHaveAttribute('size', 'large');
    await expect(getComputedStyle(button).fontSize).toBe('20px');
    await expect(getComputedStyle(button).paddingTop).toBe('8px');
  },
};

export const TextAttribute = {
  args: { label: 'Add a point' },
  play: async ({ canvasElement }) => {
    const counter = canvasElement.querySelector('demo-wc-counter');
    await counter.updateComplete;

    await expect(counter.label).toBe('Add a point');
    await expect(counter.shadowRoot.querySelector('[part="button"]')).toHaveAccessibleName(
      'Add a point'
    );
  },
};

export const SelectAttribute = {
  args: { tone: 'danger' },
  play: async ({ canvasElement }) => {
    const counter = canvasElement.querySelector('demo-wc-counter');
    await counter.updateComplete;

    const value = counter.shadowRoot.querySelector('[part="value"]');
    await expect(counter).toHaveAttribute('tone', 'danger');
    await expect(getComputedStyle(value).color).toBe('rgb(220, 20, 60)');
  },
};

export const Properties = {
  args: { count: 1, unit: { singular: 'point', plural: 'points' } },
  play: async ({ canvasElement }) => {
    const counter = canvasElement.querySelector('demo-wc-counter');
    await counter.updateComplete;

    await expect(counter.unit).toEqual({ singular: 'point', plural: 'points' });
    await expect(counter.shadowRoot.querySelector('[part="value"]')).toHaveTextContent('1 point');
  },
};

export const ArrayProperty = {
  args: { badges: ['new', 'hot'] },
  play: async ({ args, canvasElement }) => {
    const counter = canvasElement.querySelector('demo-wc-counter');
    await counter.updateComplete;

    const badges = [...counter.shadowRoot.querySelectorAll('[part="badge"]')];
    await expect(counter.badges).toEqual(args.badges);
    await expect(counter).not.toHaveAttribute('badges');
    await expect(badges).toHaveLength(2);
    await expect(badges.map((badge) => badge.textContent)).toEqual(['new', 'hot']);
  },
};

export const DateProperty = {
  args: { deadline: new Date('2026-12-24T00:00:00.000Z') },
  play: async ({ canvasElement }) => {
    const counter = canvasElement.querySelector('demo-wc-counter');
    await counter.updateComplete;

    await expect(counter).not.toHaveAttribute('deadline');
    await expect(counter.shadowRoot.querySelector('[part="deadline"]')).toHaveTextContent(
      '2026-12-24'
    );
  },
};

export const Events = {
  args: { 'count-changed-event': fn() },
  play: async ({ args, canvasElement }) => {
    const counter = canvasElement.querySelector('demo-wc-counter');
    await counter.updateComplete;

    await userEvent.click(counter.shadowRoot.querySelector('[part="button"]'));

    await expect(args['count-changed-event']).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'count-changed', detail: { count: 1 } })
    );
  },
};

export const Slots = {
  args: {
    'default-slot': '<strong>Score</strong>',
    'prefix-slot': '★',
  },
  play: async ({ canvasElement }) => {
    const counter = canvasElement.querySelector('demo-wc-counter');
    await counter.updateComplete;

    await expect(counter.querySelector(':scope > strong:not([slot])')).toHaveTextContent('Score');
    await expect(counter.querySelector(':scope > [slot="prefix"]')).toHaveTextContent('★');
  },
};

export const CssCustomProperties = {
  args: { '--demo-wc-counter-accent': 'rgb(102, 51, 153)' },
  play: async ({ canvasElement }) => {
    const counter = canvasElement.querySelector('demo-wc-counter');
    await counter.updateComplete;

    const button = counter.shadowRoot.querySelector('[part="button"]');
    await expect(getComputedStyle(button).backgroundColor).toBe('rgb(102, 51, 153)');
  },
};

export const NumberCssCustomProperty = {
  args: { badges: ['new'], '--demo-wc-counter-badge-opacity': 0.5 },
  play: async ({ canvasElement }) => {
    const counter = canvasElement.querySelector('demo-wc-counter');
    await counter.updateComplete;

    const badge = counter.shadowRoot.querySelector('[part="badge"]');
    await expect(counter.style.getPropertyValue('--demo-wc-counter-badge-opacity')).toBe('0.5');
    await expect(getComputedStyle(badge).opacity).toBe('0.5');
  },
};

export const CssParts = {
  args: { 'value-part': 'color: rgb(220, 20, 60); font-weight: 700;' },
  play: async ({ canvasElement }) => {
    const counter = canvasElement.querySelector('demo-wc-counter');
    await counter.updateComplete;

    const value = counter.shadowRoot.querySelector('[part="value"]');
    await expect(getComputedStyle(value).color).toBe('rgb(220, 20, 60)');
    await expect(getComputedStyle(value).fontWeight).toBe('700');
  },
};

export const CssStates = {
  args: {
    count: 4,
    max: 5,
    'at-max-state': 'outline: 2px solid rgb(0, 128, 0);',
  },
  play: async ({ canvasElement }) => {
    const counter = canvasElement.querySelector('demo-wc-counter');
    await counter.updateComplete;

    await expect(getComputedStyle(counter).outlineStyle).toBe('none');

    await userEvent.click(counter.shadowRoot.querySelector('[part="button"]'));

    await waitFor(() => expect(counter.matches(':state(at-max)')).toBe(true));
    await expect(getComputedStyle(counter).outlineColor).toBe('rgb(0, 128, 0)');
  },
};

export const AllCategories = {
  args: {
    count: 2,
    step: 3,
    disabled: false,
    size: 'small',
    tone: 'success',
    label: 'Add a star',
    badges: ['sale'],
    unit: { singular: 'star', plural: 'stars' },
    deadline: new Date('2026-12-24T00:00:00.000Z'),
    'count-changed-event': fn(),
    'default-slot': 'Rating',
    'prefix-slot': '★',
    '--demo-wc-counter-accent': 'rgb(178, 34, 34)',
    '--demo-wc-counter-badge-opacity': 0.8,
    'value-part': 'font-variant-numeric: tabular-nums;',
    'at-max-state': 'opacity: 0.6;',
  },
};
