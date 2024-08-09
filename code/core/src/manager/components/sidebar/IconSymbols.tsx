import type { FC } from 'react';
import React from 'react';

import { styled } from '@storybook/core/theming';

const Svg = styled.svg`
  position: absolute;
  width: 0;
  height: 0;
  display: inline-block;
  shape-rendering: inherit;
  vertical-align: middle;
`;

// We are importing the icons from @storybook/icons as we need to add symbols inside of them.
// This will allow to set icons once and use them everywhere.

const GROUP_ID = 'icon--group';
const COMPONENT_ID = 'icon--component';
const DOCUMENT_ID = 'icon--document';
const STORY_ID = 'icon--story';

export const IconSymbols: FC = () => {
  return (
    <Svg data-chromatic="ignore">
      <symbol id={GROUP_ID}>
        {/* https://github.com/storybookjs/icons/blob/main/src/icons/Folder.tsx */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M6.586 3.504l-1.5-1.5H1v9h12v-7.5H6.586zm.414-1L5.793 1.297a1 1 0 00-.707-.293H.5a.5.5 0 00-.5.5v10a.5.5 0 00.5.5h13a.5.5 0 00.5-.5v-8.5a.5.5 0 00-.5-.5H7z"
          fill="currentColor"
        />
      </symbol>
      <symbol id={COMPONENT_ID}>
        {/* https://github.com/storybookjs/icons/blob/main/src/icons/Component.tsx */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3.5 1.004a2.5 2.5 0 00-2.5 2.5v7a2.5 2.5 0 002.5 2.5h7a2.5 2.5 0 002.5-2.5v-7a2.5 2.5 0 00-2.5-2.5h-7zm8.5 5.5H7.5v-4.5h3a1.5 1.5 0 011.5 1.5v3zm0 1v3a1.5 1.5 0 01-1.5 1.5h-3v-4.5H12zm-5.5 4.5v-4.5H2v3a1.5 1.5 0 001.5 1.5h3zM2 6.504h4.5v-4.5h-3a1.5 1.5 0 00-1.5 1.5v3z"
          fill="currentColor"
        />
      </symbol>
      <symbol id={DOCUMENT_ID}>
        {/* https://github.com/storybookjs/icons/blob/main/src/icons/Document.tsx */}
        <path
          d="M4 5.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zM4.5 7.5a.5.5 0 000 1h5a.5.5 0 000-1h-5zM4 10.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M1.5 0a.5.5 0 00-.5.5v13a.5.5 0 00.5.5h11a.5.5 0 00.5-.5V3.207a.5.5 0 00-.146-.353L10.146.146A.5.5 0 009.793 0H1.5zM2 1h7.5v2a.5.5 0 00.5.5h2V13H2V1z"
          fill="currentColor"
        />
      </symbol>
      <symbol id={STORY_ID}>
        {/* https://github.com/storybookjs/icons/blob/main/src/icons/BookmarkHollow.tsx */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3.5 0h7a.5.5 0 01.5.5v13a.5.5 0 01-.454.498.462.462 0 01-.371-.118L7 11.159l-3.175 2.72a.46.46 0 01-.379.118A.5.5 0 013 13.5V.5a.5.5 0 01.5-.5zM4 12.413l2.664-2.284a.454.454 0 01.377-.128.498.498 0 01.284.12L10 12.412V1H4v11.413z"
          fill="currentColor"
        />
      </symbol>
    </Svg>
  );
};

export const UseSymbol: FC<{ type: 'group' | 'component' | 'document' | 'story' }> = ({ type }) => {
  if (type === 'group') return <use xlinkHref={`#${GROUP_ID}`} />;
  if (type === 'component') return <use xlinkHref={`#${COMPONENT_ID}`} />;
  if (type === 'document') return <use xlinkHref={`#${DOCUMENT_ID}`} />;
  if (type === 'story') return <use xlinkHref={`#${STORY_ID}`} />;
  return null;
};
