import { describe, it, expect } from 'vitest';
import { normalizeStoriesEntry } from '@storybook/core/common';

import { userOrAutoTitleFromSpecifier as userOrAuto } from './autoTitle';

expect.addSnapshotSerializer({
  print: (val: any) => val,
  test: (val: any) => true,
});

// Make these two the same so `normalizeStoriesEntry` doesn't change anything
const options = {
  configDir: '/path',
  workingDir: '/path',
};
const winOptions = {
  configDir: '\\path',
  workingDir: '\\path',
};

describe('userOrAutoTitleFromSpecifier', () => {
  describe('user title', () => {
    it('no match', () => {
      expect(
        userOrAuto(
          './ path / to / file.stories.js',
          normalizeStoriesEntry({ directory: './ other' }, options),
          'title'
        )
      ).toBeFalsy();
    });

    describe('no trailing slash', () => {
      it('match with no titlePrefix', () => {
        expect(
          userOrAuto(
            './path/to/file.stories.js',
            normalizeStoriesEntry({ directory: './path' }, options),
            'title'
          )
        ).toMatchInlineSnapshot(`title`);
      });

      it('match with titlePrefix', () => {
        expect(
          userOrAuto(
            './path/to/file.stories.js',
            normalizeStoriesEntry({ directory: './path', titlePrefix: 'atoms' }, options),
            'title'
          )
        ).toMatchInlineSnapshot(`atoms/title`);
      });

      it('match with hyphen path', () => {
        expect(
          userOrAuto(
            './path/to-my/file.stories.js',
            normalizeStoriesEntry({ directory: './path', titlePrefix: 'atoms' }, options),
            'title'
          )
        ).toMatchInlineSnapshot(`atoms/title`);
      });

      it('match with underscore path', () => {
        expect(
          userOrAuto(
            './path/to_my/file.stories.js',
            normalizeStoriesEntry({ directory: './path', titlePrefix: 'atoms' }, options),
            'title'
          )
        ).toMatchInlineSnapshot(`atoms/title`);
      });

      it('match with windows path', () => {
        expect(
          userOrAuto(
            './path/to_my/file.stories.js',
            normalizeStoriesEntry({ directory: '.\\path', titlePrefix: 'atoms' }, winOptions),
            'title'
          )
        ).toMatchInlineSnapshot(`atoms/title`);
      });
    });

    describe('trailing slash', () => {
      it('match with no titlePrefix', () => {
        expect(
          userOrAuto(
            './path/to/file.stories.js',
            normalizeStoriesEntry({ directory: './path/' }, options),
            'title'
          )
        ).toMatchInlineSnapshot(`title`);
      });

      it('match with titlePrefix', () => {
        expect(
          userOrAuto(
            './path/to/file.stories.js',
            normalizeStoriesEntry({ directory: './path/', titlePrefix: 'atoms' }, options),
            'title'
          )
        ).toMatchInlineSnapshot(`atoms/title`);
      });

      it('match with hyphen path', () => {
        expect(
          userOrAuto(
            './path/to-my/file.stories.js',
            normalizeStoriesEntry({ directory: './path/', titlePrefix: 'atoms' }, options),
            'title'
          )
        ).toMatchInlineSnapshot(`atoms/title`);
      });

      it('match with underscore path', () => {
        expect(
          userOrAuto(
            './path/to_my/file.stories.js',
            normalizeStoriesEntry({ directory: './path/', titlePrefix: 'atoms' }, options),
            'title'
          )
        ).toMatchInlineSnapshot(`atoms/title`);
      });

      it('match with windows path', () => {
        expect(
          userOrAuto(
            './path/to_my/file.stories.js',
            normalizeStoriesEntry({ directory: '.\\path\\', titlePrefix: 'atoms' }, winOptions),
            'title'
          )
        ).toMatchInlineSnapshot(`atoms/title`);
      });
    });
  });

  describe('auto title', () => {
    it('no match', () => {
      expect(
        userOrAuto(
          './ path / to / file.stories.js',
          normalizeStoriesEntry({ directory: './ other' }, options),
          undefined
        )
      ).toBeFalsy();
    });

    describe('no trailing slash', () => {
      it('match with no titlePrefix', () => {
        expect(
          userOrAuto(
            './path/to/file.stories.js',
            normalizeStoriesEntry({ directory: './path' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`to/file`);
      });

      it('match with titlePrefix', () => {
        expect(
          userOrAuto(
            './path/to/file.stories.js',
            normalizeStoriesEntry({ directory: './path', titlePrefix: 'atoms' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`atoms/to/file`);
      });

      it('match with trailing duplicate', () => {
        expect(
          userOrAuto(
            './path/to/button/button.stories.js',
            normalizeStoriesEntry({ directory: './path' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`to/button`);
      });

      it('match with case-insensitive trailing duplicate', () => {
        expect(
          userOrAuto(
            './path/to/button/Button.stories.js',
            normalizeStoriesEntry({ directory: './path' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`to/Button`);
      });

      it('match with trailing index', () => {
        expect(
          userOrAuto(
            './path/to/button/index.stories.js',
            normalizeStoriesEntry({ directory: './path' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`to/button`);
      });

      it('match with trailing stories', () => {
        expect(
          userOrAuto(
            './path/to/button/stories.js',
            normalizeStoriesEntry({ directory: './path', files: '**/?(*.)stories.*' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`to/button`);
      });

      it('match with trailing stories (windows path)', () => {
        expect(
          userOrAuto(
            './path/to/button/stories.js',
            normalizeStoriesEntry(
              { directory: '.\\path\\', files: '**/?(*.)stories.*' },
              winOptions
            ),
            undefined
          )
        ).toMatchInlineSnapshot(`to/button`);
      });

      it('match with dotted component', () => {
        expect(
          userOrAuto(
            './path/to/button/button.group.stories.js',
            normalizeStoriesEntry({ directory: './path' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`to/button/button.group`);
      });

      it('match with hyphen path', () => {
        expect(
          userOrAuto(
            './path/to-my/file.stories.js',
            normalizeStoriesEntry({ directory: './path' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`to-my/file`);
      });

      it('match with underscore path', () => {
        expect(
          userOrAuto(
            './path/to_my/file.stories.js',
            normalizeStoriesEntry({ directory: './path' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`to_my/file`);
      });

      it('match with short path', () => {
        // Make sure "stories" isn't trimmed as redundant when there won't be
        // anything left.
        expect(
          userOrAuto(
            './path/stories.js',
            normalizeStoriesEntry({ directory: './path', files: '**/?(*.)stories.*' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`stories`);
      });

      it('match with windows path', () => {
        expect(
          userOrAuto(
            './path/to_my/file.stories.js',
            normalizeStoriesEntry({ directory: '.\\path' }, winOptions),
            undefined
          )
        ).toMatchInlineSnapshot(`to_my/file`);
      });
    });

    describe('trailing slash', () => {
      it('match with no titlePrefix', () => {
        expect(
          userOrAuto(
            './path/to/file.stories.js',
            normalizeStoriesEntry({ directory: './path/' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`to/file`);
      });

      it('match with titlePrefix', () => {
        expect(
          userOrAuto(
            './path/to/file.stories.js',
            normalizeStoriesEntry({ directory: './path/', titlePrefix: 'atoms' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`atoms/to/file`);
      });

      it('match with hyphen path', () => {
        expect(
          userOrAuto(
            './path/to-my/file.stories.js',
            normalizeStoriesEntry({ directory: './path/' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`to-my/file`);
      });

      it('match with underscore path', () => {
        expect(
          userOrAuto(
            './path/to_my/file.stories.js',
            normalizeStoriesEntry({ directory: './path/' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`to_my/file`);
      });

      it('match with windows path', () => {
        expect(
          userOrAuto(
            './path/to_my/file.stories.js',
            normalizeStoriesEntry({ directory: '.\\path\\' }, winOptions),
            undefined
          )
        ).toMatchInlineSnapshot(`to_my/file`);
      });

      it('camel-case file', () => {
        expect(
          userOrAuto(
            './path/to_my/MyButton.stories.js',
            normalizeStoriesEntry({ directory: './path' }, options),
            undefined
          )
        ).toMatchInlineSnapshot(`to_my/MyButton`);
      });
    });

    it('Story.stories.js', () => {
      expect(
        userOrAuto(
          '../blocks/src/Story.stories.tsx',
          normalizeStoriesEntry(
            {
              directory: '../blocks/src',
              titlePrefix: '@blocks',
            },
            options
          ),
          undefined
        )
      ).toMatchInlineSnapshot(`@blocks/Story`);
    });
  });
});
