import { Link, Outlet } from '@tanstack/react-router';

export const AppLayout = (): JSX.Element => (
  <div>
    <nav>
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/settings">Settings</Link>
    </nav>
    <Outlet />
  </div>
);

export const DashboardPage = (): JSX.Element => (
  <section>
    <h2>Dashboard</h2>
    <p>Welcome to your dashboard.</p>
  </section>
);

export const SettingsPage = (): JSX.Element => (
  <section>
    <h2>Settings</h2>
    <p>Manage your settings here.</p>
  </section>
);
