import { ProbeCard } from './probe-card.tsx';

export default function Page() {
  return (
    <main style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <h1>devtools-spike next-probe</h1>
      <ProbeCard title="Probe card" />
    </main>
  );
}
