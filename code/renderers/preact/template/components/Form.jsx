import { useState } from 'preact/hooks';

/**
 * Header component
 *
 * @param {object} props
 * @param {object} [props.user]
 * @param {string} props.user.name
 * @param {function} props.onLogin
 * @param {function} props.onLogout
 * @param {function} props.onCreateAccount
 */
export const Form = ({ onSuccess }) => {
  const [value, setValue] = useState('');
  const [complete, setComplete] = useState(false);

  function onSubmit(event) {
    event.preventDefault();
    onSuccess(value);

    setTimeout(() => setComplete(true), 500);
    setTimeout(() => setComplete(false), 1500);
  }

  return (
    <form id="interaction-test-form" onSubmit={onSubmit}>
      <label>
        Enter Value
        <input
          type="text"
          data-testid="value"
          value={value}
          required
          onInput={(event) => setValue(event.target.value)}
        />
      </label>
      <button type="submit">Submit</button>
      {complete && <p>Completed!!</p>}
    </form>
  );
};
