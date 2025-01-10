export const Form = ({ onSuccess }) => {
  const container = document.createElement('div');

  const getInnerHTML = ({ complete, value }) => `
  <form id="interaction-test-form">
    <label>
      Enter Value
      <input type="text" data-testid="value" value="${value}" required />
    </label>
    <button type="submit">Submit</button>
    ${complete ? '<p>Completed!!</p>' : ''}
  </form>
`;

  container.innerHTML = getInnerHTML({ complete: false, value: '' });

  const form = container.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const { value } = form.querySelector('input'); // Store the current value

    setTimeout(() => {
      container.innerHTML = getInnerHTML({ complete: true, value });
    }, 500);
    setTimeout(() => {
      container.innerHTML = getInnerHTML({ complete: false, value });
    }, 1500);
    onSuccess(value);
  });

  return container;
};
