import React from 'react';
import useReactHook from './useReactHook';

const ReactHookWrapper: React.FC = () => {
    const [value, setValue] = useReactHook();
    return (
        <div>
            <p>Value: {value}</p>
            <button onClick={() => setValue(value + 1)}>Increment</button>
        </div>
    );
};

export default ReactHookWrapper;
