export const Button = (args) => {
  const button = document.createElement('button');

  button.innerHTML = args.label;
  button.addEventListener('click', args.onClick);

  return button;
};
