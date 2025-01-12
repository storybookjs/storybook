import React from 'react';

import { styled } from 'storybook/internal/theming';

import type { NodeResult } from 'axe-core';

import { useA11yContext } from '../A11yContext';

interface ToggleProps {
  elementsToHighlight: NodeResult[];
  toggleId?: string;
}

enum CheckBoxStates {
  CHECKED,
  UNCHECKED,
  INDETERMINATE,
}

const Checkbox = styled.input<{ disabled: boolean }>(({ disabled }) => ({
  cursor: disabled ? 'not-allowed' : 'pointer',
}));

function areAllRequiredElementsHighlighted(
  elementsToHighlight: NodeResult[],
  highlighted: string[]
): CheckBoxStates {
  const highlightedCount = elementsToHighlight.filter((item) =>
    highlighted.includes(item.target[0] as any)
  ).length;

  return highlightedCount === 0
    ? CheckBoxStates.UNCHECKED
    : highlightedCount === elementsToHighlight.length
      ? CheckBoxStates.CHECKED
      : CheckBoxStates.INDETERMINATE;
}

const HighlightToggle: React.FC<ToggleProps> = ({ toggleId, elementsToHighlight = [] }) => {
  const { toggleHighlight, highlighted } = useA11yContext();
  const checkBoxRef = React.useRef<HTMLInputElement>(null);
  const [checkBoxState, setChecked] = React.useState(
    areAllRequiredElementsHighlighted(elementsToHighlight, highlighted)
  );

  React.useEffect(() => {
    const newState = areAllRequiredElementsHighlighted(elementsToHighlight, highlighted);
    if (checkBoxRef.current) {
      checkBoxRef.current.indeterminate = newState === CheckBoxStates.INDETERMINATE;
    }
    setChecked(newState);
  }, [elementsToHighlight, highlighted]);

  const handleToggle = React.useCallback((): void => {
    toggleHighlight(
      elementsToHighlight.map((e) => e.target[0] as any),
      checkBoxState !== CheckBoxStates.CHECKED
    );
  }, [elementsToHighlight, checkBoxState, toggleHighlight]);

  return (
    <Checkbox
      ref={checkBoxRef}
      id={toggleId}
      type="checkbox"
      aria-label="Highlight result"
      disabled={!elementsToHighlight.length}
      onChange={handleToggle}
      checked={checkBoxState === CheckBoxStates.CHECKED}
    />
  );
};

export default HighlightToggle;
