import { Link, Outlet } from '@tanstack/react-router';

export const NavLayout = (): JSX.Element => (
  <div>
    <nav>
      <Link to="/">Home</Link>
      <Link to="/about">About</Link>
    </nav>
    <Outlet />
  </div>
);

export const HomePage = (): JSX.Element => (
  <section>
    <h2>Home Page</h2>
    <p>Welcome home.</p>
  </section>
);

export const AboutPage = (): JSX.Element => (
  <section>
    <h2>About Page</h2>
    <p>Learn more about us.</p>
  </section>
);
