// Reference example for Copilot renderer bug verification workflow (Flow 1).
// This file demonstrates a minimal template story structure for verifying renderer bugs.
// When using Flow 1, create similar stories in code/renderers/<renderer>/template/stories/
// to demonstrate the bug and verify the fix with visual evidence.
import React from 'react';

const CBox = () => (
  <div
    data-testid="copilot-verification-colored-box"
    style={{
      width: '100px',
      height: '100px',
      backgroundColor: '#3b82f6',
    }}
  />
);

export default {
  component: CBox,
  parameters: { chromatic: { disableSnapshot: true } },
};

export const ColoredBox = {};
