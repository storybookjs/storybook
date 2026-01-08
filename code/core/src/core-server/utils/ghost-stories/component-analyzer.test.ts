import { describe, expect, it } from 'vitest';

import { getComponentComplexity } from './component-analyzer';

describe('getComponentComplexity', () => {
  it('returns score between 0 and 1', () => {
    const source = 'const x = 1;';
    const score = getComponentComplexity(source);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('calculates complexity based on runtime lines and imports', () => {
    const superSimpleComponent = `
      import React from 'react';
      export const Button = () => <button>Click</button>;
    `;

    const simpleComponent = `
      import React from 'react';
      import { foo } from './foo';
      export const Button = () => {
        return <>
          <foo>
            <bar>
              <baz>
                <qux>
              </baz>
            </bar>
          </foo>
        </>;
      };
    `;

    const complexComponent = `
      import React, { useState, useEffect } from 'react';
      import { api } from './api';
      import { utils } from './utils';
      import { types } from './types';

      interface Props {
        id: string;
        onClick: () => void;
      }

      type State = {
        loading: boolean;
        data: any[];
      };

      export const ComplexComponent: React.FC<Props> = ({ id, onClick }) => {
        const [state, setState] = useState<State>({ loading: true, data: [] });
        const [count, setCount] = useState(0);

        useEffect(() => {
          api.fetchData(id).then(data => {
            setState({ loading: false, data });
          });
        }, [id]);

        useEffect(() => {
          setCount(c => c + 1);
        }, [state.data]);

        const handleClick = () => {
          setCount(0);
          onClick();
        };

        if (state.loading) {
          return <div>Loading...</div>;
        }

        return (
          <div>
            <h1>Data Count: {state.data.length}</h1>
            <button onClick={handleClick}>
              Clicked {count} times
            </button>
            {state.data.map(item => (
              <div key={item.id}>{item.name}</div>
            ))}
          </div>
        );
      };
    `;

    const superSimpleScore = getComponentComplexity(superSimpleComponent);
    const simpleScore = getComponentComplexity(simpleComponent);
    const complexScore = getComponentComplexity(complexComponent);

    expect(superSimpleScore).toMatchInlineSnapshot(`0.05`);
    expect(simpleScore).toMatchInlineSnapshot(`0.28`);
    expect(complexScore).toMatchInlineSnapshot(`0.72`);

    expect(complexScore).toBeGreaterThan(simpleScore);
  });

  it('handles empty source', () => {
    expect(getComponentComplexity('')).toBe(0);
  });

  it('handles source with only types', () => {
    const typesOnly = `
      interface Props {
        name: string;
      }
      type Component = React.FC<Props>;
      export type { Component };
    `;
    expect(getComponentComplexity(typesOnly)).toBe(0);
  });

  it('converges to 1 as complexity increases', () => {
    const lowComplexity = 'const x = 1;';
    const highComplexity = 'const x = 1;\n'.repeat(1000) + 'import a from "b";\n'.repeat(100);

    const lowScore = getComponentComplexity(lowComplexity);
    const highScore = getComponentComplexity(highComplexity);

    expect(highScore).toBeGreaterThan(lowScore);
    expect(highScore).toBeCloseTo(1, 1); // Should be very close to 1
  });
});
