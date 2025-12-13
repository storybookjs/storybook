import React from 'react';

export interface PageProps {
  user?: {
    name: string;
  };
  onLogin?: () => void;
  onLogout?: () => void;
  onCreateAccount?: () => void;
}

export const Page: React.FC<PageProps> = ({ user, onLogin, onLogout, onCreateAccount }) => (
  <article>
    <header>
      <div>
        <h1>Acme</h1>
        {user ? (
          <button onClick={onLogout}>Log out</button>
        ) : (
          <>
            <button onClick={onLogin}>Log in</button>
            <button onClick={onCreateAccount}>Sign up</button>
          </>
        )}
      </div>
    </header>
    <section>
      <h2>Pages in Storybook</h2>
      <p>
        We recommend building UIs with a <strong>component-driven</strong> process starting with atomic components and ending with pages.
      </p>
      <p>
        Render pages with mock data. This makes it easy to build and review page states without needing to navigate to them in your app. Here are some handy patterns for managing page data.
      </p>
    </section>
  </article>
);
