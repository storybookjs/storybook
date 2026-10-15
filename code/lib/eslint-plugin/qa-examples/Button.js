export const Button = (props) => {
  const button = document.createElement('button');
  button.textContent = props.label ?? 'Button';
  return button;
};
