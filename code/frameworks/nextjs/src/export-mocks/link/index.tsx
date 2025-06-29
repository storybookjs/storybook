import React from 'react';

import { fn } from 'storybook/test';

// Mock implementation for next/link
const mockLink = fn().mockName('next/link::Link');

const linkExports = {
  default: mockLink,
};

export default linkExports.default;
export { mockLink as Link };
