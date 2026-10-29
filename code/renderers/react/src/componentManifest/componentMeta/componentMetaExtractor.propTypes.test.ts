import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { extractArgTypes } from '../../extractArgTypes.ts';
import { extractFromStoryWithConfig } from './componentMetaExtractor.test-helpers.ts';
import { DEFAULT_TSCONFIG } from './test-helpers.ts';

/** The shared default tsconfig plus allowJs, so untyped .jsx components join the program. */
const JS_TSCONFIG = {
  ...DEFAULT_TSCONFIG,
  compilerOptions: { ...DEFAULT_TSCONFIG.compilerOptions, allowJs: true },
  include: [...DEFAULT_TSCONFIG.include, './**/*.js', './**/*.jsx'],
};

describe('PropTypes fallback for JS components', () => {
  it('reads PropTypes annotations the checker cannot resolve', async () => {
    const entry = await extractFromStoryWithConfig(
      {
        'test/PropTypesButton.jsx': dedent`
          import React from 'react';
          import PropTypes from 'prop-types';

          export const Button = ({ label, primary = false, onClick, size, ...props }) => (
            <button onClick={onClick}>{label}</button>
          );

          Button.propTypes = {
            label: PropTypes.string.isRequired,
            primary: PropTypes.bool,
            size: PropTypes.oneOf(['small', 'medium', 'large']),
            onClick: PropTypes.func,
          };
        `,
        'test/PropTypesButton.stories.jsx': dedent`
          import { Button } from './PropTypesButton';

          export default { component: Button };
        `,
      },
      'test/PropTypesButton.stories.jsx',
      JS_TSCONFIG
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        label: { type: { name: 'string' }, required: true },
        primary: { type: { name: 'bool' }, required: false },
        size: {
          type: {
            name: 'enum',
            value: [{ value: '"small"' }, { value: '"medium"' }, { value: '"large"' }],
          },
          required: false,
        },
        onClick: { type: { name: 'func' }, required: false },
      },
    });
  });

  it('accepts quoted keys, signed numbers, and boolean literals in oneOf', async () => {
    const entry = await extractFromStoryWithConfig(
      {
        'test/EdgeCaseButton.jsx': dedent`
          import React from 'react';
          import PropTypes from 'prop-types';

          export const Button = ({ label, level, flag }) => <button />;

          Button.propTypes = {
            'label': PropTypes.string,
            level: PropTypes.oneOf([-1, 0, 1]),
            flag: PropTypes.oneOf([true, false]),
          };
        `,
        'test/EdgeCaseButton.stories.jsx': dedent`
          import { Button } from './EdgeCaseButton';

          export default { component: Button };
        `,
      },
      'test/EdgeCaseButton.stories.jsx',
      JS_TSCONFIG
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        label: { type: { name: 'string' } },
        level: {
          type: { name: 'enum', value: [{ value: '-1' }, { value: '0' }, { value: '1' }] },
        },
        flag: {
          type: { name: 'enum', value: [{ value: 'true' }, { value: 'false' }] },
        },
      },
    });
  });

  it('prefers propTypes for untyped JS props with destructuring defaults, like the sandbox template', async () => {
    const entry = await extractFromStoryWithConfig(
      {
        'test/DefaultSizeButton.jsx': dedent`
          import React from 'react';
          import PropTypes from 'prop-types';

          export const Button = ({ primary = false, size = 'medium', label = 'Hello world' }) => (
            <button>{label}</button>
          );

          Button.propTypes = {
            primary: PropTypes.bool,
            size: PropTypes.oneOf(['small', 'medium', 'large']),
            label: PropTypes.string,
          };
        `,
        'test/DefaultSizeButton.stories.jsx': dedent`
          import { Button } from './DefaultSizeButton';

          export default { component: Button };
        `,
      },
      'test/DefaultSizeButton.stories.jsx',
      JS_TSCONFIG
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        // A destructuring default gives the checker a real type, but on an untyped JS binding the
        // propTypes annotation still wins — this is what restores the sandbox size control.
        primary: { type: { name: 'bool' }, required: false },
        size: {
          type: {
            name: 'enum',
            value: [{ value: '"small"' }, { value: '"medium"' }, { value: '"large"' }],
          },
          required: false,
        },
        label: { type: { name: 'string' }, required: false },
      },
    });
  });

  it('keeps JSDoc types over propTypes on a typed .jsx component', async () => {
    const entry = await extractFromStoryWithConfig(
      {
        'test/JsDocButton.jsx': dedent`
          import React from 'react';
          import PropTypes from 'prop-types';

          /**
           * @param {{ size?: 'small' | 'medium', label: string }} props
           */
          export const Button = (props) => <button />;

          Button.propTypes = {
            size: PropTypes.oneOf(['small', 'large']),
            label: PropTypes.string.isRequired,
          };
        `,
        'test/JsDocButton.stories.jsx': dedent`
          import { Button } from './JsDocButton';

          export default { component: Button };
        `,
      },
      'test/JsDocButton.stories.jsx',
      JS_TSCONFIG
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        // The JSDoc union wins over the oneOf enum — 'large' must not leak in.
        size: {
          required: false,
          type: {
            name: 'enum',
            value: [{ value: '"small"' }, { value: '"medium"' }],
          },
        },
        label: { type: { name: 'string' }, required: true },
      },
    });
  });

  it('keeps TS types over propTypes when a .jsx re-binds a .tsx component', async () => {
    const entry = await extractFromStoryWithConfig(
      {
        'test/InnerButton.tsx': dedent`
          import React from 'react';

          interface Props { label: string }

          export const InnerButton = (props: Props) => <button />;
        `,
        'test/ReboundButton.jsx': dedent`
          import React from 'react';
          import PropTypes from 'prop-types';
          import { InnerButton } from './InnerButton';

          export const Button = InnerButton;

          Button.propTypes = {
            label: PropTypes.oneOf(['a', 'b']),
          };
        `,
        'test/ReboundButton.stories.jsx': dedent`
          import { Button } from './ReboundButton';

          export default { component: Button };
        `,
      },
      'test/ReboundButton.stories.jsx',
      JS_TSCONFIG
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        // The prop declarations live in the .tsx file, so the TS type wins over the oneOf enum.
        label: { type: { name: 'string' }, required: true },
      },
    });
  });

  it('preserves boolean oneOf choices as real booleans through argTypes conversion', async () => {
    const entry = await extractFromStoryWithConfig(
      {
        'test/FlagButton.jsx': dedent`
          import React from 'react';
          import PropTypes from 'prop-types';

          export const Button = ({ flag }) => <button />;

          Button.propTypes = {
            flag: PropTypes.oneOf([true, false]),
          };
        `,
        'test/FlagButton.stories.jsx': dedent`
          import { Button } from './FlagButton';

          export default { component: Button };
        `,
      },
      'test/FlagButton.stories.jsx',
      JS_TSCONFIG
    );

    const meta = entry.component?.reactComponentMeta;
    if (!meta) {
      throw new Error('expected component meta for FlagButton');
    }

    // Checks the FINAL argTypes — the shape Controls consumes — not just the extracted
    // metadata: the converter must not turn boolean choices into strings, or selecting
    // false would pass the truthy string "false" to the component.
    const argTypes = extractArgTypes({ __docgenInfo: meta });
    expect(argTypes?.flag?.type).toMatchObject({ name: 'enum', value: [true, false] });
  });
});
