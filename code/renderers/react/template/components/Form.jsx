import React, { useState } from 'react';

import PropTypes from 'prop-types';

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
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button type="submit">Submit</button>
      {complete && <p>Completed!!</p>}
    </form>
  );
};

Form.propTypes = {
  onSuccess: PropTypes.func.isRequired,
};
