import React from 'react';

/**
 * @param {object} props
 * @param {string} props.label
 * @param {() => void} props.onClick
 */
function Button({ label, onClick }) {
  return <button onClick={onClick}>{label}</button>;
}

const MemoButton = React.memo(Button);
export const component = MemoButton;
