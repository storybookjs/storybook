import React from 'react';

import type { NodeResult } from 'axe-core';
import { styled } from 'storybook/theming';

import { useA11yContext } from '../A11yContext';

interface ToggleProps {
  elementsToHighlight: NodeResult[];
  toggleId?: string;
}

const Checkbox = styled.input<{ disabled: boolean }>(({ disabled }) => ({
  cursor: disabled ? 'not-allowed' : 'pointer',
}));

const HighlightToggle: React.FC<ToggleProps> = ({ toggleId, elementsToHighlight = [] }) => {
  const { toggleHighlight, highlighted } = useA11yContext();

  return (
    <Checkbox
      id={toggleId}
      type="checkbox"
      aria-label="Highlight results"
      disabled={!elementsToHighlight.length}
      onChange={toggleHighlight}
      checked={highlighted}
    />
  );
};

export default HighlightToggle;
