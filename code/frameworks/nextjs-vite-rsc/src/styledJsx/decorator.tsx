import * as React from 'react';

import { StyleRegistry } from 'styled-jsx';

export const StyledJsxDecorator = (Story: React.FC): React.ReactNode => (
  <StyleRegistry>
    <Story />
  </StyleRegistry>
);
