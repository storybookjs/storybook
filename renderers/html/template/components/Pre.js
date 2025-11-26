export const Pre = (args) => {
  const pre = document.createElement('pre');

  pre.setAttribute('data-testid', 'pre');
  pre.style = args.style;

  if (args.object) {
    pre.textContent = JSON.stringify(args.object, null, 2);
  } else {
    pre.textContent = args.text;
  }

  return pre;
};
