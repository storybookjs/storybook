import React, { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    alignItems: 'center',
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto',
  },
  inputGroup: {
    display: 'flex',
    gap: '10px',
  },
  smallInput: {
    width: '150px',
    padding: '5px',
  },
  button: {
    padding: '5px 10px',
    cursor: 'pointer',
  },
  largeTextArea: {
    width: '100%',
    height: '150px',
    padding: '10px',
    resize: 'vertical',
  },
  card: {
    width: '100%',
    maxWidth: '300px',
    height: '200px',
    perspective: '1000px',
    position: 'relative',
    cursor: 'pointer',
    transition: 'transform 0.6s',
    transformStyle: 'preserve-3d',
  },
  cardSide: {
    position: 'absolute',
    width: '100%',
    padding: '16px',
    height: '100%',
    backfaceVisibility: 'hidden',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    transition: 'opacity 0.3s ease',
  },
  cardFront: {
    backgroundColor: '#f1f1f1',
  },
  cardBack: {
    backgroundColor: '#4CAF50',
    transform: 'rotateY(180deg)',
  },
} as const;

const DemoModeComponent = () => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [startX, setStartX] = useState(0);

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    setStartX(event.clientX);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setStartX(event.touches[0].clientX);
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.clientX > startX) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const endX = event.changedTouches[0].clientX;
    if (endX > startX) {
      setIsFlipped(!isFlipped);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.inputGroup}>
        <input type="text" placeholder="Type here..." style={styles.smallInput} />
        <button style={styles.button}>Submit</button>
      </div>

      <textarea placeholder="Enter more details here..." style={styles.largeTextArea}></textarea>

      <div
        aria-label="card"
        style={{
          ...styles.card,
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          style={{
            ...styles.cardSide,
            ...styles.cardFront,
            opacity: isFlipped ? 0 : 1,
            zIndex: isFlipped ? 0 : 1,
          }}
        >
          <h3>Front Side</h3>
          <p>This is the front side of the card. Drag to flip!</p>
        </div>

        {/* Back Side */}
        <div
          style={{
            ...styles.cardSide,
            ...styles.cardBack,
            opacity: isFlipped ? 1 : 0,
            zIndex: isFlipped ? 1 : 0,
          }}
        >
          <h3>Back Side</h3>
          <p>This is the back side of the card. Drag to flip back!</p>
        </div>
      </div>
    </div>
  );
};

const meta = {
  render: DemoModeComponent,
} satisfies Meta;

export default meta;

export const DemoModeHand = {
  play: async (context) => {
    const { userEvent, canvas } = context;
    const firstInput = canvas.getByPlaceholderText('Type here...');
    await userEvent.click(firstInput);
    const submitButton = canvas.getByRole('button', { name: /Submit/i });
    await userEvent.type(firstInput, 'Hello world');
    await userEvent.click(submitButton);
    const secondInput = canvas.getByPlaceholderText('Enter more details here...');
    await userEvent.type(
      secondInput,
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam quis augue non nulla tincidunt condimentum sit amet.'
    );

    const card = canvas.getByLabelText('card');
    await userEvent.pointer([
      {
        target: card,
        keys: '[TouchA>]',
        coords: { x: 50, y: 50 },
      },
      {
        target: card,
        keys: '[TouchA]',
        coords: { x: 80, y: 50 },
      },
    ]);
  },
} satisfies StoryObj<typeof meta>;

export const DemoModeCircle = {
  ...DemoModeHand,
  parameters: {
    test: {
      cursorStyle: 'circle',
      // demoModeDelay: 100,
    },
  },
};
