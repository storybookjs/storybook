import React from 'react';

import { EmptyBlock } from './EmptyBlock.tsx';

export default {
  component: EmptyBlock,
};

export const Error = () => <EmptyBlock>Generic error message</EmptyBlock>;
