export function enhance(form: HTMLFormElement) {
  const listener = (e: Event) => {
    e.preventDefault();
    const event = new CustomEvent('storybook:enhance');
    window.dispatchEvent(event);
  };
  form.addEventListener('submit', listener);
  return {
    destroy() {
      form.removeEventListener('submit', listener);
    },
  };
}

export function applyAction() {}

export function deserialize() {}
