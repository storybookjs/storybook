import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type { CSSObject } from 'storybook/theming';
import { Global } from 'storybook/theming';

const PARAGRAPHS = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
  'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.',
  'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.',
  'Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus.',
];

const shellStyles: CSSObject = {
  '.cs-shell': {
    // Padding lives here, not on `body`: `layout: 'fullscreen'` applies
    // `.sb-show-main.sb-main-fullscreen { padding: 0 }`, which outranks an element selector.
    maxWidth: 680,
    margin: '0 auto',
    padding: '64px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  '.cs-shell p': {
    margin: 0,
  },
};

/**
 * Manual harness for the preview's overscroll gutter, which only a real trackpad gesture can
 * reveal — synthetic wheel events and CDP scroll gestures do not rubber-band. Scroll past either end
 * with a trackpad and hold; a flick snaps back before the gutter can be seen.
 *
 * This half paints no background at all, so the preview document stays transparent and what shows is
 * Storybook's own default canvas. The stories vary only `color-scheme`, which is what the browser
 * themes its own UI from — scrollbar, native controls, and `CanvasText`. The controls are left
 * unstyled so they double as a readout of the scheme the browser actually resolved.
 *
 * Snapshots are disabled because `Adaptive` resolves against the capture browser's color scheme.
 */
const ColorSchemePage = ({ scheme }: { scheme: 'light dark' | 'light' | 'dark' }) => (
  <>
    <Global
      styles={{
        ':root': {
          colorScheme: scheme,
        },
        body: {
          // No background: the default canvas is the thing under test, and clearing or replacing it
          // here would hide it. Only the text color is forced, past `ThemedSetRoot` in
          // .storybook/preview.tsx, which assigns one inline on every render.
          color: '#2e3338 !important',
          margin: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: 1.6,
        },
        ...shellStyles,
        '.cs-controls': {
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
        },
      }}
    />
    <div className="cs-shell">
      <p>
        <code>color-scheme: {scheme}</code>
      </p>

      <h1>Overscroll follows the surrounding chrome</h1>
      <p>
        No background is set here, so this is Storybook&apos;s default canvas. Scroll past either
        end with a trackpad: the gutter should be the same color, with no white flash.
      </p>

      <div className="cs-controls">
        <input aria-label="Text input" placeholder="Text input" />
        <button type="button">Button</button>
      </div>

      {/* Repeated so the page is tall enough to scroll, which overscrolling requires. */}
      {Array.from({ length: 4 }, (_, round) =>
        PARAGRAPHS.map((text, i) => <p key={`${round}-${i}`}>{text}</p>)
      )}
    </div>
  </>
);

const meta = {
  component: ColorSchemePage,
  args: { scheme: 'light dark' },
  // The repo's `sb_theme` decorator renders a story twice under `stacked` / `side-by-side`, which
  // would give this harness two competing copies of a full-page background. Pin it to one render.
  globals: { sb_theme: 'light' },
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof ColorSchemePage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Follows the OS preference — toggle dark mode at the OS level to see it flip. */
export const Adaptive: Story = {};

export const ForcedLight: Story = {
  args: { scheme: 'light' },
};

export const ForcedDark: Story = {
  args: { scheme: 'dark' },
};

/**
 * The other half: a story that brings its own background instead of inheriting Storybook's default.
 * The accents sit near white and near black so they read as plausible page colors, and separate from
 * Storybook's cool greys by hue rather than by saturation — enough to tell the page from the gutter
 * when they meet, without being loud. `accent` and `ink` are args, so turn them up in Controls if a
 * given comparison needs to be starker.
 *
 * If the page is not the accent color while the swatch still is, something is painting over the
 * story. Two things in this repo paint body inline and are easy to misattribute that to —
 * `ThemedSetRoot` (background/color) and the a11y vision simulator (`filter`) — so to attribute it,
 * clear the inline background and re-read: `document.body.style.removeProperty('background')`.
 */
const OwnBackgroundPage = ({
  scheme,
  accent,
  ink,
}: {
  scheme: 'light' | 'dark';
  accent: string;
  ink: string;
}) => (
  <>
    <Global
      styles={{
        ':root': {
          colorScheme: scheme,
        },
        body: {
          // Where a story would normally put its background: on `body`, which propagates to the
          // document canvas. `!important` is needed only to outrank `ThemedSetRoot` in
          // .storybook/preview.tsx, which assigns an opaque background and color to body inline on
          // every render.
          background: `${accent} !important`,
          color: `${ink} !important`,
          margin: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: 1.6,
        },
        ...shellStyles,
        // Both borders derive from the inherited text color, so they follow whichever scheme the
        // story is pinned to instead of being hardcoded for one of them.
        '.cs-note, .cs-swatch': {
          border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
          padding: 12,
        },
        '.cs-swatch': {
          background: accent,
        },
      }}
    />
    <div className="cs-shell">
      <p>
        <code>
          background: {accent} on {ink} (color-scheme: {scheme})
        </code>
      </p>

      <h1>Story brings its own background</h1>
      <p className="cs-note">
        The page should be the accent color end to end, and the swatch below should disappear into
        it. If the swatch stands out, something is painting over the story.
      </p>
      <div className="cs-swatch">Accent swatch — this is the color the page should be</div>

      {Array.from({ length: 4 }, (_, round) =>
        PARAGRAPHS.map((text, i) => <p key={`${round}-${i}`}>{text}</p>)
      )}
    </div>
  </>
);

const ownBackgroundMeta = {
  render: (args: { scheme: 'light' | 'dark'; accent: string; ink: string }) => (
    <OwnBackgroundPage {...args} />
  ),
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
  },
};

export const OwnBackgroundLight = {
  ...ownBackgroundMeta,
  args: { scheme: 'light' as const, accent: '#ede6db', ink: '#3b342a' },
};

export const OwnBackgroundDark = {
  ...ownBackgroundMeta,
  args: { scheme: 'dark' as const, accent: '#2e2723', ink: '#d8d1c8' },
};
