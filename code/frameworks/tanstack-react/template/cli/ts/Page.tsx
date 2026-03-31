import React from 'react';

import { Link, useRouterState } from '@tanstack/react-router';

import { Header } from './Header';
import './page.css';

type User = {
  name: string;
};

function CurrentRoute() {
  const { location } = useRouterState();

  return (
    <div
      style={{
        padding: '12px 16px',
        background: '#f6f9fc',
        border: '1px solid #e0e6ef',
        borderRadius: 8,
        fontFamily: 'monospace',
        fontSize: 13,
        marginBottom: 24,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontWeight: 600, color: '#333' }}>Current route:</span>
      <code style={{ color: '#029cfd' }}>{location.pathname}</code>
      {location.searchStr && (
        <>
          <span style={{ color: '#666' }}>search:</span>
          <code style={{ color: '#66bf3c' }}>{location.searchStr}</code>
        </>
      )}
    </div>
  );
}

export const Page: React.FC = () => {
  const [user, setUser] = React.useState<User>();

  return (
    <article>
      <Header
        user={user}
        onLogin={() => setUser({ name: 'Jane Doe' })}
        onLogout={() => setUser(undefined)}
        onCreateAccount={() => setUser({ name: 'Jane Doe' })}
      />

      <section className="storybook-page">
        <h2>TanStack Router in Storybook</h2>

        <CurrentRoute />

        <p>
          Every story is wrapped in a TanStack Router provider automatically. Click the links below
          and check the <strong>Actions</strong> panel to see the <code>onNavigate</code> spy
          capture each navigation attempt.
        </p>

        <nav
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 24,
          }}
        >
          <Link
            to="/"
            className="storybook-button storybook-button--small storybook-button--secondary"
          >
            Home
          </Link>
          <Link
            to="/about"
            className="storybook-button storybook-button--small storybook-button--secondary"
          >
            About
          </Link>
          <Link
            to="/settings"
            search={{ tab: 'profile' }}
            className="storybook-button storybook-button--small storybook-button--secondary"
          >
            Settings
          </Link>
        </nav>

        <p>
          The current route display above reads from <code>useRouterState()</code> — a real TanStack
          Router hook running inside Storybook's mock router. Use the{' '}
          <code>tanstack.router.path</code> story parameter to set the initial route.
        </p>

        <div className="tip-wrapper">
          <span className="tip">Tip</span> Each navigation is intercepted and logged as an action.
          No page actually changes — this lets you test routing behavior in isolation.
        </div>
      </section>
    </article>
  );
};
